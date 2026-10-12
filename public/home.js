/* The public front page: the pools, not anyone's swimming.

   Nothing is fetched. The positions are the built-in survey in lib/pools.js and
   the details are lib/poolinfo.js, both of which ship with the page, and every
   row carries `visits: null` — no one's count at all — which the map and the
   list draw as a plain pool rather than as one not yet swum in. Pools abroad
   are left out: this is a map of Iceland, and the few abroad are only there
   because someone swam in them. */

import { LANGS, LANG_NAMES, detectLang, t, plural } from './lib/i18n.js';
import { mapHTML, bindMapTooltip, bindMapZoom } from './lib/poolmap.js';
import { renderRegionList, POOLS_WITH_PAGES } from './lib/poolpage.js';
import { BUILT_IN, poolHref } from './lib/pools.js';
import { isCloud, signedIn } from './lib/cloud.js';

const LANG_KEY = 'sund.lang';

const ROWS = BUILT_IN.map((p) => ({ ...p, visits: null }));

let lang = detectLang();

const el = (id) => document.getElementById(id);
const ui = {
  langSelect: el('lang-select'), country: el('country'),
  pagesPanel: el('pages-panel'), pagesSummary: el('pages-summary')
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

function render() {
  ui.country.innerHTML = mapHTML(lang, ROWS, {
    aria: t(lang, 'home.mapAria', { pools: plural(lang, ROWS.length, 'pool') }),
    href: poolLink
  });
  countryZoom.refresh(lang, ROWS);
  ui.pagesSummary.textContent = plural(lang, POOLS_WITH_PAGES, 'pool');
  renderRegionList(ui.pagesPanel, lang, ROWS);
}

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
