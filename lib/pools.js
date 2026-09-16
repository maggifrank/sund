/* Known pools and the geometry for matching a position to one.
 *
 * Coordinates come from OpenStreetMap (Overpass, August 2026; the natural pools
 * a month behind that). OSM tags these inconsistently — Laugardalslaug is a
 * `shelter`, Sundhöll Reykjavíkur a `sauna` — so the list is curated by name
 * rather than by tag, and a point is somewhere inside the complex rather than
 * at the door. MATCH_M is generous enough to absorb that.
 *
 * Names come from the directory at sundlaugar.is, which has no coordinates at
 * all. Its index page links 100 pools; its own sitemap has 107, so seven — Vík
 * among them — are absent from the listing and were taken from there. The rest
 * are a section the pool directory does not reach at all: heitar_laugar, the
 * natural pools, which has its own index and its own sitemap. Two of those were
 * already here under the directory's names — Hellulaug, and Bláa Lónið as Blue
 * Lagoon, which is where its position finally came from.
 *
 * Positions were then looked up in OpenStreetMap by name, which placed 81 and
 * left fifty with nothing. Those fifty were not missing from OSM so much as
 * unnamed in it: the directory calls a pool after the town it stands in, and
 * OSM leaves the basins inside a sports complex untagged, so a name had nothing
 * to match.
 *
 * The directory does publish an address for each of them, which is the better
 * key. Geocoding that address and then snapping to whatever pool OSM has within
 * 500 m of it placed 45 more — the address says which building, OSM says where
 * the water is. Four of those OSM has no pool for at all and stand at their
 * address: Heydalur, Íþróttamiðstöðin í Reykholti, Stapalaug and Reyðarfjörður.
 * That pass is bin/survey-pools.mjs: run it and diff it rather than take these
 * on trust.
 *
 * Five wild pools resisted both passes — Hveragil, Kerið á Húsavíkurhöfða,
 * Lægðin, Siká and Laugarnes – Birkimel, which the natural-pools section lists
 * without an address and OSM does not name. They are not here. A pool that
 * cannot be placed cannot be detected either, and its only use was a name in
 * the picker, which is a thing the app can already produce on demand: swim at
 * one and name it once on the spot, and it is remembered with the coordinates
 * you were standing on — see `pools` in the saved state, which the app appends
 * to. So every pool in this list has a position, and the map is the whole list.
 *
 * `card: true` marks the three Hafnarfjörður pools the annual card actually
 * covers. Their coordinates were given directly rather than surveyed, and agree
 * with OSM to within 26 m. Everything else can be logged, but only for the log —
 * see countsForCard() in state.js.
 */

export const MATCH_M = 250;

