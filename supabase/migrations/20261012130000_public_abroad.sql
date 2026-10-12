-- Pools abroad on a public page.
--
-- A public page lists pools outside Iceland on their own, apart from the count
-- towards Iceland's pools. For the built-in ones it knows where they are; for a
-- place someone named themselves (a harbour bath in Odense) it was never told,
-- because public_profile() keeps private positions private, so the place showed
-- up as a pool in Iceland with no position. The pool table now says
-- `abroad: true` for those, as bin/publish.mjs did on the one-person site: that
-- it is abroad, never where.

-- Whether a position is outside Iceland: outside a box round the country, with
-- room to spare for every pool on and off the coast (Grímsey, Vestmannaeyjar).
-- Unknown positions are not abroad, only unplaced.
create or replace function public.abroad(p_lat double precision, p_lon double precision)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_lat is not null and p_lon is not null
     and not (p_lat between 62.8 and 67.2 and p_lon between -25.5 and -12.5)
$$;

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
  season_start := public.try_date(s ->> 'seasonStart');
  season_end := public.try_date(s ->> 'seasonEnd');
  if jsonb_typeof(s -> 'cardPools') = 'array' then
    chosen := array(select jsonb_array_elements_text(s -> 'cardPools'));
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
                    'membership', s -> 'membership', 'cardPrice', s -> 'cardPrice',
                    'cardTrips', s -> 'cardTrips', 'seasonStart', s -> 'seasonStart',
                    'seasonEnd', s -> 'seasonEnd', 'cardPools', null),
      'generatedAt', now(),
      'rev', 0
    )
  );
end
$$;

revoke all on function public.abroad(double precision, double precision) from public, anon, authenticated;
