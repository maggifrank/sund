# Sund

A swim-trip tracker. Tap **+** after each visit and watch the yearly membership
turn from an expensive mistake into a bargain.

The count is **shared across devices** — log a swim on your phone at the pool,
see it on your laptop at home.

It runs in two places behind **one address**, <https://sund.talva.is>. Inside
the LAN that name resolves to Caddy, which passes it to the container, and you
get the full read/write app over HTTPS like anywhere else. From outside it
resolves to Cloudflare and on to Netlify, and you get a read-only snapshot with
no API behind it to write to. Same URL, two faces, decided by DNS.

## What it works out

| | |
|---|---|
| Membership | 36.400 kr / year |
| Valid | **23.08.26 – 23.08.27**, both days inclusive |
| Alternative | 30-trip card at 14.000 kr → **467 kr per trip** |
| Break-even | **78 trips** |

**Cost per trip so far** is the membership spread over the trips actually taken:
`36.400 ÷ trips`. First swim costs 36.400 kr, the second brings it to 18.200,
the tenth to 3.640, and so on down.

**Break-even** is where those two lines cross. A 30-trip card is 14.000 ÷ 30 =
466,67 kr a trip, so the membership catches up at `36.400 ÷ 466,67` = **78 trips**
— call it three swims a fortnight. Every trip after that is free.

There is a second, blunter reading the app also shows: cards are bought whole,
not by the trip. You'd buy the 3rd card on trip 61, and only at that point have
handed over more cash (42.000 kr) than the membership cost. So **61** is when
you're ahead on money spent, **78** is when you're ahead on value received.

