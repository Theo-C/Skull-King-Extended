-- Garde-robe et coffres (docs/ecrans-compte/SPEC.md, « Avatar composé et garde-robe » et « Ouverture de coffre » ; Prompt 3 et Prompt B).
-- Catalogue recopié de supabase/functions/_shared/cosmetics.ts (tests/sql.test.ts vérifie la concordance).
-- Lecture : catalogue et looks publics, objets et porte-monnaie pour soi. Écriture : uniquement par l'Edge Function (fonctions ci-dessous).

-- ---------- Look du personnage ----------
-- {skin, hair, hc, beard, hat, htc, face, neck, nkc, pet, ptc, bg, frame} ; null : initiale (rien choisi). Validé par profile.update.
alter table public.profiles add column look jsonb;

-- ---------- Catalogue ----------
create table public.cosmetics (
  id text primary key,                    -- « slot:valeur »
  slot text not null check (slot in ('hat', 'face', 'neck', 'pet', 'bg', 'frame')),
  value text not null,
  name text not null,
  rarity text not null check (rarity in ('commun', 'rare', 'epique', 'legendaire')),
  source text not null check (source in ('free', 'chest', 'title', 'achievement', 'top3')),
  variants jsonb,                         -- {key, colors[]} : couleurs au choix (toutes données avec l'objet)
  level smallint,                         -- source 'title' : niveau du titre
  achievement text references public.achievements(code),
  sort smallint not null default 0,
  unique (slot, value)
);
insert into public.cosmetics (id, slot, value, name, rarity, source, variants, level, achievement, sort) values
  ('hat:bandana', 'hat', 'bandana', 'Bandana', 'commun', 'chest', '{"key":"htc","colors":["#9e2a22","#2f5f8a","#3e8e4e","#5b3a7a"]}'::jsonb, null, null, 1),
  ('hat:tricorne', 'hat', 'tricorne', 'Tricorne', 'commun', 'title', '{"key":"htc","colors":["#1d1814","#3a2a1c","#2a3142"]}'::jsonb, 5, null, 2),
  ('hat:foulard', 'hat', 'foulard', 'Foulard noué', 'commun', 'chest', '{"key":"htc","colors":["#5b3a7a","#9e2a22","#c9a14a"]}'::jsonb, null, null, 3),
  ('hat:plume', 'hat', 'plume', 'Chapeau à plume', 'epique', 'title', null, 11, null, 4),
  ('hat:bicorne', 'hat', 'bicorne', 'Bicorne', 'rare', 'title', null, 16, null, 5),
  ('hat:amiral', 'hat', 'amiral', 'Chapeau d''amiral', 'legendaire', 'title', null, 25, null, 6),
  ('hat:couronne', 'hat', 'couronne', 'Couronne', 'legendaire', 'achievement', null, null, 'captain', 7),
  ('face:cicatrice', 'face', 'cicatrice', 'Cicatrice', 'commun', 'chest', null, null, null, 8),
  ('face:lunettes', 'face', 'lunettes', 'Lunettes rondes', 'commun', 'chest', null, null, null, 9),
  ('face:khol', 'face', 'khol', 'Khôl', 'commun', 'chest', null, null, null, 10),
  ('face:patch', 'face', 'patch', 'Cache-œil', 'rare', 'chest', null, null, null, 11),
  ('face:monocle', 'face', 'monocle', 'Monocle de l''armateur', 'rare', 'chest', null, null, null, 12),
  ('neck:foulard', 'neck', 'foulard', 'Foulard', 'commun', 'chest', '{"key":"nkc","colors":["#9e2a22","#2f5f8a","#c9a14a"]}'::jsonb, null, null, 13),
  ('neck:jabot', 'neck', 'jabot', 'Jabot de dentelle', 'rare', 'chest', null, null, null, 14),
  ('neck:perles', 'neck', 'perles', 'Perles des sirènes', 'epique', 'achievement', null, null, 'siren_hunter', 15),
  ('neck:medaillon', 'neck', 'medaillon', 'Médaillon d''or', 'legendaire', 'achievement', null, null, 'silk_thread', 16),
  ('pet:mouette', 'pet', 'mouette', 'Mouette', 'commun', 'chest', null, null, null, 17),
  ('pet:perroquet', 'pet', 'perroquet', 'Perroquet', 'rare', 'chest', '{"key":"ptc","colors":["#3e8e4e","#c0392b","#2f6fb0"]}'::jsonb, null, null, 18),
  ('pet:singe', 'pet', 'singe', 'Singe', 'rare', 'chest', null, null, null, 19),
  ('pet:poulpe', 'pet', 'poulpe', 'Poulpe', 'legendaire', 'achievement', null, null, 'abyss', 20),
  ('bg:mer', 'bg', 'mer', 'Haute mer', 'commun', 'free', null, null, null, 21),
  ('bg:nuit', 'bg', 'nuit', 'Nuit étoilée', 'commun', 'chest', null, null, null, 22),
  ('bg:taverne', 'bg', 'taverne', 'Taverne', 'commun', 'chest', null, null, null, 23),
  ('bg:couchant', 'bg', 'couchant', 'Couchant', 'epique', 'chest', null, null, null, 24),
  ('bg:tempete', 'bg', 'tempete', 'Tempête', 'rare', 'chest', null, null, null, 25),
  ('bg:or', 'bg', 'or', 'Salle au trésor', 'legendaire', 'title', null, 30, null, 26),
  ('frame:corde', 'frame', 'corde', 'Corde', 'commun', 'chest', null, null, null, 27),
  ('frame:tentacules', 'frame', 'tentacules', 'Tentacules', 'legendaire', 'achievement', null, null, 'kraken_bet', 28),
  ('frame:or', 'frame', 'or', 'Cadre d''or', 'legendaire', 'top3', null, null, null, 29);

-- ---------- Objets possédés, porte-monnaie, journal des coffres ----------
create table public.user_cosmetics (
  user_id uuid not null references public.profiles(id) on delete cascade,
  cosmetic_id text not null references public.cosmetics(id),
  variant text,
  obtained_at timestamptz not null default now(),
  source text not null,                   -- chest, title, achievement, shop, top3
  primary key (user_id, cosmetic_id)
);
create table public.user_wallet (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  chests integer not null default 0 check (chests >= 0)
);
create table public.chest_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cosmetic_id text not null references public.cosmetics(id),
  duplicate boolean not null,
  coins integer not null default 0,
  created_at timestamptz not null default now()
);
create index chest_log_user_idx on public.chest_log(user_id, created_at desc);

