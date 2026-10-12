-- Whether a pool is still open. sundlaugar.is sometimes stops listing a pool
-- that is still open (Vík, October 2026), so the nightly crawl keeps its last
-- details and marks it `delisted` in lib/poolinfo.js, and /admin/ asks whether
-- it has closed. The answer is kept here:
--
--   status      'open' or 'closed'. A closed pool is left off the front page;
--               its page says it has closed, and swims logged there stay.
--   checked_on  the day an admin last answered, so the question is asked again
--               only if the pool drops off the directory again later.
alter table public.pools
  add column status text not null default 'open' check (status in ('open', 'closed')),
  add column checked_on date;

create or replace function public.set_pool_status(p_pool text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if p_status not in ('open', 'closed') then
    raise exception 'status is open or closed' using errcode = '22023';
  end if;
  update public.pools set status = p_status, checked_on = current_date where id = p_pool;
  if not found then
    raise exception 'no pool %', p_pool using errcode = '23503';
  end if;
end
$$;

revoke all on function public.set_pool_status(text, text) from public, anon, authenticated;
grant execute on function public.set_pool_status(text, text) to authenticated;
