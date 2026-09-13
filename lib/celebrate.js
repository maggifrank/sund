/* The swag layer: a nudge in the hand, a face, and confetti at the numbers
   worth marking.

   All of it is decoration, and it is kept in one file so it stays that way.
   Nothing here reads or writes a count — the caller hands over the before and
   after numbers it already has — and every node it creates is aria-hidden,
   because the counter's aria-live output already announces the new number and
   a screen reader has no use for a paper rectangle falling past it.

   Each half degrades on its own: a device with no vibration motor gets the
   confetti without the buzz, and a device asking for reduced motion gets the
   buzz and a still emoji without anything flying across the screen. */

import { breakEvenTrips } from './state.js';

/* ---------- when a swim is worth a party ---------- */

/* 1, 10, 25 and 50 arrive close enough together to each be their own moment;
   after that every fiftieth swim is one. Breaking even on the year card beats
   all of them and is handled separately — that is the number this whole app
   exists to reach. */
const EARLY = [1, 10, 25, 50];
const STEP = 50;

const isMilestone = (n) => n > 0 && (EARLY.includes(n) || (n > 50 && n % STEP === 0));

/* The highest milestone in (before, after]. A tap only ever moves the count by
   one, so this is a formality — but a settings change can move the counted
   number by more than that, and jumping the 50th swim would be a poor way to
   find out. */
function milestoneCrossed(before, after) {
  for (let n = after; n > before; n--) if (isMilestone(n)) return n;
  return null;
}

/* A crossing is celebrated once. Tapping − and + again lands back on the same
   number, and a second faceful of confetti for the same 50th swim is a bug
   rather than a party, so the highest number already celebrated is remembered.
   Per card: change the dates or the prices and it is a different card, whose
   count starts again from nothing. */
const SEEN_KEY = 'sund.celebrated.v1';

const cardKey = (s) =>
  [s.seasonStart ?? '', s.seasonEnd ?? '', s.membership, s.cardPrice, s.cardTrips].join('~');

function seenHigh(card) {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY));
    return raw && raw.card === card && Number.isFinite(raw.high) ? raw.high : 0;
  } catch { return 0; }
}

function rememberHigh(card, high) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ card, high })); } catch { /* private mode */ }
}

/* Which party, if any: 'breakeven' | 'milestone' | 'first' | null. Pure, and
   exported so the rule can be read and checked without a browser. */
export function levelFor(before, after, be, seen = 0) {
  if (after <= before) return null;
  if (before < be && after >= be && be > seen) return 'breakeven';
  const hit = milestoneCrossed(before, after);
  if (hit === null || hit <= seen) return null;
  return hit === 1 ? 'first' : 'milestone';
}

/* ---------- emoji ---------- */

/* A swim deserves a face. The sets are deliberately mixed — a thumb, a party,
   some weather — so the same one does not come up twice in a row often enough
   to stop being a surprise; pick() makes sure it never does exactly. */
const EMOJI = {
  add: ['👍', '🏊', '🌊', '💪', '🎉', '😎', '🙌', '✨', '🔥', '⭐', '💧', '♨️', '🤩', '🥳', '🧖', '🦭'],
  remove: ['👎', '😬', '🫠', '😕', '🤷', '😅', '🙃', '💨', '🥲', '❄️', '😮‍💨', '🫤'],
  first: ['🎉', '🏊', '🌊', '✨'],
  milestone: ['🎉', '🥳', '🙌', '🏅', '🤩', '🎊'],
  breakeven: ['🏆', '🍾', '🎊', '👑', '💰']
};

const lastPick = new Map();

function pick(kind) {
  const pool = EMOJI[kind] ?? EMOJI.add;
  if (pool.length < 2) return pool[0];
  let choice;
  do { choice = pool[Math.floor(Math.random() * pool.length)]; }
  while (choice === lastPick.get(kind));
  lastPick.set(kind, choice);
  return choice;
}

