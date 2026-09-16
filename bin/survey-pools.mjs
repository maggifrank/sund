#!/usr/bin/env node
/* Find positions for the pools in lib/pools.js that carry a name and nothing
 * else, and write them into the list.
 *
 * The directory at sundlaugar.is publishes no coordinates, which is why the
 * original survey matched its names against OpenStreetMap and left fifty pools
 * unplaced: OSM usually does not *name* a pool — Bolungarvík's is three untagged
 * ways inside a sports complex — and the directory names it after its town, so
 * there was nothing for a name to match.
 *
 * It does publish an address for every one of them, though, which is a far
 * better key than a name. So: read the address off the directory page, geocode
 * it, and then snap to the pool OSM has within 500 m of it. The address says
 * which building, and OSM says where the water is, which is the position worth
 * having — a street address can sit at the far end of a car park, and MATCH_M
 * is only 250 m. Where OSM has nothing, the address stands on its own.
 *
 * Two guards. A hit that lands on a pool already placed is dropped rather than
 * duplicated, and so is one that two entries both want; both cases end as no
 * answer rather than as a wrong one. A wrong position is worse than none, since
 * the app would greet somebody with the name of a pool they are nowhere near.
 *
 * Every hit is printed with its address, how far the water turned out to be
 * from it, and what OSM calls it, so a match can be read rather than trusted.
 * Nothing is written without --write.
 *
 * Every pool in the list has a position now, so a bare run has nothing to do
 * and says so. It earns its keep on --id, which re-looks-up a pool whether it
 * has a position or not, so what is committed can be diffed against what the
 * directory says today; and on the next name the directory adds.
 *
 * Usage:
 *   node bin/survey-pools.mjs                 # print what it finds
 *   node bin/survey-pools.mjs --write         # patch lib/pools.js
 *   node bin/survey-pools.mjs --id hofsos     # one pool, repeatable
 *
 * Overpass is asked four times in all — once per tile of the country — and
 * Nominatim once or twice per pool, a second apart, so a full run is a couple
 * of minutes and leaves neither service worse off.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILT_IN, distanceM, MATCH_M } from '../lib/pools.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'sund-pool-survey/1.0 (+https://sund.talva.is)';
const WRITE = process.argv.includes('--write');
const ONLY = process.argv.reduce((ids, arg, i) => (arg === '--id' ? [...ids, process.argv[i + 1]] : ids), []);

/* How far from an address its pool may be, at the two precisions an address
   comes back at. A house number is a building, and 500 m is generous enough for
   a complex whose entrance is on one street and whose water is behind it. A
   street with no number, or a farm, or a valley, is an answer to a coarser
   question — Sauðárkrókur's address is the road the town is strung along — so
   OSM's water is the better of the two, out to the distance a place is wide. */
const SNAP_M = 500;
const LOCALITY_M = 3000;
const PRECISE = new Set(['building', 'amenity', 'leisure', 'place_house']);

/* The directory's own index, as a list rather than as 107 pages of HTML. */
const DIRECTORY = 'https://sundlaugar.is/wp-json/wp/v2/sundlaugasafn?per_page=100&page=';

/* Addresses the geocoder reads wrong, and why. Kept as small as it can be:
   everything else comes off the directory page as published. */
const HINT = {
  /* "Reykholt, 801 Selfoss" is Reykholt in Biskupstungur. Nominatim ignores the
     postcode and answers with the better-known Reykholt in Borgarfjörður, two
     hours away, where the only pool is Snorralaug — which is already in the
     list, so the guard below would drop it and the pool would go unplaced. */
  'ithrottamidstodin-i-reykholti': 'Reykholt, Bláskógabyggð',
  /* The directory gives these two a region and a dative, not an address:
     "Snæfellsnes" is a whole peninsula, and nothing geocodes "Vestmannaeyjum".
     Both name a place in the nominative instead, and the snap does the rest. */
  'lysulaugar': 'Lýsuhóll',
  'vestmannaeyjar': 'Vestmannaeyjabær',
  /* "Við Innnesveg, Akranesi" is "by" a street, in the dative, and nothing
     geocodes it. The street itself does, and the pool is on it. */
  'jadarsbakkalaug-akranesi': 'Innnesvegur, Akranes'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* These services answer a request they will not serve with an HTML error page
   rather than with a status code, so a response is only trusted once it parses
   as JSON. Overpass is free and shared: when it asks to be left alone, the wait
   doubles rather than retrying briskly. */
async function json(url, opts = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(8000 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
      const text = await res.text();
      if (/^\s*[[{]/.test(text)) return JSON.parse(text);
    } catch { /* and wait */ }
  }
  return null;
}

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

async function overpass(query) {
  for (const endpoint of OVERPASS) {
    const res = await json(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query)
    });
    if (res) return res;
  }
  return null;
}

