-- Donne les 6 cartes animées (D11) à Théo et Mathieu, comptes existants.
-- Repérage par pseudo (Théo, Theo, Mathieu…, sans tenir compte de la casse) et par l'e-mail de Théo.
-- Rejouable sans effet : les cartes déjà possédées sont ignorées.
with cibles as (
  select p.id from public.profiles p
  left join auth.users u on u.id = p.id
  where lower(p.pseudo) like 'th_o%' or lower(p.pseudo) like 'mathieu%'
     or lower(u.email) = 'theo.capitaine@clesence.fr'
)
insert into public.user_cosmetics (user_id, cosmetic_id, source)
select c.id, k.id, 'cadeau' from cibles c cross join public.cosmetics k
where k.slot = 'carte'
on conflict (user_id, cosmetic_id) do nothing;

-- Contrôle : qui a reçu quoi (à lire dans le résultat du SQL editor)
select p.pseudo, count(*) as cartes_animees
from public.user_cosmetics uc join public.profiles p on p.id = uc.user_id
where uc.cosmetic_id like 'carte:%'
group by p.pseudo order by p.pseudo;
