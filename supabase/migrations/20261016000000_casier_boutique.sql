-- Casier et Boutique (D8 et D12, docs/casier-boutique/SPEC.md).
-- 1. Catalogue générique : cosmetics → items, user_cosmetics → user_items (données gardées). Un nouveau type d'objet = un
--    nouveau slot. Les anciens noms restent en vues (lecture seule pour les joueurs) pour les fonctions déjà en place.
-- 2. Nouveaux objets : dos de cartes, titres, réactions rapides ; les cartes animées passent au slot card_anim.
-- 3. Boutique : échoppe de la semaine (weekly_shop, renouvelée le lundi 00:00 heure de Paris), achats en une transaction.
-- 4. Joker : posé à la fin de la dernière manche, avant les résultats (11e manche bonus) ; retiré du porte-monnaie s'il est posé.
-- L'apparence de base (teint, coiffure, cheveux, pilosité, manteau) n'est pas dans items : elle est toujours libre.

-- ---------- 1. items / user_items ----------
alter table public.cosmetics rename to items;
alter table public.user_cosmetics rename to user_items;
alter table public.user_items rename column cosmetic_id to item_id;
alter table public.user_items add column if not exists variant text;
alter table public.items add column if not exists source text;
alter table public.items add column if not exists price integer;
alter table public.items add column if not exists active boolean not null default true;
alter table public.items add column if not exists meta jsonb;
update public.items set source = case
  when default_owned then 'base'
  when how like 'title:%' then 'level'
  when how like 'achievement:%' then 'achievement'
  when how = 'shop' then 'shop'
  when how like 'leaderboard:%' then 'leaderboard'
  else 'chest' end;
alter table public.items alter column source set not null;
alter table public.items add constraint items_source_check check (source in ('base', 'chest', 'shop', 'level', 'achievement', 'leaderboard'));
alter table public.items drop constraint if exists cosmetics_slot_check;
update public.items set slot = 'card_anim' where slot = 'carte';
alter table public.items add constraint items_slot_check
  check (slot in ('hat', 'face', 'neck', 'pet', 'bg', 'frame', 'card_back', 'card_anim', 'title', 'reaction'));
-- prix de l'échoppe : commun 50 à 60, rare 150, épique 300 (jamais de Légendaire ni de Mythique)
update public.items set price = case rarity when 'c' then 60 when 'r' then 150 when 'e' then 300 end where source = 'shop';

