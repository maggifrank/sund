#!/usr/bin/env node
/* Fail if any pool is drawn in the sea.
 *
 * bin/build-coastline.mjs checks this when it cuts the coastline, but the
 * coastline is cut rarely and the pool list changes often — forty-five pools
 * were given positions in a single afternoon — and nothing would notice a new
 * one landing offshore until someone looked at the map. This runs on every pull
 * request that touches either, and on every push to main.
 *
 * It shares no code with the generator on purpose. It reads the path strings
 * exactly as they are written in lib/coastline.js, which is what the page draws,
 * so a mistake in how the generator audits itself cannot hide here too — that
 * mistake has happened once already: the generator once checked the ring before
 * rounding, reported zero, and three hot pools on the shore were in the sea.
 *
 * Usage: node bin/check-pools-on-land.mjs
 */

import { COASTLINE, COASTLINE_CAPITAL } from '../lib/coastline.js';
import { project, frame, CAPITAL, SCALE } from '../lib/iceland.js';
import { BUILT_IN } from '../lib/pools.js';

const rings = (d) => d.trim().split('Z').filter((s) => s.trim()).map((sp) =>
  [...sp.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]));

function inside([x, y], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function offshore([x, y], all) {
  let best = Infinity;
  for (const ring of all) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j], [bx, by] = ring[i];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
      best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
    }
  }
  return best;
}

const maps = [
  { name: 'country', rings: rings(COASTLINE), f: frame(null) },
  /* What the map draws once zoomed into the capital area. */
  { name: 'capital detail', rings: rings(COASTLINE_CAPITAL), f: frame(CAPITAL) }
];

const placed = BUILT_IN.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
const wet = [];
for (const map of maps) {
  const { f } = map;
  let checked = 0;
  for (const p of placed) {
    const q = project(p.lat, p.lon);
    const at = [q.x * f.z + f.tx, q.y * f.z + f.ty];
    if (at[0] < 0 || at[1] < 0 || at[0] > f.w || at[1] > f.h) continue;   // not on this map
    checked++;
    if (map.rings.some((r) => inside(at, r))) continue;
    const metres = Math.round(offshore(at, map.rings) / (SCALE * f.z));
    wet.push({ map: map.name, name: p.name, id: p.id, lat: p.lat, lon: p.lon, metres });
  }
  console.log(`${map.name}: ${checked} pools checked, ${wet.filter((w) => w.map === map.name).length} in the sea`);
}

if (wet.length) {
  console.error('\nPools drawn in the sea:');
  for (const w of wet) {
    console.error(`  [${w.map}] ${w.name} (${w.id}) at ${w.lat}, ${w.lon} — ${w.metres} m offshore`);
  }
  console.error(`
Two possible causes, and each has its own fix:
  - the position is wrong: correct it in lib/pools.js
  - the position is right, and the coast was simplified before this pool existed:
    re-cut it, which holds the coastline at full detail around any pool that
    needs it —  node bin/build-coastline.mjs --write`);
  process.exit(1);
}
