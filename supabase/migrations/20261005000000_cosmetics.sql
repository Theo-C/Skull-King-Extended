-- Avatar composé et garde-robe (docs/ecrans-compte/SPEC.md, section « Avatar composé et garde-robe »).
-- Catalogue d'objets cosmétiques, inventaire par joueur, porte-monnaie et coffres, boutique quotidienne déterministe.
-- Écritures réservées à l'Edge Function (clé service) via les fonctions SQL ci-dessous.

-- ---------- Profils : apparence composée ----------
alter table public.profiles add column look jsonb;
-- La forme attendue est { skin, hair, hc, beard, hat, htc, face, neck, nkc, pet, ptc, bg, frame }.
-- Validée côté serveur (profile.update) : chaque emplacement cosmétique doit pointer sur un objet possédé.

-- ---------- Catalogue d'objets ----------
-- id = slot:value (unicité) ; value null = emplacement vide (« Tête nue », « Sans cadre »…) ; how = source d'obtention.
create table public.cosmetics (
  id text primary key,
  slot text not null check (slot in ('hat', 'face', 'neck', 'pet', 'bg', 'frame')),
  value text,
  name text not null,
  rarity text not null check (rarity in ('c', 'r', 'l')),
  default_owned boolean not null default false,
  how text,                              -- null, 'chest', 'shop', 'achievement:<code>', 'title:<level>', 'leaderboard:top3-month'
  variant_key text,                      -- 'htc', 'nkc', 'ptc' (couleur modifiable au porter)
  variants jsonb,                        -- ex: ["#9e2a22", "#2f5f8a", "#3e8e4e"]
  sort smallint not null default 0
);
create index cosmetics_slot_idx on public.cosmetics(slot, sort);

