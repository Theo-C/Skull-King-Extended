-- Joker (échoppe, 150 pièces) : joué pendant une partie en ligne, avant la dernière manche prévue, il ajoute une manche
-- de 10 cartes à la fin, pour tout le monde. Un par joueur et par partie ; la partie reste classée.

alter table public.user_wallet add column if not exists jokers integer not null default 0 check (jokers >= 0);

create or replace function public.joker_buy(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_coins int; v_price constant int := 150;
begin
  insert into public.user_wallet (user_id) values (p_user) on conflict (user_id) do nothing;
  select coins into v_coins from public.user_wallet where user_id = p_user for update;
  if v_coins < v_price then return jsonb_build_object('error', 'Il vous manque des pièces.'); end if;
  update public.user_wallet set coins = coins - v_price, jokers = jokers + 1 where user_id = p_user;
  return (select jsonb_build_object('ok', true, 'price', v_price, 'coins', coins, 'jokers', jokers) from public.user_wallet where user_id = p_user);
end $$;
revoke execute on function public.joker_buy(uuid) from public, anon, authenticated;
grant execute on function public.joker_buy(uuid) to service_role;

-- retire un joker du porte-monnaie (appelé par le serveur de jeu juste avant de l'appliquer à la partie)
create or replace function public.joker_take(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_left int;
begin
  update public.user_wallet set jokers = jokers - 1 where user_id = p_user and jokers > 0 returning jokers into v_left;
  if v_left is null then return jsonb_build_object('error', 'Vous n''avez pas de joker : il s''achète à l''échoppe.'); end if;
  return jsonb_build_object('ok', true, 'jokers', v_left);
end $$;
revoke execute on function public.joker_take(uuid) from public, anon, authenticated;
grant execute on function public.joker_take(uuid) to service_role;

-- rendu si la partie n'a finalement pas pu l'appliquer (conflit, partie terminée entre-temps)
create or replace function public.joker_refund(p_user uuid)
returns void language sql security definer set search_path = public as $$
  update public.user_wallet set jokers = jokers + 1 where user_id = p_user;
$$;
revoke execute on function public.joker_refund(uuid) from public, anon, authenticated;
grant execute on function public.joker_refund(uuid) to service_role;
