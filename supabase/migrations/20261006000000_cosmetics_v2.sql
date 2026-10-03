-- Avatar composé v2 (prompt B de docs/cartes-v3/PROMPT-claude-code.md) :
--   - 4 niveaux de rareté : c (Commun), r (Rare), e (Épique), l (Légendaire) ;
--   - probabilités du coffre : 62 / 26 / 9 / 3 % (au lieu de 70 / 25 / 5 %) ;
--   - barème du doublon : 30 / 80 / 140 / 200 pièces ;
--   - colonne chest_pool indépendante de « how » : certains objets (perles, poulpe) sont donnés par un haut fait
--     et restent tirables au coffre ; les objets de titre (tricorne, plume, bicorne, amiral) ne le sont pas.

alter table public.cosmetics drop constraint cosmetics_rarity_check;
alter table public.cosmetics add constraint cosmetics_rarity_check check (rarity in ('c', 'r', 'e', 'l'));

alter table public.cosmetics add column chest_pool boolean not null default false;
-- Ce qui était explicitement « chest » reste dans la piscine du coffre
update public.cosmetics set chest_pool = true where how = 'chest';
-- Perles et Poulpe (haut fait) deviennent aussi tirables au coffre : la rareté détermine la source
update public.cosmetics set chest_pool = true, rarity = 'e' where id = 'neck:perles';
update public.cosmetics set chest_pool = true where id = 'pet:poulpe';   -- reste légendaire
-- Monocle gardé en rare (correspond à l'exemple de la maquette), on promeut Jabot en épique pour que
-- le pool épique ne dépende pas d'un seul objet lié à un haut fait
update public.cosmetics set rarity = 'e' where id = 'neck:jabot';

-- ---------- Nouvelle version du tirage ----------
-- Probabilités 62/26/9/3, basculement de rareté si le pool est vide, barème doublon 30/80/140/200.
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
  v_rar := case when v_roll < 0.62 then 'c' when v_roll < 0.88 then 'r' when v_roll < 0.97 then 'e' else 'l' end;
  -- Si la rareté tirée est vide, on bascule vers une rareté voisine (l → e → r → c)
  select count(*) into v_count from public.cosmetics where chest_pool and rarity = v_rar;
  if v_count = 0 then v_rar := case v_rar when 'l' then 'e' when 'e' then 'r' when 'c' then 'r' else 'c' end; end if;
  select count(*) into v_count from public.cosmetics where chest_pool and rarity = v_rar;
  if v_count = 0 then
    select rarity into v_rar from public.cosmetics where chest_pool order by rarity limit 1;
    select count(*) into v_count from public.cosmetics where chest_pool and rarity = v_rar;
  end if;
  if v_count = 0 then return jsonb_build_object('error', 'Coffre vide : prévenez l''équipe.'); end if;
  with pool as (select id, name, slot, value, row_number() over (order by id) as rn from public.cosmetics where chest_pool and rarity = v_rar)
    select id, name, slot, value into v_id, v_name, v_slot, v_value from pool where rn = (((v_seed / 10000) % v_count + v_count) % v_count) + 1;
  update public.user_wallet set chests = chests - 1 where user_id = p_user;
  v_dup := exists (select 1 from public.user_cosmetics where user_id = p_user and cosmetic_id = v_id);
  if v_dup then
    v_payout := case v_rar when 'c' then 30 when 'r' then 80 when 'e' then 140 else 200 end;
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
