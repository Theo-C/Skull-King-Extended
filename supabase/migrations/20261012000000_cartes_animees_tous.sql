-- Donne les 6 cartes animées (D11) à tous les comptes existants.
-- Rejouable sans effet : les cartes déjà possédées sont ignorées.
insert into public.user_cosmetics (user_id, cosmetic_id, source)
select p.id, k.id, 'cadeau' from public.profiles p cross join public.cosmetics k
where k.slot = 'carte'
on conflict (user_id, cosmetic_id) do nothing;

-- Contrôle : qui a reçu combien de cartes animées (à lire dans le résultat du SQL editor)
select p.pseudo, count(*) as cartes_animees
from public.user_cosmetics uc join public.profiles p on p.id = uc.user_id
where uc.cosmetic_id like 'carte:%'
group by p.pseudo order by p.pseudo;
