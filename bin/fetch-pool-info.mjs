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
 *   node bin/fetch-pool-info.mjs --all --write --report run.json        # and say what went wrong, as JSON
 *
 * --report is for the nightly crawl (.github/workflows/crawl-sundlaugar.yml),
 * which hands the problems — a name the directory has that lib/pools.js does
 * not, most of all — to bin/diff-pool-info.mjs to put in front of a person.
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
const REPORT = argv.includes('--report') ? path.resolve(argv[argv.indexOf('--report') + 1]) : null;

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
  'Kópavogslaug': 'sundlaug-kopavogs',
  /* The natural pools section's name for it; the pool directory calls it Blue
     Lagoon, which is what lib/pools.js took. */
  'Bláa Lónið': 'blue-lagoon'
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

/* A month as the directory writes one: in full, or cut short — "15. sept",
   "15. okt", "31. mai" without its accent. Longest first, so "mars" is not
   read as "mar" with an s left over. */
const MONTH = String.raw`(janúar|jan|febrúar|feb|mars|mar|apríl|apr|maí|mai|júní|jún|jun|júlí|júl|jul|ágúst|ágú|ág|september|sept|sep|október|okt|nóvember|nóv|nov|desember|des)\.?(?!\p{L})`;
const MONTH_OF = [['jan', 1], ['feb', 2], ['mar', 3], ['apr', 4], ['ma', 5], ['jún', 6], ['jun', 6], ['júl', 7], ['jul', 7], ['ág', 8], ['sep', 9], ['okt', 10], ['nóv', 11], ['nov', 11], ['des', 12]];
const monthOf = (word) => MONTH_OF.find(([stem]) => word.toLowerCase().startsWith(stem))[1];

/* A date the way the directory writes one, "1. október". The full stop is
   usually there and sometimes forgotten — Árbæjarlaug was closed "til 15 júní" —
   and a season can run "til miðjan ágúst", the 15th, or "til lok ágúst", the
   31st. Three groups: the day, the word instead of one, and the month. */
const DATE = String.raw`(?:(\d{1,2})\.?|(miðjan|lok))\s*${MONTH}`;
const SPAN = new RegExp(`${DATE}\\s*(?:til|[-–—])\\s*${DATE}`, 'iu');
const FROM = new RegExp(`(?:frá|hefst)\\s*${DATE}`, 'iu');
const UNTIL = new RegExp(`(?:til|[-–—])\\s*${DATE}`, 'iu');
const ONLY_MONTH = new RegExp(`^${MONTH}$`, 'iu');
const pad = (n) => String(n).padStart(2, '0');
/* A month-day moved by whole days, through a leap year so that the day before
   1 March is 29 February rather than a date that does not exist in some other
   year's reading of it. */
const shiftDay = (md, by) => {
  const d = new Date(Date.UTC(2024, Number(md.slice(0, 2)) - 1, Number(md.slice(3)) + by));
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};
const dayBefore = (md) => shiftDay(md, -1);
const dayAfter = (md) => shiftDay(md, 1);
const lastOf = (month) => dayBefore(`${pad(month % 12 + 1)}-01`);

/* The month-day of a date DATE matched, from its three groups at `i`. */
function dateAt(m, i) {
  const [day, word, month] = [m[i], m[i + 1], m[i + 2]];
  if (word?.toLowerCase() === 'lok') return lastOf(monthOf(month));
  return `${pad(monthOf(month))}-${pad(day ?? 15)}`;
}

/* Icelandic letters are not word characters to a JavaScript regex, so a \b
   after "lokað" never matches — the ð and the end of the line are both
   non-word — and every closed day on every page was being read as a heading.
   Letters are asked about by property instead. */
const CLOSED = /^lokað(?!\p{L})/iu;
const CLOSURE = /(?<!\p{L})lok(uð|að)(?!\p{L})/iu;

/* getDay() numbering, Sunday 0, the index lib/i18n.js names days by. A day is
   written in whatever case the sentence around it wanted — mánudaga, mánudögum
   — or cut short, "mán" or "mánud.", so it is matched as a stem and then as
   nothing but the rest of a day's name: "sundlaug" starts like Sunday and is
   not one. */
