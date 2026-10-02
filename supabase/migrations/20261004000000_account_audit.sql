-- Correctifs issus de l'audit des écrans du compte (docs/ecrans-compte/SPEC.md) : confidentialité, stockage, règlement, historique,
-- classement et revanche. À appliquer après 20261003000000_profiles_xp.sql.

-- ---------- Ancienne vue de classement ----------
-- Elle ignorait public_rank et restait lisible sans connexion ; le site utilise leaderboard_period.
drop view if exists public.leaderboard;

-- ---------- Photos de profil : 5 Mo, WebP (ou JPEG quand le navigateur ne sait pas encoder le WebP), un seul fichier par joueur ----------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/webp', 'image/jpeg'] where id = 'avatars';
    drop policy if exists "avatars : lecture publique" on storage.objects;
    drop policy if exists "avatars : ajout dans son dossier" on storage.objects;
    drop policy if exists "avatars : remplacement dans son dossier" on storage.objects;
    drop policy if exists "avatars : suppression dans son dossier" on storage.objects;
    -- le bucket est public : l'affichage passe par l'URL publique, sans politique de lecture. Celle-ci ne sert qu'au remplacement (upsert)
    -- et ne laisse voir que sa propre photo (plus d'inventaire des dossiers).
    execute $p$create policy "avatars : sa photo" on storage.objects for select to authenticated
      using (bucket_id = 'avatars' and name in (auth.uid()::text || '/avatar.webp', auth.uid()::text || '/avatar.jpg'))$p$;
    execute $p$create policy "avatars : ajout de sa photo" on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and name in (auth.uid()::text || '/avatar.webp', auth.uid()::text || '/avatar.jpg'))$p$;
    execute $p$create policy "avatars : remplacement de sa photo" on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and name in (auth.uid()::text || '/avatar.webp', auth.uid()::text || '/avatar.jpg'))
      with check (bucket_id = 'avatars' and name in (auth.uid()::text || '/avatar.webp', auth.uid()::text || '/avatar.jpg'))$p$;
    execute $p$create policy "avatars : suppression de sa photo" on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and name in (auth.uid()::text || '/avatar.webp', auth.uid()::text || '/avatar.jpg'))$p$;
  end if;
end $$;

-- ---------- Hauts faits : Fil-de-Soie revient à celui qui impose la carte avec Lise (maquette Profil) ----------
update public.achievements set description = 'Imposer avec Lise une carte qui remporte le pli' where code = 'silk_thread';