-- Catalogue (constante CAT de maquettes/Profil.dc.html). Les objets « par défaut » sont libres pour tout le monde.
-- Les chapeaux de titre sont donnés au passage du niveau correspondant (voir chemin « title:<level> »).
insert into public.cosmetics (id, slot, value, name, rarity, default_owned, how, variant_key, variants, sort) values
  ('hat:none', 'hat', null, 'Tête nue', 'c', true, null, null, null, 10),
  ('hat:bandana', 'hat', 'bandana', 'Bandana', 'c', true, null, 'htc', '["#9e2a22","#2f5f8a","#3e8e4e"]'::jsonb, 20),
  ('hat:bandana-violet', 'hat', 'bandana', 'Bandana violet', 'c', false, 'shop', 'htc', '["#5b3a7a"]'::jsonb, 25),
  ('hat:foulard', 'hat', 'foulard', 'Foulard noué', 'c', true, null, 'htc', '["#5b3a7a","#9e2a22","#c9a14a"]'::jsonb, 30),
  ('hat:tricorne', 'hat', 'tricorne', 'Tricorne', 'c', false, 'title:5', 'htc', '["#1d1814","#3a2a1c","#2a3142"]'::jsonb, 40),
  ('hat:plume', 'hat', 'plume', 'Chapeau à plume', 'r', false, 'title:11', null, null, 50),
  ('hat:bicorne', 'hat', 'bicorne', 'Bicorne', 'r', false, 'title:16', null, null, 60),
  ('hat:amiral', 'hat', 'amiral', 'Chapeau d''amiral', 'l', false, 'title:25', null, null, 70),
  ('hat:couronne', 'hat', 'couronne', 'Couronne', 'l', false, 'achievement:captain', null, null, 80),

  ('face:none', 'face', null, 'Rien', 'c', true, null, null, null, 10),
  ('face:cicatrice', 'face', 'cicatrice', 'Cicatrice', 'c', true, null, null, null, 20),
  ('face:lunettes', 'face', 'lunettes', 'Lunettes rondes', 'c', true, null, null, null, 30),
  ('face:khol', 'face', 'khol', 'Khôl', 'c', true, null, null, null, 40),
  ('face:patch', 'face', 'patch', 'Cache-œil', 'r', false, 'chest', null, null, 50),
  ('face:monocle', 'face', 'monocle', 'Monocle de l''armateur', 'r', false, 'chest', null, null, 60),

  ('neck:none', 'neck', null, 'Rien', 'c', true, null, null, null, 10),
  ('neck:foulard', 'neck', 'foulard', 'Foulard', 'c', true, null, 'nkc', '["#9e2a22","#2f5f8a","#c9a14a"]'::jsonb, 20),
  ('neck:jabot', 'neck', 'jabot', 'Jabot de dentelle', 'r', false, 'chest', null, null, 30),
  ('neck:perles', 'neck', 'perles', 'Collier de perles', 'r', false, 'achievement:siren_hunter', null, null, 40),
  ('neck:medaillon', 'neck', 'medaillon', 'Médaillon d''or', 'l', false, 'achievement:silk_thread', null, null, 50),

  ('pet:none', 'pet', null, 'Personne', 'c', true, null, null, null, 10),
  ('pet:mouette', 'pet', 'mouette', 'Mouette', 'c', false, 'chest', null, null, 20),
  ('pet:perroquet', 'pet', 'perroquet', 'Perroquet', 'r', false, 'chest', 'ptc', '["#3e8e4e","#c0392b","#2f6fb0"]'::jsonb, 30),
  ('pet:singe', 'pet', 'singe', 'Singe', 'r', false, 'shop', null, null, 40),
  ('pet:poulpe', 'pet', 'poulpe', 'Poulpe', 'l', false, 'achievement:abyss', null, null, 50),

  ('bg:mer', 'bg', 'mer', 'Haute mer', 'c', true, null, null, null, 10),
  ('bg:nuit', 'bg', 'nuit', 'Nuit étoilée', 'c', true, null, null, null, 20),
  ('bg:taverne', 'bg', 'taverne', 'Taverne', 'c', false, 'chest', null, null, 30),
  ('bg:couchant', 'bg', 'couchant', 'Couchant', 'r', false, 'chest', null, null, 40),
  ('bg:tempete', 'bg', 'tempete', 'Tempête', 'r', false, 'shop', null, null, 50),
  ('bg:or', 'bg', 'or', 'Salle au trésor', 'l', false, 'title:30', null, null, 60),

  ('frame:none', 'frame', null, 'Sans cadre', 'c', true, null, null, null, 10),
  ('frame:corde', 'frame', 'corde', 'Corde', 'c', true, null, null, null, 20),
  ('frame:tentacules', 'frame', 'tentacules', 'Tentacules', 'l', false, 'achievement:kraken_bet', null, null, 30),
  ('frame:or', 'frame', 'or', 'Cadre d''or', 'l', false, 'leaderboard:top3-month', null, null, 40)
on conflict (id) do nothing;

-- ---------- Inventaire par joueur ----------
create table public.user_cosmetics (
  user_id uuid not null references public.profiles(id) on delete cascade,
  cosmetic_id text not null references public.cosmetics(id) on delete cascade,
  obtained_at timestamptz not null default now(),
  source text not null,                  -- 'chest', 'shop', 'title:<level>', 'achievement:<code>', 'leaderboard'
  primary key (user_id, cosmetic_id)
);
create index user_cosmetics_user_idx on public.user_cosmetics(user_id);

-- Porte-monnaie : pièces + coffres non ouverts.
create table public.user_wallet (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  chests integer not null default 0 check (chests >= 0)
);

