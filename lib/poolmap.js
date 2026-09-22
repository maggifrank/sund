/* The pool map: every pool the app knows about, drawn where it is, coloured by
   whether it has been swum in.

   Colour is not the only thing carrying the answer. Green and red are the one
   pair that a red-green reader cannot separate, and this pair measures ΔE 9.0
   (light) and 8.1 (dark) under simulated deuteranopia — above the floor, but
   not by a margin worth resting a page on. So visited is a *filled* disc and
   not-yet is a *hollow* ring: the shape says it without the colour, the colour
   says it without the shape, and the tooltip and the list below say it in
   words. Filled for visited rather than the other way round because the map
   fills in as the swimming gets done.

   Pools too close to draw apart are drawn as one badge instead. A marker is
   about twelve kilometres across on the country map, so two pools nearer than
   that used to be one marker on top of another — 82 of 126 were — and a red
   ring could sit over a green one, with no way to tap the one underneath. A
   badge says how many pools are there, its ring says how many of them have been
   swum in, and hovering lists them. Nothing on the map overlaps anything
   else; see groupMarks().

   And the map zooms, because a badge only says that something is there. The
   badges are worked out again at every zoom, so they come apart into their
   pools as the map gets closer, and tapping one flies to them; see
   bindMapZoom(). There used to be a second map for the capital area, a
   sixth of the pools being within twenty kilometres of Reykjavík; zooming
   made it the same picture twice. */

import { t, plural } from './i18n.js';
import { project, SCALE, CAPITAL, frame, VIEW } from './iceland.js';
import { COASTLINE, COASTLINE_CAPITAL } from './coastline.js';
import { allPools } from './pools.js';

/* The radius a marker is drawn at, in country-map units at no zoom. Divided by
   the zoom wherever it is drawn — the map scales the coastline underneath
   rather than the marks on top of it — so a pool is the same size to the eye
   and the same size to a finger however close the map is. About 8 px across in
   a phone column, which is the floor for a mark that has to be aimed at. */
const R = 11;
const HIT = 22;                 // the target around it, roughly a fingertip

/* Both of those are units of a 1000-unit page, so what they come to on the
   screen is whatever the map was scaled to: in a phone column a marker came out
   7 px across and its target 15, half what a finger can aim at, and the second
   tap that opens a pool's page kept landing on the map instead of on the pool.
   So a mark is drawn for the size it will end up on the screen.

   A mark is grown until it is MARK_PX across, and never past twice its country
   size — beyond that a phone's map is badges of badges. A target is grown
   further, to TAP_PX: it costs nothing to aim at, being invisible, and a mark
   too small to hit was the whole problem. Targets that overlap are settled by
   which was drawn last, as they always were.

   `onePx` is how many page units one CSS pixel of the finished map is worth,
   and `k` the scale the marks are drawn at, so this holds for a map zoomed in
   by a gesture and for a pool page's cropped one alike — neither of which draws
   a unit at the size the country map does. */
const MARK_PX = 14;
const TAP_PX = 36;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function fit(onePx, k) {
  const mark = clamp((MARK_PX / 2) * onePx / (R * k), 1, 2);
  return { mark, tap: clamp((TAP_PX / 2) * onePx / (HIT * k), mark, 3) };
}

/* For a map drawn at no zoom across `widthPx` — what bindMapZoom() asks, since
   its marks are the same size on the screen however far it has zoomed in. */
export const markScale = (widthPx) => fit(VIEW.w / widthPx, 1);

/* A badge is bigger than a pool — it has a number to hold, and a two-digit one
   needs a little more room again. GAP keeps marks from touching even when they
   do not overlap, so two neighbours never read as one shape. */
const BADGE = 18;
const BADGE_WIDE = 20;
const GAP = 2;
/* Names listed in a badge's tooltip before the rest are counted instead. Eight
   fits on a phone above or below the badge; the capital area's twenty-one would
   run off the card, and tapping the badge shows every one of them anyway. */
const LISTED = 8;

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

/* The closer of the two windows a pool can be drawn in: the capital area if it
   sits inside that one with a marker's width to spare, the country otherwise.
   A pool page draws its pool on whichever this says, so Laugardalslaug is shown
   on the capital's shoreline rather than as one dot in a smudge on the country. */
