/* A page per pool: what the directory at sundlaugar.is says about it, and what
   this app knows about swimming there. One renderer for the private app and the
   public read-only page, the way the pool table and the map are, so the two
   cannot disagree about a pool.

   The directory's part comes from lib/poolinfo.js, which bin/fetch-pool-info.mjs
   writes. The app's part is handed in by the page — a visit count on both, the
   date of the last visit only on the private one, which is the only page that
   is allowed to put a pool on a day.

   Everything from the directory is somebody else's text on this page, so it is
   only ever set as textContent and only ever linked to over http(s), mailto: or
   tel:. The script already refuses any other kind of link; this checks again,
   because a hand edit of the generated file would not have gone through it. */

import { t, plural, weekdayName, joinList, formatDate, formatDayMonth } from './i18n.js';
import { POOL_INFO } from './poolinfo.js';
import { mapHTML, windowFor } from './poolmap.js';
import { poolHref } from './pools.js';

/* The regions in the order a list of them is read in: the capital first, then
   round the coast the way Route 1 goes, and the highlands last. The directory
   sorts them alphabetically, which puts Austurland first. */
export const REGIONS = [
  'hofudborgarsvaedid', 'reykjanes', 'vesturland', 'vestfirdir',
  'nordurland-vestra', 'nordurland-eystra', 'austurland', 'sudurland', 'halendid'
];

const INFO = new Map(POOL_INFO.map((p) => [p.id, p]));
export const infoFor = (id) => INFO.get(id) ?? null;

/* ---------- small DOM helper ---------- */

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined && child !== false) node.append(child);
  }
  return node;
}

const safeHref = (url) => (/^(https?:\/\/|mailto:|tel:)/i.test(url ?? '') ? url : null);

const card = (cls, labelText, ...children) =>
  h('section', { class: `card pool-card ${cls}` }, h('div', { class: 'label', text: labelText }), ...children);

/* ---------- today, in Iceland ---------- */

/* Iceland keeps UTC all year — no daylight saving since 1968 — so the pool's
   own date and weekday are the UTC ones, wherever the phone reading this
   happens to think it is. */
export function icelandToday(now = new Date()) {
  const iso = now.toISOString().slice(0, 10);
  return { iso, md: iso.slice(5), weekday: now.getUTCDay() };
}

/* Whether a month-day falls inside a season, which can run over New Year:
   winter hours from October to April. null when the season does not say where
   it ends. */
function inSeason(season, md) {
  if (!season?.to) return null;
  return season.from <= season.to
    ? md >= season.from && md <= season.to
    : md >= season.from || md <= season.to;
}

/* The blocks of hours that are in force today. A dated block is in force
   inside its dates. An undated one only when it is the one block of its kind
   with any hours in it, and does not call itself a season: "Sumaropnun" with no
   dates is summer hours that nothing says have ended, and in September marking
   them as today's would be a guess presented as a fact. */
const SEASON_NAME = /sumar|vetur|vetrar|vor(?!\p{L})|haust/iu;

function currentBlocks(hours, md) {
  return hours.filter((block) => {
    if (block.season) return inSeason(block.season, md) === true;
    if (SEASON_NAME.test(block.title ?? '')) return false;
    return hours.filter((other) => other.kind === block.kind && other.rows.length).length <= 1;
  });
}

/* A row applies today by its days, or — for the lagoons that give each line a
   span of dates instead — by its dates. */
const rowToday = (row, today) =>
  row.days ? row.days.includes(today.weekday) : inSeason(row.season, today.md) === true;

const seasonText = (lang, season) =>
  `${formatDayMonth(lang, season.from)} – ${formatDayMonth(lang, season.to)}`;

/* A closure note is shown until the day it ends, and not after: the directory
   leaves them up for months. */
const activeNotes = (notes, iso) => notes.filter((n) => !n.until || n.until >= iso);

/* ---------- words ---------- */

