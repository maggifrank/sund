/* How busy a pool is through the day: the average number of people coming in,
   hour by hour, on a typical day of the week in the season it is now. The
   numbers are Reykjavík's own gate counts — see bin/fetch-pool-busyness.mjs —
   so this exists for the city's eight pools and no others.

   One series, so one colour and no legend: the card's heading says what the
   columns are. When the day on show is today, the hour it is now takes the
   chart mark and every other hour steps back to the recessive tint of it — the
   same one-hue pair the weekday pie uses, emphasis rather than identity — and a
   sentence under the chart says the same thing in words, so the colour is
   never the only thing saying which hour is now. */

import { t, plural } from './i18n.js';
import { POOL_BUSY } from './poolbusy.js';

export { BUSY_SOURCE } from './poolbusy.js';

export const busyFor = (id) => POOL_BUSY[id] ?? null;

/* The dataset's seasons, by month: winter is December to February. */
const SEASON_OF_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer',
  'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
export const seasonOfMonth = (month) => SEASON_OF_MONTH[month];

const W = 320, H = 128;
const PAD = { top: 16, right: 4, bottom: 20, left: 28 };

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad2 = (h) => String(h % 24).padStart(2, '0');

/* Column with a 4px rounded cap and a square foot on the baseline — the monthly
   chart's column, so the two read as one family. */
function barPath(x, y, w, h) {
  const r = Math.min(4, h, w / 2);
  if (h <= 0) return '';
  return `M${x},${y + h}V${y + r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y + h}Z`;
}

/* A clean top for the axis in steps of 1, 2 or 5 times a power of ten, four or
   five of them: a Thursday at Laugardalslaug reads 0/50/100/150/200, one at
   Klébergslaug 0/1/2/3/4. */
function axis(max) {
  const raw = Math.max(max, 1) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  const top = Math.ceil(Math.max(max, 1) / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v));
  return { top, ticks };
}

export const hoursText = (lang, hour) => t(lang, 'busy.hours', { from: pad2(hour), to: pad2(hour + 1) });

export function peopleText(lang, n) {
  const people = plural(lang, n, 'guest');
  return n > 0 ? t(lang, 'busy.about', { people }) : people;
}

/* The day's numbers and where it is now in them, or null for a day with no
   counts at all — a pool shut on that weekday that season. */
function dayOf(busy, { season, weekday, hour }) {
  const values = busy.seasons[season]?.[weekday];
  if (!values || values.every((n) => n === 0)) return null;
  const nowIndex = hour === null ? null : hour - busy.start;
  return { values, now: nowIndex !== null && nowIndex >= 0 && nowIndex < values.length ? nowIndex : null };
}

export function busyChartHTML(lang, busy, { season, weekday, hour = null, dayName }) {
  const day = dayOf(busy, { season, weekday, hour });
  if (!day) return `<p class="chart-empty">${esc(t(lang, 'busy.closed'))}</p>`;
  const { values, now } = day;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const { top, ticks } = axis(Math.max(...values));
  const band = plotW / values.length;
  // 2px of surface between neighbours does the separating; never a stroke.
  const barW = Math.min(24, Math.max(3, band - 2));
  const yOf = (v) => PAD.top + plotH * (1 - v / top);
  const peak = values.reduce((best, n, i) => (n > values[best] ? i : best), 0);

  const parts = [];
  for (const v of ticks) {
    const y = yOf(v);
    parts.push(`<line class="gridline" x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}"/>`);
    parts.push(`<text class="axis-text" x="${PAD.left - 5}" y="${y + 3}" text-anchor="end">${v}</text>`);
  }

  values.forEach((n, i) => {
    const h = busy.start + i;
    const cx = PAD.left + band * i + band / 2;
    const y = yOf(n);
    const cls = now === null ? 'bar' : i === now ? 'bar is-now' : 'bar is-dim';
    if (n > 0) parts.push(`<path class="${cls}" style="--i:${i}" d="${barPath(cx - barW / 2, y, barW, plotH * (n / top))}"/>`);
    /* The busiest hour is the one number on the chart; the axis and the
       tooltip carry the rest. */
    if (i === peak) {
      parts.push(`<text class="bar-label" x="${cx}" y="${y - 5}" text-anchor="middle">${n}</text>`);
    }
    /* Every third hour on the clock, which in a sixteen-hour day is five or six
       labels at 9px — as many as fit without touching. */
    if (h % 3 === 0) {
      parts.push(`<text class="axis-text" x="${PAD.left + band * i}" y="${H - 6}" text-anchor="middle">${pad2(h)}</text>`);
    }
    const tip = t(lang, 'busy.tip', { hours: hoursText(lang, h), people: peopleText(lang, n) }) +
      (i === now ? ` · ${t(lang, 'busy.nowTag')}` : '');
    parts.push(
      `<rect class="hit" x="${PAD.left + band * i}" y="${PAD.top}" width="${band}" height="${plotH}" ` +
      `data-tip="${esc(tip)}" data-cx="${cx}" data-cy="${y}" role="img" aria-label="${esc(tip)}">` +
      `<title>${esc(tip)}</title></rect>`
    );
  });

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t(lang, 'busy.aria', { day: dayName }))}">` +
         parts.join('') + '</svg><div class="chart-tip"></div>';
}

/* The chart in words: the busiest hour of the day on show, and — when that day
   is today and the pool is counting — how busy the hour it is now usually is. */
export function busySummary(lang, busy, { season, weekday, hour = null }) {
  const day = dayOf(busy, { season, weekday, hour });
  if (!day) return { peak: null, now: null };
  const { values, now } = day;
  const peak = values.reduce((best, n, i) => (n > values[best] ? i : best), 0);
  return {
    peak: t(lang, 'busy.peak', { hours: hoursText(lang, busy.start + peak), people: peopleText(lang, values[peak]) }),
    now: now === null ? null
      : t(lang, values[now] > 0 ? 'busy.now' : 'busy.nowNone',
        { hours: hoursText(lang, busy.start + now), people: peopleText(lang, values[now]) })
  };
}