export function windowFor(row) {
  const f = frame(CAPITAL);
  const p = project(row.lat, row.lon);
  const x = p.x * f.z + f.tx, y = p.y * f.z + f.ty;
  return x >= R && y >= R && x <= f.w - R && y <= f.h - R ? CAPITAL : null;
}

/* Callers cache this and skip the rebuild when it has not moved: the page polls
   every fifteen seconds, and redrawing would drop a tooltip mid-hover and lose
   the open disclosure's scroll position.

   The count, not just whether there is one. The tooltips say how many trips, so
   a fifth swim at a pool already swum in has to rebuild them — keyed on visited
   or not, the map went on saying four until some other pool changed colour. */
export function mapSignature(lang, rows) {
  return lang + '|' + rows.map((r) => `${r.id}~${r.visits}`).join(',');
}

/* The rectangle a window covers, in country-map units — for the capital, where
   the country map hands over to the capital's detailed outline. Worked out from
   the window itself, so it covers exactly what that outline was cut for. */
function windowRect(win) {
  const centre = project(win.lat, win.lon);
  const w = win.km * 1000 * SCALE;
  const h = w / win.aspect;
  return { x: centre.x - w / 2, y: centre.y - h / 2, w, h };
}

/* ---------- marks ---------- */

const badgeRadius = (n) => (n === 1 ? R : n < 10 ? BADGE : BADGE_WIDE);

/* Every placeable pool on a page, in that page's units. Sorted by id, so which
   pools share a badge depends on where the pools are and on nothing else —
   sorted by visited-or-not, logging a swim could quietly regroup badges at the
   other end of the country. */
function placedMarks(rows, f) {
  return rows
    .filter(placeable)
    .map((row) => {
      const p = project(row.lat, row.lon);
      return { row, x: p.x * f.z + f.tx, y: p.y * f.z + f.ty };
    })
    /* Only what is actually on the page — a marker just outside it is clipped
       to a sliver against the frame, which reads as a bug rather than as a pool
       somewhere else. R of slack so one sitting exactly on the edge goes rather
       than arrives half-drawn. */
    .filter((m) => m.x >= -R && m.y >= -R && m.x <= f.w + R && m.y <= f.h + R)
    .sort((a, b) => a.row.id.localeCompare(b.row.id));
}

/* Merged until nothing overlaps, at a zoom where one unit of the page is drawn
   `1 / k` times its size — every radius and gap is multiplied by k, so a marker
   stays the same size on the screen whatever the zoom, and zooming in is what
   pulls a badge apart. The closest overlapping pair is merged first and the check
   runs again, because a badge is bigger than the markers it replaces and can come
   to overlap a neighbour that was clear before. Each pass removes a mark, so it
   ends.

   A badge sits on its most central pool — the one with the least distance to
   all the others — rather than on the average of their positions. The average of
   a group strung around a bay is out in the bay, and a badge in the sea is the
   very thing the national coastline was brought in to stop. */
function groupMarks(marks, k = 1, mark = 1) {
  let groups = marks.map((m) => ({ members: [m], x: m.x, y: m.y }));
  for (;;) {
    let best = null;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i], b = groups[j];
        const clear = Math.hypot(a.x - b.x, a.y - b.y) -
                      (badgeRadius(a.members.length) + badgeRadius(b.members.length) + GAP) * k * mark;
        if (clear < 0 && (!best || clear < best.clear)) best = { i, j, clear };
      }
    }
    if (!best) return groups;
    const members = [...groups[best.i].members, ...groups[best.j].members];
    let centre = members[0], least = Infinity;
    for (const c of members) {
      const sum = members.reduce((acc, o) => acc + Math.hypot(c.x - o.x, c.y - o.y), 0);
      if (sum < least) { least = sum; centre = c; }
    }
    groups = groups.filter((_, q) => q !== best.i && q !== best.j);
    groups.push({ members, x: centre.x, y: centre.y });
  }
}

/* What a badge says when it is tapped: how many of its pools have been swum
   in, then the pools — the ones that have first, busiest first, marked ● like
   the filled marker, and the rest marked ○ like the hollow one. The glyphs
   carry visited-or-not in the tooltip the way the shape does on the map, so the
   list does not depend on colour either. */
