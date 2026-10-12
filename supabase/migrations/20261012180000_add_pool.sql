-- Pools the nightly crawl finds on sundlaugar.is that the app does not have.
-- bin/fetch-pool-info.mjs writes them, with what each one's page says, to
-- lib/newpools.js; /admin/ offers each one, finds its position from the
-- address, and adds it here under the admin's own sign-in. GitHub holds no
-- database key: the crawl only ever writes files.
--
-- The pool and its details go in together, so a pool is never on the list
-- without them. A pool already there is refused (23505), not overwritten.
create or replace function public.add_pool(
  p_id text, p_name text, p_lat double precision, p_lon double precision,
  p_region text default null, p_info jsonb default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if p_lat is null or p_lon is null then
    raise exception 'a pool needs a position' using errcode = '22023';
  end if;
  if p_info is not null and jsonb_typeof(p_info) is distinct from 'object' then
    raise exception 'details must be an object' using errcode = '22023';
  end if;
  insert into public.pools (id, name, country, region, lat, lon)
    values (p_id, btrim(p_name), 'IS', p_region, p_lat, p_lon);
  if p_info is not null then
    insert into public.pool_info (pool_id, info, fetched)
      values (p_id, p_info - 'id', coalesce((p_info ->> 'fetched')::date, current_date));
  end if;
  return p_id;
end
$$;

revoke all on function public.add_pool(text, text, double precision, double precision, text, jsonb) from public, anon, authenticated;
grant execute on function public.add_pool(text, text, double precision, double precision, text, jsonb) to authenticated;
