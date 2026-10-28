-- Temps moyen pour poser une carte (aperçu d'un joueur à la table).
-- Le serveur mesure, à chaque carte jouée en ligne, le temps écoulé depuis le coup précédent (début du tour),
-- plafonné à 2 minutes pour qu'une absence ne fausse pas la moyenne.

alter table public.player_stats add column if not exists play_ms bigint not null default 0;
alter table public.player_stats add column if not exists plays integer not null default 0;

create or replace function public.play_time_add(p_user uuid, p_ms integer)
returns void language sql security definer set search_path = public as $$
  insert into public.player_stats (user_id, play_ms, plays) values (p_user, least(greatest(p_ms, 0), 120000), 1)
  on conflict (user_id) do update set play_ms = player_stats.play_ms + excluded.play_ms, plays = player_stats.plays + 1;
$$;
revoke execute on function public.play_time_add(uuid, integer) from public, anon, authenticated;
grant execute on function public.play_time_add(uuid, integer) to service_role;

create or replace function public.player_card(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user_id',      p.id,
    'pseudo',       p.pseudo,
    'color',        p.color,
    'avatar_kind',  p.avatar_kind,
    'avatar_art',   p.avatar_art,
    'avatar_url',   p.avatar_url,
    'look',         p.look,
    'xp',           p.xp,
    'elo',          coalesce(s.elo, 100),
    'elo_best',     coalesce(s.elo_best, 100),
    'ranked_games', coalesce(s.ranked_games, 0),
    'games',        coalesce(s.games, 0),
    'wins',         coalesce(s.wins, 0),
    'bids_made',    coalesce(s.bids_made, 0),
    'bids_total',   coalesce(s.bids_total, 0),
    'last_delta',   (select r.elo_delta from public.game_results r
                     where r.user_id = p.id and r.elo_delta is not null
                     order by r.finished_at desc limit 1),
    'cosmetics',    coalesce((select jsonb_agg(c.cosmetic_id) from public.user_cosmetics c where c.user_id = p.id), '[]'::jsonb),
    -- moyenne en millisecondes, seulement après 10 cartes posées (sinon null : pas assez de mesures)
    'avg_play_ms',  case when coalesce(s.plays, 0) >= 10 then round(s.play_ms::numeric / s.plays) end
  )
  from public.profiles p
  left join public.player_stats s on s.user_id = p.id
  where p.id = p_user;
$$;
revoke execute on function public.player_card(uuid) from public, anon, authenticated;
grant execute on function public.player_card(uuid) to service_role;
