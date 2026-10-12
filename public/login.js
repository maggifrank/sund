/* Signing in and signing up, which are the same thing: the first time someone
   comes back from Google or Microsoft, Supabase makes their account. Coming
   back lands here again with the session in the address, and from here a new
   account goes to the welcome wizard and an existing one to wherever it was
   headed (?next=, the counter by default). */

import { LANGS, LANG_NAMES, detectLang, t } from './lib/i18n.js';
import * as cloud from './lib/cloud.js';

const LANG_KEY = 'sund.lang';
const EMAIL = 'sund@talva.is';

let lang = detectLang();
let failure = null;               // why the last attempt did not work, or null
let working = false;
const select = document.getElementById('lang-select');
const contact = document.getElementById('contact');
const legal = document.getElementById('legal');
const status = document.getElementById('login-status');

/* Only a path on this site, so a crafted link cannot send someone elsewhere
   after they sign in. */
function nextPath() {
  const next = new URLSearchParams(location.search).get('next') || '/app/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/app/';
}

function render() {
  document.documentElement.lang = lang;
  document.title = `Sund · ${t(lang, 'login.title')}`;
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(lang, node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(lang, node.dataset.i18nAria));
  }
  for (const node of document.querySelectorAll('[data-i18n-title]')) {
    node.setAttribute('title', t(lang, node.dataset.i18nTitle));
  }
  /* The sentence is translated with the address as a placeholder, and the
     address is put back as a link — the string itself stays plain text. */
  const [before, after = ''] = t(lang, 'login.contact', { email: '\u0000' }).split('\u0000');
  const link = document.createElement('a');
  link.href = `mailto:${EMAIL}`;
  link.textContent = EMAIL;
  contact.replaceChildren(before, link, after);

  /* The same for the terms and the privacy policy, two links in one sentence. */
  const parts = t(lang, 'login.legal', { terms: '\u0000terms\u0000', privacy: '\u0000privacy\u0000' }).split('\u0000');
  legal.replaceChildren(...parts.map((part) => {
    if (part !== 'terms' && part !== 'privacy') return part;
    const a = document.createElement('a');
    a.href = `/${part}/`;
    a.textContent = t(lang, `legal.${part}`);
    return a;
  }));

  status.hidden = !working && !failure;
  status.textContent = working ? t(lang, 'login.working')
    : failure ? t(lang, 'login.failed', { reason: failure }) : '';
  /* The one-person site's copy of this page (bin/publish.mjs) has nothing to
     sign in to, so its buttons stay off. */
  for (const button of document.querySelectorAll('[data-provider]')) button.disabled = working || !cloud.isCloud();
}

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

for (const button of document.querySelectorAll('[data-provider]')) {
  button.addEventListener('click', () => {
    working = true;
    render();
    cloud.signIn(button.dataset.provider, nextPath());
  });
}

/* Already signed in, or just back from signing in: on to the account, or to
   the wizard if it has no username yet. */
async function carryOn() {
  working = true;
  render();
  try {
    const profiles = await cloud.rest('GET', 'profiles?select=user_id');
    location.replace(profiles.length ? nextPath() : '/welcome.html');
  } catch (err) {
    working = false;
    failure = err.locked ? null : err.message;
    render();
  }
}

const back = cloud.isCloud() ? cloud.takeSession() : null;
if (back?.error) failure = back.error;
render();
if (cloud.isCloud() && cloud.signedIn()) carryOn();
