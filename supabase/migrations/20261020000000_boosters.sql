-- D14 · Boosters de cartes et variantes (docs/boosters/SPEC.md). Les variantes sont purement visuelles.
-- Le tirage est fait par la fonction Edge (supabase/functions/_shared/collection.ts, drawBooster) ; booster_apply
-- l'enregistre en une seule transaction : paiement, Numérotées (stock de 100 par carte et par saison), doublons → éclats.

-- ---------- catalogue ----------
create table if not exists public.card_series (
  id text primary key, name text not null, current boolean not null default false, starts_at date not null default current_date
);
insert into public.card_series (id, name, current) values ('S1', 'Les Sept Mers', true) on conflict (id) do nothing;

-- 76 cartes : 20 spéciales et 56 de couleur (1 à 14 × 4). Les 7 (−5), 8 (+5) et 0·14 de l'extension montrent la
-- variante du 7, du 8 ou du 14 de leur couleur. Même liste que CARDS dans collection.ts.
create table if not exists public.card_catalog (
  card_id text primary key, name text not null, family text not null, sort int not null
);
insert into public.card_catalog (card_id, name, family, sort) values
  ('rosie', 'Rosie la douce', 'pir', 1), ('bahij', 'Bendt le Ripate', 'pir', 2), ('rascal', 'Rascal le Flambeur', 'pir', 3),
  ('juanita', 'Juanita Jade', 'pir', 4), ('harry', 'Harry le géant', 'pir', 5), ('mary', 'Marie Thorne', 'pir', 6),
  ('con', 'Con le belliqueux', 'pir', 7), ('tigress', 'Morgane la Louve', 'pir', 8), ('sk', 'Skull King', 'cre', 9),
  ('mermaid0', 'Alyra', 'cre', 10), ('mermaid1', 'Circé', 'cre', 11), ('kraken', 'Le Kraken', 'cre', 12),
  ('whale', 'La Baleine Fantôme', 'cre', 13), ('escape', 'Drapeau blanc', 'cre', 14), ('loot', 'Pacte de Butin', 'cre', 15),
  ('volley', 'Dernière Bordée', 'cre', 16), ('stingray', 'La Raie Étoilée', 'cre', 17), ('plank', 'La Planche', 'cre', 18),
  ('davy', 'La Fosse des Noyés', 'cre', 19), ('wild', 'Le Grand Quinze', 'cre', 20)
on conflict (card_id) do update set name = excluded.name, family = excluded.family, sort = excluded.sort;
insert into public.card_catalog (card_id, name, family, sort)
  select s.l || r, r || ' ' || s.n, s.f, 20 + s.o * 14 + r
  from (values ('y', 'Trésor', 'yellow', 0), ('g', 'Perroquet', 'green', 1), ('p', 'Méduse', 'purple', 2), ('b', 'Pavillon noir', 'black', 3)) s(l, n, f, o),
       generate_series(1, 14) r
on conflict (card_id) do update set name = excluded.name, family = excluded.family, sort = excluded.sort;

create table if not exists public.card_variants (
  card_id text not null references public.card_catalog(card_id), variant text not null, series_id text not null references public.card_series(id),
  primary key (card_id, variant)
);
insert into public.card_variants (card_id, variant, series_id)
  select c.card_id, v, 'S1' from public.card_catalog c, unnest(array['patine','etain','holo','vivante','nacre','signee','numero']) v
on conflict do nothing;

-- ---------- possession ----------
create table if not exists public.user_card_variants (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references public.card_catalog(card_id),
  variant text not null check (variant in ('patine','etain','holo','vivante','nacre','signee','numero')),
  copies int not null default 1 check (copies >= 1),
  serial int check (serial between 1 and 100),
  source text not null default 'booster',
  obtained_at timestamptz not null default now(),
  primary key (user_id, card_id, variant)
);
-- variante jouée par carte ; sans ligne = Standard
create table if not exists public.user_card_choice (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references public.card_catalog(card_id),
  variant text not null check (variant in ('patine','etain','holo','vivante','nacre','signee','numero')),
  primary key (user_id, card_id)
);
-- Numérotées : 100 exemplaires par carte et par saison, numéros attribués dans l'ordre
create table if not exists public.numbered_stock (
  series_id text not null references public.card_series(id), card_id text not null references public.card_catalog(card_id),
  next_serial int not null default 1 check (next_serial between 1 and 101),
  primary key (series_id, card_id)
);

