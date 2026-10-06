Refonte du catalogue, du Casier et de la Boutique (lots D8 et D12 de `docs/PROMPT-MAITRE.md`). Elle remplace la garde-robe et la petite échoppe qui étaient dans le profil.

Fichiers de cette refonte :
- `docs/casier-boutique/SPEC.md` : la spécification complète ;
- `docs/casier-boutique/PROMPT-claude-code.md` : les étapes à suivre ;
- `docs/PROMPT-MAITRE.md` : lignes D8 et D12 mises à jour ;
- maquettes `docs/maquettes/` : `Casier` (onglet Pirate), `CasierDos`, `CasierAnimees`, `CasierTitre`, `CasierReactions` (onglets Cartes et Titre et réactions) et `Boutique`.

Ce qu'il faut retenir :
1. Le Casier sert à s'équiper et la Boutique à acheter. Le profil ne garde qu'un résumé avec « Personnaliser ».
2. L'apparence de base est gratuite. Les objets viennent des coffres, des niveaux, des hauts faits ou de l'échoppe.
3. Boutique :
   - coffre à 100 pièces, 3 coffres à 270, Joker à 150 (11e manche bonus, 6 joueurs au plus) ;
   - échoppe de la semaine : 6 objets (3 communs, 2 rares, 1 épique), renouvelée le lundi à 00:00 heure de Paris ;
   - table `weekly_shop`.
4. Catalogue générique `items` / `user_items` : un nouveau type d'objet = un nouveau `slot`.

Suis `docs/casier-boutique/PROMPT-claude-code.md` de bout en bout. Si une partie de D8 ou D12 existe déjà, ne fais que les écarts avec le SPEC. Ensuite `npm test`, `npm run build`, coche D8 et D12 dans `docs/ETAT.md`, puis commit.
