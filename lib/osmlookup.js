/* A pool's details from OpenStreetMap, for pools added at /admin/: free and
   with no key. The Overpass API finds the swimming places mapped near the
   pool's position, the best match gives its address, contacts, opening hours
   and a few facilities, and Nominatim fills in an address it lacks. What comes
   back has the shape lib/poolinfo.js uses, with only what OpenStreetMap knows:
   it rarely has prices, and its hours are only as fresh as its last edit.

   OpenStreetMap data is © OpenStreetMap contributors, under the ODbL; the pool
   page credits it (poolpage.sourceOsm). */

/* Overpass servers, tried in turn. The main one has started refusing some
   browsers with a bare 406 and no CORS header, which the browser reports as a
   network error; the others are public mirrors of the same API. */
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const RADIUS = 300;

const SWIMMING = '["leisure"~"^(swimming_pool|sports_centre|water_park|swimming_area|bathing_place)$"]';

export function overpassQuery(lat, lon) {
  return `[out:json][timeout:25];
(
  nwr(around:${RADIUS},${lat},${lon})${SWIMMING};
  nwr(around:${RADIUS},${lat},${lon})["amenity"="public_bath"];
  nwr(around:${RADIUS},${lat},${lon})["sport"="swimming"]["name"];
);
out tags center;`;
}

/* ---------- picking the feature ---------- */

const fold = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/[^a-z0-9]+/g, ' ').trim();

/* Shared words between two names, 0–1. Enough to tell "Odense Havnebad" from
   the gym across the road. */
function likeness(a, b) {
  const wa = new Set(fold(a).split(' ').filter((w) => w.length > 2));
  const wb = new Set(fold(b).split(' ').filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if ([...wb].some((x) => x.includes(w) || w.includes(x))) shared++;
  return shared / Math.min(wa.size, wb.size);
}

function metres(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const x = (lon2 - lon1) * r * Math.cos(((lat1 + lat2) / 2) * r);
  const y = (lat2 - lat1) * r;
  return Math.sqrt(x * x + y * y) * 6371000;
}

const USEFUL = ['website', 'contact:website', 'phone', 'contact:phone', 'email', 'contact:email',
  'opening_hours', 'addr:street', 'contact:facebook', 'contact:instagram'];

/* The best of the features found: a name like the pool's counts most, then
   how much it says, then how near it is. A pool basin with no tags of its own
   loses to the named centre it sits in. */
export function pickFeature(elements, pool) {
  let best = null;
  let bestScore = -Infinity;
  for (const el of elements ?? []) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const far = lat != null && pool.lat != null ? metres(pool.lat, pool.lon, lat, lon) : RADIUS;
    const score = likeness(tags.name, pool.name) * 10
      + USEFUL.filter((k) => tags[k]).length
      + (tags.name ? 1 : 0)
      - far / 100;
    if (score > bestScore) { best = el; bestScore = score; }
  }
  return best;
}

/* ---------- opening hours ---------- */

const DAY = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const IS_DAY = ['sunnudaga', 'mánudaga', 'þriðjudaga', 'miðvikudaga', 'fimmtudaga', 'föstudaga', 'laugardaga'];

function days(spec) {
  const out = new Set();
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    const from = ORDER.indexOf(DAY[m[1]]);
    const to = m[2] ? ORDER.indexOf(DAY[m[2]]) : from;
    for (let i = from; ; i = (i + 1) % 7) { out.add(ORDER[i]); if (i === to) break; }
  }
  return [...out];
}

function dayLabel(list) {
  const sorted = ORDER.filter((d) => list.includes(d));
  if (sorted.length === 7) return 'Alla daga';
  const first = sorted[0]; const last = sorted.at(-1);
  const run = ORDER.slice(ORDER.indexOf(first), ORDER.indexOf(last) + 1);
  if (sorted.length > 2 && run.length === sorted.length) {
    return `${IS_DAY[first][0].toUpperCase()}${IS_DAY[first].slice(1)} – ${IS_DAY[last]}`;
  }
  const words = sorted.map((d) => IS_DAY[d]);
  const text = words.length > 1 ? `${words.slice(0, -1).join(', ')} og ${words.at(-1)}` : words[0];
  return text[0].toUpperCase() + text.slice(1);
}

/* The everyday shapes of opening_hours: "Mo-Fr 06:30-22:00; Sa,Su 09:00-18:00",
   "24/7", "Mo-Su 10:00-12:00,14:00-20:00", "Su off". Holiday rules ("PH off")
   become a note. Anything else (months, weeks, sunrise) is too easy to get
   wrong, so null: no hours rather than wrong ones. */
