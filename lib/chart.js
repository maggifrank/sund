/* The two charts — trips per month as columns, trips per weekday as a pie — as
   pure functions so the private app and the public read-only page render an
   identical chart from one source. */

import { t, plural, formatDate, weekdayName, joinList } from './i18n.js';
import { tripAt } from './state.js';

export const CHART_MONTHS = 12;

export const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;

/* Every month from the first trip to now, including the empty ones — a gap in
   the swimming is part of the story, and dropping those months would space the
   bars evenly and misstate the timeline. */
export function monthlySeries(trips, limit = CHART_MONTHS) {
  if (!trips.length) return [];
  const counts = new Map();
  for (const trip of trips) {
    const k = monthKey(new Date(tripAt(trip)));
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const first = new Date(tripAt(trips[0]));
  const now = new Date();
  const out = [];
  const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  const endY = now.getFullYear(), endM = now.getMonth();
  while (cursor.getFullYear() < endY || (cursor.getFullYear() === endY && cursor.getMonth() <= endM)) {
    out.push({ date: new Date(cursor), count: counts.get(monthKey(cursor)) || 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out.slice(-limit);
}

/* Round the axis up to a clean number so the ticks read 0/2/4 rather than 0/3/7. */
function axisTicks(max) {
  const step = max <= 4 ? 1 : max <= 8 ? 2 : max <= 20 ? 5 : 10;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

const svgEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Column with a 4px rounded cap and a square foot on the baseline. */
function barPath(x, y, w, h) {
  const r = Math.min(4, h, w / 2);
  if (h <= 0) return '';
  return `M${x},${y + h}V${y + r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y + h}Z`;
}

/* Callers cache this and skip re-rendering when it is unchanged — render() runs
   on every poll, and rebuilding would drop the tooltip mid-hover. */
export function chartSignature(lang, trips, limit = CHART_MONTHS) {
  return lang + '|' + monthlySeries(trips, limit).map((m) => monthKey(m.date) + ':' + m.count).join(',');
}

export function chartHTML(lang, trips, limit = CHART_MONTHS) {
  const series = monthlySeries(trips, limit);
  if (!series.length) return `<p class="chart-empty">${svgEsc(t(lang, 'chart.empty'))}</p>`;

  const W = 320, H = 168;
  const PAD = { top: 14, right: 4, bottom: 22, left: 24 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const { top, ticks } = axisTicks(Math.max(...series.map((m) => m.count), 1));
  const band = plotW / series.length;
  // 2px of surface between neighbours does the separating; never a stroke.
  const barW = Math.min(24, Math.max(3, band - 2));
  const yOf = (v) => PAD.top + plotH * (1 - v / top);

  const peak = series.reduce((best, m, i) => (m.count > series[best].count ? i : best), 0);
  /* Thin by measured band width, not by month count: 12 months still leaves
     ~24 units per band, which fits a three-letter month at 9px. */
  const labelEvery = band >= 20 ? 1 : band >= 13 ? 2 : 3;

  const parts = [];

  for (const v of ticks) {
    const y = yOf(v);
    parts.push(`<line class="gridline" x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}"/>`);
    parts.push(`<text class="axis-text" x="${PAD.left - 5}" y="${y + 3}" text-anchor="end">${v}</text>`);
  }

  series.forEach((m, i) => {
    const cx = PAD.left + band * i + band / 2;
    const h = plotH * (m.count / top);
    const y = yOf(m.count);
    if (m.count > 0) parts.push(`<path class="bar" d="${barPath(cx - barW / 2, y, barW, h)}"/>`);
    // Label the peak only — a number on every column is noise.
    if (i === peak && m.count > 0) {
      parts.push(`<text class="bar-label" x="${cx}" y="${y - 5}" text-anchor="middle">${m.count}</text>`);
    }
    if (i % labelEvery === 0 || i === series.length - 1) {
      parts.push(`<text class="axis-text" x="${cx}" y="${H - 7}" text-anchor="middle">${svgEsc(formatDate(lang, m.date, 'short'))}</text>`);
    }
    const tip = t(lang, 'chart.tooltip', {
      month: formatDate(lang, m.date, 'month'),
      trips: plural(lang, m.count, 'trip')
    });
    /* No tabindex: focus events don't fire reliably on SVG shapes, so a tab
       stop here would land with no tooltip. role + title still expose the value
       to assistive tech, and the history list is the table view. */
    parts.push(
      `<rect class="hit" x="${PAD.left + band * i}" y="${PAD.top}" width="${band}" height="${plotH}" ` +
      `data-tip="${svgEsc(tip)}" data-cx="${cx}" data-cy="${y}" role="img" aria-label="${svgEsc(tip)}">` +
      `<title>${svgEsc(tip)}</title></rect>`
    );
  });

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${svgEsc(t(lang, 'chart.label'))}">${parts.join('')}</svg>` +
         `<div class="chart-tip" id="chart-tip"></div>`;
}

/* Hover on a pointer, tap on a phone — the hit rects span the full plot height
   so the target is never the width of a thin bar. */
export function bindChartTooltip(container) {
  const show = (e) => {
    const hit = e.target.closest('.hit');
    const tip = container.querySelector('.chart-tip');
    if (!hit || !tip) return;
    const box = container.getBoundingClientRect();
    const svg = container.querySelector('svg').getBoundingClientRect();
    const scale = svg.width / 320;
    tip.textContent = hit.dataset.tip;
    tip.style.left = `${Number(hit.dataset.cx) * scale}px`;
    tip.style.top = `${Number(hit.dataset.cy) * scale + (svg.top - box.top)}px`;
    tip.dataset.show = '1';
  };
  const hide = () => {
    const tip = container.querySelector('.chart-tip');
    if (tip) tip.dataset.show = '0';
  };
  container.addEventListener('pointerover', show);
  container.addEventListener('pointermove', show);
  container.addEventListener('pointerleave', hide);
}

/* ---------- trips per weekday ---------- */

const TAU = Math.PI * 2;

/* Monday first. getDay() numbers from Sunday, but that is the Date object's
   convention rather than anything a reader of this page expects: Icelandic,
   Polish and British weeks all begin on Monday. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/* One entry per weekday in reading order, whether or not anyone swam that day —
   a Tuesday nobody swims on is an answer too, and leaving it out would quietly
   shorten the legend.

   `top` marks every day tied for the most rather than the first one found: with
   a few dozen trips a tie is ordinary, and picking a winner out of one would be
   presenting a coin toss as a fact. */
export function weekdayCounts(trips) {
  const counts = new Array(7).fill(0);
  for (const trip of trips) counts[new Date(tripAt(trip)).getDay()]++;
  const most = Math.max(...counts);
  return WEEK_ORDER.map((day) => ({
    day,
    count: counts[day],
    share: trips.length ? counts[day] / trips.length : 0,
    top: most > 0 && counts[day] === most
  }));
}

/* Same job as chartSignature: skip the rebuild when nothing moved. */
export function weekdaySignature(lang, trips) {
  return lang + '|' + weekdayCounts(trips).map((d) => d.count).join(',');
}

const pointOn = (cx, cy, r, a) => [
  +(cx + r * Math.sin(a)).toFixed(2),
  +(cy - r * Math.cos(a)).toFixed(2)
];

/* A wedge from 12 o'clock, clockwise. One day holding every trip has no wedge
   to draw — its two edges coincide and the arc collapses to nothing — so that
   case is a full circle, stitched from two half arcs. */
function slicePath(cx, cy, r, from, to) {
  if (to - from >= TAU - 1e-9) {
    return `M${cx},${cy - r}A${r},${r} 0 1,1 ${cx},${cy + r}A${r},${r} 0 1,1 ${cx},${cy - r}Z`;
  }
  const [x1, y1] = pointOn(cx, cy, r, from);
  const [x2, y2] = pointOn(cx, cy, r, to);
  return `M${cx},${cy}L${x1},${y1}A${r},${r} 0 ${to - from > Math.PI ? 1 : 0},1 ${x2},${y2}Z`;
}

/* The whole card body: the answer in words, then the pie it is read off, then a
   legend that is also the table view. One function rather than three so the app
   and the public page cannot render different halves of it.

   The pie is emphasis, not seven categories: the busiest day takes the chart
   mark and every other day the same recessive tint of it. Seven hues would fail
   on colour-blindness before it failed on taste, and the question the card
   answers is which day stands out — not which day is which. The legend, the
   direct labels and the wedge titles carry the identity instead. */
export function weekdayHTML(lang, trips) {
  const days = weekdayCounts(trips);
  if (!trips.length) return `<p class="chart-empty">${svgEsc(t(lang, 'weekday.empty'))}</p>`;

  const S = 168, C = S / 2, R = 76;
  const pct = (share) => Math.round(share * 100);
  const wedges = [], labels = [];
  let from = 0;

  for (const d of days) {
    if (!d.count) continue;
    const to = from + d.share * TAU;
    const path = slicePath(C, C, R, from, to);
    const [lx, ly] = pointOn(C, C, R * 0.62, (from + to) / 2);
    /* No hover tooltip, unlike the month chart: every wedge's day and count sit
       in the legend beside it, where a phone can read them without a tap. The
       <title> is still here for the pointer that expects one, and for the
       screen reader that has no wedge to hover at all. */
    const name = t(lang, 'weekday.tooltip', {
      day: weekdayName(lang, d.day),
      trips: plural(lang, d.count, 'trip'),
      pct: pct(d.share)
    });

    wedges.push(
      `<path class="slice${d.top ? ' is-top' : ''}" d="${path}" role="img" ` +
      `aria-label="${svgEsc(name)}"><title>${svgEsc(name)}</title></path>`
    );
    /* Name only the wedges with room for three letters at 9px; below about a
       tenth of the circle the label would cross its own edges. The legend names
       every day, so nothing is lost. */
    if (d.share >= 0.1) {
      labels.push(
        `<text class="slice-label${d.top ? ' is-top' : ''}" x="${lx}" y="${ly}" ` +
        `text-anchor="middle" dominant-baseline="central">${svgEsc(weekdayName(lang, d.day, 'short'))}</text>`
      );
    }
    from = to;
  }

  const tops = days.filter((d) => d.top);
  const head =
    `<div class="big-line">${svgEsc(t(lang, tops.length > 1 ? 'weekday.topTie' : 'weekday.top', {
      days: joinList(lang, tops.map((d) => weekdayName(lang, d.day)))
    }))}</div>` +
    /* Both figures are per day, which is what the plural heading above says when
       days are tied — every tied day has the same count by definition. */
    `<p class="note">${svgEsc(t(lang, 'weekday.sub', {
      trips: plural(lang, tops[0].count, 'trip'), pct: pct(tops[0].share)
    }))}</p>`;

  /* Rows in the same order the wedges run, clockwise from the top, so the
     legend reads as a key to the pie and not just a second list. */
  const legend = days.map((d) => (
    `<li class="weekday-row${d.top ? ' is-top' : ''}">` +
    `<span class="weekday-swatch" aria-hidden="true"></span>` +
    `<span class="weekday-name">${svgEsc(weekdayName(lang, d.day, 'short'))}</span>` +
    `<span class="weekday-count">${d.count}</span></li>`
  )).join('');

  return head +
    `<div class="weekday-plot">` +
      `<div class="weekday-pie">` +
        `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="${svgEsc(t(lang, 'weekday.label'))}">` +
        `${wedges.join('')}${labels.join('')}</svg>` +
      `</div>` +
      `<ul class="weekday-legend">${legend}</ul>` +
    `</div>`;
}
