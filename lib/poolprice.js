/* A pool's single entry price for an adult, read from the price table on its
   page (lib/poolinfo.js, as the crawl read it off sundlaugar.is), in krónur.
   It is what a swimmer with no card pays at the door, and the app adds it up
   for each swim at that pool. null when the table does not say plainly: no
   table, a price in another currency, or no adult row and single entry column
   to read it from.

   The tables are written by people, one pool at a time, so they come in two
   shapes. Mostly the columns are tickets and the rows are people:

     | Stakt gjald | 10 miðar | Árskort      ← head
     Fullorðnir | 1.330 kr | 9.600 kr | …    ← row: its label, then a cell per column

   and now and then the other way round, with "Fullorðnir" a column and
   "Stakt gjald" a row, or with no head at all and a price per row. All three
   are read. */

const SINGLE = /^(stakt|stakur|stakir|stök|aðgangur|verð$)/iu;
/* The plain adult row: "Fullorðnir", or with an age range ("Fullorðnir, 18 -
   66 ára"). Not the over-67 one, a members' price, or what a towel costs. */
const ADULT = /^(fullorðnir(?!.*(67\s*(ára og eldri|\+)|félags))|verð$)/iu;
const NOT_ADULT = /leigu|sturta|líkamsrækt|handklæði|sundföt/iu;

/* "1.330 kr" → 1330, "Frítt" → 0, anything else → null. */
export function krona(cell) {
  const text = String(cell ?? '').trim();
  if (/^frítt/iu.test(text)) return 0;
  const m = text.match(/^(\d{1,3}(?:\.\d{3})*|\d+)\s*kr\b/iu);
  return m ? Number(m[1].replace(/\./g, '')) : null;
}

export function singlePrice(info) {
  for (const section of info?.prices?.sections ?? []) {
    const head = section.head ?? [];
    /* A table with no head and one price per row is a list of single entry
       prices ("Fullorðnir | 7.490 kr"). */
    const col = head.length ? head.findIndex((h) => SINGLE.test(h.trim()))
      : section.rows.every((r) => r.length <= 2) ? 0 : -1;
    if (col >= 0) {
      const rows = section.rows.filter((r) => ADULT.test(r[0] ?? '') && !NOT_ADULT.test(r[0]));
      /* The plainest label first: "Fullorðnir" over "Fullorðnir, 18 - 25 ára". */
      rows.sort((a, b) => a[0].length - b[0].length);
      for (const row of rows) {
        const price = krona(row[col + 1]);
        if (price !== null) return price;
      }
    }
    const adultCol = head.findIndex((h) => ADULT.test(h.trim()));
    if (adultCol >= 0) {
      const row = section.rows.find((r) => SINGLE.test((r[0] ?? '').trim()));
      const price = row ? krona(row[adultCol + 1]) : null;
      if (price !== null) return price;
    }
  }
  return null;
}

/* Single entry prices by pool id, for every pool the crawl has a price for.
   Loaded on demand: the pool details are most of a megabyte before
   compression, and a page with a card does not need them. `extra` adds pools
   the details file does not have, as { id, info } (added at /admin/). */
let loaded = null;
export async function loadPrices(extra = []) {
  loaded ??= import('./poolinfo.js').then(({ POOL_INFO }) =>
    new Map(POOL_INFO.map((p) => [p.id, singlePrice(p)]).filter(([, v]) => v !== null)));
  const prices = new Map(await loaded);
  for (const { id, info } of extra) {
    const price = singlePrice(info);
    if (price !== null && !prices.has(id)) prices.set(id, price);
  }
  return prices;
}

/* What a list of swims cost at the door, at each pool's single entry price,
   and how many were at a pool with no price to go on (none listed, or no pool
   recorded). `trips` are { pool } or { id, count } rows. */
export function doorTotal(rows, prices) {
  let total = 0, priced = 0, unpriced = 0;
  for (const row of rows) {
    const count = row.count ?? 1;
    const price = prices.get(row.pool ?? row.id);
    if (price === undefined) unpriced += count;
    else { total += price * count; priced += count; }
  }
  return { total, priced, unpriced };
}
