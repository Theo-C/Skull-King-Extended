# État des lieux : intégration du prompt maître

Étape 0 de `docs/PROMPT-MAITRE.md`, faite sur le code de `master` au commit `4815840` (6 octobre 2026). Les quatre sections ont été vérifiées dans le code, pas dans l'historique : lecture des fichiers, captures du mode entraînement aux trois résolutions et `npm test`.

Légende :
- **Fait** : conforme au point et à ses références ;
- **Partiel** : ce qui manque est précisé ;
- **À faire** : rien n'est en place.

## Synthèse

| Section | Fait | Partiel | À faire |
|---|---|---|---|
| A. Table | A1 à A6, A8, A9 | A7 | – |
| B. Cartes | B1 à B6 | – | – |
| C. Compte | C1 à C5 | – | – |
| D. Garde-robe et coffre | D1, D2, D5, D6, D7, D8, D9, D10 | D3, D4 | D11 |

## A. Table de jeu

| # | État | Ce qui manque | Fichiers |
|---|---|---|---|
| A1 | **Fait** | – Barre de partie, plaques avec jauge plis / mise, panneau de droite, fenêtre de fin de manche (« Je suis prêt », « Coup de la manche »), version téléphone. La croix du pli est remplacée par le pli en ligne (A8). | `web/src/table.ts`, `web/src/game.css` |
| A2 | **Fait** | – Pastille dorée pleine, ligne teintée avec bordure gauche de 3 px (maquette Main) ; le Pacte de Butin a sa ligne de bonus « +20 · X · Pacte de Butin avec Y » pour chacun des deux alliés (lot 1). | `web/src/game.css` (`.lbonus`), `supabase/functions/_shared/engine.ts` |
| A3 | **Fait** | – Les `SIGNED_IN` du même utilisateur sont ignorés ; `shownRound` est conservé d'une table à l'autre pour une même partie en ligne (lot 1). En entraînement, chaque partie repart de zéro. | `web/src/main.ts`, `web/src/table.ts` |
| A4 | **Fait** | – Éventails face cachée cliquables, « Imposée par … » chez la cible, carte choisie montrée aux autres. Le pirate s'appelle désormais Marie Thorne. | `web/src/table.ts`, `web/src/game.css` |
| A5 | **Fait** | – Écart maximal entre les cartes : 0,96 × largeur, comme le prompt 1 (lot 3) ; ResizeObserver, hauteur du bloc, 0,38, 44 px, éventail, levée de 12 %. | `web/src/table.ts` (`handLayout`) |
| A6 | **Fait** | – Zoom après 450 ms de survol (lot 3), carte de 300 px, fiche parchemin avec le nom et la règle. | `web/src/zoom.ts` |
| A7 | **Partiel** | 1. La mention « en ligne » est affichée en permanence, sans vraie présence. 2. Le lien « Profil » ne fonctionne que pour soi-même, car il n'y a pas de profil public. 3. L'aperçu est absent sur téléphone : le bandeau des adversaires n'y est pas branché. 4. La version bot n'a ni « Bot · niveau moyen » ni « ne comptent pas pour l'Élo ». Le reste est en place : `player.card`, cache, 250 ms, statistiques, objets rares, rien d'interdit. | `web/src/playercard.ts`, `web/src/table.ts`, `supabase/functions/_shared/service.ts` |
| A8 | **Fait** | – Vérifié à 3, 4, 5 et 6 joueurs et sur téléphone. | `web/src/table.ts`, `web/src/game.css` |
| A9 | **Fait** | – Carte marine visible (l'opacité réduite de l'ancienne rose ne s'applique plus à elle), ancienne rose masquée en ambiance pirate, réglage pirate / sobre à la table et dans le profil (lot 3). | `web/src/game.css`, `web/src/styles/ambiance.css`, `web/src/pages/profile.ts` |

## B. Cartes illustrées

| # | État | Ce qui manque | Fichiers |
|---|---|---|---|
| B1 | **Fait** | – Les 24 fichiers sont branchés selon la table de correspondance (`con` → `corbin.webp`, car « CON » est réservé sous Windows), avec préchargement. | `web/src/cards.ts` |
| B2 | **Fait** | – Chiffres aux positions et couleurs du prompt, en tenant compte du recadrage de l'image ; sceaux +10, +20, −5 et +5 ; « 0·14 ». | `web/src/cards.ts`, `web/src/game.css` |
| B3 | **Fait** | – Pastilles de `pastilles.json`, aucune sur Morgane, positions distinctes pour les pirates et Con d'un côté, Skull King et les sirènes de l'autre. | `web/src/cards.ts`, `web/src/game.css` |
| B4 | **Fait** | – Coins de 13 px et ombre ; si l'image ne se charge pas, l'ancienne face prend le relais (vérifié) ; le dos est inchangé. | `web/src/cards.ts`, `web/src/main.ts` |
| B5 | **Fait** | – Aucun chiffre n'est ajouté sur le Grand Quinze. | `web/src/cards.ts` |
| B6 | **Fait** | – Noms officiels partout ; derniers restes corrigés au lot 2 : la question de Con (« Con le belliqueux : quel pouvoir volez-vous ? ») et les descriptions des hauts faits Fil-de-Soie (Marie Thorne) et La Sirène et le Roi (Skull King), dans `settle.ts` et en base (migration `20261008000000_noms_officiels.sql`). Le nom du haut fait « Fil-de-Soie » est conservé. | `web/src/table.ts`, `supabase/functions/_shared/settle.ts`, migration |

## C. Compte et progression

| # | État | Ce qui manque | Fichiers |
|---|---|---|---|
| C1 | **Fait** | – Toutes les pages, l'en-tête et la barre d'onglets du téléphone. Écarts mineurs : le profil n'a pas le bouton « Supprimer mon compte » de la maquette, et « Créer une partie » ouvre d'abord un formulaire au lieu d'aller directement au salon. | `web/src/pages/*.ts`, `web/src/account.ts`, `web/src/main.ts` |
| C2 | **Fait** | – XP : 50 / 10 / 100 / 25 ; niveau suivant à 250 × L ; titres. Le tout est testé. | `supabase/functions/_shared/xp.ts`, `settle.ts`, `web/src/xp.ts` |
| C3 | **Fait** | – Formule et affichage partout. Ne comptent pas pour l'Élo : les parties avec un bot ou de moins de 10 manches (choix validé). La règle « abandon = dernière place » de la spec est sans objet, puisqu'on ne peut pas quitter une partie commencée. | `supabase/functions/_shared/elo.ts`, `settle.ts`, pages |
| C4 | **Fait** | – Tables, règlement côté serveur idempotent (testé), classement amis / tous. Les descriptions des hauts faits relèvent de B6. | `supabase/migrations/`, `settle.ts`, `service.ts` |
| C5 | **Fait** | – Podium, XP, Élo par adversaire, « Ouvrir le coffre » ; chaque objet gagné avec un haut fait ou un titre est dessiné avec sa rareté (« Haut fait · Pari du Kraken — Tentacules, objet légendaire, réservé à ce haut fait »), les hauts faits sans objet gardent leur médaille (lot 4). | `web/src/table.ts` (`rewardsHTML`), `web/src/app.css` |

## D. Garde-robe et coffre

La mention « à faire en entier » du prompt n'est plus vraie : D1 à D10 existent déjà en grande partie.

| # | État | Ce qui manque | Fichiers |
|---|---|---|---|
| D1 | **Fait** | – Avatar en couches, base gratuite, 6 emplacements, `profiles.look`, initiale si rien n'est choisi. | `web/src/avatar.ts`, migration `20261005000000_cosmetics.sql` |
| D2 | **Fait** | – Les 11 objets reprennent les tracés de la maquette. Écarts mineurs : il n'y a pas de mode silhouette dédié, et la garde-robe montre un avatar qui porte l'objet au lieu du dessin seul. | `web/src/objects.ts` |
| D3 | **Partiel** (écarts de catalogue laissés pour la passe dédiée) | 1. Le catalogue s'écarte de `CAT` (Profil) : Chapeau à plume et Couchant y sont Épique (Rare dans le code), le Jabot Rare (Épique dans le code), les Perles s'appellent « Perles des sirènes », le Singe coûte 200 pièces (120 dans le code). 2. La colonne `variant` de `user_cosmetics` manque. | migrations `cosmetics*.sql`, `web/src/avatar.ts` |
| D4 | **Partiel** (pool de coffre laissé pour la passe dédiée) | Probabilités, couleurs et doublons sont conformes. Mais : 1. le pool Légendaire ne contient que le Poulpe, et le pool Commun que deux objets ; 2. les Perles et le Poulpe, objets de haut fait « uniques et non achetables », peuvent sortir d'un coffre. | `20261006000000_cosmetics_v2.sql` |
| D5 | **Fait** | Lot 5 : nouvelle action `shop.list`. L'échoppe du jour propose 3 objets distincts, dans un ordre qui change chaque jour (migration `20261009000000_echoppe_sans_doublon.sql`) ; le stock reste de 3 objets « shop », en attendant la passe sur le catalogue. Le serveur refuse une couleur qui n'est pas une variante d'une version possédée de l'objet porté. Côté client, une couleur périmée (objet équipé depuis le coffre, par exemple) revient à la première variante possédée avant l'envoi. Tests dans `tests/service.test.ts`. Le reste était déjà en place : coffre au gagnant (idempotent), `chest.open` transactionnel, `shop.buy`, refus d'un look non possédé. | `supabase/functions/_shared/service.ts`, `supabase/functions/game/index.ts`, `web/src/pages/profile.ts`, migration |
| D6 | **Fait** | Lot 6 : avec `prefers-reduced-motion`, l'objet s'affiche directement, couvercle ouvert et teinte de rareté (« Passer » utilise le même rendu). Le coffre s'assombrit quand l'objet sort. Sons propres au coffre dans `web/src/sound.ts`, coupés avec l'option Sons : grincement à la secousse, souffle pendant la lueur, accord au changement de teinte (2 notes en Commun, jusqu'à 5 notes plus longues en Légendaire), ouverture. Le reste était déjà en place : les 6 étapes avec leurs durées, et les boutons « Passer », « Ouvrir le suivant », « Équiper ». | `web/src/chest.ts`, `web/src/sound.ts` |
| D7 | **Fait** | Lot 7 : le badge du coffre reste visible sur téléphone, à côté de « Règles ». `chestBadge(n)` (dans `web/src/account.ts`) le remet à jour après chaque ouverture, depuis la garde-robe ou depuis la fin de partie. « Équiper » depuis la fin de partie met aussi la couleur de l'objet sur sa première variante (`withItem`, dans `web/src/avatar.ts`), comme dans la garde-robe. L'objet du haut fait en fin de partie a été fait au lot 4 (C5). | `web/src/account.ts`, `web/src/app.css`, `web/src/pages/game.ts`, `web/src/pages/profile.ts`, `web/src/chest.ts` |
| D8 | **Fait** | Lot 8 : la condition d'un objet de haut fait affiche le nom du haut fait (« Haut fait · Chasseur de sirènes »), lu dans la table `achievements`. Le bloc « Le porter » (`st.reveal`), jamais affiché depuis l'arrivée de la superposition du coffre, est supprimé avec son CSS. Le reste était déjà en place : 7 onglets, silhouettes avec condition, variantes, « Au hasard », « Annuler », « Enregistrer », échoppe. | `web/src/pages/profile.ts`, `web/src/app.css` |
| D9 | **Fait** | – Avatars composés à la table, dans les listes, au classement, dans l'en-tête et dans l'aperçu au survol. | pages, `web/src/playercard.ts` |
| D10 | **Fait** | Lot 10 : ajout de la fréquence de tirage Légendaire (environ 3 %, sur 1 000 graines ; le Poulpe est le seul légendaire du coffre), d'ouvertures par l'action `chest.open` elle-même (un succès, puis un refus sans coffre), et de l'idempotence des objets de titre et de haut fait (`tests/account.test.ts` : tricorne au niveau 5 et cadre de kraken_bet donnés une fois, rien de redonné s'ils sont déjà possédés). Le refus d'une variante non possédée a été couvert au lot 5. Déjà en place : probabilités Commun, Rare et Épique, refus à 0 coffre, doublons, idempotence du règlement. | `tests/service.test.ts`, `tests/account.test.ts` |
| D11 | **À faire** | Rien dans le code. Ce qu'il faut faire : 1. une rareté Mythique à 1 %, avec un doublon à 400 pièces ; 2. 6 cartes animées ; 3. les vidéos, dans `web/public/cards/anim/` mais pas encore suivies par git (7 Mo) ; 4. l'affichage de la vidéo en main au survol, dans le pli et au zoom ; 5. un réglage « toutes / les miennes / aucune » ; 6. un onglet Cartes dans la garde-robe et une variante de l'animation du coffre. | voir `docs/cartes-animees/` |

