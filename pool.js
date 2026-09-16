/* A pool's page. Read-only, like the map: the directory's details come with the
   page in lib/poolinfo.js, and the swimming comes from the same state the
   counter page writes — its offline cache for the first paint, queue included,
   and then the server on the same poll as every other view of the count.

   This is the one page allowed to say *when* a pool was last swum in. The
   public copy of it is handed totals and cannot. */

import { emptyState, normalize, applyQueue, poolIsOnCard, tripAt } from './lib/state.js';
import { LANGS, LANG_NAMES, detectLang, t } from './lib/i18n.js';
import { allPools } from './lib/pools.js';
import { poolRows } from './lib/poolmap.js';
import { renderPoolPage, poolPageSignature, infoFor } from './lib/poolpage.js';
import { attachTapHaptics } from './lib/celebrate.js';

const CACHE_KEY = 'sund.cache.v2';
const TOKEN_KEY = 'sund.token';
const LANG_KEY = 'sund.lang';
const POLL_MS = 15000;

const id = new URLSearchParams(location.search).get('id') ?? '';

let confirmed = emptyState();
let queue = [];
let token = localStorage.getItem(TOKEN_KEY) || '';
let lang = detectLang();

const view = () => applyQueue(confirmed, queue);

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || null;
  } catch {
    return null;
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
    confirmed = normalize(await api('GET', '/api/state'));
    /* Re-read rather than keep the copy from startup, for the reason map.js
       gives: the counter page drains the queue as it syncs. */
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

const el = (name) => document.getElementById(name);
const ui = { back: el('back'), name: el('pool-name'), langSelect: el('lang-select'), pool: el('pool') };

function applyStaticStrings(name) {
  document.documentElement.lang = lang;
  document.title = `Sund · ${name}`;
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
  sig = null;
  render();
}

/* ---------- render ---------- */

let sig = null;

function render() {
  const state = view();
  const pool = allPools(state.pools).find((p) => p.id === id) ?? null;
  const rows = poolRows(state);
  const here = state.trips.filter((trip) => trip.pool === id);
  const last = here.map(tripAt).sort().at(-1) ?? null;
  /* Asked against every pool the app knows rather than the saved ones alone.
     A pool nobody has checked in at is in no saved record, and to
     poolIsOnCard() an id it cannot find is one to count rather than drop —
     right for a trip, and wrong for a page asking about a pool it knows
     perfectly well is not on the card. */
  const visits = {
    count: here.length,
    last,
    card: pool ? poolIsOnCard(id, allPools(state.pools), state.settings) : null
  };

  const name = pool?.name ?? infoFor(id)?.name ?? t(lang, 'pool.label');
  const args = { id, pool, visits, rows };
  const next = poolPageSignature(lang, args);
  if (next === sig) return;
  sig = next;

  applyStaticStrings(name);
  ui.name.textContent = name;
  renderPoolPage(ui.pool, lang, args);
}

/* ---------- wiring ---------- */

for (const code of LANGS) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = LANG_NAMES[code];
  ui.langSelect.append(opt);
}
ui.langSelect.addEventListener('change', () => setLang(ui.langSelect.value));

/* Back to wherever this was opened from — the map, the pool table, another
   pool's page — rather than always to the map, and with the scroll position
   that page was left at. A page opened on its own has nowhere to go back to
   and follows the link instead. */
ui.back.addEventListener('click', (e) => {
  if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
    e.preventDefault();
    history.back();
  }
});

/* ---------- start ---------- */

ui.langSelect.value = lang;
attachTapHaptics(ui.back, { radius: '10px' });
loadCache();
render();
poll({ force: true });

setInterval(poll, POLL_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) poll({ force: true });
});
window.addEventListener('online', () => poll({ force: true }));
