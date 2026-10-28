-- Cartes animées Mythiques (D11) mises de côté (décision du 28 octobre 2026) : retirées à tous les joueurs (elles avaient
-- été données à la main, migrations cartes_animees_theo_mathieu et cartes_animees_tous). Le catalogue (public.items, slot
-- card_anim) et les vidéos restent, pour pouvoir les remettre plus tard ; plus aucun moyen de les gagner.
delete from public.user_items where item_id in (select id from public.items where slot = 'card_anim');
update public.profiles set look = look - 'card_anims' where look ? 'card_anims';
update public.items set chest_pool = false where slot = 'card_anim';
