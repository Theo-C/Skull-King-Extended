# État des lieux : intégration du prompt maître

Étape 0 de `docs/PROMPT-MAITRE.md`, tenu à jour après chaque lot (branche `prompt-maitre`, 5 octobre 2026).

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
| A6 | Zoom après 450 ms de survol : carte de 300 px et fiche parchemin avec nom et règle | **Fait** | Le zoom s'ouvre après 450 ms de survol, 380 ms d'appui au doigt, ou au focus clavier. La carte s'affiche sur 300 px avec, à côté, une fiche parchemin qui donne le nom et la règle. La règle vient de `DESC` et `PIRATES[…].pw`, sans répéter le nom. Une pastille de verdict s'affiche sous la carte. Sur téléphone, la fiche passe sous la carte. | `web/src/zoom.ts`, `web/src/cards.ts` (`ruleOf`), `web/src/game.css` |
| A7 | Aperçu d'un joueur au survol (maquette `ApercuJoueur`, action `player.card`) | **Fait** | L'aperçu s'ouvre après 250 ms de survol d'une plaque, ou au toucher dans le bandeau du téléphone. Il se ferme en quittant la zone, par un clic ailleurs ou avec Échap. Il ne passe jamais sur la main ni sur la barre de partie, et se place à côté du pli. Contenu : identité (avatar porté, niveau, titre, Élo et tendance sur les 5 dernières parties classées, présence en ligne par Realtime) ; cette partie (place, score, barre manche par manche) ; victoires, mises tenues et parties ; objets rares portés ; lien « Profil › » vers la nouvelle page `#/joueur/<id>`. Version courte pour les bots. Les fiches sont mises en cache pour toute la partie. | `web/src/playercard.ts`, `web/src/table.ts` (`seatInfo`, `setOnline`), `web/src/pages/game.ts`, `web/src/pages/profile.ts` (`playerPage`), `web/src/main.ts`, `supabase/migrations/20261005000100_player_card.sql`, `service.ts` |

## B. Cartes illustrées

| # | Point | État | Détail | Fichiers |
|---|---|---|---|---|
| B1 | Les 24 `web/public/cards/*.webp` branchées, selon la table de correspondance | **Fait** | Table `ART` avec les 24 clés du prompt. `con.webp` est renommé `corbin.webp` : `CON` est un nom réservé sous Windows, et git ne peut pas y indexer ce fichier. Les images sont préchargées à l'ouverture de la table, avec un chemin relatif `cards/…` pour Capacitor. Planche de contrôle vérifiée : 88 cartes, 88 images chargées. | `web/src/cards.ts`, `web/src/table.ts` |
| B2 | Chiffre dans le médaillon des cartes numérotées, sceaux +10 / +20 / −5 / +5, cas 0·14 | **Fait** | Chiffre en Pirata One aux couleurs du prompt. Sceaux : +10 pour un 14, +20 pour le 14 noir, −5 en rouge pour le 7 de l'extension, +5 pour le 8. Le 0/14 affiche « 0·14 » sans sceau. Les positions sont converties dans le repère 252 × 352, car l'image est rognée de 3 px en haut et en bas. | `web/src/cards.ts`, `web/src/game.css` |
| B3 | Pastille de pouvoir sur les personnages (`pastilles.json`), sans pastille pour Morgane | **Fait** | Pastilles dorées, décalées pour Barbe-Cendre et les sirènes. Morgane n'en a pas. | `web/src/cards.ts`, `web/src/game.css`, `web/src/pastilles.json` (copie de `docs/cartes-v3/pastilles.json`) |
| B4 | Coins arrondis et ombre de `.card` alignés sur l'image, anciennes faces en repli, dos inchangé | **Fait** | Rayon de 13 px × `--s` et ombre conservés. Sur toutes les pages, une image qui ne se charge pas est remplacée par l'ancienne face « Mers Sauvages ». Le dos est inchangé. | `web/src/cards.ts` (`installArtFallback`), `web/src/main.ts`, `web/src/game.css` |
| B5 | Le Grand Quinze garde son « 15 » dessiné | **Fait** | Aucun chiffre ajouté sur la carte `wild` | `web/src/cards.ts` |

## C. Compte et progression

