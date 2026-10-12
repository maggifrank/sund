/* The Account part of the counter's ⚙ sheet, on Sund 2.0 only: who is signed
   in, the username and public page, an import from Sund 1.0, signing out and
   deleting the account. Bound once by app.js; the function it returns is
   called on every render and redraws from the profile the last read brought. */

import { t, plural } from './i18n.js';
import * as cloud from './cloud.js';

export function bindAccount({ lang, view, refresh }) {
  const el = (id) => document.getElementById(id);
  const ui = {
    section: el('account'), email: el('account-email'), form: el('account-username'),
    username: el('in-username'), public: el('in-public'), page: el('account-page'),
    importLabel: el('account-import'), import: el('in-import'), status: el('account-status'),
    signOut: el('sign-out'), del: el('delete-account')
  };
  ui.section.hidden = false;

  /* serve.js's note says the count is shared by every device pointed at one
     server; here it is the account that is shared. */
  const note = document.querySelector('[data-i18n="settings.note"]');
  if (note) note.dataset.i18n = 'settings.noteCloud';

  let message = '';
  const say = (text) => { message = text; draw(); };

  function draw() {
    const profile = cloud.currentProfile();
    const l = lang();
    ui.email.textContent = t(l, 'account.signedInAs', { email: cloud.me()?.email ?? '' });
    if (profile) {
      // Not while someone is typing a new one.
      if (document.activeElement !== ui.username) ui.username.value = profile.username;
      ui.public.checked = profile.public_page;
      const url = `${location.origin}/${profile.username}/`;
      ui.page.href = url;
      ui.page.textContent = t(l, 'account.pageLink', { url: url.replace(/^https?:\/\//, '') });
      ui.page.parentElement.hidden = !profile.public_page;
    }
    // A history comes in only before the first swim; after that it would be a second copy.
    ui.importLabel.hidden = view().trips.length > 0;
    ui.status.hidden = !message;
    ui.status.textContent = message;
  }

  ui.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wanted = ui.username.value.trim().toLowerCase();
    if (wanted === cloud.currentProfile()?.username) return;
    try {
      await cloud.updateProfile({ username: wanted });
      ui.username.blur();
      say(t(lang(), 'account.saved'));
      refresh();
    } catch (err) {
      say(err.code === '23505' ? t(lang(), 'welcome.taken')
        : err.code === '23514' ? t(lang(), 'welcome.invalid')
        : t(lang(), 'welcome.failed', { reason: err.message }));
    }
  });

  ui.public.addEventListener('change', async () => {
    try {
      await cloud.updateProfile({ public_page: ui.public.checked });
      say('');
      refresh();
    } catch (err) {
      ui.public.checked = !ui.public.checked;
      say(t(lang(), 'welcome.failed', { reason: err.message }));
    }
  });

  ui.import.addEventListener('change', async () => {
    const file = ui.import.files[0];
    ui.import.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const count = Array.isArray(data?.trips) ? data.trips.length : 0;
      if (!confirm(t(lang(), 'account.importConfirm', { trips: plural(lang(), count, 'trip') }))) return;
      const n = await cloud.importExport(data);
      say(t(lang(), 'account.importDone', { trips: plural(lang(), n, 'trip') }));
      refresh();
    } catch (err) {
      say(err.code === '55000' ? t(lang(), 'account.importOnlyEmpty')
        : t(lang(), 'account.importFailed', { reason: err.message }));
    }
  });

  ui.signOut.addEventListener('click', async () => {
    await cloud.signOut();
    location.assign('/');
  });

  ui.del.addEventListener('click', async () => {
    const name = cloud.currentProfile()?.username;
    if (!name) return;
    const typed = prompt(t(lang(), 'account.deleteConfirm'), '');
    if (typed === null || typed.trim().toLowerCase() !== name) return;
    try {
      await cloud.deleteAccount();
      await cloud.signOut();
      location.assign('/');
    } catch (err) {
      say(t(lang(), 'welcome.failed', { reason: err.message }));
    }
  });

  return draw;
}