function groupTip(lang, members, limit) {
  const done = members.filter((m) => m.row.visits > 0);
  const lines = [t(lang, 'map.visitedCount', { n: done.length, total: members.length })];
  const ordered = [
    ...done.sort((a, b) => b.row.visits - a.row.visits || a.row.name.localeCompare(b.row.name)),
    ...members.filter((m) => m.row.visits === 0).sort((a, b) => a.row.name.localeCompare(b.row.name))
  ];
  for (const m of ordered.slice(0, limit)) {
    lines.push(m.row.visits > 0
      ? `● ${m.row.name} · ${plural(lang, m.row.visits, 'trip')}`
      : `○ ${m.row.name}`);
  }
  if (ordered.length > limit) lines.push(t(lang, 'map.groupMore', { n: ordered.length - limit }));
  return lines.join('\n');
}

/* A tooltip's text, safe in an attribute and with its line breaks intact. */
const attr = (s) => esc(s).replace(/\n/g, '&#10;');

/* Numbers written into the markup, to a few decimal places — at sixteen times
   zoom a tenth of a unit is most of a pixel, so the one-place rounding the static
   map got away with would make markers visibly jitter while a pinch is under way. */
const num = (v) => Number(v.toFixed(3));

/* The markers, badges and their hit targets, at scale `k` (one over the zoom)
   and `mark` (how much bigger a narrow map draws them, `tap` the same for the
   targets). Every size and stroke is written as an attribute times those rather
   than left to the stylesheet: a stroke set in CSS is a width on the page, and
   would thicken sixteenfold as the map zoomed in. `view` culls what is off
   screen, which at full zoom is most of the country. `href` gives a pool the
   page a second tap on it opens; a badge has none, since tapping one zooms in
   to its pools. */
