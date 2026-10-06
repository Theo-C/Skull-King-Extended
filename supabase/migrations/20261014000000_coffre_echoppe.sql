-- Coffre de victoire en vente à l'échoppe : 100 pièces (en plus du coffre gagné par le vainqueur d'une partie en ligne).
create or replace function public.chest_buy(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_coins int; v_price constant int := 100;
begin
  insert into public.user_wallet (user_id) values (p_user) on conflict (user_id) do nothing;
  select coins into v_coins from public.user_wallet where user_id = p_user for update;
  if v_coins < v_price then return jsonb_build_object('error', 'Il vous manque des pièces.'); end if;
  update public.user_wallet set coins = coins - v_price, chests = chests + 1 where user_id = p_user;
  return (select jsonb_build_object('ok', true, 'price', v_price, 'coins', coins, 'chests', chests) from public.user_wallet where user_id = p_user);
end $$;
revoke execute on function public.chest_buy(uuid) from public, anon, authenticated;
grant execute on function public.chest_buy(uuid) to service_role;
