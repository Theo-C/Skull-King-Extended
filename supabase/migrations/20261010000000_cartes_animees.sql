-- Cartes animées (D11, docs/cartes-animees/SPEC.md) : rareté Mythique, emplacement « carte » et 6 cartes à gagner au coffre.
-- Posséder une carte suffit pour qu'elle soit animée (pas d'interrupteur) : la table lit qui possède quoi avec cartes_animees().

alter table public.cosmetics drop constraint cosmetics_rarity_check;
alter table public.cosmetics add constraint cosmetics_rarity_check check (rarity in ('c', 'r', 'e', 'l', 'm'));
alter table public.cosmetics drop constraint cosmetics_slot_check;
alter table public.cosmetics add constraint cosmetics_slot_check check (slot in ('hat', 'face', 'neck', 'pet', 'bg', 'frame', 'carte'));

insert into public.cosmetics (id, slot, value, name, rarity, default_owned, how, variant_key, variants, sort, chest_pool) values
  ('carte:kraken',  'carte', 'kraken',  'Le Kraken',          'm', false, 'chest', null, null, 10, true),
  ('carte:sk',      'carte', 'sk',      'Skull King',         'm', false, 'chest', null, null, 20, true),
  ('carte:raie',    'carte', 'raie',    'La Raie Étoilée',    'm', false, 'chest', null, null, 30, true),
  ('carte:baleine', 'carte', 'baleine', 'La Baleine Fantôme', 'm', false, 'chest', null, null, 40, true),
  ('carte:sirene',  'carte', 'sirene',  'Alyra',              'm', false, 'chest', null, null, 50, true),
  ('carte:fosse',   'carte', 'fosse',   'La Fosse des Noyés', 'm', false, 'chest', null, null, 60, true)
on conflict (id) do nothing;

-- Tirage : Commun 61 %, Rare 26 %, Épique 9 %, Légendaire 3 %, Mythique 1 %. Doublon Mythique : 400 pièces.
-- Une Mythique tirée par qui possède déjà les 6 cartes devient une Légendaire. Le reste est inchangé (cosmetics_v2).
create or replace function public.chest_open(p_user uuid, p_seed bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_chests int; v_coins int; v_seed bigint; v_roll numeric; v_rar text; v_id text; v_name text;
  v_slot text; v_value text; v_dup boolean; v_payout int; v_count int;
begin
  insert into public.user_wallet (user_id) values (p_user) on conflict (user_id) do nothing;
  select chests, coins into v_chests, v_coins from public.user_wallet where user_id = p_user for update;
  if coalesce(v_chests, 0) < 1 then return jsonb_build_object('error', 'Pas de coffre à ouvrir.'); end if;
  v_seed := coalesce(p_seed, (extract(epoch from clock_timestamp()) * 1000)::bigint # ('x' || substr(md5(p_user::text), 1, 8))::bit(32)::bigint);
  v_roll := ((v_seed % 10000) + 10000) % 10000 / 10000.0;
  v_rar := case when v_roll < 0.61 then 'c' when v_roll < 0.87 then 'r' when v_roll < 0.96 then 'e' when v_roll < 0.99 then 'l' else 'm' end;
  if v_rar = 'm' and not exists (
    select 1 from public.cosmetics c where c.chest_pool and c.rarity = 'm'
      and not exists (select 1 from public.user_cosmetics u where u.user_id = p_user and u.cosmetic_id = c.id)) then
    v_rar := 'l';
  end if;
  -- Si la rareté tirée est vide, on bascule vers une rareté voisine (m → l → e → r → c)
  select count(*) into v_count from public.cosmetics where chest_pool and rarity = v_rar;
  if v_count = 0 then v_rar := case v_rar when 'm' then 'l' when 'l' then 'e' when 'e' then 'r' when 'c' then 'r' else 'c' end; end if;
  select count(*) into v_count from public.cosmetics where chest_pool and rarity = v_rar;
  if v_count = 0 then
    select rarity into v_rar from public.cosmetics where chest_pool and rarity <> 'm' order by rarity limit 1;
    select count(*) into v_count from public.cosmetics where chest_pool and rarity = v_rar;
  end if;
  if v_count = 0 then return jsonb_build_object('error', 'Coffre vide : prévenez l''équipe.'); end if;
  with pool as (select id, name, slot, value, row_number() over (order by id) as rn from public.cosmetics where chest_pool and rarity = v_rar)
    select id, name, slot, value into v_id, v_name, v_slot, v_value from pool where rn = (((v_seed / 10000) % v_count + v_count) % v_count) + 1;
  update public.user_wallet set chests = chests - 1 where user_id = p_user;
  v_dup := exists (select 1 from public.user_cosmetics where user_id = p_user and cosmetic_id = v_id);
  if v_dup then
    v_payout := case v_rar when 'c' then 30 when 'r' then 80 when 'e' then 140 when 'l' then 200 else 400 end;
    update public.user_wallet set coins = coins + v_payout where user_id = p_user returning coins into v_coins;
    return jsonb_build_object('ok', true, 'cosmetic_id', v_id, 'name', v_name, 'slot', v_slot, 'value', v_value, 'rarity', v_rar,
      'duplicate', true, 'coins_gained', v_payout, 'coins', v_coins, 'chests', v_chests - 1);
  end if;
  insert into public.user_cosmetics (user_id, cosmetic_id, source) values (p_user, v_id, 'chest');
  return jsonb_build_object('ok', true, 'cosmetic_id', v_id, 'name', v_name, 'slot', v_slot, 'value', v_value, 'rarity', v_rar,
    'duplicate', false, 'coins_gained', 0, 'coins', v_coins, 'chests', v_chests - 1);
end $$;
revoke execute on function public.chest_open(uuid, bigint) from public, anon, authenticated;
grant execute on function public.chest_open(uuid, bigint) to service_role;

-- Cartes animées possédées par des joueurs (la table anime les cartes posées par leur propriétaire).
-- Ne révèle que les cartes animées, déjà visibles de tous en partie.
create or replace function public.cartes_animees(p_users uuid[])
returns table (user_id uuid, carte text) language sql stable security definer set search_path = public as $$
  select u.user_id, c.value from public.user_cosmetics u join public.cosmetics c on c.id = u.cosmetic_id
  where c.slot = 'carte' and u.user_id = any(p_users[1:12]);
$$;
revoke execute on function public.cartes_animees(uuid[]) from public, anon;
grant execute on function public.cartes_animees(uuid[]) to authenticated;
