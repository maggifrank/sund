/* The pool suggestion queue (supabase/migrations/…_pool_suggestions.sql).
   Every place someone names lands here once. For each the admin picks:

     Add     a new pool on the shared list, with this id, where the place is
     Merge   another name for a pool already on the list
     Reject  stays private to the person who named it

   Add and merge move every swim logged at the place to the pool. A pool that
   ends up with no details (address, hours, contacts) is looked up on
   OpenStreetMap (lib/osmlookup.js), and what it finds is saved with
   set_pool_info().

   Then the pools the nightly crawl found on sundlaugar.is that the app does
   not have (lib/newpools.js): each can be added, with the details its page
   has, once it has a position (add_pool()). One already added is offered its
   details again when the crawl reads newer ones.

   Below that, the pools sundlaugar.is has stopped listing (`delisted` in
   lib/poolinfo.js): still open, or closed? The answer is saved with
   set_pool_status(). */

import * as cloud from '../lib/cloud.js';
import { findPosition, lookUpOsm } from '../lib/osmlookup.js';
import { NEW_POOLS } from '../lib/newpools.js';
import { POOL_INFO } from '../lib/poolinfo.js';

const list = document.getElementById('admin-list');
const status = document.getElementById('admin-status');
const allPools = document.getElementById('all-pools');
const detailsList = document.getElementById('admin-details');
const listingList = document.getElementById('admin-listing');
const newList = document.getElementById('admin-new');

const say = (text) => { status.textContent = text; };

/* What the database takes as a pool id: lower case a–z, digits and dashes. */
export function poolId(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ð/gi, 'd').replace(/þ/gi, 'th').replace(/æ/gi, 'ae').replace(/ø/gi, 'o')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const metres = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function node(tag, props = {}, ...children) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children.filter((c) => c != null && c !== false));
  return n;
}

async function answer(card, s, action, pool) {
  const buttons = card.querySelectorAll('button');
  buttons.forEach((b) => { b.disabled = true; });
  try {
    const target = await cloud.rpc('resolve_suggestion', { p_id: s.id, p_action: action, p_pool: pool ?? null });
    const done = action === 'reject' ? `Left “${s.name}” private.`
      : action === 'add' ? `Added “${s.name}” as ${target}.`
        : `Merged “${s.name}” into ${target}.`;
    /* Read the queue again: a pool just added is what the next suggestion for
       the same place should be merged into, and only a fresh read offers it. */
    await load();
    say(`${done} ${status.textContent}`.trim());
    /* Not awaited: the queue can be answered while the lookup runs. */
    if (action !== 'reject') {
      loadDetails().then(() => { if (missing.has(target)) lookUp(target); }).catch(() => {});
    }
  } catch (err) {
    buttons.forEach((b) => { b.disabled = false; });
    say(err.code === '23505' ? `There is already a pool with the id ${pool}. Pick another.`
      : `That did not work: ${err.message}`);
  }
}

const empty = () => node('section', { className: 'card' }, node('p', { className: 'note', textContent: 'Nothing waiting.' }));