| # | Point | État | Détail | Fichiers |
|---|---|---|---|---|
| C1 | Pages Accueil, AccueilMobile, Salon, Profil, Historique, DetailPartie, Classement, `AppBar` et barre d'onglets | **Fait** | Conformes aux maquettes, qui n'ont pas changé, sauf Profil, traité en D8. | `web/src/pages/*.ts`, `web/src/account.ts`, `web/src/app.css`, `web/src/screens.css`, `web/index.html` |
| C2 | XP : +50 / +10 / +100 / +25, niveau suivant à 250 × L, titres de Mousse à Légende des 7 mers | **Fait** | Même formule côté serveur et côté site | `supabase/functions/_shared/xp.ts`, `web/src/xp.ts` |
| C3 | Élo : départ à 100, minimum 0, calcul par paires, diviseur 100, K = 40 puis 20, bots exclus ; affiché partout | **Fait** | Visible dans le profil, l'historique, le détail, la fin de partie (par adversaire) et le classement. Hors liste mais dans la spec : un abandon en cours de partie ne compte pas comme dernière place, car l'abandon n'existe pas encore. | `supabase/functions/_shared/elo.ts`, `settle.ts`, `web/src/table.ts`, `web/src/pages/*.ts` |
| C4 | Hauts faits, `game_results`, `player_stats`, `xp_events`, classement amis ou tous, `settleGame` idempotent | **Fait** | Le règlement est refait s'il a échoué, avec des verrous ordonnés. Il donne aussi les récompenses de la garde-robe (lot D), dans la même transaction. | `supabase/migrations/`, `supabase/functions/_shared/settle.ts`, `service.ts` |
| C5 | Écran de fin de partie : podium, XP, Élo par adversaire, haut fait, bouton « Ouvrir le coffre » | **Fait** | Podium, XP, Élo et haut fait. S'y ajoutent : l'objet du haut fait ou du titre franchi, montré porté ; les pièces gagnées ; le coffre de victoire. Le coffre est cliquable : l'ouverture se fait sur place avec l'animation, puis l'objet obtenu s'affiche. | `web/src/table.ts` (`finalOverlay`, `fillSettled`, `rewardsHTML`, `wireChest`), `web/src/pages/game.ts`, `web/src/game.css` |

## D. Garde-robe et coffre

Choix validés le 5 octobre :
- **Personnage seul** : la photo de profil et les pirates illustrés disparaissent de l'éditeur. Les anciens pirates illustrés restent affichés, en version composée, tant que le joueur n'a pas enregistré de look.
- **Rétroactivité** : les objets des titres et des hauts faits déjà obtenus sont attribués par la migration.
- **Cadre d'or du top 3 du mois** : remis à plus tard. Il est dans le catalogue, mais pas encore distribué.

