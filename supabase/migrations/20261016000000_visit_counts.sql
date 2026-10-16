-- How many people visit the site, as one row of sums per day and nothing else:
-- no address, no identifier, no page, no browser. lib/visit.js calls
-- count_visit() once per page load; /admin/ reads the sums with admin_visits().
--
--   views      page loads
--   visitors   browsers seen that day (each counted on its first load that day)
--   newcomers  browsers never seen before; summed, an estimate of people
--
-- The browser alone knows whether it was seen before: it keeps the date of
-- its last counted visit in localStorage, and that date never leaves it. Using
-- another browser, a private window or clearing site data counts again, so the
-- figures run a little high. Anyone could call count_visit() by hand and
-- inflate them; nothing here is worth more than a rough count.
create table public.visit_days (
  day        date primary key,
  views      integer not null default 0,
  visitors   integer not null default 0,
  newcomers  integer not null default 0
);

alter table public.visit_days enable row level security;
-- No policies: nobody reads or writes the table directly, only the two
-- functions below.

create or replace function public.count_visit(p_today boolean default false, p_new boolean default false)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.visit_days as v (day, views, visitors, newcomers)
  values ((now() at time zone 'utc')::date, 1, p_today::int, (p_today and p_new)::int)
  on conflict (day) do update set
    views = v.views + 1,
    visitors = v.visitors + excluded.visitors,
    newcomers = v.newcomers + excluded.newcomers;
$$;

-- The last 30 days, newest first, and the sums since counting began.
create or replace function public.admin_visits()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'since', (select min(day) from public.visit_days),
    'views', (select coalesce(sum(views), 0) from public.visit_days),
    'newcomers', (select coalesce(sum(newcomers), 0) from public.visit_days),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'visitors', visitors, 'newcomers', newcomers)
                       order by day desc)
      from public.visit_days
      where day > (now() at time zone 'utc')::date - 30
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on table public.visit_days from public, anon, authenticated;
revoke all on function public.count_visit(boolean, boolean) from public;
grant execute on function public.count_visit(boolean, boolean) to anon, authenticated;
revoke all on function public.admin_visits() from public, anon, authenticated;
grant execute on function public.admin_visits() to authenticated;
