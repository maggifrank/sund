/* The sign-in page, until there is anything to sign in to. */

import { LANGS, LANG_NAMES, detectLang, t } from './lib/i18n.js';

const LANG_KEY = 'sund.lang';
const EMAIL = 'sund@talva.is';

let lang = detectLang();
const select = document.getElementById('lang-select');
const contact = document.getElementById('contact');

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

render();