/* "mán–fös", "lau og sun", "alla daga". Monday first, the order the directory
   and every Icelandic timetable write a week in; three days or more in a row
   are a range, fewer are named. */
export function daysLabel(lang, days) {
  if (days.length === 7) return t(lang, 'poolpage.everyDay');
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d));
  const runs = [];
  for (const day of order) {
    const run = runs[runs.length - 1];
    const pos = (d) => (d + 6) % 7;                // Monday 0 … Sunday 6
    if (run && pos(day) === pos(run[run.length - 1]) + 1) run.push(day);
    else runs.push([day]);
  }
  const name = (d) => weekdayName(lang, d, 'short');
  const parts = runs.flatMap((run) =>
    (run.length >= 3 ? [`${name(run[0])}–${name(run[run.length - 1])}`] : run.map(name)));
  return joinList(lang, parts);
}

const EXTRA = { '(úti)': 'poolpage.outdoors', '(inni)': 'poolpage.indoors' };

function timesText(lang, row) {
  if (row.closed) return t(lang, 'poolpage.closed');
  const extra = row.extra ? (EXTRA[row.extra.toLowerCase()] ? t(lang, EXTRA[row.extra.toLowerCase()]) : row.extra) : '';
  return [row.times.join(', '), extra].filter(Boolean).join(' ');
}

function blockTitle(lang, block, hours) {
  if (block.kind === 'aqua') return t(lang, 'facility.aquaAerobics');
  if (block.kind === 'open' && block.season) {
    return block.season.to
      ? seasonText(lang, block.season)
      : t(lang, 'poolpage.fromDate', { date: formatDayMonth(lang, block.season.from) });
  }
  /* An undated block of opening hours needs no heading when it is the only
     one: the card is already called Opening hours. */
  if (block.kind === 'open' && hours.filter((b) => b.kind === 'open').length === 1) return null;
  return block.title;
}

/* What today's opening hours are, when that can be said: one block of opening
   hours in force, a row in it for today, and no closure notice standing. A
   closure without a start date might already have started — Reykholt's pool
   has been shut for renovation since September 2025, under hours that still
   read as open — and "open today 06:30–22:00" above a notice saying it is shut
   is worse than saying nothing. */
function todayLine(lang, info, today) {
  const open = currentBlocks(info.hours.filter((b) => b.kind === 'open'), today.md);
  if (open.length !== 1) return null;
  if (info.hours.some((b) => activeNotes(b.notes, today.iso).some((n) => n.until || n.closure))) return null;
  const rows = open[0].rows.filter((r) => rowToday(r, today));
  if (rows.length !== 1) return null;
  return t(lang, 'poolpage.today', { hours: timesText(lang, rows[0]) });
}

/* ---------- the cards ---------- */

function introCard(lang, { info, pool, visits, today }) {
  /* An id nothing knows gets the sentence saying so, and no count: "no trips
     here yet" would be a claim about a pool that does not exist. */
  if (!info && !pool) {
    return h('section', { class: 'counter pool-intro' },
      h('p', { class: 'note', text: t(lang, 'poolpage.unknown') }));
  }
  const kind = info ? t(lang, `poolpage.kind.${info.kind}`) : null;
  const region = info ? t(lang, `region.${info.region}`) : null;
  const label = [kind, region].filter(Boolean).join(' · ') || t(lang, 'poolpage.kind.pool');

  const visited = visits.count > 0;
  const said = visited
    ? (visits.last
      ? t(lang, 'history.summary', { trips: plural(lang, visits.count, 'trip'), date: formatDate(lang, visits.last, 'full') })
      : plural(lang, visits.count, 'trip'))
    : t(lang, 'poolpage.none');

  /* A count of null is a snapshot too old to say, and says nothing. */
  const visitLine = visits.count === null ? null : h('p', { class: 'pool-visits' },
    h('span', { class: `map-key ${visited ? 'is-done' : 'is-todo'}`, 'aria-hidden': 'true' }),
    h('span', { text: said }),
    visits.card === null ? null
      : h('span', { class: 'pool-tag', text: t(lang, visits.card ? 'poolpage.onCard' : 'pool.forFun') }));

  const line = info && todayLine(lang, info, today);
  return h('section', { class: 'counter pool-intro' },
    h('div', { class: 'label', text: label }),
    info?.address ? h('p', { class: 'pool-address', text: info.address }) : null,
    line ? h('p', { class: 'pool-today', text: line }) : null,
    visitLine,
    info ? null : h('p', { class: 'note', text: t(lang, 'poolpage.noInfo') }));
}

