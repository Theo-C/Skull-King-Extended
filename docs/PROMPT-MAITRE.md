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
- [ ] A10. GIF en partie : recherche de GIF (KLIPY, via l'Edge Function) et envoi à la table. Le GIF surgit au centre du tapis et monte en se balançant, semi-transparent, comme une émote Twitch (3,2 s). Débit de 1 GIF toutes les 10 s, option pour masquer. Voir `docs/gif/` et la maquette `GifPartie`.
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
- [ ] D8. Garde-robe du profil :
  - onglets Visage / Chapeaux / Yeux / Cou / Compagnons / Décor / Cadre ;
  - objets verrouillés affichés en silhouette, avec leur condition d'obtention ;
  - variantes de couleur ;
  - boutons « Au hasard », « Annuler », « Enregistrer » ;
  - échoppe : 3 objets par jour.
- [ ] D9. Les avatars composés remplacent les initiales partout : table, listes, classement, aperçu au survol.
- [ ] D11. Cartes animées, rareté Mythique (1 %) : 6 cartes dont l'illustration s'anime (vidéos en boucle prêtes dans `web/public/cards/anim/`) : Kraken, Skull King, Raie, Baleine, Alyra, Fosse des Noyés. Voir `docs/cartes-animees/` et la maquette `CartesAnimees`.
- [ ] D10. Tests :
  - probabilités du tirage (graine fixe) ;
  - refus d'ouvrir avec 0 coffre ;
  - conversion des doublons ;
  - idempotence des récompenses ;
  - refus d'un `look` invalide.

## Ordre conseillé

Commence par l'étape 0. Ensuite : A3 et A2 (corrections rapides), B (cartes), A1 / A4 à A6 / A8 / A9 / A10, C, D, puis A7 en dernier, car il dépend de l'Élo et des objets.

## Contrôle final

Dans le navigateur, avec 2 comptes :
1. jouer une partie complète ;
2. vérifier les cartes illustrées (1 à 14 dans les 4 couleurs, cartes spéciales), le zoom, le pouvoir de Lise et l'Alt-Tab en cours de manche ;
3. vérifier la fin de partie (XP, Élo, coffre), puis ouvrir le coffre et équiper l'objet ;
4. vérifier que l'objet apparaît chez l'autre joueur, à la table et dans l'aperçu au survol ;
5. vérifier aux résolutions 1366 × 768, 1920 × 1080 et 390 × 844.

Termine en mettant `docs/ETAT.md` entièrement à **Fait**.
