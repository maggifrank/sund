/* The words in a pool's details, in English and Polish. The details come from
   sundlaugar.is in Icelandic, written by a hundred pools in a hundred ways, but
   most of what a table says is the same few dozen words: who pays (Fullorðnir,
   Börn, 0 - 9 ára), for what (Stakt gjald, 10 miðar, Árskort), and the holidays
   the hours are listed for (Aðfangadagur, 24. desember). Those are translated
   here. Anything not known comes back as written: an Icelandic word is better
   than a wrong guess. Notes, which are sentences, are never translated. */

import { formatDayMonth, joinList } from './i18n.js';

/* Keys are folded (see fold()): lower case, one space, plain hyphens. */
const TERMS = {
  /* hours headings */
  'afgreiðslutími': ['Opening hours', 'Godziny otwarcia'],
  'opnunartími': ['Opening hours', 'Godziny otwarcia'],
  'opnunartímar': ['Opening hours', 'Godziny otwarcia'],
  'sumaropnun': ['Summer hours', 'Godziny letnie'],
  'sumar opnun': ['Summer hours', 'Godziny letnie'],
  'vetraropnun': ['Winter hours', 'Godziny zimowe'],
  'vetrar opnun': ['Winter hours', 'Godziny zimowe'],
  'sami opnunartími allt árið': ['Same hours all year', 'Te same godziny przez cały rok'],
  'jól og áramót': ['Christmas and New Year', 'Boże Narodzenie i Nowy Rok'],
  'aðrir hátíðisdagar': ['Other holidays', 'Inne święta'],
  'hátíðisdagar': ['Holidays', 'Święta'],
  'almennir frídagar': ['public holidays', 'dni wolne od pracy'],
  'frídagar': ['Public holidays', 'Dni wolne od pracy'],
  'opnunartímar frídaga': ['Holiday hours', 'Godziny w dni wolne'],
  'afgreiðslutími um páska': ['Easter hours', 'Godziny w Wielkanoc'],
  'með fyrirvara um breytingar': ['subject to change', 'z zastrzeżeniem zmian'],
  'opnunartími í líkamsrækt': ['Gym hours', 'Godziny siłowni'],
  'opnunartími gym - heilsu': ['Gym hours', 'Godziny siłowni'],
  'sundleikfimi': ['Aqua aerobics', 'Aqua aerobik'],
  'sundleikfimi er í boði': ['Aqua aerobics on offer', 'Dostępny aqua aerobik'],
  'ath': ['Note', 'Uwaga'],
  'athugið': ['Note', 'Uwaga'],

  /* places */
  'sundlaug': ['Pool', 'Basen'],
  'innisundlaug': ['Indoor pool', 'Basen kryty'],
  'útilaug': ['Outdoor pool', 'Basen odkryty'],
  'þreksalur': ['Gym', 'Siłownia'],
  'þreksalurinn': ['Gym', 'Siłownia'],
  'tækjasalur': ['Gym', 'Siłownia'],
  'líkamsrækt': ['Gym', 'Siłownia'],
  '1/1 salur': ['Full hall', 'Cała sala'],
  '1/2 salur': ['Half hall', 'Pół sali'],
  'tennis': ['Tennis', 'Tenis'],
  'blakvöllur': ['Volleyball court', 'Boisko do siatkówki'],
  'badmintonvöllur': ['Badminton court', 'Kort do badmintona'],

  /* tickets */
  'stakt gjald': ['Single entry', 'Wejście jednorazowe'],
  'stakur miði': ['Single ticket', 'Bilet jednorazowy'],
  'stakir miðar': ['Single tickets', 'Bilety jednorazowe'],
  'stakt verð': ['Single entry', 'Wejście jednorazowe'],
  'stakt skipti': ['Single entry', 'Wejście jednorazowe'],
  'heilsárskort': ['Annual pass', 'Karnet roczny'],
  'baðsloppur': ['Bathrobe', 'Szlafrok'],
  'íþróttasalur': ['Sports hall', 'Sala sportowa'],
  'stór salur': ['Large hall', 'Duża sala'],
  'stakur tími': ['Single session', 'Pojedyncze wejście'],
  'dagpassi': ['Day pass', 'Karnet dzienny'],
  'aðgangur': ['Entry', 'Wstęp'],
  'verð': ['Price', 'Cena'],
  'árskort': ['Annual pass', 'Karnet roczny'],
  '1/2 árs kort': ['6-month pass', 'Karnet półroczny'],
  'hjónakort': ['Couples’ pass', 'Karnet dla par'],
  'makakort': ['Partner pass', 'Karnet dla partnera'],
  'sundföt': ['Swimwear', 'Strój kąpielowy'],
  'sundfatnaður': ['Swimwear', 'Strój kąpielowy'],
  'sundf.': ['Swimwear', 'Strój kąpielowy'],
  'handklæði': ['Towel', 'Ręcznik'],
  'handkl.': ['Towel', 'Ręcznik'],
  'sturta': ['Shower', 'Prysznic'],
  'sund': ['Swim', 'Wejście na basen'],
  'leiga': ['Rental', 'Wypożyczenie'],
  'til leigu': ['For hire', 'Do wypożyczenia'],
  'brautarleiga v. kennslu': ['Lane hire for lessons', 'Wynajem toru na lekcje'],
  'útg. á rafr. handhafakorti': ['Electronic card issue', 'Wydanie karty elektronicznej'],
  'útg. á rafr handhafakorti': ['Electronic card issue', 'Wydanie karty elektronicznej'],
  'útg. á rafrænu handhafakorti': ['Electronic card issue', 'Wydanie karty elektronicznej'],
  'útgáfa á rafrænu handhafakorti': ['Electronic card issue', 'Wydanie karty elektronicznej'],
  'kortagjald': ['Card fee', 'Opłata za kartę'],

  /* who */
  'fullorðnir': ['Adults', 'Dorośli'],
  'börn': ['Children', 'Dzieci'],
  'ungmenni': ['Young people', 'Młodzież'],
  'unglingar': ['Teenagers', 'Nastolatki'],
  'aldraðir': ['Seniors', 'Seniorzy'],
  'eldri borgarar': ['Seniors', 'Seniorzy'],
  'ellilífeyrisþegar': ['Pensioners', 'Emeryci'],
  'öryrkjar': ['Disabled people', 'Osoby z niepełnosprawnością'],
  'handhafar tr - örorkuskírteinis': ['Holders of a TR disability card', 'Posiadacze legitymacji niepełnosprawności TR'],
  'námsmenn': ['Students', 'Studenci'],
  'nemar': ['Students', 'Studenci'],
  'allir': ['Everyone', 'Wszyscy'],

  /* prices */
  'frítt': ['Free', 'Bezpłatnie'],
  'fritt': ['Free', 'Bezpłatnie'],
  'ókeypis': ['Free', 'Bezpłatnie'],
  'gjaldfrjálst': ['Free', 'Bezpłatnie'],
  '50% afsláttur': ['50% off', '50% zniżki'],
  '50% af fullorðins gjaldi': ['50% of the adult price', '50% ceny dla dorosłych'],
  '50% af almennu gjaldi': ['50% of the standard price', '50% ceny normalnej'],

  /* holidays */
  'þorláksmessa': ['St Thorlak’s Day', 'Dzień św. Thorlaka'],
  'aðfangadagur': ['Christmas Eve', 'Wigilia'],
  'jóladagur': ['Christmas Day', 'Boże Narodzenie'],
  'aðfangadagur jóla': ['Christmas Eve', 'Wigilia'],
  'annar í jólum': ['Boxing Day', 'Drugi dzień świąt'],
  '2. í jólum': ['Boxing Day', 'Drugi dzień świąt'],
  'gamlársdagur': ['New Year’s Eve', 'Sylwester'],
  'nýársdagur': ['New Year’s Day', 'Nowy Rok'],
  'skírdagur': ['Maundy Thursday', 'Wielki Czwartek'],
  'föstudagurinn langi': ['Good Friday', 'Wielki Piątek'],
  'laugardagur fyrir páska': ['Holy Saturday', 'Wielka Sobota'],
  'páskadagur': ['Easter Sunday', 'Niedziela Wielkanocna'],
  'páskasunnudagur': ['Easter Sunday', 'Niedziela Wielkanocna'],
  '2. í páskum': ['Easter Monday', 'Poniedziałek Wielkanocny'],
  'annar í páskum': ['Easter Monday', 'Poniedziałek Wielkanocny'],
  'sumardagurinn fyrsti': ['First Day of Summer', 'Pierwszy dzień lata'],
  'baráttudagur verkalýðsins': ['Labour Day', 'Święto Pracy'],
  'verkalýðsdagurinn': ['Labour Day', 'Święto Pracy'],
  'alþjóðlegur frídagur verkafólks': ['Labour Day', 'Święto Pracy'],
  'uppstigningardagur': ['Ascension Day', 'Wniebowstąpienie'],
  'hvítasunnudagur': ['Whit Sunday', 'Zielone Świątki'],
  '2. í hvítasunnu': ['Whit Monday', 'Poniedziałek Zielonych Świątek'],
  'annar í hvítasunnu': ['Whit Monday', 'Poniedziałek Zielonych Świątek'],
  'þjóðhátíðardagurinn': ['National Day', 'Święto Narodowe'],
  'þjóðhátíðardagur íslendinga': ['National Day', 'Święto Narodowe'],
  'þjóðhátíðardagur': ['National Day', 'Święto Narodowe'],
  'frídagur verslunarmanna': ['Commerce Day', 'Święto Handlowców']
};

