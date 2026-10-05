# État des lieux : intégration du prompt maître

Étape 0 de `docs/PROMPT-MAITRE.md`, faite sur le code de `master` au commit `4815840` (6 octobre 2026). Les quatre sections ont été vérifiées dans le code, pas dans l'historique : lecture des fichiers, captures du mode entraînement aux trois résolutions et `npm test`.

Légende :
- **Fait** : conforme au point et à ses références ;
- **Partiel** : ce qui manque est précisé ;
- **À faire** : rien n'est en place.

## Synthèse

| Section | Fait | Partiel | À faire |
|---|---|---|---|
| A. Table | A1, A2, A3, A4, A8 | A5, A6, A7, A9 | – |
| B. Cartes | B1 à B6 | – | – |
| C. Compte | C1 à C4 | C5 | – |
| D. Garde-robe et coffre | D1, D2, D9 | D3, D4, D5, D6, D7, D8, D10 | D11 |

## A. Table de jeu

| # | État | Ce qui manque | Fichiers |
|---|---|---|---|
| A1 | **Fait** | – Barre de partie, plaques avec jauge plis / mise, panneau de droite, fenêtre de fin de manche (« Je suis prêt », « Coup de la manche »), version téléphone. La croix du pli est remplacée par le pli en ligne (A8). | `web/src/table.ts`, `web/src/game.css` |
| A2 | **Fait** | – Pastille dorée pleine, ligne teintée avec bordure gauche de 3 px (maquette Main) ; le Pacte de Butin a sa ligne de bonus « +20 · X · Pacte de Butin avec Y » pour chacun des deux alliés (lot 1). | `web/src/game.css` (`.lbonus`), `supabase/functions/_shared/engine.ts` |
| A3 | **Fait** | – Les `SIGNED_IN` du même utilisateur sont ignorés ; `shownRound` est conservé d'une table à l'autre pour une même partie en ligne (lot 1). En entraînement, chaque partie repart de zéro. | `web/src/main.ts`, `web/src/table.ts` |
| A4 | **Fait** | – Éventails face cachée cliquables, « Imposée par … » chez la cible, carte choisie montrée aux autres. Le pirate s'appelle désormais Marie Thorne. | `web/src/table.ts`, `web/src/game.css` |
| A5 | **Partiel** | L'écart maximal entre les cartes de la main est plafonné à 0,72 × la largeur, au lieu de 0,96 dans le prompt 1. Tout le reste est conforme : ResizeObserver, hauteur du bloc, 0,38, 44 px, éventail, levée de 12 %. | `web/src/table.ts` (`handLayout`) |
| A6 | **Partiel** | Le délai est de 420 ms au lieu de 450. La largeur de 300 px et la fiche parchemin (nom et règle) sont en place. | `web/src/zoom.ts` |
| A7 | **Partiel** | 1. La mention « en ligne » est affichée en permanence, sans vraie présence. 2. Le lien « Profil » ne fonctionne que pour soi-même, car il n'y a pas de profil public. 3. L'aperçu est absent sur téléphone : le bandeau des adversaires n'y est pas branché. 4. La version bot n'a ni « Bot · niveau moyen » ni « ne comptent pas pour l'Élo ». Le reste est en place : `player.card`, cache, 250 ms, statistiques, objets rares, rien d'interdit. | `web/src/playercard.ts`, `web/src/table.ts`, `supabase/functions/_shared/service.ts` |
| A8 | **Fait** | – Vérifié à 3, 4, 5 et 6 joueurs et sur téléphone. | `web/src/table.ts`, `web/src/game.css` |
| A9 | **Partiel** | 1. Défaut : une ancienne règle `.bstage .mat>svg{opacity:.14}` s'applique aussi à la carte marine, qui devient quasi invisible (opacité ≈ 0,01 au lieu de 0,06 à 0,10). 2. L'ancienne rose des vents reste affichée sous la carte marine. 3. Le réglage « Ambiance sobre » n'existe qu'à la table, pas dans les réglages du profil : à trancher. | `web/src/game.css`, `web/src/ambiance.ts`, `web/src/styles/ambiance.css` |

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
| C5 | **Partiel** | L'objet gagné avec un haut fait n'est pas montré : la maquette FinPartie affiche « Cadre Tentacules · objet légendaire ». Le serveur l'envoie bien (`cosmetics`), mais la table ne le lit pas. Le reste est en place : podium, XP, Élo par adversaire, haut fait, « Ouvrir le coffre ». | `web/src/table.ts` (`fillSettled`) |

