-- Details for Odense Havnebad, the first pool added to the shared list from a
-- suggestion. The built-in pools get theirs from sundlaugar.is through
-- lib/poolinfo.js; this one is not listed there, so the page reads these from
-- pool_info instead (see addedPools() in lib/cloud.js). Looked up on
-- 2026-10-12 from Odense Idrætspark and VisitOdense. Only written where the
-- pool exists, since it was added through /admin/ rather than a migration.
insert into public.pool_info (pool_id, info, fetched)
select 'odense-havnebad', $json$
{
  "name": "Odense Havnebad",
  "kind": "pool",
  "source": "https://www.odense-idraetspark.dk/aabningstider-og-info/odense-havnebad",
  "fetched": "2026-10-12",
  "address": "Gamle Havnekaj 3, 5000 Odense C, Danmörku",
  "phone": "+45 65 51 53 72",
  "email": "Idraetsparken@odense.dk",
  "web": "https://www.visitodense.com/odense-harbour-bath-go-free-swim-gdk1080932",
  "facebook": null,
  "instagram": null,
  "longest": 33.3,
  "facilities": ["outdoor", "sauna", "accessible"],
  "hours": [
    {
      "kind": "open",
      "title": "Vetraropnun, 12. október 2026 til 3. janúar 2027",
      "season": { "from": "10-12", "to": "01-03" },
      "rows": [
        { "label": "Mánudaga, miðvikudaga og föstudaga", "days": [1, 3, 5], "season": null, "closed": false, "times": ["06:00–09:30"], "extra": null },
        { "label": "Þriðjudaga og fimmtudaga", "days": [2, 4], "season": null, "closed": false, "times": ["16:00–20:30"], "extra": null },
        { "label": "Laugar- og sunnudaga", "days": [0, 6], "season": null, "closed": false, "times": ["08:00–10:30"], "extra": null }
      ],
      "notes": [
        { "text": "Aðfangadag og gamlársdag opið 08:00–10:30." },
        { "text": "Lokað á jóladag og nýársdag." },
        { "text": "Sjórinn er minnst 3 °C á veturna og minnst 20 °C á sumrin (1. júní til 31. ágúst)." },
        { "text": "Laugin er 33,3 × 12,5 m, 80–200 cm djúp, með gufubaði (um 85 °C), tveimur vatnsbyssum og aðgengilegum tröppum. Rúmar 300 manns." },
        { "text": "Börn yngri en 8 ára í fylgd fullorðinna. Bannað að taka myndir og reykja." }
      ]
    }
  ],
  "prices": {
    "year": "2026",
    "sections": [
      { "head": ["Stakt gjald"], "rows": [["Allir", "Frítt"]] }
    ]
  },
  "priceNotes": ["Aðgangur er ókeypis allt árið."]
}
$json$::jsonb, date '2026-10-12'
where exists (select 1 from public.pools where id = 'odense-havnebad')
on conflict (pool_id) do update set info = excluded.info, fetched = excluded.fetched;
