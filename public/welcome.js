/* The welcome wizard: the first thing a new account sees after signing up.

   1. A username, which is also the address of the public page. Suggested from
      the email address, the part before the @, and changeable here and later.
   2. The card: what it cost and when it runs, and what a punch card costs to
      compare it with. Skippable; ⚙ in the app has the same fields.
   3. Whether the page is public. Optional.

   Step 1 makes the profile, so someone who leaves after it has a working
   account and lands in the app next time; the later steps only change it. */

import { LANGS, LANG_NAMES, detectLang, t } from './lib/i18n.js';
import { DEFAULT_SETTINGS, updateSettings } from './lib/state.js';
import { BUILT_IN } from './lib/pools.js';
import * as cloud from './lib/cloud.js';

const LANG_KEY = 'sund.lang';
const STEPS = 3;

let lang = detectLang();
let username = '';
const el = (id) => document.getElementById(id);
const select = el('lang-select');
const form = (n) => el(`step-${n}`);
const warn = (n, text) => {
  const node = form(n).querySelector('.settings-warning');
  node.textContent = text || '';
  node.hidden = !text;
};

/* The part of the email before the @, made into something the database will
   take: lower case, accents off, anything else a dash, 3 to 30 long. */
export function suggestUsername(email) {
  let name = (email.split('@')[0] || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/ø/g, 'o')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
    .replace(/-+$/, '');
  while (name.length < 3) name += '0';
  return name;
}

function render() {
  document.documentElement.lang = lang;
  document.title = `Sund · ${t(lang, 'welcome.title')}`;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(lang, node.dataset.i18n);
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(lang, node.dataset.i18nAria));
  }
  for (let n = 1; n <= STEPS; n++) el(`step-label-${n}`).textContent = t(lang, 'welcome.step', { n, of: STEPS });
  const name = el('in-username').value || username || '…';
  el('username-lead').textContent = t(lang, 'welcome.usernameLead', { name });
  el('public-label').textContent = `${t(lang, 'welcome.public')} (sund.talva.is/${username || name})`;
}

function show(n) {
  for (let i = 1; i <= STEPS; i++) form(i).hidden = i !== n;
  form(n).querySelector('input')?.focus();
}

async function busy(n, work) {
  const buttons = form(n).querySelectorAll('button');
  buttons.forEach((b) => { b.disabled = true; });
  warn(n, '');
  try {
    return await work();
  } finally {
    buttons.forEach((b) => { b.disabled = false; });
  }
}

/* ---------- step 1: the username ---------- */

form(1).addEventListener('submit', (e) => {
  e.preventDefault();
  const wanted = el('in-username').value.trim().toLowerCase();
  busy(1, async () => {
    try {
      const today = new Date();
      const inAYear = new Date(today);
      inAYear.setFullYear(today.getFullYear() + 1);
      await cloud.rest('POST', 'profiles', {
        body: {
          username: wanted,
          lang,
          settings: {
            ...DEFAULT_SETTINGS,
            seasonStart: today.toISOString().slice(0, 10),
            seasonEnd: inAYear.toISOString().slice(0, 10),
            /* Every pool, written out: in the app a card with no list of its
               own covers only the pools the one-person version shipped with. */
            cardPools: BUILT_IN.map((p) => p.id)
          }
        }
      });
      username = wanted;
      await fillCard();
      render();
      show(2);
    } catch (err) {
      if (err.locked) { location.assign('/login.html?next=/welcome.html'); return; }
      warn(1, err.code === '23505' ? t(lang, 'welcome.taken')
        : err.code === '23514' ? t(lang, 'welcome.invalid')
        : t(lang, 'welcome.failed', { reason: err.message }));
    }
  });
});

el('in-username').addEventListener('input', render);

/* ---------- step 2: the card ---------- */

let settings = null;

async function fillCard() {
  const state = await cloud.fetchState();
  settings = state.settings;
  el('in-membership').value = settings.membership ?? '';
  el('in-season-start').value = settings.seasonStart ?? '';
  el('in-season-end').value = settings.seasonEnd ?? '';
  el('in-card-price').value = settings.cardPrice ?? '';
  el('in-card-trips').value = settings.cardTrips ?? '';
}

form(2).addEventListener('submit', (e) => {
  e.preventDefault();
  busy(2, async () => {
    try {
      await cloud.updateProfile({
        settings: updateSettings({ settings, rev: 0 }, {
          membership: Number(el('in-membership').value),
          seasonStart: el('in-season-start').value || null,
          seasonEnd: el('in-season-end').value || null,
          cardPrice: Number(el('in-card-price').value),
          cardTrips: Math.round(Number(el('in-card-trips').value))
        }).settings
      });
      show(3);
    } catch (err) {
      warn(2, t(lang, 'welcome.failed', { reason: err.message }));
    }
  });
});
form(2).querySelector('[data-skip]').addEventListener('click', () => show(3));

/* ---------- step 3: the public page ---------- */

form(3).addEventListener('submit', (e) => {
  e.preventDefault();
  busy(3, async () => {
    try {
      await cloud.updateProfile({ public_page: el('in-public').checked });
      location.replace('/app/');
    } catch (err) {
      warn(3, t(lang, 'welcome.failed', { reason: err.message }));
    }
  });
});

/* ---------- start ---------- */

for (const code of LANGS) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = LANG_NAMES[code];
  select.append(opt);
}
select.value = lang;
select.addEventListener('change', () => {
  if (!LANGS.includes(select.value)) return;
  lang = select.value;
  localStorage.setItem(LANG_KEY, lang);
  render();
});

if (!cloud.signedIn()) {
  location.replace('/login.html?next=/welcome.html');
} else {
  el('in-username').value = suggestUsername(cloud.me()?.email ?? '');
  render();
  show(1);
  /* Someone who already has a username has been through step 1; carry on from
     the card rather than asking for a name the database would refuse. */
  try {
    const profiles = await cloud.rest('GET', 'profiles?select=username');
    if (profiles.length) {
      username = profiles[0].username;
      await fillCard();
      render();
      show(2);
    }
  } catch (err) {
    if (err.locked) location.replace('/login.html?next=/welcome.html');
  }
}
