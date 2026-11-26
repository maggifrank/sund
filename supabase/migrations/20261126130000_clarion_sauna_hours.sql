-- Corrects the sauna hours at Clarion Hotel Copenhagen Airport, which
-- 20261126120000 gave as the pool's (06:00–22:00). The sauna closes in the
-- middle of the day: 06:00–12:00 and 16:00–22:00, per Magnús on 2026-11-26.
-- Rewrites only the Gufubað block, so it is safe whether or not the earlier
-- migration ran in the same sitting.
update public.pool_info
set info = jsonb_set(info, '{hours}', (
  select jsonb_agg(
    case when block ->> 'title' = 'Gufubað' then
      jsonb_build_object(
        'kind', 'other',
        'title', 'Gufubað',
        'season', null,
        'rows', jsonb_build_array(jsonb_build_object(
          'label', 'Alla daga', 'days', jsonb_build_array(0, 1, 2, 3, 4, 5, 6),
          'season', null, 'closed', false,
          'times', jsonb_build_array('06:00–12:00', '16:00–22:00'), 'extra', null)),
        'notes', jsonb_build_array(jsonb_build_object(
          'text', 'Þurrgufubað (sauna) í heilsulind hótelsins. Lokað 12:00–16:00.')))
    else block end
    order by ord)
  from jsonb_array_elements(info -> 'hours') with ordinality as h(block, ord)
))
where pool_id = 'clarion-hotel-copenhagen-airport'
  and jsonb_typeof(info -> 'hours') = 'array';
