-- GIF en partie (A10, docs/gif/SPEC.md) : rien n'est stocké à part le débit, 1 GIF toutes les 10 s par joueur.
create table if not exists public.gif_rate (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_at timestamptz not null default now()
);
alter table public.gif_rate enable row level security; -- aucune politique : seul le serveur y touche

-- prend le créneau d'envoi si le dernier GIF date d'au moins 10 s ; renvoie le nombre de secondes à attendre sinon (0 = envoyé)
create or replace function public.gif_rate_take(p_user uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_last timestamptz;
begin
  select last_at into v_last from public.gif_rate where user_id = p_user for update;
  if v_last is not null and v_last > now() - interval '10 seconds' then
    return greatest(1, ceil(extract(epoch from (v_last + interval '10 seconds' - now())))::integer);
  end if;
  insert into public.gif_rate (user_id, last_at) values (p_user, now())
  on conflict (user_id) do update set last_at = now();
  return 0;
end $$;
revoke execute on function public.gif_rate_take(uuid) from public, anon, authenticated;
grant execute on function public.gif_rate_take(uuid) to service_role;
