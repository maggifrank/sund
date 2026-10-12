-- Sund 2.0: shared pools, private swims.
--
-- Pools, their details and the exchange rates are reference data that anyone
-- can read and only the service role (CI, the admin functions) can write.
-- Everything a person logs — swims, cards, places they named — is theirs
-- alone: row-level security restricts every one of those tables to
-- `user_id = auth.uid()`, and a table with no policy for an operation refuses
-- it. Public pages never read these tables; public_profile() returns the sums
-- a public page is allowed to show and nothing else.
--
-- Written for Supabase, where the `auth` schema, auth.uid(), and the `anon`,
-- `authenticated` and `service_role` roles already exist. tests/db/bootstrap.sql
-- stands those in for a plain Postgres so the policies can be tested in CI.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------- helpers

-- A name as it is compared: lower case, accents folded (Árbæjarlaug and
-- arbaejarlaug are one name), and the words every pool shares dropped so they
-- do not make two different pools look alike.
create or replace function public.pool_key(name text)
returns text
language sql
stable
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(lower(extensions.unaccent('extensions.unaccent', coalesce(name, ''))),
                   '\m(sundlaug|sundhöll|sundholl|laug|pool|swimming|the)\M', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;

-- Metres between two points, near enough for deciding whether two pools are
-- the same place.
create or replace function public.distance_m(lat1 double precision, lon1 double precision,
                                             lat2 double precision, lon2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)))
$$;

-- ---------------------------------------------------------------- shared data

create table public.pools (
  id         text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name       text not null check (length(btrim(name)) > 0),
  aliases    text[] not null default '{}',
  country    text check (country ~ '^[A-Z]{2}$'),
  region     text,
  lat        double precision check (lat between -90 and 90),
  lon        double precision check (lon between -180 and 180),
  created_at timestamptz not null default now()
);

-- What sundlaugar.is says about a pool, as lib/poolinfo.js holds it today.
create table public.pool_info (
  pool_id    text primary key references public.pools (id) on delete cascade,
  info       jsonb not null,
  fetched    date not null
);

create table public.rates (
  base       text primary key default 'ISK',
  date       date not null,
  rates      jsonb not null
);

-- ---------------------------------------------------------------- people

create table public.reserved_usernames (
  name extensions.citext primary key
);

create table public.profiles (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  username     extensions.citext not null unique
               check (username ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(username) between 3 and 30),
  display_name text check (length(display_name) <= 60),
  lang         text not null default 'is' check (lang in ('is', 'en', 'pl')),
  public_page  boolean not null default false,
  -- The app's card settings, as lib/state.js keeps them: membership, cardPrice,
  -- cardTrips, seasonStart, seasonEnd and cardPools.
  settings     jsonb not null default '{}'
               check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 16384),
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create or replace function public.check_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Stored lower case, so the address is the same however it was typed.
  new.username := lower(new.username);
  if exists (select 1 from public.reserved_usernames r where r.name = new.username) then
    raise exception 'username "%" is reserved', new.username using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger profiles_username before insert or update of username on public.profiles
  for each row execute function public.check_username();

-- Whether the signed-in user is an admin. Security definer so a policy can ask
-- without the profiles policy recursing into itself.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------- a person's own

-- A pool card. A year or time card is bounded by its dates; a punch card by
-- its entries. Prices are in the card's own currency.
create table public.cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('year', 'time', 'punch')),
  name        text not null check (length(btrim(name)) between 1 and 80),
  price       numeric(12, 2) not null check (price >= 0),
  currency    text not null default 'ISK' check (currency ~ '^[A-Z]{3}$'),
  valid_from  date,
  valid_until date,
  entries     integer check (entries > 0),
  created_at  timestamptz not null default now(),
  check (kind <> 'punch' or entries is not null),
  check (kind = 'punch' or entries is null)
);

-- The pools a card covers. A card with none listed covers every pool.
create table public.card_pools (
  card_id uuid not null references public.cards (id) on delete cascade,
  pool_id text not null references public.pools (id) on delete cascade,
  primary key (card_id, pool_id)
);

