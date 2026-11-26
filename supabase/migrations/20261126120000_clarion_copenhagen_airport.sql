-- Clarion Hotel Copenhagen Airport's pool, a built-in pool abroad (lib/pools.js
-- ABROAD), which sundlaugar.is does not list. Unlike Hilton Chicago this one is
-- new, so the pool row goes in here too, then its details. Looked up on
-- 2026-11-26 from the hotel's own page at Strawberry (pool and sauna hours, gym,
-- contacts), VisitCopenhagen (position, guest access) and Hotels.com. No source
-- gives the pool's size or a price for visitors who are not staying.
insert into public.pools (id, name, country, region, lat, lon)
values ('clarion-hotel-copenhagen-airport', 'Clarion Hotel Copenhagen Airport', 'DK', null, 55.63017, 12.65084)
on conflict (id) do nothing;

insert into public.pool_info (pool_id, info, fetched)
values ('clarion-hotel-copenhagen-airport', $json$
{
  "name": "Clarion Hotel Copenhagen Airport",
  "kind": "pool",
  "source": "https://www.strawberryhotels.com/hotels/denmark/kastrup/clarion-hotel-copenhagen-airport/",
  "fetched": "2026-11-26",
  "address": "Ellehammersvej 20, 2770 Kastrup, Danmörku",
  "phone": "+45 32 50 15 01",
  "email": "reservation.cl.copenhagen.airport@strawberry.dk",
  "web": "https://www.strawberryhotels.com/hotels/denmark/kastrup/clarion-hotel-copenhagen-airport/",
  "facebook": null,
  "instagram": null,
  "longest": null,
  "facilities": ["indoor", "sauna", "gym", "food"],
  "hours": [
    {
      "kind": "open",
      "title": "Afgreiðslutími",
      "season": null,
      "rows": [
        { "label": "Alla daga", "days": [0, 1, 2, 3, 4, 5, 6], "season": null, "closed": false, "times": ["06:00–22:00"], "extra": null }
      ],
      "notes": [
        { "text": "Innilaug og þurrgufubað á hótelinu við Kastrup-flugvöll, opið allt árið. Líkamsræktin er opin allan sólarhringinn." },
        { "text": "Hótelið segir börn velkomin í fylgd fullorðinna, en Hotels.com segir að yngri en 16 ára fái ekki að fara í laugina. Best að spyrja hótelið." }
      ]
    },
    {
      "kind": "other",
      "title": "Gufubað",
      "season": null,
      "rows": [
        { "label": "Alla daga", "days": [0, 1, 2, 3, 4, 5, 6], "season": null, "closed": false, "times": ["06:00–22:00"], "extra": null }
      ],
      "notes": [
        { "text": "Þurrgufubað (sauna) í heilsulind hótelsins, opið á sama tíma og laugin." }
      ]
    }
  ],
  "prices": {
    "year": "2026",
    "sections": [
      { "head": ["Aðgangur"], "rows": [["Hótelgestir", "Innifalið"]] }
    ]
  },
  "priceNotes": ["Laugin, gufubaðið og líkamsræktin eru innifalin fyrir hótelgesti. Hótelið birtir ekkert verð fyrir aðra; hafið samband við hótelið."]
}
$json$::jsonb, date '2026-11-26')
on conflict (pool_id) do update set info = excluded.info, fetched = excluded.fetched;
