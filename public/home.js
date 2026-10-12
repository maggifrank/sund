/* The public front page: the pools, not anyone's swimming.

   The positions are the built-in survey in lib/pools.js and the details are
   lib/poolinfo.js, both of which ship with the page, and every row carries
   `visits: null` — no one's count at all — which the map and the list draw as
   a plain pool rather than as one not yet swum in. Pools added to the shared
   list since (the only thing fetched) join the map, or, abroad, where the map
   of Iceland cannot draw them, a list of their own. */

import { LANGS, LANG_NAMES, detectLang, t, plural } from './lib/i18n.js';
import { mapHTML, bindMapTooltip, bindMapZoom } from './lib/poolmap.js';
import { renderRegionList, poolLinkRow, infoFor, POOLS_WITH_PAGES } from './lib/poolpage.js';
import { BUILT_IN, allPools, poolHref } from './lib/pools.js';
import { isAbroad } from './lib/poolmap.js';
import { loadAddedPools, loadClosedPools } from './lib/snapshot.js';
import { isCloud, signedIn } from './lib/cloud.js';

const LANG_KEY = 'sund.lang';

const ROWS = BUILT_IN.map((p) => ({ ...p, visits: null }));
let added = [];
/* Pools an admin has marked closed: off the map and the list. */
let closed = new Set();

let lang = detectLang();

const el = (id) => document.getElementById(id);
const ui = {
  langSelect: el('lang-select'), country: el('country'),
  pagesPanel: el('pages-panel'), pagesSummary: el('pages-summary'),
  abroadCard: el('abroad-card'), abroadToggle: el('abroad-toggle'),
  abroadPanel: el('abroad-panel'), abroadSummary: el('abroad-summary')
};

function applyStaticStrings() {
  document.documentElement.lang = lang;
  document.title = 'Sund';
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(lang, node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(lang, node.dataset.i18nAria));
  }
  for (const node of document.querySelectorAll('[data-i18n-title]')) {
    node.setAttribute('title', t(lang, node.dataset.i18nTitle));
  }
  /* Someone already signed in goes straight to their count. */
  const login = document.querySelector('.login-btn');
  if (login && isCloud() && signedIn()) {
    login.href = '/app/';
    login.textContent = t(lang, 'home.open');
  }
}

const poolLink = (row) => poolHref(row.id);

/* The built-in pools, and any in Iceland added to the shared list since. */
const mapRows = () => [...ROWS, ...added
  .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && !isAbroad(p))
  .map((p) => ({ ...p, visits: null }))].filter((p) => !closed.has(p.id));

function render() {
  const rows = mapRows();
  ui.country.innerHTML = mapHTML(lang, rows, {
    aria: t(lang, 'home.mapAria', { pools: plural(lang, rows.length, 'pool') }),
    href: poolLink
  });
  countryZoom.refresh(lang, rows);
  ui.pagesSummary.textContent = plural(lang, POOLS_WITH_PAGES - [...closed].filter((id) => infoFor(id)).length, 'pool');
  renderRegionList(ui.pagesPanel, lang, ROWS, { closed });
  renderAbroad();
}

function renderAbroad() {
  const abroad = allPools(added).filter((p) => isAbroad(p) && !closed.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'is'));
  ui.abroadCard.hidden = abroad.length === 0;
  ui.abroadSummary.textContent = plural(lang, abroad.length, 'pool');
  ui.abroadPanel.replaceChildren(...abroad.map((p) => poolLinkRow(lang, { id: p.id, name: p.name, visits: null })));
}

ui.abroadToggle.addEventListener('click', () => {
  const open = ui.abroadPanel.hidden;
  ui.abroadPanel.hidden = !open;
  ui.abroadToggle.setAttribute('aria-expanded', String(open));
});

for (const code of LANGS) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = LANG_NAMES[code];
  ui.langSelect.append(opt);
}
ui.langSelect.addEventListener('change', () => {
  if (!LANGS.includes(ui.langSelect.value)) return;
  lang = ui.langSelect.value;
  localStorage.setItem(LANG_KEY, lang);
  applyStaticStrings();
  render();
});

ui.langSelect.value = lang;
applyStaticStrings();
bindMapTooltip(ui.country);
const countryZoom = bindMapZoom(ui.country, {
  maxZoom: 48, controls: el('country-zoom'), href: poolLink
});
render();
loadAddedPools().then((extra) => { if (extra.length) { added = extra.map(({ info, ...pool }) => pool); render(); } });
loadClosedPools().then((ids) => { if (ids.size) { closed = ids; render(); } });
