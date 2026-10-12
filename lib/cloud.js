/* Sund 2.0's backend: Supabase, spoken to with plain fetch so the front end
   keeps its zero dependencies. Sign-in is Supabase Auth's redirect flow; the
   data is PostgREST, with row-level security deciding what each person sees
   (supabase/migrations). Every page that talks to Supabase goes through here.

   The project's address and publishable key are meant to be public: every
   visitor's browser needs them to talk to Supabase at all, and on their own
   they reach only what the privacy rules let an anonymous visitor read. The
   secret service_role key never belongs anywhere in this repository.

   A page opts in with <meta name="sund-backend" content="supabase">, which
   bin/build-web.mjs adds to every page of the 2.0 site. Without it the pages
   still talk to serve.js as they always have. */

import { normalize } from './state.js';
import { BUILT_IN, ABROAD } from './pools.js';
import { refreshThrough } from './rates.js';

export const SUPABASE_URL = 'https://nyblioaklfiqyxrftpzx.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_61cQKzj0hs1L9aNy2EWB_A_UsPT-ias';

const SESSION_KEY = 'sund.session';
const RATES_KEY = 'sund.rates';
const PAGE = 1000;                  // Supabase's default ceiling on rows per request

export const isCloud = () =>
  document.querySelector('meta[name="sund-backend"]')?.content === 'supabase';

const SHARED_IDS = new Set([...BUILT_IN, ...ABROAD].map((p) => p.id));

/* Every pool on the shared list, the built-in ones and any an admin has added
   from a suggestion since, as of the last read. */
let sharedIds = new Set(SHARED_IDS);

/* ---------- signing in ---------- */

/* Off to Google or Microsoft, by way of Supabase, and back to the sign-in page
   with the session in the address's #fragment, which takeSession() reads. */
export function signIn(provider, next = '/app/') {
  const back = new URL('/login.html', location.origin);
  back.searchParams.set('next', next);
  const url = new URL('/auth/v1/authorize', SUPABASE_URL);
  url.searchParams.set('provider', provider);
  url.searchParams.set('redirect_to', back.href);
  // Microsoft gives no email address unless asked for one.
  if (provider === 'azure') url.searchParams.set('scopes', 'email');
  location.assign(url);
}

const save = (s) => {
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); }
  catch { /* private mode: signed in for this page only */ }
};
const load = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
};

let current = load();
let refreshing = null;

/* The session Supabase handed back in the #fragment, if there is one. Returns
   { ok } or { error } and clears the fragment either way, so the tokens do not
   sit in the address bar or the history. */
export function takeSession() {
  if (!location.hash.includes('access_token=') && !location.hash.includes('error')) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  if (p.get('error')) return { error: p.get('error_description') || p.get('error') };
  const expiresIn = Number(p.get('expires_in')) || 3600;
  current = {
    access_token: p.get('access_token'),
    refresh_token: p.get('refresh_token'),
    expires_at: Number(p.get('expires_at')) || Math.floor(Date.now() / 1000) + expiresIn
  };
  save(current);
  return { ok: true };
}

/* A token that is good for at least another minute, refreshed if need be, or
   null when nobody is signed in. Two calls at once share one refresh, because
   Supabase rotates the refresh token and the second would be refused. */
export async function accessToken() {
  if (!current?.refresh_token) return null;
  if (current.expires_at - 60 > Date.now() / 1000) return current.access_token;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: current.refresh_token })
      });
      if (res.status >= 400 && res.status < 500) { current = null; save(null); return null; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const s = await res.json();
      current = {
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600)
      };
      save(current);
      return current.access_token;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export const signedIn = () => Boolean(current?.refresh_token);

/* Who the token says this is: { id, email }. Read from the token itself, which
   Supabase signed; nothing here trusts it for more than a default username. */
export function me() {
  try {
    const part = current.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(decodeURIComponent(escape(atob(part))));
    return { id: claims.sub, email: claims.email ?? '' };
  } catch {
    return null;
  }
}

export async function signOut() {
  const token = current?.access_token;
  current = null;
  save(null);
  try { localStorage.removeItem('sund.cache.v2'); } catch { /* nothing to clear */ }
  if (token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }
}

/* ---------- talking to the database ---------- */

/* Errors carry the same flags app.js already acts on: `locked` sends the person
   to sign in, `fatal` drops a change the server will never accept rather than
   jamming the queue behind it. Anything else is a network blip, retried. */
