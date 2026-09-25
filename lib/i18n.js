/* Icelandic and English strings, plus the formatting each language needs.
   Dates and numbers are built by hand rather than through Intl: the browsers
   this runs in may not ship is-IS locale data, and Intl fails soft by falling
   back to en-US, which would quietly print Icelandic prices with US commas. */

export const LANGS = ['is', 'en', 'pl'];
export const LANG_NAMES = { is: 'Íslenska', en: 'English', pl: 'Polski' };
export const DEFAULT_LANG = 'is';

/* Countable nouns carry both forms; see PLURAL_RULE for which one is picked. */
const S = {
  is: {
    'a11y.langSwitch': 'Switch to English',
    'a11y.settings': 'Stillingar',
    'a11y.syncNow': 'Samstilla núna',

    'counter.label': 'Ferðir á árskortinu',
    'counter.add': 'Bæta við ferð',
    'counter.remove': 'Fjarlægja ferð',
    'counter.lastSwim': 'Síðasta ferð {date}',
    'counter.none': 'Engar ferðir skráðar enn',

    'cost.label': 'Kostnaður á ferð hingað til',
    'cost.sub': '{total} ÷ {trips}',
    'cost.unused': 'Árskort á {total}, ónotað',

    'be.label': 'Núllpunktur m.v. {n} skipta kort',
    'be.toGo': '{left} eftir — {total} alls',
    'be.start': '{trips} að núllpunkti',
    'be.exact': 'Nákvæmlega á núlli — næsta ferð er frí',
    'be.past': 'Komið yfir núllið — {trips} í hreinan gróða',
    'be.note': '{cardTrips} skipta kort kostar {perTrip} á ferð, svo árskortið borgar sig upp á {be} ferðum. Miðað við heil kort sem raunverulega eru keypt hefðirðu borgað meira frá ferð {cashBe} (þá þarf {cards} kortið).',

    'stat.cardPerTrip': 'Verð á ferð með korti',
    'stat.cardPerTripSub': '{price} ÷ {trips}',
    'stat.delta': 'Staða',
    'stat.saved': 'sparað m.v. kort',
    'stat.owed': 'á eftir að vinnast upp',

    'chart.label': 'Ferðir á mánuði',
    'chart.empty': 'Ekkert til að teikna enn',
    'chart.tooltip': '{month}: {trips}',

    'weekday.label': 'Ferðir eftir vikudegi',
    'weekday.empty': 'Ekkert til að teikna enn',
    'weekday.top': 'Vinsælasti dagurinn: {days}',
    'weekday.topTie': 'Vinsælustu dagarnir: {days}',
    'weekday.sub': '{trips} · {pct}%',
    'weekday.tooltip': '{day}: {trips} ({pct}%)',
    'list.and': 'og',

    'history.label': 'Ferðaskrá',
    'history.summary': '{trips} · síðast {date}',
    'history.none': 'Ekkert skráð enn',
    'history.empty': 'Engar ferðir enn. Ýttu á + eftir næstu sundferð.',
    'history.removeAria': 'Fjarlægja ferð {date}',
    'backdate.label': 'Skrá fyrri ferð',
    'backdate.add': 'Bæta við',
    'backdate.noDate': 'Veldu fyrst dagsetningu.',
    'backdate.future': 'Þetta er í framtíðinni.',

    'settings.label': 'Stillingar',
    'settings.close': 'Loka stillingum',
    'settings.membership': 'Verð á árskorti (kr)',
    'settings.seasonStart': 'Árskortið gildir frá',
    'settings.seasonEnd': 'Árskortið gildir til',
    'settings.seasonInverted': 'Lokadagsetningin er á undan upphafsdagsetningunni, svo engin ferð telst með.',
    'settings.cardPools': 'Laugar á kortinu',
    'settings.cardPoolsCount': 'Laugar á kortinu: {n} af {total}',
    'settings.poolFilter': 'Leita að laug',
    'settings.poolNoMatch': 'Engin laug passar við leitina',
    'settings.cardPrice': 'Verð á fjölnotakorti (kr)',
    'settings.cardTrips': 'Ferðir á korti',
    'settings.export': 'Flytja út gögn',
    'settings.reset': 'Núllstilla ferðir',
    'settings.note': 'Talningin er sameiginleg: öll tæki sem tengjast þessum þjóni sjá sömu tölu. Ferðir sem skráðar eru án nettengingar samstillast þegar tengingin kemur aftur.',
    'settings.resetConfirm': 'Eyða öllum {trips} á öllum tækjum? Þessu verður ekki hægt að afturkalla.',
    'settings.tokenPrompt': 'Aðgangskóði fyrir þennan Sund-þjón:',

    'rate.note': 'Upphæðir eru skráðar í ISK og umreiknaðar á gengi Seðlabanka Evrópu {date} (1 kr = {rate} {code}).',
    'rate.unavailable': 'Gengi ekki tiltækt — sýni upphæðir í ISK.',

    'public.updated': 'Uppfært {date}',
    'public.readonly': 'Skoðunarútgáfa — engar breytingar mögulegar.',

    'counter.total': '{trips} alls',
    'pool.total': 'Alls',
    'counter.offCard': '{trips} utan kortsins',
    'counter.outsideSeason': '{trips} utan gildistíma',

    'season.range': 'Árskortið gildir {from} – {to}',
    'season.from': 'Árskortið gildir frá {from}',
    'season.until': 'Árskortið gildir til {to}',
    'season.tag': 'utan gildistíma',

    'pool.forFun': 'utan kortsins',
    'pool.setOn': 'Velja laug',
    'pool.noneOption': '— engin laug —',
    'pool.label': 'Laugar',
    'pool.empty': 'Engar laugar skráðar enn',
    'pool.unattributed': 'Engin laug skráð',
    'pool.locating': 'Leita að staðsetningu…',
    'pool.off': 'Staðsetning ekki tiltæk',
    'pool.here': 'Þú ert við {name}',
    'pool.away': 'Engin þekkt laug nálægt',
    'pool.newPrompt': 'Hvaða laug er þetta?',

    'nav.map': 'Kort',
    'nav.back': 'Til baka',

    'map.label': 'Kort',
    'map.visited': 'Laugar heimsóttar',
    'map.visitedCount': 'Heimsóttar laugar: {n} af {total}',
    'map.country': 'Ísland',
    'map.countryAria': 'Kort af Íslandi — {done} laugar heimsóttar, {todo} eftir',
    'map.legendDone': 'Heimsótt',
    'map.legendTodo': 'Á eftir',
    'map.tipDone': '{name} · {trips}',
    'map.tipTodo': '{name} · engin ferð enn',
    'map.offMap': '{pools} eru án skráðrar staðsetningar og komast því hvergi á kortið.',
    'map.todoLabel': 'Ófarnar laugar',
    'map.todoEmpty': 'Engin eftir — það er búið að fara í allar laugar sem appið þekkir.',
    'map.offMapTag': 'ekki á korti',
    'map.creditCoast': 'Strandlína',
    'map.legendGroup': 'Nokkrar laugar saman',
    'map.groupMore': '+{n} til viðbótar',
    'map.zoomGroup': 'Þysja',
    'map.zoomIn': 'Þysja inn',
    'map.zoomOut': 'Þysja út',
    'map.zoomReset': 'Sýna allt kortið',
    'map.noSnapshot': 'Þessi skoðunarútgáfa er of gömul til að vita hvaða laugar hafa verið heimsóttar.',

    'busy.label': 'Aðsókn yfir daginn',
    'busy.season.winter': 'Dæmigerður dagur að vetri',
    'busy.season.spring': 'Dæmigerður dagur að vori',
    'busy.season.summer': 'Dæmigerður dagur að sumri',
    'busy.season.autumn': 'Dæmigerður dagur að hausti',
    'busy.dayPick': 'Veldu vikudag',
    'busy.hours': 'kl. {from}–{to}',
    'busy.about': 'um {people}',
    'busy.tip': '{hours} · {people}',
    'busy.nowTag': 'núna',
    'busy.peak': 'Mest að gera {hours}: {people} á klukkustund.',
    'busy.now': 'Núna, {hours}: að jafnaði {people}.',
    'busy.nowNone': 'Núna, {hours}: yfirleitt kemur enginn.',
    'busy.closed': 'Engar tölur um þennan dag.',
    'busy.aria': 'Gestir sem koma á hverri klukkustund, {day}',
    'busy.note': 'Meðalfjöldi gesta sem koma inn um hliðin á hverri klukkustund, {span}. Það eru komur, ekki hve margir eru í lauginni í einu. Heimild:',
    'map.pagesLabel': 'Laugar eftir landshlutum',
    'map.tipOpen': 'ýttu aftur til að opna',

    'poolpage.kind.pool': 'Sundlaug',
    'poolpage.kind.lagoon': 'Baðlón',
    'poolpage.kind.natural': 'Náttúrulaug',
    'poolpage.none': 'Engin ferð hingað enn',
    'poolpage.onCard': 'á kortinu',
    'poolpage.today': 'Opið í dag: {hours}',
    'poolpage.noInfo': 'Upplýsingar af sundlaugar.is eru ekki komnar fyrir þessa laug.',
    'poolpage.unknown': 'Engin laug er til með þessu auðkenni.',
    'poolpage.hours': 'Afgreiðslutími',
    'poolpage.everyDay': 'alla daga',
    'poolpage.closed': 'lokað',
    'poolpage.outdoors': '(úti)',
    'poolpage.indoors': '(inni)',
    'poolpage.fromDate': 'Frá {date}',
    'poolpage.current': 'gildir núna',
    'poolpage.facilities': 'Aðstaða',
    'poolpage.longest': 'Lengsta laugin er {m} m',
    'poolpage.prices': 'Verðskrá',
    'poolpage.pricesYear': 'Verðskrá {year}',
    'poolpage.priceNotes': 'Skýringar við verðskrá',
    'poolpage.where': 'Staðsetning',
    'poolpage.mapAria': 'Kort sem sýnir hvar {name} er',
    'poolpage.openMap': 'Opna í Google Maps',
    'poolpage.contact': 'Hafa samband',
    'poolpage.phone': 'Sími',
    'poolpage.email': 'Netfang',
    'poolpage.web': 'Vefsíða',
    'poolpage.facebook': 'Facebook',
    'poolpage.instagram': 'Instagram',
    'poolpage.more': 'Fleiri laugar · {region}',
    'poolpage.source': 'Upplýsingar af sundlaugar.is, sóttar {date}.',
    'poolpage.sourceLink': 'Laugin á sundlaugar.is',

    'guide.label': 'Um laugina',
    'guide.temp': 'Hiti vatnsins',
    'guide.access': 'Aðkoma',
    'guide.access.car': 'Fært öllum bílum',
    'guide.access.4x4': 'Aðeins fyrir jeppa',
    'guide.access.walk': 'Ganga síðasta spölinn',
    'guide.walk': 'Ganga',
    'guide.minutes': '{min} mín',
    'guide.facilities': 'Aðstaða',
    'guide.facilities.none': 'Engin',
    'guide.facilities.basic': 'Búningsskýli',
    'guide.cost': 'Aðgangur',
    'guide.free': 'Ókeypis',
    'guide.paid': 'Greitt',
    'guide.caution.checkTemp': 'Prófaðu hitann áður en þú ferð ofan í.',
    'guide.caution.slippery': 'Gróður á bökkunum og í kring getur verið háll.',
    'guide.caution.nearby': 'Hinar laugarnar í kring eru of heitar eða of kaldar til að baða sig í.',
    'guide.caution.burnsOnPath': 'Farðu varlega: margir hverir á leiðinni eru mjög heitir og auðvelt að brenna sig.',
    'guide.caution.noSoap': 'Bannað er að nota sápu í læknum.',
    'guide.caution.ownRisk': 'Gestir baða sig á eigin ábyrgð.',
    'guide.caution.shallowWhenFilling': 'Farðu varlega þegar verið er að fylla laugina: hún er þá grunn og getur verið hál.',
    'guide.caution.showerFirst': 'Farðu í sturtu áður en þú ferð ofan í.',
    'guide.caution.noBathing': 'Bannað er að baða sig í lauginni.',
    'guide.caution.veryHot': 'Vatnið getur verið afar heitt.',
    'guide.facilities.showers': 'Sturtur',
    'guide.caution.litter': 'Gakktu vel um og taktu allt rusl með þér.',

    'facility.outdoor': 'Útilaug',
    'facility.indoor': 'Innilaug',
    'facility.hotTubs': 'Heitir pottar',
    'facility.coldTub': 'Kaldur pottur',
    'facility.steam': 'Eimbað',
    'facility.sauna': 'Sauna',
    'facility.slide': 'Rennibraut',
    'facility.kids': 'Vaðlaug eða barnalaug',
    'facility.massage': 'Nuddpottur',
    'facility.diving': 'Stökkbretti',
    'facility.gym': 'Líkamsrækt',
    'facility.food': 'Veitingar',
    'facility.accessible': 'Aðgengi fyrir hreyfihamlaða',
    'facility.aquaAerobics': 'Sundleikfimi',

    'region.hofudborgarsvaedid': 'Höfuðborgarsvæðið',
    'region.reykjanes': 'Reykjanes',
    'region.vesturland': 'Vesturland',
    'region.vestfirdir': 'Vestfirðir',
    'region.nordurland-vestra': 'Norðurland vestra',
    'region.nordurland-eystra': 'Norðurland eystra',
    'region.austurland': 'Austurland',
    'region.sudurland': 'Suðurland',
    'region.halendid': 'Hálendið',

    'sync.syncing': 'Samstilli…',
    'sync.synced': 'Samstillt',
    'sync.offline': 'Ónettengt — samstilli síðar',
    'sync.locked': 'Aðgangskóða vantar',
    'sync.error': 'Breytingu hafnað',
    'sync.pending': '{status} ({changes} bíða)',

    'n.trip': { one: '{n} ferð', other: '{n} ferðir' },
    'n.pool': { one: '{n} laug', other: '{n} laugar' },
    'n.guest': { one: '{n} gestur', other: '{n} gestir' },
    'n.change': { one: '{n} breyting', other: '{n} breytingar' }
  },

  en: {
    'a11y.langSwitch': 'Skipta yfir á íslensku',
    'a11y.settings': 'Settings',
    'a11y.syncNow': 'Sync now',

    'counter.label': 'Trips this membership',
    'counter.add': 'Add a trip',
    'counter.remove': 'Remove a trip',
    'counter.lastSwim': 'Last swim {date}',
    'counter.none': 'No trips logged yet',

    'cost.label': 'Cost per trip so far',
    'cost.sub': '{total} ÷ {trips}',
    'cost.unused': '{total} membership, not used yet',

    'be.label': 'Break-even vs {n}-trip cards',
    'be.toGo': '{left} to go — {total} in total',
    'be.start': '{trips} to break even',
    'be.exact': 'Broken even exactly — the next trip is free',
    'be.past': 'Broken even — {trips} of pure profit',
    'be.note': 'A {cardTrips}-trip card works out at {perTrip} per trip, so the membership pays for itself at {be} trips. Counting whole cards actually bought, you would have overpaid from trip {cashBe} (that is when a {cards} card is needed).',

    'stat.cardPerTrip': 'Card price per trip',
    'stat.cardPerTripSub': '{price} ÷ {trips}',
    'stat.delta': 'Ahead / behind',
    'stat.saved': 'saved vs cards',
    'stat.owed': 'still to earn back',

    'chart.label': 'Trips per month',
    'chart.empty': 'Nothing to plot yet',
    'chart.tooltip': '{month}: {trips}',

    'weekday.label': 'Trips by weekday',
    'weekday.empty': 'Nothing to plot yet',
    'weekday.top': 'Most popular day: {days}',
    'weekday.topTie': 'Most popular days: {days}',
    'weekday.sub': '{trips} · {pct}%',
    'weekday.tooltip': '{day}: {trips} ({pct}%)',
    'list.and': 'and',

    'history.label': 'History',
    'history.summary': '{trips} · last {date}',
    'history.none': 'Nothing logged yet',
    'history.empty': 'No trips yet. Tap + after your next swim.',
    'history.removeAria': 'Remove trip on {date}',
    'backdate.label': 'Log a past swim',
    'backdate.add': 'Add',
    'backdate.noDate': 'Pick a date first.',
    'backdate.future': "That's in the future.",

    'settings.label': 'Settings',
    'settings.close': 'Close settings',
    'settings.membership': 'Membership cost (kr)',
    'settings.seasonStart': 'Membership valid from',
    'settings.seasonEnd': 'Membership valid until',
    'settings.seasonInverted': 'The end date is before the start date, so no trip counts.',
    'settings.cardPools': 'Pools on the card',
    'settings.cardPoolsCount': 'Pools on the card: {n} of {total}',
    'settings.poolFilter': 'Search pools',
    'settings.poolNoMatch': 'No pool matches that search',
    'settings.cardPrice': 'Multi-trip card price (kr)',
    'settings.cardTrips': 'Trips per card',
    'settings.export': 'Export data',
    'settings.reset': 'Reset trips',
    'settings.note': 'The count is shared: every device pointed at this server sees the same number. Taps made offline sync when you reconnect.',
    'settings.resetConfirm': 'Delete all {trips} on every device? This cannot be undone.',
    'settings.tokenPrompt': 'Access code for this Sund server:',

    'rate.note': 'Amounts are recorded in ISK and converted at the European Central Bank rate of {date} (1 kr = {rate} {code}).',
    'rate.unavailable': 'Exchange rate unavailable — showing amounts in ISK.',

    'public.updated': 'Updated {date}',
    'public.readonly': 'Read-only view — nothing here can be changed.',

    'counter.total': '{trips} in total',
    'pool.total': 'Total',
    'counter.offCard': '{trips} not on the card',
    'counter.outsideSeason': '{trips} outside the dates',

    'season.range': 'Membership runs {from} – {to}',
    'season.from': 'Membership runs from {from}',
    'season.until': 'Membership runs until {to}',
    'season.tag': 'outside the dates',

    'pool.forFun': 'not on the card',
    'pool.setOn': 'Set pool',
    'pool.noneOption': '— no pool —',
    'pool.label': 'Pools',
    'pool.empty': 'No pools recorded yet',
    'pool.unattributed': 'No pool recorded',
    'pool.locating': 'Finding your location…',
    'pool.off': 'Location unavailable',
    'pool.here': "You're at {name}",
    'pool.away': 'No known pool nearby',
    'pool.newPrompt': 'Which pool is this?',

    'nav.map': 'Map',
    'nav.back': 'Back',

    'map.label': 'Map',
    'map.visited': 'Pools visited',
    'map.visitedCount': 'Pools visited: {n} of {total}',
    'map.country': 'Iceland',
    'map.countryAria': 'Map of Iceland — {done} pools visited, {todo} still to go',
    'map.legendDone': 'Visited',
    'map.legendTodo': 'Not yet',
    'map.tipDone': '{name} · {trips}',
    'map.tipTodo': '{name} · no trips yet',
    'map.offMap': '{pools} have no position on file, so they reach neither map.',
    'map.todoLabel': 'Still to go',
    'map.todoEmpty': 'None left — every pool the app knows about has been swum in.',
    'map.offMapTag': 'not on the map',
    'map.creditCoast': 'Coastline',
    'map.legendGroup': 'Several pools together',
    'map.groupMore': '+{n} more',
    'map.zoomGroup': 'Zoom',
    'map.zoomIn': 'Zoom in',
    'map.zoomOut': 'Zoom out',
    'map.zoomReset': 'Show the whole map',
    'map.noSnapshot': 'This snapshot is too old to say which pools have been visited.',

    'busy.label': 'Busy times',
    'busy.season.winter': 'A typical winter day',
    'busy.season.spring': 'A typical spring day',
    'busy.season.summer': 'A typical summer day',
    'busy.season.autumn': 'A typical autumn day',
    'busy.dayPick': 'Choose a day',
    'busy.hours': '{from}:00–{to}:00',
    'busy.about': 'about {people}',
    'busy.tip': '{hours} · {people}',
    'busy.nowTag': 'now',
    'busy.peak': 'Busiest {hours}: {people} arrive in the hour.',
    'busy.now': 'Now, {hours}, {people} usually arrive.',
    'busy.nowNone': 'Now, {hours}, usually nobody arrives.',
    'busy.closed': 'No counts for this day.',
    'busy.aria': 'People arriving each hour, {day}',
    'busy.note': 'The average number of people coming in through the gates each hour, {span}. These are arrivals, not how many are in the water at once. Source:',
    'map.pagesLabel': 'Pools by region',
    'map.tipOpen': 'tap again to open',

    'poolpage.kind.pool': 'Swimming pool',
    'poolpage.kind.lagoon': 'Lagoon',
    'poolpage.kind.natural': 'Natural pool',
    'poolpage.none': 'No trips here yet',
    'poolpage.onCard': 'on the card',
    'poolpage.today': 'Open today: {hours}',
    'poolpage.noInfo': 'The details from sundlaugar.is have not been fetched for this pool yet.',
    'poolpage.unknown': 'There is no pool with that id.',
    'poolpage.hours': 'Opening hours',
    'poolpage.everyDay': 'Every day',
    'poolpage.closed': 'closed',
    'poolpage.outdoors': '(outdoors)',
    'poolpage.indoors': '(indoors)',
    'poolpage.fromDate': 'From {date}',
    'poolpage.current': 'now',
    'poolpage.facilities': 'Facilities',
    'poolpage.longest': 'The longest pool is {m} m',
    'poolpage.prices': 'Prices',
    'poolpage.pricesYear': 'Prices {year}',
    'poolpage.priceNotes': 'Notes to the prices',
    'poolpage.where': 'Location',
    'poolpage.mapAria': 'Map showing where {name} is',
    'poolpage.openMap': 'Open in Google Maps',
    'poolpage.contact': 'Contact',
    'poolpage.phone': 'Phone',
    'poolpage.email': 'Email',
    'poolpage.web': 'Website',
    'poolpage.facebook': 'Facebook',
    'poolpage.instagram': 'Instagram',
    'poolpage.more': 'More pools · {region}',
    'poolpage.source': 'Details from sundlaugar.is, as of {date}.',
    'poolpage.sourceLink': 'This pool on sundlaugar.is',
    'poolpage.inIcelandic': 'Notes and ticket names are as written there, in Icelandic.',

    'guide.label': 'About the pool',
    'guide.temp': 'Water',
    'guide.access': 'Getting there',
    'guide.access.car': 'Any car',
    'guide.access.4x4': '4×4 only',
    'guide.access.walk': 'On foot for the last part',
    'guide.walk': 'Walk',
    'guide.minutes': '{min} min',
    'guide.facilities': 'Facilities',
    'guide.facilities.none': 'None',
    'guide.facilities.basic': 'Changing hut',
    'guide.cost': 'Entry',
    'guide.free': 'Free',
    'guide.paid': 'Paid',
    'guide.caution.checkTemp': 'Check the temperature before you get in.',
    'guide.caution.slippery': 'Vegetation on the edges and around the pool can be slippery.',
    'guide.caution.nearby': 'The other pools nearby are too hot or too cold to bathe in.',
    'guide.caution.burnsOnPath': 'Take care: many springs along the path are very hot and it is easy to get burnt.',
    'guide.caution.noSoap': 'No soap in the stream.',
    'guide.caution.ownRisk': 'Bathing is at your own risk.',
    'guide.caution.shallowWhenFilling': 'Take care while the pool is being filled: it is shallow and can be slippery.',
    'guide.caution.showerFirst': 'Shower before you get in.',
    'guide.caution.noBathing': 'Bathing in this pool is not allowed.',
    'guide.caution.veryHot': 'The water can be extremely hot.',
    'guide.facilities.showers': 'Showers',
    'guide.caution.litter': 'Leave it as you found it and take all rubbish with you.',

    'facility.outdoor': 'Outdoor pool',
    'facility.indoor': 'Indoor pool',
    'facility.hotTubs': 'Hot tubs',
    'facility.coldTub': 'Cold tub',
    'facility.steam': 'Steam bath',
    'facility.sauna': 'Sauna',
    'facility.slide': 'Water slide',
    'facility.kids': "Children's pool",
    'facility.massage': 'Massage jets',
    'facility.diving': 'Diving board',
    'facility.gym': 'Gym',
    'facility.food': 'Food and drink',
    'facility.accessible': 'Wheelchair access',
    'facility.aquaAerobics': 'Aqua aerobics',

    'region.hofudborgarsvaedid': 'Capital area',
    'region.reykjanes': 'Reykjanes',
    'region.vesturland': 'West Iceland',
    'region.vestfirdir': 'Westfjords',
    'region.nordurland-vestra': 'Northwest Iceland',
    'region.nordurland-eystra': 'Northeast Iceland',
    'region.austurland': 'East Iceland',
    'region.sudurland': 'South Iceland',
    'region.halendid': 'Highlands',

    'sync.syncing': 'Syncing…',
    'sync.synced': 'Synced',
    'sync.offline': 'Offline — will sync later',
    'sync.locked': 'Access code needed',
    'sync.error': 'Change rejected',
    'sync.pending': '{status} ({changes} pending)',

    'n.trip': { one: '{n} trip', other: '{n} trips' },
    'n.pool': { one: '{n} pool', other: '{n} pools' },
    'n.guest': { one: '{n} person', other: '{n} people' },
    'n.change': { one: '{n} change', other: '{n} changes' }
  },

  pl: {
    'a11y.langSwitch': 'Zmień język',
    'a11y.settings': 'Ustawienia',
    'a11y.syncNow': 'Synchronizuj teraz',

    'counter.label': 'Wejścia na karnecie',
    'counter.add': 'Dodaj wejście',
    'counter.remove': 'Usuń wejście',
    'counter.lastSwim': 'Ostatnie wejście {date}',
    'counter.none': 'Brak zapisanych wejść',

    'cost.label': 'Koszt jednego wejścia',
    'cost.sub': '{total} ÷ {trips}',
    'cost.unused': 'Karnet za {total}, jeszcze nieużywany',

    'be.label': 'Próg opłacalności — karnet na {n} wejść',
    'be.toGo': 'Zostało {left} — łącznie {total}',
    'be.start': '{trips} do progu opłacalności',
    'be.exact': 'Dokładnie na zero — następne wejście za darmo',
    'be.past': 'Próg przekroczony — {trips} czystego zysku',
    'be.note': 'Karnet na {cardTrips} wejść kosztuje {perTrip} za wejście, więc karnet roczny zwraca się po {be} wejściach. Licząc całe karnety faktycznie kupione, od wejścia {cashBe} trzeba by zapłacić więcej (wtedy potrzebny jest {cards} karnet).',

    'stat.cardPerTrip': 'Cena wejścia z karnetu',
    'stat.cardPerTripSub': '{price} ÷ {trips}',
    'stat.delta': 'Bilans',
    'stat.saved': 'zaoszczędzone wobec karnetów',
    'stat.owed': 'pozostało do odrobienia',

    'chart.label': 'Wejścia miesięcznie',
    'chart.empty': 'Nie ma jeszcze czego pokazać',
    'chart.tooltip': '{month}: {trips}',

    'weekday.label': 'Wejścia według dnia tygodnia',
    'weekday.empty': 'Nie ma jeszcze czego pokazać',
    'weekday.top': 'Najpopularniejszy dzień: {days}',
    'weekday.topTie': 'Najpopularniejsze dni: {days}',
    'weekday.sub': '{trips} · {pct}%',
    'weekday.tooltip': '{day}: {trips} ({pct}%)',
    'list.and': 'i',

    'history.label': 'Historia',
    'history.summary': '{trips} · ostatnio {date}',
    'history.none': 'Nic jeszcze nie zapisano',
    'history.empty': 'Brak wejść. Naciśnij + po następnym pływaniu.',
    'history.removeAria': 'Usuń wejście z {date}',
    'backdate.label': 'Zapisz wcześniejsze wejście',
    'backdate.add': 'Dodaj',
    'backdate.noDate': 'Najpierw wybierz datę.',
    'backdate.future': 'To jest w przyszłości.',

    'settings.label': 'Ustawienia',
    'settings.close': 'Zamknij ustawienia',
    'settings.membership': 'Cena karnetu rocznego (kr)',
    'settings.seasonStart': 'Karnet ważny od',
    'settings.seasonEnd': 'Karnet ważny do',
    'settings.seasonInverted': 'Data końcowa jest wcześniejsza niż początkowa, więc żadne wejście się nie liczy.',
    'settings.cardPools': 'Baseny w karnecie',
    'settings.cardPoolsCount': 'Baseny w karnecie: {n} z {total}',
    'settings.poolFilter': 'Szukaj basenu',
    'settings.poolNoMatch': 'Żaden basen nie pasuje do wyszukiwania',
    'settings.cardPrice': 'Cena karnetu wielokrotnego (kr)',
    'settings.cardTrips': 'Wejścia na karnecie',
    'settings.export': 'Eksportuj dane',
    'settings.reset': 'Wyzeruj wejścia',
    'settings.note': 'Licznik jest wspólny: wszystkie urządzenia połączone z tym serwerem widzą tę samą liczbę. Wejścia zapisane bez internetu zsynchronizują się po ponownym połączeniu.',
    'settings.resetConfirm': 'Usunąć wszystkie {trips} na wszystkich urządzeniach? Tej operacji nie można cofnąć.',
    'settings.tokenPrompt': 'Kod dostępu do tego serwera Sund:',

    'rate.note': 'Kwoty są zapisywane w ISK i przeliczane po kursie Europejskiego Banku Centralnego z {date} (1 kr = {rate} {code}).',
    'rate.unavailable': 'Kurs niedostępny — kwoty w ISK.',

    'public.updated': 'Zaktualizowano {date}',
    'public.readonly': 'Widok tylko do odczytu — nic nie można zmienić.',

    'counter.total': '{trips} łącznie',
    'pool.total': 'Łącznie',
    'counter.offCard': '{trips} poza karnetem',
    'counter.outsideSeason': '{trips} poza terminem',

    'season.range': 'Karnet ważny {from} – {to}',
    'season.from': 'Karnet ważny od {from}',
    'season.until': 'Karnet ważny do {to}',
    'season.tag': 'poza terminem',

    'pool.forFun': 'poza karnetem',
    'pool.setOn': 'Wybierz basen',
    'pool.noneOption': '— bez basenu —',
    'pool.label': 'Baseny',
    'pool.empty': 'Nie zapisano jeszcze żadnego basenu',
    'pool.unattributed': 'Bez basenu',
    'pool.locating': 'Ustalanie lokalizacji…',
    'pool.off': 'Lokalizacja niedostępna',
    'pool.here': 'Jesteś przy {name}',
    'pool.away': 'Brak znanego basenu w pobliżu',
    'pool.newPrompt': 'Który to basen?',

    'nav.map': 'Mapa',
    'nav.back': 'Wróć',

    'map.label': 'Mapa',
    'map.visited': 'Odwiedzone baseny',
    'map.visitedCount': 'Odwiedzone baseny: {n} z {total}',
    'map.country': 'Islandia',
    'map.countryAria': 'Mapa Islandii — {done} odwiedzonych, {todo} przed tobą',
    'map.legendDone': 'Odwiedzone',
    'map.legendTodo': 'Jeszcze nie',
    'map.tipDone': '{name} · {trips}',
    'map.tipTodo': '{name} · jeszcze ani razu',
    'map.offMap': '{pools} nie ma zapisanej lokalizacji, więc nie trafia na żadną mapę.',
    'map.todoLabel': 'Jeszcze przed tobą',
    'map.todoEmpty': 'Nic nie zostało — wszystkie baseny znane aplikacji są zaliczone.',
    'map.offMapTag': 'poza mapą',
    'map.creditCoast': 'Linia brzegowa',
    'map.legendGroup': 'Kilka basenów obok siebie',
    'map.groupMore': '+{n} więcej',
    'map.zoomGroup': 'Powiększenie',
    'map.zoomIn': 'Przybliż',
    'map.zoomOut': 'Oddal',
    'map.zoomReset': 'Pokaż całą mapę',
    'map.noSnapshot': 'Ten zapis jest zbyt stary, aby wskazać odwiedzone baseny.',

    'busy.label': 'Obłożenie w ciągu dnia',
    'busy.season.winter': 'Typowy dzień zimą',
    'busy.season.spring': 'Typowy dzień wiosną',
    'busy.season.summer': 'Typowy dzień latem',
    'busy.season.autumn': 'Typowy dzień jesienią',
    'busy.dayPick': 'Wybierz dzień',
    'busy.hours': '{from}:00–{to}:00',
    'busy.about': 'ok. {people}',
    'busy.tip': '{hours} · {people}',
    'busy.nowTag': 'teraz',
    'busy.peak': 'Najwięcej ludzi {hours}: w ciągu godziny przychodzi {people}.',
    'busy.now': 'Teraz, {hours}, zwykle przychodzi {people}.',
    'busy.nowNone': 'Teraz, {hours}, zwykle nikt nie przychodzi.',
    'busy.closed': 'Brak danych dla tego dnia.',
    'busy.aria': 'Osoby przychodzące w każdej godzinie, {day}',
    'busy.note': 'Średnia liczba osób wchodzących przez bramki w każdej godzinie, {span}. To wejścia, a nie liczba osób jednocześnie w basenie. Źródło:',
    'map.pagesLabel': 'Baseny według regionów',
    'map.tipOpen': 'stuknij ponownie, aby otworzyć',

    'poolpage.kind.pool': 'Basen',
    'poolpage.kind.lagoon': 'Laguna',
    'poolpage.kind.natural': 'Naturalne źródło',
    'poolpage.none': 'Jeszcze tu nie pływano',
    'poolpage.onCard': 'w karnecie',
    'poolpage.today': 'Dziś otwarte: {hours}',
    'poolpage.noInfo': 'Informacje z sundlaugar.is dla tego basenu nie zostały jeszcze pobrane.',
    'poolpage.unknown': 'Nie ma basenu o takim identyfikatorze.',
    'poolpage.hours': 'Godziny otwarcia',
    'poolpage.everyDay': 'codziennie',
    'poolpage.closed': 'zamknięte',
    'poolpage.outdoors': '(na zewnątrz)',
    'poolpage.indoors': '(w środku)',
    'poolpage.fromDate': 'Od {date}',
    'poolpage.current': 'teraz',
    'poolpage.facilities': 'Udogodnienia',
    'poolpage.longest': 'Najdłuższy basen ma {m} m',
    'poolpage.prices': 'Cennik',
    'poolpage.pricesYear': 'Cennik {year}',
    'poolpage.priceNotes': 'Uwagi do cennika',
    'poolpage.where': 'Lokalizacja',
    'poolpage.mapAria': 'Mapa z położeniem: {name}',
    'poolpage.openMap': 'Otwórz w Mapach Google',
    'poolpage.contact': 'Kontakt',
    'poolpage.phone': 'Telefon',
    'poolpage.email': 'E-mail',
    'poolpage.web': 'Strona',
    'poolpage.facebook': 'Facebook',
    'poolpage.instagram': 'Instagram',
    'poolpage.more': 'Więcej basenów · {region}',
    'poolpage.source': 'Informacje z sundlaugar.is, stan na {date}.',
    'poolpage.sourceLink': 'Ten basen na sundlaugar.is',
    'poolpage.inIcelandic': 'Uwagi i nazwy biletów podano tak, jak są tam zapisane — po islandzku.',

    'guide.label': 'O basenie',
    'guide.temp': 'Woda',
    'guide.access': 'Dojazd',
    'guide.access.car': 'Każdym samochodem',
    'guide.access.4x4': 'Tylko 4×4',
    'guide.access.walk': 'Ostatni odcinek pieszo',
    'guide.walk': 'Spacer',
    'guide.minutes': '{min} min',
    'guide.facilities': 'Udogodnienia',
    'guide.facilities.none': 'Brak',
    'guide.facilities.basic': 'Przebieralnia',
    'guide.cost': 'Wstęp',
    'guide.free': 'Bezpłatny',
    'guide.paid': 'Płatny',
    'guide.caution.checkTemp': 'Sprawdź temperaturę przed wejściem do wody.',
    'guide.caution.slippery': 'Roślinność na brzegach i wokół basenu może być śliska.',
    'guide.caution.nearby': 'Pozostałe baseny w pobliżu są za gorące lub za zimne do kąpieli.',
    'guide.caution.burnsOnPath': 'Uwaga: wiele źródeł przy ścieżce jest bardzo gorących, łatwo się poparzyć.',
    'guide.caution.noSoap': 'W strumieniu nie wolno używać mydła.',
    'guide.caution.ownRisk': 'Kąpiel na własną odpowiedzialność.',
    'guide.caution.shallowWhenFilling': 'Uwaga podczas napełniania basenu: jest wtedy płytki i może być śliski.',
    'guide.caution.showerFirst': 'Przed wejściem weź prysznic.',
    'guide.caution.noBathing': 'Kąpiel w tym basenie jest zabroniona.',
    'guide.caution.veryHot': 'Woda może być bardzo gorąca.',
    'guide.facilities.showers': 'Prysznice',
    'guide.caution.litter': 'Zostaw miejsce czyste i zabierz wszystkie śmieci.',

    'facility.outdoor': 'Basen zewnętrzny',
    'facility.indoor': 'Basen kryty',
    'facility.hotTubs': 'Gorące wanny',
    'facility.coldTub': 'Zimna wanna',
    'facility.steam': 'Łaźnia parowa',
    'facility.sauna': 'Sauna',
    'facility.slide': 'Zjeżdżalnia',
    'facility.kids': 'Brodzik',
    'facility.massage': 'Hydromasaż',
    'facility.diving': 'Trampolina',
    'facility.gym': 'Siłownia',
    'facility.food': 'Jedzenie i napoje',
    'facility.accessible': 'Dostęp dla wózków',
    'facility.aquaAerobics': 'Aqua aerobik',

    'region.hofudborgarsvaedid': 'Region stołeczny',
    'region.reykjanes': 'Reykjanes',
    'region.vesturland': 'Islandia Zachodnia',
    'region.vestfirdir': 'Fiordy Zachodnie',
    'region.nordurland-vestra': 'Islandia Północno-Zachodnia',
    'region.nordurland-eystra': 'Islandia Północno-Wschodnia',
    'region.austurland': 'Islandia Wschodnia',
    'region.sudurland': 'Islandia Południowa',
    'region.halendid': 'Interior',

    'sync.syncing': 'Synchronizuję…',
    'sync.synced': 'Zsynchronizowano',
    'sync.offline': 'Offline — zsynchronizuję później',
    'sync.locked': 'Wymagany kod dostępu',
    'sync.error': 'Zmiana odrzucona',
    'sync.pending': '{status} ({changes} oczekuje)',

    'n.trip': { one: '{n} wejście', few: '{n} wejścia', many: '{n} wejść' },
    'n.pool': { one: '{n} basen', few: '{n} baseny', many: '{n} basenów' },
    'n.guest': { one: '{n} osoba', few: '{n} osoby', many: '{n} osób' },
    'n.change': { one: '{n} zmiana', few: '{n} zmiany', many: '{n} zmian' }
  }
};

