-- Écrans du compte : avatar, XP, hauts faits, statistiques, Élo, historique et classement.
-- Même principe que le schéma initial : lecture par RLS, écritures de fin de partie uniquement par l'Edge Function (clé service).

-- ---------- Profils : avatar, couleur, XP, préférences ----------
alter table public.profiles
  add column avatar_kind text not null default 'initial' check (avatar_kind in ('initial', 'art', 'photo')),
  add column avatar_art smallint check (avatar_art between 0 and 7),
  add column avatar_url text,
  add column color text not null default '#d9b25a'
    check (color in ('#d9b25a', '#c8644b', '#7ab874', '#5c9db6', '#a982c4', '#e0954a', '#c9c0ae', '#d77fa1')),
  add column xp integer not null default 0 check (xp >= 0),
  add column public_rank boolean not null default true,
  add column notify_turn boolean not null default true,
  add column sounds boolean not null default true;
-- Ces colonnes passent par l'action « profile.update » du serveur (validation) : seul le pseudo reste modifiable en direct.

-- ---------- Stockage des photos de profil : avatars/{uid}/avatar.webp ----------
-- (bloc conditionnel : le schéma « storage » n'existe que sur Supabase, pas dans les tests locaux)
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
    execute $p$create policy "avatars : lecture publique" on storage.objects for select using (bucket_id = 'avatars')$p$;
    execute $p$create policy "avatars : ajout dans son dossier" on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "avatars : remplacement dans son dossier" on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "avatars : suppression dans son dossier" on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;

-- ---------- XP ----------
create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  reason text not null,          -- game, bids, win, ach:<code>
  amount integer not null,
  created_at timestamptz not null default now(),
  unique (game_id, user_id, reason)
);
create index xp_events_user_idx on public.xp_events(user_id, created_at desc);

-- ---------- Hauts faits ----------
create table public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  sort smallint not null default 0
);
insert into public.achievements (code, name, description, sort) values
  ('first_game', 'Premier abordage', 'Terminer une partie', 1),
  ('perfect', 'Sans fausse note', 'Tenir toutes ses mises sur une partie', 2),
  ('kraken_bet', 'Pari du Kraken', 'Tenir une mise de 0 à la manche 10', 3),
  ('siren_hunter', 'Chasseur de sirènes', 'Capturer 10 sirènes au total', 4),
  ('grand_quinze', 'Grand Quinze', 'Remporter un pli avec le Grand Quinze', 5),
  ('silk_thread', 'Fil-de-Soie', 'Remporter un pli avec la carte imposée par Lise', 6),
  ('captain', 'Capitaine des mers', 'Gagner 10 parties', 7),
  ('abyss', 'Fosse insondable', 'Engloutir un monstre avec la Fosse des Noyés', 8),
  ('mermaid_king', 'La Sirène et le Roi', 'Capturer Barbe-Cendre avec une sirène', 9),
  ('velvet', 'Main de velours', 'Tenir 5 mises à 0 au total', 10)
on conflict (code) do nothing;

create table public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null references public.achievements(code),
  game_id uuid references public.games(id) on delete set null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);

-- ---------- Statistiques cumulées et Élo ----------
create table public.player_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  games integer not null default 0,
  wins integer not null default 0,
  bids_made integer not null default 0,
  bids_total integer not null default 0,
  best_score integer,
  sirens_captured integer not null default 0,
  zero_bids_made integer not null default 0,
  elo numeric(7,2) not null default 100 check (elo >= 0),
  elo_best numeric(7,2) not null default 100,
  ranked_games integer not null default 0
);

