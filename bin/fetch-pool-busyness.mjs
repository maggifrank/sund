#!/usr/bin/env node
/* How busy Reykjavík's pools are, hour by hour, from the city's own turnstiles —
 * written into lib/poolbusy.js for the pool pages.
 *
 * Google's "Popular times" was the obvious source and is not an available one:
 * there is no API for it, and the only ways to it are scraping Google Maps or
 * paying someone who does. Reykjavík publishes something better for its own
 * pools, as open data: every visitor through the entrance gates, counted per
 * hour, per pool. Real people rather than a curve relative to the pool's own
 * peak. It covers the city's eight pools and no others — Kópavogur, Hafnarfjörður
 * and the rest of the country publish nothing like it.
 *
 * What goes into the file is a typical week rather than the raw counts: for
 * each pool, season and weekday, the average number of people coming in during
 * each hour the pool is open. A count is arrivals, not how many are in the water
 * at once; the page says so.
 *
 * Three decisions shape those averages:
 *
 *   The last two years of data, and nothing from before March 2022. Iceland's
 *   pools ran at capped capacity through the pandemic, lifted in full on
 *   25 February 2022, and averaging those months in would make every pool look
 *   quieter than it is.
 *
 *   Days a pool was shut, or nearly, are left out — anything under a fifth of
 *   that pool's median day. The data has a pool counting one visitor on a day it
 *   was closed for maintenance, and a closed Tuesday averaged in drags down the
 *   Tuesday.
 *
 *   The seasons are the dataset's own: winter December to February, spring,
 *   summer June to August, autumn. Summer afternoons and school-term afternoons
 *   are different pools.
 *
 * The dataset is found through the portal's CKAN API rather than a pinned
 * download link, so a re-upload under a new resource id is still found.
 *
 * Usage:
 *   node bin/fetch-pool-busyness.mjs                    # print what it finds
 *   node bin/fetch-pool-busyness.mjs --write            # write lib/poolbusy.js
 *   node bin/fetch-pool-busyness.mjs --source FILE.csv  # a copy already downloaded
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILT_IN } from '../lib/pools.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'lib', 'poolbusy.js');
const UA = 'sund-pool-busyness/1.0 (+https://sund.talva.is)';
const DATASET = 'https://gagnagatt.reykjavik.is/dataset/sundlaugagestir_i_reykjavik';
const PACKAGE = 'https://gagnagatt.reykjavik.is/api/3/action/package_show?id=sundlaugagestir_i_reykjavik';

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const SOURCE = argv.includes('--source') ? argv[argv.indexOf('--source') + 1] : null;

const RESTRICTIONS_LIFTED = '2022-03-01';
const CLOSED_SHARE = 0.2;
const SEASONS = { Vetur: 'winter', Vor: 'spring', Sumar: 'summer', Haust: 'autumn' };

/* ---------- the data ---------- */