## D. Garde-robe et coffre

La mention « à faire en entier » du prompt n'est plus vraie : D1 à D10 existent déjà en grande partie.

| # | État | Ce qui manque | Fichiers |
|---|---|---|---|
| D1 | **Fait** | – Avatar en couches, base gratuite, 6 emplacements, `profiles.look`, initiale si rien n'est choisi. | `web/src/avatar.ts`, migration `20261005000000_cosmetics.sql` |
| D2 | **Fait** | – Les 11 objets reprennent les tracés de la maquette. Écarts mineurs : il n'y a pas de mode silhouette dédié, et la garde-robe montre un avatar qui porte l'objet au lieu du dessin seul. | `web/src/objects.ts` |
| D3 | **Partiel** (écarts de catalogue laissés pour la passe dédiée) | 1. Le catalogue s'écarte de `CAT` (Profil) : Chapeau à plume et Couchant y sont Épique (Rare dans le code), le Jabot Rare (Épique dans le code), les Perles s'appellent « Perles des sirènes », le Singe coûte 200 pièces (120 dans le code). 2. La colonne `variant` de `user_cosmetics` manque. | migrations `cosmetics*.sql`, `web/src/avatar.ts` |
| D4 | **Partiel** (pool de coffre laissé pour la passe dédiée) | Probabilités, couleurs et doublons sont conformes. Mais : 1. le pool Légendaire ne contient que le Poulpe, et le pool Commun que deux objets ; 2. les Perles et le Poulpe, objets de haut fait « uniques et non achetables », peuvent sortir d'un coffre. | `20261006000000_cosmetics_v2.sql` |
| D5 | **Partiel** | 1. Il n'y a pas d'action `shop.list` : l'échoppe passe par `profile.wardrobe`. 2. L'échoppe ne pioche que parmi 3 objets, avec remise : toujours les mêmes, parfois en double. 3. Faille : les couleurs de variante acceptent n'importe quelle valeur hexadécimale, si bien qu'on peut porter une variante sans l'avoir. Le reste est en place : coffre au gagnant (idempotent), `chest.open` transactionnel, `shop.buy`, refus d'un look non possédé. | `supabase/functions/_shared/service.ts`, migrations |
| D6 | **Partiel** | 1. Défaut avec `prefers-reduced-motion` : l'objet obtenu ne s'affiche pas (il reste masqué). 2. Le coffre ne s'assombrit pas une fois l'objet sorti. 3. Les sons sont génériques : pas de grincement, de souffle, ni d'accord plus riche pour Épique et Légendaire. Le reste est en place : les 6 étapes avec leurs durées, et les boutons « Passer », « Ouvrir le suivant », « Équiper ». | `web/src/chest.ts` |
| D7 | **Partiel** | 1. Le badge du coffre est masqué sur téléphone. 2. Il n'est pas mis à jour après une ouverture. 3. L'objet du haut fait n'est pas montré en fin de partie (voir C5). | `web/src/account.ts`, `web/src/table.ts` |
| D8 | **Partiel** | Défauts mineurs : 1. une condition de haut fait s'affiche avec son code brut, par exemple « Haut fait · siren_hunter » ; 2. il reste un bloc « Le porter » mort dans le code. Le reste est en place : 7 onglets, silhouettes avec condition, variantes, « Au hasard », « Annuler », « Enregistrer », échoppe. | `web/src/pages/profile.ts` |
| D9 | **Fait** | – Avatars composés à la table, dans les listes, au classement, dans l'en-tête et dans l'aperçu au survol. | pages, `web/src/playercard.ts` |
| D10 | **Partiel** | Tests manquants : 1. la fréquence de tirage d'un Légendaire ; 2. un test qui passe par l'action `chest.open` elle-même ; 3. l'idempotence des objets de titre et de haut fait ; 4. le refus d'une variante non possédée. | `tests/service.test.ts` |
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