function card(s) {
  const c = node('section', { className: 'card admin-card' });
  const where = Number.isFinite(s.lat) && Number.isFinite(s.lon)
    ? node('a', {
      href: `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`,
      target: '_blank', rel: 'noopener', textContent: 'On the map'
    })
    : 'No position';
  c.append(
    node('h2', { textContent: s.name }),
    node('p', { className: 'note' },
      `${s.username ?? 'someone'} · ${day(s.createdAt)} · ${s.swims} ${s.swims === 1 ? 'swim' : 'swims'} · `, where)
  );

  if (s.similar.length) {
    c.append(node('p', { className: 'label', textContent: 'May be the same as' }));
    const ul = node('ul', { className: 'admin-similar' });
    for (const p of s.similar) {
      const how = [p.distance_m != null ? `${metres(p.distance_m)} away` : null,
                   p.likeness != null ? `${Math.round(p.likeness * 100)}% alike` : null].filter(Boolean).join(' · ');
      const merge = node('button', { type: 'button', className: 'ghost-btn', textContent: 'Merge' });
      merge.addEventListener('click', () => answer(c, s, 'merge', p.id));
      ul.append(node('li', {}, node('span', {}, node('strong', { textContent: p.name }), ` ${how}`), merge));
    }
    c.append(ul);
  }

  if (s.alsoSuggested.length) {
    c.append(node('p', { className: 'note admin-also' },
      'Also suggested nearby or by a similar name: ',
      s.alsoSuggested.map((o) => `${o.name} (${o.username ?? 'someone'})`).join(', '),
      '. Add one of them, and the others will offer it to merge into.'));
  }

  const id = node('input', { type: 'text', value: poolId(s.name), required: true, pattern: '[a-z0-9]+(-[a-z0-9]+)*', spellcheck: false });
  const add = node('form', { className: 'admin-row' },
    node('label', {}, 'New pool id', id),
    node('button', { type: 'submit', className: 'primary-btn', textContent: 'Add' }));
  add.addEventListener('submit', (e) => { e.preventDefault(); answer(c, s, 'add', id.value.trim()); });

  const other = node('input', { type: 'text', placeholder: 'pool id', spellcheck: false, required: true });
  other.setAttribute('list', 'all-pools');
  const merge = node('form', { className: 'admin-row' },
    node('label', {}, 'Merge into another pool', other),
    node('button', { type: 'submit', className: 'ghost-btn', textContent: 'Merge' }));
  merge.addEventListener('submit', (e) => { e.preventDefault(); answer(c, s, 'merge', other.value.trim()); });

  const reject = node('button', { type: 'button', className: 'danger-btn', textContent: 'Keep it private' });
  reject.addEventListener('click', () => answer(c, s, 'reject'));

  c.append(node('div', { className: 'settings admin-actions' }, add, merge, node('div', { className: 'settings-actions' }, reject)));
  return c;
}

/* ---------- pool details ---------- */

/* Shared pools with no pool_info row, by id, and what is happening to each. */
const missing = new Map();

function detailsRow(id) {
  const { name, state } = missing.get(id);
  const button = node('button', { type: 'button', className: 'ghost-btn', textContent: state === 'busy' ? 'Looking up…' : 'Look up' });
  button.disabled = state === 'busy';
  button.addEventListener('click', () => lookUp(id));
  const said = state === 'busy' ? ` · asking ${missing.get(id).asking ?? 'OpenStreetMap'}…`
    : state ? ` · ${state}` : '';
  return node('li', {}, node('span', {}, node('strong', { textContent: name }), ` ${id}${said}`), button);
}

function drawDetails() {
  detailsList.replaceChildren(...(missing.size ? [...missing.keys()].map(detailsRow)
    : [node('li', {}, node('span', { className: 'note', textContent: 'Every pool has its details.' }))]));
}

async function loadDetails() {
  const pools = await cloud.rest('GET', 'pools?select=id,name,lat,lon,pool_info(pool_id)&order=name', { anon: true });
  const now = new Set();
  for (const p of pools) {
    if ([p.pool_info].flat().filter(Boolean).length) continue;
    now.add(p.id);
    if (!missing.has(p.id)) missing.set(p.id, { name: p.name, lat: p.lat, lon: p.lon, state: null });
  }
  for (const id of missing.keys()) if (!now.has(id)) missing.delete(id);
  drawDetails();
}

async function lookUp(id) {
  const entry = missing.get(id);
  if (!entry || entry.state === 'busy') return;
  entry.state = 'busy';
  drawDetails();
  try {
    const info = await lookUpOsm(entry, { onTry: (host) => { entry.asking = host; drawDetails(); } });
    if (info) {
      await cloud.rpc('set_pool_info', { p_pool: id, p_info: info });
      missing.delete(id);
      say(`Saved details for ${entry.name} from OpenStreetMap. Check them on its page: /pool.html?id=${id}`);
    } else {
      entry.state = 'nothing on OpenStreetMap near it';
    }
  } catch (err) {
    entry.state = `lookup failed: ${err.message}`;
  }
  drawDetails();
}

/* ---------- pools new on the directory ---------- */