/* Where to launch from. An element is the usual answer, but a caller whose
   button is about to be re-rendered out of existence — a history row's × — can
   measure it first and hand over the rectangle instead; a node that has left
   the document measures as 0×0 at the corner of the screen, which is not where
   the finger was. */
function rectOf(anchor) {
  if (!anchor) return null;
  if (typeof anchor.getBoundingClientRect === 'function') return anchor.getBoundingClientRect();
  return Number.isFinite(anchor.left) && Number.isFinite(anchor.top) ? anchor : null;
}

/* Floats up from whatever was tapped, then takes itself out of the document.
   Fixed rather than absolute: it lives for about a second, and anchoring it to
   the viewport means it does not have to care which panel it was launched from
   or how far that panel is scrolled. */
function popEmoji(anchor, emoji) {
  const box = rectOf(anchor);
  if (!box) return;
  const node = document.createElement('span');
  node.className = 'emoji-pop';
  node.setAttribute('aria-hidden', 'true');
  node.textContent = emoji;
  node.style.left = `${box.left + (box.width ?? 0) / 2}px`;
  node.style.top = `${box.top + (box.height ?? 0) / 2}px`;
  node.style.setProperty('--drift', `${Math.round(Math.random() * 44 - 22)}px`);
  node.style.setProperty('--spin', `${Math.round(Math.random() * 30 - 15)}deg`);
  document.body.append(node);
  node.addEventListener('animationend', () => node.remove());
  /* Animations can be off entirely — an extension, a headless browser, a
     rendering engine that never fires the event — and a stuck emoji would sit
     over the screen for the rest of the session. */
  setTimeout(() => node.remove(), 2000);
}

/* ---------- haptics ---------- */

/* Milliseconds of buzz, or an on/off pattern. The count going up is a single
   tick you barely notice; the count going down is two short apologetic ones;
   the milestones get something you can feel through a coat pocket. */
const BUZZ = {
  add: 14,
  remove: [10, 45, 10],
  first: [0, 18, 50, 32],
  milestone: [0, 25, 55, 25, 55, 70],
  breakeven: [0, 35, 45, 35, 45, 60, 70, 120, 60, 200]
};

/* Android fires these; iOS Safari has no Vibration API at all and simply will
   not, which is why nothing else in here depends on the buzz landing. */
export function haptic(kind) {
  try { navigator.vibrate?.(BUZZ[kind] ?? 14); } catch { /* blocked or unsupported */ }
}

/* ---------- confetti ---------- */

const reduced = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/* Pool blues, with gold, coral and green to carry against them. Fixed hues
   rather than the theme's tokens: --accent has to stay legible as UI chrome in
   both themes, which is the opposite of what confetti is for. */
const COLORS = ['#0d7ea8', '#35a8d6', '#7fd1e8', '#f5c542', '#f2764b', '#2fb67c', '#e85d9e', '#ffffff'];

const GRAVITY = 1150;          // px/s², about twice as brisk as real paper
const DRAG = 0.86;             // per second, applied as a decay below

let canvas = null;
let ctx = null;
let pieces = [];
let frame = 0;
let lastTime = 0;

function resize() {
  if (!canvas) return;
  /* Capped device pixel ratio: three phone-fulls of paper at 3× is a lot of
     fill for a mid-range phone, and nobody inspects a confetti edge. */
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  ctx = canvas.getContext('2d');
  resize();
  addEventListener('resize', resize);
}

/* The canvas is created for a burst and removed after the last piece lands, so
   an app that is mostly not celebrating carries no extra layer over it. */
function teardown() {
  removeEventListener('resize', resize);
  canvas?.remove();
  canvas = null;
  ctx = null;
  frame = 0;
  endPlay();
}

/* Both paths end here: the confetti's teardown calls it, and so do the layer's
   own two ways of standing down early. */
function endPlay() {
  const close = closePlay;
  closePlay = null;
  close?.();
}

