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
 * directions written afresh in each language rather than copied, with the
 * directory's page linked from the foot of the pool's page as before.
 *
 * `checked` is the day the entry was last compared with the directory.
 *
 *   temp       the water in °C, [low, high], or null when the page does not say
 *   access     'car' any car gets there, '4x4' only a four-wheel drive does,
 *              'walk' the last part is on foot; null when the page does not say
 *   walk       { km, min } of the walk in, either may be null
 *   facilities 'none', 'basic' (a changing hut, a shower), or null
 *   free       true, false, or null when the page does not say
 *   directions { is, en, pl }: how to find it, in a sentence or two
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
    directions: {
      is: 'Ekið fram hjá Geysi og um 2 km eftir vegi F333. Laugin er vinstra megin, rétt við veginn, áður en komið er að Haukadalskirkju. Tvær laugar, sú stærri hlaðin grjóti.',
      en: 'Drive past Geysir and about 2 km along road F333. The pool is on the left, right beside the road, before you reach Haukadalur church. There are two pools; the larger is walled with stacked stones.',
      pl: 'Minąć Geysir i jechać około 2 km drogą F333. Basen jest po lewej, tuż przy drodze, przed kościołem w Haukadalur. Są dwa baseny; większy obłożony kamieniami.'
    },
    cautions: ['checkTemp', 'slippery', 'nearbyHot', 'litter']
  }
};

export const guideFor = (id) => POOL_GUIDE[id] ?? null;
