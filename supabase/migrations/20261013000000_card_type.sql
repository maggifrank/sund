-- How someone pays: no card, a year card or a punch card (settings.cardType,
-- see lib/state.js). A public page draws its figures to match, so it is told
-- which. With no card every swim counts, so the card's dates and pools are not
-- applied; the page adds up each pool's single entry price from the pool
-- table. A profile saved before this has no cardType and is a year card.

create or replace function public.public_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  s jsonb;
  card_type text;
  season_start date;
  season_end date;
  chosen text[];
begin
  select * into me from public.profiles p
    where p.username = p_username::extensions.citext and p.public_page;
  if not found then
    return null;
  end if;
  s := me.settings;
  card_type := coalesce(s ->> 'cardType', 'year');
  -- No card: every swim counts, wherever and whenever it was.
  if card_type <> 'none' then
    season_start := public.try_date(s ->> 'seasonStart');
    season_end := public.try_date(s ->> 'seasonEnd');
    if jsonb_typeof(s -> 'cardPools') = 'array' then
      chosen := array(select jsonb_array_elements_text(s -> 'cardPools'));
    end if;
  end if;

  return (
    with t as (
      select coalesce(tr.pool_id, tr.place_id::text) as pool,
             (tr.at at time zone 'Atlantic/Reykjavik') as local
      from public.trips tr
      where tr.user_id = me.user_id
    ),
    c as (
      select t.*,
             (season_start is null or t.local::date >= season_start)
               and (season_end is null or t.local::date <= season_end) as in_season,
             (t.pool is null or chosen is null or t.pool = any (chosen)) as on_card
      from t
    )
    select jsonb_build_object(
      'username', me.username,
      'displayName', me.display_name,
      'trips', '[]'::jsonb,
      'pools', '[]'::jsonb,
      'byMonth', coalesce((select jsonb_object_agg(m, n) from
                   (select to_char(local, 'YYYY-MM') as m, count(*) as n from c group by 1) x), '{}'),
      'byWeekday', (select jsonb_agg(coalesce(w.n, 0) order by d) from generate_series(0, 6) d
                    left join (select extract(dow from local)::int as dd, count(*) as n from c group by 1) w
                    on w.dd = d),
      'totals', (select jsonb_build_object(
                   'all', count(*),
                   'counted', count(*) filter (where in_season and on_card),
                   'outsideSeason', count(*) filter (where not in_season),
                   'offCard', count(*) filter (where in_season and not on_card))
                 from c),
      'poolTable', coalesce((select jsonb_agg(jsonb_build_object(
                                'id', x.pool, 'name', coalesce(po.name, pl.name), 'count', x.n,
                                'card', x.pool is null or chosen is null or x.pool = any (chosen))
                              || case when public.abroad(coalesce(po.lat, pl.lat), coalesce(po.lon, pl.lon))
                                      then '{"abroad": true}'::jsonb else '{}'::jsonb end
                              order by x.pool is null, x.n desc, coalesce(po.name, pl.name))
                            from (select pool, count(*) as n from c group by 1) x
                            left join public.pools po on po.id = x.pool
                            left join public.places pl on pl.id::text = x.pool and pl.user_id = me.user_id),
                            '[]'),
      'settings', jsonb_build_object(
                    'cardType', card_type,
                    'membership', s -> 'membership', 'cardPrice', s -> 'cardPrice',
                    'cardTrips', s -> 'cardTrips', 'seasonStart', s -> 'seasonStart',
                    'seasonEnd', s -> 'seasonEnd', 'cardPools', null),
      'generatedAt', now(),
      'rev', 0
    )
  );
end
$$;
