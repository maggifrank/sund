#!/usr/bin/env node
/* Read the pool directory at sundlaugar.is, region by region, and write what
 * it says about each pool into lib/poolinfo.js — the data behind pool.html.
 *
 * What is taken is the part of a page a swimmer acts on: the address, how to
 * reach the pool, what it has, when it is open and what it costs. What is not
 * taken is the directory's own writing about a pool and its photographs. Those
 * are somebody's work rather than facts about a pool, so the page links to
 * them instead of copying them. The facilities are read *out of* that writing
 * — "heitir pottar, kaldur pottur og eimbað" becomes three tags the page can
 * translate — but the sentences themselves go no further than this script.
 *
 * The notes beside the hours and the price table are kept as written. They are
 * short, they are the terms the numbers are sold on ("children start paying the
 * year they turn ten"), and a paraphrase that got one of them wrong would be a
 * price the pool does not charge.
 *
 * Icelandic only. The directory has English pages too, but they are a second
 * copy maintained separately and they drift: Dalslaug's annual pass for over-67s
 * is 4.000 kr on the Icelandic page and 4.150 kr on the English one. One source,
 * and the page translates what it can parse — weekdays, facilities, its own
 * labels — rather than trusting a translation that has already fallen behind.
 *
 * The directory publishes through WordPress, so the list of pools per region is
 * a JSON request rather than a crawl. Each pool page is then one request, a
 * second apart. The page is an Elementor template, the same one for every pool,
 * and it is read widget by widget in the order the template lays them out.
 * There is no HTML parser here — the repo has no dependencies and this is not
 * the thing to change that for — so every pattern below is as narrow as the
 * template allows, and a page that does not look like the template is refused
 * rather than half-read.
 *
 * Nothing is written without --write. Without it, every pool is printed as the
 * page would show it, so a run can be read before it is trusted. Regions that
 * were not asked for are left as they are in lib/poolinfo.js, so the country can
 * be fetched a region at a time.
 *
 * Usage:
 *   node bin/fetch-pool-info.mjs --region hofudborgarsvaedid           # print
 *   node bin/fetch-pool-info.mjs --region hofudborgarsvaedid --write   # patch lib/poolinfo.js
 *   node bin/fetch-pool-info.mjs --all --write                         # every region
 *   node bin/fetch-pool-info.mjs --region reykjanes --cache data/raw   # keep the pages; reuse them next run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUILT_IN } from '../lib/pools.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'lib', 'poolinfo.js');
const UA = 'sund-pool-info/1.0 (+https://sund.talva.is)';
const API = 'https://sundlaugar.is/wp-json/wp/v2';

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const ALL = argv.includes('--all');
const WANTED = argv.reduce((out, a, i) => (a === '--region' ? [...out, argv[i + 1]] : out), []);
const CACHE = argv.includes('--cache') ? path.resolve(argv[argv.indexOf('--cache') + 1]) : null;

if (!ALL && !WANTED.length) {
  console.error('say which regions: --region <slug> (repeatable), or --all');
  process.exit(2);
}

const TODAY = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* The directory calls a pool one thing and lib/pools.js, surveyed a month
   earlier, calls it another. Keyed by the directory's name. Kept as short as
   it can be: a pool that matches by name needs nothing here. */
const ALIAS = {
  'Kópavogslaug': 'sundlaug-kopavogs'
};

/* ---------- fetching ---------- */

async function get(url, { json = false } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(4000 * attempt);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      return json ? await res.json() : await res.text();
    } catch { /* and wait */ }
  }
  throw new Error(`sundlaugar.is would not serve ${url}`);
}

/* A page from the cache if there is one, and into it if there is a cache. The
   cache is for working on this script, not for running it: a run that should be
   what the directory says today is a run without one. */
async function page(slug, link) {
  const file = CACHE && path.join(CACHE, `${slug}.html`);
  if (file) {
    try { return await fs.readFile(file, 'utf8'); } catch { /* fetch it */ }
  }
  const html = await get(link);
  await sleep(1000);
  if (file) {
    await fs.mkdir(CACHE, { recursive: true });
    await fs.writeFile(file, html);
  }
  return html;
}

/* ---------- html, without a parser ---------- */

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(\w+);/g, (whole, name) => NAMED[name] ?? whole);

