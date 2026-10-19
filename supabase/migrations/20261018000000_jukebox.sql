-- Juke-box partagé (A19, docs/jukebox/SPEC.md) : file commune de liens YouTube / SoundCloud d'une partie en cours.
-- Le salon de la SPEC est ici la partie (games) : salon et partie sont la même ligne. On ne stocke que la file, le morceau
-- en cours et son heure de départ ; chaque joueur lit le morceau avec le lecteur officiel et se recale sur started_at.
-- Lecture pour les joueurs de la partie (RLS), écriture uniquement par le serveur (actions music.* de la fonction « game »).

create table if not exists public.music_queue (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('youtube', 'soundcloud')),
  media_id text not null,
  title text not null,
  thumb_url text,
  duration_s int not null check (duration_s between 1 and 600),
  position int not null,
  created_at timestamptz not null default now()
);
create index if not exists music_queue_game_idx on public.music_queue(game_id, position);

create table if not exists public.music_state (
  game_id uuid primary key references public.games(id) on delete cascade,
  enabled boolean not null default true,
  current_id uuid references public.music_queue(id) on delete set null,
  started_at timestamptz,
  skip_votes uuid[] not null default '{}',
  /** joueurs dont le lecteur n'arrive pas à lire le morceau en cours (erreurs 101 / 150 de YouTube) */
  reports uuid[] not null default '{}',
  /** juke-box coupé par l'hôte : instant de la coupure, pour reprendre le morceau là où il en était */
  paused_at timestamptz
);

alter table public.music_queue enable row level security;
alter table public.music_state enable row level security;
create policy "file du juke-box visible par les joueurs" on public.music_queue for select to authenticated using (public.is_member(game_id));
create policy "état du juke-box visible par les joueurs" on public.music_state for select to authenticated using (public.is_member(game_id));

alter table public.music_queue replica identity full;
alter table public.music_state replica identity full;
alter publication supabase_realtime add table public.music_queue, public.music_state;

-- État du juke-box d'une partie, créé au besoin et verrouillé pour la transaction en cours.
create or replace function public.music_lock(p_game uuid)
returns public.music_state language plpgsql security definer set search_path = public as $$
declare s public.music_state;
begin
  insert into public.music_state (game_id) values (p_game) on conflict (game_id) do nothing;
  select * into s from public.music_state where game_id = p_game for update;
  return s;
end $$;