export const BUILT_IN = [
  { id: 'laugardalslaug', name: 'Laugardalslaug', lat: 64.14661, lon: -21.87985 },
  { id: 'vesturbaejarlaug', name: 'Vesturbæjarlaug', lat: 64.14444, lon: -21.96291 },
  { id: 'sundholl-reykjavikur', name: 'Sundhöll Reykjavíkur', lat: 64.14164, lon: -21.91983 },
  { id: 'breidholtslaug', name: 'Breiðholtslaug', lat: 64.10448, lon: -21.81891 },
  { id: 'grafarvogslaug', name: 'Grafarvogslaug', lat: 64.13838, lon: -21.7865 },
  { id: 'dalslaug', name: 'Dalslaug', lat: 64.13225, lon: -21.7366 },
  { id: 'olduselslaug', name: 'Ölduselslaug', lat: 64.09963, lon: -21.84812 },
  { id: 'klebergslaug', name: 'Klébergslaug', lat: 64.23754, lon: -21.82754 },
  { id: 'seltjarnarneslaug', name: 'Seltjarnarneslaug', lat: 64.1504, lon: -21.99191 },
  { id: 'sundlaug-kopavogs', name: 'Sundlaug Kópavogs', lat: 64.11041, lon: -21.91662 },
  { id: 'salalaug', name: 'Salalaug', lat: 64.09195, lon: -21.85602 },
  { id: 'asgardslaug', name: 'Ásgarðslaug', lat: 64.08818, lon: -21.92929 },
  { id: 'alftaneslaug', name: 'Álftaneslaug', lat: 64.10427, lon: -22.01912 },
  { id: 'asvallalaug', name: 'Ásvallalaug', lat: 64.05208, lon: -21.97592, card: true },
  { id: 'sudurbaejarlaug', name: 'Suðurbæjarlaug', lat: 64.05992, lon: -21.96197, card: true },
  { id: 'sundholl-hafnarfjardar', name: 'Sundhöll Hafnarfjarðar', lat: 64.07256, lon: -21.96872, card: true },
  { id: 'lagafellslaug', name: 'Lágafellslaug', lat: 64.16503, lon: -21.72565 },
  { id: 'varmarlaug', name: 'Varmárlaug', lat: 64.17037, lon: -21.68974 },
  { id: 'arbaejarlaug', name: 'Árbæjarlaug', lat: 64.11216, lon: -21.79489 },
  { id: 'dalvik', name: 'Dalvík', lat: 65.96709, lon: -18.53836 },
  { id: 'geosea-sjobod', name: 'Geosea Sjóböð', lat: 66.05262, lon: -17.36129 },
  { id: 'glerarlaug', name: 'Glerárlaug', lat: 65.68935, lon: -18.11805 },
  { id: 'gudlaug', name: 'Guðlaug', lat: 64.31702, lon: -22.05987 },
  /* Akranes's own pool, missed by both passes: the directory calls it
     "Jaðarsbakkalaug, Akranesi", which no OSM name matches, and its address
     snaps onto Guðlaug, the beach pool 180 m below it, which the survey's guard
     then drops as a duplicate. They are two pools. OSM names this one exactly,
     as a swimming_pool, and that is the position here. */
  { id: 'jadarsbakkalaug-akranesi', name: 'Jaðarsbakkalaug, Akranesi', lat: 64.3186, lon: -22.05902 },
  { id: 'gvendarlaug', name: 'Gvendarlaug', lat: 65.78105, lon: -21.52049 },
  { id: 'heidarbaer', name: 'Heiðarbær', lat: 65.88841, lon: -17.31996 },
  { id: 'hellulaug', name: 'Hellulaug', lat: 65.57719, lon: -23.15955 },
  { id: 'holmavik', name: 'Hólmavík', lat: 65.70281, lon: -21.68461 },
  { id: 'hreppslaug', name: 'Hreppslaug', lat: 64.53751, lon: -21.70221 },
  { id: 'ithrottamidstod-eyjafjardarsveitar', name: 'Íþróttamiðstöð Eyjafjarðarsveitar', lat: 65.57329, lon: -18.09118 },
  { id: 'ithrottamidstodin-borgarnesi', name: 'Íþróttamiðstöðin Borgarnesi', lat: 64.54055, lon: -21.92223 },
  { id: 'ithrottamidstodin-kleppjarnsreykjum', name: 'Íþróttamiðstöðin Kleppjárnsreykjum', lat: 64.65516, lon: -21.40108 },
  { id: 'ithrottamidstodin-varmalandi', name: 'Íþróttamiðstöðin Varmalandi', lat: 64.69048, lon: -21.59321 },
  { id: 'landmannalaugar', name: 'Landmannalaugar', lat: 63.99051, lon: -19.06049 },
  { id: 'laugaras-lagoon', name: 'Laugarás Lagoon', lat: 64.11298, lon: -20.50748 },
  { id: 'laugarvatn', name: 'Laugarvatn', lat: 64.21717, lon: -20.73342 },
  { id: 'neslaug', name: 'Neslaug', lat: 64.04325, lon: -20.25152 },
  { id: 'sandgerdi', name: 'Sandgerði', lat: 64.03363, lon: -22.70003 },
  { id: 'saelingsdalslaug', name: 'Sælingsdalslaug', lat: 65.24583, lon: -21.80143 },
  { id: 'skagastrond', name: 'Skagaströnd', lat: 65.82679, lon: -20.32042 },
  { id: 'skogarbodin', name: 'Skógarböðin', lat: 65.66992, lon: -18.0418 },
  { id: 'sky-lagoon', name: 'Sky Lagoon', lat: 64.11647, lon: -21.94644 },
  { id: 'stefanslaug-neskaupsstad', name: 'Stefánslaug, Neskaupsstað', lat: 65.14814, lon: -13.68836 },
  { id: 'sundholl-isafjardar', name: 'Sundhöll Ísafjarðar', lat: 66.07358, lon: -23.11714 },
  { id: 'sundholl-selfoss', name: 'Sundhöll Selfoss', lat: 63.93563, lon: -20.99817 },
  { id: 'sundholl-seydisfjardar', name: 'Sundhöll Seyðisfjarðar', lat: 65.2593, lon: -14.00564 },
  { id: 'sundlaug-akureyrar', name: 'Sundlaug Akureyrar', lat: 65.67909, lon: -18.09813 },
  { id: 'sundlaug-grindavikur', name: 'Sundlaug Grindavíkur', lat: 63.8439, lon: -22.43152 },
  { id: 'sundlaug-hafnar', name: 'Sundlaug Hafnar', lat: 64.25397, lon: -15.20849 },
  { id: 'sundlaug-husavikur', name: 'Sundlaug Húsavíkur', lat: 66.04927, lon: -17.34667 },
  { id: 'sundlaugin-ad-hlodum', name: 'Sundlaugin að Hlöðum', lat: 64.41077, lon: -21.60866 },
  { id: 'sundlaugin-breiddalsvik', name: 'Sundlaugin Breiðdalsvík', lat: 64.7946, lon: -14.00091 },
  { id: 'sundlaugin-laugalandi', name: 'Sundlaugin Laugalandi', lat: 63.91595, lon: -20.4166 },
  { id: 'sundlaugin-laugaskardi', name: 'Sundlaugin Laugaskarði', lat: 64.00159, lon: -21.17983 },
  { id: 'varmahlid', name: 'Varmahlíð', lat: 65.55336, lon: -19.4509 },
  { id: 'blue-lagoon', name: 'Blue Lagoon', lat: 63.87963, lon: -22.44813 },
  { id: 'bolungarvik', name: 'Bolungarvík', lat: 66.15536, lon: -23.25382 },
  { id: 'borg-grimsnesi', name: 'Borg, Grímsnesi', lat: 64.07466, lon: -20.7674 },
  { id: 'eskifjordur', name: 'Eskifjörður', lat: 65.07734, lon: -14.03746 },
  { id: 'faskrudsfjordur', name: 'Fáskrúðsfjörður', lat: 64.92871, lon: -14.00629 },
  { id: 'flateyri', name: 'Flateyri', lat: 66.05199, lon: -23.51753 },
  { id: 'fludir', name: 'Flúðir', lat: 64.12871, lon: -20.32412 },
  { id: 'grenivikurlaug', name: 'Grenivíkurlaug', lat: 65.94897, lon: -18.17305 },
  { id: 'grundarfjordur', name: 'Grundarfjörður', lat: 64.92161, lon: -23.25848 },
  { id: 'hella', name: 'Hella', lat: 63.83678, lon: -20.40006 },
  { id: 'heydalur', name: 'Heydalur', lat: 65.84201, lon: -22.67804 },
  { id: 'hofsos', name: 'Hofsós', lat: 65.89582, lon: -19.41083 },
  { id: 'hraunsnef', name: 'Hraunsnef', lat: 64.78765, lon: -21.5085 },
  { id: 'hrisey', name: 'Hrísey', lat: 65.97853, lon: -18.37275 },
  { id: 'hvammsvik', name: 'Hvammsvík', lat: 64.37361, lon: -21.56407 },
  { id: 'hvolsvollur', name: 'Hvolsvöllur', lat: 63.7536, lon: -20.22991 },
  { id: 'illugastadir', name: 'Illugastaðir', lat: 65.62011, lon: -17.81589 },
  { id: 'ithrottamidstod-fjallabyggdar-olafsfirdi', name: 'Íþróttamiðstöð Fjallabyggðar – Ólafsfirði', lat: 66.07072, lon: -18.64911 },
  { id: 'ithrottamidstod-fjallabyggdar-siglufirdi', name: 'Íþróttamiðstöð Fjallabyggðar – Siglufirði', lat: 66.15688, lon: -18.90641 },
  { id: 'ithrottamidstodin-budardal', name: 'Íþróttamiðstöðin Búðardal', lat: 65.10875, lon: -21.76561 },
  { id: 'ithrottamidstodin-i-reykholti', name: 'Íþróttamiðstöðin í Reykholti', lat: 64.17471, lon: -20.4455 },
  { id: 'kirkjubaejarklaustur', name: 'Kirkjubæjarklaustur', lat: 63.78702, lon: -18.0531 },
  { id: 'lysulaugar', name: 'Lýsulaugar', lat: 64.84142, lon: -23.21456 },
  { id: 'olafsvik', name: 'Ólafsvík', lat: 64.89675, lon: -23.71286 },
  { id: 'patreksfjordur', name: 'Patreksfjörður', lat: 65.59616, lon: -23.98716 },
  { id: 'raufarhofn', name: 'Raufarhöfn', lat: 66.44745, lon: -15.94255 },
  { id: 'reydarfjordur', name: 'Reyðarfjörður', lat: 65.03562, lon: -14.2144 },
  { id: 'reykjanesbaer-njardvik', name: 'Reykjanesbær – Njarðvík', lat: 63.98749, lon: -22.54464 },
  { id: 'reykjanesbaer-vatnaverold', name: 'Reykjanesbær – Vatnaveröld', lat: 63.99845, lon: -22.56097 },
  { id: 'saudarkrokur', name: 'Sauðárkrókur', lat: 65.74622, lon: -19.64651 },
  { id: 'skeidalaug', name: 'Skeiðalaug', lat: 64.02195, lon: -20.52051 },
  { id: 'solgardar-i-fljotum', name: 'Sólgarðar í Fljótum', lat: 66.05215, lon: -19.11771 },
  { id: 'stapalaug', name: 'Stapalaug', lat: 63.97239, lon: -22.49167 },
  { id: 'stodvarfjordur', name: 'Stöðvarfjörður', lat: 64.83326, lon: -13.86971 },
  { id: 'stokkseyri', name: 'Stokkseyri', lat: 63.8377, lon: -21.06376 },
  { id: 'stykkisholmur', name: 'Stykkishólmur', lat: 65.07287, lon: -22.72941 },
  { id: 'sudureyri', name: 'Suðureyri', lat: 66.12808, lon: -23.52328 },
  { id: 'sundlaug-grimseyjar', name: 'Sundlaug Grímseyjar', lat: 66.54071, lon: -18.01592 },
  { id: 'sundlaugin-blonduosi', name: 'Sundlaugin Blönduósi', lat: 65.65953, lon: -20.28309 },
  { id: 'sundlaugin-egilsstodum', name: 'Sundlaugin Egilsstöðum', lat: 65.26677, lon: -14.39522 },
  { id: 'sundlaugin-gardi', name: 'Sundlaugin Garði', lat: 64.07274, lon: -22.65543 },
  { id: 'sundlaugin-hvammstanga', name: 'Sundlaugin Hvammstanga', lat: 65.39935, lon: -20.94268 },
  { id: 'sundlaugin-laugum', name: 'Sundlaugin Laugum', lat: 65.72107, lon: -17.35934 },
  { id: 'sundlaugin-thingeyri', name: 'Sundlaugin Þingeyri', lat: 65.88058, lon: -23.49272 },
  { id: 'talknafjordur', name: 'Tálknafjörður', lat: 65.62857, lon: -23.84531 },
  { id: 'vestmannaeyjar', name: 'Vestmannaeyjar', lat: 63.43714, lon: -20.28382 },
  { id: 'thelamerkurlaug', name: 'Þelamerkurlaug', lat: 65.74235, lon: -18.28119 },
  { id: 'thorlakshofn', name: 'Þorlákshöfn', lat: 63.8524, lon: -21.38197 },
  { id: 'vik', name: 'Vík', lat: 63.4169, lon: -19.008 },
  { id: 'vogar-vatnsleysustrond', name: 'Vogar, Vatnsleysuströnd', lat: 63.98489, lon: -22.38178 },
  { id: 'vok-baths', name: 'Vök Baths', lat: 65.30307, lon: -14.44724 },
  { id: 'vopnafjordur-selardalur', name: 'Vopnafjörður – Selárdalur', lat: 65.80154, lon: -14.91057 },
  { id: 'ylstrondin-nautholsvik', name: 'Ylströndin, Nauthólsvík', lat: 64.12129, lon: -21.92927 },
  { id: 'gamla-laugin-secret-lagoon', name: 'Gamla laugin – Secret Lagoon', lat: 64.13723, lon: -20.30897 },
  { id: 'grettislaug', name: 'Grettislaug', lat: 65.88223, lon: -19.73654 },
  { id: 'horgshlid', name: 'Hörgshlíð', lat: 65.83105, lon: -22.62887 },
  { id: 'hveravellir', name: 'Hveravellir', lat: 64.86556, lon: -19.55483 },
  { id: 'jardbodin-vid-myvatn', name: 'Jarðböðin við Mývatn', lat: 65.63042, lon: -16.84742 },
  { id: 'kualaug', name: 'Kúalaug', lat: 64.3268, lon: -20.28195 },
  { id: 'landbrotalaug', name: 'Landbrotalaug', lat: 64.8322, lon: -22.31853 },
  { id: 'laugafellslaug', name: 'Laugafellslaug', lat: 65.02777, lon: -18.33214 },
  { id: 'laugarvallalaug', name: 'Laugarvallalaug', lat: 65.00561, lon: -15.76014 },
  { id: 'laugarvatn-fontana', name: 'Laugarvatn Fontana', lat: 64.2146, lon: -20.73023 },
  { id: 'nauteyri-i-isafjardardjupi', name: 'Nauteyri í Ísafjarðardjúpi', lat: 65.91718, lon: -22.34179 },
  { id: 'pollurinn-talknafirdi', name: 'Pollurinn, Tálknafirði', lat: 65.6492, lon: -23.89448 },
  { id: 'pottarnir-a-drangsnesi', name: 'Pottarnir á Drangsnesi', lat: 65.68819, lon: -21.44819 },
  { id: 'reykjadalur', name: 'Reykjadalur', lat: 64.04797, lon: -21.22219 },
  { id: 'reykjafjardarlaug', name: 'Reykjafjarðarlaug', lat: 65.62313, lon: -23.46896 },
  { id: 'seljavallalaug', name: 'Seljavallalaug', lat: 63.56614, lon: -19.60756 },
  { id: 'skatalaug', name: 'Skátalaug', lat: 63.90394, lon: -22.04317 },
  { id: 'snorralaug', name: 'Snorralaug', lat: 64.66399, lon: -21.29122 },
  { id: 'viti-vid-oskjuvatn', name: 'Víti við Öskjuvatn', lat: 65.04674, lon: -16.72591 }
];

