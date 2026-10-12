/* node --test tests/*.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poolTerm } from '../lib/poolterms.js';

test('Icelandic is left as written', () => {
  assert.equal(poolTerm('is', 'Börn, 0 - 9 ára'), 'Börn, 0 - 9 ára');
});

test('who pays, for what', () => {
  assert.equal(poolTerm('en', 'Börn, 0 - 9 ára *'), 'Children, ages 0–9*');
  assert.equal(poolTerm('pl', 'Börn, 0 - 9 ára'), 'Dzieci, 0–9 lat');
  assert.equal(poolTerm('en', 'Aldraðir og öryrkjar'), 'Seniors and disabled people');
  assert.equal(poolTerm('en', 'Börn, 14 ára og yngri'), 'Children, 14 and under');
  assert.equal(poolTerm('en', '10 miðar**'), '10 visits**');
  assert.equal(poolTerm('en', '3ja mánaða kort'), '3-month pass');
  assert.equal(poolTerm('pl', 'Árskort'), 'Karnet roczny');
  assert.equal(poolTerm('en', 'Frítt'), 'Free');
  assert.equal(poolTerm('en', '720 kr stk'), '720 kr each');
  assert.equal(poolTerm('en', 'frá 45 USD'), 'from 45 USD');
});

test('holidays keep their dates, in the page language', () => {
  assert.equal(poolTerm('en', '24. des. Aðfangadagur jóla'), 'Christmas Eve, 24 December');
  assert.equal(poolTerm('en', 'Páskadagur, 5. apríl'), 'Easter Sunday, 5 April');
  assert.equal(poolTerm('pl', '2. í jólum, 26. desember'), 'Drugi dzień świąt, 26 grudnia');
  assert.equal(poolTerm('en', '1 október – 31. mars'), '1 October – 31 March');
});

test('headings', () => {
  assert.equal(poolTerm('en', 'Vetraropnun, 2026'), 'Winter hours 2026');
  assert.equal(poolTerm('en', 'Þreksalurinn – vetraropnun'), 'Gym – winter hours');
  assert.equal(poolTerm('en', 'Frídagar (með fyrirvara um breytingar)'), 'Public holidays (subject to change)');
});

test('what is not known comes back as written', () => {
  assert.equal(poolTerm('en', 'Opið daglega frá'), 'Opið daglega frá');
  assert.equal(poolTerm('en', '1.500 kr'), '1.500 kr');
  assert.equal(poolTerm('en', ''), '');
  assert.equal(poolTerm('en', null), null);
});