-- ---------- Résultats par partie : source de l'historique et du classement ----------
create table public.game_results (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  place smallint not null,
  score integer not null,
  bids_made smallint not null,
  rounds smallint not null,
  players smallint not null,
  elo_before numeric(7,2),
  elo_after numeric(7,2),
  elo_delta numeric(6,2),          -- null : partie non classée (un seul humain)
  finished_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index game_results_user_idx on public.game_results(user_id, finished_at desc);

-- ---------- Sécurité ----------
alter table public.xp_events enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.player_stats enable row level security;
alter table public.game_results enable row level security;

create policy "chacun voit son XP" on public.xp_events for select to authenticated using (user_id = auth.uid());
create policy "hauts faits lisibles par tous" on public.achievements for select to anon, authenticated using (true);
create policy "hauts faits obtenus lisibles par tous" on public.user_achievements for select to anon, authenticated using (true);
create policy "statistiques lisibles par les joueurs connectés" on public.player_stats for select to authenticated using (true);
create policy "résultats visibles par soi et par les joueurs de la partie" on public.game_results for select to authenticated
  using (user_id = auth.uid() or public.is_member(game_id));
-- aucune politique d'écriture : seules les fonctions ci-dessous (clé service) écrivent.

-- ---------- Fonctions réservées au serveur ----------
-- Ce que le calcul de fin de partie doit savoir des joueurs (statistiques, hauts faits déjà obtenus, XP).
create or replace function public.settle_inputs(p_users uuid[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(u.id, jsonb_build_object(
    'xp', p.xp,
    'elo', coalesce(s.elo, 100), 'ranked_games', coalesce(s.ranked_games, 0),
    'games', coalesce(s.games, 0), 'wins', coalesce(s.wins, 0),
    'sirens_captured', coalesce(s.sirens_captured, 0), 'zero_bids_made', coalesce(s.zero_bids_made, 0),
    'achievements', coalesce((select jsonb_agg(a.code) from public.user_achievements a where a.user_id = u.id), '[]'::jsonb)
  )), '{}'::jsonb)
  from unnest(p_users) as u(id)
  join public.profiles p on p.id = u.id
  left join public.player_stats s on s.user_id = u.id;
$$;

-- Écrit le règlement d'une partie, de façon idempotente :
--   'already'  : la partie est déjà réglée (rien n'est refait) ;
--   'conflict' : l'Élo d'un joueur a changé depuis le calcul (une autre partie vient de se terminer) : l'appelant recalcule ;
--   'ok'       : tout est écrit (résultats, XP, hauts faits, statistiques, Élo, résumé public dans games.state.settled).
create or replace function public.game_settle(p_game uuid, p_payload jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare r jsonb; n integer;
begin
  if exists (select 1 from public.game_results where game_id = p_game) then return 'already'; end if;
  -- verrou sur les statistiques des joueurs, puis vérification des Élo de départ
  insert into public.player_stats (user_id)
    select (x->>'user_id')::uuid from jsonb_array_elements(p_payload->'results') x on conflict (user_id) do nothing;
  perform 1 from public.player_stats s
    where s.user_id in (select (x->>'user_id')::uuid from jsonb_array_elements(p_payload->'results') x) for update;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'results') x
    join public.player_stats s on s.user_id = (x->>'user_id')::uuid
    where s.elo <> (x->>'elo_before')::numeric
  ) then return 'conflict'; end if;

  insert into public.game_results (game_id, user_id, place, score, bids_made, rounds, players, elo_before, elo_after, elo_delta, finished_at)
    select p_game, (x->>'user_id')::uuid, (x->>'place')::smallint, (x->>'score')::integer, (x->>'bids_made')::smallint,
           (x->>'rounds')::smallint, (x->>'players')::smallint, (x->>'elo_before')::numeric, (x->>'elo_after')::numeric,
           (x->>'elo_delta')::numeric, now()
    from jsonb_array_elements(p_payload->'results') x
    on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return 'already'; end if;

  -- XP : une ligne par raison, puis cumul sur le profil (uniquement ce qui vient d'être inséré)
  with ins as (
    insert into public.xp_events (user_id, game_id, reason, amount)
      select (x->>'user_id')::uuid, p_game, x->>'reason', (x->>'amount')::integer from jsonb_array_elements(p_payload->'xp') x
      on conflict (game_id, user_id, reason) do nothing
      returning user_id, amount
  )
  update public.profiles p set xp = p.xp + t.total
    from (select user_id, sum(amount)::integer as total from ins group by user_id) t where p.id = t.user_id;

  insert into public.user_achievements (user_id, code, game_id)
    select (x->>'user_id')::uuid, x->>'code', p_game from jsonb_array_elements(p_payload->'achievements') x
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

  update public.games set state = jsonb_set(coalesce(state, '{}'::jsonb), '{settled}', p_payload->'public') where id = p_game;
  return 'ok';
end $$;

-- Historique d'un joueur, du plus récent au plus ancien, 20 par page (curseur = date de fin de la dernière ligne reçue).
-- Filtres : all, wins, ext (avec extension), base (règles de base).
create or replace function public.history_list(p_user uuid, p_before timestamptz default null, p_filter text default 'all', p_limit integer default 20)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.finished_at desc), '[]'::jsonb) from (
    select r.game_id as id, g.code, r.place, r.score, r.bids_made, r.rounds, r.players, r.elo_delta, r.elo_after, r.finished_at,
           coalesce((g.options->>'exp')::boolean, false) as ext,
           g.options, (select gp.name from public.game_players gp where gp.game_id = r.game_id and gp.user_id = g.host) as host_name, g.host = p_user as hosted,
           (select coalesce(sum(x.amount), 0) from public.xp_events x where x.game_id = r.game_id and x.user_id = p_user)::integer as xp,
           (select jsonb_agg(jsonb_build_object('name', gp.name, 'bot', gp.bot, 'rank', gp.rank, 'score', gp.final_score, 'user_id', gp.user_id,
                   'color', pr.color, 'avatar_kind', pr.avatar_kind, 'avatar_art', pr.avatar_art, 'avatar_url', pr.avatar_url) order by gp.rank, gp.seat)
              from public.game_players gp left join public.profiles pr on pr.id = gp.user_id where gp.game_id = r.game_id) as seats
    from public.game_results r join public.games g on g.id = r.game_id
    where r.user_id = p_user
      and (p_before is null or r.finished_at < p_before)
      and (p_filter = 'all'
        or (p_filter = 'wins' and r.place = 1)
        or (p_filter = 'ext' and coalesce((g.options->>'exp')::boolean, false))
        or (p_filter = 'base' and not coalesce((g.options->>'exp')::boolean, false)))
    order by r.finished_at desc
    limit greatest(1, least(p_limit, 50))
  ) t;
$$;

-- Détail d'une partie terminée, réservé à ceux qui l'ont jouée (null sinon).
create or replace function public.history_get(p_user uuid, p_game uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from public.game_players gp where gp.game_id = p_game and gp.user_id = p_user) then null else
    jsonb_build_object(
      'id', g.id, 'code', g.code, 'status', g.status, 'options', g.options, 'finished_at', g.finished_at, 'host', g.host,
      'state', g.state,
      'seats', (select jsonb_agg(jsonb_build_object('seat', gp.seat, 'name', gp.name, 'bot', gp.bot, 'rank', gp.rank, 'score', gp.final_score, 'user_id', gp.user_id,
                 'color', pr.color, 'avatar_kind', pr.avatar_kind, 'avatar_art', pr.avatar_art, 'avatar_url', pr.avatar_url) order by gp.seat)
                from public.game_players gp left join public.profiles pr on pr.id = gp.user_id where gp.game_id = g.id),
      'results', (select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) from public.game_results r where r.game_id = g.id),
      'xp', (select coalesce(jsonb_agg(jsonb_build_object('reason', x.reason, 'amount', x.amount) order by x.id), '[]'::jsonb)
             from public.xp_events x where x.game_id = g.id and x.user_id = p_user))
  end
  from public.games g where g.id = p_game;
