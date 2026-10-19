/* The private dashboard's second look at the same trips: records, this year
   against the years before it, the time of day, and a calendar of every swim
   day. Pure functions that return markup, like lib/chart.js, and read nothing
   but the trips.

   None of this goes on the public page. Each of these is built out of dates —
   the calendar is nothing else — and the public page shows sums only, by
   design: no dates, no times, no streak. It imports lib/chart.js, never this. */

import { t, plural, formatDate, formatDayMonth, weekdayName } from './i18n.js';
import { tripAt, dateKey, dateFromKey } from './state.js';
import { stamps } from './passport.js';
import { svgEsc, barPath } from './chart.js';

const DAY_MS = 86400000;

/* Whole days from a to b, both YYYY-MM-DD. Midday to midday and rounded, so a
   daylight-saving change in between cannot make a day 23 hours long. */
const daysBetween = (a, b) => Math.round((dateFromKey(b) - dateFromKey(a)) / DAY_MS);

const addDays = (key, n) => {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

/* Monday first, as the weekday pie and the streak have it. */
const mondayOf = (key) => addDays(key, -((dateFromKey(key).getDay() + 6) % 7));

/* Backdated trips are anchored at local midday, so an exact midday reading
   means "no time was recorded" and the row shows the date alone. Milliseconds
   are ignored: a second trip backdated to the same day is nudged a millisecond
   along to keep its timestamp unique, and it is still a backdated trip. */
export const isBackdated = (d) =>
  d.getHours() === 12 && d.getMinutes() === 0 && d.getSeconds() === 0;

/* Callers skip the rebuild when this is unchanged, as with chartSignature: a
   poll every 15 seconds would otherwise drop a tooltip mid-hover. Today is in
   it because "the last 12 months" and "this time last year" move at midnight
   whether or not anyone swam. */
export function insightsSignature(lang, trips, now = new Date()) {
  return lang + '|' + dateKey(now) + '|' + trips.map((x) => tripAt(x) + (x.pool ?? '')).join(',');
}

/* Ticks for an axis that can reach a few hundred: at most about five lines,
   on a 1-2-5 step, so they read 0/20/40 and never 0/17/34. */
function niceTicks(max) {
  const raw = Math.max(1, max) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

const empty = (lang, key = 'chart.empty') => `<p class="chart-empty">${svgEsc(t(lang, key))}</p>`;

/* ---------- records ---------- */

/* Four bests, each with when it happened. A tie goes to the latest, so beating
   a record and equalling it both move the date to now. */
export function records(trips, names = new Map(), now = new Date()) {
  if (!trips.length) return null;
  const days = new Set();
  const months = new Map();
  for (const trip of trips) {
    const k = dateKey(tripAt(trip));
    if (!k) continue;
    days.add(k);
    months.set(k.slice(0, 7), (months.get(k.slice(0, 7)) ?? 0) + 1);
  }

  let bestMonth = null;
  for (const [key, count] of [...months].sort()) {
    if (!bestMonth || count >= bestMonth.count) bestMonth = { key, count };
  }

  /* Weeks with a swim in them, the same test the streak line uses. */
  const weeks = [...new Set([...days].map(mondayOf))].sort();
  let streak = null;
  for (let i = 0, start = 0; i < weeks.length; i++) {
    if (i > 0 && daysBetween(weeks[i - 1], weeks[i]) !== 7) start = i;
    const len = i - start + 1;
    if (!streak || len >= streak.weeks) streak = { weeks: len, from: weeks[start], to: weeks[i] };
  }
  const today = dateKey(now);
  const thisWeek = mondayOf(today);
  /* A streak that reached last week is still alive until this one is over. */
  streak.ongoing = daysBetween(streak.to, thisWeek) <= 7;

  /* The days without a swim between two swim days, and the run since the last
     one when that is the longest of all. */
  const sorted = [...days].sort();
  let gap = null;
  for (let i = 1; i < sorted.length; i++) {
    const len = daysBetween(sorted[i - 1], sorted[i]) - 1;
    if (len > 0 && (!gap || len >= gap.days)) {
      gap = { days: len, from: addDays(sorted[i - 1], 1), to: addDays(sorted[i], -1), ongoing: false };
    }
  }
  /* Today is left out: a day with no swim yet is not a day without one. */
  const since = daysBetween(sorted[sorted.length - 1], today) - 1;
  if (since > 0 && (!gap || since > gap.days)) {
    gap = { days: since, from: addDays(sorted[sorted.length - 1], 1), to: addDays(today, -1), ongoing: true };
  }

  const pools = stamps(trips, names);
  return { bestMonth, streak, gap, pools: pools.length, newest: pools[pools.length - 1] ?? null };
}

export function recordsHTML(lang, trips, names, now = new Date()) {
  const r = records(trips, names, now);
  if (!r) return empty(lang);
  const range = (from, to) => from === to
    ? formatDate(lang, dateFromKey(from), 'compact')
    : `${formatDate(lang, dateFromKey(from), 'compact')} – ${formatDate(lang, dateFromKey(to), 'compact')}`;
  /* The streak's last week runs to its Sunday, or to today if that is sooner. */
  const streakEnd = (() => {
    const sunday = addDays(r.streak.to, 6);
    const today = dateKey(now);
    return sunday > today ? today : sunday;
  })();

  const tiles = [
    {
      label: t(lang, 'records.bestMonth'),
      value: plural(lang, r.bestMonth.count, 'trip'),
      sub: formatDate(lang, dateFromKey(`${r.bestMonth.key}-01`), 'month')
    },
    {
      label: t(lang, 'records.streak'),
      value: plural(lang, r.streak.weeks, 'week'),
      sub: r.streak.ongoing ? t(lang, 'records.streakNow') : range(r.streak.from, streakEnd)
    },
    {
      label: t(lang, 'records.gap'),
      value: r.gap ? plural(lang, r.gap.days, 'day') : '—',
      sub: !r.gap ? t(lang, 'records.noGap')
        : r.gap.ongoing ? t(lang, 'records.gapNow', { from: formatDate(lang, dateFromKey(r.gap.from), 'compact') })
        : range(r.gap.from, r.gap.to)
    },
    {
      label: t(lang, 'records.pools'),
      value: plural(lang, r.pools, 'pool'),
      sub: r.newest ? t(lang, 'records.newest', { name: r.newest.name }) : ''
    }
  ];
  return `<div class="records">` + tiles.map((x) => (
    `<div class="record">` +
      `<div class="record-label">${svgEsc(x.label)}</div>` +
      `<div class="stat-value">${svgEsc(x.value)}</div>` +
      `<div class="sub">${svgEsc(x.sub)}</div>` +
    `</div>`
  )).join('') + `</div>`;
}

/* ---------- this year against the years before ---------- */

const dayOfYear = (key) => daysBetween(`${key.slice(0, 4)}-01-01`, key);
const yearLength = (y) => daysBetween(`${y}-01-01`, `${y + 1}-01-01`);
const PAST_YEARS = 2;

/* The running total through each day of the year, for this year and the last
   two that have any swims. This year stops at today; a year with nothing
   logged is left out rather than drawn as a flat line along the floor, since
   it says more about when the app was found than about the swimming. */
export function yearRace(trips, now = new Date()) {
  const today = dateKey(now);
  const thisYear = Number(today.slice(0, 4));
  const perDay = new Map();
  for (const trip of trips) {
    const k = dateKey(tripAt(trip));
    if (!k || k > today) continue;
    const y = Number(k.slice(0, 4));
    if (!perDay.has(y)) perDay.set(y, new Array(yearLength(y)).fill(0));
    perDay.get(y)[dayOfYear(k)]++;
  }
  const years = [thisYear, ...[...perDay.keys()].filter((y) => y < thisYear).sort((a, b) => b - a).slice(0, PAST_YEARS)];
  return {
    today: dayOfYear(today),
    years: years.map((year) => {
      const counts = perDay.get(year) ?? new Array(yearLength(year)).fill(0);
      const end = year === thisYear ? dayOfYear(today) + 1 : counts.length;
      const cum = [];
      let total = 0;
      for (let i = 0; i < end; i++) cum.push(total += counts[i]);
      return { year, cum, current: year === thisYear };
    })
  };
}

/* Emphasis, not categories: this year takes the chart mark and the years
   before it share the recessive step of the same hue. The question is "am I
   ahead of last year", and that is one line against the rest — telling 2024
   from 2025 by colour would be a second question, which the end labels and
   the tooltip answer instead. */
export function raceHTML(lang, trips, now = new Date()) {
  if (!trips.length) return empty(lang);
  const { today, years } = yearRace(trips, now);
  const [current, ...past] = years;
  const total = current.cum[current.cum.length - 1] ?? 0;

  let head = `<div class="big-line">${svgEsc(t(lang, 'race.thisYear', { trips: plural(lang, total, 'trip') }))}</div>`;
  const last = past.find((p) => p.year === current.year - 1);
  if (last) {
    const then = last.cum[Math.min(today, last.cum.length - 1)];
    const diff = total - then;
    const delta = diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : '±0';
    head += `<p class="note">${svgEsc(t(lang, 'race.vsLast', { trips: plural(lang, then, 'trip') }))} ` +
      `<span class="race-delta ${diff > 0 ? 'is-good' : diff < 0 ? 'is-bad' : ''}">${delta}</span></p>`;
  }

  const W = 320, H = 150;
  const PAD = { top: 10, right: 30, bottom: 20, left: 24 };
  const plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
  const { top, ticks } = niceTicks(Math.max(...years.map((y) => y.cum[y.cum.length - 1] ?? 0)));
  const xOf = (i) => +(PAD.left + plotW * i / 365).toFixed(2);
  const yOf = (v) => +(PAD.top + plotH * (1 - v / top)).toFixed(2);

  const parts = [];
  for (const v of ticks) {
    parts.push(`<line class="gridline" x1="${PAD.left}" y1="${yOf(v)}" x2="${PAD.left + plotW}" y2="${yOf(v)}"/>`);
    parts.push(`<text class="axis-text" x="${PAD.left - 5}" y="${yOf(v) + 3}" text-anchor="end">${v}</text>`);
  }
  for (const m of [0, 3, 6, 9]) {
    const i = dayOfYear(`${current.year}-${String(m + 1).padStart(2, '0')}-01`);
    parts.push(`<text class="axis-text" x="${xOf(i)}" y="${H - 6}">${svgEsc(formatDate(lang, new Date(current.year, m, 1), 'short'))}</text>`);
  }
  parts.push(`<line class="crosshair" x1="0" y1="${PAD.top}" x2="0" y2="${PAD.top + plotH}"/>`);

  /* Oldest first, so this year is drawn last and on top. */
  const ends = [];
  for (const y of [...years].reverse()) {
    if (!y.cum.length) continue;
    const d = y.cum.map((v, i) => `${i ? 'L' : 'M'}${xOf(i)},${yOf(v)}`).join('');
    parts.push(`<path class="race-line${y.current ? '' : ' is-past'}" d="${d}"/>`);
    const i = y.cum.length - 1;
    ends.push({ year: y.year, current: y.current, x: xOf(i), y: yOf(y.cum[i]) });
  }
  const dot = ends.find((e) => e.current);
  if (dot) parts.push(`<circle class="race-dot" cx="${dot.x}" cy="${dot.y}" r="4"/>`);

  /* A year's name at the end of its line. When two ends land on top of each
     other the older one gives way; the legend and the tooltip still name it. */
  const placed = [];
  for (const e of [...ends].sort((a, b) => b.year - a.year)) {
    if (placed.some((p) => Math.abs(p.x - e.x) < 34 && Math.abs(p.y - e.y) < 10)) continue;
    placed.push(e);
    parts.push(`<text class="race-label${e.current ? ' is-current' : ''}" x="${e.x + 6}" y="${e.y + 3}">${e.year}</text>`);
  }

  /* One hit strip per day across the whole plot: the reader aims at a date,
     and the tooltip gives every year's total on it. */
  const band = plotW / 365;
  const longest = Math.max(...years.map((y) => y.cum.length));
  for (let i = 0; i < longest; i++) {
    const values = years
      .filter((y) => i < y.cum.length)
      .map((y) => `${y.year}: ${y.cum[i]}`)
      .join(' · ');
    const md = dateKey(new Date(current.year, 0, 1 + i, 12)).slice(5);
    const tip = t(lang, 'race.tooltip', { date: formatDayMonth(lang, md), values });
    const cy = Math.min(...years.filter((y) => i < y.cum.length).map((y) => yOf(y.cum[i])));
    parts.push(
      `<rect class="hit" x="${(xOf(i) - band / 2).toFixed(2)}" y="${PAD.top}" width="${band.toFixed(2)}" height="${plotH}" ` +
      `data-tip="${svgEsc(tip)}" data-cx="${xOf(i)}" data-cy="${cy}"/>`
    );
  }

  const legend = past.length
    ? `<ul class="insight-legend">` +
        `<li><span class="key-line" aria-hidden="true"></span>${current.year}</li>` +
        `<li><span class="key-line is-past" aria-hidden="true"></span>` +
          `${svgEsc(t(lang, 'race.earlier'))} (${past.map((p) => p.year).join(', ')})</li>` +
      `</ul>`
    : '';

  return head +
    `<div class="chart race">` +
      `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${svgEsc(t(lang, 'race.label'))}">${parts.join('')}</svg>` +
      `<div class="chart-tip"></div>` +
    `</div>` + legend;
}

/* ---------- time of day ---------- */

/* Where each hour falls, for the one-line answer above the columns. */
const PARTS = [
  ['night', 0, 5], ['morning', 5, 11], ['midday', 11, 14], ['afternoon', 14, 18], ['evening', 18, 24]
];

/* Trips by the hour they were logged in. Backdated trips have no time — their
   midday is a placeholder — and counting them would put a false spike at noon. */
export function hourCounts(trips) {
  const hours = new Array(24).fill(0);
  let timed = 0;
  for (const trip of trips) {
    const d = new Date(tripAt(trip));
    if (isNaN(d) || isBackdated(d)) continue;
    hours[d.getHours()]++;
    timed++;
  }
  return { hours, timed };
}

const hh = (h) => `${String(h % 24).padStart(2, '0')}:00`;

export function hoursHTML(lang, trips) {
  const { hours, timed } = hourCounts(trips);
  if (!timed) return empty(lang, 'hours.empty');

  const sums = PARTS.map(([name, from, to]) => ({
    name, from, to, count: hours.slice(from, to).reduce((a, b) => a + b, 0)
  }));
  const best = sums.reduce((a, b) => (b.count > a.count ? b : a));
  const head =
    `<div class="big-line">${svgEsc(t(lang, `hours.top.${best.name}`))}</div>` +
    `<p class="note">${svgEsc(t(lang, 'hours.sub', {
      pct: Math.round(best.count / timed * 100), from: hh(best.from), to: hh(best.to)
    }))}</p>`;

  /* The month chart's proportions and marks, so the two read as one family. */
  const W = 320, H = 124;
  const PAD = { top: 14, right: 4, bottom: 22, left: 24 };
  const plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
  const { top, ticks } = niceTicks(Math.max(...hours));
  const band = plotW / 24;
  const barW = Math.min(24, band - 2);
  const yOf = (v) => PAD.top + plotH * (1 - v / top);
  const peak = hours.indexOf(Math.max(...hours));

  const parts = [];
  for (const v of ticks) {
    parts.push(`<line class="gridline" x1="${PAD.left}" y1="${yOf(v)}" x2="${W - PAD.right}" y2="${yOf(v)}"/>`);
    parts.push(`<text class="axis-text" x="${PAD.left - 5}" y="${yOf(v) + 3}" text-anchor="end">${v}</text>`);
  }
  hours.forEach((count, h) => {
    const cx = PAD.left + band * h + band / 2;
    const y = yOf(count);
    const mark = `data-mark="${h}" style="--i:${h}"`;
    if (count > 0) parts.push(`<path class="bar" ${mark} d="${barPath(cx - barW / 2, y, barW, plotH * count / top)}"/>`);
    if (h === peak) parts.push(`<text class="bar-label" data-mark="${h}" x="${cx}" y="${y - 5}" text-anchor="middle">${count}</text>`);
    if (h % 3 === 0) {
      parts.push(`<text class="axis-text" data-mark="${h}" x="${cx}" y="${H - 7}" text-anchor="middle">${String(h).padStart(2, '0')}</text>`);
    }
    const tip = t(lang, 'hours.tooltip', { from: hh(h), to: hh(h + 1), trips: plural(lang, count, 'trip') });
    parts.push(
      `<rect class="hit" data-mark="${h}" x="${PAD.left + band * h}" y="${PAD.top}" width="${band}" height="${plotH}" ` +
      `data-tip="${svgEsc(tip)}" data-cx="${cx}" data-cy="${y}"><title>${svgEsc(tip)}</title></rect>`
    );
  });

  return head +
    `<div class="chart hours">` +
      `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${svgEsc(t(lang, 'hours.label'))}">${parts.join('')}</svg>` +
      `<div class="chart-tip"></div>` +
    `</div>` +
    `<p class="note">${svgEsc(t(lang, 'hours.note'))}</p>`;
}

/* ---------- the swim calendar ---------- */

const CAL_WEEKS = 53;
/* What a phone keeps: the most recent half year. The rest is still in the
   markup and styles.css hides it below the board, so a wider screen shows the
   whole year without a second render. */
const CAL_NARROW = 26;

/* One cell per day for the last 53 weeks, Monday to Sunday down each column.
   Three steps of the one hue: no swim, a swim, more than one. Nobody swims
   often enough in a day for a finer scale to mean anything. */
export function calendarHTML(lang, trips, now = new Date()) {
  const today = dateKey(now);
  const perDay = new Map();
  for (const trip of trips) {
    const k = dateKey(tripAt(trip));
    if (k) perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const start = addDays(mondayOf(today), -7 * (CAL_WEEKS - 1));
  const narrowFrom = addDays(mondayOf(today), -7 * (CAL_NARROW - 1));

  let yearDays = 0, halfDays = 0;
  const cells = [];
  /* The weekday names down the side: Monday, Wednesday and Friday, as a wall
     calendar's margin would — all seven would crowd a 6px row. */
  cells.push('<span class="cal-head"></span>');
  for (let r = 0; r < 7; r++) {
    cells.push(`<span class="cal-wd">${r % 2 === 0 && r < 6 ? svgEsc(weekdayName(lang, (r + 1) % 7, 'short')) : ''}</span>`);
  }
  for (let w = 0; w < CAL_WEEKS; w++) {
    const monday = addDays(start, 7 * w);
    const old = monday < narrowFrom ? ' data-old' : '';
    /* The month's name over the week its first day falls in. */
    let month = '';
    for (let r = 0; r < 7; r++) {
      const k = addDays(monday, r);
      if (k.endsWith('-01') && k <= today) month = formatDate(lang, dateFromKey(k), 'short');
    }
    cells.push(`<span class="cal-head"${old}>${svgEsc(month)}</span>`);
    for (let r = 0; r < 7; r++) {
      const k = addDays(monday, r);
      if (k > today) { cells.push(`<span class="cal-day is-future"${old}></span>`); continue; }
      const n = perDay.get(k) ?? 0;
      if (n) {
        yearDays++;
        if (!old) halfDays++;
      }
      const tip = t(lang, 'cal.tooltip', { date: formatDate(lang, dateFromKey(k), 'compact'), trips: plural(lang, n, 'trip') });
      cells.push(`<span class="cal-day" data-level="${Math.min(n, 2)}" data-tip="${svgEsc(tip)}" title="${svgEsc(tip)}"${old}></span>`);
    }
  }

  const head =
    `<div class="big-line"><span class="cal-sum-year">${svgEsc(t(lang, 'cal.year', { days: plural(lang, yearDays, 'swimDay') }))}</span>` +
    `<span class="cal-sum-half">${svgEsc(t(lang, 'cal.half', { days: plural(lang, halfDays, 'swimDay') }))}</span></div>`;
  const legend =
    `<div class="cal-legend"><span>${svgEsc(t(lang, 'cal.legend'))}</span>` +
    [0, 1, 2].map((l) => `<span class="cal-day" data-level="${l}" aria-hidden="true"></span><span>${l === 2 ? '2+' : l}</span>`).join('') +
    `</div>`;

  return head +
    `<div class="cal-wrap chart">` +
      `<div class="cal" role="img" aria-label="${svgEsc(t(lang, 'cal.label'))}">${cells.join('')}</div>` +
      `<div class="chart-tip"></div>` +
    `</div>` + legend;
}

/* ---------- hover ---------- */

/* One tooltip binder for every chart in this file. An SVG mark says where its
   tooltip goes in viewBox units (data-cx/cy, which the plot's own scale turns
   into pixels); a calendar cell is plain HTML and is measured where it sits.
   The race's crosshair follows the same pointer. Bound to the container, which
   outlives the innerHTML the charts are rebuilt with. */
export function bindInsightTips(container) {
  const show = (e) => {
    const hit = e.target.closest('[data-tip]');
    const wrap = hit?.closest('.chart');
    const tip = wrap?.querySelector('.chart-tip');
    if (!hit || !tip) return hide();
    const box = wrap.getBoundingClientRect();
    let x, y;
    const svg = hit.ownerSVGElement;
    if (svg && hit.dataset.cx) {
      const r = svg.getBoundingClientRect();
      const scale = r.width / svg.viewBox.baseVal.width;
      x = Number(hit.dataset.cx) * scale + (r.left - box.left);
      y = Number(hit.dataset.cy) * scale + (r.top - box.top);
      const cross = svg.querySelector('.crosshair');
      if (cross) {
        cross.setAttribute('x1', hit.dataset.cx);
        cross.setAttribute('x2', hit.dataset.cx);
        cross.dataset.show = '1';
      }
    } else {
      const r = hit.getBoundingClientRect();
      x = r.left + r.width / 2 - box.left;
      y = r.top - box.top;
    }
    tip.textContent = hit.dataset.tip;
    /* Kept inside the card: a tooltip on the first or last column would
       otherwise hang half off the edge of a phone screen. */
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(Math.max(x, half), box.width - half)}px`;
    tip.style.top = `${y}px`;
    tip.dataset.show = '1';
  };
  const hide = () => {
    for (const tip of container.querySelectorAll('.chart-tip')) tip.dataset.show = '0';
    for (const cross of container.querySelectorAll('.crosshair')) cross.dataset.show = '0';
  };
  container.addEventListener('pointerover', show);
  container.addEventListener('pointermove', show);
  container.addEventListener('pointerleave', hide);
}
