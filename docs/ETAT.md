# État des lieux : intégration du prompt maître

Étape 0 de `docs/PROMPT-MAITRE.md`. État au 5 octobre 2026, sur le commit `ff5eb8a` (master).

Légende :
- **Fait** : conforme à la spécification et aux maquettes à jour de `docs/maquettes/` ;
- **Partiel** : une partie manque, précisée dans la ligne ;
- **À faire** : rien n'est en place.

## Maquettes : ce qui a changé depuis la dernière intégration

Ces maquettes sont identiques à celles déjà intégrées : Accueil, AccueilMobile, AppBar, Bid, Card, Classement, DetailPartie, Historique, Lise, LiseAutres, LiseCible, Main, Mobile, RoundEnd, Salon.

| Maquette | Changement | Lots concernés |
|---|---|---|
| `Avatar` | Avatar composé en couches SVG | D1, D9 |
| `Profil` | La garde-robe **remplace** l'éditeur d'image actuel (pirate illustré, photo recadrée, initiale) | D8 |
| `FinPartie` | Coffre de victoire cliquable, objet du haut fait | C5, D7 |
| `ApercuJoueur` | Nouvelle | A7 |
| `Coffre` | Nouvelle | D6 |
| `Objet` | Nouvelle | D2 |

## A. Table de jeu

| # | Point | État | Détail | Fichiers |
|---|---|---|---|---|
| A1 | Barre de partie, plaques avec plis / mise, pli en croix, panneau de droite, fin de manche, téléphone | **Fait** | Les 9 étapes de la table v2 et les corrections de l'audit sont faites. Réactions par broadcast, limitées à 1 toutes les 2 s. « Je suis prêt » est diffusé. Le journal montre 5 lignes et un lien « Tout voir ». Écart voulu : le mode téléphone commence sous 720 px et non 640, pour éviter un débordement entre 640 et 790 px. | `web/src/table.ts`, `web/src/game.css`, `web/src/pages/game.ts` |
| A2 | Bonus du journal en pastille dorée « +30 » avec « compte si sa mise est tenue » | **Fait** | Bloc `.lbonus`, et variante `.malus` pour les points négatifs | `web/src/table.ts` (`logLine`), `web/src/game.css` |
| A3 | Alt-Tab : jamais d'écran de fin de manche au retour | **Fait** | Les `SIGNED_IN` et `TOKEN_REFRESHED` du même utilisateur sont ignorés. `shownRound` n'est pas transmis d'une instance à l'autre : il est déduit au premier `setLatest`, ce qui donne le même effet. | `web/src/main.ts`, `web/src/table.ts` |
| A4 | Lise Fil-de-Soie : mains adverses face cachée cliquables, « Imposée par … » chez la cible, carte choisie montrée à tous | **Fait** | Les éventails face cachée sont mélangés avec une permutation secrète. La cible voit sa carte soulevée avec l'étiquette. Les autres voient la position choisie et l'étiquette « Imposée ». Le bloc du pouvoir s'affiche au centre de la table. | `web/src/table.ts`, `supabase/functions/_shared/engine.ts` |
| A5 | Taille des cartes de la main proportionnelle à la hauteur du bloc | **Fait** | `ResizeObserver` et `handLayout`. Limite : avec 10 cartes sur un écran de 390 px, chaque carte ne montre que 35 px (au lieu de 44) avec 40 px de large ; la place manque. | `web/src/table.ts`, `web/src/game.css` |
| A6 | Zoom après 450 ms de survol : carte de 300 px et fiche parchemin avec nom et règle | **Partiel** | La carte s'affiche bien sur 300 px. Le zoom s'ouvre aussi au clavier, avec une pastille « Prendrait le pli ». Il manque : le délai est de 420 ms au lieu de 450, et il n'y a pas de fiche parchemin, car le zoom agrandit l'ancienne face qui contient déjà le texte. La fiche devient nécessaire avec les cartes illustrées (B), qui n'ont plus de texte. | `web/src/zoom.ts`, `web/src/game.css` |
| A7 | Aperçu d'un joueur au survol (maquette `ApercuJoueur`, action `player.card`) | **À faire** | Rien en place : ni action serveur, ni cache, ni carte d'aperçu. Dépend de C3 (Élo) et de D (objets portés). | à créer : `web/src/playercard.ts` ; à modifier : `supabase/functions/_shared/service.ts`, une migration, `web/src/table.ts` |