function hoursCard(lang, info, today) {
  if (!info.hours.length) return null;
  const current = new Set(currentBlocks(info.hours, today.md));
  const seasonal = info.hours.some((b) => b.season);

  const blocks = info.hours.map((block) => {
    const title = blockTitle(lang, block, info.hours);
    const now = current.has(block);
    const rows = block.rows.map((row) =>
      h('tr', { class: now && rowToday(row, today) ? 'is-today' : null },
        h('th', { scope: 'row', text: row.days ? daysLabel(lang, row.days) : row.season ? seasonText(lang, row.season) : (row.label ?? '') }),
        h('td', { text: timesText(lang, row) })));
    const notes = activeNotes(block.notes, today.iso);
    if (!rows.length && !notes.length) return null;
    return h('div', { class: `hours-block${now && seasonal && block.season ? ' is-current' : ''}` },
      title ? h('div', { class: 'hours-title' },
        h('span', { text: title }),
        now && seasonal && block.season ? h('span', { class: 'pool-tag', text: t(lang, 'poolpage.current') }) : null) : null,
      rows.length ? h('table', { class: 'hours' }, h('tbody', {}, rows)) : null,
      notes.map((n) => h('p', { class: n.until || n.closure ? 'pool-notice' : 'hours-note', text: n.text })));
  });
  return card('pool-hours', t(lang, 'poolpage.hours'), blocks);
}

function facilitiesCard(lang, info) {
  if (!info.facilities.length && !info.longest) return null;
  return card('pool-facilities', t(lang, 'poolpage.facilities'),
    info.facilities.length
      ? h('ul', { class: 'chips' }, info.facilities.map((f) => h('li', { text: t(lang, `facility.${f}`) })))
      : null,
    info.longest ? h('p', { class: 'note', text: t(lang, 'poolpage.longest', { m: String(info.longest).replace('.', lang === 'en' ? '.' : ',') }) }) : null);
}

/* The price table turned on its side: one group per kind of ticket holder, and
   under it each ticket they can buy. The directory's table is up to six columns
   wide and mostly empty — children swim free, so their row has one price in it
   — which on a phone is a table to scroll sideways through blanks. Only the
   cells that say something are kept. */
function pricesCard(lang, info) {
  const prices = info.prices;
  if (!prices?.sections.length) return null;
  const groups = prices.sections.flatMap((section) => section.rows.map((row) => {
    const pairs = row.slice(1)
      .map((value, i) => [section.head[i] ?? '', value])
      .filter(([, value]) => value);
    if (!pairs.length) return null;
    return h('div', { class: 'price-group' },
      h('div', { class: 'price-who', text: row[0] }),
      h('dl', { class: 'price-list' }, pairs.flatMap(([what, value]) => [
        h('dt', { text: what }),
        h('dd', { text: value })
      ])));
  }));
  const notes = info.priceNotes ?? [];
  return card('pool-prices', prices.year ? t(lang, 'poolpage.pricesYear', { year: prices.year }) : t(lang, 'poolpage.prices'),
    groups,
    notes.length ? h('details', { class: 'price-notes' },
      h('summary', { text: t(lang, 'poolpage.priceNotes') }),
      notes.map((n) => h('p', { text: n }))) : null);
}

