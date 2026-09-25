/* What a natural pool's page on sundlaugar.is says about getting into it: how
 * warm the water is, how to reach it, whether there is anything there and what
 * to watch out for. Kept by hand, pool by pool, from the directory's own
 * description of each one.
 *
 * bin/fetch-pool-info.mjs does not read these, on purpose: it takes only the
 * parts of a page that have a shape (address, hours, the price table), and the
 * directory's descriptions are somebody's writing rather than fields. For a
 * town pool that loses nothing. For a hot spring in a field it loses all of it —
 * a natural pool has no hours and no prices, and everything a swimmer needs is
 * in the paragraph about it. So the facts are pulled out here, and the
 * description written afresh in each language rather than copied, with the
 * directory's page linked from the foot of the pool's page as before.
 *
 * Only what the directory says. A pool whose page there is empty — several
 * are, a heading and a map — has no entry, and a field the page is silent on
 * is null rather than a guess: an F-road is not written down as four-wheel
 * drive only unless the page says so.
 *
 * `checked` is the day the entry was last compared with the directory.
 *
 *   temp       the water in °C, [low, high], or null when the page does not say
 *   access     'car' any car gets there, '4x4' only a four-wheel drive does,
 *              'walk' the last part is on foot; null when the page does not say
 *   walk       { km, min } of the walk in, either may be null; min may be a
 *              span, '40–50'
 *   facilities 'none', 'basic' (a changing hut), 'showers', or null
 *   free       true, false, or null when the page does not say
 *   about      { is, en, pl }: where it is and how to find it, in a few sentences
 *   cautions   keys under guide.caution.* in lib/i18n.js
 */

