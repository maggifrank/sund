/* The pool "passport": which pools have been swum in and since when, and how
   many weeks in a row there has been a swim at all. Nothing here is saved —
   both are read off the trips the counter already logs, so a swim backdated,
   deleted or re-pooled in the history moves them the same moment it moves the
   count. Pure functions, like state.js, so they can be run under plain node. */

import { tripAt, dateKey, dateFromKey } from './state.js';
import { t, plural } from './i18n.js';

/* The Monday that starts the local week a moment falls in, as YYYY-MM-DD.
   Monday first, as the weekday pie has it. Stepped from local midday so a
   daylight-saving change on the Sunday can never tip the answer into the day
   before — Iceland has none, but a phone abroad does. */
function weekOf(value) {
  const day = dateKey(value);
  if (day === null) return null;
  const d = dateFromKey(day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d);
}

const weekBefore = (key) => {
  const d = dateFromKey(key);
  d.setDate(d.getDate() - 7);
  return dateKey(d);
};

/* A streak is counted in weeks, not days: nobody swims every day, and a daily
   streak would be broken by the first rest day and mean nothing after that.
   A week counts if there was one swim in it, anywhere — card or not, pool or
   not, because the question is whether the swimming is regular, not what it
   cost.

   The week under way has not had its chance yet, so a streak that reached last
   week is still alive on a Monday morning; `pending` says this week is the one
   that has to be swum to keep it. Two weeks without a swim and it is 0.
   `best` is the longest run there has ever been, the current one included. */
export function weekStreak(trips, now = new Date()) {
  const weeks = new Set();
  for (const trip of trips) {
    const w = weekOf(tripAt(trip));
    if (w) weeks.add(w);
  }

  let best = 0;
  for (const w of weeks) {
    if (weeks.has(weekBefore(w))) continue;       // only count from a run's first week
    let len = 0;
    for (let k = w; weeks.has(k); ) {
      len++;
      const d = dateFromKey(k);
      d.setDate(d.getDate() + 7);
      k = dateKey(d);
    }
    best = Math.max(best, len);
  }

  const thisWeek = weekOf(now);
  const pending = !weeks.has(thisWeek);
  let current = 0;
  for (let k = pending ? weekBefore(thisWeek) : thisWeek; weeks.has(k); k = weekBefore(k)) current++;

  return { current, best, pending: pending && current > 0 };
}

/* One stamp per pool swum in, oldest first, the way a passport fills up:
   { id, name, first, last, visits }, `first` and `last` being the trips'
   timestamps. Trips with no pool leave no stamp — there is nowhere to put it.
   `names` resolves an id to what the rest of the page calls it; an id it does
   not know keeps the id, as the pool table does. */
export function stamps(trips, names = new Map()) {
  const byPool = new Map();
  for (const trip of trips) {
    if (!trip.pool) continue;
    const at = tripAt(trip);
    const stamp = byPool.get(trip.pool);
    if (!stamp) {
      byPool.set(trip.pool, { id: trip.pool, name: names.get(trip.pool) ?? trip.pool, first: at, last: at, visits: 1 });
    } else {
      stamp.visits++;
      if (at < stamp.first) stamp.first = at;
      if (at > stamp.last) stamp.last = at;
    }
  }
  return [...byPool.values()].sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : 0));
}

/* The streak as one line, for both pages that show it: "Swum 5 weeks in a row
   · best 8", with a nudge when this week still has to be swum. Null when there
   has never been a swim, since "no streak" says nothing to someone who has not
   started. The best run is only mentioned when it is not the current one. */
export function streakText(lang, { current, best, pending }) {
  if (best === 0) return null;
  const parts = [current > 0
    ? t(lang, 'streak.on', { weeks: plural(lang, current, 'week') })
    : t(lang, 'streak.none')];
  if (pending) parts.push(t(lang, 'streak.keep'));
  if (best > current) parts.push(t(lang, 'streak.best', { weeks: plural(lang, best, 'week') }));
  return parts.join(' · ');
}