function marksMarkup(lang, groups, k, view = null, href = null, mark = 1, tap = 1) {
  const pad = (BADGE_WIDE * mark + HIT * tap) * k;
  const shown = view
    ? groups.filter((g) => g.x >= view.x - pad && g.x <= view.x + view.w + pad &&
                           g.y >= view.y - pad && g.y <= view.y + view.h + pad)
    : groups;

  const parts = [];
  for (const g of shown) {
    const x = num(g.x), y = num(g.y);
    if (g.members.length === 1) {
      /* The ring is drawn a stroke-width in from R so a hollow mark and a filled
         one cover the same circle; without that the outlined ones would read as
         the larger of the two. */
      const done = g.members[0].row.visits > 0;
      parts.push(done
        ? `<circle class="map-mark is-done" cx="${x}" cy="${y}" r="${num(R * k * mark)}" stroke-width="${num(2 * k * mark)}"/>`
        : `<circle class="map-mark is-todo" cx="${x}" cy="${y}" r="${num((R - 1.2) * k * mark)}" stroke-width="${num(2.4 * k * mark)}"/>`);
      continue;
    }
    /* A badge follows the same rule as a marker: filled when every pool in it
       has been swum in, a ring when none has. In between, the ring is split —
       the visited share in green from twelve o'clock, the rest in red — with a
       sliver of the land showing at each join, so the split is a shape and not
       only a change of colour.

       Two arcs, each one dash long and pushed round to where it starts, rather
       than a full red ring with the joins painted over in the land colour. A
       dash pattern does not carry on past the end of a circle, so the join at
       twelve o'clock came out half as wide as the other. */
    const n = g.members.length;
    const done = g.members.filter((m) => m.row.visits > 0).length;
    const r = badgeRadius(n) * k * mark;
    const ring = r - 1.6 * k * mark, stroke = num(3.2 * k * mark);
    if (done === n) {
      parts.push(`<circle class="map-group is-done" cx="${x}" cy="${y}" r="${num(r)}" stroke-width="${num(2 * k * mark)}"/>`);
    } else if (done === 0) {
      parts.push(`<circle class="map-group is-todo" cx="${x}" cy="${y}" r="${num(ring)}" stroke-width="${stroke}"/>`);
    } else {
      const c = 2 * Math.PI * ring, seam = 2.4 * k * mark;
      const doneArc = (c * done) / n;
      const arc = (cls, start, length) =>
        `<circle class="map-group-arc ${cls}" cx="${x}" cy="${y}" r="${num(ring)}" stroke-width="${stroke}" ` +
        `transform="rotate(-90 ${x} ${y})" stroke-dasharray="${num(Math.max(0.5 * k * mark, length))} ${num(c)}" ` +
        `stroke-dashoffset="${num(-start)}"/>`;
      parts.push(
        `<circle class="map-group is-mixed" cx="${x}" cy="${y}" r="${num(ring)}"/>`,
        arc('is-done', seam / 2, doneArc - seam),
        arc('is-todo', doneArc + seam / 2, c - doneArc - seam)
      );
    }
    parts.push(
      `<text class="map-group-count${done === n ? ' is-done' : ''}" x="${x}" y="${y}" font-size="${num(19 * k * mark)}">${n}</text>`
    );
  }

  for (const g of shown) {
    const one = g.members.length === 1;
    const m = g.members[0];
    const tip = one
      ? (m.row.visits > 0
          ? t(lang, 'map.tipDone', { name: m.row.name, trips: plural(lang, m.row.visits, 'trip') })
          : t(lang, 'map.tipTodo', { name: m.row.name }))
      : groupTip(lang, g.members, LISTED);
    /* A screen reader gets every pool in a badge, not the first eight: it has no
       map underneath to find the rest on. */
    const spoken = one ? tip : groupTip(lang, g.members, Infinity);
    const hit = Math.max(HIT * tap, (one ? 0 : badgeRadius(g.members.length) + 6) * mark) * k;
    /* A badge's hit carries the box its pools span, so tapping it can zoom to
       exactly them. */
    const span = one ? '' : (() => {
      const xs = g.members.map((q) => q.x), ys = g.members.map((q) => q.y);
      return ` data-x0="${num(Math.min(...xs))}" data-y0="${num(Math.min(...ys))}" ` +
             `data-x1="${num(Math.max(...xs))}" data-y1="${num(Math.max(...ys))}"`;
    })();
    /* No tabindex, for the reason the monthly chart gives: focus does not fire
       reliably on SVG shapes, so a tab stop here would land with no tooltip.
       The title reaches a screen reader, and the list under the maps is the
       table view — every pool by name, in words rather than in colour. */
    const link = one && href ? href(m.row) : null;
    parts.push(
      `<circle class="map-hit${one ? '' : ' is-group'}" cx="${num(g.x)}" cy="${num(g.y)}" r="${num(hit)}"${span} ` +
      (link ? `data-href="${esc(link)}" data-open="${esc(t(lang, 'map.tipOpen'))}" ` : '') +
      `data-tip="${attr(tip)}" role="img" aria-label="${attr(spoken)}"><title>${esc(spoken)}</title></circle>`
    );
  }
  return parts.join('');
}

/* ---------- the drawing ---------- */

/* The map at no zoom at all — what the page shows before any script has
   touched it, and all a still image of it needs. bindMapZoom() below takes it
   from there.

   `href` gives a pool the page a second tap on it opens, and `aria` replaces
   the counted description for a map that is not about counting — a pool page's
   map of the one pool. That page also passes `win`, CAPITAL-shaped, to start
   looking at a window rather than the whole country, with marks at the size
   that window's own map would draw them; and `focus`, a share of the window's
   width, shows only that much of it, centred on the first pool and held inside
   the window. The capital area is 40 km across, and a pool page's one mark at
   the edge of it says less about where the pool is than the same mark in the
   middle of a closer look. It crops rather than cutting a new coastline, so
   keep it modest — the capital's outline is simplified for the whole window.
   A map drawn with either has nothing to zoom: bindMapZoom() starts from the
   whole country.

   `width` is how many CSS pixels wide the map will be drawn, which is what
   decides how big a mark has to be to be worth aiming at. A page that binds the
   zoom can leave it out and let the first refresh() measure the map; one that
   draws a map and leaves it there has to say. */
