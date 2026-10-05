# Table de jeu v2 — cahier des charges

Refonte de la table de jeu du Pli des Pirates (`web/src/table.ts`, `web/src/game.css`, `web/src/app.css`, `web/src/pages/game.ts`).
Objectif : que chaque joueur voie d'un coup d'œil **où il en est de sa mise**, **qui gagne le pli** et **à qui c'est le tour**, avec des animations
qui racontent chaque coup. Public visé : parties entre amis à 3 ou 4 joueurs, sur ordinateur et téléphone.

La maquette de référence est dans `docs/maquettes/` (fichiers `.dc.html` : HTML + un composant JS dans la balise `<script type="text/x-dc">`).
Ils servent de **référence visuelle et de valeurs** (positions, couleurs, tailles, timings d'animation). Ce n'est pas du code à copier tel quel :
le site est en TypeScript sans framework, rendu par chaînes HTML.

| Fichier | Contenu |
|---|---|
| `Main.dc.html` | Table pendant un pli, avec le parcours complet : survol, carte jouée, résolution, ramassage |
| `Bid.dc.html` | Phase de mise : mises scellées, révélation simultanée, total misé |
| `RoundEnd.dc.html` | Fenêtre de fin de manche |
| `Mobile.dc.html` | Disposition téléphone (390 px de large) |
| `Card.dc.html` | Carte simplifiée de la maquette. **Ne pas l'utiliser** : le site garde ses vraies cartes (`web/src/cards.ts`, design « Mers Sauvages ») |

## Règles du chantier

- **Ne pas toucher aux règles ni au serveur** sauf mention explicite ci-dessous : `supabase/functions/_shared/engine.ts` reste la source de vérité
  et ses tests (`npm test`) doivent continuer de passer.
- Garder le fonctionnement actuel : file d'événements rejouée par `TableView.push()`, état de référence appliqué par `setLatest()`,
  mode entraînement hors ligne (`pages/misc.ts`) qui utilise la même `TableView`.
- Garder les fonctions déjà ajoutées (son, « Dernier pli », vitesse des animations).
- Toutes les animations respectent `prefers-reduced-motion` et le réglage de vitesse existant.
- Couleurs, polices et fond restent ceux du jeu (tokens de `game.css`) : IM Fell English SC pour les titres, Alegreya Sans pour le texte,
  Pirata One pour les chiffres des cartes.

## 1. Barre de partie unique

Pendant une partie (`body.at-table`), l'en-tête du site disparaît et une seule barre de 56 px le remplace :
- à gauche : logo, « Manche 7 » (IM Fell, doré) puis « sur 10 · 7 cartes · pli 2 sur 7 » (gris), puis 10 points de progression
  (passés dorés, manche en cours plus clair avec halo, à venir estompés) ;
- à droite : Dernier pli, Scores, Règles, Son (icône seule avec `aria-label`), Quitter.

## 2. Plaque de joueur

Une plaque par joueur (236 × 78 px), posée sur le bord de la table : en bas (vous), à gauche, en haut, à droite pour 4 joueurs.
Pour 3 joueurs : vous en bas, les deux autres en haut à gauche et en haut à droite. Au-delà de 4, garder la répartition en ellipse actuelle.

Contenu :
- avatar rond 56 px à la couleur du joueur, initiale ;
- nom (16 px, gras), puis « 110 pts · 6 cartes » (13 px, gris) ;
- étiquette « ENTAME » à côté du nom pour le joueur qui a ouvert le pli ;
- **jauge « plis / mise »** à droite, chiffres 22 px : c'est l'information principale. Couleurs :
  - il manque des plis → doré (`#ead08a`, fond `rgba(234,208,138,.1)`) ;
  - mise tenue (plis = mise, y compris 0/0) → vert (`#9bd69f`, fond `rgba(134,201,138,.14)`) ;
  - pli(s) de trop → rouge (`#f0a08b`, fond `rgba(232,131,107,.14)`).
- Avant la révélation des mises : la jauge est remplacée par l'état de mise (voir §6).

Supprimer les éventails de dos de cartes au-dessus des plaques : le nombre de cartes est dans le texte.

## 3. Le pli au centre

- Cartes du pli **plus grandes** (92 px de large sur ordinateur au lieu de ~68), disposées **en croix**, chacune devant son joueur,
  légèrement inclinées (gauche −7°, haut +2°, droite +7°, bas −2°). Positions de référence dans `Main.dc.html` (`SLOT`).
- Au-dessus de la croix : pastille « Doublon demandé » (rond de la couleur) ou « Aucune couleur demandée ».
- Étiquette dorée **« En tête »** sous la carte qui gagne le pli pour l'instant. Calcul côté site avec
  `resolve(trick.entries)` du moteur partagé (déjà importé via `@engine`) ; ne rien ajouter au serveur.
- Quand c'est à vous : emplacement vide en pointillés « Votre carte » devant votre plaque (bordure qui pulse doucement).
- Supprimer la rose des vents en filigrane derrière les cartes si elle gêne la lecture, ou la ramener à 14 % d'opacité.

## 4. Votre tour

- **Anneau de tour** : cercle doré qui se vide autour de l'avatar du joueur actif (SVG, `stroke-dashoffset` animé sur 30 s),
  plus un halo qui « respire » sur sa plaque. Visuel uniquement : aucune règle de temps côté serveur pour l'instant.
- **Bandeau d'action** (parchemin sous la table) : titre « À vous de jouer » et, à droite, compte à rebours « 30 s » avec barre.
- **Aperçu du coup au survol ou au focus d'une carte** : la deuxième ligne du bandeau dit ce qui se passerait. Calcul côté site :
  `resolve([...trick.entries, entréeSimulée])`. Messages :
  - gagne : « 13 Doublon bat le 11 d'Ysolde : vous prenez le pli » (vert `#2b6a33`) ;
  - perd : « 2 Doublon est trop faible : Ysolde garde le pli » (brun `#8a5e0e`) ;
  - interdite : « Bloquée : vous devez fournir du Doublon » (rouge `#a03123`).
  - Cartes à choix (Morgane la Louve, 0/14, Grand Quinze) : afficher le meilleur cas, ou « selon votre choix ».
  - Sans survol : « Survolez une carte pour voir si elle prend le pli ».
- **Main** : cartes 120 px, en éventail léger, posées sur le rail en bois. Jouables : contour doré au survol et levée de 24 px.
  Interdites : désaturées et assombries, `aria-disabled="true"`, curseur « interdit ». Sur téléphone, un premier appui montre l'aperçu,
  un second joue la carte.

## 5. Panneau de droite

1. **Classement** : rang, pastille couleur, nom, score total (20 px), variation de la manche précédente (vert/rouge),
   et sous le nom des pastilles de mise (vides = plis manquants, vertes = pris, rouges = en trop) suivies de « il manque 1 »,
   « mise tenue », « mise 0 tenue » ou « 1 de trop ».
2. **Réactions** : 4 boutons (« Bien joué ! », « Aïe ! », « Hissez haut ! », « Bluff ? »). Un clic affiche une bulle 2,2 s à côté de la plaque
   de l'expéditeur, chez tout le monde. Transport : **Supabase Realtime broadcast** sur le canal de la partie déjà ouvert dans `pages/game.ts`
   (événement `emote`, charge utile `{ seat, text }`), rien en base. Limiter à une réaction toutes les 2 s par joueur. En entraînement, la bulle
   s'affiche seulement localement.
3. **Journal** réduit aux 5 dernières lignes, lien « Tout voir » qui ouvre le journal complet dans une fenêtre.

## 6. Phase de mise

- Au centre : « Manche 7 » en grand, « 7 cartes · 7 plis à prendre », puis « Mises secrètes · 2 joueurs sur 4 ont misé ».
- Sur chaque plaque, à la place de la jauge : points animés « réfléchit… », ou pièce scellée (dos foncé à rose des vents) « a misé »,
  ou « ? » pour vous tant que vous n'avez pas misé. `hasBid` est déjà dans la vue publique.
- Bandeau : « Combien de plis allez-vous remporter ? » + pièces 0…n (46 px, la choisie se soulève). Après le choix : « Mise scellée : 2 »
  et « En attente de Corentin… ».
- À droite, encadré « Ce que vaut votre mise » qui suit la pièce survolée : mise n tenue +20×n, un pli d'écart −10, deux −20 ;
  mise 0 : +10×cartes / −10×cartes. Utiliser les règles de score réelles (classique ou Rascal selon `opts.score`).
- À la révélation (événement `bids`) : toutes les pièces se retournent (voir animations), puis le centre affiche
  « Total misé : 5 pour 7 plis » et un commentaire : « 2 plis que personne n'a réclamés » (vert), « Autant de mises que de plis »
  (doré) ou « Plus de mises que de plis : la bataille sera rude » (rouge).

## 7. Fin de manche

Fenêtre parchemin (voir `RoundEnd.dc.html`) remplaçant le récapitulatif actuel :
- colonnes : rang (avec ▲ / ▼ si le classement a bougé), joueur, « mise → plis » + puce « tenue » / « +1 » / « −1 », points de base,
  bonus en puces (« +20 Sirène capturée »…), total de la manche, total général ;
- la ligne du meneur sur fond doré ;
- bandeau « Coup de la manche » : la meilleure manche du tour parmi des cas simples (mise 0 tenue avec beaucoup de cartes, plus gros bonus,
  plus grosse mise tenue). Calcul côté site à partir de `hist`.
- **« Je suis prêt »** + barre de 8 s : la manche suivante s'affiche quand tout le monde est prêt ou à la fin du délai. Le serveur
  enchaîne déjà les manches sans attendre : ici c'est seulement l'affichage côté site qui patiente. Diffuser « prêt » par Realtime broadcast
  pour afficher « 3 prêts sur 4 ».

## 8. Animations

Toutes en CSS (keyframes + classes), timings de référence dans la maquette. Multiplier les durées par le réglage de vitesse existant.

| Moment | Animation | Durée |
|---|---|---|
| Carte jouée par vous | Part de la main vers son emplacement, en se redressant (translation + rotation −16° → 0, échelle 1,3 → 1) | 550 ms |
| Carte jouée par un autre | Même mouvement depuis sa plaque | 450 ms |
| Changement de meneur du pli | L'étiquette « En tête » glisse vers la nouvelle carte | 200 ms |
| Pli résolu | Halo doré pulsé sur la carte gagnante + bandeau « Vous remportez le pli / avec 13 Doublon » | 1,2 s |
| Ramassage | Toutes les cartes filent vers la plaque du gagnant en rétrécissant (variables CSS `--dx --dy`) | 600 ms |
| Jauge du gagnant | Grossit puis revient (×1,4) + « +1 pli » qui s'élève et s'efface | 550 ms / 1,8 s |
| Kraken | La table tremble légèrement, les cartes coulent vers le centre et disparaissent | 700 ms |
| Baleine / Raie | Onde circulaire depuis le centre, puis halo sur la plus haute / plus basse carte | 800 ms |
| Mise scellée | La pièce apparaît en se posant (échelle 1,5 → 1) | 350 ms |
| Révélation des mises | Toutes les pièces se retournent (rotateY 90° → 0), 90 ms de décalage entre joueurs | 550 ms |
| Distribution | Les cartes arrivent une à une dans la main depuis le centre | 60 ms par carte |
| Fin de manche | La fenêtre monte, les lignes entrent une à une (120 ms d'écart), les totaux de manche « rebondissent » | 0,4 s + 0,6 s |
| Réaction | Bulle qui apparaît (échelle 0,8 → 1) puis disparaît | 2,2 s |
| Joueur actif | Halo qui respire sur la plaque | 2 s en boucle |

Sons (si le son est activé) : carte posée, pli ramassé, pièce retournée, réaction. Garder les sons existants si présents.

## 9. Téléphone (< 640 px)

Voir `Mobile.dc.html` :
- barre réduite : « Manche 7 · pli 2/7 », boutons Scores et Menu (44 × 44) ;
- les adversaires en bandeau de 3 colonnes en haut (avatar 30 px, nom, jauge « 1/1 », score) ;
- table rectangulaire arrondie, croix de cartes à 74 px, nom du joueur sous chaque carte (« Ysolde · en tête ») ;
- votre ligne : avatar avec anneau de tour, « À vous de jouer », aperçu du coup, jauge « 0/2 » ;
- main en éventail serré, cartes 92 px, sur le rail en bois ;
- 3 réactions rapides en bas ;
- le classement et le journal passent dans un tiroir ouvert par le bouton Scores.

## 10. Critères d'acceptation

- [ ] Partie à 3 et à 4 en ligne : la jauge « plis / mise » de chaque joueur est juste après chaque pli (vérifier contre la feuille de scores).
- [ ] « En tête » désigne toujours la carte que `resolve()` donne gagnante, y compris avec Kraken, Baleine, Raie, Fosse, Planche, Grand Quinze.
- [ ] L'aperçu au survol annonce le bon résultat pour chaque carte de la main.
- [ ] Les animations s'enchaînent sans saut quand plusieurs coups arrivent d'un coup (file d'événements), et se coupent avec `prefers-reduced-motion`.
- [ ] Les réactions apparaissent chez tous les joueurs en moins d'une seconde, et pas plus d'une toutes les 2 s par joueur.
- [ ] Le mode entraînement fonctionne toujours, sans compte.
- [ ] Rien ne déborde à 390 px de large ; boutons et cartes jouables ≥ 44 px de haut.
- [ ] `npm test`, `npm run typecheck` et `npm run build` passent.