-- ---------- Boutique : 3 objets déterministes par jour, à partir des objets vendables ----------
-- Pool : cosmetics.how = 'shop'. Si le pool a moins de 3 objets, les mêmes peuvent revenir (le `distinct` serait plus beau,
-- mais tant que le pool compte au moins 3 objets uniques en production c'est bon).
create or replace function public.shop_day(p_day date default (now() at time zone 'utc')::date)
returns table (slot_idx int, cosmetic_id text, price integer) language sql stable security definer set search_path = public as $$
  with pool as (select id, rarity, row_number() over (order by id) as rn, count(*) over () as n from public.cosmetics where how = 'shop'),
       picks as (
         select g.i as slot_idx,
                ((((('x' || substr(md5(p_day::text), 1, 8))::bit(32)::bigint) + g.i::bigint * 1664525) % 2147483647) % greatest((select max(n) from pool), 1)) + 1 as rn
         from generate_series(0, 2) g(i))
       select picks.slot_idx, pool.id, case pool.rarity when 'c' then 60 when 'r' then 120 else 200 end
       from picks join pool on pool.rn = picks.rn
       order by picks.slot_idx;
$$;
grant execute on function public.shop_day(date) to anon, authenticated;

-- Achat : vérifie que l'objet est bien en boutique aujourd'hui, prélève les pièces, ajoute l'objet.
create or replace function public.shop_buy(p_user uuid, p_cosmetic text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_price int; v_coins int;
begin
  select price into v_price from public.shop_day() where cosmetic_id = p_cosmetic limit 1;
  if v_price is null then return jsonb_build_object('error', 'Cet objet n''est pas en boutique aujourd''hui.'); end if;
  insert into public.user_wallet (user_id) values (p_user) on conflict (user_id) do nothing;
  select coins into v_coins from public.user_wallet where user_id = p_user for update;
  if v_coins < v_price then return jsonb_build_object('error', 'Il vous manque des pièces.'); end if;
  if exists (select 1 from public.user_cosmetics where user_id = p_user and cosmetic_id = p_cosmetic)
    then return jsonb_build_object('error', 'Vous possédez déjà cet objet.'); end if;
  update public.user_wallet set coins = coins - v_price where user_id = p_user;
  insert into public.user_cosmetics (user_id, cosmetic_id, source) values (p_user, p_cosmetic, 'shop');
  return jsonb_build_object('ok', true, 'cosmetic_id', p_cosmetic, 'price', v_price);
end $$;
revoke execute on function public.shop_buy(uuid, text) from public, anon, authenticated;
grant execute on function public.shop_buy(uuid, text) to service_role;

-- ---------- Coffre : tirage 70/25/5, doublon → pièces (30/80/200) ----------
-- Pool : cosmetics.how = 'chest' ; si une rareté est absente du pool (par exemple aucun légendaire au catalogue de départ),
-- on bascule sur la rareté voisine la plus proche.
create or replace function public.chest_open(p_user uuid, p_seed bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_chests int; v_seed bigint; v_roll numeric; v_rar text; v_id text; v_name text; v_dup boolean;
  v_payout int; v_count int;
begin
  insert into public.user_wallet (user_id) values (p_user) on conflict (user_id) do nothing;
  select chests into v_chests from public.user_wallet where user_id = p_user for update;
  if coalesce(v_chests, 0) < 1 then return jsonb_build_object('error', 'Pas de coffre à ouvrir.'); end if;
  -- graine : explicite (test) ou dérivée de l'heure + utilisateur
  v_seed := coalesce(p_seed, (extract(epoch from clock_timestamp()) * 1000)::bigint # ('x' || substr(md5(p_user::text), 1, 8))::bit(32)::bigint);
  v_roll := ((v_seed % 10000) + 10000) % 10000 / 10000.0;
  v_rar := case when v_roll < 0.70 then 'c' when v_roll < 0.95 then 'r' else 'l' end;
  -- Tirer un objet de rareté v_rar ; si cette rareté est absente, on bascule sur une rareté voisine (c ↔ r ↔ l)
  select count(*) into v_count from public.cosmetics where how = 'chest' and rarity = v_rar;
  if v_count = 0 then v_rar := case v_rar when 'l' then 'r' when 'c' then 'r' else 'c' end; end if;
  select count(*) into v_count from public.cosmetics where how = 'chest' and rarity = v_rar;
  if v_count = 0 then
    select rarity into v_rar from public.cosmetics where how = 'chest' order by rarity limit 1;
    select count(*) into v_count from public.cosmetics where how = 'chest' and rarity = v_rar;
  end if;
  if v_count = 0 then return jsonb_build_object('error', 'Coffre vide : prévenez l''équipe.'); end if;
  with pool as (select id, name, row_number() over (order by id) as rn from public.cosmetics where how = 'chest' and rarity = v_rar)
    select id, name into v_id, v_name from pool where rn = (((v_seed / 10000) % v_count + v_count) % v_count) + 1;
  -- déduire le coffre
  update public.user_wallet set chests = chests - 1 where user_id = p_user;
  -- doublon → pièces
  v_dup := exists (select 1 from public.user_cosmetics where user_id = p_user and cosmetic_id = v_id);
  if v_dup then
    v_payout := case v_rar when 'c' then 30 when 'r' then 80 else 200 end;
    update public.user_wallet set coins = coins + v_payout where user_id = p_user;
    return jsonb_build_object('ok', true, 'cosmetic_id', v_id, 'name', v_name, 'rarity', v_rar, 'duplicate', true, 'coins', v_payout);
  end if;
  insert into public.user_cosmetics (user_id, cosmetic_id, source) values (p_user, v_id, 'chest');
  return jsonb_build_object('ok', true, 'cosmetic_id', v_id, 'name', v_name, 'rarity', v_rar, 'duplicate', false);
end $$;
revoke execute on function public.chest_open(uuid, bigint) from public, anon, authenticated;
grant execute on function public.chest_open(uuid, bigint) to service_role;

-- ---------- Sécurité ----------
alter table public.cosmetics enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.user_wallet enable row level security;

create policy "catalogue lisible par tous" on public.cosmetics for select to anon, authenticated using (true);
create policy "inventaire lisible par tous" on public.user_cosmetics for select to anon, authenticated using (true);
create policy "porte-monnaie lisible par soi" on public.user_wallet for select to authenticated using (user_id = auth.uid());
-- aucune politique d'écriture : ouvrir un coffre et acheter un objet passe par les fonctions ci-dessus (service_role).

-- ---------- Mise à jour de settle_inputs : expose aussi look, titres déjà déclenchés, pièces/coffres ----------
create or replace function public.settle_inputs(p_users uuid[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(u.id, jsonb_build_object(
    'xp', p.xp,
    'elo', coalesce(s.elo, 100), 'ranked_games', coalesce(s.ranked_games, 0),
    'games', coalesce(s.games, 0), 'wins', coalesce(s.wins, 0),
    'sirens_captured', coalesce(s.sirens_captured, 0), 'zero_bids_made', coalesce(s.zero_bids_made, 0),
    'achievements', coalesce((select jsonb_agg(a.code) from public.user_achievements a where a.user_id = u.id), '[]'::jsonb),
    'cosmetics', coalesce((select jsonb_agg(c.cosmetic_id) from public.user_cosmetics c where c.user_id = u.id), '[]'::jsonb)
  )), '{}'::jsonb)
  from unnest(p_users) as u(id)
  join public.profiles p on p.id = u.id
  left join public.player_stats s on s.user_id = u.id;
$$;

-- ---------- game_settle : ajoute pièces, coffres et objets gagnés ----------
-- Les cosmétiques sont ajoutés en même temps que les résultats (idempotence : conflit (user_id, cosmetic_id) ignoré).
-- payload.wallet = [{ user_id, coins, chests }], payload.cosmetics = [{ user_id, cosmetic_id, source }].
create or replace function public.game_settle(p_game uuid, p_payload jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare r jsonb; n integer; v_end timestamptz;
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

  -- cosmétiques gagnés (titre, haut fait…) : ajoutés une seule fois par joueur
  insert into public.user_cosmetics (user_id, cosmetic_id, source, obtained_at)
    select (x->>'user_id')::uuid, x->>'cosmetic_id', x->>'source', v_end
    from jsonb_array_elements(coalesce(p_payload->'cosmetics', '[]'::jsonb)) x
    on conflict (user_id, cosmetic_id) do nothing;

  -- porte-monnaie : pièces + coffres (une seule fois par règlement grâce à l'insert conditionnel ci-dessus)
  insert into public.user_wallet (user_id, coins, chests)
    select (x->>'user_id')::uuid, (x->>'coins')::integer, (x->>'chests')::integer
    from jsonb_array_elements(coalesce(p_payload->'wallet', '[]'::jsonb)) x
    on conflict (user_id) do update set
      coins = public.user_wallet.coins + excluded.coins,
      chests = public.user_wallet.chests + excluded.chests;

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

-- ---------- profile_update : accepte look ----------
create or replace function public.profile_update(p_user uuid, p jsonb)
returns void language sql security definer set search_path = public as $$
  update public.profiles set
    pseudo = coalesce(p->>'pseudo', pseudo),
    color = coalesce(p->>'color', color),
    avatar_kind = coalesce(p->>'avatar_kind', avatar_kind),
    avatar_art = case when p ? 'avatar_art' then (p->>'avatar_art')::smallint else avatar_art end,
    avatar_url = case when p ? 'avatar_url' then p->>'avatar_url' else avatar_url end,
    look = case when p ? 'look' then p->'look' else look end,
    public_rank = coalesce((p->>'public_rank')::boolean, public_rank),
    notify_turn = coalesce((p->>'notify_turn')::boolean, notify_turn),
    sounds = coalesce((p->>'sounds')::boolean, sounds)
  where id = p_user;
$$;

revoke execute on function public.settle_inputs(uuid[]) from public, anon, authenticated;
revoke execute on function public.game_settle(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.profile_update(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.settle_inputs(uuid[]) to service_role;
grant execute on function public.game_settle(uuid, jsonb) to service_role;
grant execute on function public.profile_update(uuid, jsonb) to service_role;

-- ---------- Historique, détail, classement : ajout de look dans les joueurs renvoyés ----------
create or replace function public.history_page(p_user uuid, p_before timestamptz default null, p_before_id uuid default null,
                                               p_filter text default 'all', p_limit integer default 20)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.finished_at desc, t.id desc), '[]'::jsonb) from (
    select r.game_id as id, g.code, r.place, r.score, r.bids_made, r.rounds, r.players, r.elo_delta, r.elo_after, r.finished_at,
           coalesce((g.options->>'exp')::boolean, false) as ext,
           g.options, (select gp.name from public.game_players gp where gp.game_id = r.game_id and gp.user_id = g.host) as host_name, g.host = p_user as hosted,
           (select coalesce(sum(x.amount), 0) from public.xp_events x where x.game_id = r.game_id and x.user_id = p_user)::integer as xp,
           (select jsonb_agg(jsonb_build_object('name', gp.name, 'bot', gp.bot, 'rank', gp.rank, 'score', gp.final_score, 'user_id', gp.user_id,
                   'color', pr.color, 'avatar_kind', pr.avatar_kind, 'avatar_art', pr.avatar_art, 'avatar_url', pr.avatar_url, 'look', pr.look) order by gp.rank, gp.seat)
              from public.game_players gp left join public.profiles pr on pr.id = gp.user_id where gp.game_id = r.game_id) as seats
    from public.game_results r join public.games g on g.id = r.game_id
    where r.user_id = p_user
      and (p_before is null or (r.finished_at, r.game_id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
      and (p_filter = 'all'
        or (p_filter = 'wins' and r.place = 1)
        or (p_filter = 'ext' and coalesce((g.options->>'exp')::boolean, false))
        or (p_filter = 'base' and not coalesce((g.options->>'exp')::boolean, false)))
    order by r.finished_at desc, r.game_id desc
    limit greatest(1, least(p_limit, 50))
  ) t;
$$;

create or replace function public.history_get(p_user uuid, p_game uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from public.game_players gp where gp.game_id = p_game and gp.user_id = p_user) then null else
    jsonb_build_object(
      'id', g.id, 'code', g.code, 'status', g.status, 'options', g.options, 'created_at', g.created_at, 'finished_at', g.finished_at, 'host', g.host,
      'state', g.state,
      'seats', (select jsonb_agg(jsonb_build_object('seat', gp.seat, 'name', gp.name, 'bot', gp.bot, 'rank', gp.rank, 'score', gp.final_score, 'user_id', gp.user_id,
                 'color', pr.color, 'avatar_kind', pr.avatar_kind, 'avatar_art', pr.avatar_art, 'avatar_url', pr.avatar_url, 'look', pr.look) order by gp.seat)
                from public.game_players gp left join public.profiles pr on pr.id = gp.user_id where gp.game_id = g.id),
      'results', (select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) from public.game_results r where r.game_id = g.id),
      'xp', (select coalesce(jsonb_agg(jsonb_build_object('reason', x.reason, 'amount', x.amount) order by x.id), '[]'::jsonb)
             from public.xp_events x where x.game_id = g.id and x.user_id = p_user))
  end
  from public.games g where g.id = p_game;
$$;
revoke execute on function public.history_page(uuid, timestamptz, uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.history_get(uuid, uuid) from public, anon, authenticated;
grant execute on function public.history_page(uuid, timestamptz, uuid, text, integer) to service_role;
grant execute on function public.history_get(uuid, uuid) to service_role;

-- Classement : ajout de look (apparence composée) à la ligne retournée
drop function if exists public.leaderboard_period(text, text);
create or replace function public.leaderboard_period(scope text default 'all', period text default 'ever')
returns table (rank bigint, user_id uuid, pseudo text, color text, avatar_kind text, avatar_art smallint, avatar_url text, look jsonb, xp integer,
               elo integer, games integer, wins integer, bids_pct integer, best_score integer, delta numeric, me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if scope not in ('friends', 'all') then raise exception 'scope inconnu : %', scope using errcode = '22023'; end if;
  if period not in ('week', 'month', 'ever') then raise exception 'période inconnue : %', period using errcode = '22023'; end if;
  return query
  with pool as (
    select s.*, p.pseudo, p.color, p.avatar_kind, p.avatar_art, p.avatar_url, p.look, p.xp, p.public_rank
    from public.player_stats s join public.profiles p on p.id = s.user_id
    where s.games > 0 and case
      when scope = 'friends' then s.user_id = auth.uid() or exists (
        select 1 from public.game_results a join public.game_results b on b.game_id = a.game_id
        where a.user_id = auth.uid() and b.user_id = s.user_id)
      else s.ranked_games >= 5 and p.public_rank end
  )
  select rank() over (order by pool.elo desc, pool.games desc), pool.user_id, pool.pseudo, pool.color, pool.avatar_kind, pool.avatar_art, pool.avatar_url, pool.look, pool.xp,
         round(pool.elo)::integer, pool.games, pool.wins,
         case when pool.bids_total > 0 then round(100.0 * pool.bids_made / pool.bids_total)::integer end,
         pool.best_score,
         case when period = 'ever' then pool.elo_best else (
           select coalesce(sum(r.elo_delta), 0) from public.game_results r
           where r.user_id = pool.user_id and r.elo_delta is not null
             and r.finished_at >= now() - case when period = 'week' then interval '7 days' else interval '30 days' end) end,
         pool.user_id = auth.uid()
  from pool
  order by 1, pool.pseudo;
end $$;
revoke execute on function public.leaderboard_period(text, text) from public, anon;
grant execute on function public.leaderboard_period(text, text) to authenticated;