export function mapHTML(lang, rows, { ariaKey, aria = null, href = null, win = null, focus = null, width = null } = {}) {
  const f = frame(null);
  const marks = placedMarks(rows, f);

  const done = marks.filter((m) => m.row.visits > 0).length;
  const label = aria ?? t(lang, ariaKey, { done, todo: marks.length - done });

  let view = win ? windowRect(win) : { x: 0, y: 0, w: f.w, h: f.h };
  const k = view.w / f.w;
  if (focus && marks.length) {
    const w = view.w * focus, h = view.h * focus;
    view = {
      x: Math.min(Math.max(marks[0].x - w / 2, view.x), view.x + view.w - w),
      y: Math.min(Math.max(marks[0].y - h / 2, view.y), view.y + view.h - h),
      w, h
    };
  }

  const sizes = width ? fit(view.w / width, k) : { mark: 1, tap: 1 };

  /* Zoomed into the capital, the country's outline is the coarse one — it is
     simplified for a whole country in a phone column. So inside the capital's
     rectangle the map draws the capital's own detailed outline instead, taken
     back from the units it was cut in into the country's, and the country's
     outline is cut away there. Zoom into Reykjavík and Seltjarnarnes is the
     shape of Seltjarnarnes. */
  const cf = frame(CAPITAL), box = windowRect(CAPITAL);
  const hole = `M0 0H${f.w}V${f.h}H0Z M${num(box.x)} ${num(box.y)}h${num(box.w)}v${num(box.h)}h${num(-box.w)}Z`;

  return `<svg class="map-svg" viewBox="${num(view.x)} ${num(view.y)} ${num(view.w)} ${num(view.h)}" role="img" aria-label="${esc(label)}">` +
    `<rect class="map-sea" x="0" y="0" width="${f.w}" height="${f.h}"/>` +
    `<defs>` +
      `<clipPath id="map-country-outside"><path d="${hole}" clip-rule="evenodd"/></clipPath>` +
      `<clipPath id="map-country-inside"><rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.w)}" height="${num(box.h)}"/></clipPath>` +
    `</defs>` +
    `<path class="map-land" d="${COASTLINE}" stroke-width="${num(1.3 * k)}" clip-path="url(#map-country-outside)"/>` +
    `<g clip-path="url(#map-country-inside)">` +
      `<path class="map-land map-land--detail" d="${COASTLINE_CAPITAL}" data-zc="${num(cf.z)}" stroke-width="${num(1.3 * k * cf.z)}" ` +
      `transform="matrix(${num(1 / cf.z)} 0 0 ${num(1 / cf.z)} ${num(-cf.tx / cf.z)} ${num(-cf.ty / cf.z)})"/>` +
    `</g>` +
    `<g class="map-marks">${marksMarkup(lang, groupMarks(marks, k, sizes.mark), k, null, href, sizes.mark, sizes.tap)}</g>` +
    `</svg><div class="map-tip"></div>`;
}

/* ---------- zoom ---------- */

/* Zoom and pan, for a map drawn by mapHTML() into `container`.

   The map is small because the country is big and a phone is not, and badges
   only say that something is there. Zooming is how the somethings come apart:
   the drawing is re-grouped for every zoom, so a badge splits into its pools as
   the map gets closer, and tapping a badge flies straight to them.

   Gestures are chosen not to take the page hostage. On a phone a single finger
   still scrolls the page past the map until the map has been zoomed — then it
   pans, because there is nothing else it could mean — and two fingers pinch. On
   a laptop plain scrolling scrolls the page, and pinching the trackpad or
   holding ⌘ or Ctrl while scrolling zooms, which is what embedded maps have
   taught everyone to expect. Double-tap or double-click zooms in, and the
   buttons do all of it without a gesture at all.

   Grouping 126 pools takes about 4 ms on a laptop and several times that on a
   phone — too slow to redo on every frame of a pinch — so a grouping is worked
   out once per step of 10% in zoom and kept. The marks themselves are redrawn
   every frame, at the exact zoom, so they never change size under a finger.

   Call refresh() after every mapHTML(); the view survives the redraw, so the
   fifteen-second poll does not throw a zoomed map back out to the whole country.
   `href` is the one mapHTML() was given — the marks are redrawn from here. */
