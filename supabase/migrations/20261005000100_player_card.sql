-- Aperçu d'un joueur au survol, à la table (maquette ApercuJoueur) : identité, niveau, Élo et tendance, statistiques, look.
-- Lu par l'action « player.card » de l'Edge Function (mise en cache par le site pour toute la partie).
-- Tendance : somme des variations d'Élo sur les 5 dernières parties classées.
create or replace function public.player_card(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'pseudo', p.pseudo, 'color', p.color, 'look', p.look, 'avatar_kind', p.avatar_kind, 'avatar_art', p.avatar_art, 'xp', p.xp,
    'elo', round(coalesce(s.elo, 100))::integer, 'ranked_games', coalesce(s.ranked_games, 0),
    'games', coalesce(s.games, 0), 'wins', coalesce(s.wins, 0), 'bids_made', coalesce(s.bids_made, 0), 'bids_total', coalesce(s.bids_total, 0),
    'trend', (select coalesce(sum(elo_delta), 0) from (select r.elo_delta from public.game_results r
               where r.user_id = p.id and r.elo_delta is not null order by r.finished_at desc limit 5) t))
  from public.profiles p left join public.player_stats s on s.user_id = p.id
  where p.id = p_user;
$$;
revoke execute on function public.player_card(uuid) from public, anon, authenticated;
grant execute on function public.player_card(uuid) to service_role;
