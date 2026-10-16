-- The privacy rules, tested as the people they are meant to keep apart.
--
-- Run by bin/test-db.sh against a throwaway Postgres after bootstrap.sql, the
-- migrations and the seed. Every check raises on failure, and psql stops at
-- the first one. "As X" means the role and user id PostgREST would set for a
-- request carrying X's sign-in.

\set ON_ERROR_STOP on
\set QUIET on

create schema t;

create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok - %', what;
end $$;

-- Runs `stmt` and passes only if it fails with `code`.
create function t.fails(stmt text, code text, what text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = code then raise notice 'ok - %', what; return; end if;
    raise exception 'FAILED: % (got % %, expected %)', what, sqlstate, sqlerrm, code;
  end;
  raise exception 'FAILED: % (it succeeded)', what;
end $$;

grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'magnus@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'other@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'admin@example.com');

select t.ok((select count(*) from public.pools) >= 127, 'the seed loads every pool');
select t.ok((select count(*) from public.pool_info) >= 100, 'the seed loads the pool details');

-- ------------------------------------------------------------ as A
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

insert into public.profiles (username, display_name, public_page, settings) values ('magnus', 'Magnús', true,
  '{"membership": 36400, "cardPrice": 14000, "cardTrips": 30, "seasonStart": "2026-08-23",
    "seasonEnd": "2027-08-23", "cardPools": ["sudurbaejarlaug", "asvallalaug"]}');
select t.fails($$insert into public.profiles (user_id, username, is_admin) values (auth.uid(), 'x-admin', true)$$,
               '42501', 'nobody can make themselves an admin on signup');
select t.fails($$update public.profiles set is_admin = true$$, '42501', 'nobody can make themselves an admin later');

insert into public.cards (id, kind, name, price, valid_from, valid_until)
  values ('10000000-0000-0000-0000-00000000000a', 'year', 'Árskort Hafnarfjarðar', 36400, '2026-08-23', '2027-08-23');
insert into public.card_pools (card_id, pool_id) values
  ('10000000-0000-0000-0000-00000000000a', 'sudurbaejarlaug'),
  ('10000000-0000-0000-0000-00000000000a', 'asvallalaug');
insert into public.cards (id, kind, name, price, entries)
  values ('10000000-0000-0000-0000-00000000000b', 'punch', '30 ferða kort', 14000, 30);

insert into public.trips (at, pool_id, client_id) values
  ('2026-09-01 07:00+00', 'sudurbaejarlaug', '20000000-0000-0000-0000-000000000001'),
  ('2026-09-03 07:00+00', 'asvallalaug',     '20000000-0000-0000-0000-000000000002'),
  ('2026-09-10 18:00+00', 'sudurbaejarlaug', '20000000-0000-0000-0000-000000000003'),
  ('2026-09-05 12:00+00', 'laugardalslaug',  '20000000-0000-0000-0000-000000000004');

select t.ok((select count(*) from public.trips where card_id = '10000000-0000-0000-0000-00000000000a') = 3,
            'swims at the year card''s pools count on the year card');
select t.ok((select card_id from public.trips where pool_id = 'laugardalslaug') = '10000000-0000-0000-0000-00000000000b',
            'a swim the year card does not cover falls to the punch card');
select t.fails($$insert into public.trips (at, pool_id, client_id)
                 values ('2026-09-01 07:00+00', 'sudurbaejarlaug', '20000000-0000-0000-0000-000000000001')$$,
               '23505', 'a queue flushed twice cannot log a swim twice');

insert into public.places (id, name, lat, lon)
  values ('30000000-0000-0000-0000-00000000000a', 'Vesturbæjarsundlaug', 64.1466, -21.9658);
insert into public.trips (at, place_id, client_id)
  values ('2026-09-20 12:00+00', '30000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000005');

select t.ok((select count(*) from public.pool_suggestions where place_id = '30000000-0000-0000-0000-00000000000a') = 1,
            'a new place is offered to the shared list as it is made');
insert into public.places (id, name, lat, lon)
  values ('30000000-0000-0000-0000-00000000000b', 'Odense Havnebad', 55.4069, 10.3797);
select t.fails($$select public.admin_suggestions()$$, '42501', 'only an admin reads the suggestion queue');
select t.ok(exists (select 1 from public.suggest_place('30000000-0000-0000-0000-00000000000a') where id = 'vesturbaejarlaug'),
            'suggesting a place finds the shared pool it duplicates');