export function bindMapZoom(container, { maxZoom = 8, controls = null, href = null } = {}) {
  const f = frame(null);
  const STEP = 1.1;
  let lang = 'is', marks = [], groupsByStep = new Map();
  let view = { x: 0, y: 0, w: f.w, h: f.h };
  let pending = 0, flight = 0;

  const svg = () => container.querySelector('svg.map-svg');
  const zoom = () => f.w / view.w;
  /* How wide the map is actually drawn, which decides how big a mark has to be
     to be worth aiming at. Measured rather than assumed: the same map is a phone
     column, half a laptop board, or whatever the window has been dragged to. */
  const width = () => svg()?.getBoundingClientRect().width || VIEW.w;

  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hideTip = () => { const tip = container.querySelector('.map-tip'); if (tip) tip.dataset.show = '0'; };

  function clamp(v) {
    const z = Math.min(maxZoom, Math.max(1, f.w / v.w));
    const w = f.w / z, h = f.h / z;
    return { w, h, x: Math.min(f.w - w, Math.max(0, v.x)), y: Math.min(f.h - h, Math.max(0, v.y)) };
  }

  function groupsAt(z, mark) {
    const key = `${Math.round(Math.log(z) / Math.log(STEP))}|${mark.toFixed(2)}`;
    if (!groupsByStep.has(key)) {
      groupsByStep.set(key, groupMarks(marks, 1 / STEP ** Math.round(Math.log(z) / Math.log(STEP)), mark));
    }
    return groupsByStep.get(key);
  }

  function draw() {
    pending = 0;
    const el = svg();
    if (!el) return;
    const z = zoom(), k = 1 / z;
    el.setAttribute('viewBox', `${num(view.x)} ${num(view.y)} ${num(view.w)} ${num(view.h)}`);
    el.toggleAttribute('data-zoomed', z > 1.001);
    for (const land of el.querySelectorAll('.map-land')) {
      land.setAttribute('stroke-width', num(1.3 * k * Number(land.dataset.zc ?? 1)));
    }
    const { mark, tap } = markScale(width());
    el.querySelector('.map-marks').innerHTML = marksMarkup(lang, groupsAt(z, mark), k, view, href, mark, tap);

    if (controls) {
      controls.querySelector('[data-zoom="in"]').disabled = z >= maxZoom - 0.001;
      controls.querySelector('[data-zoom="out"]').disabled = z <= 1.001;
      controls.querySelector('[data-zoom="reset"]').hidden = z <= 1.001;
    }
  }

  const soon = () => { if (!pending) pending = requestAnimationFrame(draw); };

  /* Page units under a point on the screen. */
  function toPage(clientX, clientY) {
    const r = svg().getBoundingClientRect();
    return {
      x: view.x + ((clientX - r.left) / r.width) * view.w,
      y: view.y + ((clientY - r.top) / r.height) * view.h,
      fx: (clientX - r.left) / r.width,
      fy: (clientY - r.top) / r.height
    };
  }

  /* To a view in a quarter of a second: zoom eased on a log scale, so each
     doubling takes as long as the last and a long zoom does not rush at the end. */
  function flyTo(target) {
    cancelAnimationFrame(flight);
    hideTip();
    target = clamp(target);
    if (reduced()) { view = target; draw(); return; }
    const from = view, t0 = performance.now(), ms = 260;
    const z0 = f.w / from.w, z1 = f.w / target.w;
    const c0 = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const c1 = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
    const frameStep = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = 1 - (1 - p) ** 3;
      const z = z0 * (z1 / z0) ** e;
      const w = f.w / z, h = f.h / z;
      view = clamp({ w, h, x: c0.x + (c1.x - c0.x) * e - w / 2, y: c0.y + (c1.y - c0.y) * e - h / 2 });
      draw();
      if (p < 1) flight = requestAnimationFrame(frameStep);
    };
    flight = requestAnimationFrame(frameStep);
  }

  function zoomBy(factor, at = { x: view.x + view.w / 2, y: view.y + view.h / 2, fx: 0.5, fy: 0.5 }) {
    const z = Math.min(maxZoom, Math.max(1, zoom() * factor));
    const w = f.w / z, h = f.h / z;
    flyTo({ w, h, x: at.x - at.fx * w, y: at.y - at.fy * h });
  }

  /* A badge's pools fill about half the view, and never less than twice as close
     as now — so a tap always gets somewhere, even on two pools the full zoom
     cannot part. */
  function flyToGroup(hit) {
    const x0 = Number(hit.dataset.x0), y0 = Number(hit.dataset.y0);
    const x1 = Number(hit.dataset.x1), y1 = Number(hit.dataset.y1);
    const share = Math.max((x1 - x0) / f.w, (y1 - y0) / f.h);
    const z = Math.min(maxZoom, Math.max(zoom() * 2, share > 0 ? 0.45 / share : maxZoom));
    const w = f.w / z, h = f.h / z;
    flyTo({ w, h, x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2 });
  }

  /* ---- pointer: drag to pan, two fingers to pinch, taps for everything else ---- */

  const pointers = new Map();
  let gesture = null, dragged = false, lastTap = null;

  container.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('svg.map-svg')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      cancelAnimationFrame(flight);
      gesture = {
        kind: 'pinch', view0: view, z0: zoom(),
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid0: toPage((a.x + b.x) / 2, (a.y + b.y) / 2)
      };
      hideTip();
    } else if (pointers.size === 1) {
      gesture = { kind: 'press', x: e.clientX, y: e.clientY, view0: view };
    }
  });

  container.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;

    if (gesture.kind === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const z = Math.min(maxZoom, Math.max(1, gesture.z0 * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0));
      const w = f.w / z, h = f.h / z;
      const r = svg().getBoundingClientRect();
      const fx = ((a.x + b.x) / 2 - r.left) / r.width, fy = ((a.y + b.y) / 2 - r.top) / r.height;
      view = clamp({ w, h, x: gesture.mid0.x - fx * w, y: gesture.mid0.y - fy * h });
      dragged = true;
      soon();
      return;
    }

    /* One pointer pans only once the map is zoomed, and only once it has moved
       far enough not to be a tap — a tap has to stay a tap, or no pool could be
       picked out of a zoomed map at all. */
    if ((gesture.kind === 'press' || gesture.kind === 'pan') && zoom() > 1.001) {
      const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
      if (gesture.kind === 'press' && Math.hypot(dx, dy) < 5) return;
      if (gesture.kind === 'press') {
        gesture = { ...gesture, kind: 'pan' };
        cancelAnimationFrame(flight);
        hideTip();
        container.setPointerCapture?.(e.pointerId);
        svg()?.classList.add('is-dragging');
      }
      const r = svg().getBoundingClientRect();
      view = clamp({
        ...gesture.view0,
        x: gesture.view0.x - (dx / r.width) * gesture.view0.w,
        y: gesture.view0.y - (dy / r.height) * gesture.view0.h
      });
      dragged = true;
      soon();
    }
  });

  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    svg()?.classList.remove('is-dragging');
    if (pointers.size === 1 && gesture?.kind === 'pinch') {
      /* One finger lifted from a pinch: carry on as a pan from where it is, so
         the map does not jump when the second finger comes off a moment later. */
      const [p] = [...pointers.values()];
      gesture = { kind: 'pan', x: p.x, y: p.y, view0: view };
      return;
    }
    if (pointers.size) return;

    /* A double tap on a phone. A double click has its own event below; a touch
       screen does not reliably send it once the page has taken the gestures.
       Not on a mark: a second tap on a pool opens its page, and a tap on a badge
       has already flown in to its pools. */
    if (e.type === 'pointerup' && e.pointerType === 'touch' && !dragged && !e.target.closest('.map-hit')) {
      const now = performance.now();
      if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        lastTap = null;
        zoomBy(2, toPage(e.clientX, e.clientY));
      } else {
        lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
    }
    gesture = null;
  };
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);

  container.addEventListener('click', (e) => {
    if (dragged) { dragged = false; return; }            // the end of a drag is not a tap
    const hit = e.target.closest('.map-hit.is-group');
    if (hit) flyToGroup(hit);
  });

  container.addEventListener('dblclick', (e) => {
    if (!e.target.closest('svg.map-svg') || e.target.closest('.map-hit')) return;
    e.preventDefault();
    zoomBy(2, toPage(e.clientX, e.clientY));
  });

  /* A trackpad pinch arrives as a scroll with Ctrl held; so does Ctrl-scroll on a
     mouse, and ⌘ is accepted alongside it on a Mac. A plain scroll is left to
     scroll the page. */
  container.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey) || !e.target.closest('svg.map-svg')) return;
    e.preventDefault();
    cancelAnimationFrame(flight);
    hideTip();
    const at = toPage(e.clientX, e.clientY);
    const z = Math.min(maxZoom, Math.max(1, zoom() * Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.01)));
    const w = f.w / z, h = f.h / z;
    view = clamp({ w, h, x: at.x - at.fx * w, y: at.y - at.fy * h });
    soon();
  }, { passive: false });

  controls?.addEventListener('click', (e) => {
    const button = e.target.closest('[data-zoom]');
    if (!button) return;
    if (button.dataset.zoom === 'in') zoomBy(2);
    if (button.dataset.zoom === 'out') zoomBy(0.5);
    if (button.dataset.zoom === 'reset') flyTo({ x: 0, y: 0, w: f.w, h: f.h });
  });

  /* The window narrows and a mark has to grow: what was aimable at on a laptop
     is not in a phone column, and the map is the same element either way. */
  if (typeof ResizeObserver === 'function') {
    let was = 0;
    new ResizeObserver(() => {
      const now = Math.round(width());
      if (now && now !== was) { was = now; soon(); }
    }).observe(container);
  }

  return {
    refresh(nextLang, rows) {
      lang = nextLang;
      marks = placedMarks(rows, f);
      groupsByStep = new Map();
      draw();
    }
  };
}

