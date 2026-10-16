/* The figures under the counter, for the card being looked at. Shared by the
   app (app.js) and the public page (public/app.js), which draw the same
   markup from different data: the app counts its own swims, the public page
   reads published totals.

   What shows depends on how the person pays (settings.cardType, see
   lib/state.js):

     none   just the counter, and what the swims came to at the door: each one
            at that pool's single entry price (lib/poolprice.js).
     year   the year card's figures: cost per swim so far, break-even against
            punch cards, and how far ahead or behind it is.
     punch  swims left on the punch card, what a swim costs on it, and what it
            has saved against paying at the door.

   `n` is the swims that count for the card. `door` is what they came to at
   the door, { total, priced, unpriced }, or null while the prices load. */

import {
  costPerTrip, cardPerTrip, breakEvenTrips, cashBreakEvenTrips, punchStatus, dateFromKey
} from './state.js';
import { t, plural, ordinal, formatDate } from './i18n.js';
import { money } from './money.js';

export function cardUi(el) {
  return {
    tripsLabel: el('trips-label'),
    hero: el('hero-card'), cptLabel: el('cpt-label'),
    costPerTrip: el('cost-per-trip'), costPerTripSub: el('cost-per-trip-sub'),
    be: el('be-card'), beLabel: el('be-label'), progressFill: el('progress-fill'),
    breakevenLine: el('breakeven-line'), breakevenNote: el('breakeven-note'),
    stats: el('stats'), stat1Label: el('stat-1-label'), stat2Label: el('stat-2-label'),
    cardPerTrip: el('card-per-trip'), cardPerTripSub: el('card-per-trip-sub'),
    delta: el('delta'), deltaSub: el('delta-sub'),
    season: el('season')
  };
}

/* Either bound alone is a complete statement, so each combination gets its
   own sentence. A punch card's dates are said as a card's, not a year's. */
export function seasonLine(lang, s) {
  if (s.cardType === 'none') return null;
  const from = s.seasonStart ? formatDate(lang, dateFromKey(s.seasonStart), 'full') : null;
  const to = s.seasonEnd ? formatDate(lang, dateFromKey(s.seasonEnd), 'full') : null;
  const [range, since, until] = s.cardType === 'punch'
    ? ['season.cardRange', 'season.cardFrom', 'season.cardUntil']
    : ['season.range', 'season.from', 'season.until'];
  if (from && to) return t(lang, range, { from, to });
  if (from) return t(lang, since, { from });
  if (to) return t(lang, until, { to });
  return null;
}

function signed(ui, lang, value, rates, good, bad) {
  ui.delta.textContent = value === null ? '—' : (value >= 0 ? '+' : '−') + money(lang, Math.abs(value), rates);
  ui.delta.classList.toggle('is-good', value !== null && value >= 0);
  ui.delta.classList.toggle('is-bad', value !== null && value < 0);
  ui.deltaSub.textContent = value === null ? '' : t(lang, value >= 0 ? good : bad);
}

