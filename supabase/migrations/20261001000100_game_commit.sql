-- Écriture atomique d'un coup : verrou optimiste sur games.version, puis état secret, mains, sièges et événements.
-- Appelée uniquement par l'Edge Function (clé service).
create or replace function public.game_commit(
  p_game uuid, p_expected integer, p_patch jsonb,
  p_secret jsonb default null, p_hands jsonb default null, p_events jsonb default null, p_seats jsonb default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update public.games set
    version = version + 1,
    updated_at = now(),
    status = coalesce(p_patch->>'status', status),
    options = coalesce(p_patch->'options', options),
    state = case when p_patch ? 'state' then p_patch->'state' else state end,
    finished_at = case when p_patch->>'status' = 'finished' then now() else finished_at end
  where id = p_game and version = p_expected
  returning version into v;
  if v is null then return null; end if;   -- quelqu'un a joué entre-temps : l'appelant recharge et réessaie

  if p_seats is not null then
    delete from public.game_players where game_id = p_game;
    insert into public.game_players (game_id, seat, user_id, bot, name, final_score, rank)
    select p_game, (s->>'seat')::smallint, nullif(s->>'user_id', '')::uuid, coalesce((s->>'bot')::boolean, false),
           coalesce(s->>'name', ''), (s->>'final_score')::integer, (s->>'rank')::smallint
    from jsonb_array_elements(p_seats) s;
  end if;

  if p_secret is not null then
    insert into public.game_secrets (game_id, state, updated_at) values (p_game, p_secret, now())
    on conflict (game_id) do update set state = excluded.state, updated_at = now();
  end if;

  if p_hands is not null then
    insert into public.hands (game_id, user_id, seat, data, version, updated_at)
    select p_game, (h->>'user_id')::uuid, (h->>'seat')::smallint, h->'data', v, now()
    from jsonb_array_elements(p_hands) h
    on conflict (game_id, user_id) do update set seat = excluded.seat, data = excluded.data, version = excluded.version, updated_at = now();
  end if;

  if p_events is not null then
    insert into public.game_events (game_id, version, idx, payload)
    select p_game, v, (t.ord - 1)::smallint, t.e from jsonb_array_elements(p_events) with ordinality as t(e, ord);
  end if;

  if p_patch->>'status' = 'finished' then
    -- les animations ne servent plus : on garde la base légère
    delete from public.game_events where game_id = p_game and version < v;
  end if;
  return v;
end $$;

revoke execute on function public.game_commit(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.game_commit(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
