/* Read-only Sund. No API, no writes — the data is a static snapshot written
   at publish time, so this page is read-only by construction rather than by
   hiding buttons. All the arithmetic, wording and the chart come from the same
   lib/ modules the private app uses, so the two cannot disagree. */

import { loadSnapshot, loadRates } from './lib/snapshot.js';
import { isCloud, addedPools } from './lib/cloud.js';
import { normalize } from './lib/state.js';
import { cardUi, renderCardFigures } from './lib/cardview.js';
import { loadPrices, doorTotal } from './lib/poolprice.js';
import { LANGS, LANG_NAMES, detectLang, t, plural, formatDate } from './lib/i18n.js';
import { money, isConverted, rateString, currencyFor } from './lib/money.js';
import {
  chartHTML, chartSignature, weekdayHTML, weekdaySignature,
  bindChartTooltip, bindChartHighlight
} from './lib/chart.js';
import { renderPoolTable } from './lib/pooltable.js';

const LANG_KEY = 'sund.lang';

let snapshot = { monthTrips: [], weekdayTrips: [], settings: null, generatedAt: null, totals: null, poolTable: null };
let rates = null;
let lang = detectLang();
/* Single entry prices by pool, for a punch card or no card. null until loaded. */
let prices = null;

const el = (id) => document.getElementById(id);
const ui = {
  trips: el('trips'), updated: el('updated'),
  beLabel: el('be-label'), costPerTrip: el('cost-per-trip'), costPerTripSub: el('cost-per-trip-sub'),
  progressFill: el('progress-fill'), breakevenLine: el('breakeven-line'), breakevenNote: el('breakeven-note'),
  cardPerTrip: el('card-per-trip'), cardPerTripSub: el('card-per-trip-sub'),
  delta: el('delta'), deltaSub: el('delta-sub'),
  langSelect: el('lang-select'), chart: el('chart'), weekday: el('weekday'),
  rateNote: el('rate-note'), offCard: el('off-card'),
  season: el('season'),
  pools: el('pools'), poolTable: el('pool-table')
};
const cardFigures = cardUi(el);

/* ---------- language ---------- */

function applyStaticStrings() {
  document.documentElement.lang = lang;
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
  chartSig = null;
  weekdaySig = null;
  render();
}

/* ---------- pool table ---------- */

/* Totalled at publish time — the page's own trips are card-only and carry no
   pool, so it could not count these for itself. A snapshot published before
   the table existed simply has no section. */
function renderPools(rows) {
  ui.pools.hidden = !rows?.length;
  if (rows?.length) renderPoolTable(ui.poolTable, lang, rows);
}

/* ---------- chart & history ---------- */

let chartSig = null;

function renderChart(trips) {
  const sig = chartSignature(lang, trips);
  if (sig === chartSig) return;
  chartSig = sig;
  ui.chart.innerHTML = chartHTML(lang, trips);
}

let weekdaySig = null;

function renderWeekday(trips) {
  const sig = weekdaySignature(lang, trips);
  if (sig === weekdaySig) return;
  weekdaySig = sig;
  ui.weekday.innerHTML = weekdayHTML(lang, trips);
}

/* ---------- render ---------- */

function renderRateNote() {
  if (currencyFor(lang) === 'ISK') {
    ui.rateNote.hidden = true;
    ui.rateNote.textContent = '';
    return;
  }
  ui.rateNote.hidden = false;
  ui.rateNote.textContent = isConverted(lang, rates)
    ? t(lang, 'rate.note', {
        date: formatDate(lang, `${rates.date}T12:00:00Z`, 'full'),
        rate: rateString(lang, rates),
        code: currencyFor(lang)
      })
    : t(lang, 'rate.unavailable');
}

