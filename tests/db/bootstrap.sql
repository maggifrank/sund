-- What Supabase provides before any migration runs, stood in for a plain
-- Postgres so the migrations and their policies can be tested anywhere. Only
-- what the migrations touch: the three API roles, auth.users, auth.uid() and
-- the extensions schema.
--
-- auth.uid() reads the settings PostgREST sets from the JWT, so a test signs
-- in as someone with:  set local request.jwt.claim.sub = '<uuid>';

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create schema extensions;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- As Supabase defines it: the older per-claim setting, or the claims PostgREST
-- sets today.
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid
$$;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