-- Somewhere a person named themselves, with where they stood. Private; it
-- reaches the shared list only through a suggestion an admin accepts.
create table public.places (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 80),
  lat        double precision check (lat between -90 and 90),
  lon        double precision check (lon between -180 and 180),
  created_at timestamptz not null default now()
);

-- A swim. `client_id` is made on the phone when the swim is logged, so a queue
-- flushed twice after a dropped connection cannot log it twice.
create table public.trips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at         timestamptz not null,
  pool_id    text references public.pools (id) on delete set null,
  place_id   uuid references public.places (id) on delete set null,
  card_id    uuid references public.cards (id) on delete set null,
  client_id  uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_id),
  check (pool_id is null or place_id is null),
  check (at <= created_at + interval '1 day')
);

create index trips_user_at on public.trips (user_id, at);
create index trips_card on public.trips (card_id);

create table public.pool_suggestions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_id         uuid not null references public.places (id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending', 'added', 'merged', 'rejected')),
  resolved_pool_id text references public.pools (id) on delete set null,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  unique (place_id)
);

-- ---------------------------------------------------------------- swims and cards

-- Which card a swim counts against, when the swim does not say. Of the user's
-- cards that cover the pool (or every pool) on that date, a dated card wins
-- over a punch card, the shortest period first; a punch card only while it has
-- entries left. A swim with no pool counts on any card that covers its date,
-- as the one-person app did.
create or replace function public.pick_card(p_user uuid, p_at timestamptz, p_pool text, p_trip uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select c.id
  from public.cards c
  where c.user_id = p_user
    and (c.valid_from is null or (p_at at time zone 'Atlantic/Reykjavik')::date >= c.valid_from)
    and (c.valid_until is null or (p_at at time zone 'Atlantic/Reykjavik')::date <= c.valid_until)
    and (p_pool is null
         or not exists (select 1 from public.card_pools cp where cp.card_id = c.id)
         or exists (select 1 from public.card_pools cp where cp.card_id = c.id and cp.pool_id = p_pool))
    and (c.kind <> 'punch'
         or (select count(*) from public.trips t where t.card_id = c.id and t.id is distinct from p_trip) < c.entries)
  order by (c.kind = 'punch'),
           (c.valid_from is null or c.valid_until is null),
           (c.valid_until - c.valid_from),
           c.created_at
  limit 1
$$;

create or replace function public.assign_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.card_id is null then
      new.card_id := public.pick_card(new.user_id, new.at, new.pool_id, new.id);
    end if;
  elsif (new.at, new.pool_id) is distinct from (old.at, old.pool_id)
        and new.card_id is not distinct from old.card_id then
    new.card_id := public.pick_card(new.user_id, new.at, new.pool_id, new.id);
  end if;
  return new;
end
$$;

create trigger trips_card before insert or update on public.trips
  for each row execute function public.assign_card();

-- Public signup means someone will script it. Nobody swims 50 times a day.
create or replace function public.limit_trips()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- import_trips() moves a whole history in at once, and only into an empty account.
  if current_setting('sund.importing', true) = 'on' then
    return new;
  end if;
  if (select count(*) from public.trips t
      where t.user_id = new.user_id and t.created_at > now() - interval '1 day') >= 50 then
    raise exception 'too many swims logged today' using errcode = '54000';
  end if;
  return new;
end
$$;

create trigger trips_limit before insert on public.trips
  for each row execute function public.limit_trips();

-- ---------------------------------------------------------------- row-level security

alter table public.pools enable row level security;
alter table public.pool_info enable row level security;
alter table public.rates enable row level security;
alter table public.reserved_usernames enable row level security;
alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.card_pools enable row level security;
alter table public.places enable row level security;
alter table public.trips enable row level security;
alter table public.pool_suggestions enable row level security;

-- Supabase grants every role everything on new tables by default. Start from
-- nothing and grant back exactly what each role uses.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

create policy "pools are public" on public.pools for select using (true);
create policy "pool info is public" on public.pool_info for select using (true);
create policy "rates are public" on public.rates for select using (true);
grant select on public.pools, public.pool_info, public.rates to anon, authenticated;

create policy "own profile" on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "create own profile" on public.profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy "edit own profile" on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select on public.profiles to authenticated;
-- Never is_admin: no one makes themselves an admin.
grant insert (user_id, username, display_name, lang, public_page, settings) on public.profiles to authenticated;
grant update (username, display_name, lang, public_page, settings) on public.profiles to authenticated;

create policy "own cards" on public.cards for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.cards to authenticated;

create policy "own card pools" on public.card_pools for all to authenticated
  using (exists (select 1 from public.cards c where c.id = card_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.cards c where c.id = card_id and c.user_id = auth.uid()));
grant select, insert, delete on public.card_pools to authenticated;

create policy "own places" on public.places for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.places to authenticated;

-- A swim may point only at the user's own place and card. The subqueries run
-- under the same policies, so someone else's id simply is not found.
create policy "own trips" on public.trips for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (place_id is null or exists (select 1 from public.places p where p.id = place_id))
    and (card_id is null or exists (select 1 from public.cards c where c.id = card_id))
  );
