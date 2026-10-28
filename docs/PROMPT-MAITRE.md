# Prompt maître : tout intégrer, sans rien oublier

Ce dossier rassemble tout ce qui a été conçu pour le site. Une partie est peut-être déjà dans le code, une partie non. **Le coffre et les objets (loot) ne sont pas encore intégrés.**

## Contenu du dossier

| Chemin | Contenu |
|---|---|
| `web/public/cards/*.webp` | 24 faces de cartes illustrées, bord blanc, 720 × 1024 |
| `docs/cartes-v3/` | Prompt d'intégration des cartes, positions des médaillons, `pastilles.json`, planche de contrôle |
| `docs/table-v2/SPEC.md` | Table de jeu v2 : plaques, pli, tour, panneau, mises, fin de manche, animations, mobile |
| `docs/ecrans-compte/SPEC.md` | Écrans du compte, XP, Élo, garde-robe, coffre |
| `docs/ecrans-compte/PROMPT-claude-code.md` | Prompts 1 à 3 (main, écrans du compte, garde-robe) |
| `web/public/cards/anim/` | 6 cartes animées : vidéo en boucle (webm + mp4) et cadre seul à poser par-dessus (`*-cadre.webp`) |
| `docs/maquettes/*.dc.html` | **Toutes** les maquettes, dans leur dernière version. Ouvre-les comme du HTML. Les données d'exemple et la logique sont dans le `<script type="text/x-dc">` en bas de chaque fichier. Lis-les pour la mise en page, ne copie pas le format `.dc.html`. |

## Étape 0 : état des lieux (obligatoire, avant d'écrire du code)

1. Parcours le repo, puis crée `docs/ETAT.md` avec la liste de contrôle ci-dessous. Pour chaque ligne, indique **Fait**, **Partiel** (précise ce qui manque) ou **À faire**, et note les fichiers concernés.
2. Montre-moi `docs/ETAT.md` et attends ma validation avant de coder.
3. Ensuite, traite les lots dans l'ordre. Fais un commit par lot. Après chaque lot : `npm test`, `npm run build`, mise à jour de `docs/ETAT.md`.

## Liste de contrôle

### A. Table de jeu (`docs/table-v2/SPEC.md`, maquettes `Main`, `Bid`, `RoundEnd`, `Mobile`)
- [ ] A1. Barre de partie unique, plaques de joueur avec mise / plis, pli au centre, panneau de droite, fin de manche, version téléphone.
- [ ] A2. Journal : les bonus (14, Sirène capturée, pirate capturé par Barbe-Cendre, Butin…) sont mis en valeur par une pastille dorée « +30 », avec « compte si sa mise est tenue ».
- [ ] A3. Bug d'Alt-Tab : changer de fenêtre ou réduire la fenêtre ne doit **jamais** afficher l'écran de fin de manche. Cause : supabase-js renvoie `SIGNED_IN` au retour du focus, ce qui relance la route et recrée `TableView` avec `shownRound = 0`. Ignore les `SIGNED_IN` quand l'utilisateur ne change pas, et conserve `shownRound` d'une instance à l'autre.
- [ ] A4. Pouvoir de Lise Fil-de-Soie (maquettes `Lise`, `LiseCible`, `LiseAutres`) :
  - les mains adverses apparaissent face cachée et sont cliquables ;
  - la cible voit sa carte imposée surlignée, avec l'étiquette « Imposée par … » ;
  - les autres joueurs voient quelle carte a été choisie.