/* Hover on a pointer, tap on a phone. The tooltip is positioned in the
   container's pixels, so it has to be told what the browser actually scaled the
   viewBox down to and where the view has been panned to — neither is a constant:
   the column narrows with the window, and the map zooms. */
export function bindMapTooltip(container) {
  const show = (e) => {
    const hit = e.target.closest('.map-hit');
    const tip = container.querySelector('.map-tip');
    if (!hit || !tip) return;
    const svg = hit.ownerSVGElement;
    if (svg.classList.contains('is-dragging')) return;
    const box = container.getBoundingClientRect();
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scale = rect.width / vb.width;
    /* A finger gets told that a second tap opens the pool's page; a mouse
       needs no telling, since its first click does. */
    tip.textContent = hit.dataset.href && e.pointerType !== 'mouse'
      ? `${hit.dataset.tip} · ${hit.dataset.open}`
      : hit.dataset.tip;
    tip.dataset.show = '1';

    const x = rect.left - box.left + (Number(hit.getAttribute('cx')) - vb.x) * scale;
    const y = rect.top - box.top + (Number(hit.getAttribute('cy')) - vb.y) * scale;
    /* Kept inside the card. Unlike the chart's columns, which all stand in from
       the edge, a pool can sit in the last few pixels of the map — Ísafjörður
       and Neskaupstaður are within a millimetre of the frame — and a name
       centred on one of those would hang off the side of the page. Measured
       rather than guessed: the width is whatever the pool is called. */
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(Math.max(x, half + 2), box.width - half - 2)}px`;
    /* And flipped under the marker when there is no room above it, which is
       where the northernmost pools are: the tooltip would otherwise be drawn
       over the card's own heading. A fixed gap rather than a share of the
       tooltip's height — a badge's list is nine lines tall, and a quarter of
       that is a gap wide enough to lose track of which badge it belongs to. */
    const above = y - tip.offsetHeight - 10;
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

  /* A pool with a page opens it — on a mouse at the first click, since hovering
     has already said which pool it is, and on a finger at the second tap on the
     same pool, because the first tap is how a phone asks the question the hover
     answers. Taking the reader away on that first tap would leave the map with
     no way to find out what a mark is without leaving it.

     The same pool is known by where it leads rather than by its element: the
     marks are redrawn at every step of a zoom and on every poll, and a second
     tap on a redrawn mark is still a second tap. And the end of a drag is not a
     tap on whatever pool it happened to finish over. */
  let pointer = 'mouse', down = null, armed = null;
  container.addEventListener('pointerdown', (e) => {
    pointer = e.pointerType;
    down = { x: e.clientX, y: e.clientY };
  });
  container.addEventListener('click', (e) => {
    const hit = e.target.closest('.map-hit');
    const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= 5;
    if (!hit?.dataset.href || moved) { armed = null; return; }
    if (pointer === 'mouse' || armed === hit.dataset.href) {
      window.location.href = hit.dataset.href;
    } else {
      armed = hit.dataset.href;
    }
  });
}