-- ---------- Règlement de fin de partie ----------
-- Verrous pris dans l'ordre des joueurs (pas d'interblocage entre deux parties qui finissent ensemble), conflit détecté aussi sur
-- le nombre de parties (hauts faits cumulés, K de l'Élo), date de fin = celle de la partie, même si le règlement est refait plus tard.
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

  update public.games set state = jsonb_set(coalesce(state, '{}'::jsonb), '{settled}', p_payload->'public') where id = p_game;
  return 'ok';
end $$;

-- Parties terminées d'un joueur dont le règlement a échoué : le serveur les refait avant de lister l'historique.
create or replace function public.unsettled_games(p_user uuid)
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from (
    select g.id from public.games g join public.game_players gp on gp.game_id = g.id and gp.user_id = p_user
    where g.status = 'finished' and not exists (select 1 from public.game_results r where r.game_id = g.id)
    order by g.finished_at desc limit 3) t;
$$;

-- ---------- Historique : curseur (date de fin, partie), sans saut quand deux parties finissent au même instant ----------
-- Nouvelle fonction (history_list reste en place pour la version précédente du serveur, le temps du déploiement).
create or replace function public.history_page(p_user uuid, p_before timestamptz default null, p_before_id uuid default null,
                                               p_filter text default 'all', p_limit integer default 20)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.finished_at desc, t.id desc), '[]'::jsonb) from (
    select r.game_id as id, g.code, r.place, r.score, r.bids_made, r.rounds, r.players, r.elo_delta, r.elo_after, r.finished_at,
           coalesce((g.options->>'exp')::boolean, false) as ext,
           g.options, (select gp.name from public.game_players gp where gp.game_id = r.game_id and gp.user_id = g.host) as host_name, g.host = p_user as hosted,
           (select coalesce(sum(x.amount), 0) from public.xp_events x where x.game_id = r.game_id and x.user_id = p_user)::integer as xp,
           (select jsonb_agg(jsonb_build_object('name', gp.name, 'bot', gp.bot, 'rank', gp.rank, 'score', gp.final_score, 'user_id', gp.user_id,
                   'color', pr.color, 'avatar_kind', pr.avatar_kind, 'avatar_art', pr.avatar_art, 'avatar_url', pr.avatar_url) order by gp.rank, gp.seat)
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

-- Détail : ajoute l'heure de création (durée de la partie) et la revanche éventuelle.
create or replace function public.history_get(p_user uuid, p_game uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from public.game_players gp where gp.game_id = p_game and gp.user_id = p_user) then null else
    jsonb_build_object(
      'id', g.id, 'code', g.code, 'status', g.status, 'options', g.options, 'created_at', g.created_at, 'finished_at', g.finished_at, 'host', g.host,
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

-- ---------- Revanche : un seul salon par partie, même si plusieurs joueurs cliquent en même temps ----------
-- Réserve le code du salon de revanche dans games.state.rematch ; renvoie le code déjà réservé s'il existe.
create or replace function public.rematch_claim(p_game uuid, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  update public.games set state = jsonb_set(coalesce(state, '{}'::jsonb), '{rematch}', to_jsonb(p_code))
    where id = p_game and not coalesce(state ? 'rematch', false)
    returning p_code into v;
  if v is null then select state->>'rematch' into v from public.games where id = p_game; end if;
  return v;
end $$;

revoke execute on function public.unsettled_games(uuid) from public, anon, authenticated;
revoke execute on function public.history_page(uuid, timestamptz, uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.history_get(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.rematch_claim(uuid, text) from public, anon, authenticated;
revoke execute on function public.game_settle(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.unsettled_games(uuid) to service_role;
grant execute on function public.history_page(uuid, timestamptz, uuid, text, integer) to service_role;
grant execute on function public.history_get(uuid, uuid) to service_role;
grant execute on function public.rematch_claim(uuid, text) to service_role;
grant execute on function public.game_settle(uuid, jsonb) to service_role;

-- ---------- Classement ----------
-- « Entre amis » : joueurs avec qui j'ai terminé au moins une partie (plus un simple passage dans un salon).
-- Paramètres vérifiés, et plus d'accès anonyme.
create or replace function public.leaderboard_period(scope text default 'all', period text default 'ever')
returns table (rank bigint, user_id uuid, pseudo text, color text, avatar_kind text, avatar_art smallint, avatar_url text, xp integer,
               elo integer, games integer, wins integer, bids_pct integer, best_score integer, delta numeric, me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if scope not in ('friends', 'all') then raise exception 'scope inconnu : %', scope using errcode = '22023'; end if;
  if period not in ('week', 'month', 'ever') then raise exception 'période inconnue : %', period using errcode = '22023'; end if;
  return query
  with pool as (
    select s.*, p.pseudo, p.color, p.avatar_kind, p.avatar_art, p.avatar_url, p.xp, p.public_rank
    from public.player_stats s join public.profiles p on p.id = s.user_id
    where s.games > 0 and case
      when scope = 'friends' then s.user_id = auth.uid() or exists (
        select 1 from public.game_results a join public.game_results b on b.game_id = a.game_id
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
end $$;
revoke execute on function public.leaderboard_period(text, text) from public, anon;
grant execute on function public.leaderboard_period(text, text) to authenticated;