/* Icelandic takes the singular for anything ending in 1 except 11 — 21 ferð,
   31 ferð, but 11 ferðir. English is the plain n === 1. */
const PLURAL_RULE = {
  is: (n) => (Math.abs(n) % 10 === 1 && Math.abs(n) % 100 !== 11 ? 'one' : 'other'),
  en: (n) => (Math.abs(n) === 1 ? 'one' : 'other'),
  /* Polish has three: 1 wejście; 2–4 wejścia (but not 12–14); everything
     else, including 0 and 5–21, wejść. */
  pl: (n) => {
    const a = Math.abs(n), t = a % 10, h = a % 100;
    if (a === 1) return 'one';
    if (t >= 2 && t <= 4 && !(h >= 12 && h <= 14)) return 'few';
    return 'many';
  }
};

const interpolate = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? vars[key] : whole));

export function t(lang, key, vars = {}) {
  const entry = S[lang]?.[key] ?? S[DEFAULT_LANG][key];
  if (entry === undefined) return key;                  // surface the typo
  return interpolate(entry, vars);
}

/* "3 ferðir" / "3 trips" — the number and its noun agreed. */
export function plural(lang, n, noun) {
  const forms = S[lang]?.[`n.${noun}`] ?? S[DEFAULT_LANG][`n.${noun}`];
  const cat = PLURAL_RULE[lang](n);
  const form = forms[cat] ?? forms.other ?? forms.many ?? forms.one;
  return interpolate(form, { n: groupNumber(lang, n) });
}

