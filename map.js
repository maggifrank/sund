/* The map page. Read-only: it draws the same state the counter page writes, and
   has nothing of its own to save.

   It reads that page's offline cache for the first paint — including the queue,
   through the same applyQueue() the counter uses, so a swim logged at a new pool
   with no signal turns that pool green here too — and then polls the server like
   every other view of the shared count. It never writes the cache back: the
   queue in there belongs to the page that owns the + button, and a read-only
   page has no business overwriting it. */

import { emptyState, normalize, applyQueue } from './lib/state.js';
import { LANGS, LANG_NAMES, detectLang, t, plural } from './lib/i18n.js';
import {
  poolRows, placeable, mapHTML, mapSignature, bindMapTooltip, bindMapZoom
} from './lib/poolmap.js';
import { renderRegionList, POOLS_WITH_PAGES } from './lib/poolpage.js';
import { poolHref } from './lib/pools.js';
import { attachTapHaptics, attachTapHapticsAll } from './lib/celebrate.js';

const CACHE_KEY = 'sund.cache.v2';
const TOKEN_KEY = 'sund.token';
const LANG_KEY = 'sund.lang';
const POLL_MS = 15000;

let confirmed = emptyState();
let queue = [];
let token = localStorage.getItem(TOKEN_KEY) || '';
let lang = detectLang();

const view = () => applyQueue(confirmed, queue);

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || null;
  } catch {
    return null;                       // start empty and wait for the server
  }
}

function loadCache() {
  const raw = readCache();
  if (!raw) return;
  confirmed = normalize(raw.confirmed);
  queue = Array.isArray(raw.queue) ? raw.queue : [];
}

/* ---------- network ---------- */

async function api(method, path) {
  const res = await fetch(path, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (res.status === 401) throw Object.assign(new Error('locked'), { locked: true });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function poll({ force = false } = {}) {
  if (document.hidden && !force) return;
  try {
    const next = normalize(await api('GET', '/api/state'));
    confirmed = next;
    /* Re-read the queue rather than keep the copy loaded at startup: the counter
       page drains it as it syncs and saves after each one, so the stored queue
       is the live answer to what has not reached the server yet. There is a
       window inside its flush() where an op is on the server and still in the
       saved queue, and this page would then apply it twice — which can only
       ever add a trip to a pool that really was swum in, never colour one that
       was not, and it is gone by the next poll. */
    queue = readCache()?.queue ?? [];
    render();
  } catch (err) {
    if (err.locked) askForToken();
  }
}

function askForToken() {
  const entered = prompt(t(lang, 'settings.tokenPrompt'), '');
  if (entered === null) return;
  token = entered.trim();
  localStorage.setItem(TOKEN_KEY, token);
  poll({ force: true });
}

/* ---------- elements ---------- */

const el = (id) => document.getElementById(id);
const ui = {
  back: el('back'), langSelect: el('lang-select'),
  visited: el('visited'), progressFill: el('progress-fill'), offMap: el('off-map'),
  country: el('country'),
  todoToggle: el('todo-toggle'), todoPanel: el('todo-panel'), todoSummary: el('todo-summary'),
  pagesToggle: el('pages-toggle'), pagesPanel: el('pages-panel'), pagesSummary: el('pages-summary')
};

/* ---------- language ---------- */

function applyStaticStrings() {
  document.documentElement.lang = lang;
  /* Two pages both called "Sund" are two identical browser tabs. Set here
     rather than in the markup so it follows the language like everything
     else. */
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
/* A pool on the map opens its own page — see bindMapTooltip(). */
const poolLink = (row) => poolHref(row.id);

function renderMaps(rows) {
  const sig = mapSignature(lang, rows);
  if (sig === mapSig) return;
  mapSig = sig;
  ui.country.innerHTML = mapHTML(lang, rows, { ariaKey: 'map.countryAria', href: poolLink });
  /* Straight back to wherever the map was zoomed to — a redraw is new data or a
     new language, never a reason to lose your place. */
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

/* The table view of the same two colours, and the only place the pools with no
   position on file can be seen at all — they are listed like any other, with a
   tag saying why they are not on the map above. */
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
    /* Nodes rather than an HTML string: a pool name can be typed by hand at a
       check-in, and textContent keeps that out of the parser. */
    const el = document.createElement('div');
    el.className = 'pool-row map-todo-row';
    el.innerHTML = '<span class="map-key is-todo" aria-hidden="true"></span>' +
                   '<span class="pool-name"></span>';
    el.querySelector('.pool-name').textContent = row.name;
    if (!placeable(row)) {
      const tag = document.createElement('span');
      tag.className = 'pool-tag';
      tag.textContent = t(lang, 'map.offMapTag');
      el.append(tag);
    }
    frag.append(el);
  }
  ui.todoPanel.replaceChildren(frag);
}

/* ---------- render ---------- */

function render() {
  const rows = poolRows(view());
  const done = rows.filter((row) => row.visits > 0).length;
  const unplaced = rows.filter((row) => !placeable(row)).length;

  /* A bare fraction, for the reason the pool picker's count gives: "23 / 126"
     needs no plural and no preposition, so it is right in every language. The
     words go to a screen reader, where the numbers sit after a colon and
     nothing has to agree with them either. */
  ui.visited.textContent = `${done} / ${rows.length}`;
  ui.visited.setAttribute('aria-label', t(lang, 'map.visitedCount', { n: done, total: rows.length }));
  ui.progressFill.style.width = `${rows.length ? (done / rows.length) * 100 : 0}%`;

  /* Say outright when the map is not the whole list. Every pool in the survey
     has a position now, so this line usually says nothing at all — but a pool
     named at a check-in with no fix to hand has none, and a page that quietly
     drew 126 of 127 would be claiming a completeness it has not got. Those are
     in the list below instead, tagged. */
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
/* Close enough that every pool in the country stands on its own: at 32 times
   two pools in Reykjanesbær still share a badge, at 48 nothing does. */
const countryZoom = bindMapZoom(ui.country, {
  maxZoom: 48, controls: document.getElementById('country-zoom'), href: poolLink
});
/* The same borrowed tick every other control in the app has, on the things here
   that can be pressed. */
attachTapHaptics(ui.back, { radius: '10px' });
attachTapHaptics(ui.todoToggle, { radius: 'var(--radius)', fill: 'block' });
attachTapHaptics(ui.pagesToggle, { radius: 'var(--radius)', fill: 'block' });
attachTapHapticsAll(document.querySelectorAll('.map-zoom-btn'), { radius: '8px' });
loadCache();
render();
poll({ force: true });

setInterval(poll, POLL_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) poll({ force: true });
});
window.addEventListener('online', () => poll({ force: true }));
