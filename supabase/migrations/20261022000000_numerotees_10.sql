-- Numérotées : 10 exemplaires par carte et par saison au lieu de 100 (décision du 28 octobre 2026).
-- Toujours jamais un doublon : un joueur qui a déjà la Numérotée de cette carte reçoit une Signée ; chaque numéro
-- n'appartient qu'à un seul joueur ; stock épuisé → Signée. Seul le plafond change (booster_apply reprise à l'identique).
alter table public.numbered_stock drop constraint if exists numbered_stock_next_serial_check;
update public.numbered_stock set next_serial = 11 where next_serial > 11;
alter table public.numbered_stock add constraint numbered_stock_next_serial_check check (next_serial between 1 and 11);

create or replace function public.booster_apply(p_user uuid, p_pack text, p_divine boolean, p_cards jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  w public.user_wallet; v_paid text; c jsonb; v_card text; v_var text; v_serial int; v_dup boolean; v_gain int;
  v_total int := 0; v_new int := 0; v_out jsonb := '[]'::jsonb; v_series text; v_open bigint; v_owned int;
begin
  if p_pack not in ('profondeurs', 'sirenes', 'couronne') then return jsonb_build_object('error', 'Booster inconnu.'); end if;
  if jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) <> 5 then return jsonb_build_object('error', 'Tirage invalide.'); end if;
  insert into public.user_wallet (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into w from public.user_wallet where user_id = p_user for update;
  if w.boosters > 0 then update public.user_wallet set boosters = boosters - 1 where user_id = p_user; v_paid := 'booster';
  elsif w.coins >= 50 then update public.user_wallet set coins = coins - 50 where user_id = p_user; v_paid := 'coins';
  else return jsonb_build_object('error', 'Il vous manque des pièces : un booster coûte 50 pièces.'); end if;
  select id into v_series from public.card_series where current order by starts_at desc limit 1;
  insert into public.booster_opens (user_id, pack, divine, paid) values (p_user, p_pack, coalesce(p_divine, false), v_paid) returning id into v_open;

  for c in select * from jsonb_array_elements(p_cards) loop
    v_card := c->>'card_id'; v_var := c->>'variant'; v_serial := null;
    if not exists (select 1 from public.card_variants where card_id = v_card and variant = v_var) then raise exception 'carte inconnue : % %', v_card, v_var; end if;
    if v_var = 'numero' then
      if exists (select 1 from public.user_card_variants where user_id = p_user and card_id = v_card and variant = 'numero') then v_var := 'signee';
      else
        insert into public.numbered_stock (series_id, card_id) values (v_series, v_card) on conflict do nothing;
        update public.numbered_stock set next_serial = next_serial + 1
          where series_id = v_series and card_id = v_card and next_serial <= 10 returning next_serial - 1 into v_serial;
        if v_serial is null then v_var := 'signee'; end if;
      end if;
    end if;
    v_dup := exists (select 1 from public.user_card_variants where user_id = p_user and card_id = v_card and variant = v_var);
    v_gain := 0;
    if v_dup then v_gain := public.shard_value(v_var); v_total := v_total + v_gain;
    else
      insert into public.user_card_variants (user_id, card_id, variant, serial, source) values (p_user, v_card, v_var, v_serial, 'booster');
      v_new := v_new + 1;
    end if;
    if v_var in ('signee', 'numero') then insert into public.card_announcements (user_id, kind, card_id, serial) values (p_user, v_var, v_card, v_serial); end if;
    v_out := v_out || jsonb_build_object('card_id', v_card, 'variant', v_var, 'serial', v_serial, 'duplicate', v_dup, 'shards', v_gain);
  end loop;

  if v_total > 0 then
    update public.user_wallet set shards = shards + v_total where user_id = p_user;
    insert into public.shard_events (user_id, amount, reason, ref) values (p_user, v_total, 'booster', jsonb_build_object('open', v_open));
  end if;
  if p_divine then insert into public.card_announcements (user_id, kind) values (p_user, 'divine'); end if;
  update public.booster_opens set cards = v_out where id = v_open;
  select count(*) into v_owned from public.user_card_variants where user_id = p_user;
  return (select jsonb_build_object('ok', true, 'pack', p_pack, 'divine', coalesce(p_divine, false), 'cards', v_out, 'paid', v_paid,
    'shards_gained', v_total, 'new', v_new, 'owned', v_owned, 'owned_before', v_owned - v_new, 'total', (select count(*) from public.card_variants),
    'coins', coins, 'boosters', boosters, 'shards', shards) from public.user_wallet where user_id = p_user);
end $$;
