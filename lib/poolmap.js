/* The pool map: every pool the app knows about, drawn where it is, coloured by
   whether it has been swum in.

   Two drawings of the same data rather than one. A sixth of the pools that can
   be placed at all sit inside twenty kilometres of Reykjavík — at the scale that
   fits Iceland into a phone column they are a single smudge, and the three the
   card actually covers are the same dot — so the country map is followed by a
   second pass over the capital area alone, and the country map carries a
   rectangle saying which piece the second one is. Both are drawn by this
   function from the same rows; only the window differs.

   Colour is not the only thing carrying the answer. Green and red are the one
   pair that a red-green reader cannot separate, and this pair measures ΔE 9.0
   (light) and 8.1 (dark) under simulated deuteranopia — above the floor, but
   not by a margin worth resting a page on. So visited is a *filled* disc and
   not-yet is a *hollow* ring: the shape says it without the colour, the colour
   says it without the shape, and the tooltip and the list below say it in
   words. Filled for visited rather than the other way round because the map
   fills in as the swimming gets done. */

import { t, plural } from './i18n.js';
import { project, SCALE, CAPITAL, frame } from './iceland.js';
import { COASTLINE, COASTLINE_CAPITAL } from './coastline.js';
import { allPools } from './pools.js';

/* The window the second map uses, and the rectangle the first one draws — see
   lib/iceland.js. Re-exported so the pages can keep asking for it here. */
export { CAPITAL };

/* The outline each window is drawn with. Not one coastline stretched to fit
   both: the capital map is thirteen times closer than the country map, so each
   has its own cut from the national data, already in its own page units — see
   bin/build-coastline.mjs. A window with no outline of its own is refused
   rather than drawn with the country's blown up, which is exactly how pools
   ended up in the sea off Seltjarnarnes. */
const OUTLINES = new Map([[null, COASTLINE], [CAPITAL, COASTLINE_CAPITAL]]);

/* The radius a marker is drawn at, in country-map units. Kept the same number
   in both maps — the zoomed one scales the coastline underneath rather than
   the marks on top of it — so a pool is the same size to the eye and the same
   size to a finger wherever it appears. About 8 px across in a phone column,
   which is the floor for a mark that has to be aimed at. */
const R = 11;
const HIT = 22;                 // the target around it, roughly a fingertip

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const round = (v) => Number(v.toFixed(1));

/* Every pool the app knows about, with how often it has been swum in.

   Built from the pool list rather than from the visits, because the unvisited
   ones are half the point of the page: a pool nobody has been to appears in no
   trip and would otherwise never be drawn. A count against an id that is in no
   list — from a restored backup whose pool record did not come with it — is
   kept as a row of its own rather than dropped, so what the page says still
   adds up to the swimming on file. */