/* Icelandic groups with dots (36.400), English with commas (36,400). */
export function groupNumber(lang, n) {
  // Polish groups with a non-breaking space (36 400), Icelandic with a dot.
  const sep = lang === 'is' ? '.' : lang === 'pl' ? '\u00a0' : ',';
  return String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export const kr = (lang, v) => `${groupNumber(lang, v)} kr`;

/* Icelandic writes ordinals as "3."; English needs the suffix. */
export function ordinal(lang, n) {
  if (lang === 'is' || lang === 'pl') return `${n}.`;
  const t1 = n % 10, t2 = n % 100;
  if (t1 === 1 && t2 !== 11) return `${n}st`;
  if (t1 === 2 && t2 !== 12) return `${n}nd`;
  if (t1 === 3 && t2 !== 13) return `${n}rd`;
  return `${n}th`;
}

const MONTHS = {
  is: ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  pl: ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień']
};

/* Polish inflects the month inside a date: a heading is "sierpień 2026" but a
   date is "22 sierpnia 2026". Languages without a separate form fall back to
   MONTHS above. */
const MONTHS_IN_DATE = {
  pl: ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']
};
const MONTHS_SHORT = {
  is: ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pl: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
};
const WEEKDAYS_SHORT = {
  is: ['sun', 'mán', 'þri', 'mið', 'fim', 'fös', 'lau'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  pl: ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.']
};
/* Icelandic and Polish leave weekday names lowercase; only English capitalises
   them. The strings that use these keep the name out of sentence-initial
   position so the case is never wrong. */
const WEEKDAYS = {
  is: ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  pl: ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota']
};

/* `day` is getDay()'s numbering, Sunday 0 — the same index the tables use. */
export function weekdayName(lang, day, style = 'full') {
  const table = style === 'short' ? WEEKDAYS_SHORT : WEEKDAYS;
  return (table[lang] ?? table[DEFAULT_LANG])[day] ?? '';
}

/* "mán, þri og fim" / "Mon, Tue and Thu" — for the days tied for the most
   swims, where the count is whatever the week happened to produce. */
export function joinList(lang, items) {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${t(lang, 'list.and')} ${items[items.length - 1]}`;
}

/* full  -> 18. ágúst 2026        / 18 August 2026
   day   -> þri. 18. ágú          / Tue 18 Aug
   month -> ágúst 2026            / August 2026
   short -> ágú                   / Aug              (chart axis) */
export function formatDate(lang, value, style = 'full') {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return '';
  const day = d.getDate(), mon = d.getMonth(), year = d.getFullYear();
  const wd = WEEKDAYS_SHORT[lang][d.getDay()];
  switch (style) {
    case 'day':
      return lang === 'is'
        ? `${wd}. ${day}. ${MONTHS_SHORT.is[mon]}`
        : `${wd} ${day} ${MONTHS_SHORT[lang][mon]}`;
    case 'month':
      return `${MONTHS[lang][mon]} ${year}`;
    case 'short':
      return MONTHS_SHORT[lang][mon];
    default: {
      const name = (MONTHS_IN_DATE[lang] ?? MONTHS[lang])[mon];
      return lang === 'is' ? `${day}. ${name} ${year}` : `${day} ${name} ${year}`;
    }
  }
}

/* "1. maí" / "1 May" / "1 maja" — a day of no year in particular, for the
   seasons a pool's opening hours run between. `md` is MM-DD. Polish takes the
   in-date form of the month, as it does in a whole date. */
export function formatDayMonth(lang, md) {
  const mon = Number(md.slice(0, 2)) - 1;
  const day = Number(md.slice(3));
  const name = (MONTHS_IN_DATE[lang] ?? MONTHS[lang] ?? MONTHS[DEFAULT_LANG])[mon];
  return lang === 'is' ? `${day}. ${name}` : `${day} ${name}`;
}

/* 24-hour in both languages — Iceland uses it, and it avoids AM/PM clutter in
   a list where the time is secondary information. */
export function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* Icelandic unless this device has explicitly chosen otherwise. The browser's
   own language is deliberately ignored: it is an Icelandic pool, so a phone set
   to English should still open in Icelandic until someone says otherwise. */
export function detectLang() {
  const stored = localStorage.getItem('sund.lang');
  return LANGS.includes(stored) ? stored : DEFAULT_LANG;
}