-- anciens noms : vues en lecture (droits de l'appelant, donc RLS des tables) pour chest_open, game_settle, settle_inputs…
create view public.cosmetics with (security_invoker = true) as
  select id, slot, value, name, rarity, default_owned, how, variant_key, variants, sort, chest_pool from public.items;
create view public.user_cosmetics with (security_invoker = true) as
  select user_id, item_id as cosmetic_id, source, obtained_at from public.user_items;
revoke all on public.cosmetics, public.user_cosmetics from public, anon, authenticated;
grant select on public.cosmetics, public.user_cosmetics to anon, authenticated;

-- ---------- 2. nouveaux objets ----------
insert into public.items (id, slot, value, name, rarity, default_owned, how, source, price, chest_pool, sort, meta) values
  -- variantes vendues à part (comme le Bandana violet)
  ('neck:foulard-nuit', 'neck', 'foulard', 'Foulard bleu nuit', 'c', false, 'shop', 'shop', 60, false, 25, null),
  -- dos de cartes (un seul équipé ; les faces ne changent jamais)
  ('back:classique', 'card_back', 'classique', 'Classique', 'c', true, null, 'base', null, false, 10, null),
  ('back:marine', 'card_back', 'marine', 'Carte marine', 'c', true, null, 'base', null, false, 20, '{"bg":"radial-gradient(circle at 50% 50%,#e8dcc0 0 18%,transparent 19%),repeating-linear-gradient(0deg,#1f4f6a 0 10px,#1a4359 10px 20px)"}'),
  ('back:voile', 'card_back', 'voile', 'Voile rapiécée', 'c', false, 'shop', 'shop', 55, false, 30, '{"bg":"linear-gradient(90deg,transparent 48%,#8a7350 48% 52%,transparent 52%),repeating-linear-gradient(0deg,#e6dcc4 0 14px,#d6c9ab 14px 28px)"}'),
  ('back:ancre', 'card_back', 'ancre', 'Ancre et cordage', 'r', false, 'shop', 'shop', 150, false, 40, '{"bg":"radial-gradient(circle at 50% 45%,#c9a14a 0 14%,transparent 15%),linear-gradient(180deg,#1b2b3a,#0f1a24)"}'),
  ('back:rose', 'card_back', 'rose', 'Rose des vents', 'r', false, 'chest', 'chest', null, true, 50, '{"bg":"conic-gradient(from 45deg at 50% 50%,#d9b25a 0 12.5%,#2a3e52 0 25%,#d9b25a 0 37.5%,#2a3e52 0 50%,#d9b25a 0 62.5%,#2a3e52 0 75%,#d9b25a 0 87.5%,#2a3e52 0)"}'),
  ('back:kraken', 'card_back', 'kraken', 'Kraken', 'e', false, 'shop', 'shop', 300, false, 60, '{"bg":"radial-gradient(circle at 50% 40%,#c8644b 0 20%,transparent 21%),linear-gradient(180deg,#3a1414,#1a0808)"}'),
  ('back:abysses', 'card_back', 'abysses', 'Abysses', 'e', false, 'title:22', 'level', null, false, 70, '{"bg":"radial-gradient(circle at 30% 70%,#7fffd0 0 3%,transparent 4%),radial-gradient(circle at 70% 30%,#7fffd0 0 2%,transparent 3%),linear-gradient(180deg,#0d3b47,#03141a)"}'),
  ('back:or', 'card_back', 'or', 'Doublons', 'l', false, 'chest', 'chest', null, true, 80, '{"bg":"repeating-radial-gradient(circle at 50% 50%,#e2bd62 0 4px,#a77b22 4px 8px)"}'),
  -- titres : ceux des niveaux se débloquent avec le niveau, les autres avec leur haut fait (possession calculée par le serveur)
  ('title:mousse', 'title', 'mousse', 'Mousse', 'c', true, 'title:1', 'level', null, false, 10, null),
  ('title:matelot', 'title', 'matelot', 'Matelot', 'c', false, 'title:3', 'level', null, false, 20, null),
  ('title:gabier', 'title', 'gabier', 'Gabier', 'c', false, 'title:5', 'level', null, false, 30, null),
  ('title:quartier-maitre', 'title', 'quartier-maitre', 'Quartier-maître', 'c', false, 'title:8', 'level', null, false, 40, null),
  ('title:bosco', 'title', 'bosco', 'Bosco', 'c', false, 'title:11', 'level', null, false, 50, null),
  ('title:second', 'title', 'second', 'Second', 'r', false, 'title:13', 'level', null, false, 60, null),
  ('title:capitaine', 'title', 'capitaine', 'Capitaine', 'r', false, 'title:16', 'level', null, false, 70, null),
  ('title:corsaire', 'title', 'corsaire', 'Corsaire', 'e', false, 'title:20', 'level', null, false, 80, null),
  ('title:amiral', 'title', 'amiral', 'Amiral', 'l', false, 'title:25', 'level', null, false, 90, null),
  ('title:legende', 'title', 'legende', 'Légende des 7 mers', 'l', false, 'title:30', 'level', null, false, 100, null),
  ('title:velours', 'title', 'velours', 'Main de velours', 'r', false, 'achievement:velvet', 'achievement', null, false, 110, null),
  ('title:sirenes', 'title', 'sirenes', 'Chasseur de sirènes', 'e', false, 'achievement:siren_hunter', 'achievement', null, false, 120, null),
  ('title:capitaine-mers', 'title', 'capitaine-mers', 'Capitaine des mers', 'l', false, 'achievement:captain', 'achievement', null, false, 130, null),
  -- réactions rapides (4 dans la barre, touches 1 à 4 en partie)
  ('reaction:bien-joue', 'reaction', 'bien-joue', 'Bien joué', 'c', true, null, 'base', null, false, 10, null),
  ('reaction:aie', 'reaction', 'aie', 'Aïe…', 'c', true, null, 'base', null, false, 20, null),
  ('reaction:gg', 'reaction', 'gg', 'GG', 'c', true, null, 'base', null, false, 30, null),
  ('reaction:abordage', 'reaction', 'abordage', 'À l''abordage !', 'c', true, null, 'base', null, false, 40, null),
  ('reaction:trahison', 'reaction', 'trahison', 'Trahison !', 'c', true, null, 'base', null, false, 50, null),
  ('reaction:barbe', 'reaction', 'barbe', 'Par la barbe !', 'c', true, null, 'base', null, false, 60, null),
  ('reaction:encore', 'reaction', 'encore', 'Encore un pli !', 'c', true, null, 'base', null, false, 70, null),
  ('reaction:dit', 'reaction', 'dit', 'Je l''avais dit', 'c', true, null, 'base', null, false, 80, null),
  ('reaction:quartier', 'reaction', 'quartier', 'Pas de quartier', 'c', false, 'shop', 'shop', 50, false, 90, null),
  ('reaction:voiles', 'reaction', 'voiles', 'Hissez les voiles', 'r', false, 'chest', 'chest', null, true, 100, null),
  ('reaction:kraken', 'reaction', 'kraken', 'Le Kraken a faim', 'e', false, 'chest', 'chest', null, true, 110, null),
  ('reaction:trou', 'reaction', 'trou', 'Au trou, moussaillon', 'r', false, 'achievement:kraken_bet', 'achievement', null, false, 120, null)
on conflict (id) do nothing;

-- cartes animées : seulement celles que leur propriétaire a laissées activées (look.card_anims ; absent = toutes)
create or replace function public.cartes_animees(p_users uuid[])
returns table (user_id uuid, carte text) language sql stable security definer set search_path = public as $$
  select u.user_id, c.value from public.user_items u
  join public.items c on c.id = u.item_id
  join public.profiles p on p.id = u.user_id
  where c.slot = 'card_anim' and u.user_id = any(p_users[1:12])
    and (p.look->'card_anims' is null or jsonb_typeof(p.look->'card_anims') <> 'array' or (p.look->'card_anims') ? c.value);
$$;
revoke execute on function public.cartes_animees(uuid[]) from public, anon;
grant execute on function public.cartes_animees(uuid[]) to authenticated;

-- apparence : fusion (un enregistrement partiel ne perd pas les autres clés : dos, titre, réactions…)
create or replace function public.profile_update(p_user uuid, p jsonb)
returns void language sql security definer set search_path = public as $$
  update public.profiles set
    pseudo = coalesce(p->>'pseudo', pseudo),
    color = coalesce(p->>'color', color),
    avatar_kind = coalesce(p->>'avatar_kind', avatar_kind),
    avatar_art = case when p ? 'avatar_art' then (p->>'avatar_art')::smallint else avatar_art end,
    avatar_url = case when p ? 'avatar_url' then p->>'avatar_url' else avatar_url end,
    look = case when p ? 'look' then coalesce(look, '{}'::jsonb) || (p->'look') else look end,
    public_rank = coalesce((p->>'public_rank')::boolean, public_rank),
    notify_turn = coalesce((p->>'notify_turn')::boolean, notify_turn),
    sounds = coalesce((p->>'sounds')::boolean, sounds)
  where id = p_user;
$$;
revoke execute on function public.profile_update(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.profile_update(uuid, jsonb) to service_role;

-- ---------- 3. échoppe de la semaine ----------
create table if not exists public.weekly_shop (
  week_start date primary key,           -- le lundi (heure de Paris)
  item_ids text[] not null,              -- 6 objets : 3 communs, 2 rares, 1 épique
  created_at timestamptz not null default now()
);
alter table public.weekly_shop enable row level security;
create policy "échoppe lisible par tous" on public.weekly_shop for select to anon, authenticated using (true);

-- lundi de la semaine en cours, heure de Paris
create or replace function public.paris_week_start(t timestamptz default now())
returns date language sql stable as $$ select (date_trunc('week', t at time zone 'Europe/Paris'))::date $$;

-- échoppe d'une semaine, tirée la première fois qu'on la demande (et par la tâche planifiée du lundi) : 3 communs, 2 rares,
-- 1 épique parmi les objets « shop », en évitant ceux des 4 semaines précédentes (s'il en manque, les moins récents)
create or replace function public.shop_week(p_week date default null)
returns public.weekly_shop language plpgsql security definer set search_path = public as $$
declare w date := coalesce(p_week, public.paris_week_start()); r public.weekly_shop; ids text[] := '{}'; k record;
begin
  select * into r from public.weekly_shop where week_start = w;
  if found then return r; end if;
  for k in select * from (values ('c', 3), ('r', 2), ('e', 1)) as t(rar, n) loop
    ids := ids || array(
      select i.id from public.items i
      where i.source = 'shop' and i.active and i.rarity = k.rar
      order by (select max(s.week_start) from public.weekly_shop s where i.id = any(s.item_ids) and s.week_start < w and s.week_start >= w - 28) nulls first,
               md5(w::text || i.id)
      limit k.n);
  end loop;
  insert into public.weekly_shop (week_start, item_ids) values (w, ids) on conflict (week_start) do nothing;
  select * into r from public.weekly_shop where week_start = w;
  return r;
end $$;
revoke execute on function public.shop_week(date) from public, anon, authenticated;
grant execute on function public.shop_week(date) to service_role;

-- échoppe de la semaine en cours, avec la date de fin (lundi suivant 00:00 heure de Paris), pour la Boutique
create or replace function public.shop_week_info()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.weekly_shop;
begin
  r := public.shop_week();
  return jsonb_build_object('week_start', r.week_start::text, 'ends_at', ((r.week_start + 7)::timestamp at time zone 'Europe/Paris'), 'item_ids', to_jsonb(r.item_ids));
end $$;
revoke execute on function public.shop_week_info() from public, anon, authenticated;
grant execute on function public.shop_week_info() to service_role;

-- tâche planifiée : chaque lundi à 00:00 heure de Paris (22:00 ou 23:00 UTC le dimanche selon l'heure d'été)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('echoppe-de-la-semaine', '0 22,23 * * 0', 'select public.shop_week(public.paris_week_start(now() + interval ''2 hours''))');
  end if;
exception when others then raise notice 'pg_cron indisponible : l''échoppe sera tirée à la première visite (%)', sqlerrm;
end $$;

-- ---------- achats : coffre 100, 3 coffres 270, joker 150, objet de l'échoppe à son prix, en une transaction ----------
alter table public.user_wallet add column if not exists jokers integer not null default 0 check (jokers >= 0);
create or replace function public.shop_purchase(p_user uuid, p_what text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_coins int; v_price int; v_item public.items; v_week public.weekly_shop;
begin
  insert into public.user_wallet (user_id) values (p_user) on conflict (user_id) do nothing;
  select coins into v_coins from public.user_wallet where user_id = p_user for update;
  if p_what in ('chest', 'chest3', 'joker') then
    v_price := case p_what when 'chest' then 100 when 'chest3' then 270 else 150 end;
    if v_coins < v_price then return jsonb_build_object('error', 'Il vous manque des pièces.'); end if;
    update public.user_wallet set coins = coins - v_price,
      chests = chests + case p_what when 'chest' then 1 when 'chest3' then 3 else 0 end,
      jokers = jokers + case p_what when 'joker' then 1 else 0 end
    where user_id = p_user;
  else
    select * into v_item from public.items where id = p_what;
    if not found then return jsonb_build_object('error', 'Objet inconnu.'); end if;
    v_week := public.shop_week();
    if not (p_what = any(v_week.item_ids)) or v_item.price is null then return jsonb_build_object('error', 'Cet objet n''est pas à l''échoppe cette semaine.'); end if;
    if exists (select 1 from public.user_items where user_id = p_user and item_id = p_what) then return jsonb_build_object('error', 'Vous possédez déjà cet objet.'); end if;
    v_price := v_item.price;
    if v_coins < v_price then return jsonb_build_object('error', 'Il vous manque des pièces.'); end if;
    update public.user_wallet set coins = coins - v_price where user_id = p_user;
    insert into public.user_items (user_id, item_id, source) values (p_user, p_what, 'shop');
  end if;
  return (select jsonb_build_object('ok', true, 'what', p_what, 'price', v_price, 'coins', coins, 'chests', chests, 'jokers', jokers)
          from public.user_wallet where user_id = p_user);
end $$;
revoke execute on function public.shop_purchase(uuid, text) from public, anon, authenticated;
grant execute on function public.shop_purchase(uuid, text) to service_role;

-- ---------- 4. Joker : retiré du porte-monnaie quand il est posé, rendu si le coup n'aboutit pas ----------
create or replace function public.joker_take(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_left int;
begin
  update public.user_wallet set jokers = jokers - 1 where user_id = p_user and jokers > 0 returning jokers into v_left;
  if v_left is null then return jsonb_build_object('error', 'Vous n''avez pas de joker : il s''achète à la boutique.'); end if;
  return jsonb_build_object('ok', true, 'jokers', v_left);
end $$;
create or replace function public.joker_refund(p_user uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.user_wallet (user_id, jokers) values (p_user, 1)
  on conflict (user_id) do update set jokers = user_wallet.jokers + 1;
$$;
revoke execute on function public.joker_take(uuid) from public, anon, authenticated;
revoke execute on function public.joker_refund(uuid) from public, anon, authenticated;
grant execute on function public.joker_take(uuid) to service_role;
grant execute on function public.joker_refund(uuid) to service_role;
