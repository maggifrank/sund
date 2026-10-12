/* The map, read-only. No API and no polling: the data is the same static
   snapshot the counter page reads, so this page is read-only by construction
   rather than by hiding controls.

   Where the private page counts trips, this one is handed the totals — see
   poolTable() in bin/publish.mjs — and the positions come from lib/pools.js,
   which ships with the page. Nothing about which day anyone swam on reaches
   here, so the map says where without saying when.

   The drawing itself is the same lib/poolmap.js the private page uses, so the
   two cannot disagree about what has been swum in. */

import { loadSnapshot, loadAddedPools } from './lib/snapshot.js';
import { LANGS, LANG_NAMES, detectLang, t, plural, formatDate } from './lib/i18n.js';
import {
  poolRowsFromTotals, totalsIdentifyPools, placeable, isAbroad,
  mapHTML, mapSignature, bindMapTooltip, bindMapZoom
} from './lib/poolmap.js';
import { renderRegionList, poolLinkRow, POOLS_WITH_PAGES } from './lib/poolpage.js';
import { poolHref } from './lib/pools.js';

const LANG_KEY = 'sund.lang';

let snapshot = { poolTable: null, generatedAt: null };
/* Pools added to the shared list after lib/pools.js; see loadAddedPools(). */
let added = [];
let lang = detectLang();

/* ---------- elements ---------- */

const el = (id) => document.getElementById(id);
const ui = {
  updated: el('updated'), langSelect: el('lang-select'),
  visitedCard: el('visited-card'), visited: el('visited'),
  progressFill: el('progress-fill'), offMap: el('off-map'),
  countryCard: el('country-card'), country: el('country'),
  noSnapshot: el('no-snapshot'),
  todoCard: el('todo-card'), todoToggle: el('todo-toggle'),
  todoPanel: el('todo-panel'), todoSummary: el('todo-summary'),
  abroadCard: el('abroad-card'), abroadToggle: el('abroad-toggle'),
  abroadPanel: el('abroad-panel'), abroadSummary: el('abroad-summary'),
  pagesCard: el('pages-card'), pagesToggle: el('pages-toggle'),
  pagesPanel: el('pages-panel'), pagesSummary: el('pages-summary')
};

/* ---------- language ---------- */

function applyStaticStrings() {
  document.documentElement.lang = lang;
  document.title = `Sund · ${t(lang, 'map.label')}`;
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(lang, node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(lang, node.dataset.i18nAria));
  }
  for (const node of document.querySelectorAll('[data-i18n-title]')) {
    node.setAttribute('title', t(lang, node.dataset.i18nTitle));
  }
}

function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  localStorage.setItem(LANG_KEY, lang);
  ui.langSelect.value = lang;
  applyStaticStrings();
  mapSig = null;          // the tooltips are written in words; force a rebuild
  todoSig = null;
  abroadSig = null;
  pagesSig = null;
  render();
}

/* ---------- the maps ---------- */

let mapSig = null;
/* A pool on the map opens its own page — see bindMapTooltip(). */
const poolLink = (row) => poolHref(row.id);

function renderMaps(rows) {
  const sig = mapSignature(lang, rows);
  if (sig === mapSig) return;
  mapSig = sig;
  ui.country.innerHTML = mapHTML(lang, rows, { ariaKey: 'map.countryAria', href: poolLink });
  countryZoom.refresh(lang, rows);
}

/* ---------- pool pages ---------- */

let pagesSig = null;

function renderPages(rows) {
  ui.pagesSummary.textContent = plural(lang, POOLS_WITH_PAGES, 'pool');
  const sig = mapSignature(lang, rows);
  if (ui.pagesPanel.hidden || sig === pagesSig) return;
  pagesSig = sig;
  renderRegionList(ui.pagesPanel, lang, rows);
}

/* ---------- what is left ---------- */

let todoSig = null;

function renderTodo(rows) {
  const todo = rows.filter((row) => row.visits === 0);
  ui.todoSummary.textContent = plural(lang, todo.length, 'pool');

  const sig = lang + '|' + todo.map((row) => row.id).join(',');
  if (ui.todoPanel.hidden || sig === todoSig) return;
  todoSig = sig;

  if (!todo.length) {
    ui.todoPanel.innerHTML = `<p class="pool-empty">${t(lang, 'map.todoEmpty')}</p>`;
    return;
  }

  /* Every pool is a link to its own page, the same row the region list below is
     built from — including the ones with no position, which have a page like any
     other and only cannot be drawn. */
  const frag = document.createDocumentFragment();
  for (const row of todo) {
    frag.append(poolLinkRow(lang, {
      id: row.id,
      name: row.name,
      tag: placeable(row) ? null : t(lang, 'map.offMapTag')
    }));
  }
  ui.todoPanel.replaceChildren(frag);
}