## B. Cartes illustrées

| # | Point | État | Détail | Fichiers |
|---|---|---|---|---|
| B1 | Les 24 `web/public/cards/*.webp` branchées, selon la table de correspondance | **À faire** | Les 24 fichiers sont présents. `con.webp` est renommé `corbin.webp` : `CON` est un nom réservé sous Windows, et git ne peut pas y indexer ce fichier. `cards.ts` n'a pas encore de table `ART` : il rend toujours les faces « Mers Sauvages ». Il faut aussi précharger les images. | `web/src/cards.ts` |
| B2 | Chiffre dans le médaillon des cartes numérotées, sceaux +10 / +20 / −5 / +5, cas 0·14 | **À faire** | | `web/src/cards.ts`, `web/src/game.css` |
| B3 | Pastille de pouvoir sur les personnages (`pastilles.json`), sans pastille pour Morgane | **À faire** | | `web/src/cards.ts`, `web/src/game.css`, à partir de `docs/cartes-v3/pastilles.json` |
| B4 | Coins arrondis et ombre de `.card` alignés sur l'image, anciennes faces en repli, dos inchangé | **À faire** | | `web/src/cards.ts`, `web/src/game.css` |
| B5 | Le Grand Quinze garde son « 15 » dessiné | **À faire** | Il suffit de ne pas ajouter de chiffre sur la carte `wild` | `web/src/cards.ts` |

## C. Compte et progression

| # | Point | État | Détail | Fichiers |
|---|---|---|---|---|
| C1 | Pages Accueil, AccueilMobile, Salon, Profil, Historique, DetailPartie, Classement, `AppBar` et barre d'onglets | **Fait** | Conformes aux maquettes, qui n'ont pas changé, sauf Profil, traité en D8. | `web/src/pages/*.ts`, `web/src/account.ts`, `web/src/app.css`, `web/src/screens.css`, `web/index.html` |
| C2 | XP : +50 / +10 / +100 / +25, niveau suivant à 250 × L, titres de Mousse à Légende des 7 mers | **Fait** | Même formule côté serveur et côté site | `supabase/functions/_shared/xp.ts`, `web/src/xp.ts` |
| C3 | Élo : départ à 100, minimum 0, calcul par paires, diviseur 100, K = 40 puis 20, bots exclus ; affiché partout | **Fait** | Visible dans le profil, l'historique, le détail, la fin de partie (par adversaire) et le classement. Hors liste mais dans la spec : un abandon en cours de partie ne compte pas comme dernière place, car l'abandon n'existe pas encore. | `supabase/functions/_shared/elo.ts`, `settle.ts`, `web/src/table.ts`, `web/src/pages/*.ts` |
| C4 | Hauts faits, `game_results`, `player_stats`, `xp_events`, classement amis ou tous, `settleGame` idempotent | **Fait** | Règlement refait s'il a échoué, verrous ordonnés. Migrations `20261003000000` et `20261004000000`. Le règlement ne donne encore ni pièces, ni coffre, ni objets : c'est le lot D. | `supabase/migrations/`, `supabase/functions/_shared/settle.ts`, `service.ts` |
| C5 | Écran de fin de partie : podium, XP, Élo par adversaire, haut fait, bouton « Ouvrir le coffre » | **Partiel** | Le podium, l'XP, l'Élo et le haut fait sont en place. Il manque le coffre de victoire et l'objet du haut fait de la nouvelle maquette, qui dépendent de D. | `web/src/table.ts` (`finalOverlay`, `fillSettled`), `web/src/game.css` |

## D. Garde-robe et coffre

Rien n'existe encore dans le code pour ce lot (aucune occurrence de `look`, `cosmetic`, `chest` ou `coffre`).

