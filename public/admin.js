/* The pool suggestion queue (supabase/migrations/…_pool_suggestions.sql).
   Every place someone names lands here once. For each the admin picks:

     Add     a new pool on the shared list, with this id, where the place is
     Merge   another name for a pool already on the list
     Reject  stays private to the person who named it

   Add and merge move every swim logged at the place to the pool. A pool that
   ends up with no details (address, hours, prices) is looked up on the web by
   the pool-details Edge Function, and what it finds is saved with
   set_pool_info(). */

import * as cloud from '../lib/cloud.js';

const list = document.getElementById('admin-list');
const status = document.getElementById('admin-status');
const allPools = document.getElementById('all-pools');
const detailsList = document.getElementById('admin-details');

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
      href: `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=16/${s.lat}/${s.lon}`,
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
  const said = state === 'busy' ? ' · searching the web, this takes a minute or two'
    : state ? ` · ${state}` : '';
  return node('li', {}, node('span', {}, node('strong', { textContent: name }), ` ${id}${said}`), button);
}

function drawDetails() {
  detailsList.replaceChildren(...(missing.size ? [...missing.keys()].map(detailsRow)
    : [node('li', {}, node('span', { className: 'note', textContent: 'Every pool has its details.' }))]));
}

async function loadDetails() {
  const pools = await cloud.rest('GET', 'pools?select=id,name,pool_info(pool_id)&order=name', { anon: true });
  const now = new Set();
  for (const p of pools) {
    if ([p.pool_info].flat().filter(Boolean).length) continue;
    now.add(p.id);
    if (!missing.has(p.id)) missing.set(p.id, { name: p.name, state: null });
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
    const { info } = await cloud.callFunction('pool-details', { pool: id });
    await cloud.rpc('set_pool_info', { p_pool: id, p_info: info });
    missing.delete(id);
    say(`Saved details for ${entry.name}. Check them on its page: /pool.html?id=${id}`);
  } catch (err) {
    entry.state = `not found: ${err.message}`;
  }
  drawDetails();
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
    await loadDetails();
  } catch (err) {
    if (err.locked) { location.replace('/login.html?next=/admin/'); return; }
    say(err.code === '42501' ? 'This page is for admins only.' : `Could not load the queue: ${err.message}`);
  }
}

start();