function whereCard(lang, { info, pool, visits }) {
  /* Finite rather than placeable(): that is for map rows, which carry null for
     a missing position, while a pool named on the spot simply has no lat. */
  if (!pool || !Number.isFinite(pool.lat) || !Number.isFinite(pool.lon)) return null;
  const row = { id: pool.id, name: pool.name, lat: pool.lat, lon: pool.lon, visits: visits.count };
  const map = h('div', { class: 'map' });
  /* Centred on the pool and cropped: the capital area to a little over half
     its width, the neighbourhood rather than the whole bay; the country to
     under half, which is a region — the Westfjords around Hellulaug, rather
     than a dot at the edge of Iceland. The country outline is simplified to
     half a pixel at full width, so twice as close it is still under one. */
  const win = windowFor(row);
  map.innerHTML = mapHTML(lang, [row], {
    win,
    focus: win ? 0.55 : 0.45,
    aria: t(lang, 'poolpage.mapAria', { name: pool.name })
  });
  const osm = `https://www.openstreetmap.org/?mlat=${pool.lat}&mlon=${pool.lon}#map=16/${pool.lat}/${pool.lon}`;
  return card('pool-where', t(lang, 'poolpage.where'),
    info?.address ? h('p', { class: 'pool-address', text: info.address }) : null,
    map,
    h('p', { class: 'pool-links' }, h('a', { href: osm, target: '_blank', rel: 'noopener', text: t(lang, 'poolpage.openMap') })),
    /* The coastline's licence asks for its credit wherever it is drawn. */
    h('p', { class: 'map-credit' },
      `${t(lang, 'map.creditCoast')}: `,
      h('a', { href: 'https://www.natt.is/en/resources/open-data', target: '_blank', rel: 'noopener', text: 'IS 50V, Náttúrufræðistofnun' }),
      ' · ',
      h('a', { href: 'https://creativecommons.org/licenses/by/4.0/', target: '_blank', rel: 'license noopener', text: 'CC BY 4.0' })));
}

function contactCard(lang, info) {
  const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
  const link = (href, shown) => {
    const safe = safeHref(href);
    if (!safe) return shown;
    const external = /^https?:/.test(safe);
    return h('a', { href: safe, target: external ? '_blank' : null, rel: external ? 'noopener' : null, text: shown });
  };
  const entries = [
    info.phone && ['poolpage.phone', info.phone],
    info.email && ['poolpage.email', `mailto:${info.email}`, info.email],
    info.web && ['poolpage.web', info.web, host(info.web)]
  ].filter(Boolean);
  /* Some pools give two numbers — "467 3155 / 467 3160", "486 5500 og 772
     2484" — and each is its own link, rather than one link that dials both run
     together. Whatever is not a number stays as it was written. */
  const phones = (text) => {
    const numbers = text.match(/\d{3}\s?\d{4}/g) ?? [];
    if (!numbers.length) return text;
    return numbers.flatMap((n, i) => [...(i ? [' · '] : []), link(`tel:${n.replace(/\s/g, '')}`, n)]);
  };
  /* The social pages are named by what they are, so they need no label beside
     them saying it again. */
  const social = [
    info.facebook && link(info.facebook, t(lang, 'poolpage.facebook')),
    info.instagram && link(info.instagram, t(lang, 'poolpage.instagram'))
  ].filter(Boolean);
  if (!entries.length && !social.length) return null;
  return card('pool-contact', t(lang, 'poolpage.contact'),
    entries.length ? h('dl', { class: 'contact-list' }, entries.flatMap(([key, href, shown]) => [
      h('dt', { text: t(lang, key) }),
      h('dd', {}, key === 'poolpage.phone' ? phones(href) : link(href, shown))
    ])) : null,
    social.length ? h('p', { class: 'pool-links' }, social.flatMap((a, i) => (i ? [' · ', a] : [a]))) : null);
}

/* The other pools in the same region, so a page is never a dead end. Drawn with
   the map's two marks, for the same reason the map list has them. */
