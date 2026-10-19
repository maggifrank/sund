/* The private dashboard's records, year race and time of day, run under plain
   node: node --test tests/*.test.mjs */

import test from 'node:test';
import assert from 'node:assert/strict';
import { records, yearRace, hourCounts } from '../lib/insights.js';

const at = (y, m, d, h = 8) => ({ at: new Date(y, m - 1, d, h).toISOString() });
const NOW = new Date(2026, 9, 19, 9);   // Monday 19 October 2026

test('a day with no swim yet is not a break', () => {
  const r = records([at(2026, 10, 17), at(2026, 10, 18)], new Map(), NOW);
  assert.equal(r.gap, null);
  assert.equal(r.streak.ongoing, true);
});

test('the longest break and best month go to the latest on a tie', () => {
  const r = records([at(2026, 1, 1), at(2026, 1, 5), at(2026, 3, 1), at(2026, 3, 5), at(2026, 10, 18)], new Map(), NOW);
  assert.deepEqual(r.bestMonth, { key: '2026-03', count: 2 });
  assert.equal(r.gap.days, 226);
  assert.equal(r.gap.from, '2026-03-06');
  assert.equal(r.gap.to, '2026-10-17');
});

test('a weekly streak runs across a year end', () => {
  const r = records([at(2025, 12, 24), at(2025, 12, 31), at(2026, 1, 7)], new Map(), NOW);
  assert.equal(r.streak.weeks, 3);
  assert.equal(r.streak.ongoing, false);
});

test('the race stops at today and keeps a leap year whole', () => {
  const { today, years } = yearRace([at(2024, 2, 29), at(2024, 12, 31), at(2026, 1, 2)], NOW);
  assert.deepEqual(years.map((y) => [y.year, y.cum.length, y.cum.at(-1)]), [[2026, today + 1, 1], [2024, 366, 2]]);
});

test('backdated swims have no time of day', () => {
  const { hours, timed } = hourCounts([at(2026, 10, 1, 7), at(2026, 10, 2, 12), at(2026, 10, 3, 18)]);
  assert.equal(timed, 2);
  assert.equal(hours[12], 0);
});
