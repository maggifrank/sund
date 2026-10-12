-- Details for Hilton Chicago's pool, one of the built-in pools abroad, which
-- sundlaugar.is does not list. Looked up on 2026-10-12 from ResortPass (hours,
-- day pass), Hilton and hotelgyms.com. The pool page reads them from pool_info
-- (see addedPools() in lib/cloud.js). Only written where the pool exists.
insert into public.pool_info (pool_id, info, fetched)
select 'hilton-chicago', $json$
{
  "name": "Hilton Chicago",
  "kind": "pool",
  "source": "https://www.resortpass.com/hotels/hilton-chicago-downtown",
  "fetched": "2026-10-12",
  "address": "720 S Michigan Ave, Chicago, IL 60605, Bandaríkjunum",
  "phone": "+1 312-922-4400",
  "email": null,
  "web": "https://www.hilton.com/en/hotels/chichhh-hilton-chicago/amenities/",
  "facebook": null,
  "instagram": null,
  "longest": null,
  "facilities": ["indoor", "hotTubs", "sauna", "gym"],
  "hours": [
    {
      "kind": "open",
      "title": "Afgreiðslutími",
      "season": null,
      "rows": [
        { "label": "Alla daga", "days": [0, 1, 2, 3, 4, 5, 6], "season": null, "closed": false, "times": ["06:00–22:00"], "extra": null }
      ],
      "notes": [
        { "text": "Upphituð innilaug með heitum potti og gufubaði á hótelinu, og sólpallur á sumrin." }
      ]
    }
  ],
  "prices": {
    "year": "2026",
    "sections": [
      { "head": ["Dagpassi"], "rows": [["Fullorðnir", "frá 45 USD"]] }
    ]
  },
  "priceNotes": ["Laugin er fyrst og fremst fyrir hótelgesti. Aðrir geta keypt dagpassa í gegnum ResortPass."]
}
$json$::jsonb, date '2026-10-12'
where exists (select 1 from public.pools where id = 'hilton-chicago')
on conflict (pool_id) do update set info = excluded.info, fetched = excluded.fetched;
