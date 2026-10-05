-- Échoppe du jour (D5) : 3 objets distincts, dans un ordre qui change chaque jour (avant : 3 tirages avec remise,
-- un même objet pouvait sortir deux fois). Le contenu possible de l'échoppe (objets « shop » du catalogue) ne change pas.
create or replace function public.shop_day(p_day date default (now() at time zone 'utc')::date)
returns table (slot_idx int, cosmetic_id text, price integer) language sql stable security definer set search_path = public as $$
  select (row_number() over (order by md5(p_day::text || c.id)) - 1)::int, c.id,
         case c.rarity when 'c' then 60 when 'r' then 120 else 200 end
  from public.cosmetics c where c.how = 'shop'
  order by md5(p_day::text || c.id)
  limit 3;
$$;
grant execute on function public.shop_day(date) to anon, authenticated;
