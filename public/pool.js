/* A pool's page, read-only. The directory's details ship with the page in
   lib/poolinfo.js; the swimming comes from the same static snapshot the counter
   and the map read — see poolTable() in bin/publish.mjs — so this knows how
   often a pool has been swum in and never on which day. The renderer is the
   private page's, so the two cannot disagree about a pool. */

import { LANGS, LANG_NAMES, detectLang, t } from './lib/i18n.js';
import { allPools } from './lib/pools.js';
import { poolRowsFromTotals, totalsIdentifyPools } from './lib/poolmap.js';
import { renderPoolPage, infoFor } from './lib/poolpage.js';

const LANG_KEY = 'sund.lang';

const id = new URLSearchParams(location.search).get('id') ?? '';

let poolTable = null;
let lang = detectLang();

const el = (name) => document.getElementById(name);
const ui = { back: el('back'), name: el('pool-name'), langSelect: el('lang-select'), pool: el('pool') };

function applyStaticStrings(name) {
  document.documentElement.lang = lang;
  document.title = `Sund · ${name}`;
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

function render() {
  /* A snapshot that cannot say which pools were swum in says nothing about
     visits at all, rather than "no trips here yet" about every pool — the same
     line the map draws. */
  const known = totalsIdentifyPools(poolTable);
  const rows = known ? poolRowsFromTotals(poolTable) : allPools([]).map((p) => ({ ...p, visits: 0 }));
  const pool = rows.find((r) => r.id === id) ?? null;
  const published = known ? poolTable.find((r) => r.id === id) : null;

  const visits = {
    count: known ? (pool?.visits ?? 0) : null,
    last: null,
    /* Whether the card covers a pool is only published for pools swum in —
       the card's own list of pools is not — so a pool nobody has been to says
       nothing either way rather than guess from the built-in list. */
    card: published ? published.card : null
  };

  const name = pool?.name ?? infoFor(id)?.name ?? t(lang, 'pool.label');
  applyStaticStrings(name);
  ui.name.textContent = name;
  renderPoolPage(ui.pool, lang, { id, pool, visits, rows });
}

for (const code of LANGS) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = LANG_NAMES[code];
  ui.langSelect.append(opt);
}
ui.langSelect.value = lang;
ui.langSelect.addEventListener('change', () => {
  if (!LANGS.includes(ui.langSelect.value)) return;
  lang = ui.langSelect.value;
  localStorage.setItem(LANG_KEY, lang);
  render();
});

/* Back to wherever this was opened from, with its scroll position; a page
   opened on its own follows the link to the map. */
ui.back.addEventListener('click', (e) => {
  if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
    e.preventDefault();
    history.back();
  }
});

render();
try {
  const res = await fetch('./state.json', { cache: 'no-cache' });
  const state = res.ok ? await res.json() : null;
  poolTable = Array.isArray(state?.poolTable) ? state.poolTable : null;
} catch { /* no snapshot: the directory's details still stand */ }
render();
