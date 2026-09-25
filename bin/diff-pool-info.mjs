#!/usr/bin/env node
/* Say what changed between two copies of lib/poolinfo.js, in words a person can
 * review: which pools the directory added or dropped, and for each pool that
 * changed, which details did and how. Written as Markdown, for the body of the
 * pull request the weekly crawl opens (.github/workflows/crawl-sundlaugar.yml).
 *
 * `fetched` is left out of the comparison. It is the day a pool was read, so a
 * crawl moves it for every pool every week, and a week in which that is all
 * that moved is a week with nothing to review.
 *
 * The problems bin/fetch-pool-info.mjs --report wrote go at the top: a name the
 * directory lists that lib/pools.js does not have is how a new pool shows up,
 * and it needs a person — a position, a line in lib/pools.js — before its
 * details can be kept.
 *
 * Exits 0 whatever it finds. What it found is on the last line of stderr and,
 * under GitHub Actions, in the step's `changed` output: true when there is
 * something for a person to look at.
 *
 * Usage:
 *   node bin/diff-pool-info.mjs <old poolinfo.js> <new poolinfo.js> [--report run.json] > body.md
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const REPORT = argv.includes('--report') ? argv[argv.indexOf('--report') + 1] : null;
const [OLD, NEW] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--report');
if (!OLD || !NEW) {
  console.error('usage: diff-pool-info.mjs <old poolinfo.js> <new poolinfo.js> [--report run.json]');
  process.exit(2);
}

const load = async (file) => (await import(pathToFileURL(path.resolve(file)).href)).POOL_INFO;
const before = new Map((await load(OLD)).map((p) => [p.id, p]));
const after = new Map((await load(NEW)).map((p) => [p.id, p]));
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

const strip = ({ fetched, ...rest }) => rest;
const added = [...after.values()].filter((p) => !before.has(p.id));
const dropped = [...before.values()].filter((p) => !after.has(p.id));
const changed = [...after.values()]
  .filter((p) => before.has(p.id) && !same(strip(before.get(p.id)), strip(p)))
  .map((p) => ({ pool: p, lines: changes(before.get(p.id), p) }));

const md = [];
const link = (p) => `[${p.name}](${p.source})`;

if (report.problems.length) {
  md.push('### Needs a person', '',
    'The crawl could not keep these. A name lib/pools.js does not have is usually a new pool: it needs a position and an entry in `lib/pools.js` (see `bin/survey-pools.mjs`), or an `ALIAS` in `bin/fetch-pool-info.mjs` if it is a pool the app already has under another name.', '',
    ...report.problems.map((p) => `- ${p}`), '');
}
if (added.length) {
  md.push('### Details for pools that had none', '', ...added.map((p) => `- ${link(p)} (${p.region})`), '');
}
if (dropped.length) {
  md.push('### No longer in the directory', '',
    'Their details are dropped from `lib/poolinfo.js`. The pools stay in `lib/pools.js`, and their pages say the details are not in; take them out there too if they have closed.', '',
    ...dropped.map((p) => `- ${link(p)} (${p.region})`), '');
}
if (changed.length) {
  md.push('### Changed', '');
  for (const { pool, lines } of changed.sort((x, y) => x.pool.name.localeCompare(y.pool.name, 'is'))) {
    md.push(`#### ${link(pool)}`, '', ...lines, '');
  }
}

const unchanged = after.size - added.length - changed.length;
const something = Boolean(report.problems.length || added.length || dropped.length || changed.length);
md.push(`_${after.size} pools read: ${changed.length} changed, ${added.length} new, ${dropped.length} dropped, ${unchanged} unchanged._`);

/* A pull request's body stops at 65,536 characters. A week in which that many
   changed is a week to read the file's own diff anyway. */
let body = md.join('\n') + '\n';
if (body.length > 60000) body = body.slice(0, 60000).replace(/\n[^\n]*$/, '') + '\n\n… cut short; the rest is in the diff of `lib/poolinfo.js`.\n';
process.stdout.write(body);
process.stderr.write(`${something ? 'changed' : 'unchanged'}: ${changed.length} changed, ${added.length} new, ${dropped.length} dropped, ${report.problems.length} problem(s)\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `changed=${something}\n`);
