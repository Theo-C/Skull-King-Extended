-- Le Pli des Pirates — schéma initial (projet Supabase dédié)
-- Principe : les joueurs lisent ce qui les concerne via RLS ; toute écriture de partie passe par l'Edge Function « game »
-- (clé service), qui arbitre les règles. Les mains et la pioche ne sont jamais lisibles par les autres joueurs.

-- gen_random_uuid() est natif (Postgres 13+).

-- ---------- Profils ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null check (char_length(pseudo) between 2 and 20),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, pseudo)
  values (new.id, left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'Pirate'), 16) || case when char_length(coalesce(split_part(new.email, '@', 1), '')) < 2 then '-' || substr(new.id::text, 1, 4) else '' end)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Parties ----------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  host uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  options jsonb not null default '{}'::jsonb,
  state jsonb,                         -- vue publique de la table (aucune main)
  version integer not null default 0,  -- verrou optimiste
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index games_host_idx on public.games(host);
create index games_status_idx on public.games(status);

create table public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  seat smallint not null check (seat between 0 and 8),
  user_id uuid references public.profiles(id) on delete set null,
  bot boolean not null default false,
  name text not null default '',
  final_score integer,
  rank smallint,
  joined_at timestamptz not null default now(),
  primary key (game_id, seat),
  unique (game_id, user_id),
  check (not (bot and user_id is not null))
);
create index game_players_user_idx on public.game_players(user_id);

-- État complet (mains, pioche) : lisible uniquement par la clé service.
create table public.game_secrets (
  game_id uuid primary key references public.games(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Main et informations privées de chaque joueur humain.
create table public.hands (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seat smallint not null,
  data jsonb not null,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

-- Événements rejoués par le site pour animer les coups (une ligne par coup ou fin de pli).
create table public.game_events (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  version integer not null,
  idx smallint not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index game_events_game_idx on public.game_events(game_id, id);

-- ---------- Sécurité ----------
create or replace function public.is_member(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.game_players gp where gp.game_id = g and gp.user_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_secrets enable row level security;
alter table public.hands enable row level security;
alter table public.game_events enable row level security;

create policy "profils lisibles par les joueurs connectés" on public.profiles for select to authenticated using (true);
create policy "chacun modifie son pseudo" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "parties visibles par leurs joueurs" on public.games for select to authenticated using (public.is_member(id));
create policy "sièges visibles par les joueurs de la partie" on public.game_players for select to authenticated using (public.is_member(game_id));
create policy "chacun ne voit que sa main" on public.hands for select to authenticated using (user_id = auth.uid());
create policy "événements visibles par les joueurs" on public.game_events for select to authenticated using (public.is_member(game_id));
-- game_secrets : aucune politique, donc inaccessible aux clients.

-- Seul le pseudo est modifiable par l'utilisateur.
revoke update on public.profiles from authenticated;
grant update (pseudo) on public.profiles to authenticated;

-- ---------- Classement ----------
create view public.leaderboard as
  select p.id as user_id, p.pseudo,
         count(*)::int as games,
         count(*) filter (where gp.rank = 1)::int as wins,
         round(avg(gp.final_score))::int as avg_score,
         max(gp.final_score)::int as best_score
  from public.game_players gp
  join public.games g on g.id = gp.game_id and g.status = 'finished'
  join public.profiles p on p.id = gp.user_id
  group by p.id, p.pseudo;
grant select on public.leaderboard to anon, authenticated;

-- ---------- Temps réel ----------
alter table public.games replica identity full;
alter table public.game_players replica identity full;
alter table public.hands replica identity full;
alter publication supabase_realtime add table public.games, public.game_players, public.hands, public.game_events;
