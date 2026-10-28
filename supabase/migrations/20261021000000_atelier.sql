-- D15 · Atelier (docs/boosters/ATELIER.md) : recycler les doublons en éclats, fabriquer avec les éclats.
-- Prix de base (au hasard) : Commune 20, Holographique 80, Épique 240, Signée 800 ; au choix : ×4.
-- Les Numérotées ne se fabriquent ni ne se recyclent. Chaque opération est une transaction, porte-monnaie verrouillé.

create or replace function public.craft_base(p_variant text) returns int language sql immutable as $$
  select case p_variant when 'patine' then 20 when 'etain' then 20 when 'holo' then 80 when 'nacre' then 240 when 'vivante' then 240 when 'signee' then 800 else null end
$$;

-- p_mode 'random' : p_tier (c, r, e, l) ; tire uniformément parmi les variantes de cette rareté que le joueur n'a pas.
-- p_mode 'pick'   : p_card et p_variant exacts, 4 fois le prix de base, refusé si déjà possédée.
create or replace function public.collection_craft(p_user uuid, p_mode text, p_tier text default null, p_card text default null, p_variant text default null, p_seed bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_shards int; v_cost int; v_card text; v_var text; v_vars text[]; v_n int; v_seed bigint;
begin
  insert into public.user_wallet (user_id) values (p_user) on conflict (user_id) do nothing;
  select shards into v_shards from public.user_wallet where user_id = p_user for update;
  if p_mode = 'random' then
    v_vars := case p_tier when 'c' then array['patine','etain'] when 'r' then array['holo'] when 'e' then array['nacre','vivante'] when 'l' then array['signee'] end;
    if v_vars is null then return jsonb_build_object('error', 'Rareté inconnue.'); end if;
    v_cost := public.craft_base(v_vars[1]);
    select count(*) into v_n from public.card_variants cv
      where cv.variant = any(v_vars) and not exists (select 1 from public.user_card_variants u where u.user_id = p_user and u.card_id = cv.card_id and u.variant = cv.variant);
    if v_n = 0 then return jsonb_build_object('error', 'Toutes les variantes de cette rareté sont déjà à vous.'); end if;
    if v_shards < v_cost then return jsonb_build_object('error', 'Il vous manque des éclats.'); end if;
    v_seed := coalesce(p_seed, floor(random() * 2147483647)::bigint);
    select cv.card_id, cv.variant into v_card, v_var from public.card_variants cv
      where cv.variant = any(v_vars) and not exists (select 1 from public.user_card_variants u where u.user_id = p_user and u.card_id = cv.card_id and u.variant = cv.variant)
      order by cv.card_id, cv.variant offset (v_seed % v_n) limit 1;
  elsif p_mode = 'pick' then
    if p_variant = 'numero' then return jsonb_build_object('error', 'Les Numérotées ne se fabriquent pas.'); end if;
    if not exists (select 1 from public.card_variants where card_id = p_card and variant = p_variant) then return jsonb_build_object('error', 'Variante inconnue.'); end if;
    if exists (select 1 from public.user_card_variants where user_id = p_user and card_id = p_card and variant = p_variant) then
      return jsonb_build_object('error', 'Cette variante est déjà dans votre collection.');
    end if;
    v_card := p_card; v_var := p_variant; v_cost := 4 * public.craft_base(p_variant);
    if v_shards < v_cost then return jsonb_build_object('error', 'Il vous manque des éclats.'); end if;
  else
    return jsonb_build_object('error', 'Mode de fabrication inconnu.');
  end if;
  update public.user_wallet set shards = shards - v_cost where user_id = p_user returning shards into v_shards;
  insert into public.user_card_variants (user_id, card_id, variant, source) values (p_user, v_card, v_var, 'craft');
  insert into public.shard_events (user_id, amount, reason, ref) values (p_user, -v_cost, 'craft_' || p_mode, jsonb_build_object('card_id', v_card, 'variant', v_var));
  return jsonb_build_object('ok', true, 'mode', p_mode, 'card_id', v_card, 'variant', v_var, 'cost', v_cost, 'shards', v_shards,
    'owned', (select count(*) from public.user_card_variants where user_id = p_user));
end $$;

-- Recycle les exemplaires en trop (on garde toujours 1 exemplaire) : une variante, ou tout (p_all).
create or replace function public.collection_recycle(p_user uuid, p_all boolean default false, p_card text default null, p_variant text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_gain int; v_n int; v_shards int;
begin
  insert into public.user_wallet (user_id) values (p_user) on conflict (user_id) do nothing;
  perform 1 from public.user_wallet where user_id = p_user for update;
  select coalesce(sum((copies - 1) * public.shard_value(variant)), 0), coalesce(sum(copies - 1), 0) into v_gain, v_n
    from public.user_card_variants where user_id = p_user and copies > 1 and variant <> 'numero'
      and (p_all or (card_id = p_card and variant = p_variant));
  if v_n = 0 then return jsonb_build_object('error', 'Aucun doublon à recycler.'); end if;
  update public.user_card_variants set copies = 1 where user_id = p_user and copies > 1 and variant <> 'numero'
    and (p_all or (card_id = p_card and variant = p_variant));
  update public.user_wallet set shards = shards + v_gain where user_id = p_user returning shards into v_shards;
  insert into public.shard_events (user_id, amount, reason, ref) values (p_user, v_gain, 'recycle', case when p_all then null else jsonb_build_object('card_id', p_card, 'variant', p_variant) end);
  return jsonb_build_object('ok', true, 'recycled', v_n, 'shards_gained', v_gain, 'shards', v_shards);
end $$;

revoke execute on function public.collection_craft(uuid, text, text, text, text, bigint) from public, anon, authenticated;
revoke execute on function public.collection_recycle(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.collection_craft(uuid, text, text, text, text, bigint) to service_role;
grant execute on function public.collection_recycle(uuid, boolean, text, text) to service_role;
