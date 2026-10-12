#!/usr/bin/env node
/* Say what changed between two copies of lib/poolinfo.js, in words a person can
 * review: which pools the directory added or dropped, and for each pool that
 * changed, which details did and how. Written as Markdown, for the body of the
 * pull request the nightly crawl opens (.github/workflows/crawl-sundlaugar.yml).
 *
 * `fetched` is left out of the comparison. It is the day a pool was read, so a
 * crawl moves it for every pool every night, and a night in which that is all
 * that moved is a night with nothing to review.
 *
 * The pools lib/newpools.js gained go at the top, given the two copies of it
 * with --new: a name the directory lists that lib/pools.js does not have is
 * how a new pool shows up, and /admin/ offers it to add once this is merged.
 * Then the problems bin/fetch-pool-info.mjs --report wrote.
 *
 * Exits 0 whatever it finds. What it found is on the last line of stderr and,
 * under GitHub Actions, in the step's `changed` output: true when there is
 * something for a person to look at.
 *
 * Usage:
 *   node bin/diff-pool-info.mjs <old poolinfo.js> <new poolinfo.js> [--report run.json]
 *     [--new <old newpools.js> <new newpools.js>] > body.md
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const REPORT = argv.includes('--report') ? argv[argv.indexOf('--report') + 1] : null;
const NEW_PAIR = argv.includes('--new') ? argv.slice(argv.indexOf('--new') + 1, argv.indexOf('--new') + 3) : null;
const [OLD, NEW] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--report'
  && argv[i - 1] !== '--new' && argv[i - 2] !== '--new');
if (!OLD || !NEW || (NEW_PAIR && NEW_PAIR.length < 2)) {
  console.error('usage: diff-pool-info.mjs <old poolinfo.js> <new poolinfo.js> [--report run.json] [--new <old newpools.js> <new newpools.js>]');
  process.exit(2);
}

const load = async (file) => (await import(pathToFileURL(path.resolve(file)).href)).POOL_INFO;
const before = new Map((await load(OLD)).map((p) => [p.id, p]));
const after = new Map((await load(NEW)).map((p) => [p.id, p]));
/* A missing copy of lib/newpools.js is an empty one: the first crawl after it
   was added has nothing to compare against. */
const loadNew = async (file) => {
  try { return (await import(pathToFileURL(path.resolve(file)).href)).NEW_POOLS; } catch { return []; }
};
const newBefore = new Map((NEW_PAIR ? await loadNew(NEW_PAIR[0]) : []).map((p) => [p.id, p]));
const newAfter = NEW_PAIR ? await loadNew(NEW_PAIR[1]) : [];
const report = REPORT ? JSON.parse(await fs.readFile(REPORT, 'utf8')) : { problems: [] };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const show = (v) => (v === null || v === undefined || v === '' ? '—' : `\`${String(v).replace(/`/g, "'")}\``);

/* Hours and prices as lines, so that a change reads as the lines that went and
   the lines that came rather than as two blobs of JSON. */
const hourLines = (hours = []) => hours.flatMap((b) => {
  const head = [b.title ?? `(${b.kind})`, b.season ? `${b.season.from}→${b.season.to ?? '…'}` : null].filter(Boolean).join(' ');
  return [
    ...b.rows.map((r) => `${head} · ${r.label ?? ''}: ${r.closed ? 'lokað' : r.times.join(', ')}${r.extra ? ` ${r.extra}` : ''}`),
    ...b.notes.map((n) => `${head} · ${n.text}`)
  ];
});
const priceLines = (prices) => (prices?.sections ?? []).flatMap((s) =>
  s.rows.map((r) => [r[0], ...r.slice(1).map((v, i) => (v && s.head[i] ? `${s.head[i]} ${v}` : v)).filter(Boolean)].join(' | ')));

function lineDiff(a, b) {
  const gone = a.filter((l) => !b.includes(l));
  const came = b.filter((l) => !a.includes(l));
  const out = [...gone.map((l) => `- ${l}`), ...came.map((l) => `+ ${l}`)];
  /* A pool that rewrote its whole timetable is a pool to open, not a diff to
     read here in full. */
  return out.length > 24 ? [...out.slice(0, 24), `… and ${out.length - 24} more lines`] : out;
}

const SCALARS = ['name', 'region', 'kind', 'source', 'address', 'phone', 'email', 'web', 'facebook', 'instagram', 'longest'];

function changes(a, b) {
  const out = [];
  for (const key of SCALARS) {
    if (!same(a[key], b[key])) out.push(`- **${key}**: ${show(a[key])} → ${show(b[key])}`);
  }
  const lost = a.facilities.filter((f) => !b.facilities.includes(f));
  const got = b.facilities.filter((f) => !a.facilities.includes(f));
  if (lost.length || got.length) {
    out.push(`- **facilities**: ${[...got.map((f) => `+${f}`), ...lost.map((f) => `−${f}`)].join(', ')}`);
  }
  const block = (label, lines) => {
    if (lines.length) out.push(`- **${label}**:`, '  ```diff', ...lines.map((l) => `  ${l}`), '  ```');
  };
  if (!same(a.hours, b.hours)) {
    const lines = lineDiff(hourLines(a.hours), hourLines(b.hours));
    /* Same lines in another order, or a season's dates worked out differently
       with nothing written differently: still a change, just not one a line
       diff can show. */
    if (lines.length) block('hours', lines);
    else out.push('- **hours**: rearranged, same lines');
  }
  if (!same(a.prices, b.prices) || !same(a.priceNotes, b.priceNotes)) {
    const lines = [
      ...(a.prices?.year !== b.prices?.year ? [`- year ${a.prices?.year ?? '—'}`, `+ year ${b.prices?.year ?? '—'}`] : []),
      ...lineDiff(priceLines(a.prices), priceLines(b.prices)),
      ...lineDiff(a.priceNotes ?? [], b.priceNotes ?? [])
    ];
    if (lines.length) block('prices', lines);
    else out.push('- **prices**: rearranged, same lines');
  }
  return out;
}