const DAY = /^(sunnu|sun|mánu|mán|þriðju|þri|miðviku|mið|fimmtu|fim|föstu|fös|laugar|lau)(dag\p{L}*|dög\p{L}*|d)?$/u;
const DAY_OF = { sun: 0, mán: 1, þri: 2, mið: 3, fim: 4, fös: 5, lau: 6 };
const dayOf = (word) => {
  const m = word.replace(/^\.+|\.+$/g, '').match(DAY);
  return m ? DAY_OF[m[1].slice(0, 3)] : null;
};

/* "Mánudaga – föstudaga", "Laugar- og sunnudaga", "Helgar", "Virka daga" — the
   set of days a line of hours applies to, or null when it is not a set of days
   this can be sure of. A null keeps the directory's own words on the page
   rather than a guess in three languages. */
function parseDays(label) {
  let s = label.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(alla daga|allir dagar|daglega)$/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
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

/* Holidays, which half the pools list with their own hours: Christmas, Easter,
   the first day of summer, National Day. They are not the pool's hours for any
   day of the week, so a block of them is never read as its opening hours. */
const HOLIDAY = /jól|áramót|páska|frídag|hátíð|nýárs|gamlárs|aðfanga|skírdag|uppstigning|þorláks|sumardagurinn|hvítasunnu|rauðir dagar|verslunarmanna|langi|verkalýðs|17\.? júní/iu;

/* What a block of hours is about, from its heading. Opening hours are the
   default: a page that starts straight in on "Mánudaga: 06:30 – 22:00" means
   the pool's own, and so does a heading that is nothing but a season or names
   the pool itself. A gym's hours are the gym's, even under "Opnunartími". */
const blockKind = (heading, season) =>
  /leikfimi/iu.test(heading) ? 'aqua'
    : HOLIDAY.test(heading) ? 'other'
    : /^(sundlaug|útilaug|innilaug|innisundlaug)/iu.test(heading) ? 'open'
    : /gym|heilsu|líkamsrækt|fitness|þreksal|tækjasal/iu.test(heading) ? 'other'
    : season || /opnun|opið|afgreiðslu|vetur|vetrar|vor(?!\p{L})|sumar|haust/iu.test(heading) ? 'open'
    : 'other';

/* A season from a line: a span of dates, a start alone ("frá 7. júní", "hefst
   1. júní"), or nothing but months — "Apríl – Október", "Október, nóvember og
   desember" — which run from the first of the first to the last of the last. */
const seasonOf = (s) => {
  const span = s.match(SPAN);
  if (span) return { from: dateAt(span, 1), to: dateAt(span, 4) };
  const from = s.match(FROM);
  if (from) return { from: dateAt(from, 1), to: null };
  const months = s.toLowerCase().split(/\s*(?:[-–—,:]|\s+og\s+|\s+til\s+)\s*/).filter(Boolean);
  if (months.length && months.every((m) => ONLY_MONTH.test(m))) {
    const first = monthOf(months[0]);
    const last = monthOf(months.at(-1));
    return { from: `${pad(first)}-01`, to: lastOf(last) };
  }
  return null;
};

/* A label that is nothing but a span of dates, which some lagoons give each
   line of their hours instead of days of the week: "15. júní – 20. ágúst:
   07:00 – 23:00". */
const seasonLabel = (label) => {
  const span = label.match(SPAN);
  return span && label.replace(SPAN, '').replace(/[\s,.:;–-]/g, '') === ''
    ? { from: dateAt(span, 1), to: dateAt(span, 4) }
    : null;
};

/* The day a closure ends, as a whole date. The directory gives the day and the
   month, so the year is worked out: this one, unless the closure runs over New
   Year and has already begun. A closure on one day — "lokuð 22. maí frá 08:00
   til 13:00" — ends that day. */
const ONE_DATE = new RegExp(DATE, 'iu');

function closureEnd(line) {
  const span = line.match(SPAN);
  const to = span ? dateAt(span, 4) : dateAt(line.match(UNTIL) ?? line.match(ONE_DATE), 1);
  const from = span ? dateAt(span, 1) : null;
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

  for (const raw of lines(html)) {
    /* Years are taken out before anything is read, and kept aside for the one
       check that needs them: "24. ágúst (2026) til 21. maí (2027)" is a span
       of dates with two numbers in the way. */
    const years = raw.match(/\b20\d\d\b/g) ?? [];
    /* "09 :00" is a typo for a time, and "opið 09:00 – 19:00" is a time that
       says it is open; both are read as the time. */
    const line = raw.replace(/\s*\(?\b20\d\d\b\)?/g, '')
      .replace(/(\d)\s+:(\d)/g, '$1:$2')
      .replace(/([:;–-]\s*)opið\s+(?=(kl\.?\s*)?\d{1,2}[:.]\d{2})/giu, '$1')
      .trim();
    if (!line) continue;
    /* "Mánudaga – föstudaga: 06:30 – 22:00", "17. júní: 09:00 – 18:00". The
       label runs to the first colon that has a time or "lokað" after it, which
       is what stops the colon inside a time from being taken for its end.
       Holidays are as often written without the colon — "Páskadagur – lokað",
       "23. des Þorláksmessa 06:45 – 18:00" — and are rows too, but only with a
       whole span of hours or a "lokað" after them: a sentence with a time in
       it is not a line of hours. */
    const row = line.match(/^(.{1,50}?)\s*[:;]\s*((?:kl\.?\s*)?\d{1,2}[:.]\d{2}.*|lokað.*)$/iu) ??
                line.match(/^(\D{2,50}?|\d{1,2}\.?\s*\p{L}.{0,45}?)\s+(?:[–-]\s+)?((?:kl\.?\s*)?\d{1,2}[:.]\d{2}\s*[-–—]\s*\d{1,2}[:.]\d{2}.*|lokað(?!\p{L}).*)$/iu);
    const time = row && timeOf(row[2]);
    if (time) {
      const days = parseDays(row[1]);
      block.rows.push({ label: row[1].trim(), days, season: days ? null : seasonLabel(row[1]), ...time });
      continue;
    }
    /* A time with nothing in front of it: Sky Lagoon's autumn is one line,
       "09:00 – 22:00", under a heading that says which autumn. */
    const bare = timeOf(line);
    if (bare && !bare.closed && bare.times.some((t) => t.includes('–'))) {
      block.rows.push({ label: null, days: null, season: null, ...bare });
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
    const ends = UNTIL.test(line) || (ONE_DATE.test(line) && !FROM.test(line));
    if (CLOSURE.test(line) && ends && !HOLIDAY.test(line)) {
      const until = closureEnd(line);
      if (until >= TODAY) block.notes.push({ text: raw, until });
      continue;
    }
    /* A heading: a colon at the end, short and not a sentence, or a season
       with its dates however long it runs to — Hella's "Sumaropnun 23. maí
       til 23. ágúst 2026" is seven words, and read as a note it left summer
       and winter hours in one block, both of them marked as today's. */
    const namesSeason = seasonOf(line) && /opnun|opið|sumar|vetur|vetrar|vor(?!\p{L})|haust/iu.test(line);
    /* And a word or two with a full stop after them, "Vetraropnun.", is a
       heading that happened to be typed like a sentence. */
    const short = line.length <= 45 && line.split(/\s+/).length <= 6 && !/[.!?]$/.test(line);
    const clipped = /^\p{L}+(\s\p{L}+)?\.$/u.test(line);
    if (/:$/.test(line) || namesSeason || short || clipped) {
      blocks.push(block);
      const title = raw.replace(/[:.\s]+$/, '');
      const own = seasonOf(line);
      block = { kind: blockKind(line, own), title, season: own, rows: [], notes: [] };
      /* A heading dated to a year that has gone is a block that has too.
         Lágafellslaug's page still carries "Rauðir dagar sumarið 2025". */
      if (years.length && years.every((y) => y < TODAY.slice(0, 4))) block.stale = true;
      continue;
    }
    /* A closure with no date to end on — "Sundlaugin Reyðarfirði er lokuð." —
       is kept as a note, and flagged so the page can make it hard to miss. It
       has to say the pool *is* shut: Akranes's lanes "geta verið lokuð" during
       school swimming, and being shut on Christmas Day is not that kind of
       closure either. */
    const shut = /(?<!\p{L})er\s+lok(uð|að)(?!\p{L})/iu.test(line) && !HOLIDAY.test(line);
    block.notes.push(shut ? { text: raw, closure: true } : { text: raw });
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

  let [head, ...body] = grid;
  const year = /^\d{4}$/.test(head[0]) ? head[0] : null;
  /* Columns headed with a period rather than a ticket — Laugarvatn Fontana's
     are "01.06.2023-31.05.2024" and "01.06.2024-31.05.2025" — are prices for
     that period, and one that has ended is dropped. A table with nothing left
     is no table. */
  const ended = head.map((cell, i) => {
    const m = i > 0 && cell.match(/\d{1,2}\.\d{1,2}\.\d{4}\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` < TODAY : false;
  });
  if (ended.some(Boolean)) {
    const live = (row) => row.filter((_, i) => !ended[i]);
    head = live(head);
    body = body.map(live);
    if (head.length < 2) return null;
  }
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
   it: "50m x 22m", "12,5 x 25 metra", "Útilaugin er 25 metra löng". A width is
   never longer than its length, so the largest figure is the answer even when
   widths are in there too.

   A length only counts when the thing it measures is a pool. Descriptions give
   the length of everything: Varmahlíð's slide is "47 metra löng", Bolungarvík's
   sports hall "22 x 28 metrar", and Hvammsvík is "45 mínútna" from Reykjavík.
   Taking the largest number in range put all three down as the longest pool. So
   each figure is read with the words around it, and kept only when the nearest
   noun is a pool — "laug" in any of its forms, útilaug, vaðlaug, sundlaugin —
   rather than a slide, a hall, a pitch or a tower. A span of lengths is a span
   of something else, Lágafellslaug's slides "frá 33-43 metrum", and goes first.
   The 10–50 m range stays as the last word: a 57 m slide beside the word
   "útisundlaug" is still not a pool. */
const POOL_WORD = /laug/giu;
const OTHER_WORD = /rennibraut|sal(ur|ar|num|inn)?(?!\p{L})|völl|vell|turn|pott|braut(?!\p{L})|hús(?!\p{L})/giu;

function nearest(text, re, at) {
  let best = Infinity;
  for (const m of text.matchAll(re)) {
    const d = m.index >= at ? m.index - at : at - (m.index + m[0].length);
    if (d < best) best = d;
  }
  return best;
}

function longestBasin(units) {
  const found = [];
  /* "m" and nothing after it: not "mínútna", and not the m² of Blönduós's
     paddling pool, "41.2 m2". */
  const LENGTH = /(?<![\d,.])(\d+(?:[,.]\d+)?)(?:\s*m?\s*[x×]\s*(\d+(?:[,.]\d+)?))?\s*(?:m(?![\p{L}\d²³])|metr\p{L}*)/giu;
  /* Within one sentence of one line: Sandgerði lists "Æfingasalur. 25 m
     Sundlaug.", and the hall in the sentence before is not what the 25 m is. */
  for (const unit of units) {
    const text = unit.replace(/\d+\s*[-–]\s*\d+\s*(?:m(?!\p{L})|metr)/giu, ' ');
    for (const m of text.matchAll(LENGTH)) {
      const at = m.index + m[0].length / 2;
      if (nearest(text, POOL_WORD, at) > 60) continue;
      if (nearest(text, OTHER_WORD, at) < nearest(text, POOL_WORD, at)) continue;
      found.push(m[1], ...(m[2] ? [m[2]] : []));
    }
  }
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
  const described = [];
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
      described.push(...lines(desc));
    }
    if (type === 'heading' && /<h3/.test(w)) section = text(w).toLowerCase();
    if (type === 'text-editor' && section?.startsWith('afgreiðslu')) {
      pool.hours = readHours(w);
      hoursText += ' ' + text(w);
    }
    if (type === 'text-editor' && section?.startsWith('gjaldskrá')) pool.priceNotes = lines(w);
    if (type === 'shortcode' && section?.startsWith('gjaldskrá')) pool.prices = readPrices(w) ?? pool.prices;
  }

  /* Sentence by sentence, and not from a sentence about the neighbourhood:
     descriptions like to mention the restaurant down the road and the gym in
     the next town, and neither is something the pool has. */
  /* Line by line as well, since half the descriptions are lists with no full
     stops in them, and Höfn's ends in "Tjaldsvæði í nágrenninu" — a campsite
     nearby — which as one run-on sentence took every facility with it. */
  const units = described.flatMap((line) => line.split(/(?<=[.!?])\s+/));
  const sentences = units.map((u) => u.toLowerCase())
    .filter((s) => !/nágrenn|skammt frá|stutt frá|í göngufæri|í bænum/u.test(s));
  const hours = hoursText.toLowerCase();
  pool.facilities = FACILITIES
    .filter(([key, re]) => sentences.some((s) => re.test(s)) || (key === 'aquaAerobics' && re.test(hours)))
    .map(([key]) => key);
  pool.longest = longestBasin(units);
  return pool;
}

/* ---------- the run ---------- */

const KINDS = { sundlaug: 'pool', badlon: 'lagoon', natturulaug: 'natural' };

/* The natural pools — Landbrotalaug, Reykjadalur, the tubs at Drangsnes — are a
   section of the directory the WordPress API does not serve, so they are listed
   from that section's sitemap instead. Only the Icelandic pages: the sitemap
   mixes in the English copies under the same slugs, and two pools are only in it
   in English, both of which are covered elsewhere or not at all. */
const NATURAL = 'https://sundlaugar.is/heitar_laugar-sitemap.xml';

/* Natural pools the directory lists that lib/pools.js deliberately does not:
   the five nobody could place, which have no address on the directory and no
   name in OpenStreetMap. A pool that cannot be placed has no page to put these
   details on. See the note at the top of lib/pools.js. */
const UNPLACEABLE = new Set(['hveragil', 'kerid-a-husavikurhofda', 'laegdin', 'sika', 'laugarnes-vid-birkimel']);

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
const ids = new Set(BUILT_IN.map((p) => p.id));
const fetched = [];
const problems = [];
const skipped = [];

function keep(id, entry) {
  const drop = CORRECTIONS[id]?.drop ?? [];
  entry.facilities = entry.facilities.filter((f) => !drop.includes(f));
  fetched.push({ id, ...entry });
  process.stderr.write(`  ${entry.name}\n`);
}

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
    keep(id, { name, region: region.slug, kind, source: entry.link, fetched: TODAY, ...read });
  }
}

const links = [...(await get(NATURAL)).matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1])
  .filter((url) => /^https:\/\/sundlaugar\.is\/heitar_laugar\/[^/]+\/$/.test(url));
process.stderr.write(`natural pools: ${links.length} pages\n`);
for (const link of links) {
  const slug = link.split('/').at(-2);
  if (UNPLACEABLE.has(slug)) { skipped.push(`${slug} — one of the natural pools that cannot be placed`); continue; }

  const html = await page(`heitar_laugar-${slug}`, link);
  /* The region is only on the page, as a class; the page is read whatever it
     turns out to be, so a run for one region still reads every natural pool. */
  const classes = html.match(/type-heitar_laugar[^"]*/)?.[0] ?? '';
  const region = regions.find((r) => classes.split(/\s+/).includes(`category-${r.slug}`));
  if (!region) { problems.push(`${slug} — no region on its page`); continue; }
  if (!asked.includes(region)) continue;

  const name = decode(html.match(/<title>([^<]+)<\/title>/)?.[1] ?? slug).split(/\s+[-|–]\s+/)[0].trim();
  const id = ids.has(slug) ? slug : (ALIAS[name] ?? byName.get(name));
  if (!id) { problems.push(`${name} (${slug}) — not in lib/pools.js under that name or slug; add it to ALIAS`); continue; }
  /* Two pools are in both sections: Hellulaug, and Bláa Lónið as Blue Lagoon.
     The pool directory's page is the fuller one and wins. */
  if (fetched.some((p) => p.id === id)) { skipped.push(`${slug} — already read from the pool directory`); continue; }

  const read = readPool(html);
  if (!read) { problems.push(`${name} — the page is not the pool template; nothing read`); continue; }
  const kind = /\btag-badlon\b/.test(html) ? 'lagoon' : 'natural';
  keep(id, { name: BUILT_IN.find((p) => p.id === id).name, region: region.slug, kind, source: link, fetched: TODAY, ...read });
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
for (const line of skipped) console.log(`\n  - ${line}`);
for (const line of problems) console.log(`\n  ! ${line}`);
console.log(`\n${fetched.length} pools read from ${asked.length} region(s), ${problems.length} problem(s)`);
if (REPORT) await fs.writeFile(REPORT, JSON.stringify({ read: fetched.length, problems, skipped }, null, 2) + '\n');

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