const fold = (s) => poolId(s ?? '');
const mapLink = (lat, lon, text = 'On the map') => node('a', {
  href: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`, target: '_blank', rel: 'noopener', textContent: text
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const withoutDates = ({ id, fetched, lat, lon, locatedBy, ...rest }) => rest;
/* What goes in pool_info: the page's details, not where the crawl placed it. */
const details = ({ lat, lon, locatedBy, ...rest }) => rest;

/* "64.12, -21.93", as Google Maps copies a position, or null. */
export function parsePosition(text) {
  const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const [lat, lon] = [Number(m[1]), Number(m[2])];
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

/* Each new pool, and the pool on the list it already is, if any: by id, or by
   name or another name of it. */
async function loadNew() {
  if (!NEW_POOLS.length) {
    newList.replaceChildren(node('p', { className: 'note', textContent: 'Nothing new on the directory.' }));
    return;
  }
  const pools = await cloud.rest('GET', 'pools?select=id,name,aliases,pool_info(info,fetched)', { anon: true });
  const listed = (p) => pools.find((q) => q.id === p.id
    || [q.name, ...(q.aliases ?? [])].some((n) => fold(n) === fold(p.name)));
  newList.replaceChildren(...NEW_POOLS.map((p) => newPool(p, listed(p))));
}

function newPool(p, onList) {
  const box = node('div', { className: 'admin-new-pool' });
  const kind = { pool: 'pool', lagoon: 'lagoon', natural: 'natural pool' }[p.kind] ?? p.kind;
  box.append(
    node('h3', {}, node('a', { href: p.source, target: '_blank', rel: 'noopener', textContent: p.name })),
    node('p', { className: 'note' }, [kind, p.region, p.address, `read ${day(p.fetched)}`].filter(Boolean).join(' · '))
  );

  if (onList) {
    const info = [onList.pool_info].flat().filter(Boolean)[0];
    const stale = !info || (info.fetched < p.fetched && !same(withoutDates(info.info), withoutDates(p)));
    const said = node('span', {}, 'On the list as ', node('a', { href: `/pool.html?id=${onList.id}`, textContent: onList.id }),
      stale ? '. The directory says something newer.' : '.');
    if (!stale) { box.append(node('p', { className: 'note' }, said)); return box; }
    const update = node('button', { type: 'button', className: 'ghost-btn', textContent: 'Update details' });
    update.addEventListener('click', async () => {
      update.disabled = true;
      try {
        await cloud.rpc('set_pool_info', { p_pool: onList.id, p_info: details(p) });
        say(`Updated the details of ${onList.name} from sundlaugar.is.`);
        await loadNew();
      } catch (err) {
        update.disabled = false;
        say(`That did not work: ${err.message}`);
      }
    });
    box.append(node('ul', { className: 'admin-similar' }, node('li', {}, said, update)));
    return box;
  }

  const id = node('input', { type: 'text', value: p.id, required: true, pattern: '[a-z0-9]+(-[a-z0-9]+)*', spellcheck: false });
  const where = node('input', { type: 'text', placeholder: '64.1466, -21.9426', required: true, spellcheck: false });
  const found = node('p', { className: 'note' });
  const find = node('button', { type: 'button', className: 'ghost-btn', textContent: 'Find again' });
  const BY = { address: 'Found by its address', name: 'Found by its name, not its address' };
  const show = (by) => {
    const pos = parsePosition(where.value);
    found.replaceChildren(...(pos ? [`${BY[by] ?? 'Position'}. Check it: `, mapLink(pos.lat, pos.lon)] : []));
  };
  where.addEventListener('input', () => show());
  /* The crawl places each new pool when it finds it; a pool it could not place
     is looked for again here, as soon as the section opens. */
  const search = async () => {
    find.disabled = true;
    found.textContent = 'Looking for it on OpenStreetMap…';
    try {
      const pos = await findPosition(p);
      if (pos) {
        where.value = `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}`;
        show(pos.by);
      } else {
        found.textContent = 'OpenStreetMap does not know where it is. Type a position to add it.';
      }
    } catch (err) {
      found.textContent = `The search failed: ${err.message}`;
    }
    find.disabled = false;
  };
  find.addEventListener('click', search);
  if (p.lat != null && p.lon != null) {
    where.value = `${p.lat}, ${p.lon}`;
    show(p.locatedBy);
  } else {
    search();
  }

  const add = node('form', { className: 'settings admin-actions' },
    node('div', { className: 'admin-row' }, node('label', {}, 'Position', where), find),
    found,
    node('div', { className: 'admin-row' }, node('label', {}, 'New pool id', id),
      node('button', { type: 'submit', className: 'primary-btn', textContent: 'Add' })));
  add.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pos = parsePosition(where.value);
    if (!pos) { say('The position is two numbers, latitude and longitude, like 64.1466, -21.9426.'); return; }
    const buttons = add.querySelectorAll('button');
    buttons.forEach((b) => { b.disabled = true; });
    try {
      const target = await cloud.rpc('add_pool', {
        p_id: id.value.trim(), p_name: p.name, p_lat: pos.lat, p_lon: pos.lon, p_region: p.region, p_info: details(p)
      });
      say(`Added ${p.name} as ${target}, with its details from sundlaugar.is. Its page: /pool.html?id=${target}`);
      await loadNew();
    } catch (err) {
      buttons.forEach((b) => { b.disabled = false; });
      say(err.code === '23505' ? `There is already a pool with the id ${id.value.trim()}. Pick another.`
        : `That did not work: ${err.message}`);
    }
  });
  box.append(add);
  return box;
}

/* ---------- pools the directory dropped ---------- */

/* Asked about until an admin answers on or after the day the crawl found the
   pool missing; a pool that drops off again later is asked about again. */
async function loadListing() {
  const delisted = POOL_INFO.filter((p) => p.delisted);
  if (!delisted.length) {
    listingList.replaceChildren(node('li', {}, node('span', { className: 'note', textContent: 'Every pool is listed.' })));
    return;
  }
  const ids = delisted.map((p) => `"${p.id}"`).join(',');
  const rows = await cloud.rest('GET', `pools?select=id,status,checked_on&id=in.(${encodeURIComponent(ids)})`, { anon: true });
  const answered = new Map(rows.map((r) => [r.id, r]));
  const items = delisted.map((p) => {
    const row = answered.get(p.id);
    const said = row?.checked_on && row.checked_on >= p.delisted
      ? (row.status === 'closed' ? ' · marked closed' : ' · still open')
      : '';
    const text = node('span', {},
      node('a', { href: `/pool.html?id=${p.id}`, textContent: p.name }),
      ` · gone from the directory ${day(p.delisted)}, last read ${day(p.fetched)}${said}`);
    if (said) return node('li', {}, text);
    const open = node('button', { type: 'button', className: 'ghost-btn', textContent: 'Still open' });
    const shut = node('button', { type: 'button', className: 'danger-btn', textContent: 'Closed' });
    open.addEventListener('click', () => setStatus(p, 'open', [open, shut]));
    shut.addEventListener('click', () => {
      if (confirm(`Mark ${p.name} closed? It leaves the front page, and its page says it has closed.`)) setStatus(p, 'closed', [open, shut]);
    });
    return node('li', {}, text, node('span', { className: 'admin-pair' }, open, shut));
  });
  listingList.replaceChildren(...items);
}

async function setStatus(pool, value, buttons) {
  buttons.forEach((b) => { b.disabled = true; });
  try {
    await cloud.rpc('set_pool_status', { p_pool: pool.id, p_status: value });
    say(value === 'closed' ? `Marked ${pool.name} closed.` : `${pool.name} stays, as open.`);
    await loadListing();
  } catch (err) {
    buttons.forEach((b) => { b.disabled = false; });
    say(`That did not work: ${err.message}`);
  }
}

/* ---------- start ---------- */

async function load() {
  const queue = await cloud.rpc('admin_suggestions');
  list.replaceChildren(...(queue.length ? queue.map(card) : [empty()]));
  say(queue.length ? `${queue.length} waiting, oldest first.` : '');
}

async function start() {
  if (!cloud.signedIn()) { location.replace('/login.html?next=/admin/'); return; }
  say('Loading…');
  try {
    const pools = await cloud.rest('GET', 'pools?select=id,name&order=name', { anon: true });
    allPools.replaceChildren(...pools.map((p) => node('option', { value: p.id, label: p.name })));
    await load();
    await loadNew().catch((err) => {
      newList.replaceChildren(node('p', { className: 'note', textContent: `Could not check: ${err.message}` }));
    });
    await loadDetails();
    await loadListing().catch((err) => {
      listingList.replaceChildren(node('li', {}, node('span', { className: 'note', textContent: `Could not check: ${err.message}. Has the pool status migration run?` })));
    });
  } catch (err) {
    if (err.locked) { location.replace('/login.html?next=/admin/'); return; }
    say(err.code === '42501' ? 'This page is for admins only.' : `Could not load the queue: ${err.message}`);
  }
}

start();