async function download() {
  const meta = await fetch(PACKAGE, { headers: { 'User-Agent': UA } }).then((r) => r.json());
  /* The whole history is one resource, "… Heild"; the rest are the same rows a
     year at a time. */
  const whole = meta.result.resources.find((r) => /heild/i.test(r.name));
  if (!whole) throw new Error('the dataset has no whole-history resource any more');
  const res = await fetch(whole.url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${whole.url} -> HTTP ${res.status}`);
  return { csv: await res.text(), updated: (whole.last_modified || whole.created || '').slice(0, 10) };
}

/* Quoted names, unquoted numbers, no commas inside a field: the file is simple
   enough that a quote-aware split is the whole parser. */
const fields = (line) => [...line.matchAll(/"([^"]*)"|([^,]+)|(?<=,)(?=,|$)/g)].map((m) => m[1] ?? m[2] ?? '');

const { csv, updated } = SOURCE
  ? { csv: await fs.readFile(SOURCE, 'utf8'), updated: null }
  : await download();

const [header, ...lines] = csv.trim().split(/\r?\n/);
const col = Object.fromEntries(fields(header).map((name, i) => [name, i]));
for (const need of ['dagsetning', 'timi_dags', 'sundlaug', 'fjoldi_gesta', 'arstid']) {
  if (!(need in col)) throw new Error(`the CSV has no "${need}" column — its shape has changed`);
}

const idOf = new Map(BUILT_IN.map((p) => [p.name, p.id]));
const problems = [];

/* pool id -> date -> { season, hours: Map(hour -> count), total } */
const byPool = new Map();
let last = '';
for (const line of lines) {
  const f = fields(line);
  const date = f[col.dagsetning];
  const hour = Number(f[col.timi_dags]);
  const count = Number(f[col.fjoldi_gesta]);
  const name = f[col.sundlaug];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(hour) || !Number.isFinite(count)) continue;
  const id = idOf.get(name);
  if (!id) {
    if (!problems.some((p) => p.startsWith(name))) problems.push(`${name} — not in lib/pools.js under that name`);
    continue;
  }
  if (date > last) last = date;
  const days = byPool.get(id) ?? byPool.set(id, new Map()).get(id);
  const day = days.get(date) ?? days.set(date, { season: SEASONS[f[col.arstid]], hours: new Map(), total: 0 }).get(date);
  day.hours.set(hour, (day.hours.get(hour) ?? 0) + count);
  day.total += count;
}

/* Two years back from the last day in the file, and not into the pandemic. */
const lastDate = new Date(`${last}T00:00:00Z`);
const twoYears = new Date(Date.UTC(lastDate.getUTCFullYear() - 2, lastDate.getUTCMonth(), lastDate.getUTCDate() + 1));
const from = [twoYears.toISOString().slice(0, 10), RESTRICTIONS_LIFTED].sort().at(-1);

/* ---------- the typical week ---------- */

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
};

const out = {};
for (const [id, days] of byPool) {
  const inWindow = [...days].filter(([date]) => date >= from && date <= last);
  const floor = median(inWindow.map(([, d]) => d.total)) * CLOSED_SHARE;
  const open = inWindow.filter(([, d]) => d.total >= floor);

  /* season -> weekday -> { days, sums: Map(hour -> total) } */
  const cells = {};
  for (const [date, day] of open) {
    if (!day.season) continue;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const cell = ((cells[day.season] ??= {})[weekday] ??= { days: 0, sums: new Map() });
    cell.days++;
    for (const [hour, n] of day.hours) cell.sums.set(hour, (cell.sums.get(hour) ?? 0) + n);
  }

  /* The hours the pool is open: the first and last hour that, across every day
     in the window, averages at least a twentieth of its busiest hour. Asked of
     the whole window rather than of any one weekday, because a late event on a
     few Fridays — Laugardalslaug has some at 23:00 — or a couple of early gate
     counts at 05:00 would otherwise stretch every chart the pool has. */
  const overall = new Map();
  for (const [, day] of open) {
    for (const [hour, n] of day.hours) overall.set(hour, (overall.get(hour) ?? 0) + n / open.length);
  }
  const peak = Math.max(...overall.values());
  const served = [...overall].filter(([, mean]) => mean >= Math.max(0.2, peak * 0.05)).map(([hour]) => hour);
  const start = Math.min(...served);
  const end = Math.max(...served);

  const seasons = {};
  for (const [season, week] of Object.entries(cells)) {
    seasons[season] = Array.from({ length: 7 }, (_, weekday) => {
      const cell = week[weekday];
      return Array.from({ length: end - start + 1 }, (_, i) =>
        (cell ? Math.round((cell.sums.get(start + i) ?? 0) / cell.days) : 0));
    });
  }
  out[id] = { start, days: open.length, left: inWindow.length - open.length, seasons };
}

/* ---------- report ---------- */

const HOURS = (start, i) => `${String(start + i).padStart(2, '0')}–${String(start + i + 1).padStart(2, '0')}`;
const DAY = ['sun', 'mán', 'þri', 'mið', 'fim', 'fös', 'lau'];
console.log(`data to ${last}, averaged from ${from}${updated ? `, dataset updated ${updated}` : ''}\n`);
for (const [id, pool] of Object.entries(out)) {
  console.log(`${id}: ${pool.days} days open, ${pool.left} left out as closed; hours ${pool.start}–${pool.start + pool.seasons.winter[1].length}`);
  for (const [season, week] of Object.entries(pool.seasons)) {
    const busiest = week.flatMap((hours, d) => hours.map((n, i) => ({ n, d, i }))).sort((a, b) => b.n - a.n)[0];
    console.log(`  ${season.padEnd(7)} busiest ${DAY[busiest.d]} ${HOURS(pool.start, busiest.i)} with ${busiest.n}; mán ${week[1].join(' ')}`);
  }
}
for (const line of problems) console.log(`\n  ! ${line}`);

if (!WRITE) {
  console.log('\nnothing written; pass --write to put these into lib/poolbusy.js');
  process.exit(problems.length ? 1 : 0);
}

const header_ = `/* GENERATED by bin/fetch-pool-busyness.mjs from Reykjavík's open data on pool
 * visitors — do not edit by hand. Run it and diff it.
 *
 * For each of the city's pools, a typical week per season: the average number
 * of people coming in through the gates during each hour, by weekday (getDay()
 * order, Sunday first), starting at the hour \`start\`. Averaged over the days
 * the pool was open between \`from\` and \`to\`. See the script for why those
 * dates and which days are left out.
 *
 * Source: Reykjavíkurborg, "Sundlaugagestir í Reykjavík", ${DATASET}
 */

`;
const source = { name: 'Reykjavíkurborg', url: DATASET, from, to: last };
const body = Object.entries(out).map(([id, pool]) => {
  const seasons = Object.entries(pool.seasons).map(([season, week]) =>
    `      ${season}: [\n${week.map((hours) => `        [${hours.join(', ')}]`).join(',\n')}\n      ]`).join(',\n');
  return `  '${id}': {\n    start: ${pool.start},\n    seasons: {\n${seasons}\n    }\n  }`;
}).join(',\n');

await fs.writeFile(OUT, `${header_}export const BUSY_SOURCE = ${JSON.stringify(source)};\n\nexport const POOL_BUSY = {\n${body}\n};\n`);
console.log(`\nwrote ${Object.keys(out).length} pools into lib/poolbusy.js`);