## Décisions (validées le 6 octobre)

1. **Probabilités du coffre** : 61 / 26 / 9 / 3 / 1 (Mythique 1 %, prise sur le Commun).
2. **Cartes animées** : posséder une carte suffit pour qu'elle soit animée, sans interrupteur dans la garde-robe. Le réglage « Cartes animées : toutes / les miennes / aucune » est disponible au même endroit que le son : barre et menu de la table, pendant la partie, et profil.
3. **Halo d'arrivée d'une carte animée** : 1,2 s.
4. **Catalogue** (raretés, noms, prix) : inchangé. Une passe dédiée définira plus tard l'ensemble des objets et leurs raretés. Cela vaut aussi pour les objets de haut fait dans les coffres (D4) : pas de changement pour l'instant.
5. **Réglages pendant la partie** : le son, l'ambiance (pirate / sobre) et les cartes animées se règlent à tout moment, à la table comme dans le profil.
6. **Suppression de compte** : traitée plus tard.
7. **Carte animée en main** : la vidéo démarre dès que la carte arrive dans la main, et non au survol. Pour ménager l'appareil : une seule lecture par vidéo, pause quand l'onglet est masqué, image fixe sous `prefers-reduced-motion`, en économie de données ou avec le réglage « aucune ».

## Ordre des lots

Ordre conseillé par le prompt, en ne gardant que ce qui reste :
1. **A3 et A2** : corrections rapides.
2. **B6** : derniers noms, avec une migration pour les descriptions des hauts faits.
3. **A5, A6, A9, A8** : délais, écart des cartes, carte marine.
4. **C5** : objet du haut fait en fin de partie.
5. **D** :
   - **Serveur** : D3, D4, D5.
   - **Site** : D6, D7, D8.
   - **Tests** : D10.
   - **Cartes animées** : D11.
6. **A7**, en dernier.

Un commit par lot ; après chacun, `npm test`, `npm run build` et mise à jour de ce fichier.