- [ ] A5. Cartes de la main : leur taille suit la hauteur du bloc (prompt 1 de `docs/ecrans-compte/PROMPT-claude-code.md`), sans agrandir le bloc.
- [ ] A6. Zoom au survol long (450 ms) : la carte s'affiche sur 300 px de large, avec à côté une fiche parchemin qui donne le nom et la règle.
- [ ] A8. Pli en ligne : les cartes du pli s'alignent au centre de gauche à droite, dans l'ordre de pose, avec le rang et le nom de chaque joueur, des places vides pour ceux qui doivent encore jouer et la carte qui mène entourée d'or. Détails dans `docs/table-v2/PLI-EN-LIGNE.md`, maquette `PliOrdre`.
- [ ] A9. Ambiance pirate de la table (maquette `TableAmbiance`, détails dans `docs/table-v2/AMBIANCE.md`) : cabine en planches, table en bois cloutée de laiton, tapis en carte marine très discrète, lanterne et hublot dans les coins vides, rang du pli en sceau de cire, couleur demandée sur parchemin, manches en nœuds de corde. Option « Ambiance sobre » dans les réglages.
- [ ] A10. GIF en partie : recherche de GIF (KLIPY, via l'Edge Function) intégrée au panneau Réactions (un seul champ, bouton GIF dedans, suggestions en tapant, `/gif`), et envoi à la table. Le GIF surgit au centre du tapis et monte en se balançant, semi-transparent, comme une émote Twitch (3,2 s). Débit de 1 GIF toutes les 10 s, option pour masquer. Voir `docs/gif/` et la maquette `GifPartie`.
- [ ] A11. **À qui de jouer** : plaque du joueur actif qui passe au doré pour toute la table (avec mini-mèche), votre main mise en avant (rail doré, cartes levées, non jouables grisées), cloche au début de votre tour, mèche sur la corde du rail qui brûle jusqu'à un baril (si une limite de temps est réglée, règle à trancher : `turn_limit` null par défaut), titre d'onglet qui clignote. Voir `docs/tour-de-jeu/` et la maquette `TourDeJeu`.
- [ ] A12. **Son « carte posée »** : 3 variantes jouées au moment où la carte touche le tapis (volume plus bas pour les cartes des autres), pour **toutes** les cartes, via un gestionnaire Web Audio commun `web/src/sfx.ts`. Voir `docs/sons/PROMPT-son-carte.md`.
- [ ] A13. **Pouvoir de Juanita Jade** : les cartes non distribuées sur un seul écran, sans défilement (petites cases triées par couleur, spéciales en pastilles, aperçu en grand au survol), **sans aucune déduction faite pour le joueur** (pas de « chez les autres », pas de cases vides), et une seule consultation. Voir `docs/juanita/` et la maquette `Juanita`.
- [ ] A14. *(en pause, ne pas faire pour l'instant)* Pose d'une carte Mythique avec impact « à la Hearthstone » et sons `mythique-*`. Voir `docs/impact-mythique/`.
- [ ] A15. **Curseur du jeu** : un seul curseur partout, flèche en laiton gravé (point actif 2 2, haute densité), curseur texte dans les champs, rien au tactile, case « Curseur du système ». Voir `docs/curseurs/` et la maquette `Curseurs`.
- [ ] A16. **Pose des cartes** : la carte voyage de la main (ou de la plaque de l'adversaire, face cachée qui se retourne en vol) jusqu'au pli, en arc, puis se pose, sans aucun fondu ; son `carte-posee` à l'atterrissage. Voir `docs/pose-carte/` et la maquette `PoseCarte`.
- [ ] A17. **Décor « Plage » animé** en fond de table : vidéo en boucle de 8 s (vagues, lanterne, éclats d'or, bandanas, nuages, mouette, sable), tonneau central fixe, image fixe en repli. Voir `docs/decors/` et la maquette `DecorPlage`.
- [ ] A18. **Ambiance sonore de la table** : boucle de fond discrète de 60 s (cale de navire, houle, craquements, lanterne), lue sans couture en Web Audio, avec fondus, bouton rapide sur la table et réglage « Ambiance » avec volume, désactivable à tout moment. Voir `docs/sons/ambiance/PROMPT-claude-code.md`.
- [ ] A19. **Juke-box partagé** (à la Watch2Gether) : liens YouTube ou SoundCloud ajoutés à une file commune, lecture synchronisée chez tous les joueurs avec les lecteurs officiels, vote pour passer, quotas, contrôles de l'hôte, volume et sourdine perso, ambiance baissée pendant la musique. Voir `docs/jukebox/` et la maquette `Jukebox`.
- [ ] A20. **Défis cachés** : un défi secret par joueur et par partie, reçu à une manche au hasard (Facile / Corsé / Légendaire), vérifié par le serveur, récompensé en pièces, coffres, XP ou titres, sans effet sur le score. Révélation à toute la table avant les scores, avec le « moment clé ». Désactivé en classée. Voir `docs/defis/` et les maquettes `DefiRecu` et `DefiRevelation`.
- [ ] A7. Aperçu d'un joueur au survol (maquette `ApercuJoueur`) :
  - contenu : identité, niveau, titre, Élo et tendance, présence en ligne ; barre manche par manche de la partie en cours ; 3 stats (victoires, mises tenues, parties) ; objets rares portés ; lien vers le profil ;
  - comportement : ouverture après 250 ms de survol ou au toucher, une version courte pour les bots ;
  - données : action `player.card` de l'Edge Function, avec mise en cache côté client pour toute la partie ;
  - ne pas inclure : style de jeu, face-à-face, haut fait.

### B. Cartes illustrées (`docs/cartes-v3/PROMPT-claude-code.md`, Prompt A)
- [ ] B1. Les 24 images `web/public/cards/*.webp` sont branchées dans `cards.ts`. Il reste à vérifier la table de correspondance du prompt : personnages, sirènes, cartes spéciales, 4 couleurs, Fosse des Noyés, Grand Quinze.
- [ ] B2. Les cartes numérotées affichent leur chiffre dans le médaillon vide. Positions et couleurs sont dans le prompt, avec les sceaux +10 / +20 / −5 / +5 et le cas 0·14.
- [ ] B3. Pastille de pouvoir dorée sur le médaillon en haut à gauche des personnages (contenu dans `pastilles.json`). Morgane n'en a pas.
- [ ] B4. Coins arrondis et ombre de `.card` alignés sur l'image. Les anciennes faces restent comme solution de repli, et le dos est inchangé.
- [ ] B5. Le Grand Quinze garde son « 15 » dessiné : n'ajoute aucun chiffre par-dessus.
- [ ] B6. Les noms des personnages dans le code correspondent exactement à ceux écrits sur les cartes : Rosie la douce, Bendt le Ripate, Rascal le Flambeur, Juanita Jade, Harry le géant, Marie Thorne, Con le belliqueux, Skull King, sirènes Alyra et Circé, Morgane la Louve. Cela concerne le moteur, les règles, le journal, le zoom et les bots. Les maquettes utilisent encore d'anciens noms (Lise Fil-de-Soie, Barbe-Cendre…) : ce sont des exemples, les noms des cartes font foi.
- [x] B7. **Cartes en couches** : chaque carte découpée en 2 calques alignés au pixel, le cadre peint d'origine (fenêtre transparente, `cards/calques/cadre_*.webp`) par-dessus l'illustration seule (`illu_*.jpg`). Identique au repos, et seule l'illustration bouge quand on anime : plus aucune cassure du bord. À faire avant D11 et D14. Voir `docs/cartes-couches/` et les maquettes `CarteVar`, `CarteCouches`.
- [x] B8. **Personnages sans bandeau + variantes renforcées** : le parchemin du nom disparaît des pirates, sirènes et Skull King (illustration jusqu'en bas, nom au survol). Masques par carte `marge_` (toute la bordure blanche), `foil_` (fond seul) et `fond_`. Holo texturé sur le fond seulement, Vivante en 2 plans avec mer qui ondule, Signée en dorure à chaud. Après B7, avant D14. Prompt `docs/cartes-couches/PROMPT-B8-claude-code.md`, CSS `carte-variantes.css`.
- [x] B9. **Zoom identique dans toutes les variantes** : l'illustration a la même taille partout ; la Vivante ne zoome que de 2 à 3,5 %. (Full Art mis de côté, en attente des illustrations sans bordure.) Voir `docs/cartes-couches/SPEC.md`.

### C. Compte et progression (`docs/ecrans-compte/SPEC.md`, prompt 2)
- [ ] C1. Pages Accueil, AccueilMobile, Salon, Profil, Historique, DetailPartie, Classement, avec la barre `AppBar` sur ordinateur et la barre d'onglets en bas sur téléphone.
- [ ] C2. XP et niveaux : +50 par partie, +10 par mise tenue, +100 par victoire, +25 par haut fait. Passer du niveau L au niveau L+1 coûte 250 × L XP. Titres de Mousse à Légende des 7 mers.
- [ ] C3. Élo : départ à 100, minimum 0, calcul par paires, diviseur 100, K = 40 puis 20 après 10 parties, bots exclus. Il est affiché dans le profil, l'historique, le détail de partie, la fin de partie et le classement.
- [ ] C4. Hauts faits, `game_results`, `player_stats`, `xp_events`, classement entre amis ou tous les joueurs. Tout est calculé côté serveur dans `settleGame`, de façon idempotente.
- [ ] C5. Écran de fin de partie (maquette `FinPartie`) : podium, détail de l'XP, Élo avant et après avec le détail par adversaire, haut fait, et bouton « Ouvrir le coffre ».

### D. Garde-robe et coffre : **à faire en entier** (prompt 3 + Prompt B de `docs/cartes-v3`)
- [ ] D1. Avatar composé de couches SVG (maquette `Avatar`) : une base gratuite (teint, coiffure, couleur des cheveux, pilosité, manteau) et 6 emplacements d'objets. `profiles.look` est un jsonb.
- [ ] D2. Les 11 objets dessinés (maquette `Objet`) dans `web/src/objects.ts`.
- [ ] D3. Tables `cosmetics`, `user_cosmetics`, `user_wallet`. Le catalogue de départ vient de la constante `CAT` de la maquette `Profil`.
- [ ] D4. Quatre raretés : Commun 62 %, Rare 26 %, Épique 9 %, Légendaire 3 %. Couleurs : `#d6dde4`, `#4fa8ff`, `#c27dff`, `#ffc94a`. Un doublon est converti en pièces : 30 / 80 / 140 / 200.
- [ ] D5. Serveur :
  - le gagnant humain reçoit un coffre à la fin d'une partie en ligne ;
  - action `chest.open`, transactionnelle, avec le tirage fait côté serveur ;
  - actions `shop.list` et `shop.buy` ;
  - `profile.update` refuse un `look` qui contient un objet non possédé.
- [ ] D6. Animation d'ouverture (maquette `Coffre`, section « Ouverture de coffre » de la spécification) :
  1. le coffre flotte ;
  2. il est secoué pendant 0,9 s ;
  3. une lueur blanche apparaît, d'autant plus longue que l'objet est rare (1,5 à 2,5 s) ;
  4. la teinte passe à la couleur de la rareté en 1 s ;
  5. le coffre s'ouvre, avec des étincelles ;
  6. l'objet flotte avec ses étoiles, son nom et son emplacement ; un doublon fond en pièces.

  Boutons : « Passer », « Ouvrir le suivant », « Équiper ». Avec `prefers-reduced-motion`, affiche directement le résultat.
- [ ] D7. Accès au coffre depuis l'écran de fin de partie, depuis la garde-robe du profil, et par un badge dans l'en-tête quand `chests > 0`.
- [ ] D8. **Casier** (remplace la garde-robe du profil) : onglets Pirate, Cartes, Titre et réactions, avec aperçu en direct, emplacements, grille filtrable et essayage des objets verrouillés. Voir `docs/casier-boutique/` et les maquettes `Casier`, `CasierDos`, `CasierAnimees`, `CasierTitre`, `CasierReactions`.
- [ ] D9. Les avatars composés remplacent les initiales partout : table, listes, classement, aperçu au survol.
- [ ] D11. Cartes animées, rareté Mythique (1 %) : 6 cartes dont l'illustration s'anime (vidéos en boucle prêtes dans `web/public/cards/anim/`) : Kraken, Skull King, Raie, Baleine, Alyra, Fosse des Noyés. Voir `docs/cartes-animees/` et la maquette `CartesAnimees`.
- [ ] D12. **Boutique** et **Joker** : coffre 100, 3 coffres 270, Joker 150 (11e manche bonus posée dans le salon, 6 joueurs au plus), échoppe de la semaine (6 objets renouvelés le lundi : 3 communs, 2 rares, 1 épique), pièces gagnées en jouant. Voir `docs/casier-boutique/` et la maquette `Boutique`.
- [ ] D13. **Garde-robe v2 et coffres v2** : avatar détaillé `Pirate2`, 9 emplacements (Tenue, Oreille et Dos en plus), teintures par zone, variantes Neuf / Patiné / Doré, ornements, 3 tenues, ensembles ; 4 types de coffres avec priorité au neuf, doublons → variantes → éclats, garanties Épique 10 / Légendaire 40, Atelier ; ouverture avec escalade de rareté ; rareté visible sur la plaque à la table. Remplace la partie objets et coffres de D6, D8 et D12. Voir `docs/garde-robe-v2/` et les maquettes `CasierV2`, `CoffresV2`, `RaretesTable`, `Pirate2`.
- [x] D14. **Boosters de cartes** : le booster (50 pièces, 5 cartes, 3 boosters à thème) remplace le coffre en boutique et en victoire. Chaque carte du jeu a 8 variantes visuelles (Standard, Patinée, Bord d'étain, Holographique, Vivante, Nacre, Signée, Numérotée /100) qui ne touchent jamais au cadre, au médaillon ni au bandeau du nom (règle n° 1 : la famille de la carte doit rester reconnaissable), la variante jouée est visible à la table ; doublons → éclats, fabrication, probabilités à la Pokémon TCG Pocket, un peu réduites (cartes 4 et 5, booster divin 1/2 000), Collection. Voir `docs/boosters/` et les maquettes `Collection`, `Booster`, `CarteVar`.
- [ ] D14b. **Ouverture de booster v2** (avec D14) : carrousel des boosters, coupe au doigt le long des pointillés, lumière neutre (aucun spoil), pile qu'on fait glisser carte par carte (seule la 5e face cachée), moment Signée / Numérotée, butin avec barre de collection, sons et vibrations. Voir `docs/boosters/OUVERTURE.md` et la maquette `Booster`.
- [ ] D15. **Atelier de fabrication** (avec D14) : éclats des doublons → fabrication **au hasard** par rareté (Commune 20, Holo 80, Épique 240, Signée 800, jamais une variante déjà possédée) ou **au choix** (×4 : 80 / 320 / 960 / 3 200), Numérotées non fabricables, « Tout recycler ». Voir `docs/boosters/ATELIER.md` et la maquette `Atelier`.
- [ ] D10. Tests :
  - probabilités du tirage (graine fixe) ;
  - refus d'ouvrir avec 0 coffre ;
  - conversion des doublons ;
  - idempotence des récompenses ;
  - refus d'un `look` invalide.

## Ordre conseillé

Commence par l'étape 0. Ensuite : A3 et A2 (corrections rapides), B (cartes), A1 / A4 à A6 / A8 / A9 / A10 / A11 / A12 / A13 / A15 / A16 / A17 / A18 / A19 / A20 (A14 en pause), C, D, puis A7 en dernier, car il dépend de l'Élo et des objets.

## Contrôle final

Dans le navigateur, avec 2 comptes :
1. jouer une partie complète ;
2. vérifier les cartes illustrées (1 à 14 dans les 4 couleurs, cartes spéciales), le zoom, le pouvoir de Lise et l'Alt-Tab en cours de manche ;
3. vérifier la fin de partie (XP, Élo, coffre), puis ouvrir le coffre et équiper l'objet ;
4. vérifier que l'objet apparaît chez l'autre joueur, à la table et dans l'aperçu au survol ;
5. vérifier aux résolutions 1366 × 768, 1920 × 1080 et 390 × 844.

Termine en mettant `docs/ETAT.md` entièrement à **Fait**.