export const POOL_GUIDE = {
  kualaug: {
    checked: '2026-09-25',
    temp: [38, 40],
    access: 'car',
    walk: null,
    facilities: 'none',
    free: null,
    about: {
      is: 'Ein þriggja lauga rétt hjá Haukadalskirkju, nálægt Geysi. Ekið fram hjá Geysi og um 2 km eftir vegi F-333; laugin er vinstra megin við veginn áður en komið er að kirkjunni. Tvær laugar, sú stærri hlaðin grjóti.',
      en: 'One of three pools by Haukadalur church, near Geysir. Drive past Geysir and about 2 km along road F-333; the pool is on the left of the road before you reach the church. There are two pools; the larger is walled with stacked stones.',
      pl: 'Jeden z trzech basenów przy kościele w Haukadalur, niedaleko Geysiru. Minąć Geysir i jechać około 2 km drogą F-333; basen jest po lewej stronie drogi przed kościołem. Są dwa baseny; większy obłożony kamieniami.'
    },
    cautions: ['checkTemp', 'slippery', 'nearby', 'litter']
  },

  reykjadalur: {
    checked: '2026-09-25',
    temp: null,
    access: 'walk',
    walk: { km: null, min: '40–50' },
    facilities: null,
    free: null,
    about: {
      is: 'Bað í heitum læk í dal fullum af hverum, fyrir ofan Hveragerði. Ekið í gegnum Hveragerði upp að bílastæðinu og gengið þaðan.',
      en: 'Bathing in a warm river in a valley full of hot springs, above Hveragerði. Drive through Hveragerði to the car park and walk from there.',
      pl: 'Kąpiel w ciepłej rzece w dolinie pełnej gorących źródeł, nad Hveragerði. Przejechać przez Hveragerði do parkingu i dalej pieszo.'
    },
    cautions: ['burnsOnPath']
  },

  hveravellir: {
    checked: '2026-09-25',
    temp: null,
    access: null,
    walk: null,
    facilities: null,
    free: false,
    about: {
      is: 'Við Kjalveg (F35) á miðhálendinu, leiðinni frá Gullfossi norður í Blöndudal, um 200 km alls. Nánari upplýsingar á hveravellir.is.',
      en: 'On Kjölur, road F35, across the central highlands between Gullfoss and Blöndudalur, a route of about 200 km. More at hveravellir.is.',
      pl: 'Przy drodze Kjölur (F35) przez centralne wyżyny, między Gullfoss a Blöndudalur, trasa około 200 km. Więcej na hveravellir.is.'
    },
    cautions: []
  },

  landmannalaugar: {
    checked: '2026-09-25',
    temp: null,
    access: null,
    walk: null,
    facilities: null,
    free: true,
    about: {
      is: 'Á hálendinu að Fjallabaki, undir brún Laugahrauns. Heitar og kaldar lindir renna saman í Laugalæk og þar er baðað.',
      en: 'In the Fjallabak highlands, under the edge of the Laugahraun lava field. Hot and cold springs run together into the Laugalækur stream, where people bathe.',
      pl: 'Na wyżynach Fjallabak, pod krawędzią pola lawowego Laugahraun. Gorące i zimne źródła łączą się w strumieniu Laugalækur, w którym się kąpie.'
    },
    cautions: ['noSoap', 'litter']
  },

  'gamla-laugin-secret-lagoon': {
    checked: '2026-09-25',
    temp: [38, 40],
    access: null,
    walk: null,
    facilities: null,
    free: false,
    about: {
      is: 'Á Flúðum, á grunni laugar frá 1891. Hverir allt í kring og göngustígur um svæðið.',
      en: 'At Flúðir, on the site of a pool first built in 1891. Hot springs all around, with a footpath through the area.',
      pl: 'We Flúðir, w miejscu basenu zbudowanego w 1891 roku. Wokół gorące źródła i ścieżka spacerowa.'
    },
    cautions: []
  },

  seljavallalaug: {
    checked: '2026-09-25',
    temp: null,
    access: 'walk',
    walk: { km: 1, min: null },
    facilities: 'none',
    free: true,
    about: {
      is: '25 metra laug frá 1923, þrifin einu sinni á ári af sjálfboðaliðum. Beygt af þjóðvegi 1 inn á veg 242, lagt á bílastæðinu og gengið tæpan kílómetra.',
      en: 'A 25 m pool built in 1923 and cleaned once a year by volunteers. Turn off Route 1 onto road 242, park at the car park and walk just under a kilometre.',
      pl: 'Basen 25 m z 1923 roku, sprzątany raz w roku przez wolontariuszy. Z drogi nr 1 skręcić w drogę 242, zaparkować na parkingu i przejść niecały kilometr.'
    },
    cautions: ['ownRisk', 'slippery']
  },

  gvendarlaug: {
    checked: '2026-09-25',
    temp: [30, 32],
    access: null,
    walk: null,
    facilities: null,
    free: false,
    about: {
      is: '25 metra náttúrulaug við Hótel Laugarhól í Bjarnarfirði. Við hana er 40–42°C heitur hver og svalari vaðlaug fyrir börn. Þrifin á þriðjudögum og opnar aftur um kvöldið.',
      en: 'A 25 m natural pool at Hótel Laugarhóll in Bjarnarfjörður, with a 40–42 °C hot spring and a cooler paddling pool for children beside it. Cleaned on Tuesdays, reopening in the evening.',
      pl: 'Naturalny basen 25 m przy Hótel Laugarhóll w Bjarnarfjörður, obok gorące źródło 40–42 °C i chłodniejszy brodzik dla dzieci. Sprzątany we wtorki, otwarty ponownie wieczorem.'
    },
    cautions: ['shallowWhenFilling']
  },

  hellulaug: {
    checked: '2026-09-25',
    temp: [38, 38],
    access: null,
    walk: null,
    facilities: 'none',
    free: true,
    about: {
      is: 'Í flæðarmálinu skammt frá Hótel Flókalundi í Vatnsfirði. Hlaðin grjóti og steypt. Engin búningsaðstaða.',
      en: 'On the shore a short way from Hótel Flókalundur in Vatnsfjörður. Walled with stone and concrete. No changing facilities.',
      pl: 'Na brzegu morza, niedaleko Hótel Flókalundur w Vatnsfjörður. Obmurowany kamieniem i betonem. Brak przebieralni.'
    },
    cautions: ['ownRisk']
  },

  'pottarnir-a-drangsnesi': {
    checked: '2026-09-25',
    temp: null,
    access: null,
    walk: null,
    facilities: 'showers',
    free: true,
    about: {
      is: 'Þrír pottar í flæðarmálinu á Drangsnesi, tveir heitir og einn kaldur. Sturturnar eru hinum megin við veginn.',
      en: 'Three tubs on the shore at Drangsnes, two hot and one cold. The showers are across the road.',
      pl: 'Trzy wanny na brzegu w Drangsnes, dwie gorące i jedna zimna. Prysznice są po drugiej stronie drogi.'
    },
    cautions: ['showerFirst', 'litter']
  },

  landbrotalaug: {
    checked: '2026-09-25',
    temp: null,
    access: null,
    walk: null,
    facilities: 'none',
    free: null,
    about: {
      is: 'Lítil laug sem ekki er auðvelt að finna. Aðeins tveir til þrír komast í hana í einu.',
      en: 'A small pool that is not easy to find. Only two or three people fit in at a time.',
      pl: 'Mały basen, niełatwy do znalezienia. Mieszczą się w nim naraz tylko dwie, trzy osoby.'
    },
    cautions: []
  },

  hreppslaug: {
    checked: '2026-09-25',
    temp: null,
    access: null,
    walk: null,
    facilities: 'basic',
    free: false,
    about: {
      is: 'Í Skorradal, byggð 1928 af ungmennafélaginu Íslendingi og friðlýst. Sírennsli úr lindum í næsta nágrenni og nýtt laugarhús frá 2022. Aðeins opin á sumrin.',
      en: 'In Skorradalur, built in 1928 by the youth club Íslendingur and now protected. Fed continuously by springs close by, with a new changing house since 2022. Open in summer only.',
      pl: 'W Skorradalur, zbudowany w 1928 roku przez klub młodzieżowy Íslendingur, dziś chroniony. Stale zasilany z pobliskich źródeł, z nowym budynkiem przebieralni od 2022 roku. Otwarty tylko latem.'
    },
    cautions: []
  },

  lysulaugar: {
    checked: '2026-09-25',
    temp: [24, 35],
    access: null,
    walk: null,
    facilities: null,
    free: false,
    about: {
      is: 'Við grunnskólann á Lýsuhóli í Staðarsveit á sunnanverðu Snæfellsnesi. Laug og tveir heitir pottar með náttúrulegu, heitu ölkelduvatni beint úr jörðu. Opin daglega á sumrin; á veturna notuð fyrir skólasund.',
      en: 'By the school at Lýsuhóll in Staðarsveit, on the south side of Snæfellsnes. A pool and two hot tubs of natural, warm mineral water straight from the ground. Open daily in summer; used for school swimming in winter.',
      pl: 'Przy szkole w Lýsuhóll w Staðarsveit, na południu półwyspu Snæfellsnes. Basen i dwie gorące wanny z naturalną, ciepłą wodą mineralną prosto z ziemi. Latem otwarty codziennie; zimą służy szkole.'
    },
    cautions: []
  },

  snorralaug: {
    checked: '2026-09-25',
    temp: null,
    access: null,
    walk: null,
    facilities: null,
    free: true,
    about: {
      is: 'Söguleg laug í Reykholti, nefnd í Landnámu og Sturlungu á dögum Snorra Sturlusonar. Tæpir fjórir metrar í þvermál, 0,7–1 m djúp, og vatnið leitt í lokuðum stokk úr hvernum Skriflu.',
      en: 'A historic pool at Reykholt, mentioned in the Book of Settlements and in Sturlunga saga from the days of Snorri Sturluson. Just under 4 m across and 0.7–1 m deep, fed by a closed channel from the Skrifla hot spring.',
      pl: 'Historyczny basen w Reykholt, wspominany w Księdze o zasiedleniu i sadze Sturlungów z czasów Snorriego Sturlusona. Niecałe 4 m średnicy, 0,7–1 m głębokości, zasilany zamkniętym kanałem z gorącego źródła Skrifla.'
    },
    cautions: ['noBathing', 'veryHot']
  },

  gudlaug: {
    checked: '2026-09-25',
    temp: [39, 39],
    access: null,
    walk: null,
    facilities: 'showers',
    free: false,
    about: {
      is: 'Í grjótgarðinum á Langasandi á Akranesi, þar sem líka er hægt að baða sig í sjónum. Þrjár hæðir: útsýnispallur efst, heit setlaug og sturtur í miðjunni og grunn vaðlaug neðst. Opin allt árið.',
      en: 'In the sea wall at Langisandur beach in Akranes, where you can also swim in the sea. Three levels: a viewing deck on top, a hot soaking pool and showers in the middle, and a shallow paddling pool below. Open all year.',
      pl: 'W falochronie na plaży Langisandur w Akranes, gdzie można też kąpać się w morzu. Trzy poziomy: taras widokowy na górze, gorący basen i prysznice pośrodku oraz płytki brodzik na dole. Otwarty cały rok.'
    },
    cautions: []
  },

  hraunsnef: {
    checked: '2026-09-25',
    temp: null,
    access: null,
    walk: null,
    facilities: null,
    free: false,
    about: {
      is: 'Jarðhitaböð við sveitahótelið á Hraunsnefi í Borgarfirði, í kyrrlátu sveitaumhverfi.',
      en: 'Geothermal baths at the Hraunsnef country hotel in Borgarfjörður, in quiet farmland.',
      pl: 'Kąpiele geotermalne przy wiejskim hotelu Hraunsnef w Borgarfjörður, w spokojnej okolicy.'
    },
    cautions: []
  }
};

export const guideFor = (id) => POOL_GUIDE[id] ?? null;