alter table public.cosmetics enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.user_wallet enable row level security;
alter table public.chest_log enable row level security;
create policy "catalogue lisible par tous" on public.cosmetics for select to anon, authenticated using (true);
create policy "chacun voit ses objets" on public.user_cosmetics for select to authenticated using (user_id = auth.uid());
create policy "chacun voit son porte-monnaie" on public.user_wallet for select to authenticated using (user_id = auth.uid());
create policy "chacun voit ses coffres ouverts" on public.chest_log for select to authenticated using (user_id = auth.uid());

-- ---------- Objets déjà mérités (titres et hauts faits obtenus avant la garde-robe) ----------
-- Niveau à partir de l'XP : il faut 125 × L × (L − 1) XP pour atteindre le niveau L.
insert into public.user_cosmetics (user_id, cosmetic_id, source)
  select p.id, c.id, 'title' from public.profiles p
  join public.cosmetics c on c.source = 'title'
  where c.level <= floor((1 + sqrt(1 + p.xp / 31.25)) / 2 + 1e-9)
on conflict do nothing;
insert into public.user_cosmetics (user_id, cosmetic_id, source)
  select a.user_id, c.id, 'achievement' from public.user_achievements a join public.cosmetics c on c.achievement = a.code
on conflict do nothing;

-- ---------- Règlement de fin de partie : + pièces, coffre du gagnant, objets des titres et des hauts faits ----------
-- Même fonction que 20261004000000_account_audit.sql, avec la section « récompenses » (p_payload->'rewards' :
-- [{user_id, coins, chests, items: [cosmetic_id, …]}]), dans la même transaction et donc idempotente avec le reste.
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

  -- récompenses de la garde-robe
  for r in select * from jsonb_array_elements(coalesce(p_payload->'rewards', '[]'::jsonb)) loop
    insert into public.user_wallet (user_id, coins, chests)
      values ((r->>'user_id')::uuid, greatest(0, coalesce((r->>'coins')::integer, 0)), greatest(0, coalesce((r->>'chests')::integer, 0)))
      on conflict (user_id) do update set coins = user_wallet.coins + excluded.coins, chests = user_wallet.chests + excluded.chests;
    insert into public.user_cosmetics (user_id, cosmetic_id, source, obtained_at)
      select (r->>'user_id')::uuid, c.id, c.source, v_end
      from jsonb_array_elements_text(coalesce(r->'items', '[]'::jsonb)) i join public.cosmetics c on c.id = i
      on conflict do nothing;
  end loop;

  update public.games set state = jsonb_set(coalesce(state, '{}'::jsonb), '{settled}', p_payload->'public') where id = p_game;
  return 'ok';