All three numbers are editable under ⚙, along with everything else that defines
the card: [the dates it is valid between](#the-cards-dates) and
[which pools it covers](#pools). Every change syncs like everything else.

## Languages

Icelandic, English and Polish, picked from the header and remembered per device.
On a first visit the browser's own preference decides, defaulting to Icelandic.

All three are complete — labels, the break-even sentence, sync statuses, confirm
dialogs, month and weekday names, and the chart. Three things a plain string
table would get wrong are handled properly:

- **Plurals.** Icelandic takes the singular for any number ending in 1 except 11
  — *21 ferð* but *11 ferðir*. Polish has three forms — *1 wejście*, *2–4
  wejścia*, *5+ wejść* — with 12–14 falling back to the third (*12 wejść*, but
  *22 wejścia*). English is the plain `n === 1`.
- **Number grouping.** Icelandic groups with dots (36.400), Polish with
  non-breaking spaces (36 400), English with commas (36,400).
- **Case.** Polish inflects the month inside a date: the history heading reads
  *sierpień 2026* but a trip is dated *23 sierpnia 2026*. Languages without a
  separate in-date form fall back to the one list.

Dates and numbers are formatted by hand rather than through `Intl`, because the
browsers this runs in may not ship `is-IS` locale data and `Intl` fails soft — it
would quietly print Icelandic prices with US commas rather than erroring.

## Currency

The display currency follows the language: **ISK** in Icelandic, **USD** in
English, **PLN** in Polish.

Everything is *stored and entered* in ISK, because that is the money actually
handed over at the pool. Other currencies are a display conversion applied on
the way out, so the settings fields stay in kr in every language and a rounding
trip through zloty can never corrupt a recorded price. A line at the foot of the
app says which rate was used and when, so no converted figure is presented as if
it were a till receipt.

Rates come from the European Central Bank via
[frankfurter.dev](https://frankfurter.dev) — no API key, no account. The server
fetches them, caches for 12 hours (the ECB publishes once a working day) and
retries after 10 minutes if a fetch fails, so a rates outage costs one log line
rather than a stream of requests. **If no rate is available the app shows ISK and
says so** rather than inventing one.

This is the app's only outbound network call. `GET /api/rates` sits behind the
same access code as everything else, so an open instance can't be used to drive
outbound fetches on your behalf.

## Trips per month

A column chart above the history panel, one bar per month from your first trip
to now, capped at the last 12. **Months with no swimming are kept as gaps** — the
break in the bars is part of the picture, and dropping those months would space
the remaining bars evenly and misstate the timeline.

One series, so one color and no legend; the peak month is labelled and the rest
are left to the axis and the tooltip. Hovering or tapping a column gives the
month and its count. Colors were checked with a palette validator rather than by
eye: the chart mark is its own token because the UI accent falls outside the
required lightness band against the dark card surface.

The history panel below is the chart's table view — same data, every trip listed.

## Trips per weekday

Which day do you actually swim on? A pie below the monthly chart, one wedge per
weekday, **Monday first** — `getDay()` numbers from Sunday, but that is the Date
object's convention rather than anything an Icelandic, Polish or British reader
expects.

The card leads with the answer in words — *Most popular day: Thursday, 24 trips ·
30%* — and the pie is the evidence underneath it. **Every day tied for the most
is named**, not the first one found: with a few dozen trips a tie is ordinary,
and picking a winner out of one would present a coin toss as a fact.

Seven wedges are more than a pie should carry, and the question it answers is
which day stands out rather than which wedge is which, so the colour is
**emphasis, not identity**: the busiest day takes the chart mark and every other
day the same recessive tint of it. Seven hues would have failed on colour
blindness long before it failed on taste. Both steps were checked with the same
palette validator the monthly chart's mark was, as a one-hue ramp against the
card surface in each mode.

Identity is carried by everything except the colour, so it is never colour
alone: the legend beside the pie lists all seven days and their counts in the
wedges' own clockwise order, and any wedge with room for it is labelled in
place. **There is no hover tooltip** — unlike the monthly chart, where the bars
carry no labels, everything here is already on screen, which is also what a
phone with no pointer needs. The wedges keep a `<title>` for the pointer that
expects one and for screen readers.

A day nobody has swum on keeps its legend row at zero. That is an answer too.

## The card's dates

A membership runs for a year, and the app used to have no idea when that year
started. Every trip ever logged counted, so a previous season — swum on 30-trip
cards at the very same three pools — was folded into the card's arithmetic and
made the cost per trip look far better than it really was.

Only swims between **valid from** and **valid until** pay the card off. Both
ends are inclusive, and either may be left blank: a card with only a start date
counts everything from that day on, and with neither set every trip counts,
exactly as it did before this existed.

The current card's dates live in `DEFAULT_SETTINGS` beside its prices, which are
the same card's facts. That matters for the changeover: a state file written
before this existed has no season fields at all, so `normalize()` fills them
from the defaults and the dates apply to the history already on disk — no
settings step, nothing to migrate. Both dates are still editable under ⚙, which
is where next year's card gets entered.

Nothing is deleted. The earlier trips stay in the history, the chart and the
pool table as they were; they are tagged *outside the dates* in the history
list, and the counter card says how many there are. **Rolling over to next
year's membership is now a matter of moving the two dates**, not **Reset
trips** — the record survives the renewal.

The bounds are compared as **local calendar dates**, not as instants. They are
the dates printed on the card, and every date the app shows — a history row, a
chart column, the midday anchor a backdated trip is stored at — is already the
local one.

A date is validated by round trip rather than by `Date.parse`, which is not a
validator: it takes `2026-02-30` happily and hands back the 2nd of March, so a
typo would be stored as a real but wrong bound.

**Neither field constrains the other.** They did at first, through `min` and
`max`, so that an end before its start could not be entered — and that quietly
made renewal impossible. Next year's card starts the day after this one ends,
so every valid new start date sat outside the old `max`: the native picker
greyed those days out, a typed one failed validation, and the field simply
sprang back to its old value with nothing saved and no reason given. The one
edit the feature exists to support was the one it refused.

So an inverted range is now stored like any other and **said out loud** — the
settings sheet shows *the end date is before the start date, so no trip counts*
— rather than being silently undone. Set the start, then the end, and the
warning clears on the second edit.

## Pools

**The card covers three pools out of the box** — Suðurbæjarlaug, Sundhöll
Hafnarfjarðar and Ásvallalaug, all in Hafnarfjörður — and **which pools it
covers is a setting**, under ⚙, not something fixed in code. Only swims at the
chosen pools pay the card off, so only those feed the big counter, the cost per
trip, break-even and the ahead/behind figure. Anywhere else is logged for the record and shows in the chart, the
history and the pool table, but never in the money. Where is only half of it;
the other half is when, which is [the card's dates](#the-cards-dates) above.

The counter card says how many trips each of the two rules left out, as separate
figures rather than one lump: a swim outside the dates is reported as such
whatever pool it was at, so the three numbers always add up to the total. The
pool table tags the pools, and the history tags the dates. Both follow the
settings, so unticking a pool retags its rows immediately.

A trip with no pool attached — anything logged before this existed, or with
location switched off — still counts, which is what it did before. The app never
silently drops a swim because it could not work out where you were.

### Choosing them

⚙ lists every pool the app knows about, each with a checkbox and, for the ones
you have been to, how often — which is what makes a hundred-odd rows navigable.
A search box narrows the list, and the list is built once and then filtered by
hiding rows, so ticking a box does not throw away what you typed or where you
had scrolled.

`settings.cardPools` holds the choice as a list of ids. It starts `null`,
meaning *no choice saved, use the built-in list*, so the boxes already show the
card as it shipped and nothing has to be migrated. The first tick turns that
into an explicit list — starting from what is currently covered, so ticking a
fourth pool gives you four rather than one.

Two consequences of an explicit list are worth stating. It is **exhaustive**: on
the built-in path an unrecognised pool id counts, rather than being dropped for
being unfamiliar, but a list someone wrote by hand is the whole answer, so an id
that is not on it does not count. And **every pool unticked is a real choice**,
kept as an empty list rather than folded back into `null` — which would silently
restore three pools nobody asked for.

**The chosen ids never reach the public site**, even though the pool table
publishes a name and a card flag for every pool in the history, which is most of
what the id list would say. Most, not all: the table only covers pools actually
swum at, while the selection can name pools never visited, and publishing it
would say which of *those* the card covers — a fact about the card that nothing
on the page is derived from. So `bin/publish.mjs` drops `cardPools` from the
published settings. The page needs none of it: its trips arrive already
filtered, and its counts and its table are both totalled at publish time.

Tapping **+** attaches the pool you're standing at. The app keeps a position
warm while it is on screen, so the check-in resolves immediately rather than
making the count wait on a GPS fix, and a line under the counter says what it
thinks — *You're at Laugardalslaug*, *No known pool nearby*, or *Location
unavailable* — so it is never guessing behind your back.

`lib/pools.js` carries the 127 pools listed at
[sundlaugar.is](https://sundlaugar.is/sundlaugar/) that can be placed — from
both its pool directory and the
[natural pools](https://sundlaugar.is/heitar_laugar/) it keeps in a separate
section. Neither has **any coordinates at all**, so positions were looked up in
OpenStreetMap. Matching by name placed 81 of them and left fifty with nothing —
those were not missing from OSM so much as unnamed in it, since the directory
calls a pool after its town and the basins inside a sports complex are usually
untagged.

What the directory does publish for every pool is an **address**, which is the
better key. [`bin/survey-pools.mjs`](bin/survey-pools.mjs) reads it off the
listing, geocodes it, and snaps to whatever pool OSM has within 500 m: the
address says which building, OSM says where the water is. That placed the other
45 — 41 on a surveyed position, and four at their address where OSM has no pool
at all. One more, Jaðarsbakkalaug, slipped past both and was placed by hand — see
[Pool pages](#pool-pages).

Five wild pools resisted both passes, listed without an address and unnamed in
OSM, and they are **not in the list**. A pool that cannot be placed cannot be
detected, and its only use was a name in the picker — which the app produces on
demand anyway: swim at one, name it once on the spot, and it is remembered along
with the coordinates you were standing on.

OSM tags these inconsistently (Laugardalslaug is a `shelter`, Sundhöll
Reykjavíkur a `sauna`), so neither pass lets a tag decide what a pool is, and a
point sits somewhere inside a complex rather than at its door. Nothing is matched further than 250 m,
which absorbs that. Anywhere still unknown, the app asks for a name once,
remembers the coordinates, and recognises it from then on.

A table at the bottom counts visits per pool, most-visited first, with anything
logged without a pool last, and totals them. It is on the public page too, drawn
by the same `lib/pooltable.js` from the same rows. The counter card states the total
too — the big number is card swims only, so the total is said outright rather
than left to be worked out from the difference.

Every row in History shows its pool and **can be tapped to change it** — pick
another, or detach it entirely. That is how a backdated trip gets a pool at all
(you are not standing at the pool when you log one), how anything recorded
before pools existed gets attributed, and how a mis-matched check-in gets
corrected. The money follows immediately: move a swim to a pool the card does
not cover and the counter drops. Trips recorded before this existed, or with location
switched off, simply have no pool — the count is unaffected.

**The public site gets the table, but only as totals.** `bin/publish.mjs`
publishes the finished rows — an id, a name, a count and whether the card covers
it — and still drops the pool from every trip, publishes an empty pool list, and
drops the time, the same way it always did. So the page can say where the
swimming happens without saying *when* any of it happened: there is no pool
attached to a date anywhere in `state.json`, and the saved pool list — the one
holding a position for anywhere named on the spot — goes out empty.

The id is what lets [the map](#on-the-public-site) put a row on the country. It
is a slug of the name published beside it, and the only positions it can resolve
to are the built-in survey in `lib/pools.js`, which the public build has always
shipped as code.

Totals rather than a count the page works out for itself, because it cannot:
the trips it is given carry a date and nothing else. The table is counted over
the whole history, which is now also what those trips cover, so the table's
total, `totals.all` and the length of the history are three views of one number.
A snapshot published before the table existed has no `poolTable` key, and the
section is simply absent.

Nothing is hidden in the page that isn't also absent from `state.json`.

The public page shows the total number of swims and how many of those the card
did not cover, split by which of the two rules left them out, but as **plain
counts** — no dates. An older snapshot without those counts simply hides the
line.

The public snapshot contains **every trip**, plus plain counts saying how many of
them the card covers. It used to contain the card's own and nothing else, which
quietly cut its monthly chart short the day the card grew dates; the money there
now reads the published count rather than the length of the list. The pool on
each trip is still stripped, so a for-fun swim is published as a date like any
other, and the table above stays the only thing that says where the swimming
happened.

## The map

**Kort** — the 🗺 in the header — is the pool list as a picture: every pool the
app knows about, drawn where it actually is, **filled green where you have swum
and a hollow red ring where you have not**. The headline is the bare fraction,
`23 / 127`, with a progress bar under it.

**Pools too close to draw apart share a badge.** A marker is about twelve
kilometres across at the scale that fits Iceland into a phone column, so 82 of
the 126 used to sit on top of another one — a red ring over a green disc, with
no way to tap the one underneath. Overlapping marks are now merged, closest pair
first, until nothing on the map overlaps anything else: at no zoom that leaves
39 pools on their own and 21 badges on a laptop, and 16 of each on a phone,
whose marks are drawn bigger. A badge says how many pools are in it, and
its ring is split to say how many of those have been swum in — green from twelve
o'clock for the swum share, red for the rest, with a gap at each join so the
split is a shape and not only a colour. It stands on its most central pool rather
than on the average of their positions, which for pools strung round a bay would
be out in the bay. Hovering or tapping lists what is in it.

**A mark is drawn for the size it ends up on the screen.** Its radius is in
units of a 1000-unit page, so what it comes to in pixels is whatever the map was
scaled to, and in a phone column that was a 7 px dot inside a 15 px target —
half what a finger can aim at. The second tap that opens a pool's page kept
landing on the map instead of on the pool. So the map measures how wide it is
actually drawn and grows a mark to 14 px across, never past twice its
country-map size, and the invisible target around it to 36 px on every screen.
Bigger marks group sooner, which is why a phone shows fewer, larger badges than
a laptop. A pool page's map, which is cropped in close, works the number out the
same way from its own crop.

**One tap says which pool, the next one opens it.** A mouse hovers, so a click
goes straight to the pool's page; a finger has no hover, so the first tap is the
hover — the name card — and a second tap on the same pool opens it, which the
card says outright. The card then **stays up**, which took some doing: a touch
pointer stops existing the moment the finger lifts, so the browser sends the
same pointerleave a mouse sends on its way out, and the card was gone before it
could be read — leaving no way to know which pool the next tap would open. Only
a mouse leaving takes it away now. A tapped card stands until something replaces
it: another mark, a tap on the map away from the marks, or a pan or a zoom. Taking the reader away on the first tap would leave no way
to find out what a mark is without leaving the map. The lists under the map are
the way there that needs no aim at all: every pool still to go, and every pool
by region, is a link to its page.

**And the map zooms**, because a badge only says that something is there. The
grouping is worked out again as the map gets closer, so badges come apart into
their pools, and **tapping a badge flies straight in to them**. At 48 times —
the most it goes — every pool stands on its own; at 32 two in Reykjanesbær still
share. The marks stay the same size on the screen at every zoom, so a pool is the
same size to a finger however close the map is. The gestures are chosen not to
take the page hostage: on a phone one finger still scrolls the page until the map
has been zoomed, two fingers pinch, and once zoomed one finger pans; on a laptop
a plain scroll scrolls the page, and a trackpad pinch or ⌘/Ctrl with the wheel
zooms. A double tap zooms in, and **+**, **−** and a reset button do all of it
without a gesture. The view survives the fifteen-second poll, so a new swim
does not throw a zoomed map back out to the whole country.

There used to be a second map for the **capital area**, because a sixth of the
pools sit inside twenty kilometres of Reykjavík and at country scale they were
one smudge. With zoom it was the same picture twice, so it has gone — but its
detailed coastline has not; see below.

**Colour is never the only thing saying it.** Green and red are precisely the
pair a red-green reader cannot separate. Measured in OKLab under simulated
deuteranopia, against the land the map is drawn on rather than the card behind
it, this pair comes out 9.0 apart in light mode and 8.1 in dark — above the
target, but not by a margin worth resting a page on. So visited is a *filled*
disc and not-yet is a *hollow* ring: the shape says it without the colour and
the colour says it without the shape. The legend names both, a hover or a tap
gives the pool and its count in words, and the list at the bottom says it a
third time. Both pairs were stepped with the same palette validator the charts
were, and clear every check it makes.

**The map says so when it is not the whole list.** Every pool in the survey has
a position, so it usually is — but a pool named at a check-in with no fix to
hand has none, and cannot be drawn. The counter card then states how many are
missing and the **Ófarnar laugar** list at the bottom carries them with a *not
on the map* tag. The fraction counts every pool either way: a page that quietly
drew 127 of 128 would be claiming a completeness it has not got.

The page is read-only and has nothing of its own to save. It draws the counter
page's offline cache for the first paint — queue included, through the same
`applyQueue()` the counter uses, so a swim logged at a new pool with no signal
colours that pool here too — and then polls `/api/state` like any other view of
the shared count. It never writes the cache back: the queue in there belongs to
the page that owns the **+** button.

### On the public site

The public site has the same map, at `/map.html`, drawn by the same
`lib/poolmap.js` — so the two cannot disagree about what has been swum in. What
differs is where the answer comes from. That page has no pool on any trip;
`bin/publish.mjs` strips it, and always has, so it cannot count visits per pool
for itself. It is handed the **totals** instead: the pool table that was already
published, which now carries an `id` beside each name.

That id is the one field nothing on either page displays. It is there so a row
can be matched to a position, and it is safe to publish because it says nothing
the name beside it does not — it is a slug of that name, the name is already on
the page, and every coordinate it resolves to sits in `lib/pools.js`, which the
public build has always shipped. Matching on the name instead would have cost
nothing and been wrong: the app lets a pool be renamed, and a renamed pool would
quietly fall off the map rather than move.

So the public map says **where** the swimming happens without saying **when** any
of it happened, which is the line the pool table already walks. No date is
attached to any pool anywhere in `state.json`, the saved pool list is still
published empty, and a pool nobody has been to was never a secret — the survey
in `lib/pools.js` is a directory of Iceland's swimming pools, not a diary.

A snapshot published before the rows carried an id cannot say which pools those
swims were at. The page says so in a sentence and draws nothing, rather than
putting a red ring on all 127 and claiming the swimming never happened.

### How the country is drawn

The coastline is **committed, not fetched**. The app has no build step and no
dependencies, and a map that needed the network to draw the country would be
useless in the one place this app is actually opened. `bin/build-coastline.mjs`
regenerates it, so the committed paths can be re-derived rather than trusted —
run it and diff it.

It comes from **IS 50V strandlína**, the national coastline at 1:50,000 with a
positional accuracy of 10 m, published by Náttúrufræðistofnun under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — the credit line under
the map, and under the one on every pool's page, is that licence's attribution. It replaced Natural Earth 1:10m,
which is drawn to about a kilometre. That was fine for the outline of the
country and wrong by enough to matter everywhere else: **25 of the 126 pools
were in the sea**, Höfn and Borgarnes a kilometre and a half offshore because
the peninsulas those towns stand on were not in it, and five in the capital
area, where Seltjarnarnes was a blunt triangle. It was written down as a known
limit, which was the wrong call — a pool in the sea is a map that is wrong.

**Two outlines, one per scale.** Zoomed into the capital area the map is
thirteen times closer or more, so a coast simplified for the whole country is
visibly wrong there, and one detailed enough for the capital everywhere would be
a megabyte of fjords nobody can see at country scale. So the capital area, 40 km
across, has an outline of its own: inside that rectangle the map draws the
capital's detailed coast, and the country's coarse one is clipped away. Zoom into
Reykjavík and Seltjarnarnes is the shape of Seltjarnarnes. Each outline is cut
from the national data and simplified to the same tolerance *at its own scale* —
under half a pixel — and the capital's is clipped to its window first. Islands
too small to be a dot are dropped from each, except any island with a pool on
it: Grímsey is a speck at country scale and it is also a pool. A pool's page
uses the same two: a pool in the capital area is drawn on the capital's coast,
closer in, and anywhere else on the country's.

**Every pool is checked against what is drawn.** After simplifying, the
generator tests each pool against the rounded coordinates that go into the file,
not the ring before rounding — checking the unrounded ring reported zero while
three hot pools built on the shore sat in the sea on the page. A pool that
simplification has put on the wrong side of the coast gets the coast around it
held at full detail and is cut again. Four needed it — Flateyri, Hellulaug,
Geosea and the tubs at Drangsnes, between 43 m and nothing at all offshore — for
107 extra points, where holding every pool's neighbourhood at full detail costs
4,500. The result is written into the header of `lib/coastline.js`: **0 of 127**
in the sea on the country's outline, **0 of 21** on the capital's.

**And checked again on every change.** The coast is cut rarely and the pool list
changes often — forty-five pools were given positions in one afternoon — so
[`bin/check-pools-on-land.mjs`](bin/check-pools-on-land.mjs) runs in GitHub
Actions on every pull request and push to `main` that touches the pools, the
coastline or the projection, and fails naming any pool that lands offshore and by
how many metres. It shares no code with the generator on purpose: it reads the
path strings exactly as `lib/coastline.js` writes them, so a mistake in how the
generator audits itself cannot hide in the check too.

It is projected on **Iceland's own national grid** — ISN93 / Lambert 1993,
EPSG:3057: a conformal conic on GRS80 with standard parallels at 64°15′ and
65°45′. It is the projection every Icelandic map is printed in, and conformal
means the Westfjords come out the shape of the Westfjords; a plain
latitude/longitude plot would stretch the island sideways by a factor of two and
a bit at these latitudes, and the north would be visibly wider than the south.
The generator projects the coastline through the very same function that places
the markers, and refuses to write an outline that no longer fits the page — so
the country and the pools on it cannot drift apart.

## Pool pages

Every pool has a page of its own, `pool.html?id=…`: where it is, what it has,
when it is open, what it costs and how to reach it, with how often it has been
swum in at the top. The pool table's names lead there, and so does the map — a
click on a mark, or on a phone a second tap on the same one, since the first is
how a finger asks which pool it is. The map page also lists every pool with a
page, region by region, for when a mark is too small to hit.

**The details come from [sundlaugar.is](https://sundlaugar.is)**, the national
pool directory, read by [`bin/fetch-pool-info.mjs`](bin/fetch-pool-info.mjs)
into `lib/poolinfo.js`. **Every region has been read: 126 of the 127 pools in
`lib/pools.js` have the directory's details.** The one that does not is
Ölduselslaug, which the directory no longer lists; its page has its count and
its place on the map, and says the details are not in. Reading it again is one
command, for the whole country or a region at a time, and a region not asked
for is left as it is:

```bash
node bin/fetch-pool-info.mjs --all             # read it and print it
node bin/fetch-pool-info.mjs --all --write     # then write it
```

The directory keeps its natural pools — Landbrotalaug, Reykjadalur, the tubs at
Drangsnes — in a section of their own that its API does not serve, so those are
listed from that section's sitemap instead. The sitemap mixes in the English
copies under the same names and only the Icelandic ones are read. Two pools are
in both sections, Hellulaug and the Blue Lagoon, and the pool directory's page
wins. The five wild pools that were never placed are skipped by name.

Reading the whole country turned up a pool the app had never had:
**Jaðarsbakkalaug**, Akranes's own, in the directory since 2016. Both survey
passes had missed it — its name there, "Jaðarsbakkalaug, Akranesi", matches
nothing in OpenStreetMap, and its address snaps onto Guðlaug, the beach pool
180 m below it, which the survey then drops as a duplicate. It is in the list
now, at the position OSM gives it by name, and the coastline check puts it on
land like the rest: **0 of 127** in the sea.

**What is taken is what a swimmer acts on, and not the directory's writing.**
Each pool's page there has a few paragraphs about it and a gallery; those are
somebody's work, and the page links to them instead of copying them. What the
paragraphs *say* is read out of them as tags — "heitir pottar, kaldur pottur og
eimbað" is hot tubs, a cold tub and a steam bath — which the page can name in
all three languages. A tag is only ever added: a description that never mentions
a cold tub is not taken as evidence there isn't one, and a sentence about the
neighbourhood — the restaurant down the road, the campsite — says nothing about
the pool. The longest basin is read the same careful way: a length counts only
when the nearest noun is a pool, because descriptions give the length of the
slide, the sports hall and the drive from Reykjavík too, and taking the largest
number once made Varmahlíð's 47 m slide its pool. The notes beside the hours
and under the price table are kept word for word, because they are the terms the
prices are sold on, and a paraphrase that got one wrong would be a price the
pool does not charge.

**Icelandic only, on purpose.** The directory has English pages too, but they
are a separate copy and they have already drifted — Dalslaug's annual pass for
over-67s is 4.000 kr on one and 4.150 kr on the other. So there is one source,
and the page translates what it could parse: weekdays, facilities, seasons and
its own labels. Notes and ticket names stay as written, and the page says so
when it is being read in English or Polish.

**The directory has no structure for hours.** They are a text box, typed a
little differently on every page, so the script sorts each line by what it
looks like: a row of days and times, a heading, a season, a closure, or a note.
It reads "Laugar- og sunnudaga" as two days rather than a range and "mánudaga
til föstudaga" as one; it works out that "Vetraropnun" with no dates is the rest
of the year beside a dated summer; it drops holiday hours headed with a year
that has gone. It reads months cut short ("15. sept"), seasons that only say
when they start ("hefst 1. júní"), end "til lok ágúst" or "til miðjan ágúst", or
are nothing but months ("Apríl – Október"); and it keeps holidays — Christmas,
Easter, National Day, which half the pools list with their own hours — out of
the opening hours, as rows under their own heading with the directory's words
for the day. Closures are the one thing the directory is worst at: in
September, Laugardalslaug's page still said it was shut for maintenance in
August. A closure that is over is dropped when the page is read, and one that
is not carries its end date, so the pool page stops showing it the day after.
One with no end at all — Reykholt's pool has been shut for renovation since
September 2025, above a timetable that still reads as open — is shown in a box
of its own, and the page does not claim the pool is open today.

**Today is Iceland's today.** The row for today is highlighted in whichever block
of hours is in force, and the top of the page says *Open today: 06:30–22:00* —
but only when that can actually be said: one block of opening hours in force, one
row in it for today, and no closure standing. A block of hours with no dates
that calls itself summer or winter hours is never taken as today's: "Sumaropnun"
with nothing to say when summer ends is a guess in September. Iceland keeps UTC
all year, so the
page takes the date and weekday from UTC, whatever the phone thinks its time
zone is. It does not know about public holidays, which the directory lists
inconsistently or not at all.

**Busy times, for Reykjavík's eight pools.** Google's *Popular times* would have
been the obvious source, and it is not one on offer: there is no API for it, only
scraping Google Maps or paying a service that does. Reykjavík publishes something
better for its own pools, as [open data](https://gagnagatt.reykjavik.is/dataset/sundlaugagestir_i_reykjavik):
every visitor through the entrance gates, counted per hour, per pool. Those are
people, not a curve relative to the pool's own peak. Kópavogur, Hafnarfjörður
and the rest of the country publish nothing like it, so Laugardalslaug,
Vesturbæjarlaug, Sundhöll Reykjavíkur, Breiðholtslaug, Grafarvogslaug,
Árbæjarlaug, Dalslaug and Klébergslaug have the chart and no other pool does.

[`bin/fetch-pool-busyness.mjs`](bin/fetch-pool-busyness.mjs) turns the counts
into `lib/poolbusy.js`: a typical week for each pool and season, the average
number of people coming in during each hour. Averaged over the last two years
the city has published and nothing before March 2022, when the pandemic's caps
on capacity came off; days a pool was shut or nearly are left out, since a
closed Tuesday would drag down every Tuesday. The city's file currently ends in
January 2024, and the page says which months it is an average of.

The card shows today in the season it is now — winter December to February, as
the dataset has it — with the hour it is now picked out and the other hours
stepped back to the recessive tint of the same blue, the pair the weekday pie
uses. A sentence under the chart says the same in words, *Now, 11:00–12:00,
about 49 people usually arrive*, and names the busiest hour, so the colour is
never the only thing saying it. The day buttons turn to any other day. It
counts arrivals, not how many are in the water at once, and says so.

```bash
node bin/fetch-pool-busyness.mjs --write
```

**Nothing new is published about the swimming.** The private page says when a
pool was last swum in; the public one is handed the same totals as the map and
says how often, never when. Whether the card covers a pool is shown on the
public page only for pools that have been swum in, since the card's own list of
pools is not published — see [Pools](#pools).

Everything from the directory is set as text, never as markup, and a link from
it is only ever http(s), `mailto:` or `tel:` — checked when the page is read and
again when it is drawn, since `lib/poolinfo.js` is a file someone could edit by
hand. The file is 296 KB for 126 pools — 33 KB compressed — and ships to every
pool page and the map; it is written a line per row of hours so it diffs like
one.

## History

Every trip is timestamped, and the **History** panel lists them newest-first,
grouped by month with a count per month — enough to see whether you're on pace
for 78 without doing arithmetic. Each row can be deleted individually, which is
the only way to fix a mis-tap from three weeks ago; the − button only ever
removes the most recent trip.

Deletes are matched by timestamp rather than position, so removing a trip on one
device does the right thing even if the other device added one meanwhile. A
delete that has already been applied is a no-op rather than an error, so a queued
offline delete can't remove two trips if it gets retried.

**Log a past swim** at the top of the panel backdates a trip you forgot to
record. Future dates are refused, by the date picker and again by the server.

Backdated trips are stored at local **midday**, not midnight. Midnight would
round-trip correctly on the device that logged it, but stored as `00:00Z` it
reads as the previous day on any device west of UTC; midday leaves twelve hours
of slack either way. Since a backdated entry has no real clock time, the history
shows it as a date alone — only live taps display a time.

## Settings

⚙ opens a **sheet over the page**, not a panel at the end of it. It used to be
the last card in the column: to change a price you scrolled past the whole
dashboard, and to see what the change did you scrolled back up again. Both
numbers are now on screen at once — change the membership price, push the sheet
down, read the new cost per trip.

It is a modal `<dialog>`, which carries the awkward half of that for free: the
top layer, so nothing competes with the confetti over a `z-index`; the page
behind inert; focus kept inside; Escape already wired. There are four ways out
— the ✕, a tap outside, Escape, and pushing it back down with a thumb — and all
four end in the same slide, so the sheet never simply vanishes.

**The push is a real drag.** The grip is the top strip, the bar and the title
row together, so the gesture starts well clear of the pool list scrolling below
it; `touch-action: none` there claims the vertical drag before the browser
spends the first centimetre deciding whether it was a page scroll. Past a
quarter of the sheet's height, or a flick at any distance, and it goes;
anything less snaps back. Dragging **up** is damped to a sixth rather than
refused — a thumb that overshoots should meet a rubber band, not a wall.

The slide is driven from a class rather than `@starting-style`, because a drag
has to be able to interrupt it mid-flight by writing the transform inline, and
the phone this is really for runs a Safari a version or two behind. The catch is
that a transition is not a promise: with `prefers-reduced-motion` there is none
to wait for, and a sheet dragged to exactly the bottom edge has nowhere left to
travel. So the close waits for `transitionend` **or** the clock, whichever comes
first, and the dialog closes either way.

On a screen with room to spare — 600px wide and 640px tall, so a laptop — it
stops hanging off the bottom edge and becomes an ordinary centred dialog, and
the grab bar goes with it: there is nothing to push down with a mouse. That
needs an explicit `height: 100%`, because the browser's own `dialog` rule is
`height: fit-content` and `inset: 0` alone does not beat it — without it the box
hugs the panel, pins itself to the top, and "centred" lands halfway up the
screen.

## Milestones, confetti and the buzz

Logging a swim should feel like something, so it does.

Every **+** gets a short buzz and a random cheerful emoji that floats up off the
button; every removal gets two shorter, more apologetic ones and an emoji that
agrees it was a mistake. The big number jumps a little either way. None of it is
load-bearing: the emoji and the canvas are `aria-hidden`, because the counter is
already an `aria-live` output that announces the new number.

**Confetti** marks the swims worth marking — the 1st, 10th, 25th and 50th, and
then every 50th after that — and **break-even fills the screen**: cannons from
both bottom corners, a burst over the counter, and paper falling from the top
for a couple of seconds. That is the number the whole app is about, so it gets
the whole screen.

Some rules it follows, none of which are visible when they work:

- **Only trips that move the counted number can be a milestone.** A swim
  [outside the card's dates](#the-cards-dates) or [at a pool it doesn't
  cover](#pools) gets the buzz and the emoji, but it hasn't reached anything,
  so there is no confetti for it.
- **Only your own taps celebrate.** A swim arriving from another device lands in
  the count quietly; confetti is a response to a tap, not to a poll.
- **A crossing is celebrated once.** The highest number already celebrated is
  remembered per card in `localStorage`, so tapping − and + again doesn't fire a
  second party for the same 50th swim. Change the card's dates or its prices and
  it is a different card, whose count starts over.
- **Backdating counts.** Logging a past swim goes through the same path as the
  button, milestones included — the confetti comes out of the *Add* button in
  the history panel rather than the counter, which is where you were looking.

On Android the buzz is the [Vibration API](https://developer.mozilla.org/docs/Web/API/Navigator/vibrate).
Safari has never implemented it, so an iPhone borrows a tick instead. Every
tappable control — **+**, **−**, the ⚙ and the ✕ that closes it again, the sync
pill, the history disclosure, *Add*, *Export*, *Reset* and each history row's
**×** — carries an invisible
native switch control (`<input type="checkbox" switch>`, Safari 17.4) laid
exactly over it, and iOS plays its system tap when a finger toggles one. The
button still does the work — the tap is forwarded to it — and the press
animation is driven from the wrapper, because `:active` now lands on the switch
rather than the button.

The wrapper takes on whatever the button was doing in its parent's layout:
hugging it, stretching to share a row, or spanning a card. That is stated per
control rather than guessed, because getting it wrong collapses the button
inside to the width of its own text.

The limits of that are worth stating, because they shape the code. They were
measured on the device rather than guessed at — a throwaway page put thirteen
variations side by side and asked how many ticks each produced:

| | |
|---|---|
| A finger toggling a switch | **one tick** |
| The same toggle from script — `.click()`, through a `<label>`, `checked = !checked`, from `touchstart`, inside the tap or 400ms after it | **nothing, in every form** |
| A real tap followed by three script toggles | **still one tick** |
| Two switches toggled by one tap | **one tick** |
| A finger dragged across twelve switches | **one tick** — the gesture stays with the first |
| Five switches tapped in turn | **five ticks** |
| A picker wheel, date wheels, a slider | **nothing** |

So: **one tick per genuine tap, and taps are the only thing that stacks.** No
duration, no intensity, no rhythm. The milestone and break-even patterns stay
Android-only — an iPhone cannot feel the difference between the 50th swim and
any other. What it can have is *more taps worth making*, which is what the
celebration below does.

The control also has to keep its native rendering to tick at all. Invisible
still counts as native; restyled does not.

It is a side effect of a control rather than an API, and Apple has narrowed it
once already, so it is gated on the exact thing it exploits: nothing is built on
a device where `navigator.vibrate` works, and it disappears silently the day the
gate stops matching — including the day Safari ships the real API.

### Playing with the confetti

While the paper is still in the air, the whole screen is live: every tap throws
another handful from your fingertip. On Android it buzzes; on an iPhone it
ticks, because the tap is a real finger on a real switch — which is the only
way that moment can be felt more than once.

The two platforms get there differently, and the difference is not cosmetic.
Android listens passively and intercepts nothing, because `vibrate()` needs no
control under the finger. iOS has to take the tap, so it also has to hand it on:
the tap still reaches whatever was underneath, or a swim logged while the
confetti was falling would be swallowed by the party.

Under `prefers-reduced-motion` nothing flies: no confetti is drawn at all, and
the emoji fades in place instead of floating. The buzz stays — it isn't motion
on a screen — and so does the emoji itself.

It all lives in `lib/celebrate.js`, which is the only file that would have to be
deleted to remove the lot.

## The saved data

State is one JSON file. Every shape this app has ever written still loads:
bare ISO strings from before pools existed, trip objects without a card flag,
and the current form. `normalize()` in `lib/state.js` is the single entry point,
and it drops anything malformed rather than refusing the file — a corrupt entry
costs you that entry, not the whole history.

Card membership is read from the built-in list first, not from the saved pool
record. A pool saved before `card` existed carries no flag, and trusting the
saved copy alone would silently stop counting real card swims the moment an
older backup was restored. Which pools the card covers is a property of the
card, not of whatever happens to be on disk.

## How syncing works

Taps apply **instantly** and sync in the background, so the app stays usable on
one bar of signal in a changing room. Offline taps queue up in `localStorage`
and flush when you reconnect — the status pill in the header tells you where
things stand (`Synced`, `Syncing…`, `Offline — will sync later`).

Operations are sent as **deltas** ("add a trip"), never as "set the count to 11".
If your phone and laptop each log a swim while out of contact, the server ends up
with both, instead of one silently overwriting the other.

Other devices' changes arrive on a 15-second poll, plus an immediate refresh
whenever you open or return to the app. There is no websocket — for a counter you
touch a few times a week, polling is less to go wrong.

### The API

| | |
|---|---|
| `GET /api/state` | full state — trips, settings, `rev` |
| `POST /api/trips` | log a swim — optional `{ at }` to backdate |
| `DELETE /api/trips/last` | undo the last one |
| `DELETE /api/trips/one` | remove one trip by timestamp (`{ at }`) |
| `DELETE /api/trips` | clear the season |
| `GET /api/rates` | cached ECB rates for the display conversion |
| `PUT /api/settings` | change the prices, or the card's dates |

`lib/state.js` (the domain logic) and `lib/api.js` (the routing) are shared by
both backends *and* by the browser, so the two deployments can't drift apart and
the break-even maths exists in exactly one place.

## Running it locally

```bash
node serve.js
```

Then open <http://localhost:8080>. Still no `npm install` needed — `serve.js`
uses only the Node standard library. The `@netlify/blobs` dependency in
`package.json` is imported solely by the Netlify function.

State is written to `data/state.json`, or wherever `SUND_DATA` points.

### In an LXC container

Full runbook in **[DEPLOY.md](DEPLOY.md)** — container creation, systemd, access
codes, backups and troubleshooting. The short version:

```bash
apt-get install -y nodejs git
git clone https://github.com/maggifrank/sund.git /opt/sund
cp /opt/sund/deploy/sund.service /etc/systemd/system/
systemctl enable --now sund
```

It listens on `0.0.0.0:8080`, so every device on the LAN — including the phone in
your swim bag — points at the container's IP and shares one count.

The count lives in `/var/lib/sund/state.json`, not in the repo. Back up that file.

Install `deploy/sund-update.timer` as well and the container polls GitHub every
five minutes, deploying anything you push — with a health check and automatic
rollback if the new revision won't start. See [DEPLOY.md](DEPLOY.md).

## The public read-only site

<https://sund.talva.is> from outside the LAN — a snapshot of the count, the
cost per trip, break-even, the chart, the pool table and the map, with no way to
change anything. Its direct Netlify address is <https://sund-swim.netlify.app>.

The same hostname serves the private app inside the LAN, through split-horizon
DNS: internally it resolves to Caddy and on to the container, externally to
Cloudflare and on to Netlify. The container itself is on a private address and
is not routable from the internet, so the writable app is only ever reachable
from home. Nothing distinguishes the two by path or port — the split is entirely
in what the name resolves to.

It is read-only **by construction, not by hiding buttons**: the deploy is static
files plus a `state.json` snapshot, with no API and no function behind it. There
is nothing to authenticate because there is nothing to write to.

The page shows **every swim, and counts only the card's**. The big number, the
cost per trip and the break-even are the card's swims — `totals.counted`, worked
out at publish time, because the snapshot's own list is no longer the answer —
while the chart, the weekday pie and the history draw the whole history. That is
the same rule the app states for an off-card swim: it shows in the chart, the
history and the pool table, but never in the money. The history marks the ones
the card does not cover with the same pill the app uses, so the list and the
counter above it always reconcile.

It did not used to. The snapshot published `cardTrips()` alone, which nothing
noticed until the card grew dates: from that day the public chart began at the
season start and every month before it vanished, while the app beside it still
drew the lot. Publishing the dates of off-card swims is the same disclosure the
card's own swims already make — the count was public in `totals.all` and in a
pool table counted over everything, so how much swimming there was outside the
card was never the secret, only when.

The history shows **dates without times**. The times are stripped from the
snapshot itself, not merely hidden in the page — otherwise they would still sit
in `state.json` for anyone who opened it directly. Every published trip is
anchored at local midday, which preserves the date and the count (two swims on
one day stay two rows) while dropping the hour. Nothing on the public page needs
the time: the count, cost per trip, break-even and the monthly chart all work
off dates alone. The private app is unaffected and still records and shows exact
times.

The **pool table** is stripped the same way, in the other direction: the counts
are published, the trips they were counted from are not. A row says the pool and
how many visits it has had, and nothing in the snapshot can put one of those
visits on a day. See [Pools](#pools).

The **map** is a second page, `/map.html`, reached from the same 🗺 in the
header. It is those same rows drawn on the country rather than listed, and it
adds nothing to the snapshot but an `id` per row — see
[On the public site](#on-the-public-site).

The container republishes within seconds of a swim — see
[DEPLOY.md](DEPLOY.md#publishing-the-public-read-only-site). To publish by hand
from anywhere that can reach a running instance:

```bash
node bin/publish.mjs --source http://<container-ip>:8080 --deploy
```

It deploys through Netlify's file API rather than the CLI, uploading exactly the
files it lists and nothing else, then asks Netlify what it actually published and
**fails if any function is present**. It also walks the built module graph and
**refuses to publish if an import points at a file the build does not contain** —
that list of files is maintained by hand, so a shared module growing a new import
would otherwise 404 in the browser, break the whole graph and render a blank
page, while `state.json` kept serving perfectly and every other check looked
fine. Both of those exist because of a real
mistake: the CLI resolves its project base by walking up from the deploy
directory, found `netlify/functions`, and put the read/write API on the public
site even though `--dir dist` was passed. Enumerating the files makes that
impossible rather than merely guarded against.

Publishing is **event-driven**: `serve.js` touches a trigger file after every
change and a systemd path unit republishes within seconds. A six-hourly timer
remains as a safety net, so `--if-changed` still guards against redundant
deploys — it compares the trip count *and* the ECB rate date, so the safety net
also refreshes a stale rate when nobody has been swimming. Set `SUND_TOKEN` if the source instance requires
an access code, and `NETLIFY_AUTH_TOKEN` to deploy from a machine without the
Netlify CLI signed in.

## Running the whole app on Netlify

`netlify.toml` and `netlify/functions/trips.js` implement the full read/write API
against [Netlify Blobs](https://docs.netlify.com/blobs/overview/) instead of a
file, claiming `/api/*` through the function's own `config.path`. It is unused —
the app runs on the LXC — but kept working as an escape hatch.

> **Do not run `netlify deploy` from this directory.** The repo's `.netlify`
> link points at `sund-swim`, which is the *public read-only site*. A deploy
> from here would replace that static snapshot with the read/write app and put
> an API on a public URL. Publishing is done by `bin/publish.mjs`, which uploads
> an explicit file list and refuses to finish if a function lands in the deploy.

If you ever do want the whole app on Netlify, create a **separate site** for it,
and set `SUND_TOKEN` in its environment first — otherwise anyone who finds the
URL can edit the count.

## The access code

Optional, off by default. Set `SUND_TOKEN` on the server (systemd `Environment=`,
or Netlify environment variables) and every device will prompt for it once and
remember it. Without it the API is open to anyone who can reach the port.

Note this guards the API, not the static files — it keeps people from *changing*
your count, and is a shared code rather than real per-user accounts.

## Known limits

- **Last write wins on settings.** Two devices changing prices in the same second
  could have one overwrite the other. Trips aren't affected — those are deltas.
- **On Netlify, the blob read-modify-write isn't transactional.** Two swims
  logged in the same instant from different devices could theoretically collapse
  into one. The LXC backend serializes writes and doesn't have this problem.
- **Backdating is date-only.** You can log that you swam last Tuesday, but not
  that it was at 7am. The entry is stored at midday and displayed without a time.
- **The Icelandic and Polish are mine, not a native speaker's.** The grammar and
  plural rules are right, but term choices are worth a second opinion —
  *núllpunktur* / *fjölnotakort* in Icelandic, and *wejście* (pool admission)
  and *próg opłacalności* in Polish.
- **Conversion is display-only and follows the language.** Someone reading in
  Polish still pays ISK at the pool; the zloty figure is a convenience, not a
  price. There is no way to pick a currency independently of the language.
- **The public page can be up to six hours behind on exchange rates.** The count
  itself republishes within seconds of a swim; only the ECB rate waits for the
  safety-net timer, and the page always names the rate's date.
- **iOS haptics are one borrowed tick per tap.** Safari has no Vibration API,
  so every control carries an invisible native switch and lets iOS play its
  system tap. Measured on the device: script cannot produce a tick in any form,
  a real tap produces exactly one however many toggles follow it, and only taps
  stack. So the milestone and break-even rhythms are Android-only — an iPhone
  cannot tell the 50th swim from any other by feel, and the best it can be given
  is more taps worth making, which is what the playable confetti does. It also
  rests on a WebKit behaviour Apple has already narrowed once, in iOS 26.5, and
  could remove; when it goes, the iPhone is simply silent again.
- **A pool can only be set from the History list.** There is no bulk edit, so
  attributing a long backlog is one tap per trip.
- **Bulk import is a script, not a button.** `bin/import-trips.mjs` reads a
  written log — lines of `DD.MM  Pool name` — and posts each swim. It is
  idempotent, refuses the whole run if any pool name is unrecognised, and
  accepts ASCII spellings of Icelandic names. There is no equivalent in the app.
- **Export has no matching import.** Settings offers *Export data*, which writes
  the current state as JSON, but there is no way to load one back through the
  app. Restoring means writing the file to `/var/lib/sund/state.json` and
  restarting — see [DEPLOY.md](DEPLOY.md).
- **One membership at a time.** The card has a single pair of dates and a single
  set of pools, so the app shows this year's card or last year's, not both.
  Older seasons stay in the history and the chart, but their own cost per trip
  is gone once the dates move on.
- **A pool page is as current as its last fetch.** Hours and prices change and
  nothing re-reads the directory on its own; the page names the day it was
  read.
- **Facilities are what the description happens to mention.** Sky Lagoon's
  says nothing about a sauna, so its page lists none. The tags are right about
  what they say and silent about the rest.
- **A pool has to be in the list to be picked.** The ⚙ list is the built-in 107
  plus anywhere you have named on the spot. Somewhere you have never been and
  that `lib/pools.js` has never heard of cannot be ticked until a swim there
  puts it in the list.

## Files

| | |
|---|---|
| `index.html` `styles.css` `app.js` | the private read/write app |
| `map.html` `map.js` | the map page — the private app only |
| `pool.html` `pool.js` | a pool's page — the private app only |
| `public/` | the public read-only pages — the counter, the map and a pool's page |
| `lib/state.js` | trips, settings and the break-even arithmetic |
| `lib/api.js` | HTTP routing and validation, shared by both backends |
| `lib/i18n.js` | Icelandic, English and Polish strings, plurals, dates, number formats |
| `lib/money.js` | currency per language, conversion and formatting |
| `lib/chart.js` | the trips-per-month chart and the weekday pie, shared by both pages |
| `lib/pooltable.js` | the visits-per-pool table, shared by both pages |
| `lib/poolmap.js` | the pool map — its marks, badges and zoom |
| `lib/poolpage.js` | a pool's page and the map's list of them, shared by both pages |
| `lib/poolinfo.js` | what sundlaugar.is says about each pool — generated, do not edit |
| `lib/busychart.js` | the busy-times chart on a pool page |
| `lib/poolbusy.js` | a typical week of visitors for Reykjavík's pools — generated, do not edit |
| `lib/iceland.js` | the ISN93 / Lambert projection, the capital area's window and the map's geometry |
| `lib/coastline.js` | the two coastlines, the country and the capital area in detail — generated, do not edit |
| `lib/celebrate.js` | haptics, emoji and confetti — the private app only |
| `lib/rates.js` | ECB rate fetching and cache freshness |
| `serve.js` | LXC backend — static files + API, file-backed, no dependencies |
| `netlify/functions/trips.js` | unused Netlify backend — same API, Blobs-backed |
| `bin/publish.mjs` | snapshot, build and deploy the public site |
| `bin/build-coastline.mjs` | regenerate `lib/coastline.js` from IS 50V, and check every pool is on land |
| `bin/check-pools-on-land.mjs` | check no pool is drawn in the sea — run by CI, independently of the generator |
| `.github/workflows/pools-on-land.yml` | runs that check when the pools, the coast or the projection change |
| `bin/fetch-pool-info.mjs` | read sundlaugar.is a region at a time into `lib/poolinfo.js` |
| `bin/fetch-pool-busyness.mjs` | average Reykjavík's gate counts into `lib/poolbusy.js` |
| `deploy/sund.service` | the app |
| `deploy/sund-update.*` | poll GitHub every 5 min, deploy with rollback |
| `deploy/sund-publish.*` | publish the public snapshot every 15 min |
| `DEPLOY.md` | LXC deployment runbook |