/* One puff of paper. `spreadX` widens where the pieces start rather than where
   they are thrown, which is the difference between a fall across the whole
   screen and a clump dropped out of one point in the ceiling. */
function emit({ x, y, count, angle, spread, speed, size = 1, life = 3, spreadX = 0 }) {
  ensureCanvas();
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = speed * (0.55 + Math.random() * 0.75);
    pieces.push({
      x: x + (Math.random() - 0.5) * spreadX,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      w: (5 + Math.random() * 5) * size,
      h: (8 + Math.random() * 6) * size,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 14,
      tilt: Math.random() * Math.PI * 2,
      vt: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: life * (0.7 + Math.random() * 0.5)
    });
  }
  if (!frame) {
    lastTime = performance.now();
    frame = requestAnimationFrame(step);
  }
}

function step(now) {
  /* Clamped: come back to a backgrounded tab and the elapsed time is measured
     in minutes, which would teleport every piece somewhere below Iceland. */
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const decay = Math.pow(DRAG, dt);

  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const alive = [];
  for (const p of pieces) {
    p.vy += GRAVITY * dt;
    p.vx *= decay;
    p.vy *= decay;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.tilt += p.vt * dt;
    p.life -= dt;
    if (p.life <= 0 || p.y > innerHeight + 60) continue;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    /* The tumble: the piece turns edge-on and back, which is most of what
       makes a rectangle read as a scrap of paper rather than a brick. */
    ctx.scale(1, Math.cos(p.tilt));
    ctx.globalAlpha = Math.min(1, p.life * 1.4);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
    alive.push(p);
  }
  pieces = alive;

  if (pieces.length) frame = requestAnimationFrame(step);
  else teardown();
}

const UP = -Math.PI / 2;

/* Three sizes of party, from the tapped button for the small ones and from the
   corners of the screen for the one that matters. */
function confetti(level, anchor) {
  if (reduced() || document.hidden) return;
  openPlay();
  const box = rectOf(anchor);
  const x = box ? box.left + (box.width ?? 0) / 2 : innerWidth / 2;
  const y = box ? box.top + (box.height ?? 0) / 2 : innerHeight / 2;

  if (level === 'first') {
    emit({ x, y, count: 45, angle: UP, spread: Math.PI * 0.9, speed: 520, life: 2.4 });
    return;
  }
  if (level === 'milestone') {
    emit({ x, y, count: 90, angle: UP, spread: Math.PI * 1.1, speed: 680, life: 2.8 });
    setTimeout(() => emit({
      x: innerWidth / 2, y: -20, count: 50, angle: Math.PI / 2, spread: Math.PI * 0.9,
      speed: 120, life: 3.2, spreadX: innerWidth
    }), 140);
    return;
  }
  /* Break-even. The year card has just paid for itself, so: both corners, a
     pop over the counter, and a fall from the top of the screen that keeps
     arriving for a couple of seconds after the bangs. */
  emit({ x: 0, y: innerHeight, count: 120, angle: -Math.PI / 3.4, spread: Math.PI / 3, speed: 1500, size: 1.25, life: 4 });
  emit({ x: innerWidth, y: innerHeight, count: 120, angle: UP - Math.PI / 5.2, spread: Math.PI / 3, speed: 1500, size: 1.25, life: 4 });
  setTimeout(() => emit({ x, y, count: 110, angle: UP, spread: Math.PI * 1.2, speed: 820, size: 1.15, life: 3.5 }), 180);
  for (const delay of [420, 900, 1400]) {
    setTimeout(() => emit({
      x: innerWidth / 2, y: -20, count: 80, angle: Math.PI / 2, spread: Math.PI,
      speed: 160, size: 1.1, life: 4.5, spreadX: innerWidth
    }), delay);
  }
}

/* ---------- the celebration answers your fingers ---------- */

