/* Counts a visit to the 2.0 site: one page load, and whether this browser has
   been counted today or ever before (supabase/migrations/…_visit_counts.sql).
   All that is sent is those two yes-or-nos. The browser remembers only the
   date it was last counted, which never leaves it.

   bin/build-web.mjs adds this to every page it builds; pages served by
   serve.js never load it. */

import { SUPABASE_URL, SUPABASE_KEY } from './cloud.js';

const KEY = 'sund.visit';

function count() {
  if (navigator.webdriver) return;            // headless browsers, not people
  const today = new Date().toISOString().slice(0, 10);
  let last = null;
  try {
    last = localStorage.getItem(KEY);
    localStorage.setItem(KEY, today);
  } catch {
    last = today;                             // no storage: count the view only
  }
  fetch(`${SUPABASE_URL}/rest/v1/rpc/count_visit`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_today: last !== today, p_new: last === null })
  }).catch(() => {});
}

count();