| # | Point | État | Fichiers à créer ou modifier |
|---|---|---|---|
| D1 | Avatar en couches SVG : base gratuite (teint, coiffure, cheveux, pilosité, manteau) et 6 emplacements ; `profiles.look` en jsonb | **À faire** | `web/src/avatar.ts` (`avatarSVG(look, color, size)`), nouvelle migration |
| D2 | Les 11 objets dessinés | **À faire** | `web/src/objects.ts` |
| D3 | Tables `cosmetics`, `user_cosmetics`, `user_wallet`, catalogue `CAT` de la maquette Profil | **À faire** | nouvelle migration |
| D4 | Raretés 62 / 26 / 9 / 3 %, leurs couleurs, doublon converti en 30 / 80 / 140 / 200 pièces | **À faire** | `supabase/functions/_shared/` (tirage), migration |
| D5 | Coffre au gagnant humain, actions `chest.open`, `shop.list` et `shop.buy`, `profile.update` qui refuse un look non possédé | **À faire** | `settle.ts`, `service.ts`, migration (fonctions SQL transactionnelles) |
| D6 | Animation d'ouverture en 6 étapes, boutons « Passer », « Ouvrir le suivant » et « Équiper », mouvement réduit | **À faire** | `web/src/chest.ts`, CSS |
| D7 | Accès au coffre : fin de partie, garde-robe, badge dans l'en-tête | **À faire** | `web/src/table.ts`, `web/src/pages/profile.ts`, `web/src/account.ts` |
| D8 | Garde-robe : 7 onglets, silhouettes verrouillées avec condition, variantes, Au hasard / Annuler / Enregistrer, échoppe de 3 objets par jour | **À faire** | `web/src/pages/profile.ts`, `web/src/app.css` |
| D9 | Avatars composés partout : table, listes, classement, aperçu | **À faire** | `web/src/avatar.ts` et tous ses appels (la fonction est déjà centralisée) |
| D10 | Tests : probabilités (graine fixe), refus à 0 coffre, doublons, idempotence, look invalide | **À faire** | `tests/account.test.ts`, `tests/service.test.ts`, `tests/sql.test.ts` |

## Points à trancher avant le lot D

1. **Éditeur d'image actuel.** La nouvelle maquette Profil remplace l'éditeur (pirate illustré, photo recadrée, initiale) par la garde-robe. Le Prompt 3 dit seulement de garder le mode « initiale ». Faut-il retirer la photo de profil (bucket `avatars`, recadrage), ou la garder comme option à côté du personnage composé ?
2. **Objets des titres et des hauts faits** (tableau « Comment on les obtient » de la spec). Les joueurs ont déjà passé des titres et obtenu des hauts faits. Faut-il leur attribuer ces objets rétroactivement dans la migration ?
3. **Cadre d'or du top 3 du mois.** Il faut une tâche périodique, que Supabase n'a pas aujourd'hui : soit `pg_cron`, soit un calcul au premier passage du mois. Ce point n'est pas dans la liste de contrôle. Faut-il le faire maintenant, ou plus tard ?

## Déjà connu et hors liste

- Abandon en cours de partie et Élo (spec du compte) : non géré.
- Bouton « Supprimer mon compte » : absent. Supprimer un compte effacerait aussi les parties qu'il a créées, et donc l'historique des autres joueurs (`games.host` est en cascade).
- Contrôle final avec deux comptes réels : pas encore fait.
- Déploiement : la migration `20261004000000_account_audit.sql` et la fonction `game` ont-elles été déployées sur Supabase ? À vérifier.

## Ordre des lots proposé

Il suit le prompt maître :
1. Fermer A3 et A2 : déjà faits, rien à coder.
2. **B**, cartes illustrées (B1 à B5), puis la fiche parchemin du zoom (A6).
3. **C5**, une fois que le lot D fournit le coffre.
4. **D**, garde-robe et coffre (D1 à D10).
5. **A7**, aperçu au survol.

Un commit par lot. Après chaque lot : `npm test`, `npm run build`, puis mise à jour de ce fichier.