/* One tick per genuine tap is the ceiling, so the only way an iPhone feels a
   milestone as more than a single tap is to give it more than one tap worth
   making. While the paper is in the air, the whole screen is live: every tap
   throws another handful of confetti from your fingertip, and ticks.

   The two platforms get there differently, and the difference is not cosmetic.
   Android can simply listen — vibrate() needs no control under the finger — so
   it watches passively and intercepts nothing. iOS needs a real switch to be
   toggled by a real finger, so there the layer has to take the tap, which means
   it also has to hand it on: the tap still reaches whatever was underneath, or
   a swim logged during the confetti would be swallowed by the party. */

let closePlay = null;

function burstAt(x, y) {
  emit({ x, y, count: 26, angle: UP, spread: Math.PI * 1.15, speed: 620, life: 2.4 });
}

function openPlay() {
  if (closePlay || reduced()) return;

  if (!needsSwitchHaptics()) {
    const onTap = (e) => { haptic('add'); burstAt(e.clientX, e.clientY); };
    addEventListener('pointerdown', onTap, { passive: true });
    closePlay = () => removeEventListener('pointerdown', onTap);
    return;
  }

  const layer = document.createElement('span');
  layer.className = 'confetti-play';
  layer.setAttribute('aria-hidden', 'true');
  const tick = makeSwitch('confetti-play-switch');
  layer.append(tick);
  document.body.append(layer);

  tick.addEventListener('click', (e) => {
    burstAt(e.clientX, e.clientY);
    /* Blind the layer for the length of one lookup, so what comes back is the
       app underneath rather than the layer itself. */
    layer.style.pointerEvents = 'none';
    tick.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    layer.style.pointerEvents = '';
    tick.style.pointerEvents = '';
    if (under && under !== document.body && under !== document.documentElement) under.click();
  });

  /* A finger that moves is not playing, it is scrolling — and a layer over the
     whole screen would eat the gesture. Stand down at the first sign of it, so
     the page is back under the thumb rather than behind a party that has three
     seconds left to run. The timer is the same thought for the other case:
     however long the paper keeps falling, the screen is never captured for more
     than a moment. */
  const bail = () => endPlay();
  layer.addEventListener('touchmove', bail, { passive: true });
  const cap = setTimeout(bail, 6000);

  closePlay = () => {
    clearTimeout(cap);
    layer.removeEventListener('touchmove', bail);
    layer.remove();
  };
}

/* ---------- the counter's own little jump ---------- */

/* Restarted by hand rather than by re-adding the class, because the browser
   will not replay an animation on a class it already has — which is exactly
   the case that matters, two taps in a row. */
export function bump(node, dir) {
  if (!node || reduced()) return;
  node.classList.remove('is-bumped-up', 'is-bumped-down');
  void node.offsetWidth;
  node.classList.add(dir === 'down' ? 'is-bumped-down' : 'is-bumped-up');
}

/* ---------- iOS: borrowing a tick from a switch ---------- */

/* Safari has never implemented the Vibration API, so on an iPhone haptic()
   above is a no-op. There is one way left in: WebKit's native switch control,
   `<input type="checkbox" switch>` (Safari 17.4), plays the system tick when a
   finger toggles it. Lay a real one invisibly over a button and the tap lands
   on the switch, so iOS ticks — while the button still does its job.

   What this cannot do is worth stating plainly, because it decides the shape
   of everything below:

   - It is one fixed tick. No duration, no intensity, no pattern, so the
     milestone and break-even rhythms stay Android-only; an iPhone feels the
     same tap it feels for any other swim.
   - iOS 26.5 closed the script path: a tick now needs a real finger on the
     control, which is why this is an overlay rather than a call.
   - The control has to keep its native rendering to tick at all. Invisible is
     fine; restyled is not.

   It is a side effect of a native control rather than an API, and Apple has
   already narrowed it once, so it is gated on the exact thing it exploits and
   fails silently the moment that is gone. Note the first gate: the day Safari
   ships navigator.vibrate, this turns itself off in favour of the real API. */