const strip = ({ fetched, delisted, ...rest }) => rest;
const added = [...after.values()].filter((p) => !before.has(p.id));
/* A pool the directory stopped listing keeps its last details, marked
   `delisted` (see bin/fetch-pool-info.mjs); it is reported the night that
   happens. One that is gone from the file altogether was taken out of
   lib/pools.js. */
const delisted = [...after.values()].filter((p) => p.delisted && !before.get(p.id)?.delisted && before.has(p.id));
const relisted = [...after.values()].filter((p) => !p.delisted && before.get(p.id)?.delisted);
const dropped = [...before.values()].filter((p) => !after.has(p.id));
const changed = [...after.values()]
  .filter((p) => before.has(p.id) && !same(strip(before.get(p.id)), strip(p)))
  .map((p) => ({ pool: p, lines: changes(before.get(p.id), p) }));

const md = [];
const link = (p) => `[${p.name}](${p.source})`;

const found = newAfter.filter((p) => !newBefore.has(p.id));
const foundChanged = newAfter.filter((p) => newBefore.has(p.id) && !same(strip(newBefore.get(p.id)), strip(p)));
const foundGone = [...newBefore.values()].filter((p) => !newAfter.some((q) => q.id === p.id));
if (found.length) {
  md.push('### New on the directory', '',
    'Not in `lib/pools.js`. Once this is merged, /admin/ offers each one to add, with its details. If one is a pool the app already has under another name, add an `ALIAS` in `bin/fetch-pool-info.mjs` instead.', '',
    ...found.map((p) => `- ${link(p)} (${p.region})${p.address ? `, ${p.address}` : ''}`), '');
}
if (foundChanged.length) {
  md.push('### New pools whose details changed', '',
    'Merged, /admin/ offers to update the details of the ones already added.', '',
    ...foundChanged.map((p) => `- ${link(p)} (${p.region})`), '');
}
if (foundGone.length) {
  md.push('### No longer new', '',
    'Gone from the directory, or now in `lib/pools.js`.', '',
    ...foundGone.map((p) => `- ${link(p)} (${p.region})`), '');
}
if (report.problems.length) {
  md.push('### Needs a person', '',
    'The crawl could not read these.', '',
    ...report.problems.map((p) => `- ${p}`), '');
}
if (added.length) {
  md.push('### Details for pools that had none', '', ...added.map((p) => `- ${link(p)} (${p.region})`), '');
}
if (delisted.length) {
  md.push('### No longer in the directory', '',
    'sundlaugar.is no longer lists these. The details last read for them are kept in `lib/poolinfo.js`, and their pages say how old they are. Once this is merged, /admin/ asks whether each one has closed.', '',
    ...delisted.map((p) => `- ${link(p)} (${p.region}), last read ${p.fetched}`), '');
}
if (relisted.length) {
  md.push('### Back in the directory', '', ...relisted.map((p) => `- ${link(p)} (${p.region})`), '');
}
if (dropped.length) {
  md.push('### Taken out', '',
    'No longer in `lib/pools.js`, so their details are gone from `lib/poolinfo.js` too.', '',
    ...dropped.map((p) => `- ${link(p)} (${p.region})`), '');
}
if (changed.length) {
  md.push('### Changed', '');
  for (const { pool, lines } of changed.sort((x, y) => x.pool.name.localeCompare(y.pool.name, 'is'))) {
    md.push(`#### ${link(pool)}`, '', ...lines, '');
  }
}

const unchanged = after.size - added.length - changed.length - delisted.length;
const something = Boolean(found.length || foundChanged.length || foundGone.length || report.problems.length || added.length || delisted.length || relisted.length || dropped.length || changed.length);
md.push(`_${after.size} pools: ${changed.length} changed, ${added.length} new, ${delisted.length} no longer listed, ${unchanged} unchanged. ${found.length} new on the directory._`);

/* A pull request's body stops at 65,536 characters. A night in which that many
   changed is one to read the file's own diff anyway. */
let body = md.join('\n') + '\n';
if (body.length > 60000) body = body.slice(0, 60000).replace(/\n[^\n]*$/, '') + '\n\n… cut short; the rest is in the diff of `lib/poolinfo.js`.\n';
process.stdout.write(body);
process.stderr.write(`${something ? 'changed' : 'unchanged'}: ${changed.length} changed, ${added.length} new, ${dropped.length} dropped, ${found.length} new on the directory, ${report.problems.length} problem(s)\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `changed=${something}\n`);