function rowsFrom(visits, pools) {
  const rows = pools.map((pool) => ({
    id: pool.id,
    name: pool.name,
    lat: Number.isFinite(pool.lat) ? pool.lat : null,
    lon: Number.isFinite(pool.lon) ? pool.lon : null,
    visits: visits.get(pool.id) ?? 0
  }));
  const known = new Set(rows.map((r) => r.id));
  for (const [id, count] of visits) {
    if (!known.has(id)) rows.push({ id, name: id, lat: null, lon: null, visits: count });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/* From a state with the trips still on it — the private app, which has every
   swim and every pool it was at. */
export function poolRows(state) {
  const visits = new Map();
  for (const trip of state.trips) {
    if (trip.pool) visits.set(trip.pool, (visits.get(trip.pool) ?? 0) + 1);
  }
  return rowsFrom(visits, allPools(state.pools));
}

/* From the totals the public snapshot carries instead — see poolTable() in
   bin/publish.mjs. That page has no pool on any trip and no saved pool list to
   read positions out of, so the names and counts arrive already added up and
   every position comes from the built-in survey, which ships with the page.

   A published name overrides the built-in one but keeps its position: renaming
   a pool is a rename, not a different pool, and replacing the built-in record
   wholesale would take its coordinates with it and quietly move the pool off
   the map. A name that matches nothing built in is a pool added by hand, and
   joins the list without one — it is in the table below, tagged. Nothing built
   in lands there any more, every pool in the survey having a position, but a
   pool named at a check-in with no fix to hand still can. */
export function poolRowsFromTotals(totals) {
  const visits = new Map();
  const names = new Map();
  for (const row of totals) {
    if (typeof row?.id !== 'string' || !row.id) continue;   // the unattributed row has no pool
    visits.set(row.id, Number(row.count) || 0);
    if (row.name) names.set(row.id, row.name);
  }
  const pools = allPools([]).map((p) => (names.has(p.id) ? { ...p, name: names.get(p.id) } : p));
  const known = new Set(pools.map((p) => p.id));
  for (const [id, name] of names) if (!known.has(id)) pools.push({ id, name });
  return rowsFrom(visits, pools);
}

/* Whether a published table can say *which* pools those swims were at. A
   snapshot from before the table existed carries no rows at all, and one from
   before the rows carried an id names the pools without identifying them —
   either way the map has nothing to colour, and saying so is the only honest
   answer: drawing every pool red would claim the swimming never happened. An
   empty table, or one holding nothing but unattributed swims, is a real answer
   and passes. */
export const totalsIdentifyPools = (totals) =>
  Array.isArray(totals) &&
  (totals.every((row) => row?.name == null) || totals.some((row) => typeof row?.id === 'string'));

export const placeable = (row) => row.lat !== null && row.lon !== null;

/* Callers cache this and skip the rebuild when it has not moved: the page polls
   every fifteen seconds, and redrawing would drop a tooltip mid-hover and lose
   the open disclosure's scroll position. */
export function mapSignature(lang, rows) {
  return lang + '|' + rows.map((r) => `${r.id}~${r.visits > 0 ? 1 : 0}`).join(',');
}

/* The rectangle a window covers, in country-map units — what the locator on the
   first map draws, worked out from the window itself so the two can never
   disagree about where the second map is looking. */
function locatorRect(win) {
  const centre = project(win.lat, win.lon);
  const w = win.km * 1000 * SCALE;
  const h = w / win.aspect;
  return { x: centre.x - w / 2, y: centre.y - h / 2, w, h };
}

/* `win` is null for the whole country, or CAPITAL-shaped for a closer look.
   `locator` draws the rectangle for another window on top of this one. */
export function mapHTML(lang, rows, { win = null, locator = null, ariaKey } = {}) {
  const coast = OUTLINES.get(win);
  if (coast === undefined) throw new Error('no coastline cut for this window — run bin/build-coastline.mjs');
  const f = frame(win);
  const at = (row) => {
    const p = project(row.lat, row.lon);
    return { x: p.x * f.z + f.tx, y: p.y * f.z + f.ty };
  };

  /* Only what is actually in the window — a marker just outside it is clipped
     to a sliver against the frame, which reads as a bug rather than as a pool
     somewhere else. R of slack so one sitting exactly on the edge goes rather
     than arrives half-drawn. */
  const marks = rows
    .filter(placeable)
    .map((row) => ({ row, ...at(row) }))
    .filter((m) => m.x >= -R && m.y >= -R && m.x <= f.w + R && m.y <= f.h + R)
    /* Visited last, so the pools that have been swum in are the ones on top
       where two overlap. The hit targets are emitted in the same order further
       down, so the mark under the finger is the mark the tooltip names. */
    .sort((a, b) => (a.row.visits > 0) - (b.row.visits > 0));

  const done = marks.filter((m) => m.row.visits > 0).length;
  const label = t(lang, ariaKey, { done, todo: marks.length - done });

  const parts = [
    `<rect class="map-sea" x="0" y="0" width="${f.w}" height="${f.h}"/>`,
    `<path class="map-land" d="${coast}" stroke-width="1.3"/>`
  ];

  if (locator) {
    const r = locatorRect(locator);
    parts.push(
      `<rect class="map-locator" x="${round(r.x)}" y="${round(r.y)}" width="${round(r.w)}" height="${round(r.h)}" rx="4">` +
      `<title>${esc(t(lang, 'map.locator'))}</title></rect>`
    );
  }

  for (const m of marks) {
    /* The ring is drawn a stroke-width in from R so a hollow mark and a filled
       one cover the same circle; without that the outlined ones would read as
       the larger of the two. */
    const cls = m.row.visits > 0 ? 'map-mark is-done' : 'map-mark is-todo';
    const r = m.row.visits > 0 ? R : R - 1.2;
    parts.push(`<circle class="${cls}" cx="${round(m.x)}" cy="${round(m.y)}" r="${r}"/>`);
  }

  for (const m of marks) {
    const tip = m.row.visits > 0
      ? t(lang, 'map.tipDone', { name: m.row.name, trips: plural(lang, m.row.visits, 'trip') })
      : t(lang, 'map.tipTodo', { name: m.row.name });
    /* No tabindex, for the reason the monthly chart gives: focus does not fire
       reliably on SVG shapes, so a tab stop here would land with no tooltip.
       The title reaches a screen reader, and the list under the maps is the
       table view — every pool by name, in words rather than in colour. */
    parts.push(
      `<circle class="map-hit" cx="${round(m.x)}" cy="${round(m.y)}" r="${HIT}" ` +
      `data-tip="${esc(tip)}" role="img" aria-label="${esc(tip)}"><title>${esc(tip)}</title></circle>`
    );
  }

  return `<svg class="map-svg" viewBox="0 0 ${f.w} ${f.h}" role="img" aria-label="${esc(label)}">` +
         parts.join('') + '</svg><div class="map-tip"></div>';
}

/* Hover on a pointer, tap on a phone. The tooltip is positioned in the
   container's pixels, so it has to be told what the browser actually scaled the
   viewBox down to — which is not a constant: the two maps have different
   viewBoxes, and the column narrows with the window. */
export function bindMapTooltip(container) {
  const show = (e) => {
    const hit = e.target.closest('.map-hit');
    const tip = container.querySelector('.map-tip');
    if (!hit || !tip) return;
    const svg = hit.ownerSVGElement;
    const box = container.getBoundingClientRect();
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / svg.viewBox.baseVal.width;
    tip.textContent = hit.dataset.tip;
    tip.dataset.show = '1';

    const x = rect.left - box.left + Number(hit.getAttribute('cx')) * scale;
    const y = rect.top - box.top + Number(hit.getAttribute('cy')) * scale;
    /* Kept inside the card. Unlike the chart's columns, which all stand in from
       the edge, a pool can sit in the last few pixels of the map — Ísafjörður
       and Neskaupstaður are within a millimetre of the frame — and a name
       centred on one of those would hang off the side of the page. Measured
       rather than guessed: the width is whatever the pool is called. */
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(Math.max(x, half + 2), box.width - half - 2)}px`;
    /* And flipped under the marker when there is no room above it, which is
       where the northernmost pools are: the tooltip would otherwise be drawn
       over the card's own heading. */
    const above = y - tip.offsetHeight * 1.25;
    tip.dataset.below = above < 0 ? '1' : '0';
    tip.style.top = `${y}px`;
  };
  const hide = () => {
    const tip = container.querySelector('.map-tip');
    if (tip) tip.dataset.show = '0';
  };
  container.addEventListener('pointerover', show);
  container.addEventListener('pointermove', show);
  container.addEventListener('pointerleave', hide);
}