export async function rest(method, path, { body, headers = {}, anon = false } = {}) {
  const token = anon ? null : await accessToken();
  if (!anon && !token) throw Object.assign(new Error('locked'), { locked: true });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      /* Only a signed-in person's token goes here. Supabase's publishable keys
         are not JWTs, and sent as a bearer token they are refused: an
         anonymous request carries the key in `apikey` alone. */
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) throw Object.assign(new Error('locked'), { locked: true });
  if (res.status >= 400 && res.status < 500) {
    const detail = await res.json().catch(() => ({}));
    throw Object.assign(new Error(detail.message || `Rejected (${res.status})`),
                        { fatal: true, code: detail.code, status: res.status });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const rpc = (name, args = {}, opts) => rest('POST', `rpc/${name}`, { body: args, ...opts });

/* An Edge Function, called as the signed-in person. Only /admin/ uses one:
   pool-details, which looks a pool up on the web. */
export async function callFunction(name, body) {
  const token = await accessToken();
  if (!token) throw Object.assign(new Error('locked'), { locked: true });
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || out.message || `HTTP ${res.status}`);
  return out;
}

/* Every row, a page at a time: Supabase stops at 1000 rows per request, and
   ten years of swimming is more than that. */
async function all(path) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const page = await rest('GET', `${path}&limit=${PAGE}&offset=${from}`);
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/* ---------- the signed-in person's state ---------- */

/* The places this person has named, by id, as of the last read. A swim's pool
   is either a shared pool's id or one of these. */
let places = new Map();
let profile = null;

export const currentProfile = () => profile;

/* A cheap fingerprint, so the app can tell whether anything changed since it
   last drew. app.js compares `rev` and nothing else. */