/* The page a pool has — pool.html, which renders whatever is known about the
   id, from the directory's details down to just a name and a count. Here rather
   than beside that page's renderer so the pool table can link to it without
   loading the directory's data into the counter page. */
export const poolHref = (id) => `pool.html?id=${encodeURIComponent(id)}`;

/* Metres between two positions. Haversine — at these distances the difference
   from a proper geodesic is centimetres, far inside MATCH_M. */
export function distanceM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Every pool the app knows: the built-in survey plus whatever has been named
   on the spot. A saved pool with a built-in id overrides it, so renaming one
   sticks.

   Field by field, though, rather than wholesale. A pool named at a check-in
   with no fix to hand is saved as an id and a name and nothing else, and
   replacing the built-in record with it would take the surveyed position away
   — the pool would quietly leave the map, and the app would stop recognising a
   place it had the coordinates for all along. cleanPool() only writes lat and
   lon when it has both, so spreading the saved record over the built-in one
   lets it win wherever it actually says something. It is the rule
   poolRowsFromTotals() already applies to the published table, which is where
   the asymmetry was: the public map kept these positions and the private one
   lost them. */
export function allPools(saved = []) {
  const merged = new Map(BUILT_IN.map((p) => [p.id, p]));
  for (const p of saved) {
    if (p && typeof p.id === 'string' && typeof p.name === 'string') {
      merged.set(p.id, { ...merged.get(p.id), ...p });
    }
  }
  return [...merged.values()];
}

/* Nearest pool within MATCH_M, or null. Nearest rather than first, so
   overlapping radii resolve sensibly. */
export function matchPool(position, saved = []) {
  let best = null;
  for (const pool of allPools(saved)) {
    if (typeof pool.lat !== 'number' || typeof pool.lon !== 'number') continue;
    const d = distanceM(position, pool);
    if (d <= MATCH_M && (!best || d < best.distance)) best = { pool, distance: d };
  }
  return best;
}

/* Stable id from a typed name, with a numeric suffix if it collides. */
export function idFor(name, saved = []) {
  const base = name.trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'pool';
  const taken = new Set(allPools(saved).map((p) => p.id));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}