/* ---------- abroad ---------- */

/* Pools outside Iceland: swum in on a trip abroad, or added there by hand. The
   map is Iceland's and cannot draw them, and the count above is of Iceland's
   pools, so they are listed here instead — every one of them, swum in or not,
   each with its own page. The card is hidden while there are none, which is
   nearly always. */
let abroadSig = null;

function renderAbroad(abroad) {
  ui.abroadCard.hidden = abroad.length === 0;
  ui.abroadSummary.textContent = plural(lang, abroad.length, 'pool');

  const sig = lang + '|' + abroad.map((row) => `${row.id}~${row.name}~${row.visits}`).join(',');
  if (ui.abroadPanel.hidden || sig === abroadSig) return;
  abroadSig = sig;

  const frag = document.createDocumentFragment();
  for (const row of abroad) {
    frag.append(poolLinkRow(lang, { id: row.id, name: row.name, visits: row.visits }));
  }
  ui.abroadPanel.replaceChildren(frag);
}

/* ---------- render ---------- */

function render() {
  ui.updated.textContent = snapshot.generatedAt
    ? t(lang, 'public.updated', { date: formatDate(lang, snapshot.generatedAt, 'full') })
    : '';

  /* A snapshot that cannot say which pools those swims were at gets a sentence
     saying so and nothing else. Drawing the page anyway would put every pool in
     the country under a red ring and claim the swimming never happened, which
     is worse than an empty page by some distance. */
  const known = totalsIdentifyPools(snapshot.poolTable);
  for (const card of [ui.visitedCard, ui.countryCard, ui.todoCard, ui.abroadCard, ui.pagesCard]) {
    card.hidden = !known;
  }
  ui.noSnapshot.hidden = known;
  if (!known) return;

  const rows = poolRowsFromTotals(snapshot.poolTable, added);
  /* What the page counts is Iceland's pools. One abroad is still a swim, and
     listed on its own below, but it is not one of the pools there are to get
     to, and counting it would let a holiday make the fraction look further
     along than it is. */
  const home = rows.filter((row) => !isAbroad(row));
  const abroad = rows.filter(isAbroad);
  const done = home.filter((row) => row.visits > 0).length;
  const unplaced = home.filter((row) => !placeable(row)).length;

  /* A bare fraction, for the reason the app's pool picker gives: "23 / 131"
     needs no plural and no preposition, so it is right in every language. The
     words go to a screen reader instead. */
  ui.visited.textContent = `${done} / ${home.length}`;
  ui.visited.setAttribute('aria-label', t(lang, 'map.visitedCount', { n: done, total: home.length }));
  ui.progressFill.style.width = `${home.length ? (done / home.length) * 100 : 0}%`;

  ui.offMap.hidden = unplaced === 0;
  ui.offMap.textContent = unplaced === 0
    ? ''
    : t(lang, 'map.offMap', { pools: plural(lang, unplaced, 'pool') });

  renderMaps(rows);
  renderTodo(home);
  renderAbroad(abroad);
  renderPages(rows);
}

/* ---------- wiring ---------- */

for (const code of LANGS) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = LANG_NAMES[code];
  ui.langSelect.append(opt);
}
ui.langSelect.addEventListener('change', () => setLang(ui.langSelect.value));

ui.abroadToggle.addEventListener('click', () => {
  const open = ui.abroadPanel.hidden;
  ui.abroadPanel.hidden = !open;
  ui.abroadToggle.setAttribute('aria-expanded', String(open));
  if (open) { abroadSig = null; render(); }
});

ui.todoToggle.addEventListener('click', () => {
  const open = ui.todoPanel.hidden;
  ui.todoPanel.hidden = !open;
  ui.todoToggle.setAttribute('aria-expanded', String(open));
  if (open) { todoSig = null; render(); }
});

ui.pagesToggle.addEventListener('click', () => {
  const open = ui.pagesPanel.hidden;
  ui.pagesPanel.hidden = !open;
  ui.pagesToggle.setAttribute('aria-expanded', String(open));
  if (open) { pagesSig = null; render(); }
});

/* ---------- start ---------- */

ui.langSelect.value = lang;
applyStaticStrings();
bindMapTooltip(ui.country);
const countryZoom = bindMapZoom(ui.country, {
  maxZoom: 48, controls: document.getElementById('country-zoom'), href: poolLink
});

/* The added pools come after: the page draws without them first rather than
   wait on a second request. */
const addedLoad = loadAddedPools();
try {
  const state = await loadSnapshot();
  if (state) {
    snapshot = {
      poolTable: Array.isArray(state.poolTable) ? state.poolTable : null,
      generatedAt: state.generatedAt ?? null
    };
  }
} catch { /* leave the snapshot empty; render() says so */ }
render();
addedLoad.then((extra) => { if (extra.length) { added = extra; render(); } });
