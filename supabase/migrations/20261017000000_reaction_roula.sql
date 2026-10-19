-- Nouvelle réaction rapide de base, libre pour tous : « Roula libré » (rangée après « Je l'avais dit »).
insert into public.items (id, slot, value, name, rarity, default_owned, how, source, price, chest_pool, sort, meta) values
  ('reaction:roula', 'reaction', 'roula', 'Roula libré', 'c', true, null, 'base', null, false, 85, null)
on conflict (id) do nothing;
