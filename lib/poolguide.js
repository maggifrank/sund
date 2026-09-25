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
  }
};

export const guideFor = (id) => POOL_GUIDE[id] ?? null;