end $$;

-- ---------- Ouverture d'un coffre : un coffre retiré, objet ajouté ou converti en pièces, dans une seule transaction ----------
-- La rareté et le tirage (p_pick dans [0, 1[) sont faits par le serveur (cosmetics.ts : drawRarity, et index dans la liste triée par id).
create or replace function public.chest_open(p_user uuid, p_rarity text, p_pick double precision)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.user_wallet; it public.cosmetics; dup boolean; gain integer := 0; cnt integer;
begin
  select * into w from public.user_wallet where user_id = p_user for update;
  if w is null or w.chests <= 0 then return jsonb_build_object('error', 'no_chest'); end if;
  select count(*) into cnt from public.cosmetics where rarity = p_rarity and source in ('chest', 'title');
  if cnt = 0 then return jsonb_build_object('error', 'empty_pool'); end if;
  select * into it from public.cosmetics where rarity = p_rarity and source in ('chest', 'title')
    order by id collate "C" offset least(cnt - 1, greatest(0, floor(p_pick * cnt)::integer)) limit 1;
  dup := exists (select 1 from public.user_cosmetics where user_id = p_user and cosmetic_id = it.id);
  if dup then gain := case p_rarity when 'commun' then 30 when 'rare' then 80 when 'epique' then 140 else 200 end;
  else insert into public.user_cosmetics (user_id, cosmetic_id, source) values (p_user, it.id, 'chest'); end if;
  update public.user_wallet set chests = chests - 1, coins = coins + gain where user_id = p_user returning * into w;
  insert into public.chest_log (user_id, cosmetic_id, duplicate, coins) values (p_user, it.id, dup, gain);
  return jsonb_build_object('item', jsonb_build_object('id', it.id, 'slot', it.slot, 'value', it.value, 'name', it.name, 'rarity', it.rarity),
    'duplicate', dup, 'coinsGained', gain, 'coins', w.coins, 'chests', w.chests);
end $$;

-- ---------- Échoppe : achat d'un objet (le serveur vérifie qu'il est en vente aujourd'hui et fixe le prix) ----------
create or replace function public.shop_buy(p_user uuid, p_cosmetic text, p_price integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.user_wallet;
begin
  insert into public.user_wallet (user_id) values (p_user) on conflict do nothing;
  select * into w from public.user_wallet where user_id = p_user for update;
  if exists (select 1 from public.user_cosmetics where user_id = p_user and cosmetic_id = p_cosmetic) then return jsonb_build_object('error', 'owned'); end if;
  if w.coins < p_price then return jsonb_build_object('error', 'coins', 'coins', w.coins); end if;
  insert into public.user_cosmetics (user_id, cosmetic_id, source) values (p_user, p_cosmetic, 'shop');
  update public.user_wallet set coins = coins - p_price where user_id = p_user returning * into w;
  return jsonb_build_object('ok', true, 'coins', w.coins);
end $$;

-- Objets d'un joueur (vérification d'un look par profile.update) et état de son porte-monnaie.
create or replace function public.wardrobe_state(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'owned', coalesce((select jsonb_agg(cosmetic_id order by cosmetic_id) from public.user_cosmetics where user_id = p_user), '[]'::jsonb),
    'coins', coalesce((select coins from public.user_wallet where user_id = p_user), 0),
    'chests', coalesce((select chests from public.user_wallet where user_id = p_user), 0));
$$;

-- Mise à jour du profil : ajoute le look (validé par le serveur avant l'appel).
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

-- ---------- Listes avec le look des joueurs (historique, détail, classement) ----------
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
-- le type de retour change (colonne look) : la fonction est recréée
drop function if exists public.leaderboard_period(text, text);
create function public.leaderboard_period(scope text default 'all', period text default 'ever')
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

revoke execute on function public.chest_open(uuid, text, double precision) from public, anon, authenticated;
revoke execute on function public.shop_buy(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.wardrobe_state(uuid) from public, anon, authenticated;
revoke execute on function public.profile_update(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.game_settle(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.history_page(uuid, timestamptz, uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.history_get(uuid, uuid) from public, anon, authenticated;
grant execute on function public.chest_open(uuid, text, double precision) to service_role;
grant execute on function public.shop_buy(uuid, text, integer) to service_role;
grant execute on function public.wardrobe_state(uuid) to service_role;
grant execute on function public.profile_update(uuid, jsonb) to service_role;
grant execute on function public.game_settle(uuid, jsonb) to service_role;
grant execute on function public.history_page(uuid, timestamptz, uuid, text, integer) to service_role;
grant execute on function public.history_get(uuid, uuid) to service_role;