export function renderCardFigures(ui, { lang, s, n, rates, door }) {
  const type = s.cardType ?? 'year';
  ui.hero.hidden = false;
  ui.be.hidden = type !== 'year';
  ui.stats.hidden = type === 'none';

  const season = seasonLine(lang, s);
  ui.season.hidden = season === null;
  ui.season.textContent = season ?? '';

  if (type === 'none') {
    ui.tripsLabel.textContent = t(lang, 'counter.labelNone');
    ui.cptLabel.textContent = t(lang, 'door.label');
    ui.costPerTrip.textContent = door ? money(lang, door.total, rates) : '—';
    ui.costPerTrip.classList.toggle('is-empty', !door || door.priced === 0);
    ui.costPerTripSub.textContent = !door ? ''
      : door.unpriced
        ? t(lang, 'door.subSome', { priced: plural(lang, door.priced, 'trip'), unpriced: plural(lang, door.unpriced, 'trip') })
        : t(lang, 'door.sub');
    return;
  }

  const perCardTrip = cardPerTrip(s);
  ui.stat1Label.textContent = t(lang, 'stat.cardPerTrip');
  ui.cardPerTrip.textContent = money(lang, perCardTrip, rates);
  ui.cardPerTripSub.textContent = t(lang, 'stat.cardPerTripSub', {
    price: money(lang, s.cardPrice, rates), trips: plural(lang, s.cardTrips, 'trip')
  });
  ui.stat2Label.textContent = t(lang, 'stat.delta');

  if (type === 'punch') {
    const { card, used, left } = punchStatus(s, n);
    ui.tripsLabel.textContent = t(lang, 'counter.labelPunch');
    ui.cptLabel.textContent = t(lang, 'punch.left');
    ui.costPerTrip.textContent = String(left);
    ui.costPerTrip.classList.remove('is-empty');
    ui.costPerTripSub.textContent = t(lang, 'punch.sub', { card: ordinal(lang, card), used, total: s.cardTrips });
    /* Against the door: the same swims at each pool's single entry price,
       less what they cost on the card. Swims at a pool with no price listed
       are left out of both sides. */
    signed(ui, lang, door ? door.total - perCardTrip * door.priced : null, rates, 'stat.savedDoor', 'stat.owedDoor');
    return;
  }

  ui.tripsLabel.textContent = t(lang, 'counter.label');
  ui.cptLabel.textContent = t(lang, 'cost.label');
  const be = breakEvenTrips(s);
  const cashBe = cashBreakEvenTrips(s);
  const cards = Math.ceil(s.membership / s.cardPrice);

  const cpt = costPerTrip(s, n);
  ui.costPerTrip.textContent = cpt === null ? '—' : money(lang, cpt, rates);
  ui.costPerTrip.classList.toggle('is-empty', cpt === null);
  ui.costPerTripSub.textContent = cpt === null
    ? t(lang, 'cost.unused', { total: money(lang, s.membership, rates) })
    : t(lang, 'cost.sub', { total: money(lang, s.membership, rates), trips: plural(lang, n, 'trip') });

  ui.beLabel.textContent = t(lang, 'be.label', { n: s.cardTrips });
  ui.progressFill.style.width = `${Math.min(100, (n / be) * 100)}%`;
  if (n >= be) {
    ui.breakevenLine.textContent = n === be
      ? t(lang, 'be.exact')
      : t(lang, 'be.past', { trips: plural(lang, n - be, 'trip') });
  } else {
    ui.breakevenLine.textContent = n === 0
      ? t(lang, 'be.start', { trips: plural(lang, be, 'trip') })
      : t(lang, 'be.toGo', { left: plural(lang, be - n, 'trip'), total: be });
  }
  ui.breakevenNote.textContent = t(lang, 'be.note', {
    cardTrips: s.cardTrips, perTrip: money(lang, perCardTrip, rates), be, cashBe,
    cards: ordinal(lang, cards)      // "3." in is/pl, "3rd" in en
  });

  signed(ui, lang, perCardTrip * n - s.membership, rates, 'stat.saved', 'stat.owed');
}

/* The card's fields in ⚙ and in the welcome wizard, for how it pays. With no
   card there is nothing to fill in. A year card has its price, dates and pools,
   and the punch card it is compared with. A punch card has its own price and
   swims, dates and pools, and no year card price. Hidden fields keep their
   values, so switching back loses nothing. */
export function setCardFields(root, lang, type) {
  const show = (id, on) => { const node = root.getElementById(id); if (node) node.hidden = !on; };
  show('row-membership', type === 'year');
  show('row-season', type !== 'none');
  show('row-pools', type !== 'none');
  show('row-card-price', type !== 'none');
  show('row-card-trips', type !== 'none');
  const text = (id, key) => { const node = root.getElementById(id); if (node) node.textContent = t(lang, key); };
  text('card-price-label', type === 'punch' ? 'settings.punchPrice' : 'settings.cardPrice');
  text('season-start-label', type === 'punch' ? 'settings.validFrom' : 'settings.seasonStart');
  text('season-end-label', type === 'punch' ? 'settings.validUntil' : 'settings.seasonEnd');
}
