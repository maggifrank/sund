#!/usr/bin/env node
/* Regenerate the coastlines in lib/coastline.js.
 *
 * The outlines are committed rather than fetched at runtime — the app has no
 * build step and no dependencies, and a map that needed the network to draw the
 * country would be useless in the one place this app is actually opened, which
 * is a changing room with one bar of signal. This script exists so the committed
 * paths can be re-derived rather than trusted: run it, diff it.
 *
 * Source: IS 50V strandlína (coastline polygons), the national 1:50,000 dataset,
 * published by Náttúrufræðistofnun under CC BY 4.0 and served from its GeoServer
 * as GeoJSON. Positional accuracy is 10 m. It replaced Natural Earth 1:10m,
 * which is drawn to about a kilometre: fine for the shape of the country, and
 * wrong by enough to put a quarter of the pools in the sea — Höfn and Borgarnes
 * a kilometre and a half offshore, because the peninsulas those towns stand on
 * were simply not in it.
 *
 * Two outlines are cut, because one cannot serve both scales. Zoomed into the
 * capital area the map is thirteen times closer or more, so a coastline
 * simplified for the whole country is visibly wrong there, and one detailed
 * enough for the capital everywhere would be a megabyte of fjords nobody can see
 * at country scale. So the capital area gets an outline of its own, which the
 * map switches to inside that area, and each is simplified to the same
 * tolerance *at its own scale* — as detailed as the eye can use and no more.
 *
 * Projection and page geometry both come from lib/iceland.js: the country
 * through project(), the capital through frame(CAPITAL) on top of it. Those are
 * the functions the page draws with, so the outline and the pools on it cannot
 * drift apart.
 *
 * Usage:
 *   node bin/build-coastline.mjs [--source FILE|URL] [--write]
 *
 * Without --write it prints the audit and the module size and writes nothing.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { project, VIEW, MARGIN, SCALE, CAPITAL, frame } from '../lib/iceland.js';
import { BUILT_IN } from '../lib/pools.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WFS = 'https://gis.lmi.is/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature' +
            '&typeNames=IS_50V:strandlina_flakar&outputFormat=application/json&srsName=EPSG:4326';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const SOURCE = arg('--source', WFS);
const WRITE = process.argv.includes('--write');

/* How much detail each outline keeps, in the units it is cut in. The tolerance
   is the same on both — 0.4 of a unit, under half a pixel at the scale each is
   for — so neither shows a corner the other would have smoothed away.

   The area floors are what keep 6,244 polygons from turning into a megabyte of
   specks. For the country 2 units² is a skerry about 800 m across, which is
   already under a pixel; for the capital area 4 units² is about 80 m across, the
   smallest islet that still shows as a dot. Any island with a pool on it is kept
   whatever its size — Grímsey is a speck at country scale and it is also a pool. */
const TOLERANCE = 0.4;
const MIN_AREA = { country: 2, capital: 4 };
/* How much coast is held at full detail around a pool that simplification has
   put in the sea. It happens where a chord gets cut straight across a narrow
   spit — Flateyri came out 43 m offshore, on land the source has it standing
   on. Three tolerances is enough to put it right: past that radius the
   simplified coast strays at most one tolerance from the real one, so it never
   comes within two of the pool, and inside it the coast is the real one.

   Only the pools that came out wrong get it: four, for 107 points. Holding every
   pool's neighbourhood at full detail instead doubles the country outline — it
   keeps every harbour wall in Iceland to fix four pools. */
const PIN = 3 * TOLERANCE;
/* Decimal places written out. Rounding happens before anything is checked, so
   every pool test below runs against the coordinates that end up in the file —
   testing the unrounded ring once let three shore pools pass here and land in
   the sea on the page. */
const DECIMALS = { country: 1, capital: 1 };
/* The capital outline is cut a little wider than its window, so the edges the
   clip leaves along the cut sit off the page, stroke and all. */
const CUT_MARGIN = 20;

/* ---------- geometry ---------- */

function area(points) {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j].x * points[i].y - points[i].x * points[j].y;
  }
  return Math.abs(sum / 2);
}

function bounds(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/* Even–odd ray cast. Rings here have no holes (the dataset keeps lakes in a
   layer of its own) so a point inside any ring is on land. */
function inside(pt, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

function distanceToEdge(pt, ring) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy)));
  }
  return best;
}