select t.ok(exists (select 1 from public.similar_pools('arbaejarlaug') where id = 'arbaejarlaug'),
            'a name typed without accents still finds the pool');

-- ------------------------------------------------------------ as B
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

select t.ok((select count(*) from public.trips) = 0, 'B sees none of A''s swims');
select t.ok((select count(*) from public.cards) = 0, 'B sees none of A''s cards');
select t.ok((select count(*) from public.card_pools) = 0, 'B sees none of A''s card pools');
select t.ok((select count(*) from public.places) = 0, 'B sees none of A''s places');
select t.ok((select count(*) from public.profiles) = 0, 'B sees no one else''s profile');
select t.ok((select count(*) from public.pool_suggestions) = 0, 'B sees none of A''s suggestions');

with u as (update public.trips set pool_id = 'asvallalaug' returning 1) select t.ok((select count(*) from u) = 0, 'B cannot change A''s swims');
with d as (delete from public.trips returning 1) select t.ok((select count(*) from d) = 0, 'B cannot delete A''s swims');
with d as (delete from public.cards returning 1) select t.ok((select count(*) from d) = 0, 'B cannot delete A''s cards');

select t.fails($$insert into public.trips (user_id, at, client_id)
                 values ('00000000-0000-0000-0000-00000000000a', now(), gen_random_uuid())$$,
               '42501', 'B cannot log a swim as A');
select t.fails($$insert into public.trips (at, card_id, client_id)
                 values (now(), '10000000-0000-0000-0000-00000000000a', gen_random_uuid())$$,
               '42501', 'B cannot put a swim on A''s card');
select t.fails($$insert into public.trips (at, place_id, client_id)
                 values (now(), '30000000-0000-0000-0000-00000000000a', gen_random_uuid())$$,
               '42501', 'B cannot log a swim at A''s private place');
select t.fails($$insert into public.card_pools values ('10000000-0000-0000-0000-00000000000a', 'laugardalslaug')$$,
               '42501', 'B cannot add pools to A''s card');
select t.fails($$insert into public.pool_suggestions (place_id) values ('30000000-0000-0000-0000-00000000000a')$$,
               '42501', 'B cannot suggest A''s place');
select t.fails($$insert into public.pools (id, name) values ('fake', 'Fake')$$,
               '42501', 'B cannot add to the shared pool list');
select t.fails($$select public.resolve_suggestion(gen_random_uuid(), 'reject')$$,
               '42501', 'B cannot act as an admin');
select t.fails($$select public.set_pool_info('vesturbaejarlaug', '{}')$$, '42501', 'only an admin saves pool details');
select t.fails($$select public.set_pool_status('vesturbaejarlaug', 'closed')$$, '42501', 'only an admin closes a pool');
select t.fails($$select public.add_pool('nyjalaug', 'Nýjalaug', 64.5, -21.5)$$, '42501', 'only an admin adds a pool');

select t.fails($$insert into public.profiles (username) values ('admin')$$, '23514', 'reserved usernames are refused');
select t.fails($$insert into public.profiles (username) values ('MAGNUS')$$, '23505', 'usernames are unique ignoring case');
select t.fails($$insert into public.profiles (username) values ('Bad Name')$$, '23514', 'usernames are slugs');
insert into public.profiles (username) values ('other');

select t.ok(public.public_profile('other') is null, 'a page that is switched off shows nothing');

insert into public.trips (at, client_id) select now(), gen_random_uuid() from generate_series(1, 50);
select t.fails($$insert into public.trips (at, client_id) values (now(), gen_random_uuid())$$,
               '54000', 'the 51st swim in a day is refused');

select t.fails($$select public.import_trips('[{"at": "2025-01-01T12:00:00Z"}]')$$, '55000',
               'a history can only be imported into an empty account');

-- ------------------------------------------------------------ importing a history
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'new@example.com');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
insert into public.profiles (username) values ('newcomer');
select t.ok(public.import_trips((select jsonb_agg(jsonb_build_object(
              'at', '2025-01-01T12:00:00Z'::timestamptz + make_interval(days => i),
              'pool_id', case when i % 2 = 0 then 'laugardalslaug' else 'no-such-pool' end,
              'place_id', '30000000-0000-0000-0000-00000000000a'))
            from generate_series(1, 120) i)) = 120,
            'a whole history imports at once, past the daily limit');
