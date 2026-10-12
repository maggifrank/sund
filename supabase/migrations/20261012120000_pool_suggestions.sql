-- The pool suggestion queue, switched on.
--
-- The first migration made the queue (pool_suggestions) and the admin's answer
-- to it (resolve_suggestion), but nothing put anything in it: the app makes a
-- private place whenever someone logs a swim at a name that is not on the list,
-- and never offered it. From here every new place is offered as it is made,
-- every place made so far is offered once, and an admin can read the queue with
-- what they need to answer it.

-- Offer each new place to the shared list. Security definer so it can write
-- the suggestion for whoever made the place, however the place was made (the
-- app, an import, by hand).
create or replace function public.suggest_new_place()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pool_suggestions (user_id, place_id)
    values (new.user_id, new.id)
    on conflict (place_id) do nothing;
  return new;
end
$$;

create trigger places_suggest after insert on public.places
  for each row execute function public.suggest_new_place();

insert into public.pool_suggestions (user_id, place_id)
  select user_id, id from public.places
  on conflict (place_id) do nothing;

-- The pending suggestions, oldest first, for the admin page: the place's name
-- and position, who named it and how many swims are logged there, the shared
-- pools it may duplicate, and other pending suggestions that look like the same
-- place (two people who found the same new pool before it was on the list).
-- Admins only; it reads across accounts, which is why it is security definer,
-- and it shows no swim's date or time.
create or replace function public.admin_suggestions()
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
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id,
             'createdAt', s.created_at,
             'username', pr.username,
             'name', pl.name,
             'lat', pl.lat,
             'lon', pl.lon,
             'swims', (select count(*) from public.trips t where t.place_id = pl.id),
             'similar', coalesce((select jsonb_agg(to_jsonb(x))
                                  from public.similar_pools(pl.name, pl.lat, pl.lon) x), '[]'::jsonb),
             'alsoSuggested', coalesce((
               select jsonb_agg(jsonb_build_object('name', o.name, 'username', opr.username) order by os.created_at)
               from public.pool_suggestions os
               join public.places o on o.id = os.place_id
               left join public.profiles opr on opr.user_id = os.user_id
               where os.status = 'pending' and os.id <> s.id
                 and ((pl.lat is not null and o.lat is not null
                       and public.distance_m(pl.lat, pl.lon, o.lat, o.lon) < 250)
                      or extensions.similarity(public.pool_key(o.name), public.pool_key(pl.name)) >= 0.4)
             ), '[]'::jsonb))
           order by s.created_at)
    from public.pool_suggestions s
    join public.places pl on pl.id = s.place_id
    left join public.profiles pr on pr.user_id = s.user_id
    where s.status = 'pending'
  ), '[]'::jsonb);
end
$$;

revoke all on function public.suggest_new_place() from public, anon, authenticated;
revoke all on function public.admin_suggestions() from public, anon, authenticated;
grant execute on function public.admin_suggestions() to authenticated;
