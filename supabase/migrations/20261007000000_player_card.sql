-- Aperçu d'un joueur au survol (ApercuJoueur) : fonction serveur qui agrège profil, statistiques et dernière variation d'Élo.
-- Lecture publique pour les joueurs connectés : le site n'affiche cet aperçu qu'à la table, où les joueurs se voient déjà.

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
    'cosmetics',    coalesce((select jsonb_agg(c.cosmetic_id) from public.user_cosmetics c where c.user_id = p.id), '[]'::jsonb)
  )
  from public.profiles p
  left join public.player_stats s on s.user_id = p.id
  where p.id = p_user;
$$;
revoke execute on function public.player_card(uuid) from public, anon, authenticated;
grant execute on function public.player_card(uuid) to service_role;