/* One line per paragraph, list item or line break. Inline tags are dropped
   without a space, because the directory's editor leaves them in the middle of
   words: Sundhöll Hafnarfjarðar is closed on "Laugarda<span>gar</span>". So are
   soft hyphens, which Varmárlaug's page has pasted into every other word —
   a word with one inside it matches nothing. */
function lines(html) {
  return decode(html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/\u00ad/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const text = (html) => lines(html).join(' ');

/* The single-pool part of the page, cut into its widgets. Everything before it
   is the site's header and everything after is its footer, and both carry links
   — the site's own Facebook page among them — that must not be mistaken for the
   pool's. */
function widgets(html) {
  const start = html.indexOf('elementor-location-single');
  const end = html.indexOf('elementor-location-footer', start);
  if (start < 0 || end < 0) return null;
  const body = html.slice(start, end);
  /* From the widget's own opening tag to the next one's, so that no tag is cut
     in half at either end — a half tag has no closing bracket, and would come
     through into the text as markup. */
  const marks = [...body.matchAll(/data-widget_type="([\w-]+)\.default"[^>]*>/g)]
    .map((m) => ({ type: m[1], open: body.lastIndexOf('<div', m.index), inner: m.index + m[0].length }));
  return marks.map((m, i) => ({
    type: m.type,
    html: body.slice(m.inner, marks[i + 1]?.open ?? body.length)
  }));
}

/* Only links a page can safely put in an href. The data comes from somebody
   else's site, and a javascript: URL in it would otherwise run on this one. */
const safeUrl = (href) => {
  if (!href) return null;
  const url = decode(href).trim();
  return /^https?:\/\//i.test(url) ? url : null;
};

/* ---------- reading one pool ---------- */

const MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
/* A date the way the directory writes one, "1. október". The full stop is
   usually there and sometimes forgotten: Árbæjarlaug was closed "til 15 júní". */
const DATE = String.raw`(\d{1,2})\.?\s*(${MONTHS.join('|')})`;
const SPAN = new RegExp(`${DATE}\\s*(?:til|[-–—])\\s*${DATE}`, 'i');
const FROM = new RegExp(`frá\\s*${DATE}`, 'i');
const UNTIL = new RegExp(`(?:til|[-–—])\\s*${DATE}`, 'i');
const monthDay = (day, month) =>
  `${String(MONTHS.indexOf(month.toLowerCase()) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
/* A month-day moved by whole days, through a leap year so that the day before
   1 March is 29 February rather than a date that does not exist in some other
   year's reading of it. */
const shiftDay = (md, by) => {
  const d = new Date(Date.UTC(2024, Number(md.slice(0, 2)) - 1, Number(md.slice(3)) + by));
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};
const dayBefore = (md) => shiftDay(md, -1);
const dayAfter = (md) => shiftDay(md, 1);

/* Icelandic letters are not word characters to a JavaScript regex, so a \b
   after "lokað" never matches — the ð and the end of the line are both
   non-word — and every closed day on every page was being read as a heading.
   Letters are asked about by property instead. */
const CLOSED = /^lokað(?!\p{L})/iu;
const CLOSURE = /(?<!\p{L})lok(uð|að)(?!\p{L})/iu;

/* getDay() numbering, Sunday 0, the index lib/i18n.js names days by. Matched
   on the stem, because the directory writes a day in whatever case the
   sentence around it wanted: mánudaga, mánudagar, mánudögum. */
const DAY_STEMS = [['sunnu', 0], ['mánu', 1], ['þriðju', 2], ['miðviku', 3], ['fimmtu', 4], ['föstu', 5], ['laugar', 6]];
const dayOf = (word) => DAY_STEMS.find(([stem]) => word.startsWith(stem))?.[1] ?? null;

/* "Mánudaga – föstudaga", "Laugar- og sunnudaga", "Helgar", "Virka daga" — the
   set of days a line of hours applies to, or null when it is not a set of days
   this can be sure of. A null keeps the directory's own words on the page
   rather than a guess in three languages. */
function parseDays(label) {
  let s = label.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(alla daga|daglega)$/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
  if (/^virk(ir|a|um) dag(ar|a|ur)?$/.test(s)) return [1, 2, 3, 4, 5];
  if (/^helg(ar|i|um|ina)$/.test(s)) return [0, 6];
  /* A dash in front of "og" is a shared suffix, not a range: "laugar- og
     sunnudaga" is Saturday and Sunday, not Saturday through to Sunday. And
     "til" is a range written out: "mánudaga til föstudaga". */
  s = s.replace(/\s*[-–]\s*og\s+/g, ' og ').replace(/\s+til\s+/g, ' – ');
  const days = new Set();
  for (const part of s.split(/\s*,\s*|\s+og\s+/)) {
    const ends = part.split(/\s*[-–—]\s*/);
    if (ends.length > 2) return null;
    const [a, b] = ends.map(dayOf);
    if (a === null || (ends.length === 2 && b === null)) return null;
    if (ends.length === 1) { days.add(a); continue; }
    for (let d = a; ; d = (d + 1) % 7) { days.add(d); if (d === b) break; }
  }
  return days.size ? [...days].sort((x, y) => x - y) : null;
}

/* Every time on a line, and whatever else it says: "06:30 – 08:00 og 15:00 –
   21:30" is two spells open, "08:45 (úti)" is a class and where it is held. */
const TIME = /(\d{1,2})[:.](\d{2})(?:\s*[-–—]\s*(\d{1,2})[:.](\d{2}))?/g;
const STARTS_WITH_TIME = /^(kl\.?\s*)?\d{1,2}[:.]\d{2}/i;
const hhmm = (h, m) => `${h.padStart(2, '0')}:${m}`;

/* The value half of a line of hours: times, or closed. Anything else is not a
   line of hours. */
function timeOf(value) {
  const v = value.trim();
  if (CLOSED.test(v)) return { closed: true, times: [], extra: null };
  if (!STARTS_WITH_TIME.test(v)) return null;
  const times = [...v.matchAll(TIME)].map((m) =>
    (m[3] ? `${hhmm(m[1], m[2])}–${hhmm(m[3], m[4])}` : hhmm(m[1], m[2])));
  const extra = v.replace(TIME, ' ').replace(/\b(kl|og)\b\.?|[,&]/gi, ' ').replace(/\s+/g, ' ').trim();
  return { closed: false, times, extra: extra || null };
}

/* What a block of hours is about, from its heading. Opening hours are the
   default: a page that starts straight in on "Mánudaga: 06:30 – 22:00" means
   the pool's own, and so does a heading that is nothing but a season. A gym's
   hours are the gym's, even under "Opnunartími". */
const blockKind = (heading, season) =>
  /leikfimi/i.test(heading) ? 'aqua'
    : /gym|heilsu|líkamsrækt|fitness/i.test(heading) ? 'other'
    : season || /opnun|opið|afgreiðslu|vetur|vetrar|vor\b|sumar|haust/i.test(heading) ? 'open'
    : 'other';

const seasonOf = (s) => {
  const span = s.match(SPAN);
  if (span) return { from: monthDay(span[1], span[2]), to: monthDay(span[3], span[4]) };
  const from = s.match(FROM);
  return from ? { from: monthDay(from[1], from[2]), to: null } : null;
};

/* The day a closure ends, as a whole date. The directory gives the day and the
   month, so the year is worked out: this one, unless the closure runs over New
   Year and has already begun. */
function closureEnd(line) {
  const span = line.match(SPAN);
  const [day, month] = span ? [span[3], span[4]] : line.match(UNTIL).slice(1, 3);
  const to = monthDay(day, month);
  const from = span ? monthDay(span[1], span[2]) : null;
  let year = Number(TODAY.slice(0, 4));
  if (from && to < from && TODAY.slice(5) >= from) year += 1;
  return `${year}-${to}`;
}

/* The hours widget, as blocks: a heading, the season it covers if it says, its
   rows and whatever was written under it. The directory has no structure for
   this — it is a text box — so every line is sorted into one of those by what
   it looks like, most specific first. */
function readHours(html) {
  const blocks = [];
  let block = { kind: 'open', title: null, season: null, rows: [], notes: [] };

  for (const line of lines(html)) {
    /* "Mánudaga – föstudaga: 06:30 – 22:00", "17. júní: 09:00 – 18:00". The
       label runs to the first colon that has a time or "lokað" after it, which
       is what stops the colon inside a time from being taken for its end. */
    const row = line.match(/^(.{1,40}?)\s*[:;]\s*((?:kl\.?\s*)?\d{1,2}[:.]\d{2}.*|lokað.*)$/iu);
    const time = row && timeOf(row[2]);
    if (time) {
      block.rows.push({ label: row[1].trim(), days: parseDays(row[1]), ...time });
      continue;
    }
    /* A time with nothing in front of it: Sky Lagoon's autumn is one line,
       "09:00 – 22:00", under a heading that says which autumn. */
    const bare = timeOf(line);
    if (bare && !bare.closed && bare.times.some((t) => t.includes('–'))) {
      block.rows.push({ label: null, days: null, ...bare });
      continue;
    }
    /* A date span on a line of its own belongs to the heading above it. */
    const season = seasonOf(line);
    if (season && line.replace(SPAN, '').replace(/[\s,.:;–-]/g, '') === '') {
      block.season = season;
      if (block.kind === 'other') block.kind = 'open';
      continue;
    }
    /* A closure with an end date. One that is already over is dropped: the
       directory leaves them up for months, and Laugardalslaug's page still said
       in September that it was shut for maintenance in August. One that is not
       keeps its date, so the page can stop showing it once it is. */
    if (CLOSURE.test(line) && UNTIL.test(line)) {
      const until = closureEnd(line);
      if (until >= TODAY) block.notes.push({ text: line, until });
      continue;
    }
    /* A heading: a colon at the end, or short and not a sentence. */
    if (/:$/.test(line) || (line.length <= 45 && line.split(/\s+/).length <= 6 && !/[.!?]$/.test(line))) {
      blocks.push(block);
      const title = line.replace(/[:\s]+$/, '');
      const own = seasonOf(title);
      block = { kind: blockKind(title, own), title, season: own, rows: [], notes: [] };
      /* A heading dated to a year that has gone is a block that has too.
         Lágafellslaug's page still carries "Rauðir dagar sumarið 2025". */
      const year = title.match(/\b(20\d\d)\b/)?.[1];
      if (year && year < TODAY.slice(0, 4)) block.stale = true;
      continue;
    }
    block.notes.push({ text: line });
  }
  blocks.push(block);

  /* "Sumaropnun, frá 7. júní" and "Vetraropnun, frá 24. ágúst": each season is
     said to start and neither to end, because each ends where the other
     begins. A season that starts and has no other to end at is left open. */
  const kept = blocks.filter((b) => !b.stale && (b.rows.length || b.notes.length));
  const starts = kept.filter((b) => b.kind === 'open' && b.season).map((b) => b.season.from).sort();
  for (const b of kept) {
    if (!b.season || b.season.to !== null) continue;
    const next = starts.find((s) => s > b.season.from) ?? starts[0];
    if (next !== b.season.from) b.season.to = dayBefore(next);
  }
  /* "Frá 1. júní til 30. september" followed by "Vetraropnun" and no dates:
     winter is the rest of the year. Only ever between exactly two seasons of
     opening hours, one dated and one named as a season — anything more and the
     rest of the year is not one block's to claim. */
  const open = kept.filter((b) => b.kind === 'open');
  const dated = open.filter((b) => b.season?.to);
  const named = open.filter((b) => !b.season && /vetur|vetrar|sumar/i.test(b.title ?? ''));
  if (open.length === 2 && dated.length === 1 && named.length === 1) {
    named[0].season = { from: dayAfter(dated[0].season.to), to: dayBefore(dated[0].season.from) };
  }
  for (const b of kept) delete b.stale;
  return kept;
}

/* The price table, in sections. The directory draws one table and breaks it up
   with rows whose first cell is empty — a new set of column heads, "Sundföt |
   Handklæði" over the rental prices — and with rows that are empty altogether,
   which start a section with no heads at all. Reading it as one table would put
   the lane hire under the swimsuit column. */
function readPrices(html) {
  const table = html.match(/<table[\s\S]*?<\/table>/i);
  if (!table) return null;
  const grid = [...table[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((tr) =>
    [...tr[0].matchAll(/<t([hd])[^>]*>([\s\S]*?)<\/t\1>/gi)].map((cell) => text(cell[2])));
  if (!grid.length) return null;

  const [head, ...body] = grid;
  const year = /^\d{4}$/.test(head[0]) ? head[0] : null;
  const sections = [{ head: head.slice(1), rows: [] }];
  let broken = false;
  for (const row of body) {
    if (row.every((c) => !c)) { broken = true; continue; }
    if (!row[0]) {
      sections.push({ head: row.slice(1), rows: [] });
    } else {
      if (broken) sections.push({ head: [], rows: [] });
      sections[sections.length - 1].rows.push(row);
    }
    broken = false;
  }

  /* Trailing columns nothing is written in are the width of the widest section
     leaking into the narrow ones. */
  for (const s of sections) {
    const used = Math.max(
      s.head.findLastIndex(Boolean) + 1,
      ...s.rows.map((r) => r.slice(1).findLastIndex(Boolean) + 1)
    );
    s.head = s.head.slice(0, used);
    if (s.head.every((c) => !c)) s.head = [];
    s.rows = s.rows.map((r) => [r[0], ...r.slice(1, used + 1)]);
  }
  return { year, sections: sections.filter((s) => s.rows.length) };
}

/* What a pool has, read out of the directory's description of it. Each tag is
   a pattern over the Icelandic, matched on stems for the same reason the days
   are; the page names them in whichever language it is reading in. A tag is
   only ever added, never inferred from an absence — a description that does
   not mention a cold tub is not evidence there is none.

   Letters by property rather than \w, which stops at the first accented one:
   "kaldavatnspottur" is one word, and so is "heitir". */
const L = String.raw`\p{L}*`;
const FACILITIES = [
  ['outdoor', /útilaug|útisundlaug/u],
  ['indoor', /innilaug|innisundlaug|innandyra|innanhúss/u],
  ['hotTubs', new RegExp(`heit${L}\\s+pott|heitur pottur|pottarnir|pott(ur|ar)\\s+\\d`, 'u')],
  ['coldTub', new RegExp(`(kald|köld|kalt)${L}\\s*(pott|kar|kör|ker)`, 'u')],
  ['steam', /eimbað|vatnsgufu/u],
  ['sauna', /saun|sána|sánu|þurrgufu|gufubað/u],
  ['slide', /rennibraut/u],
  ['kids', new RegExp(`vaðlaug|barnalaug|busl${L}(laug|pott)`, 'u')],
  ['massage', /nuddpott|nuddtæk|vatnsnudd|loftnudd|nuddstút|með nuddi/u],
  ['diving', /stökkbrett|stökkpall/u],
  ['gym', /líkamsrækt|heilsurækt|fitness|tækjasal/u],
  ['food', /kaffiter|kaffihús|veiting|(?<!\p{L})bar(inn|num)(?!\p{L})/u],
  ['accessible', /hjólastól|fatlað/u],
  ['aquaAerobics', /sundleikfimi|vatnsleikfimi/u]
];

/* Where a description says something a pattern reads wrongly, and the reason.
   Kept to the cases that were checked against the page by hand. */
const CORRECTIONS = {
  /* "Í fyrstu var aðeins um útilaug að ræða": there was an outdoor pool here
     until 1953, when the building went up over it. */
  'sundholl-hafnarfjardar': { drop: ['outdoor'] }
};

/* The longest basin, in metres, from however the description happens to put
   it: "50m x 22m", "12,5 x 25 metra", "25 metrar að lengd". A width is never
   longer than its length, so the largest figure in the plausible range is the
   answer even when widths are in there too. Depths and heights are single
   digits or decimals below ten and fall outside it, and so does an 86 m slide.
   A span of lengths is a span of something else — Lágafellslaug's slides are
   "frá 33-43 metrum" — and is taken out before anything is read. */
function longestBasin(description) {
  const found = [];
  let rest = description.replace(/\d+\s*[-–]\s*\d+\s*(?:m\b|metr)/gi, ' ');
  rest = rest.replace(
    /(\d+(?:[,.]\d+)?)\s*m?\s*[x×]\s*(\d+(?:[,.]\d+)?)\s*(?:m\b|metr)/gi,
    (_, a, b) => { found.push(a, b); return ' '; }
  );
  for (const m of rest.matchAll(/(?<![\d,.])(\d{2}(?:[,.]\d+)?)\s?(?:m\b|metr)/gi)) found.push(m[1]);
  const metres = found.map((v) => Number(v.replace(',', '.'))).filter((v) => v >= 10 && v <= 50);
  return metres.length ? Math.max(...metres) : null;
}

/* Seven digits, the way every Icelandic number is written: 411 5660. */
const phone = (s) => {
  const digits = s.replace(/\D/g, '');
  return digits.length === 7 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : s.trim() || null;
};

function readPool(html) {
  const parts = widgets(html);
  if (!parts) return null;

  const pool = {
    address: null, phone: null, email: null, web: null, facebook: null, instagram: null,
    longest: null, facilities: [], hours: [], prices: null, priceNotes: []
  };
  let section = null;
  let description = '';
  let hoursText = '';

  for (const { type, html: w } of parts) {
    if (type === 'post-info') pool.address = text(w) || null;
    if (type === 'icon-box') {
      const href = w.match(/<a href="([^"]+)"/)?.[1];
      const label = text(w);
      if (/fa-phone/.test(w)) pool.phone = label ? phone(label) : null;
      else if (/fa-envelope/.test(w)) pool.email = (href?.replace(/^mailto:/, '') || label || '').trim() || null;
      else if (/fa-globe/.test(w)) pool.web = safeUrl(href);
      else if (/fa-facebook/.test(w)) pool.facebook = safeUrl(href);
      else if (/fa-instagram/.test(w)) pool.instagram = safeUrl(href);
    }
    if (type === 'image-box') {
      const desc = w.match(/elementor-image-box-description">([\s\S]*)$/)?.[1] ?? '';
      description += ' ' + text(desc);
    }
    if (type === 'heading' && /<h3/.test(w)) section = text(w).toLowerCase();
    if (type === 'text-editor' && section?.startsWith('afgreiðslu')) {
      pool.hours = readHours(w);
      hoursText += ' ' + text(w);
    }
    if (type === 'text-editor' && section?.startsWith('gjaldskrá')) pool.priceNotes = lines(w);
    if (type === 'shortcode' && section?.startsWith('gjaldskrá')) pool.prices = readPrices(w) ?? pool.prices;
  }

  const said = description.toLowerCase();
  pool.facilities = FACILITIES
    .filter(([key, re]) => re.test(key === 'aquaAerobics' ? `${said} ${hoursText.toLowerCase()}` : said))
    .map(([key]) => key);
  pool.longest = longestBasin(description);
  return pool;
}

/* ---------- the run ---------- */

const KINDS = { sundlaug: 'pool', badlon: 'lagoon', natturulaug: 'natural' };

const categories = await get(`${API}/categories?per_page=100`, { json: true });
const regions = categories.filter((c) => c.slug !== 'landshluti' && c.parent === categories.find((p) => p.slug === 'landshluti')?.id);
const tags = new Map((await get(`${API}/tags?per_page=100`, { json: true })).map((t) => [t.id, t.slug]));

const asked = ALL ? regions : regions.filter((r) => WANTED.includes(r.slug));
const unknown = WANTED.filter((slug) => !regions.some((r) => r.slug === slug));
if (unknown.length) {
  console.error(`no such region: ${unknown.join(', ')} — the directory has ${regions.map((r) => r.slug).join(', ')}`);
  process.exit(2);
}

const byName = new Map(BUILT_IN.map((p) => [p.name, p.id]));
const fetched = [];
const problems = [];

for (const region of asked) {
  const entries = await get(`${API}/sundlaugasafn?categories=${region.id}&per_page=100`, { json: true });
  process.stderr.write(`${region.name}: ${entries.length} pools\n`);
  for (const entry of entries) {
    const name = decode(entry.title.rendered).trim();
    const id = ALIAS[name] ?? byName.get(name);
    if (!id) { problems.push(`${name} — not in lib/pools.js under that name; add it to ALIAS`); continue; }

    const read = readPool(await page(entry.slug, entry.link));
    if (!read) { problems.push(`${name} — the page is not the pool template; nothing read`); continue; }

    const kind = entry.tags.map((t) => KINDS[tags.get(t)]).find(Boolean) ?? 'pool';
    const drop = CORRECTIONS[id]?.drop ?? [];
    read.facilities = read.facilities.filter((f) => !drop.includes(f));
    fetched.push({ id, name, region: region.slug, kind, source: entry.link, fetched: TODAY, ...read });
    process.stderr.write(`  ${name}\n`);
  }
}

/* ---------- report ---------- */

for (const p of fetched) {
  console.log(`\n${p.name} (${p.id}) — ${p.kind}, ${p.region}`);
  console.log(`  ${p.address ?? '—'} · ${p.phone ?? '—'} · ${p.email ?? '—'}`);
  console.log(`  web ${p.web ?? '—'} · fb ${p.facebook ? 'yes' : '—'} · ig ${p.instagram ? 'yes' : '—'}`);
  console.log(`  longest ${p.longest ?? '—'} m · ${p.facilities.join(', ') || 'no facilities read'}`);
  for (const b of p.hours) {
    console.log(`  [${b.kind}] ${b.title ?? ''}${b.season ? ` (${b.season.from} → ${b.season.to})` : ''}`);
    for (const r of b.rows) {
      const when = r.closed ? 'closed' : `${r.times.join(', ')}${r.extra ? ` ${r.extra}` : ''}`;
      console.log(`      ${(r.label ?? '').padEnd(28)} ${String(r.days ? r.days.join('') : '?').padEnd(8)} ${when}`);
    }
    for (const n of b.notes) console.log(`      note${n.until ? ` (until ${n.until})` : ''}: ${n.text.slice(0, 90)}`);
  }
  if (p.prices) {
    console.log(`  prices ${p.prices.year ?? ''}`);
    for (const s of p.prices.sections) {
      console.log(`      | ${s.head.join(' | ')}`);
      for (const r of s.rows) console.log(`      ${r.join(' | ')}`);
    }
  } else {
    console.log('  no price table');
  }
}
for (const line of problems) console.log(`\n  ! ${line}`);
console.log(`\n${fetched.length} pools read from ${asked.length} region(s), ${problems.length} problem(s)`);

if (!WRITE) {
  console.log('nothing written; pass --write to put these into lib/poolinfo.js');
  process.exit(problems.length ? 1 : 0);
}

/* ---------- write ---------- */

/* Everything already in the file for regions this run did not ask about stays;
   everything for the regions it did is replaced, so a pool the directory has
   dropped is dropped here too. */
let kept = [];
try {
  kept = (await import(pathToFileURL(OUT).href)).POOL_INFO
    .filter((p) => !asked.some((r) => r.slug === p.region));
} catch { /* first run */ }

const all = [...kept, ...fetched].sort((a, b) =>
  a.region.localeCompare(b.region) || a.name.localeCompare(b.name, 'is'));

const header = `/* GENERATED by bin/fetch-pool-info.mjs from the pool directory at
 * https://sundlaugar.is — do not edit by hand. Run it and diff it.
 *
 * What each pool's page on the directory says a swimmer needs: where it is, how
 * to reach it, what it has, when it is open and what it costs. Not the
 * directory's descriptions or photographs — the page links to those. See the
 * script for how each field is read, and README.md for how the page uses it.
 *
 * \`fetched\` is the day each pool was read. Hours and prices change, and the
 * page says how old they are rather than presenting them as today's.
 */

`;
/* JSON, but anything short enough to read on one line is written on one. Fully
   indented it came to 78 KB for twenty pools, most of it a row of hours spread
   over nine lines, and this file ships to every pool page; a line per row also
   diffs as a line per row. */
function serialise(value, indent = '') {
  const flat = JSON.stringify(value);
  if (flat.length + indent.length <= 120 || value === null || typeof value !== 'object') return flat;
  const inner = indent + '  ';
  const items = Array.isArray(value)
    ? value.map((v) => inner + serialise(v, inner))
    : Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${serialise(v, inner)}`);
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return `${open}\n${items.join(',\n')}\n${indent}${close}`;
}

await fs.writeFile(OUT, `${header}export const POOL_INFO = ${serialise(all)};\n`);
console.log(`wrote ${all.length} pools into lib/poolinfo.js (${fetched.length} from this run)`);
