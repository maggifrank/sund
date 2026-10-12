#!/usr/bin/env node
/* Build Sund 2.0 for Netlify: static files only, talking to Supabase from the
 * browser (lib/cloud.js). Run by Netlify from netlify.toml; nothing to
 * install, no bundler, the same files the app has always served.
 *
 *   /                the front page: every pool, and the way in
 *   /login.html      sign in or sign up with Google or Microsoft
 *   /welcome.html    the wizard a new account goes through once
 *   /pool.html       a pool's page, nobody's swimming on it
 *   /app/            the signed-in counter, its map and its pool pages
 *   /<username>/     someone's public page, sums only. One copy of the pages,
 *                    in /_u/, serves every username: _redirects rewrites the
 *                    address and the page asks Supabase for that username.
 *
 * Every page gets <meta name="sund-backend" content="supabase">, which is what
 * switches the shared scripts from serve.js to Supabase. Nothing here runs on
 * a server: the site has no functions.
 *
 * Usage: node bin/build-web.mjs [out]   (default web/dist)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'web', 'dist'));

/* Every browser module in lib/, which is all of them but the server's router. */
const SERVER_ONLY = new Set(['api.js']);
const libFiles = (await fs.readdir(path.join(ROOT, 'lib')))
  .filter((f) => f.endsWith('.js') && !SERVER_ONLY.has(f))
  .map((f) => [`lib/${f}`, `lib/${f}`]);

const SHARED = [
  ['styles.css', 'styles.css'],
  ['manifest.webmanifest', 'manifest.webmanifest'],
  ...['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'og.png']
    .map((f) => [`icons/${f}`, `icons/${f}`]),
  ...libFiles
];

const SITES = {
  '': [
    ...SHARED,
    ['public/home.html', 'index.html'],
    ['public/home.js', 'home.js'],
    ['public/login.html', 'login.html'],
    ['public/login.js', 'login.js'],
    ['public/welcome.html', 'welcome.html'],
    ['public/welcome.js', 'welcome.js'],
    ['public/pool.html', 'pool.html'],
    ['public/pool.js', 'pool.js']
  ],
  app: [
    ...SHARED,
    ['index.html', 'index.html'],
    ['app.js', 'app.js'],
    ['map.html', 'map.html'],
    ['map.js', 'map.js'],
    ['pool.html', 'pool.html'],
    ['pool.js', 'pool.js']
  ],
  _u: [
    ...SHARED,
    ['public/index.html', 'index.html'],
    ['public/app.js', 'app.js'],
    ['public/map.html', 'map.html'],
    ['public/map.js', 'map.js'],
    ['public/pool.html', 'pool.html'],
    ['public/pool.js', 'pool.js']
  ]
};

const cloudPage = (html) =>
  html.replace('<head>', '<head>\n<meta name="sund-backend" content="supabase">');

/* The front page's copy of a pool page belongs to nobody: no snapshot to read,
   and back goes to the front page's map. The same as bin/publish.mjs. */
const homePool = (html) => html
  .replace('<body>', '<body data-no-snapshot>')
  .replace('href="map.html"', 'href="./"')
  .replace(/\n *<p class="rate-note" data-i18n="public.readonly"><\/p>\n/, '\n');

/* Old addresses, then the public pages. Netlify serves a file that exists
   before it reads a rule that is not forced, so /app/, /login.html and the rest
   are never taken for usernames; only an address with no file behind it is.
   The usernames that would shadow a real path are reserved in the database.

   No "/:user  /:user/  301" here: Netlify matches a rule with or without the
   trailing slash, so that rule caught /name/ too and sent it to itself
   forever. /:user/* takes /name as well as /name/, and the page adds the
   slash itself (userSlash) so its relative links have the right base. */
const REDIRECTS = `/map.html     /             301
/:user/*      /_u/:splat    200
`;

/* First thing in a public page's <head>: /name becomes /name/ before anything
   relative (styles, scripts, links to map.html) is fetched from the wrong place. */
const userSlash = (html) => html.replace('<head>', `<head>
<script>if (/^\\/[^/]+$/.test(location.pathname)) location.replace(location.pathname + '/' + location.search + location.hash);</script>`);

async function copy(list, dir, transform) {
  for (const [from, to] of list) {
    const dest = path.join(dir, to);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    if (to.endsWith('.html')) {
      await fs.writeFile(dest, cloudPage(transform(to, await fs.readFile(path.join(ROOT, from), 'utf8'))));
    } else {
      await fs.copyFile(path.join(ROOT, from), dest);
    }
  }
}

/* Every relative import in what was built has to be there, or a page's module
   graph fails and the page draws nothing at all. */
async function missingImports(dir) {
  const missing = [];
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.js')) continue;
    const abs = path.join(e.parentPath ?? e.path, e.name);
    const src = await fs.readFile(abs, 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s*['"](\.[^'"]+)['"]/g)) {
      const target = path.resolve(path.dirname(abs), m[1]);
      try { await fs.access(target); } catch { missing.push(`${path.relative(dir, abs)} imports ${m[1]}`); }
    }
  }
  return missing;
}

await fs.rm(OUT, { recursive: true, force: true });
for (const [sub, list] of Object.entries(SITES)) {
  await copy(list, path.join(OUT, sub), (to, html) =>
    sub === '' && to === 'pool.html' ? homePool(html)
      : sub === '_u' && to === 'index.html' ? userSlash(html)
        : html);
}
await fs.writeFile(path.join(OUT, '_redirects'), REDIRECTS);

const missing = await missingImports(OUT);
if (missing.length) {
  console.error(`build-web: missing modules:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`built ${path.relative(ROOT, OUT) || OUT}`);