-- Passe au morceau suivant si le morceau en cours est toujours p_item (sinon rien : un autre appel l'a déjà fait).
-- Le morceau terminé quitte la file ; file vide : le juke-box s'arrête. Renvoie 'ok' ou 'already'.
create or replace function public.music_advance(p_game uuid, p_item uuid)
returns text language plpgsql security definer set search_path = public as $$
declare s public.music_state; v_next uuid;
begin
  s := public.music_lock(p_game);
  if s.current_id is distinct from p_item then return 'already'; end if;
  select id into v_next from public.music_queue where game_id = p_game and id is distinct from p_item order by position, created_at limit 1;
  -- coupé par l'hôte : le morceau suivant attendra la reprise, à son début (paused_at = started_at)
  update public.music_state set current_id = v_next, started_at = case when v_next is null then null else now() end,
    paused_at = case when v_next is not null and not s.enabled then now() else null end,
    skip_votes = '{}', reports = '{}'
  where game_id = p_game;
  if p_item is not null then delete from public.music_queue where id = p_item; end if;
  return 'ok';
end $$;

-- Ajout d'un morceau (métadonnées déjà vérifiées par le serveur) : juke-box allumé, 3 en attente par joueur, 30 dans la file.
-- File vide : le morceau démarre tout de suite. Renvoie { id, started } ou { error }.
create or replace function public.music_add(p_game uuid, p_user uuid, p_provider text, p_media text, p_title text, p_thumb text, p_duration int,
  p_per_user int, p_max int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.music_state; v_id uuid; v_pos int; v_mine int; v_all int;
begin
  s := public.music_lock(p_game);
  if not s.enabled then return jsonb_build_object('error', 'off'); end if;
  select count(*) into v_all from public.music_queue where game_id = p_game;
  if v_all >= p_max then return jsonb_build_object('error', 'full'); end if;
  select count(*) into v_mine from public.music_queue where game_id = p_game and added_by = p_user and id is distinct from s.current_id;
  if v_mine >= p_per_user then return jsonb_build_object('error', 'quota'); end if;
  select coalesce(max(position), 0) + 1 into v_pos from public.music_queue where game_id = p_game;
  insert into public.music_queue (game_id, added_by, provider, media_id, title, thumb_url, duration_s, position)
    values (p_game, p_user, p_provider, p_media, left(p_title, 200), p_thumb, p_duration, v_pos) returning id into v_id;
  if s.current_id is null then
    update public.music_state set current_id = v_id, started_at = now(), paused_at = null, skip_votes = '{}', reports = '{}' where game_id = p_game;
    return jsonb_build_object('id', v_id, 'started', true);
  end if;
  return jsonb_build_object('id', v_id, 'started', false);
end $$;

-- Retrait d'un morceau en attente (pas celui en cours : il se passe par le vote ou par l'hôte).
create or replace function public.music_remove(p_game uuid, p_user uuid, p_item uuid, p_host boolean)
returns text language plpgsql security definer set search_path = public as $$
declare s public.music_state; v_by uuid;
begin
  s := public.music_lock(p_game);
  select added_by into v_by from public.music_queue where id = p_item and game_id = p_game;
  if v_by is null then return 'missing'; end if;
  if p_item = s.current_id then return 'current'; end if;
  if v_by <> p_user and not p_host then return 'forbidden'; end if;
  delete from public.music_queue where id = p_item;
  return 'ok';
end $$;

-- Vote pour passer le morceau en cours (un second vote du même joueur le retire). Passe à p_need votes.
create or replace function public.music_vote(p_game uuid, p_user uuid, p_item uuid, p_need int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.music_state; n int;
begin
  s := public.music_lock(p_game);
  if s.current_id is null or s.current_id is distinct from p_item then return jsonb_build_object('error', 'stale'); end if;
  if p_user = any(s.skip_votes) then
    update public.music_state set skip_votes = array_remove(skip_votes, p_user) where game_id = p_game returning cardinality(skip_votes) into n;
    return jsonb_build_object('votes', n, 'skipped', false);
  end if;
  update public.music_state set skip_votes = array_append(skip_votes, p_user) where game_id = p_game returning cardinality(skip_votes) into n;
  if n >= p_need then perform public.music_advance(p_game, p_item); return jsonb_build_object('votes', n, 'skipped', true); end if;
  return jsonb_build_object('votes', n, 'skipped', false);
end $$;

-- Fin du morceau constatée par un joueur : passe seulement si le morceau est vraiment fini (heure du serveur, 2 s de marge)
-- et que le juke-box tourne. Idempotent : deux appels pour le même morceau ne font qu'un passage.
create or replace function public.music_next(p_game uuid, p_item uuid)
returns text language plpgsql security definer set search_path = public as $$
declare s public.music_state; v_dur int;
begin
  s := public.music_lock(p_game);
  if s.current_id is distinct from p_item then return 'already'; end if;
  if not s.enabled then return 'off'; end if;
  select duration_s into v_dur from public.music_queue where id = p_item;
  if s.started_at + make_interval(secs => v_dur) > now() + interval '2 seconds' then return 'early'; end if;
  return public.music_advance(p_game, p_item);
end $$;

-- Morceau illisible chez un joueur : passe quand l'hôte et au moins un autre joueur l'ont signalé, ou p_need joueurs.
create or replace function public.music_report(p_game uuid, p_user uuid, p_item uuid, p_host uuid, p_need int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.music_state; r uuid[];
begin
  s := public.music_lock(p_game);
  if s.current_id is null or s.current_id is distinct from p_item then return jsonb_build_object('error', 'stale'); end if;
  r := case when p_user = any(s.reports) then s.reports else array_append(s.reports, p_user) end;
  update public.music_state set reports = r where game_id = p_game;
  if cardinality(r) >= p_need or (p_host = any(r) and cardinality(r) >= 2) then
    perform public.music_advance(p_game, p_item); return jsonb_build_object('reports', cardinality(r), 'skipped', true);
  end if;
  return jsonb_build_object('reports', cardinality(r), 'skipped', false);
end $$;

-- Interrupteur de l'hôte : coupé, la file est gardée et rien ne joue ; rallumé, le morceau reprend là où il était.
create or replace function public.music_toggle(p_game uuid, p_on boolean)
returns text language plpgsql security definer set search_path = public as $$
declare s public.music_state;
begin
  s := public.music_lock(p_game);
  if s.enabled = p_on then return 'ok'; end if;
  if p_on then
    update public.music_state set enabled = true,
      started_at = case when started_at is null then null else now() - (coalesce(paused_at, now()) - started_at) end, paused_at = null
    where game_id = p_game;
  else
    update public.music_state set enabled = false, paused_at = case when current_id is null then null else now() end where game_id = p_game;
  end if;
  return 'ok';
end $$;

do $$ declare f text; begin
  foreach f in array array['music_lock(uuid)', 'music_advance(uuid, uuid)', 'music_add(uuid, uuid, text, text, text, text, int, int, int)',
    'music_remove(uuid, uuid, uuid, boolean)', 'music_vote(uuid, uuid, uuid, int)', 'music_next(uuid, uuid)',
    'music_report(uuid, uuid, uuid, uuid, int)', 'music_toggle(uuid, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