$$;

-- Mise à jour du profil, après validation par le serveur.
create or replace function public.profile_update(p_user uuid, p jsonb)
returns void language sql security definer set search_path = public as $$
  update public.profiles set
    pseudo = coalesce(p->>'pseudo', pseudo),
    color = coalesce(p->>'color', color),
    avatar_kind = coalesce(p->>'avatar_kind', avatar_kind),
    avatar_art = case when p ? 'avatar_art' then (p->>'avatar_art')::smallint else avatar_art end,
    avatar_url = case when p ? 'avatar_url' then p->>'avatar_url' else avatar_url end,
    public_rank = coalesce((p->>'public_rank')::boolean, public_rank),
    notify_turn = coalesce((p->>'notify_turn')::boolean, notify_turn),
    sounds = coalesce((p->>'sounds')::boolean, sounds)
  where id = p_user;
$$;

revoke execute on function public.settle_inputs(uuid[]) from public, anon, authenticated;
revoke execute on function public.game_settle(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.history_list(uuid, timestamptz, text, integer) from public, anon, authenticated;
revoke execute on function public.history_get(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.profile_update(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.settle_inputs(uuid[]) to service_role;
grant execute on function public.game_settle(uuid, jsonb) to service_role;
grant execute on function public.history_list(uuid, timestamptz, text, integer) to service_role;
grant execute on function public.history_get(uuid, uuid) to service_role;
grant execute on function public.profile_update(uuid, jsonb) to service_role;

-- ---------- Classement par Élo ----------
-- scope : 'friends' (joueurs ayant partagé une partie avec moi, moi compris) ou 'all' (5 parties classées minimum, profil public).
-- period : 'week', 'month' ou 'ever' : ne change pas le tri, seulement la dernière colonne (variation d'Élo, ou record pour 'ever').
create or replace function public.leaderboard_period(scope text default 'all', period text default 'ever')
returns table (rank bigint, user_id uuid, pseudo text, color text, avatar_kind text, avatar_art smallint, avatar_url text, xp integer,
               elo integer, games integer, wins integer, bids_pct integer, best_score integer, delta numeric, me boolean)
language sql stable security definer set search_path = public as $$
  with pool as (
    select s.*, p.pseudo, p.color, p.avatar_kind, p.avatar_art, p.avatar_url, p.xp, p.public_rank
    from public.player_stats s join public.profiles p on p.id = s.user_id
    where s.games > 0 and case
      when scope = 'friends' then s.user_id = auth.uid() or exists (
        select 1 from public.game_players a join public.game_players b on b.game_id = a.game_id
        where a.user_id = auth.uid() and b.user_id = s.user_id)
      else s.ranked_games >= 5 and p.public_rank end
  )
  select rank() over (order by pool.elo desc, pool.games desc), pool.user_id, pool.pseudo, pool.color, pool.avatar_kind, pool.avatar_art, pool.avatar_url, pool.xp,
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
$$;
grant execute on function public.leaderboard_period(text, text) to authenticated;