const COL = { en: 0, pl: 1 };

const fold = (s) => s.toLowerCase().replace(/\s+/g, ' ').replace(/\s*[-–—]\s*/g, ' - ').trim();
/* Keys are written with plain hyphens; fold them the same way. */
const KEYS = new Map(Object.entries(TERMS).map(([k, v]) => [fold(k), v]));

const MONTH = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
const DATE = /(\d{1,2})\.?\s*(jan|feb|mar|apr|maí|jún|júl|ágú|sep|okt|nóv|des)[a-zúíáóéýæö]*\.?/i;

const md = (lang, day, month) => {
  const mon = MONTH.findIndex((m) => month.toLowerCase().startsWith(m));
  return formatDayMonth(lang, `${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
};

/* Ages: "0 - 9 ára", "67 ára og eldri", "yngri en 16 ára", "10 ára og yngri". */
function ages(lang, s) {
  let m = s.match(/^(\d+) - (\d+) ára$/);
  if (m) return lang === 'en' ? `ages ${m[1]}–${m[2]}` : `${m[1]}–${m[2]} lat`;
  m = s.match(/^(\d+) ára og eldri$/);
  if (m) return lang === 'en' ? `${m[1]} and over` : `${m[1]} lat i więcej`;
  m = s.match(/^(\d+) ára og yngri$/);
  if (m) return lang === 'en' ? `${m[1]} and under` : `do ${m[1]} lat`;
  m = s.match(/^(?:yngri en|undir) (\d+) ára$/);
  if (m) return lang === 'en' ? `under ${m[1]}` : `poniżej ${m[1]} lat`;
  return null;
}

/* Tickets counted: "10 miðar", "30 miða kort", "10 skipti", "6 mánaða kort". */
function counted(lang, s) {
  let m = s.match(/^(\d+) (?:miðar|skipti)$/);
  if (m) return lang === 'en' ? `${m[1]} visits` : `${m[1]} wejść`;
  m = s.match(/^(\d+) (?:miða|skipta|tíma|punkta) ?kort$/);
  if (m) return lang === 'en' ? `${m[1]}-visit card` : `Karnet na ${m[1]} wejść`;
  m = s.match(/^(\d+)(?:ja)?\.? ?(?:mánaða|mánaðar|mán\.?) ?(?:kort)?$/);
  if (m) return lang === 'en' ? `${m[1]}-month pass` : (m[1] === '1' ? 'Karnet miesięczny' : `Karnet ${m[1]}-miesięczny`);
  m = s.match(/^(\d+) (?:mánuður|mánuðir)$/);
  if (m) return lang === 'en' ? `${m[1]} month${m[1] === '1' ? '' : 's'}` : `${m[1]} mies.`;
  return null;
}

/* One piece, with no list in it. */
function one(lang, s) {
  if (/^[\d\s.,:/–-]+$/.test(s)) return s;           // a year, a time, a price
  const hit = KEYS.get(s);
  if (hit) return hit[COL[lang]];
  return ages(lang, s) ?? counted(lang, s);
}

/* A piece that may be a list: "Aldraðir og öryrkjar", "Sundföt & handklæði",
   "Aldraðir / Öryrkjar". Every item has to be known, or none is. */
function list(lang, s) {
  const whole = one(lang, s);
  if (whole != null) return whole;
  const slash = s.split(' / ');
  if (slash.length > 1) {
    const parts = slash.map((p) => list(lang, p));
    return parts.every((p) => p != null) ? parts.join(' / ') : null;
  }
  const items = s.split(/, | og | & /);
  if (items.length < 2) return null;
  const parts = items.map((p) => one(lang, p));
  if (parts.some((p) => p == null)) return null;
  return joinList(lang, parts.map((p, i) => (i ? lower(lang, p) : p)));
}

/* "Adults, Seniors" reads wrong inside a list; "Adults, seniors" doesn't. */
const lower = (lang, p) => (/^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]/.test(p) && !/^(TR|St |Easter|Christmas|New Year|Whit|Good|Holy|Boxing|Labour|National|Commerce|Ascension|Maundy|First Day)/.test(p) ? p[0].toLowerCase() + p.slice(1) : p);

/* `text` in `lang`, or as written when it can't be said. */
export function poolTerm(lang, text) {
  if (lang === 'is' || !COL.hasOwnProperty(lang) || typeof text !== 'string' || !text.trim()) return text;
  /* Footnote stars and a trailing colon are kept as they are. */
  const [, body, tail] = text.trim().match(/^(.*?)\s*([*:]*)$/s);
  /* "frá 45 USD": a price is left as it is, only the "from" is said. */
  const from = body.match(/^frá\s+([\d.,]+\s*[A-Za-z€$£]{0,4})$/i);
  if (from) return `${lang === 'en' ? 'from' : 'od'} ${from[1]}${tail}`;
  /* "720 kr stk": a price for each one. */
  const each = body.match(/^([\d.,]+\s*kr)\.?\s+(?:pr\.?\s+)?stk\.?$/i);
  if (each) return `${each[1]} ${lang === 'en' ? 'each' : 'za sztukę'}${tail}`;
  let s = fold(body);

  /* A date in it ("Páskadagur, 5. apríl", "23. des Þorláksmessa") is said
     in the page's language, after the name. */
  const range = s.match(new RegExp(`^${DATE.source} - ${DATE.source}$`, 'i'));
  if (range) return `${md(lang, range[1], range[2])} – ${md(lang, range[3], range[4])}${tail}`;
  let date = null;
  const d = s.match(DATE);
  if (d) {
    date = md(lang, d[1], d[2]);
    s = s.replace(DATE, ' ').replace(/^[\s,:]+|[\s,:]+$/g, '').replace(/\s+/g, ' ');
    if (!s) return `${date}${tail}`;
  }
  /* A year on the end ("Frídagar 2026") stays on the end. */
  const y = s.match(/^(.*?),? (\d{4})$/);
  const year = y ? y[2] : null;
  if (y) s = y[1];
  /* "Börn, 0 - 9 ára", "Þreksalurinn - vetraropnun", "Frídagar (með fyrirvara
     um breytingar)": the halves are translated apart. */
  s = s.replace(/\s*\(\s*\)/, '');
  /* "Börn, 0 - 9 ára" and "Sturta, fullorðnir" are a thing and who it is for,
     not a list of two, so two halves are tried as that first. */
  const qualified = s.split(', ').length === 2;
  let out = qualified ? null : list(lang, s);
  if (out == null) {
    const paren = s.match(/^(.*?) \((.*)\)$/);
    const halves = paren ? [paren[1], paren[2]] : s.split(qualified ? ', ' : ' - ');
    if (halves.length === 2) {
      const [a, b] = halves.map((p) => list(lang, p));
      if (a != null && b != null) out = paren ? `${a} (${b})` : `${a}${qualified ? ', ' : ' – '}${lower(lang, b)}`;
    }
    if (out == null && qualified) out = list(lang, s);
  }
  if (out == null) return text;
  return [out, year, date].filter(Boolean).join(date && !year ? ', ' : ' ') + tail;
}