alter table public.user_wallet add column if not exists boosters int not null default 0 check (boosters >= 0);
alter table public.user_wallet add column if not exists shards int not null default 0 check (shards >= 0);
alter table public.user_wallet add column if not exists free_booster_at date;

-- journal des éclats (gains et dépenses) et des ouvertures, pour l'historique et l'anti-abus
create table if not exists public.shard_events (
  id bigserial primary key, user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null, reason text not null, ref jsonb, created_at timestamptz not null default now()
);
create table if not exists public.booster_opens (
  id bigserial primary key, user_id uuid not null references auth.users(id) on delete cascade,
  pack text not null, divine boolean not null default false, paid text not null, cards jsonb, created_at timestamptz not null default now()
);
-- Signées, Numérotées et boosters divins : annoncés aux amis (accueil) et dans le salon
create table if not exists public.card_announcements (
  id bigserial primary key, user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('signee','numero','divine')), card_id text, serial int, created_at timestamptz not null default now()
);
create index if not exists card_announcements_recent on public.card_announcements (created_at desc);

-- RLS : lecture de ses propres lignes (catalogue et stock : tout le monde) ; écriture uniquement par les fonctions ci-dessous
alter table public.card_series enable row level security;
alter table public.card_catalog enable row level security;
alter table public.card_variants enable row level security;
alter table public.numbered_stock enable row level security;
alter table public.user_card_variants enable row level security;
alter table public.user_card_choice enable row level security;
alter table public.shard_events enable row level security;
alter table public.booster_opens enable row level security;
alter table public.card_announcements enable row level security;
drop policy if exists card_series_read on public.card_series;
create policy card_series_read on public.card_series for select using (true);
drop policy if exists card_catalog_read on public.card_catalog;
create policy card_catalog_read on public.card_catalog for select using (true);
drop policy if exists card_variants_read on public.card_variants;
create policy card_variants_read on public.card_variants for select using (true);
drop policy if exists numbered_stock_read on public.numbered_stock;
create policy numbered_stock_read on public.numbered_stock for select using (true);
drop policy if exists ucv_own on public.user_card_variants;
create policy ucv_own on public.user_card_variants for select using (user_id = auth.uid());
drop policy if exists ucc_own on public.user_card_choice;
create policy ucc_own on public.user_card_choice for select using (user_id = auth.uid());
drop policy if exists shard_events_own on public.shard_events;
create policy shard_events_own on public.shard_events for select using (user_id = auth.uid());
drop policy if exists booster_opens_own on public.booster_opens;
create policy booster_opens_own on public.booster_opens for select using (user_id = auth.uid());
drop policy if exists announcements_own on public.card_announcements;
create policy announcements_own on public.card_announcements for select using (user_id = auth.uid());

-- booster gratuit chaque jour où l'on joue (après la première partie terminée de la journée, heure de Paris)
insert into public.app_settings (key, value) values ('free_daily_booster', 'true') on conflict (key) do nothing;

-- ---------- éclats d'un doublon recyclé (5 / 20 / 60 / 200 ; Numérotée : 0) ----------
create or replace function public.shard_value(p_variant text) returns int language sql immutable as $$
  select case p_variant when 'patine' then 5 when 'etain' then 5 when 'holo' then 20 when 'nacre' then 60 when 'vivante' then 60 when 'signee' then 200 else 0 end
$$;