/* ---------- what the directory says ---------- */

const strip = (s) => s
  .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—').replace(/&#8217;/g, '’')
  .replace(/&#038;/g, '&').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();

async function directory() {
  const entries = [];
  for (const page of [1, 2]) {
    const res = await json(DIRECTORY + page);
    if (!res) throw new Error('sundlaugar.is would not list its pools');
    for (const post of res) entries.push({ title: strip(post.title.rendered), link: post.link });
  }
  return new Map(entries.map((e) => [e.title, e.link]));
}

/* The address sits in the page's post-info widget, above the phone number and
   the opening hours. First item only: the others are the pool's own name for
   itself and its contact details. */
async function addressAt(link) {
  const res = await fetch(link, { headers: { 'User-Agent': UA } });
  const html = await res.text();
  const item = html.match(/elementor-post-info__item--type-custom"?>\s*([^<]+)</);
  return item ? strip(item[1]) : '';
}

/* ---------- where that is ---------- */

async function geocode(address) {
  const parts = address.match(/^(.*?),\s*(\d{3})\s+(.+)$/);
  const tries = parts
    ? [`street=${encodeURIComponent(parts[1])}&postalcode=${parts[2]}&city=${encodeURIComponent(parts[3])}`,
       `street=${encodeURIComponent(parts[1])}&postalcode=${parts[2]}`,
       `q=${encodeURIComponent(address + ', Ísland')}`,
       `postalcode=${parts[2]}`]
    : [`q=${encodeURIComponent(address + ', Ísland')}`];
  for (const params of tries) {
    const hits = await json(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=is&limit=1&${params}`);
    await sleep(1100);
    if (Array.isArray(hits) && hits.length) {
      return {
        lat: Number(hits[0].lat),
        lon: Number(hits[0].lon),
        precise: PRECISE.has(hits[0].addresstype)
      };
    }
  }
  return null;
}

/* Every pool in the country, in four requests, so that the snapping below is
   arithmetic on this machine rather than forty more questions for a free
   service. The tiling is only because the whole country in one query times out
   on a busy day; the tiles are merged before anything is matched against them.
   The tagging is inconsistent — one complex turns up as swimming_pool,
   public_bath, water_park and sport=swimming at once — so ask for the lot. */
const TILES = [
  [63.2, -24.8, 65.0, -19.0],
  [63.2, -19.0, 65.0, -13.2],
  [65.0, -24.8, 67.0, -19.0],
  [65.0, -19.0, 67.0, -13.2]
];

async function everyPool() {
  const all = [];
  for (const [s, w, n, e] of TILES) {
    const res = await overpass(`[out:json][timeout:180];
(nwr["leisure"="swimming_pool"](${s},${w},${n},${e});
 nwr["amenity"="public_bath"](${s},${w},${n},${e});
 nwr["leisure"="water_park"](${s},${w},${n},${e});
 nwr["sport"="swimming"](${s},${w},${n},${e}););
out center tags;`);
    if (!res) throw new Error(`Overpass would not serve the tile ${s},${w} — try again later`);
    for (const el of res.elements || []) {
      const lat = el.center?.lat ?? el.lat;
      const lon = el.center?.lon ?? el.lon;
      if (Number.isFinite(lat) && Number.isFinite(lon)) all.push({ lat, lon, name: el.tags?.name || '' });
    }
    await sleep(2000);
  }
  /* A tile edge cuts through a complex sooner or later and the same way then
     arrives twice. Position is the identity here, not the OSM id. */
  const seen = new Set();
  return all.filter((f) => {
    const key = `${f.lat.toFixed(6)},${f.lon.toFixed(6)}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

/* One position for a complex rather than one per basin: the average of every
   feature within MATCH_M of the nearest one lands inside it, which is what the
   built-in survey holds and what the matching radius is sized for. */
function waterNear(features, point, reach) {
  const nearest = features
    .map((f) => ({ ...f, d: distanceM(point, f) }))
    .sort((a, b) => a.d - b.d)[0];
  if (!nearest || nearest.d > reach) return null;
  const part = features.filter((f) => distanceM(nearest, f) <= MATCH_M);
  return {
    lat: part.reduce((sum, f) => sum + f.lat, 0) / part.length,
    lon: part.reduce((sum, f) => sum + f.lon, 0) / part.length,
    names: [...new Set(part.map((f) => f.name).filter(Boolean))],
    away: Math.round(nearest.d)
  };
}

/* ---------- the run ---------- */

/* Every pool with no position, or exactly the ones named — a named one whether
   it has a position or not, so that what is already in the list can be put back
   through the same lookup and diffed against what comes out. */
const placed = BUILT_IN.filter((p) => typeof p.lat === 'number');
const wanted = ONLY.length
  ? BUILT_IN.filter((p) => ONLY.includes(p.id))
  : BUILT_IN.filter((p) => typeof p.lat !== 'number');

const listed = await directory();
const features = await everyPool();
process.stderr.write(`  ${listed.size} pools listed, ${features.length} pool features in the country\n`);

const found = [];
const skipped = [];

for (const pool of wanted) {
  const link = listed.get(pool.name);
  if (!link) { skipped.push({ pool, why: 'not in the directory — the natural pools are a section of their own' }); continue; }

  const address = HINT[pool.id] ?? await addressAt(link);
  await sleep(250);
  if (!address) { skipped.push({ pool, why: 'no address on its page' }); continue; }

  const at = await geocode(address);
  if (!at) { skipped.push({ pool, why: `nothing geocodes to "${address}"` }); continue; }

  /* The water if OSM has it, the address if not. */
  const water = waterNear(features, at, at.precise ? SNAP_M : LOCALITY_M);
  const spot = water ?? { lat: at.lat, lon: at.lon, names: [], away: 0 };

  /* Itself excepted, or re-checking a pool that is already in the list would
     report it as landing on itself. */
  const taken = placed.find((p) => p.id !== pool.id && distanceM(spot, p) <= MATCH_M);
  if (taken) { skipped.push({ pool, why: `lands on ${taken.name}, which is already placed` }); continue; }

  found.push({ pool, address, ...spot, source: water ? 'osm' : 'address' });
  process.stderr.write(`  ${pool.name} — ${address}\n`);
}

/* Two entries on one complex are one pool under two names, or one of them is
   somewhere else entirely. Either way the pair is not an answer. */
const clash = new Set();
for (const a of found) for (const b of found) if (a !== b && distanceM(a, b) <= MATCH_M) { clash.add(a); clash.add(b); }
for (const row of clash) skipped.push({ pool: row.pool, why: 'two entries, one complex' });
const keep = found.filter((row) => !clash.has(row));

console.log();
for (const row of keep.sort((a, b) => b.away - a.away)) {
  console.log(
    `  ${row.pool.name.padEnd(42)} ${row.lat.toFixed(5)},${row.lon.toFixed(5)}` +
    `  ${row.source === 'address' ? 'the address itself'.padEnd(21) : `water ${String(row.away).padStart(3)} m away`.padEnd(21)}` +
    `  ${(row.names[0] || '').padEnd(34)} ${row.address}`
  );
}
for (const row of skipped) console.log(`  ${row.pool.name.padEnd(42)} — ${row.why}`);
console.log(`\n${keep.length} placed, ${skipped.length} left as names only, of ${wanted.length} asked for`);

if (!WRITE) {
  console.log('\nnothing written; pass --write to put these into lib/pools.js');
} else {
  const file = path.join(ROOT, 'lib', 'pools.js');
  let source = await fs.readFile(file, 'utf8');
  for (const row of keep) {
    const line = new RegExp(`(\\{ id: '${row.pool.id}', name: '[^']*')( \\})`);
    if (!line.test(source)) throw new Error(`cannot find the line for ${row.pool.id}`);
    source = source.replace(line, `$1, lat: ${Number(row.lat.toFixed(5))}, lon: ${Number(row.lon.toFixed(5))}$2`);
  }
  await fs.writeFile(file, source);
  console.log(`\nwrote ${keep.length} positions into lib/pools.js`);
}
