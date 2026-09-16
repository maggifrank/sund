/* The map, read-only. No API and no polling: the data is the same static
   snapshot the counter page reads, so this page is read-only by construction
   rather than by hiding controls.

   Where the private page counts trips, this one is handed the totals — see
   poolTable() in bin/publish.mjs — and the positions come from lib/pools.js,
   which ships with the page. Nothing about which day anyone swam on reaches
   here, so the map says where without saying when.

   The drawing itself is the same lib/poolmap.js the private page uses, so the
   two cannot disagree about what has been swum in. */

import { LANGS, LANG_NAMES, detectLang, t, plural, formatDate } from './lib/i18n.js';
import {
  poolRowsFromTotals, totalsIdentifyPools, placeable,
  mapHTML, mapSignature, bindMapTooltip, CAPITAL
} from './lib/poolmap.js';
import { renderRegionList, POOLS_WITH_PAGES } from './lib/poolpage.js';
import { poolHref } from './lib/pools.js';

const LANG_KEY = 'sund.lang';

let snapshot = { poolTable: null, generatedAt: null };
let lang = detectLang();

/* ---------- elements ---------- */

const el = (id) => document.getElementById(id);
const ui = {
  updated: el('updated'), langSelect: el('lang-select'),
  visitedCard: el('visited-card'), visited: el('visited'),
  progressFill: el('progress-fill'), offMap: el('off-map'),
  countryCard: el('country-card'), country: el('country'),
  capitalCard: el('capital-card'), capital: el('capital'),
  noSnapshot: el('no-snapshot'),
  todoCard: el('todo-card'), todoToggle: el('todo-toggle'),
  todoPanel: el('todo-panel'), todoSummary: el('todo-summary'),
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
  pagesSig = null;
  render();
}

/* ---------- the maps ---------- */

let mapSig = null;

function renderMaps(rows) {
  const sig = mapSignature(lang, rows);
  if (sig === mapSig) return;
  mapSig = sig;
  const href = (row) => poolHref(row.id);
  ui.country.innerHTML = mapHTML(lang, rows, { locator: CAPITAL, ariaKey: 'map.countryAria', href });
  ui.capital.innerHTML = mapHTML(lang, rows, { win: CAPITAL, ariaKey: 'map.capitalAria', href });
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

  const frag = document.createDocumentFragment();
  for (const row of todo) {
    /* Nodes rather than an HTML string: a pool name can have been typed by hand
       at a check-in, and textContent keeps that out of the parser. */
    const node = document.createElement('div');
    node.className = 'pool-row map-todo-row';
    node.innerHTML = '<span class="map-key is-todo" aria-hidden="true"></span>' +
                     '<span class="pool-name"></span>';
    node.querySelector('.pool-name').textContent = row.name;
    if (!placeable(row)) {
      const tag = document.createElement('span');
      tag.className = 'pool-tag';
      tag.textContent = t(lang, 'map.offMapTag');
      node.append(tag);
    }
    frag.append(node);
  }
  ui.todoPanel.replaceChildren(frag);
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
  for (const card of [ui.visitedCard, ui.countryCard, ui.capitalCard, ui.todoCard, ui.pagesCard]) {
    card.hidden = !known;
  }
  ui.noSnapshot.hidden = known;
  if (!known) return;

  const rows = poolRowsFromTotals(snapshot.poolTable);
  const done = rows.filter((row) => row.visits > 0).length;
  const unplaced = rows.filter((row) => !placeable(row)).length;

  /* A bare fraction, for the reason the app's pool picker gives: "23 / 131"
     needs no plural and no preposition, so it is right in every language. The
     words go to a screen reader instead. */
  ui.visited.textContent = `${done} / ${rows.length}`;
  ui.visited.setAttribute('aria-label', t(lang, 'map.visitedCount', { n: done, total: rows.length }));
  ui.progressFill.style.width = `${rows.length ? (done / rows.length) * 100 : 0}%`;

  ui.offMap.hidden = unplaced === 0;
  ui.offMap.textContent = unplaced === 0
    ? ''
    : t(lang, 'map.offMap', { pools: plural(lang, unplaced, 'pool') });

  renderMaps(rows);
  renderTodo(rows);
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
bindMapTooltip(ui.capital);

try {
  const res = await fetch('./state.json', { cache: 'no-cache' });
  const state = res.ok ? await res.json() : null;
  if (state) {
    snapshot = {
      poolTable: Array.isArray(state.poolTable) ? state.poolTable : null,
      generatedAt: state.generatedAt ?? null
    };
  }
} catch { /* leave the snapshot empty; render() says so */ }
render();