grant select, insert, update, delete on public.trips to authenticated;

create policy "own suggestions" on public.pool_suggestions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "suggest own place" on public.pool_suggestions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.places p where p.id = place_id));
grant select on public.pool_suggestions to authenticated;
grant insert (place_id) on public.pool_suggestions to authenticated;

-- ---------------------------------------------------------------- functions the app calls

-- "Did you mean …?": shared pools near a spot or with a name like the one
-- being typed, closest and most alike first.
create or replace function public.similar_pools(p_name text, p_lat double precision default null,
                                                p_lon double precision default null)
returns table (id text, name text, distance_m double precision, likeness real)
language sql
stable
set search_path = ''
as $$
  with scored as (
    select p.id, p.name,
           case when p_lat is null or p.lat is null then null
                else public.distance_m(p_lat, p_lon, p.lat, p.lon) end as distance_m,
           (select max(extensions.similarity(public.pool_key(n), public.pool_key(p_name)))
              from unnest(array[p.name] || p.aliases) as n) as likeness
    from public.pools p
  )
  select s.id, s.name, s.distance_m, s.likeness
  from scored s
  where s.distance_m < 250 or s.likeness >= 0.4
  order by s.distance_m nulls last, s.likeness desc
  limit 5
$$;

-- A date written by a person, or null when it is not one.
create or replace function public.try_date(p text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::date;
exception when others then
  return null;
end
$$;

-- What a public page may show: sums only. It is the same snapshot the
-- one-person site published (see bin/publish.mjs), so the public pages read it
-- unchanged: counts per month and per weekday, the totals split by what the
-- card covers, the pool table and the card's prices. No swim, date, time or
-- position leaves the database through here, and nothing at all for a page
-- that is switched off. Months and weekdays are counted in Icelandic time.
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

-- Move a whole history in from a Sund 1.0 export: [{at, pool_id, place_id,
-- client_id}]. Only into an account with no swims yet, so it cannot be used to
-- get round the daily limit more than once. A pool that is not on the shared
-- list, or a place that is not the caller's own, is dropped from its swim
-- rather than refusing the import.
create or replace function public.import_trips(p_trips jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if jsonb_typeof(p_trips) <> 'array' or jsonb_array_length(p_trips) > 20000 then
    raise exception 'expected at most 20000 swims' using errcode = '54000';
  end if;
  if exists (select 1 from public.trips where user_id = auth.uid()) then
    raise exception 'import only into an account with no swims' using errcode = '55000';
  end if;

  perform set_config('sund.importing', 'on', true);
  -- Dated as when the swims happened, so they do not count towards today's limit.
  insert into public.trips (user_id, at, created_at, pool_id, place_id, client_id)
  select auth.uid(),
         (e ->> 'at')::timestamptz,
         least((e ->> 'at')::timestamptz, now()),
         (select po.id from public.pools po where po.id = e ->> 'pool_id'),
         (select pl.id from public.places pl
           where pl.id::text = e ->> 'place_id' and pl.user_id = auth.uid()),
         coalesce((e ->> 'client_id')::uuid, gen_random_uuid())
  from jsonb_array_elements(p_trips) e
  on conflict (user_id, client_id) do nothing;
  get diagnostics n = row_count;
  perform set_config('sund.importing', 'off', true);
  return n;
end
$$;

-- Delete everything about the signed-in user. Every private table cascades
-- from auth.users.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid()
$$;

-- Offer one of your places to the shared list.
-- (A plain insert into pool_suggestions does the same; this is the call the app
-- makes so it gets the possible duplicates back with it.)
create or replace function public.suggest_place(p_place uuid)
returns table (id text, name text, distance_m double precision, likeness real)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pl public.places;
begin
  select * into pl from public.places where places.id = p_place;   -- RLS: only your own
  if not found then
    raise exception 'no such place' using errcode = '42704';
  end if;
  insert into public.pool_suggestions (place_id) values (p_place) on conflict (place_id) do nothing;
  return query select * from public.similar_pools(pl.name, pl.lat, pl.lon);
end
$$;

-- An admin's answer to a suggestion. 'add' makes the place a new shared pool,
-- 'merge' folds it into an existing one as another name for it, and either way
-- every swim logged at the place moves to the shared pool. 'reject' leaves the
-- place private to the person who named it. Nothing is deleted.
create or replace function public.resolve_suggestion(p_id uuid, p_action text, p_pool text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.pool_suggestions;
  pl public.places;
  target text;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  select * into s from public.pool_suggestions where id = p_id and status = 'pending' for update;
  if not found then
    raise exception 'no pending suggestion %', p_id using errcode = '42704';
  end if;
  select * into pl from public.places where id = s.place_id;

  if p_action = 'reject' then
    update public.pool_suggestions set status = 'rejected', resolved_at = now() where id = p_id;
    return null;
  elsif p_action = 'add' then
    target := coalesce(p_pool, nullif(regexp_replace(
      lower(extensions.unaccent('extensions.unaccent', pl.name)), '[^a-z0-9]+', '-', 'g'), ''));
    target := btrim(target, '-');
    insert into public.pools (id, name, lat, lon) values (target, pl.name, pl.lat, pl.lon);
    update public.pool_suggestions set status = 'added', resolved_pool_id = target, resolved_at = now()
      where id = p_id;
  elsif p_action = 'merge' then
    if p_pool is null or not exists (select 1 from public.pools where id = p_pool) then
      raise exception 'merge needs an existing pool' using errcode = '22023';
    end if;
    target := p_pool;
    update public.pools set aliases = aliases || pl.name
      where id = target and not (pl.name = any (aliases)) and name <> pl.name;
    update public.pool_suggestions set status = 'merged', resolved_pool_id = target, resolved_at = now()
      where id = p_id;
  else
    raise exception 'action must be add, merge or reject' using errcode = '22023';
  end if;

  update public.trips set pool_id = target, place_id = null where place_id = pl.id;
  return target;
end
$$;

grant execute on function public.pool_key(text) to anon, authenticated;
grant execute on function public.distance_m(double precision, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.similar_pools(text, double precision, double precision) to anon, authenticated;
grant execute on function public.public_profile(text) to anon, authenticated;
grant execute on function public.import_trips(jsonb) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.pick_card(uuid, timestamptz, text, uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.suggest_place(uuid) to authenticated;
grant execute on function public.resolve_suggestion(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------- reserved names

-- Every top-level path the site uses or may use, so no username can shadow one.
insert into public.reserved_usernames (name) values
  ('about'), ('account'), ('admin'), ('api'), ('app'), ('assets'), ('auth'), ('callback'),
  ('export'), ('help'), ('home'), ('import'), ('icons'), ('kort'), ('laug'), ('laugar'), ('lib'), ('login'), ('logout'),
  ('manifest'), ('map'), ('me'), ('new'), ('pool'), ('pools'), ('privacy'), ('public'),
  ('settings'), ('signup'), ('static'), ('sund'), ('support'), ('talva'), ('terms'), ('user'),
  ('users'), ('welcome'), ('www')
on conflict do nothing;
