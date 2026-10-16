#!/usr/bin/env node
/* Build Sund 2.0 for Netlify: static files only, talking to Supabase from the
 * browser (lib/cloud.js). Run by Netlify from netlify.toml; nothing to
 * install, no bundler, the same files the app has always served.
 *
 *   /                the front page: every pool, and the way in
 *   /login.html      sign in or sign up with Google or Microsoft
 *   /welcome.html    the wizard a new account goes through once
 *   /pool.html       a pool's page, nobody's swimming on it
 *   /privacy/, /terms/  the privacy policy and terms of use
 *   /admin/          the pool suggestion queue, for admins
 *   /app/            the signed-in counter, its map and its pool pages
 *   /<username>/     someone's public page, sums only. One copy of the pages,
 *                    in /_u/, serves every username: _redirects rewrites the
 *                    address and the page asks Supabase for that username.
 *
 * Every page gets <meta name="sund-backend" content="supabase">, which is what
 * switches the shared scripts from serve.js to Supabase, and lib/visit.js,
 * which counts the visit. Nothing here runs on a server: the site has no
 * functions.
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
    ['public/pool.js', 'pool.js'],
    ['public/privacy.html', 'privacy/index.html'],
    ['public/terms.html', 'terms/index.html'],
    ['public/admin.html', 'admin/index.html'],
    ['public/admin.js', 'admin/admin.js']
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
  /* map.htm and pool.htm, not .html: Netlify answers a request for a .html
     file by redirecting to the address without it, and behind the rewrite
     below that address is /_u/map, which is nobody's page. The pages still
     link to map.html and pool.html; _redirects sends those here. */
  _u: [
    ...SHARED,
    ['public/index.html', 'index.html'],
    ['public/app.js', 'app.js'],
    ['public/map.html', 'map.htm'],
    ['public/map.js', 'map.js'],
    ['public/pool.html', 'pool.htm'],
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
const REDIRECTS = `/map.html          /                301
/:user/map.html    /_u/map.htm      200
/:user/map         /_u/map.htm      200
/:user/pool.html   /_u/pool.htm     200
/:user/pool        /_u/pool.htm     200
/:user/*           /_u/:splat       200
`;

/* First thing in a public page's <head>: /name becomes /name/ before anything
   relative (styles, scripts, links to map.html) is fetched from the wrong place. */
const userSlash = (html) => html.replace('<head>', `<head>
<script>if (/^\\/[^/]+$/.test(location.pathname)) location.replace(location.pathname + '/' + location.search + location.hash);</script>`);

async function copy(list, dir, transform) {
  for (const [from, to] of list) {
    const dest = path.join(dir, to);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    if (/\.html?$/.test(to)) {
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

/* Every module a page will import, named up front in its <head>. Without this
   the browser finds them one level at a time (the page's script, then what it
   imports, then what those import), a round trip per level before anything is
   drawn; with it they are all fetched at once. */
async function moduleGraph(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const src = await fs.readFile(entry, 'utf8');
  for (const m of src.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s*['"](\.[^'"]+)['"]/gm)) {
    await moduleGraph(path.resolve(path.dirname(entry), m[1]), seen);
  }
  return seen;
}

for (const e of await fs.readdir(OUT, { withFileTypes: true, recursive: true })) {
  if (!e.isFile() || !/\.html?$/.test(e.name)) continue;
  const file = path.join(e.parentPath ?? e.path, e.name);
  let html = await fs.readFile(file, 'utf8');
  /* The visit counter, from the lib/ of the page's own site (/app/, /_u/ or the
     root), so it shares the page's copy of cloud.js. After the page's script,
     which is the one the preloads below are worked out from. */
  const site = path.relative(OUT, file).split(path.sep)[0];
  const lib = path.join(OUT, Object.hasOwn(SITES, site) ? site : '', 'lib', 'visit.js');
  html = html.replace('</body>', `<script type="module" src="${path.relative(path.dirname(file), lib).split(path.sep).join('/')}"></script>\n</body>`);
  await fs.writeFile(file, html);
  const script = html.match(/<script type="module" src="([^"]+)"/);
  if (!script) continue;
  const entry = path.resolve(path.dirname(file), script[1]);
  const deps = [...await moduleGraph(entry)].filter((f) => f !== entry);
  const links = deps.map((f) => `<link rel="modulepreload" href="${path.relative(path.dirname(file), f).split(path.sep).join('/')}">`);
  if (links.length) await fs.writeFile(file, html.replace('</head>', `${links.join('\n')}\n</head>`));
}

const missing = await missingImports(OUT);
if (missing.length) {
  console.error(`build-web: missing modules:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`built ${path.relative(ROOT, OUT) || OUT}`);
