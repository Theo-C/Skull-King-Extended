# État des lieux : intégration du prompt maître

Suivi de la liste de contrôle de `docs/PROMPT-MAITRE.md`.

**Attention : ce fichier est partiel.** Il ne couvre que les points traités et vérifiés depuis que le dépôt local a été réaligné sur GitHub, le 5 octobre 2026. Les autres points ont été faits sur `master` le 3 octobre : garde-robe, coffre, aperçu au survol, écrans du compte. Ils n'ont pas encore été repassés point par point contre la liste : leur ligne indique « à vérifier ».

## A. Table de jeu

| # | Point | État | Où |
|---|---|---|---|
| A1 à A7 | Table v2, journal, Alt-Tab, Lise, main, zoom, aperçu au survol | à vérifier | `web/src/table.ts`, `web/src/playercard.ts`, `web/src/zoom.ts` |
| A8 | Pli en ligne : cartes au centre dans l'ordre de pose, rangs, places vides, carte qui mène, phrase d'explication | **Fait** (commit `8a0349f`, vérifié à 3, 4, 5 et 6 joueurs, et sur téléphone) | `web/src/table.ts`, `web/src/game.css` |
| A9 | Ambiance pirate : cabine en planches, table cloutée, tapis en carte marine, lanterne et hublot, sceau de cire, parchemin, nœuds de corde ; option « Ambiance : Pirate / Sobre » | **Fait** (voir ci-dessous) | `web/src/ambiance.ts`, `web/src/styles/ambiance.css`, `web/src/table.ts` |

**Détail de A9 :**
- **Décor seulement.** Tous les éléments sont en `aria-hidden` et `pointer-events: none`.
- **Accessoires des coins** (lanterne, hublot, dague et doublons) :
  - masqués automatiquement s'ils toucheraient une plaque, ce qui est le cas à 5 joueurs et plus ;
  - masqués aussi sous 1100 px et sur téléphone.
- **Contrôle automatique** : aucun décor visible ne recouvre une carte, la main, une plaque, la barre ou un texte.
  - Vérifié à 3, 4 et 6 joueurs en 1366 × 768 et 1920 × 1080.
  - Vérifié à 4 et 6 joueurs en 390 × 844.
  - Pas de débordement de 720 à 1920 px.
- **Réglage.** Dans la barre au-delà de 1100 px. En dessous, il passe par le menu (téléphone compris). Il est retenu dans `localStorage` (`pli.ambiance`).
- **Animations** : lanterne, flamme, halo et houle. Elles sont coupées sous `prefers-reduced-motion`. L'ambiance sobre masque le fond, la carte marine et les accessoires, et rend leur style d'origine aux informations.

## B. Cartes illustrées

| # | Point | État | Où |
|---|---|---|---|
| B1 à B5 | 24 faces illustrées, chiffres et sceaux, pastilles, coins, Grand Quinze | **Fait** (commit `836d12d`, planche des 88 cartes vérifiée) | `web/src/cards.ts`, `web/src/game.css` |
| B6 | Noms officiels des personnages dans le code | **Fait**. Seule exception : deux descriptions de hauts faits, en base, citent encore Barbe-Cendre et Lise. | `supabase/functions/_shared/engine.ts`, `web/src/rules.ts`… |

## C. Compte et progression, D. Garde-robe et coffre

Faits sur `master` le 3 octobre ; à vérifier point par point. Ajout depuis : le nombre de manches est au choix, et l'Élo ne compte que pour 10 manches entre humains, sans bot (commit `a420f5c`).