function render() {
  const s = snapshot.settings;
  if (!s) return;
  /* Every figure below the counter is about the card, and comes from the
     published totals: the snapshot carries no swims to count. */
  const n = snapshot.totals?.counted ?? 0;

  ui.updated.textContent = snapshot.generatedAt
    ? t(lang, 'public.updated', { date: formatDate(lang, snapshot.generatedAt, 'full') })
    : '';

  ui.trips.textContent = n;

  /* The big number is card swims only — the same split the app makes. Totals are
     published as counts, so an older snapshot without them simply hides this. */
  const totals = snapshot.totals;
  if (!totals || !totals.all || s.cardType === 'none') {
    ui.offCard.hidden = true;
    ui.offCard.textContent = '';
  } else {
    ui.offCard.hidden = false;
    const parts = [t(lang, 'counter.total', { trips: plural(lang, totals.all, 'trip') })];
    if (totals.outsideSeason) {
      parts.push(t(lang, 'counter.outsideSeason', { trips: plural(lang, totals.outsideSeason, 'trip') }));
    }
    if (totals.offCard) {
      parts.push(t(lang, 'counter.offCard', { trips: plural(lang, totals.offCard, 'trip') }));
    }
    ui.offCard.textContent = parts.join(' · ');
  }

  /* What the card's swims came to at the door, from the published pool table:
     a count per pool, which is all the sum needs. */
  const door = prices && s.cardType !== 'year'
    ? doorTotal((snapshot.poolTable ?? []).filter((r) => r.card !== false), prices)
    : null;
  renderCardFigures(cardFigures, { lang, s, n, rates, door });

  renderRateNote();
  renderPools(snapshot.poolTable);
  renderChart(snapshot.monthTrips);
  renderWeekday(snapshot.weekdayTrips);
}

/* The charts are drawn from a list of trips, and the snapshot publishes only
   how many fell in each month and on each weekday — see sums() in
   bin/publish.mjs. So each chart gets a stand-in list that adds up to the same
   counts: the 15th of the month for the monthly chart, and a day of the right
   weekday for the pie. They are never shown as dates. A snapshot from before
   the sums existed still carries its trips, and those are used as they are. */
function standIns(state, trips) {
  if (!state.byMonth || !Array.isArray(state.byWeekday)) return { monthTrips: trips, weekdayTrips: trips };
  const monthTrips = [];
  for (const key of Object.keys(state.byMonth).sort()) {
    const [y, m] = key.split('-').map(Number);
    const at = new Date(y, m - 1, 15, 12).toISOString();
    for (let i = 0; i < state.byMonth[key]; i++) monthTrips.push({ at });
  }
  const weekdayTrips = [];
  state.byWeekday.forEach((count, day) => {
    const at = new Date(2024, 0, 7 + day, 12).toISOString();   // 7 January 2024 was a Sunday
    for (let i = 0; i < count; i++) weekdayTrips.push({ at });
  });
  return { monthTrips, weekdayTrips };
}

/* ---------- start ---------- */

for (const code of LANGS) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = LANG_NAMES[code];
  ui.langSelect.append(opt);
}
ui.langSelect.value = lang;
ui.langSelect.addEventListener('change', () => setLang(ui.langSelect.value));

applyStaticStrings();
bindChartTooltip(ui.chart);
bindChartHighlight(ui.chart);
bindChartHighlight(ui.weekday);

const [state, rateData] = await Promise.all([loadSnapshot(), loadRates()]);
rates = rateData;
/* On Sund 2.0 any address can be a username, so one that is not, or whose
   page is switched off, says so instead of drawing an empty counter. */
if (!state && isCloud()) showMissing();
if (state) {
  const clean = normalize(state);
  snapshot = {
    ...standIns(state, clean.trips), settings: clean.settings,
    generatedAt: state.generatedAt ?? null,
    totals: state.totals ?? null,
    poolTable: Array.isArray(state.poolTable) ? state.poolTable : null
  };
}
render();
if (snapshot.settings && snapshot.settings.cardType !== 'year') {
  loadPrices(isCloud() ? await addedPools().catch(() => []) : [])
    .then((map) => { prices = map; render(); })
    .catch(() => {});
}

function showMissing() {
  const card = document.createElement('section');
  card.className = 'card missing';
  const title = document.createElement('h2');
  title.textContent = t(lang, 'public.missingTitle');
  const text = document.createElement('p');
  text.className = 'home-lead';
  text.textContent = t(lang, 'public.missing');
  const home = document.createElement('a');
  home.className = 'login-btn';
  home.href = '/';
  home.textContent = t(lang, 'public.home');
  card.append(title, text, home);
  const main = document.querySelector('main');
  main.replaceChildren(...[main.querySelector('header'), card].filter(Boolean));
  document.title = `Sund · ${t(lang, 'public.missingTitle')}`;
}
