#!/usr/bin/env node
/* Render icons/icon.svg into everything the pages and the manifest point at.
 *
 *   node bin/build-icons.mjs
 *
 * The outputs are committed, so this only needs running after the SVG changes.
 * It borrows a headless Chromium through Playwright (npx fetches it if it is not
 * already installed) because nothing else in the repo can rasterise an SVG, and
 * that is not worth a dependency for a file that changes about never.
 *
 *   favicon.svg           the source with rounded corners, for browser tabs
 *   apple-touch-icon.png  180, full-bleed: iOS rounds the corners itself
 *   icon-192.png          rounded, transparent corners ("any" in the manifest)
 *   icon-512.png          rounded, transparent corners ("any")
 *   icon-maskable-512.png full-bleed with the artwork shrunk, for Android's adaptive shapes */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'icons');

async function loadPlaywright() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    const require = createRequire(path.join(globalRoot, 'noop.js'));
    return require('playwright').chromium;
  }
}

const full = await fs.readFile(path.join(DIR, 'icon.svg'), 'utf8');
/* 22.5% is the corner radius iOS uses, so the tab icon matches the home screen. */
const rounded = full.replace('<rect width="512" height="512"', '<rect width="512" height="512" rx="115"');
if (rounded === full) throw new Error('icon.svg: background <rect> not found');
await fs.writeFile(path.join(DIR, 'favicon.svg'), rounded);
/* Android's adaptive shapes can crop to a circle 80% of the width, so the
   maskable one gets the artwork shrunk into it; the water still runs to the
   edges because it is outside #art. */
const maskable = full.replace('<g id="art">', '<g id="art" transform="translate(256 272) scale(.8) translate(-256 -272)">');
if (maskable === full) throw new Error('icon.svg: <g id="art"> not found');

const chromium = await loadPlaywright();
const browser = await chromium.launch();
const render = async (svg, size, file) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(`<body style="margin:0">${sized}</body>`);
  await page.screenshot({ path: path.join(DIR, file), omitBackground: true });
  await page.close();
  console.log(`icons/${file}`);
};
await render(full, 180, 'apple-touch-icon.png');
await render(rounded, 192, 'icon-192.png');
await render(rounded, 512, 'icon-512.png');
await render(maskable, 512, 'icon-maskable-512.png');
await browser.close();
