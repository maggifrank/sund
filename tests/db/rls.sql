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

insert into public.profiles (username, display_name, public_page) values ('magnus', 'Magnús', true);
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

select t.fails($$insert into public.profiles (username) values ('admin')$$, '23514', 'reserved usernames are refused');
select t.fails($$insert into public.profiles (username) values ('MAGNUS')$$, '23505', 'usernames are unique ignoring case');
select t.fails($$insert into public.profiles (username) values ('Bad Name')$$, '23514', 'usernames are slugs');
insert into public.profiles (username) values ('other');

select t.ok(public.public_profile('other') is null, 'a page that is switched off shows nothing');

insert into public.trips (at, client_id) select now(), gen_random_uuid() from generate_series(1, 50);
select t.fails($$insert into public.trips (at, client_id) values (now(), gen_random_uuid())$$,
               '54000', 'the 51st swim in a day is refused');

-- ------------------------------------------------------------ as anyone
reset role;
set role anon;
set request.jwt.claim.sub = '';

select t.ok((select count(*) from public.pools) >= 127, 'anyone can read the pool list');
select t.fails($$select * from public.trips$$, '42501', 'anyone else cannot read swims at all');
select t.fails($$select * from public.profiles$$, '42501', 'anyone else cannot read profiles');

select t.ok((public.public_profile('magnus') ->> 'total')::int = 5, 'the public page counts every swim');
select t.ok(public.public_profile('magnus') -> 'byMonth' = '{"2026-09": 5}', 'the public page counts swims per month');
select t.ok(jsonb_array_length(public.public_profile('magnus') -> 'byWeekday') = 7, 'the public page counts swims per weekday');
select t.ok(public.public_profile('magnus')::text !~ '2026-09-\d\d[T ]\d', 'the public page has no swim dates or times');
select t.ok(public.public_profile('magnus')::text !~ '64\.14|21\.96', 'the public page has no private place positions');

-- ------------------------------------------------------------ as the admin
reset role;
insert into public.profiles (user_id, username, is_admin) values ('00000000-0000-0000-0000-00000000000c', 'stjori', true);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';

select t.ok((select count(*) from public.pool_suggestions) = 1, 'the admin sees suggestions');
select t.ok(public.resolve_suggestion((select id from public.pool_suggestions), 'merge', 'vesturbaejarlaug') = 'vesturbaejarlaug',
            'the admin merges a suggestion into an existing pool');
select t.ok((select 'Vesturbæjarsundlaug' = any (aliases) from public.pools where id = 'vesturbaejarlaug'),
            'the merged name becomes another name for the pool');
select t.ok((select count(*) from public.trips) = 0, 'the admin still cannot read anyone''s swims');

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