function moreCard(lang, info, rows) {
  if (!info) return null;
  const others = POOL_INFO
    .filter((p) => p.region === info.region && p.id !== info.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'is'));
  if (!others.length) return null;
  const visitsOf = new Map(rows.map((r) => [r.id, r.visits]));
  return card('pool-more', t(lang, 'poolpage.more', { region: t(lang, `region.${info.region}`) }),
    h('div', { class: 'pool-link-list' }, others.map((p) => linkRow(lang, p.id, p.name, visitsOf.get(p.id) ?? 0))));
}

function linkRow(lang, id, name, visits) {
  return h('a', { class: 'pool-row pool-link', href: poolHref(id) },
    h('span', { class: `map-key ${visits > 0 ? 'is-done' : 'is-todo'}`, 'aria-hidden': 'true' }),
    h('span', { class: 'pool-name', text: name }),
    h('span', { class: 'pool-count', text: visits > 0 ? String(visits) : '' }),
    h('span', { class: 'chev', 'aria-hidden': 'true', text: '›' }));
}

function sourceNote(lang, info) {
  if (!info) return null;
  return h('p', { class: 'rate-note' },
    t(lang, 'poolpage.source', { date: formatDate(lang, `${info.fetched}T12:00:00`, 'full') }), ' ',
    h('a', { href: safeHref(info.source), target: '_blank', rel: 'noopener', text: t(lang, 'poolpage.sourceLink') }),
    lang === 'is' ? '' : ` ${t(lang, 'poolpage.inIcelandic')}`);
}

/* ---------- the page ---------- */

/* `pool` is the app's record of it — built in or named on the spot — and null
   for an id nothing knows. `visits` is { count, last, card }: `last` a date or
   null, `card` true, false or null for not known. `rows` is every pool with its
   visit count, for the list at the foot. */
export function renderPoolPage(root, lang, { id, pool, visits, rows, now = new Date() }) {
  const info = infoFor(id);
  const today = icelandToday(now);
  const cards = [
    introCard(lang, { info, pool, visits, today }),
    info && hoursCard(lang, info, today),
    info && facilitiesCard(lang, info),
    info && pricesCard(lang, info),
    whereCard(lang, { info, pool, visits }),
    info && contactCard(lang, info),
    moreCard(lang, info, rows),
    sourceNote(lang, info)
  ].filter(Boolean);
  root.replaceChildren(...cards);
}

/* Callers skip the rebuild when this has not moved. The private page polls,
   and rebuilding would snap shut the price notes someone had opened. The date
   is in it because the page's idea of today — which row is highlighted, which
   closures still stand — changes at midnight without anything else doing so. */
export function poolPageSignature(lang, { id, pool, visits, rows, now = new Date() }) {
  const region = infoFor(id)?.region;
  const near = region
    ? POOL_INFO.filter((p) => p.region === region).map((p) => `${p.id}~${rows.find((r) => r.id === p.id)?.visits ?? 0}`)
    : [];
  return [lang, id, pool?.name ?? '', visits.count, visits.last ?? '', visits.card, icelandToday(now).iso, ...near].join('|');
}

/* The pools that have a page with the directory's details on it, grouped by
   region — the map page's list. Regions nothing has been fetched for yet are
   not shown at all rather than shown empty. */
export const POOLS_WITH_PAGES = POOL_INFO.length;

export function renderRegionList(container, lang, rows) {
  const visitsOf = new Map(rows.map((r) => [r.id, r.visits]));
  const frag = document.createDocumentFragment();
  for (const region of REGIONS) {
    const pools = POOL_INFO
      .filter((p) => p.region === region)
      .sort((a, b) => a.name.localeCompare(b.name, 'is'));
    if (!pools.length) continue;
    const done = pools.filter((p) => (visitsOf.get(p.id) ?? 0) > 0).length;
    frag.append(
      h('div', { class: 'month' },
        h('span', { text: t(lang, `region.${region}`) }),
        h('span', { class: 'month-count', text: `${done} / ${pools.length}` })),
      ...pools.map((p) => linkRow(lang, p.id, p.name, visitsOf.get(p.id) ?? 0)));
  }
  container.replaceChildren(frag);
}
