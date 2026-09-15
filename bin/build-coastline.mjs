#!/usr/bin/env node
/* Regenerate the coastline path in lib/iceland.js.
 *
 * The outline is committed rather than fetched at runtime — the app has no
 * build step and no dependencies, and a map that needs the network to draw the
 * country would be useless in the one place this app is actually opened, which
 * is a changing room with one bar of signal. This script exists so the
 * committed path can be re-derived rather than trusted: run it, diff it.
 *
 * Source: Natural Earth 1:10m admin-0 countries, public domain. Iceland comes
 * out as five polygons — the mainland and four islands. Three of those have a
 * pool on them, so nothing is dropped for being small; the generated header
 * lists what was actually drawn rather than trusting that count to hold.
 *
 * Projection and page geometry both come from lib/iceland.js, so the outline
 * and the pool markers are placed by the same code and cannot drift apart.
 *
 * Usage:
 *   node bin/build-coastline.mjs [--tolerance 0.4] [--source FILE|URL] [--write]
 *
 * Without --write it prints the module to stdout.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { project, VIEW, MARGIN } from '../lib/iceland.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const TOLERANCE = Number(arg('--tolerance', 0.4));
const SOURCE = arg('--source', NE);
const WRITE = process.argv.includes('--write');

/* Douglas–Peucker, run on the projected points rather than on lat/lon: the
   tolerance is then a distance on the finished map, so it means the same thing
   in the Westfjords as on the south coast. Rings are closed, so the first point
   is pinned along with the last and the loop cannot unravel. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    const a = points[lo], b = points[hi];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    let worst = -1, worstAt = -1;
    for (let i = lo + 1; i < hi; i++) {
      const p = points[i];
      /* Distance to the segment, or to the shared endpoint when the segment has
         collapsed to a point — which it does on a closed ring split in two. */
      const d = len === 0
        ? Math.hypot(p.x - a.x, p.y - a.y)
        : Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
      if (d > worst) { worst = d; worstAt = i; }
    }
    if (worst > tolerance) {
      keep[worstAt] = 1;
      stack.push([lo, worstAt], [worstAt, hi]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/* One closed subpath, absolute moveto and linetos. Coordinates are rounded to
   a tenth of a unit — about 50 m on the finished map, well inside whatever
   tolerance the simplifier was given. */
function subpath(points) {
  const n = (v) => Number(v.toFixed(1));
  const [first, ...rest] = points;
  return `M${n(first.x)} ${n(first.y)}` + rest.map((p) => `L${n(p.x)} ${n(p.y)}`).join('') + 'Z';
}

/* 80-odd columns of path data, so a regenerated outline diffs line by line
   instead of as one changed line thousands of characters long. */
function wrap(d, width = 76) {
  const out = [];
  let line = '';
  for (const cmd of d.match(/[MLZ][^MLZ]*/g)) {
    if (line && line.length + cmd.length > width) { out.push(line); line = ''; }
    line += cmd;
  }
  if (line) out.push(line);
  return out;
}

const raw = /^https?:/.test(SOURCE)
  ? await (await fetch(SOURCE, { signal: AbortSignal.timeout(120000) })).json()
  : JSON.parse(await fs.readFile(SOURCE, 'utf8'));

const feature = raw.features.find((f) => f.properties.ADMIN === 'Iceland');
if (!feature) throw new Error('no Iceland feature in the source');

const polygons = feature.geometry.type === 'Polygon'
  ? [feature.geometry.coordinates]
  : feature.geometry.coordinates;

/* Outer rings only. Iceland has no holes in this dataset — a lake big enough to
   be cut out of the landmass would be Þórisvatn, and Natural Earth keeps lakes
   in a layer of their own — so anything inner would be a surprise worth seeing
   rather than silently drawing. */
function area(points) {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    sum += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  }
  return Math.abs(sum / 2);
}

const middle = (values) => (Math.min(...values) + Math.max(...values)) / 2;

const landmasses = polygons
  .map((polygon) => {
    if (polygon.length > 1) console.warn(`warning: ring with ${polygon.length - 1} hole(s) — only the outline is drawn`);
    const ring = polygon[0];
    const points = simplify(ring.map(([lon, lat]) => project(lat, lon)), TOLERANCE);
    return {
      points,
      before: ring.length,
      after: points.length,
      /* Named by where it is rather than by name: Natural Earth gives the
         country one feature and no labels for the pieces inside it, and a
         guessed name in a generated file is a guess nobody would go back and
         check. A centre and a width are checkable. */
      lat: middle(ring.map(([, lat]) => lat)),
      lon: middle(ring.map(([lon]) => lon)),
      km: (Math.max(...ring.map(([, lat]) => lat)) - Math.min(...ring.map(([, lat]) => lat))) * 111
    };
  })
  /* Biggest first so the mainland is the first thing in the file and in the
     painted output; the specks are then unambiguously the islands. */
  .sort((a, b) => area(b.points) - area(a.points));

const before = landmasses.reduce((sum, l) => sum + l.before, 0);
const after = landmasses.reduce((sum, l) => sum + l.after, 0);
const parts = landmasses.map((l) => subpath(l.points));

/* The path has to sit inside the viewBox, margin included, or markers near the
   coast get clipped. Cheaper to fail here than to notice it on a phone. */
const all = parts.join('').match(/-?\d+(\.\d+)?/g).map(Number);
const xs = all.filter((_, i) => i % 2 === 0), ys = all.filter((_, i) => i % 2 === 1);
const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
if (box.x0 < 0 || box.y0 < 0 || box.x1 > VIEW.w || box.y1 > VIEW.h) {
  throw new Error(`outline escapes the viewBox: ${JSON.stringify(box)} vs ${VIEW.w}×${VIEW.h}`);
}

const module = `/* The coastline, as SVG path data in the coordinates lib/iceland.js projects
   into. Generated — do not edit by hand:

     node bin/build-coastline.mjs --write

   Natural Earth 1:10m admin-0 countries (public domain), Douglas–Peucker
   simplified at ${TOLERANCE} units: ${before} points in, ${after} out.
   Bounds ${box.x0}–${box.x1} × ${box.y0}–${box.y1} inside a ${VIEW.w}×${VIEW.h} viewBox with a
   ${MARGIN}-unit margin, so a marker on the coast is never clipped.

   ${landmasses.length} subpaths, largest first — the mainland, then the islands, each
   given as its centre and its height on the ground:

${landmasses.map((l) => `     ${String(l.after).padStart(4)} pts  ${l.lat.toFixed(2)}°N ${Math.abs(l.lon).toFixed(2)}°W  ${l.km.toFixed(0)} km`).join('\n')} */

export const COASTLINE = \`
${parts.map((d) => wrap(d).join('\n')).join('\n')}
\`;
`;

if (!WRITE) {
  process.stdout.write(module);
} else {
  await fs.writeFile(path.join(ROOT, 'lib', 'coastline.js'), module);
  console.log(`wrote lib/coastline.js — ${before} points in, ${after} out at tolerance ${TOLERANCE}`);
}