function fingerprint(value) {
  const s = JSON.stringify(value);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/* Everything the app draws, in the shape lib/state.js has always used, so the
   counter, the map and the pool pages work on Supabase unchanged. Throws
   { noProfile } for someone who has signed in but not yet picked a username. */
export async function fetchState() {
  const [profiles, trips, named, shared] = await Promise.all([
    rest('GET', 'profiles?select=user_id,username,display_name,public_page,settings,is_admin'),
    all('trips?select=at,pool_id,place_id,pool:pools(id,name,lat,lon)&order=at'),
    all('places?select=id,name,lat,lon,suggestion:pool_suggestions(status)&order=created_at'),
    all('pools?select=id,name,lat,lon&order=id')
  ]);
  profile = profiles[0] ?? null;
  if (!profile) throw Object.assign(new Error('no profile'), { noProfile: true });

  /* A place an admin has added to the shared list, or merged into a pool on
     it, is done with: its swims have moved to that pool, and the pool is what
     gets picked from now on. */
  const done = (p) => [p.suggestion].flat().some((s) => s && (s.status === 'added' || s.status === 'merged'));
  const mine = named.filter((p) => !done(p)).map(({ id, name, lat, lon }) => ({ id, name, lat, lon }));
  places = new Map(mine.map((p) => [p.id, p]));
  sharedIds = new Set([...SHARED_IDS, ...shared.map((p) => p.id)]);

  /* The added pools ride along with the person's own, so they can be picked
     and found by position; the built-in ones the app already knows. */
  const pools = new Map(shared.filter((p) => !SHARED_IDS.has(p.id)).map((p) => [p.id, p]));
  for (const p of mine) pools.set(p.id, p);
  for (const t of trips) if (t.pool) pools.set(t.pool.id, t.pool);

  const raw = {
    trips: trips.map((t) => {
      const at = new Date(t.at).toISOString();
      const pool = t.pool_id ?? t.place_id;
      return pool ? { at, pool } : { at };
    }),
    pools: [...pools.values()].map(({ id, name, lat, lon }) =>
      (lat != null && lon != null ? { id, name, lat, lon } : { id, name })),
    settings: profile.settings ?? {}
  };
  return { ...raw, rev: fingerprint([raw, profile.username, profile.public_page]) };
}

/* A pool from the app — a shared one, one of this person's places, or a name
   just typed in — as the two columns a swim stores it in. A new name becomes a
   new private place; the same name again reuses it. */
async function poolColumns(pool) {
  if (!pool) return { pool_id: null, place_id: null };
  if (places.has(pool.id)) return { pool_id: null, place_id: pool.id };
  if (sharedIds.has(pool.id)) return { pool_id: pool.id, place_id: null };
  const same = [...places.values()].find((p) => p.name.toLowerCase() === pool.name.trim().toLowerCase());
  if (same) return { pool_id: null, place_id: same.id };
  const [made] = await rest('POST', 'places', {
    body: {
      name: pool.name.trim(),
      ...(Number.isFinite(pool.lat) && Number.isFinite(pool.lon) ? { lat: pool.lat, lon: pool.lon } : {})
    },
    headers: { Prefer: 'return=representation' }
  });
  places.set(made.id, made);
  return { pool_id: null, place_id: made.id };
}

const atFilter = (at) => `at=eq.${encodeURIComponent(new Date(at).toISOString())}`;

/* The same operations app.js queues for serve.js, each answered with the whole
   state afterwards, as serve.js answers. `confirmed()` is the app's last
   confirmed state, which is also the server's as of the last read. */
export function requests(confirmed) {
  return {
    async add(op) {
      /* Swims are addressed by their time, so no two may share one. Two swims
         backdated to the same day both land on its midday; move the newcomer a
         millisecond on, as lib/state.js does. */
      const taken = new Set(confirmed().trips.map((t) => t.at));
      let at = Date.parse(op.at ?? new Date().toISOString());
      while (taken.has(new Date(at).toISOString())) at += 1;
      const body = { at: new Date(at).toISOString(), client_id: op.cid ?? crypto.randomUUID(),
                     ...(await poolColumns(op.pool)) };
      try {
        await rest('POST', 'trips', { body });
      } catch (err) {
        // Already there: the first try got through and only its answer was lost.
        if (err.code !== '23505') throw err;
      }
      return fetchState();
    },
    async remove() {
      const last = confirmed().trips.at(-1);
      if (last) await rest('DELETE', `trips?${atFilter(last.at)}`);
      return fetchState();
    },
    async removeAt(op) {
      await rest('DELETE', `trips?${atFilter(op.at)}`);
      return fetchState();
    },
    async setPool(op) {
      await rest('PATCH', `trips?${atFilter(op.at)}`, { body: await poolColumns(op.pool) });
      return fetchState();
    },
    async clear() {
      await rest('DELETE', `trips?user_id=eq.${profile.user_id}`);
      return fetchState();
    },
    async settings(op) {
      const settings = normalize({ settings: { ...confirmed().settings, ...op.patch } }).settings;
      await rest('PATCH', `profiles?user_id=eq.${profile.user_id}`, { body: { settings } });
      return fetchState();
    }
  };
}

/* ---------- the account ---------- */

export const updateProfile = (patch) =>
  rest('PATCH', `profiles?user_id=eq.${profile.user_id}`, { body: patch });

export const deleteAccount = () => rpc('delete_my_account');

/* A Sund 1.0 export (the ⚙ Export button's file) into this account: its own
   pools become places, then every swim goes in at once. Only into an account
   with no swims yet; the database refuses anything else. */
export async function importExport(file) {
  const state = normalize(file);
  const placeFor = new Map();
  for (const pool of state.pools) {
    if (sharedIds.has(pool.id)) continue;
    if (!state.trips.some((t) => t.pool === pool.id)) continue;
    placeFor.set(pool.id, (await poolColumns(pool)).place_id);
  }
  const trips = state.trips.map((t) => ({
    at: t.at,
    pool_id: t.pool && sharedIds.has(t.pool) ? t.pool : null,
    place_id: t.pool ? placeFor.get(t.pool) ?? null : null,
    client_id: crypto.randomUUID()
  }));
  const n = await rpc('import_trips', { p_trips: trips });
  /* The card as it was set up there, with the built-in list written out: in
     Sund 2.0 a card with no list covers every pool. */
  const settings = { ...state.settings };
  if (!Array.isArray(file?.settings?.cardPools)) {
    settings.cardPools = BUILT_IN.filter((p) => p.card).map((p) => p.id);
  }
  await updateProfile({ settings });
  return n;
}

/* ---------- public pages ---------- */

/* The sums-only snapshot of someone's public page, in the shape bin/publish.mjs
   used to write to state.json, or null when there is no such page or it is
   switched off. The username is the first part of the address. */
export function publicSnapshot(username = location.pathname.split('/')[1]) {
  return rpc('public_profile', { p_username: decodeURIComponent(username || '') }, { anon: true });
}

/* The pools an admin has added to the shared list from a suggestion, which the
   built-in list in lib/pools.js does not know: their names and positions are
   public, like every pool's. Lets a public page place them and say whether they
   are abroad. */
export async function addedPools() {
  const rows = await rest('GET', 'pools?select=id,name,lat,lon,pool_info(info)&order=id', { anon: true });
  return rows.filter((p) => !SHARED_IDS.has(p.id)).map(({ id, name, lat, lon, pool_info: pi }) => ({
    id, name,
    ...(lat != null && lon != null ? { lat, lon } : {}),
    /* Opening hours and the rest, in lib/poolinfo.js's shape, where someone
       has looked them up. */
    ...([pi].flat()[0]?.info ? { info: { ...[pi].flat()[0].info, id } } : {})
  }));
}

/* Exchange rates straight from the ECB's feed, cached on this device for as
   long as serve.js cached them. Display only, so a failure is just no rates. */
export async function rates() {
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(RATES_KEY)); } catch { /* none yet */ }
  return refreshThrough(cache, (fresh) => {
    try { localStorage.setItem(RATES_KEY, JSON.stringify(fresh)); } catch { /* not kept */ }
  });
}
