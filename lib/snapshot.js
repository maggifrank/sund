/* Where a public page's numbers come from. The one-person site read a
   state.json that bin/publish.mjs wrote next to the page; on Sund 2.0 the same
   sums come from the database, for whichever username is in the address (see
   public_profile() in supabase/migrations). Same shape either way, so the
   pages draw it the same. Null when there is nothing to show. */

import * as cloud from './cloud.js';

const readJSON = async (path) => {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
};

export const loadSnapshot = () =>
  (cloud.isCloud() ? cloud.publicSnapshot().catch(() => null) : readJSON('./state.json'));

/* Pools added to the shared list since lib/pools.js was written; none on the
   one-person site. */
export const loadAddedPools = () =>
  (cloud.isCloud() ? cloud.addedPools().catch(() => []) : Promise.resolve([]));

/* Pools marked closed; none on the one-person site. */
export const loadClosedPools = () =>
  (cloud.isCloud() ? cloud.closedPools().catch(() => new Set()) : Promise.resolve(new Set()));

export const loadRates = () =>
  (cloud.isCloud() ? cloud.rates().catch(() => null) : readJSON('./rates.json'));