/* Douglas–Peucker on a closed ring. The ring is closed on its first point for the
   run and opened again afterwards; with both ends the same point, the first
   split lands on whatever is furthest from it, which divides the ring in two
   instead of measuring against a segment of zero length. An explicit stack
   rather than recursion — the mainland is 160,000 points and would blow it.

   `pinned` are indices that must survive. They split the ring into spans before
   the run starts, so each span is simplified between two points that stay, and
   nothing can smooth a pinned corner away from either side. */
function simplifyRing(ring, tolerance, pinned = []) {
  const points = [...ring, ring[0]];
  const keep = new Uint8Array(points.length);
  const anchors = [...new Set([0, ...pinned, points.length - 1])].sort((a, b) => a - b);
  for (const i of anchors) keep[i] = 1;
  const stack = [];
  for (let k = 1; k < anchors.length; k++) stack.push([anchors[k - 1], anchors[k]]);
  while (stack.length) {
    const [lo, hi] = stack.pop();
    const a = points[lo], b = points[hi];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    let worst = -1, worstAt = -1;
    for (let i = lo + 1; i < hi; i++) {
      const p = points[i];
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
  return points.filter((_, i) => keep[i]).slice(0, -1);
}

/* To `decimals` places, dropping any point rounding has landed on top of the one
   before it — a zero-length segment draws nothing and costs bytes. */
function roundRing(ring, decimals) {
  const out = [];
  for (const p of ring) {
    const q = { x: Number(p.x.toFixed(decimals)), y: Number(p.y.toFixed(decimals)) };
    const last = out.at(-1);
    if (!last || last.x !== q.x || last.y !== q.y) out.push(q);
  }
  if (out.length > 1 && out[0].x === out.at(-1).x && out[0].y === out.at(-1).y) out.pop();
  return out;
}

/* Sutherland–Hodgman against a rectangle. A concave ring that leaves the
   rectangle and comes back in is joined along the rectangle's edge by a sliver
   of zero width, which fills as nothing — and CUT_MARGIN puts that edge, and
   any stroke along it, off the page. */
function clipToRect(ring, { x0, y0, x1, y1 }) {
  const edges = [
    [(p) => p.x >= x0, (a, b) => ({ x: x0, y: a.y + ((b.y - a.y) * (x0 - a.x)) / (b.x - a.x) })],
    [(p) => p.x <= x1, (a, b) => ({ x: x1, y: a.y + ((b.y - a.y) * (x1 - a.x)) / (b.x - a.x) })],
    [(p) => p.y >= y0, (a, b) => ({ x: a.x + ((b.x - a.x) * (y0 - a.y)) / (b.y - a.y), y: y0 })],
    [(p) => p.y <= y1, (a, b) => ({ x: a.x + ((b.x - a.x) * (y1 - a.y)) / (b.y - a.y), y: y1 })]
  ];
  let out = ring;
  for (const [isIn, cross] of edges) {
    if (!out.length) break;
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      if (isIn(cur)) {
        if (!isIn(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (isIn(prev)) {
        out.push(cross(prev, cur));
      }
    }
  }
  return out;
}

/* One closed subpath, absolute moveto and linetos. The points arrive already
   rounded — see roundRing() — so this prints exactly what was checked. */
function subpath(points) {
  const [first, ...rest] = points;
  return `M${first.x} ${first.y}` + rest.map((p) => `L${p.x} ${p.y}`).join('') + 'Z';
}

/* 76 columns of path data, so a regenerated outline diffs line by line instead
   of as one changed line hundreds of thousands of characters long. */
function wrap(d, width = 76) {
  const out = [];
  let line = '';
  for (const cmd of d.match(/[MLZ][^MLZ]*/g)) {
    if (line && line.length + cmd.length > width) { out.push(line); line = ''; }
    line += cmd;
  }
  if (line) out.push(line);
  return out.join('\n');
}

/* ---------- source ---------- */

const raw = /^https?:/.test(SOURCE)
  ? await (await fetch(SOURCE, {
      headers: { 'User-Agent': 'sund-coastline-builder (+https://github.com/maggifrank/sund)' },
      signal: AbortSignal.timeout(300000)
    })).json()
  : JSON.parse(await fs.readFile(SOURCE, 'utf8'));

if (!raw.features?.length) throw new Error('no features in the source');
const edition = raw.features[0].properties?.gagnasafn ?? 'IS 50V';

/* Outer rings only, projected into country units. A hole would be a surprise in
   this layer — lakes are a dataset of their own — so it is said out loud rather
   than silently filled in as land. */
let sourcePoints = 0, holes = 0;
const rings = [];
for (const feature of raw.features) {
  const g = feature.geometry;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const polygon of polygons) {
    holes += polygon.length - 1;
    const ring = polygon[0].map(([lon, lat]) => project(lat, lon));
    if (ring.length > 1 && ring[0].x === ring.at(-1).x && ring[0].y === ring.at(-1).y) ring.pop();
    if (ring.length < 3) continue;
    sourcePoints += ring.length;
    rings.push(ring);
  }
}
if (holes) console.warn(`warning: ${holes} hole(s) in the source — only outer rings are drawn`);

const pools = BUILT_IN
  .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
  .map((p) => ({ name: p.name, at: project(p.lat, p.lon) }));

/* ---------- the two cuts ---------- */

/* `toPage` takes a ring in country units to the map's own page units; `cut` is
   the rectangle to keep, or null for all of it. */
function outline(name, toPage, cut) {
  const onPage = pools.map((p) => ({ ...p, at: toPage(p.at) }));
  const out = [];
  for (const ring of rings) {
    let pts = ring.map(toPage);
    if (cut) {
      const b = bounds(pts);
      if (b.x1 < cut.x0 || b.x0 > cut.x1 || b.y1 < cut.y0 || b.y0 > cut.y1) continue;
      pts = clipToRect(pts, cut);
      if (pts.length < 3) continue;
    }
    const b = bounds(pts);
    const onRing = onPage.filter((p) =>
      p.at.x >= b.x0 && p.at.x <= b.x1 && p.at.y >= b.y0 && p.at.y <= b.y1 && inside(p.at, pts));
    if (area(pts) < MIN_AREA[name] && !onRing.length) continue;

    /* Simplify, then check every pool this ring holds is still on it. Any that
       has been smoothed into the sea gets its neighbourhood pinned and the ring
       is simplified again. By the argument above one pass puts it right; the
       loop stops anyway if a pass makes no progress, rather than trusting that. */
    const pinned = new Set();
    const draw = (pins) => roundRing(simplifyRing(pts, TOLERANCE, pins), DECIMALS[name]);
    let simple = draw([]);
    let wet = onRing.filter((p) => !inside(p.at, simple));
    while (wet.length) {
      for (const p of wet) {
        pts.forEach((v, i) => { if (Math.hypot(v.x - p.at.x, v.y - p.at.y) <= PIN) pinned.add(i); });
      }
      simple = draw([...pinned]);
      const still = onRing.filter((p) => !inside(p.at, simple));
      if (still.length >= wet.length) break;
      wet = still;
    }
    if (simple.length >= 3) out.push({ full: pts, simple, area: area(pts), pinnedFor: pinned.size });
  }
  out.sort((a, b) => b.area - a.area);
  return { rings: out, pools: onPage };
}

const country = outline('country', (p) => p, null);

const f = frame(CAPITAL);
const capital = outline(
  'capital',
  (p) => ({ x: p.x * f.z + f.tx, y: p.y * f.z + f.ty }),
  { x0: -CUT_MARGIN, y0: -CUT_MARGIN, x1: f.w + CUT_MARGIN, y1: f.h + CUT_MARGIN }
);

/* ---------- checks ---------- */

/* The country outline has to sit inside the page, margin included, or a marker on
   the coast gets clipped by the frame. Surtsey and Kolbeinsey are both further
   out than any pool and small enough to fall under the area floor; if either
   ever makes it through, this is where it says so. */
const cb = bounds(country.rings.flatMap((r) => r.simple));
if (cb.x0 < 0 || cb.y0 < 0 || cb.x1 > VIEW.w || cb.y1 > VIEW.h) {
  throw new Error(`country outline escapes the ${VIEW.w}×${VIEW.h} page: ${JSON.stringify(cb)}`);
}

/* Every pool against what is actually drawn — the simplified rings — and, for
   the ones that come out wet, against the full-detail source as well. That
   separates the two different reasons a pool can be in the sea: the outline
   having been smoothed across it, which is this script's fault, and the pool's
   own position sitting just past the waterline, which for a beach pool or a
   lagoon on the shore is simply where it is. Distances are metres on the ground. */
function audit(cut, inWindow) {
  const unitsToM = (u) => u / (SCALE * (cut === capital ? f.z : 1));
  const wet = [];
  for (const p of cut.pools) {
    if (!inWindow(p.at)) continue;
    if (cut.rings.some((r) => inside(p.at, r.simple))) continue;
    const nearest = Math.min(...cut.rings.map((r) => distanceToEdge(p.at, r.simple)));
    const inSource = cut.rings.some((r) => inside(p.at, r.full));
    wet.push({ name: p.name, m: Math.round(unitsToM(nearest)), inSource });
  }
  return wet.sort((a, b) => b.m - a.m);
}

const wetCountry = audit(country, () => true);
const wetCapital = audit(capital, (p) => p.x >= 0 && p.y >= 0 && p.x <= f.w && p.y <= f.h);
const capitalPools = capital.pools.filter((p) => p.at.x >= 0 && p.at.y >= 0 && p.at.x <= f.w && p.at.y <= f.h).length;

const describe = (wet) => wet.length
  ? wet.map((w) => `     ${w.name} — ${w.m} m ${w.inSource ? '(on land in the source: lost in the drawing)' : '(offshore in the source too)'}`).join('\n')
  : '     none';

const points = (cut) => cut.rings.reduce((n, r) => n + r.simple.length, 0);

console.log(`source: ${edition} — ${raw.features.length} features, ${sourcePoints} points`);
console.log(`country: ${country.rings.length} rings, ${points(country)} points; in the sea: ${wetCountry.length} of ${pools.length}`);
if (wetCountry.length) console.log(describe(wetCountry));
console.log(`capital: ${capital.rings.length} rings, ${points(capital)} points; in the sea: ${wetCapital.length} of ${capitalPools}`);
if (wetCapital.length) console.log(describe(wetCapital));

/* ---------- module ---------- */

const module = `/* The coastlines, as SVG path data. Generated — do not edit by hand:

     node bin/build-coastline.mjs --write

   ${edition}, strandlína flákar: the national coastline
   polygons at 1:50,000, positional accuracy 10 m. Published by
   Náttúrufræðistofnun under CC BY 4.0; the map page carries the attribution.
   ${raw.features.length} polygons and ${sourcePoints} points in.

   Two outlines, each in the units it is cut in and simplified to ${TOLERANCE}
   of a unit at that scale — the whole country, and the capital area, which the
   map draws in place of the country's outline once zoomed in there. See
   bin/build-coastline.mjs for why one outline cannot serve both.

   COASTLINE          the country, lib/iceland.js project()
                      ${country.rings.length} rings, ${points(country)} points, islands under ${MIN_AREA.country} units² dropped
                      pools in the sea: ${wetCountry.length} of ${pools.length}
${describe(wetCountry)}

   COASTLINE_CAPITAL  the capital area, frame(CAPITAL) on top of project(),
                      cut ${CUT_MARGIN} units wider than its window
                      ${capital.rings.length} rings, ${points(capital)} points, islets under ${MIN_AREA.capital} units² dropped
                      pools in the sea: ${wetCapital.length} of ${capitalPools}
${describe(wetCapital)}

   A pool "offshore in the source too" is not a drawing error: its position is
   a few metres past the waterline in the national data itself, which for a
   beach or a lagoon built on the shore is where it actually is. */

export const COASTLINE = \`
${wrap(country.rings.map((r) => subpath(r.simple)).join(''))}
\`;

export const COASTLINE_CAPITAL = \`
${wrap(capital.rings.map((r) => subpath(r.simple)).join(''))}
\`;
`;

console.log(`module: ${(module.length / 1024).toFixed(0)} KB`);
if (WRITE) {
  await fs.writeFile(path.join(ROOT, 'lib', 'coastline.js'), module);
  console.log('wrote lib/coastline.js');
}
