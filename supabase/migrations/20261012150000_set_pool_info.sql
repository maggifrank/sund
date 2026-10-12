-- Pool details from the admin page. When an admin adds a pool from a
-- suggestion (or merges one into a pool with no details), /admin/ asks the
-- pool-details Edge Function to look the pool up on the web and saves what it
-- found here, under the admin's own sign-in. Nobody else can write pool_info.
create or replace function public.set_pool_info(p_pool text, p_info jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_info) is distinct from 'object' then
    raise exception 'details must be an object' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pools where id = p_pool) then
    raise exception 'no pool %', p_pool using errcode = '23503';
  end if;
  insert into public.pool_info (pool_id, info, fetched)
    values (p_pool, p_info - 'id', current_date)
    on conflict (pool_id) do update set info = excluded.info, fetched = excluded.fetched;
end
$$;

revoke all on function public.set_pool_info(text, jsonb) from public, anon, authenticated;
grant execute on function public.set_pool_info(text, jsonb) to authenticated;