export function parseOpeningHours(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const v = value.trim();
  if (v === '24/7') {
    return [{ label: 'Alla daga', days: [0, 1, 2, 3, 4, 5, 6], season: null, closed: false, times: ['00:00–24:00'], extra: null }];
  }
  const rows = [];
  const notes = [];
  for (const rule of v.split(';').map((s) => s.trim()).filter(Boolean)) {
    if (/^PH\b/.test(rule)) { notes.push(/off|closed/.test(rule) ? 'Lokað á helgidögum.' : `Á helgidögum: ${rule.replace(/^PH\s*/, '')}`); continue; }
    const m = rule.match(/^([A-Za-z,-]+)\s+(.+)$/);
    if (!m) return null;
    const list = days(m[1]);
    if (!list) return null;
    const closed = /^(off|closed)$/.test(m[2]);
    const times = closed ? [] : m[2].split(',').map((s) => s.trim());
    if (!closed && !times.every((x) => /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(x))) return null;
    /* A later rule for a day replaces an earlier one, as in OpenStreetMap. */
    for (const row of rows) row.days = row.days.filter((d) => !list.includes(d));
    rows.push({ label: '', days: list, season: null, closed, times: times.map((x) => x.replace('-', '–')), extra: null });
  }
  const kept = rows.filter((row) => row.days.length).map((row) => ({ ...row, label: dayLabel(row.days) }));
  return kept.length ? { rows: kept, notes } : null;
}

/* ---------- the details ---------- */

const web = (v) => { try { return v && /^https?:$/.test(new URL(v).protocol) ? v : null; } catch { return null; } };
const social = (v, site) => (v ? web(v) ?? `https://www.${site}.com/${v.replace(/^@/, '')}` : null);

export function osmToInfo(feature, pool, today, address = null) {
  const tags = feature.tags ?? {};
  const street = tags['addr:street'] ? [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') : null;
  const town = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  const facilities = [];
  const indoor = tags.indoor === 'yes' || tags.location === 'indoor' || tags.covered === 'yes';
  if (indoor) facilities.push('indoor');
  if (!indoor && ['swimming_pool', 'swimming_area', 'bathing_place'].includes(tags.leisure)) facilities.push('outdoor');
  if (tags.sauna === 'yes' || tags['amenity:sauna'] === 'yes') facilities.push('sauna');
  if (tags.wheelchair === 'yes') facilities.push('accessible');
  const hours = parseOpeningHours(tags.opening_hours);
  const length = Number.parseFloat(tags.length);
  const fee = tags.fee === 'no' ? 'Frítt' : null;
  return {
    name: pool.name,
    kind: ['swimming_area', 'bathing_place'].includes(tags.leisure) ? 'natural' : 'pool',
    source: `https://www.openstreetmap.org/${feature.type}/${feature.id}`,
    fetched: today,
    address: street ? [street, town].filter(Boolean).join(', ') : address,
    phone: tags.phone ?? tags['contact:phone'] ?? null,
    email: tags.email ?? tags['contact:email'] ?? null,
    web: web(tags.website ?? tags['contact:website'] ?? tags.url),
    facebook: social(tags['contact:facebook'] ?? tags.facebook, 'facebook'),
    instagram: social(tags['contact:instagram'] ?? tags.instagram, 'instagram'),
    longest: Number.isFinite(length) && length > 0 && length < 1000 ? length : null,
    facilities,
    hours: hours ? [{ kind: 'open', title: 'Afgreiðslutími', season: null, rows: hours.rows, notes: hours.notes.map((text) => ({ text })) }] : [],
    prices: fee ? { year: today.slice(0, 4), sections: [{ head: ['Stakt gjald'], rows: [['Allir', fee]] }] } : null,
    priceNotes: []
  };
}

/* Nominatim's address for a point, "Gamle Havnekaj 3, 5000 Odense C". */
export function addressFrom(place) {
  const a = place?.address;
  if (!a) return null;
  const street = [a.road ?? a.pedestrian ?? a.footway, a.house_number].filter(Boolean).join(' ');
  const town = [a.postcode, a.city ?? a.town ?? a.village ?? a.municipality].filter(Boolean).join(' ');
  return [street, town].filter(Boolean).join(', ') || null;
}

/* The elements an Overpass query finds, from the first server that answers. */
async function overpass(query, fetchImpl) {
  const failed = [];
  for (const url of OVERPASS) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`
      });
      if (res.ok) return (await res.json()).elements;
      failed.push(`${new URL(url).host} ${res.status}`);
    } catch (err) {
      failed.push(`${new URL(url).host} ${err.message}`);
    }
  }
  throw new Error(`no OpenStreetMap server answered (${failed.join('; ')})`);
}

/* The details, or null when OpenStreetMap has no swimming place near it. */
export async function lookUpOsm(pool, { fetchImpl = fetch, today = new Date().toISOString().slice(0, 10) } = {}) {
  if (pool.lat == null || pool.lon == null) throw new Error('the pool has no position');
  const feature = pickFeature(await overpass(overpassQuery(pool.lat, pool.lon), fetchImpl), pool);
  if (!feature) return null;
  let address = null;
  if (!feature.tags?.['addr:street']) {
    const lat = feature.lat ?? feature.center?.lat ?? pool.lat;
    const lon = feature.lon ?? feature.center?.lon ?? pool.lon;
    const r = await fetchImpl(`${NOMINATIM}?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lon}`).catch(() => null);
    if (r?.ok) address = addressFrom(await r.json());
  }
  return osmToInfo(feature, pool, today, address);
}