-- ---------- ouverture d'un booster ----------
-- p_cards : [{card_id, variant}] × 5 tirés par drawBooster. Paie avec un booster en réserve (victoire, booster du jour)
-- ou 50 pièces. Une Numérotée n'est donnée que s'il reste des exemplaires et que le joueur n'a pas déjà celle de cette
-- carte (une Numérotée n'est jamais un doublon) ; sinon elle devient une Signée. Un doublon est recyclé tout de suite.
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
          where series_id = v_series and card_id = v_card and next_serial <= 100 returning next_serial - 1 into v_serial;
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

-- ---------- collection : état, variante jouée ----------
create or replace function public.collection_state(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'owned', coalesce((select jsonb_agg(jsonb_build_object('card_id', card_id, 'variant', variant, 'copies', copies, 'serial', serial) order by card_id, variant)
                       from public.user_card_variants where user_id = p_user), '[]'::jsonb),
    'choices', coalesce((select jsonb_object_agg(card_id, variant) from public.user_card_choice where user_id = p_user), '{}'::jsonb),
    'total', (select count(*) from public.card_variants),
    'coins', coalesce(w.coins, 0), 'shards', coalesce(w.shards, 0), 'boosters', coalesce(w.boosters, 0),
    'free_today', coalesce(w.free_booster_at = (now() at time zone 'Europe/Paris')::date, false),
    'free_daily', coalesce((select value = 'true'::jsonb from public.app_settings where key = 'free_daily_booster'), true))
  from (select 1) one left join public.user_wallet w on w.user_id = p_user
$$;

create or replace function public.collection_choose(p_user uuid, p_card text, p_variant text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.card_catalog where card_id = p_card) then return jsonb_build_object('error', 'Carte inconnue.'); end if;
  if p_variant = 'std' then delete from public.user_card_choice where user_id = p_user and card_id = p_card;
  elsif not exists (select 1 from public.user_card_variants where user_id = p_user and card_id = p_card and variant = p_variant) then
    return jsonb_build_object('error', 'Vous ne possédez pas cette variante.');
  else
    insert into public.user_card_choice (user_id, card_id, variant) values (p_user, p_card, p_variant)
      on conflict (user_id, card_id) do update set variant = excluded.variant;
  end if;
  return jsonb_build_object('ok', true, 'card_id', p_card, 'variant', p_variant);
end $$;

-- variantes jouées par les joueurs d'une table (visibles de tous quand la carte est posée)
create or replace function public.card_choices(p_users uuid[])
returns table (user_id uuid, card_id text, variant text, serial int) language sql stable security definer set search_path = public as $$
  select c.user_id, c.card_id, c.variant, v.serial from public.user_card_choice c
  join public.user_card_variants v on v.user_id = c.user_id and v.card_id = c.card_id and v.variant = c.variant
  where c.user_id = any(p_users)
$$;

-- fil des belles prises de ses amis (joueurs avec qui on a partagé une partie, soi compris), 14 derniers jours
create or replace function public.card_announcements_feed(p_limit int default 20)
returns table (id bigint, user_id uuid, pseudo text, kind text, card_id text, card_name text, serial int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.user_id, p.pseudo, a.kind, a.card_id, c.name, a.serial, a.created_at
  from public.card_announcements a join public.profiles p on p.id = a.user_id left join public.card_catalog c on c.card_id = a.card_id
  where a.created_at > now() - interval '14 days' and (a.user_id = auth.uid() or exists (
    select 1 from public.game_players x join public.game_players y on y.game_id = x.game_id where x.user_id = auth.uid() and y.user_id = a.user_id))
  order by a.created_at desc limit least(coalesce(p_limit, 20), 50)
$$;

revoke execute on function public.booster_apply(uuid, text, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.collection_state(uuid) from public, anon, authenticated;
revoke execute on function public.collection_choose(uuid, text, text) from public, anon, authenticated;
grant execute on function public.booster_apply(uuid, text, boolean, jsonb) to service_role;
grant execute on function public.collection_state(uuid) to service_role;
grant execute on function public.collection_choose(uuid, text, text) to service_role;
revoke execute on function public.card_choices(uuid[]) from public, anon;
grant execute on function public.card_choices(uuid[]) to authenticated, service_role;
revoke execute on function public.card_announcements_feed(int) from public, anon;
grant execute on function public.card_announcements_feed(int) to authenticated;

-- ---------- coffres : personnalisation du profil seulement (décision du 28 octobre 2026) ----------
-- Plus de carte animée Mythique au coffre ; Commun 62 %, Rare 26 %, Épique 9 %, Légendaire 3 %. Coffre 50, 3 coffres 135.
update public.items set chest_pool = false where slot = 'card_anim';
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
  -- si la rareté tirée est vide, on bascule vers une rareté voisine (l → e → r → c)
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

create or replace function public.shop_purchase(p_user uuid, p_what text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_coins int; v_price int; v_item public.items; v_week public.weekly_shop;
begin
  insert into public.user_wallet (user_id) values (p_user) on conflict (user_id) do nothing;
  select coins into v_coins from public.user_wallet where user_id = p_user for update;
  if p_what in ('chest', 'chest3', 'joker') then
    v_price := case p_what when 'chest' then 50 when 'chest3' then 135 else 150 end;
    if v_coins < v_price then return jsonb_build_object('error', 'Il vous manque des pièces.'); end if;
    update public.user_wallet set coins = coins - v_price,
      chests = chests + case p_what when 'chest' then 1 when 'chest3' then 3 else 0 end,
      jokers = jokers + case p_what when 'joker' then 1 else 0 end
    where user_id = p_user;
  else
    select * into v_item from public.items where id = p_what;
    if not found then return jsonb_build_object('error', 'Objet inconnu.'); end if;
    v_week := public.shop_week();
    if not (p_what = any(v_week.item_ids)) or v_item.price is null then return jsonb_build_object('error', 'Cet objet n''est pas à l''échoppe cette semaine.'); end if;
    if exists (select 1 from public.user_items where user_id = p_user and item_id = p_what) then return jsonb_build_object('error', 'Vous possédez déjà cet objet.'); end if;
    v_price := v_item.price;
    if v_coins < v_price then return jsonb_build_object('error', 'Il vous manque des pièces.'); end if;
    update public.user_wallet set coins = coins - v_price where user_id = p_user;
    insert into public.user_items (user_id, item_id, source) values (p_user, p_what, 'shop');
  end if;
  return (select jsonb_build_object('ok', true, 'what', p_what, 'price', v_price, 'coins', coins, 'chests', chests, 'jokers', jokers)
          from public.user_wallet where user_id = p_user);
end $$;
revoke execute on function public.shop_purchase(uuid, text) from public, anon, authenticated;
grant execute on function public.shop_purchase(uuid, text) to service_role;

-- ---------- règlement de partie : booster de victoire et booster du jour ----------
-- Comme 20261005000000_cosmetics.sql, plus : wallet[].boosters (1 au vainqueur humain, au lieu du coffre) et
-- wallet[].daily (partie qui rapporte : booster gratuit si le joueur n'en a pas encore eu aujourd'hui).
create or replace function public.game_settle(p_game uuid, p_payload jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare r jsonb; n integer; v_end timestamptz; v_today date := (now() at time zone 'Europe/Paris')::date;
begin
  if exists (select 1 from public.game_results where game_id = p_game) then return 'already'; end if;
  insert into public.player_stats (user_id)
    select u from (select distinct (x->>'user_id')::uuid as u from jsonb_array_elements(p_payload->'results') x) t order by u
    on conflict (user_id) do nothing;
  perform 1 from public.player_stats s
    where s.user_id in (select (x->>'user_id')::uuid from jsonb_array_elements(p_payload->'results') x)
    order by s.user_id for update;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'results') x
    join public.player_stats s on s.user_id = (x->>'user_id')::uuid
    where s.elo <> (x->>'elo_before')::numeric
       or (x ? 'ranked_before' and s.ranked_games <> (x->>'ranked_before')::integer)
       or (x ? 'games_before' and s.games <> (x->>'games_before')::integer)
  ) then return 'conflict'; end if;

  select coalesce(finished_at, now()) into v_end from public.games where id = p_game;
  insert into public.game_results (game_id, user_id, place, score, bids_made, rounds, players, elo_before, elo_after, elo_delta, finished_at)
    select p_game, (x->>'user_id')::uuid, (x->>'place')::smallint, (x->>'score')::integer, (x->>'bids_made')::smallint,
           (x->>'rounds')::smallint, (x->>'players')::smallint, (x->>'elo_before')::numeric, (x->>'elo_after')::numeric,
           (x->>'elo_delta')::numeric, v_end
    from jsonb_array_elements(p_payload->'results') x
    on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return 'already'; end if;

  with ins as (
    insert into public.xp_events (user_id, game_id, reason, amount)
      select (x->>'user_id')::uuid, p_game, x->>'reason', (x->>'amount')::integer from jsonb_array_elements(p_payload->'xp') x
      on conflict (game_id, user_id, reason) do nothing
      returning user_id, amount
  )
  update public.profiles p set xp = p.xp + t.total
    from (select user_id, sum(amount)::integer as total from ins group by user_id) t where p.id = t.user_id;

  insert into public.user_achievements (user_id, code, game_id, unlocked_at)
    select (x->>'user_id')::uuid, x->>'code', p_game, v_end from jsonb_array_elements(p_payload->'achievements') x
    on conflict (user_id, code) do nothing;

  insert into public.user_cosmetics (user_id, cosmetic_id, source, obtained_at)
    select (x->>'user_id')::uuid, x->>'cosmetic_id', x->>'source', v_end
    from jsonb_array_elements(coalesce(p_payload->'cosmetics', '[]'::jsonb)) x
    on conflict (user_id, cosmetic_id) do nothing;

  -- porte-monnaie : pièces, coffres (niveaux) et boosters (victoire), une seule fois par règlement
  insert into public.user_wallet (user_id, coins, chests, boosters)
    select (x->>'user_id')::uuid, (x->>'coins')::integer, (x->>'chests')::integer, coalesce((x->>'boosters')::integer, 0)
    from jsonb_array_elements(coalesce(p_payload->'wallet', '[]'::jsonb)) x
    on conflict (user_id) do update set
      coins = public.user_wallet.coins + excluded.coins,
      chests = public.user_wallet.chests + excluded.chests,
      boosters = public.user_wallet.boosters + excluded.boosters;
  -- booster gratuit du jour : après la première partie terminée de la journée (heure de Paris)
  if coalesce((select value from public.app_settings where key = 'free_daily_booster'), 'true'::jsonb) = 'true'::jsonb then
    update public.user_wallet set boosters = boosters + 1, free_booster_at = v_today
    where user_id in (select (x->>'user_id')::uuid from jsonb_array_elements(coalesce(p_payload->'wallet', '[]'::jsonb)) x where coalesce((x->>'daily')::boolean, false))
      and (free_booster_at is null or free_booster_at < v_today);
  end if;

  for r in select * from jsonb_array_elements(p_payload->'stats') loop
    update public.player_stats s set
      games = s.games + 1,
      wins = s.wins + (r->>'win')::integer,
      bids_made = s.bids_made + (r->>'bids_made')::integer,
      bids_total = s.bids_total + (r->>'bids_total')::integer,
      best_score = greatest(coalesce(s.best_score, (r->>'score')::integer), (r->>'score')::integer),
      sirens_captured = s.sirens_captured + (r->>'sirens')::integer,
      zero_bids_made = s.zero_bids_made + (r->>'zero_bids_made')::integer,
      elo = case when (r->>'ranked')::boolean then (r->>'elo_after')::numeric else s.elo end,
      elo_best = case when (r->>'ranked')::boolean then greatest(s.elo_best, (r->>'elo_after')::numeric) else s.elo_best end,
      ranked_games = s.ranked_games + case when (r->>'ranked')::boolean then 1 else 0 end
    where s.user_id = (r->>'user_id')::uuid;
  end loop;

  update public.games set state = jsonb_set(coalesce(state, '{}'::jsonb), '{settled}', p_payload->'public') where id = p_game;
  return 'ok';
end $$;
revoke execute on function public.game_settle(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.game_settle(uuid, jsonb) to service_role;