/* The control itself. Native and unrestyled apart from being invisible, which
   is a condition of the tick; aria-hidden and out of the tab order, because the
   thing underneath is still the control as far as anyone reading the page is
   concerned. */
function makeSwitch(className) {
  const el = document.createElement('input');
  el.type = 'checkbox';
  el.setAttribute('switch', '');
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  return el;
}

const supportsSwitch = () => {
  if ('switch' in document.createElement('input')) return true;
  try { return CSS.supports('selector(::thumb)'); } catch { return false; }
};

let switchHaptics = null;
const needsSwitchHaptics = () => (switchHaptics ??=
  typeof navigator.vibrate !== 'function' && navigator.maxTouchPoints > 0 && supportsSwitch());

/* Wraps `button` and puts an invisible switch over it. The wrapper is built
   here rather than in the markup so that a device with a real vibration motor
   never carries the extra control at all, and so the whole hack stays in this
   file — it is one thing to delete when Apple takes it away.

   `radius` is the button's own corner radius: the overlay clips its hit-testing
   to match, so the square corners around a round button stay the button's.

   `fill` is how the wrapper should take the button's place in its parent's
   layout, and it is not cosmetic. The wrapper becomes the flex item or the
   block the button used to be, so a button that stretched to fill a row
   ('grow') or spanned its card ('block') collapses to its text without being
   told. It has to be said per control, because only the caller knows what the
   button was doing in the layout it is being lifted out of. */
export function attachTapHaptics(button, { radius = '50%', fill = 'inline' } = {}) {
  if (!button || button.dataset.haptic === 'on' || !needsSwitchHaptics()) return false;
  button.dataset.haptic = 'on';

  const wrap = document.createElement('span');
  wrap.className = `haptic-wrap haptic-wrap--${fill}`;
  wrap.style.setProperty('--haptic-radius', radius);
  button.replaceWith(wrap);
  wrap.append(button);

  const tick = makeSwitch('haptic-switch');
  wrap.append(tick);

  /* The tap toggled the switch, which is what made the tick; the button's own
     click never happened, because the finger never reached it. Forward it.
     Nothing here calls preventDefault: cancelling the toggle would take the
     tick with it, and a checkbox nobody can see has no state worth minding. */
  tick.addEventListener('click', () => {
    if (!button.disabled) button.click();
  });

  /* − is disabled with nothing to remove, and a switch that ticks over a dead
     button would be a lie in the hand. Mirrored by observation rather than by
     a call from render(), so the app does not have to know this exists. */
  const sync = () => { tick.disabled = button.disabled; };
  sync();
  new MutationObserver(sync).observe(button, { attributes: true, attributeFilter: ['disabled'] });
  return true;
}

/* The same, for controls the app rebuilds — a history row's × outlives one
   render and no more. Already-wrapped nodes are skipped by the flag above, so
   this can be called after every render without collecting overlays. */
export function attachTapHapticsAll(nodes, options) {
  if (!needsSwitchHaptics()) return;
  for (const node of nodes) attachTapHaptics(node, options);
}

/* ---------- what the app calls ---------- */

/* A swim went in. `before` and `after` are the counted card trips either side
   of the change, so a swim logged outside the card's dates or at a pool it
   does not cover gets the thumb and the buzz without pretending it moved the
   number — because it did not. */
export function celebrateAdd({ before, after, settings, anchor, counter }) {
  const card = cardKey(settings);
  const seen = seenHigh(card);
  const level = levelFor(before, after, breakEvenTrips(settings), seen);
  if (level) rememberHigh(card, Math.max(after, seen));
  haptic(level ?? 'add');
  popEmoji(anchor, pick(level ?? 'add'));
  bump(counter, 'up');
  if (level) confetti(level, counter ?? anchor);
  return level;
}

/* And one came out again. No confetti, no milestones — just a face that agrees
   with you about it. */
export function celebrateRemove({ anchor, counter } = {}) {
  haptic('remove');
  popEmoji(anchor, pick('remove'));
  bump(counter, 'down');
}