| # | Point | État | Détail | Fichiers |
|---|---|---|---|---|
| D1 | Avatar en couches SVG : base gratuite (teint, coiffure, cheveux, pilosité, manteau) et 6 emplacements ; `profiles.look` en jsonb | **Fait** | `avatarSVG(look, color)` reprend les tracés de la maquette Avatar, dans l'ordre d'empilement de la spec. Le manteau prend la couleur du joueur. L'initiale s'affiche tant que rien n'est choisi. | `web/src/avatar.ts`, `supabase/migrations/20261005000000_wardrobe.sql` |
| D2 | Les 11 objets dessinés | **Fait** | `objectSVG` couvre les 11 objets, plus l'objet mystère, avec une version silhouette. `itemPreview` montre un personnage qui porte l'objet quand celui-ci n'a pas de dessin dédié (décors, cadres…). | `web/src/objects.ts` |
| D3 | Tables `cosmetics`, `user_cosmetics`, `user_wallet`, catalogue `CAT` de la maquette Profil | **Fait** | 29 objets, et un journal des coffres. RLS : le catalogue et les looks sont publics ; les objets, le porte-monnaie et le journal sont visibles par leur seul propriétaire. Toute écriture passe par l'Edge Function. Le catalogue est partagé avec le TypeScript, et un test vérifie que les deux concordent. | `supabase/functions/_shared/cosmetics.ts`, `supabase/migrations/20261005000000_wardrobe.sql` |
| D4 | Raretés 62 / 26 / 9 / 3 %, leurs couleurs, doublon converti en 30 / 80 / 140 / 200 pièces | **Fait** | Le tirage est fait côté serveur, avec un générateur à graine pour les tests. Les objets de haut fait et le cadre du top 3 ne sortent jamais d'un coffre. | `cosmetics.ts`, `chest_open` (SQL) |
| D5 | Coffre au gagnant humain, actions `chest.open`, `shop.list` et `shop.buy`, `profile.update` qui refuse un look non possédé | **Fait** | En fin de partie en ligne, chaque joueur gagne 10 pièces plus 5 par mise tenue, et le gagnant humain reçoit un coffre. S'y ajoutent les objets des titres franchis et des nouveaux hauts faits. L'ouverture et l'achat se font en une transaction. L'échoppe propose chaque jour 3 objets communs ou rares, choisis à partir de la date (heure de Paris) : 60 pièces pour un commun, 150 pour un rare. | `settle.ts`, `service.ts`, migration |
| D6 | Animation d'ouverture en 6 étapes, boutons « Passer », « Ouvrir le suivant » et « Équiper », mouvement réduit | **Fait** | Secousse 0,9 s, lueur blanche de 1,5 à 2,5 s selon la rareté, teinte, ouverture avec étincelles, objet, doublon qui fond en pièces. Les sons sont synthétisés et coupés si l'option Sons est désactivée. Le focus est piégé dans la fenêtre. | `web/src/chest.ts`, `web/src/chest.css` |
| D7 | Accès au coffre : fin de partie, garde-robe, badge dans l'en-tête | **Fait** | Bouton « Ouvrir le coffre » en fin de partie, bouton « Ouvrir N coffres de victoire » dans la garde-robe, et badge en forme de coffre sur la pastille de profil. | `web/src/table.ts`, `web/src/pages/profile.ts`, `web/src/account.ts` |
| D8 | Garde-robe : 7 onglets, silhouettes verrouillées avec condition, variantes, Au hasard / Annuler / Enregistrer, échoppe de 3 objets par jour | **Fait** | Grand aperçu et aperçu « à la table ». Badge « Nouveau » sur les objets reçus depuis moins de 3 jours. Accessible au clavier : onglets et choix au focus itinérant, boutons de 44 px. | `web/src/pages/profile.ts`, `web/src/app.css` |
| D9 | Avatars composés partout : table, listes, classement, aperçu | **Fait** | La colonne `look` est lue partout : table, accueil, salon, historique, détail, classement. Si la migration n'est pas appliquée, la requête est refaite sans elle. | `web/src/avatar.ts`, `web/src/account.ts` (`withLook`), `web/src/pages/*.ts` |
| D10 | Tests : probabilités (graine fixe), refus à 0 coffre, doublons, idempotence, look invalide | **Fait** | Couverts : probabilités sur 200 000 tirages ; refus sans coffre ; coffre impossible à ouvrir deux fois ; doublon converti en pièces ; récompenses non doublées ; look invalide ; échoppe ; concordance du catalogue ; formule de niveau des objets rétroactifs. | `tests/account.test.ts`, `tests/service.test.ts`, `tests/sql.test.ts` |

## Déjà connu et hors liste

- Abandon en cours de partie et Élo (spec du compte) : non géré.
- Bouton « Supprimer mon compte » : absent. Supprimer un compte effacerait aussi les parties qu'il a créées, et donc l'historique des autres joueurs (`games.host` est en cascade).
- Contrôle final avec deux comptes réels : pas encore fait.
- Déploiement : appliquer les migrations `20261004000000_account_audit.sql`, `20261005000000_wardrobe.sql` et `20261005000100_player_card.sql`, puis redéployer la fonction `game`.

## Avancement

Lots faits, un commit chacun, avec `npm test` et `npm run build` au vert après chacun :
1. B : cartes illustrées, et A6 (zoom avec fiche).
2. D côté serveur, puis D côté site, avec C5 (coffre en fin de partie).
3. A7 : aperçu au survol.

A2, A3, A4, A5, C1 à C4 étaient déjà faits.

**Reste, hors code :** le contrôle final du prompt maître avec deux comptes réels, après le déploiement ci-dessus. Il s'agit de jouer une partie complète, puis de vérifier :
- les cartes, le zoom, Lise et l'Alt-Tab ;
- la fin de partie, avec l'XP, l'Élo et le coffre ;
- l'ouverture du coffre et l'équipement de l'objet ;
- que l'objet est visible chez l'autre joueur, à la table et dans l'aperçu au survol ;
- l'affichage en 1366 × 768, 1920 × 1080 et 390 × 844.