select t.ok((select count(*) from public.trips where pool_id = 'laugardalslaug') = 60
            and (select count(*) from public.trips where pool_id is null and place_id is null) = 60,
            'an import keeps shared pools and drops unknown pools and other people''s places');
insert into public.trips (at, client_id) select now(), gen_random_uuid() from generate_series(1, 50);
select t.ok((select count(*) from public.trips) = 170, 'an imported history does not use up today''s swims');
select t.fails($$insert into public.trips (at, client_id) values (now(), gen_random_uuid())$$,
               '54000', 'the daily limit still holds after an import');

-- ------------------------------------------------------------ as anyone
reset role;
set role anon;
set request.jwt.claim.sub = '';

select t.ok((select count(*) from public.pools) >= 127, 'anyone can read the pool list');
select t.fails($$select * from public.trips$$, '42501', 'anyone else cannot read swims at all');
select t.fails($$select * from public.profiles$$, '42501', 'anyone else cannot read profiles');

select t.ok((public.public_profile('magnus') #>> '{totals,all}')::int = 5, 'the public page counts every swim');
select t.ok(public.public_profile('magnus') -> 'totals' = '{"all": 5, "counted": 3, "offCard": 2, "outsideSeason": 0}',
            'the public page splits the swims by what the card covers');
select t.ok(public.public_profile('magnus') #> '{settings,cardPools}' = 'null',
            'the public page does not say which pools the card covers');
select t.ok(public.public_profile('magnus') -> 'trips' = '[]', 'the public page lists no swims');
select t.ok((select sum((r ->> 'count')::int) from jsonb_array_elements(public.public_profile('magnus') -> 'poolTable') r) = 5,
            'the public pool table adds up to every swim');
select t.ok(public.public_profile('magnus') -> 'byMonth' = '{"2026-09": 5}', 'the public page counts swims per month');
select t.ok(jsonb_array_length(public.public_profile('magnus') -> 'byWeekday') = 7, 'the public page counts swims per weekday');
select t.ok(public.public_profile('magnus')::text !~ '2026-09-\d\d[T ]\d', 'the public page has no swim dates or times');
-- The place's whole coordinates: '21\.96' alone also matched a timestamp
-- that happened to land on second 21.96, which failed CI once.
select t.ok(public.public_profile('magnus')::text !~ '64\.1466|-21\.9658', 'the public page has no private place positions');
reset role;
update public.profiles set settings = settings || '{"cardType": "none"}' where username = 'magnus';
set role anon;
select t.ok(public.public_profile('magnus') -> 'totals' = '{"all": 5, "counted": 5, "offCard": 0, "outsideSeason": 0}'
            and public.public_profile('magnus') #>> '{settings,cardType}' = 'none',
            'with no card, the public page counts every swim and says there is no card');
reset role;
update public.profiles set settings = settings - 'cardType' where username = 'magnus';
set role anon;
select t.ok(public.public_profile('magnus') #>> '{settings,cardType}' = 'year', 'a profile saved before card types is a year card');
reset role;
insert into public.trips (user_id, at, place_id, client_id)
  values ('00000000-0000-0000-0000-00000000000a', '2026-09-25 12:00+00', '30000000-0000-0000-0000-00000000000b', gen_random_uuid());
set role anon;
select t.ok((select r from jsonb_array_elements(public.public_profile('magnus') -> 'poolTable') r
             where r ->> 'name' = 'Odense Havnebad') ->> 'abroad' = 'true',
            'the public page says a place abroad is abroad');
select t.ok((select count(*) from jsonb_array_elements(public.public_profile('magnus') -> 'poolTable') r
             where r ? 'abroad') = 1, 'and only that one');
select t.ok(public.public_profile('magnus')::text !~ '55\.40|10\.37', 'but not where it is');
reset role;
delete from public.trips where place_id = '30000000-0000-0000-0000-00000000000b';
set role anon;

-- ------------------------------------------------------------ as the admin
reset role;
insert into public.profiles (user_id, username, is_admin) values ('00000000-0000-0000-0000-00000000000c', 'stjori', true);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';

select t.ok((select count(*) from public.pool_suggestions) = 2, 'the admin sees suggestions');
select t.ok(jsonb_array_length(public.admin_suggestions()) = 2, 'the admin reads the queue');
select t.ok((select q -> 'swims' = '1' and q -> 'similar' @> '[{"id": "vesturbaejarlaug"}]'
             from jsonb_array_elements(public.admin_suggestions()) q where q ->> 'name' = 'Vesturbæjarsundlaug'),
            'the queue shows the swims at a place and the pool it may duplicate');
select t.ok(public.admin_suggestions()::text !~ '2026-09-2\d', 'the queue has no swim dates');
reset role;
insert into public.places (id, user_id, name, lat, lon)
  values ('30000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b', 'Havnebadet Odense', 55.4070, 10.3798);
set role authenticated;
select t.ok((select q -> 'alsoSuggested' @> '[{"name": "Havnebadet Odense", "username": "other"}]'
             from jsonb_array_elements(public.admin_suggestions()) q where q ->> 'name' = 'Odense Havnebad'),
            'the queue links two people''s suggestions for the same new place');
select t.ok(public.resolve_suggestion((select id from public.pool_suggestions
                                        where place_id = '30000000-0000-0000-0000-00000000000b'), 'add') = 'odense-havnebad',
            'the admin adds a suggestion as a new shared pool');
select t.ok(exists (select 1 from public.pools where id = 'odense-havnebad' and lat = 55.4069),
            'the new pool is on the shared list with its position');
select t.ok(public.resolve_suggestion((select id from public.pool_suggestions
                                        where place_id = '30000000-0000-0000-0000-00000000000a'), 'merge', 'vesturbaejarlaug') = 'vesturbaejarlaug',
            'the admin merges a suggestion into an existing pool');
select t.ok((select 'Vesturbæjarsundlaug' = any (aliases) from public.pools where id = 'vesturbaejarlaug'),
            'the merged name becomes another name for the pool');
select t.ok((select jsonb_agg(q ->> 'name') from jsonb_array_elements(public.admin_suggestions()) q) = '["Havnebadet Odense"]',
            'answered suggestions leave the queue');
select t.ok((select count(*) from public.trips) = 0, 'the admin still cannot read anyone''s swims');
select public.set_pool_info('odense-havnebad', '{"id": "x", "name": "Odense Havnebad", "kind": "pool"}');
select t.ok((select info from public.pool_info where pool_id = 'odense-havnebad') = '{"name": "Odense Havnebad", "kind": "pool"}',
            'the admin saves details for a pool');
select t.fails($$select public.set_pool_info('no-such-pool', '{}')$$, '23503', 'details need a pool on the list');
select public.set_pool_status('vesturbaejarlaug', 'closed');
select t.ok((select status = 'closed' and checked_on = current_date from public.pools where id = 'vesturbaejarlaug'),
            'the admin marks a pool closed');
select public.set_pool_status('vesturbaejarlaug', 'open');
select t.fails($$select public.set_pool_status('vesturbaejarlaug', 'gone')$$, '22023', 'a pool is open or closed');
select t.ok(public.add_pool('nyjalaug', 'Nýjalaug', 64.5, -21.5, 'vesturland',
                            '{"id": "nyjalaug", "name": "Nýjalaug", "fetched": "2026-10-10"}') = 'nyjalaug',
            'the admin adds a new pool from the crawl');
select t.ok((select country = 'IS' and region = 'vesturland' and lat = 64.5 from public.pools where id = 'nyjalaug')
            and (select fetched = '2026-10-10' and info = '{"name": "Nýjalaug", "fetched": "2026-10-10"}'
                 from public.pool_info where pool_id = 'nyjalaug'),
            'the new pool is on the list with its position and details');
select t.fails($$select public.add_pool('nyjalaug', 'Nýjalaug', 64.5, -21.5)$$, '23505', 'a pool already on the list is not added again');
select t.fails($$select public.add_pool('stadlaus', 'Staðlaus', null, null)$$, '22023', 'a new pool needs a position');

reset role;
select t.ok((select pool_id from public.trips where client_id = '20000000-0000-0000-0000-000000000005') = 'vesturbaejarlaug',
            'swims at the merged place move to the shared pool');

-- ------------------------------------------------------------ deleting an account
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.delete_my_account();
reset role;
select t.ok(not exists (select 1 from public.trips where user_id = '00000000-0000-0000-0000-00000000000a')
            and not exists (select 1 from public.cards where user_id = '00000000-0000-0000-0000-00000000000a')
            and not exists (select 1 from public.places where user_id = '00000000-0000-0000-0000-00000000000a')
            and not exists (select 1 from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
            'deleting an account deletes everything in it');

\echo all database checks passed
