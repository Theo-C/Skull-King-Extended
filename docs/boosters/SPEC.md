# Boosters de cartes et variantes

Maquettes :
- `Collection` (board 34) ;
- `Booster` (board 35) ;
- `CarteVar` : composant carte, avec les 8 variantes et le dos.

## Principe

- Le **booster remplace le coffre** comme article principal de la Boutique (50 pièces) et comme récompense de victoire.
- **Les coffres restent** (décision du 28 octobre 2026), mais **seulement pour la personnalisation du profil** (objets du pirate, dos, titres…) : **coffre 50 pièces, 3 coffres 135** ; on en gagne aussi en passant un niveau. Ils ne donnent **plus de carte animée Mythique** : tirage Commun 62 %, Rare 26 %, Épique 9 %, Légendaire 3 %. Les cartes animées déjà gagnées restent possédées.
- Un booster contient **5 cartes du jeu dans une variante visuelle**.
- Chaque carte du paquet (cartes numérotées des 4 couleurs, pirates, Skull King, sirènes, Kraken, Baleine, Fuites…) existe en **8 variantes**.
- **La variante ne change jamais la valeur de la carte** : c'est purement visuel. Pour chaque carte, le joueur choisit la variante qu'il joue, et tout le monde la voit quand la carte est posée.

## Règle n° 1 : la variante ne doit jamais brouiller la famille de la carte

En partie, on reconnaît une carte d'un coup d'œil, et d'abord à **la couleur de son cadre** : vert, jaune, violet, noir (drapeau, l'atout), rouge et or des pirates, etc. Une variante qui teinte la carte entière (sépia, bleu nuit, noir) peut faire croire à une autre famille. Par exemple, un pirate passé au noir fait penser à un drapeau. C'est interdit.

**Zone protégée, jamais modifiée ni recouverte :**
- le **cadre** (couleur, luminosité, contraste) ;
- le **médaillon** de valeur ou d'icône (taille et contraste identiques) ;
- le **personnage** ou le sujet de l'illustration (teinte, contraste) ;
- les **médaillons d'angle**.

**Ce qu'une variante a le droit de toucher :**
1. **la fenêtre d'illustration** : mouvement, taches de vieillissement, feuille holographique **sur le fond seulement** (ciel, mer, jungle, détouré par `foil_<clé>.png`), jamais sur le personnage. Jamais de changement de teinte globale, jamais de noir et blanc ni de bichromie ;
2. **la marge** (le bord parchemin clair) : **toute la marge**, détourée par `marge_<clé>.png`, jamais une bande partielle. Étain, nacre, irisé pastel, vieux parchemin. Toujours en **tons clairs ou métal neutre**, jamais noir ni dans une couleur de famille ;
3. des **reflets neutres** (argent, blanc) sur l'illustration ; l'arc-en-ciel est réservé au fond de l'illustration (Holo) et à la marge ;
4. des **ajouts** placés hors de la zone protégée : signature dorée à chaud en bas de l'illustration, numéro gravé dans la marge.

**Contrôle obligatoire pour chaque nouvelle variante :**
- planche « 8 variantes × chaque famille » à 40 et 56 px (taille d'une carte dans la main sur téléphone) : chaque ligne doit rester reconnaissable comme sa famille (voir `variantes-cartes.png`) ;
- même planche avec un filtre daltonien (deutéranopie) ;
- la Collection montre ce test sous la grande carte (« Lisibilité à la taille de la main mobile »).

Écarté pour cette raison : « Encre de nuit » (bleu), « Carte marine » et « Gravure » (sépia sur toute l'illustration), « Pleine illustration » (supprime le cadre), cadre « obsidienne » (noir).

**Masques par gabarit** (remplacés par les cartes en couches B7 et les masques par carte B8 : `marge_`, `foil_`, `fond_`, voir `docs/cartes-couches/`) : chaque gabarit de carte a son masque de fenêtre d'illustration.
- `suit` : cartes de couleur, médaillon en haut à droite.
- `pir` : pirates, sirènes, Skull King, **sans bandeau du nom** depuis B8 (l'illustration descend jusqu'au bas du cadre), médaillons d'angle et médaillon du bas.
- `cre` : Kraken, Baleine, Fuite, médaillon en haut à droite.

La maquette utilise des rectangles approchés (voir `CarteVar.dc.html`). En production, générer un **PNG de masque par carte** (alpha = illustration seule) à partir des fichiers sources, pour un détourage exact.

## Les 8 variantes

| Variante | Nom officiel (TCG) | Rareté | Rendu (cadre et médaillon toujours intacts) |
|---|---|---|---|
| Standard | Regular | Base | la carte actuelle, possédée par tous |
| Patinée | Vintage | Commune | taches et craquelures de vieux parchemin sur l'illustration, marge vieillie ; couleurs conservées |
| Bord d'étain | Silver Border | Commune | marge en étain brossé, 4 rivets aux coins |
| Holographique | Holo | Rare | **feuille holo texturée sur le fond de l'illustration** (arc-en-ciel, gravure en vagues concentriques, reflets sur les crêtes, paillettes) qui suit la souris ou l'inclinaison ; personnage intact, cadre mat ; marge irisée pastel |
| Vivante | Animated | Épique | **2 plans** : le fond et le personnage bougent en sens opposés (parallaxe), la mer ondule sur les cartes marines, rayons de lumière et particules dans le fond ; le cadre reste immobile |
| Nacre | Pearl Foil | Épique | marge en nacre irisée, filet d'or, reflets |
| Signée | Signature | Légendaire | marge crème dorée + reflet + **signature dorée à chaud** (or miroir, léger gaufrage, reflet qui glisse) en bas de l'illustration. Les pirates signent leur carte, Barbe-Grise le cartographe signe les autres |
| Numérotée | Serialized | Mythique | Signée + Vivante + Holo + **numéro gravé dans la marge** « N° 04 / 10 ». **10 exemplaires par carte et par saison**, pour tous les joueurs : chaque numéro n'appartient qu'à un seul joueur |

- Les 6 cartes animées existantes (D11) gardent leur variante **Animée** (Mythique). Leur animation est déjà limitée à l'illustration.
- **Noms officiels** : termes usuels des jeux de cartes à collectionner, affichés en petit sous le nom français dans la Collection. Holo, Signature et Serialized sont des termes établis (Pokémon, Magic, Hearthstone) ; Vintage, Silver Border, Animated et Pearl Foil sont des équivalents descriptifs.
- La différence entre les raretés vient de la **matière** (marge, reflets, paillettes), du **mouvement** et des **ajouts** (signature, numéro), jamais de la couleur.
- Animation : les reflets bougent avec la souris sur ordinateur, avec l'inclinaison (`deviceorientation`) sur téléphone, et en boucle lente sinon. Coupés par `prefers-reduced-motion` et par « Animations des autres ».
- Option d'accessibilité « Afficher les cartes des autres en Standard », dans les réglages de la partie.

**Volume** : environ 70 cartes × 7 variantes à collectionner ≈ **490 variantes** dans la Série 1 « Les Sept Mers ».

## Le booster

- **Prix : 50 pièces.**
- **1 booster gratuit par jour où l'on joue**, après la première partie terminée de la journée (pas de minuteur de 12 h).
- **Calibrage pour notre groupe** (4 amis, 2 à 3 soirées par semaine, 3 parties par soirée, soit ~7,5 parties par joueur et par semaine ; ~30 pièces gagnées par partie en moyenne) : ~4,5 boosters achetés + ~1,9 gagnés en victoire + ~2,5 gratuits = **~9 boosters par joueur et par semaine, environ 1 par partie jouée**.
- Simulation sur une saison de 3 mois (sans compter la fabrication avec les éclats) : toutes les Holo en ~7 semaines, toutes les communes en ~9 semaines, ~40 % des Épiques, **~1 Signée par semaine** et ~4 Numérotées par joueur ; ~73 % de la collection. Il reste de quoi chasser toute la saison.
- Une victoire donne 1 booster, comme le coffre de victoire aujourd'hui.
- **3 boosters au choix** par saison, chacun avec ses **3 cartes vedettes 3 fois plus fréquentes**. Série 1 :
  - « Profondeurs » : Kraken, Baleine blanche, 14 noir ;
  - « Chant des sirènes » : Alyra, Juanita, Marie ;
  - « Couronne du roi » : Skull King, Rosie, Rascal.

### Contenu (5 cartes, jamais deux fois la même carte dans un booster)

Échelle de **Pokémon TCG Pocket**, **légèrement réduite** pour compenser le prix à 50 pièces (environ −20 % sur les cartes Épique et mieux). Correspondance : 1◆ = Commune, 2◆ = Holographique, 3◆ et 4◆ = Épique (Nacre ou Vivante, 50/50), 1★ à 3★ = Signée, ★ brillantes et couronne = Numérotée.

| Variante | Cartes 1 à 3 | Carte 4 | Carte 5 (« carte de chance ») |
|---|---|---|---|
| Patinée ou Bord d'étain (50/50) | 100 % | — | — |
| Holographique | — | 92 % | 66 % |
| Nacre ou Vivante | — | 5 % | 21 % |
| Signée | — | 2,3 % | 10 % |
| Numérotée | — | 0,7 % | 3 % |

Pour mémoire, Pocket : carte 4 = 89 / 6,6 / 3,3 / 1,1 %, carte 5 = 56,8 / 25,7 / 13,2 / 4,35 %.

- La 4e carte peut surprendre (8 % de chance d'être Épique ou mieux) ; la 5e est la meilleure en moyenne (34 %), **mais pas forcément** : tout dépend du tirage.
- **Booster divin** : **1 sur 2 000** (0,05 %, comme les « god packs » de Pocket). Les 5 cartes sont Signées (90 %) ou Numérotées (10 %).
- Une **Numérotée** n'est tirée que s'il reste des exemplaires de cette carte pour la saison. Le numéro est attribué dans l'ordre (le 1er trouvé = N° 01). Sinon, elle devient une Signée. Une Numérotée n'est jamais un doublon : qui a déjà celle de cette carte reçoit une Signée. Un exemplaire possédé n'est plus accessible aux autres joueurs.
- Les chances sont **affichées dans le jeu** (panneau « Chances par carte » de l'écran d'ouverture).

### Garanties

Supprimées : avec ces probabilités et ~9 boosters par semaine, chacun ouvre plusieurs Épiques et environ une Signée par semaine. Les compteurs (6 et 30 boosters) ne se déclencheraient presque jamais.

### Doublons et éclats

- Les éclats sont la même monnaie que l'Atelier de la garde-robe (D13).
- Un doublon est recyclé en éclats **dès l'ouverture**, et c'est affiché sur la carte :
  - Commune 5, Holographique 20, Nacre ou Vivante 60, Signée 200 ;
  - une Numérotée ne peut pas être un doublon.
- **Fabrication** (Atelier, board 37, et Collection) : deux façons, voir `docs/boosters/ATELIER.md`.
  - **Au hasard** (prix de base) : on choisit une rareté, on reçoit une variante **qu'on n'a pas encore** dans cette rareté, sur une carte au hasard. Commune 20, Holographique 80, Nacre ou Vivante 240, Signée 800.
  - **Au choix** (×4) : la carte et la variante exactes. Commune 80, Holographique 320, Nacre ou Vivante 960, Signée 3 200.
  - **Numérotée non fabricable**, ni au hasard ni au choix.
- En **Collection**, « Recycler » transforme les doublons accumulés en éclats. On garde toujours 1 exemplaire.

## Ouverture (board 35, version 2)

Un petit rituel en 4 temps, pensé d'abord pour le téléphone (geste au doigt), qui marche aussi à la souris et au clavier. Détails techniques : `docs/boosters/OUVERTURE.md`.

1. **Choisir** : les 3 boosters de la saison dans un **carrousel 3D** (celui du centre flotte, les voisins sont tournés et assombris). Flèches, glisser ou clic sur un voisin pour tourner. Dessous : nom, cartes vedettes ×3 (en Holo), « Ouvrir · 50 🪙 » et le booster gratuit avec son sablier.
2. **Couper** : le sachet vient au centre et grossit. On **glisse le doigt le long des pointillés** du haut, de gauche à droite : une ligne de lumière suit le doigt, avec une étincelle à la pointe.
   - à 92 % la bande s'envole, petit flash ;
   - indice : une lueur qui court le long des pointillés et des chevrons « ››› » au bout (pas d'emoji) ;
   - si on lâche avant, la ligne se rétracte ;
   - « Ouvrir sans glisser » (et Entrée) pour l'accessibilité.
3. **Ouverture** : la bande s'envole et laisse un bord déchiré ; une lumière dorée **toujours identique** sort du sachet (aucun indice sur le contenu).
   - **Le sachet garde toujours sa forme** : les cartes sortent par le haut, de l'intérieur du sachet (elles passent derrière lui), puis le sachet glisse vers le bas et disparaît, et la pile vient se poser au centre.
4. **Faire défiler la pile** : une seule grande carte à la fois, les suivantes dépassent derrière.
   - on **glisse la carte sur le côté** (ou on la touche) pour passer à la suivante ; elle s'envole ;
   - **cartes 1 à 4 face visible**. Une Holo ou mieux déclenche une onde, un anneau et des étincelles de sa couleur (la surprise de la 4e) ;
   - **la 5e, la « carte de chance », arrive toujours face cachée**, même si ce n'est qu'une Holo. Le dos est **neutre** (`web/public/cards/dos.webp`, source `docs/boosters/dos-carte.svg` : cuir bleu nuit, rose des vents et filets dorés en relief) : même lueur dorée douce et même léger flottement quelle que soit la rareté. **Aucun spoil.** « Touchez pour la retourner » : retournement lent (1,1 s) ;
   - **Signée / Numérotée** : écran assombri, rayons qui tournent, bannière « Signée ! » / « Numérotée ! », « EXEMPLAIRE N° 04 / 10 » ;
   - sous la carte : nom, losanges de rareté (◆ à ★★), variante, « Nouveau » ou « Doublon · +20 ◆ » ; points de progression 1 à 5 ; « Tout voir » pour sauter.
   - **Booster divin, signalé discrètement** : la lumière est la même, mais quelques paillettes d'or s'échappent du sachet à l'ouverture et les points de progression deviennent des étoiles dorées. Le joueur comprend en voyant la 1re carte (une Signée à la place d'une commune) ; l'annonce explicite « ✦ Booster divin · 1 sur 2 000 ✦ » n'arrive qu'au butin, puis aux amis et dans le salon.
5. **Le butin** : grille 3 + 2 qui apparaît en cascade, cartes inclinables ; « +3 nouvelles variantes · +25 ◆ éclats » ; **barre de collection** de la série qui avance (63 → 66 / 224) ; « Ouvrir un autre » (repart directement à l'étape Couper), « Voir la collection », « Changer de booster ».
6. Une Signée ou une Numérotée est **annoncée aux amis et dans le salon**.

**Sons** (`sfx.ts`) : froissement en prenant le sachet ; crissement continu pendant la coupe, dont la hauteur suit la progression ; déchirure + souffle à l'ouverture ; « fwip » à chaque carte qui part ; carillon (Holo), accord (Épique), fanfare courte (Signée, Numérotée).

**Vibrations** (Capacitor Haptics, app mobile) : légère tous les 10 % de coupe, moyenne à l'ouverture, forte au retournement d'une Signée ou Numérotée.

## Collection (board 34)

- En-tête : série, progression (« 148 / 490 variantes »), porte-monnaie.
- Filtres : Toutes, Pirates, Créatures et spéciales, Jaune, Vert, Violet, Noir.
- Grille : chaque carte affichée dans **la variante qu'on joue**, avec en dessous **8 pastilles** colorées pour les variantes possédées.
- Grande carte au centre, inclinable : la variante sélectionnée, son nom et sa rareté.
- Liste des 8 variantes avec la quantité possédée (×n) ou un cadenas. Le badge « EN JEU » marque celle qui est jouée.
- Boutons :
  - « Utiliser en partie » ;
  - « Fabriquer · n ◆ » si la variante n'est pas possédée ;
  - « Recycler n doublons · +n ◆ ».
- « À la table » : un pli d'exemple où chaque joueur pose sa variante. Au survol d'une carte posée : « Holographique · Théo ».
- **Récompenses de collection** :
  - compléter une famille en Holographique (par exemple les 14 cartes vertes) donne un dos de carte ;
  - compléter les 7 variantes d'une carte donne un titre (« Collectionneur de Rosie »…).

## Saisons

- Une série dure environ 3 mois.
- À chaque nouvelle série :
  - 3 nouveaux boosters avec leurs vedettes ;
  - un **nouveau style** de variante Épique, qui respecte la règle n° 1 (par exemple « Givre » sur la marge, « Pluie » animée dans l'illustration) ;
  - un nouveau compteur de Numérotées.
- Les variantes des séries passées restent possédées.
- Les boosters des séries passées restent achetables, mais sans Numérotées.

## Données

- `card_variants` : `card_id`, `variant` (`patine|etain|holo|vivante|nacre|signee|numero|anim`), `series_id`.
- `user_card_variants` : `user_id`, `card_id`, `variant`, `copies`, `serial int null` (Numérotée), `obtained_at`.
- `numbered_stock` : `series_id`, `card_id`, `next_serial`, `max 100`. Incrémentation atomique, en une seule transaction avec l'ouverture.
- `user_card_choice` : `user_id`, `card_id`, `variant`. C'est la variante jouée ; par défaut Standard.
- `user_booster_pity` : `since_epic`, `since_signed`.
- `user_wallet` : `boosters int`, `shards int` (déjà prévu en D13), `free_booster_at`.
- Fonctions Edge :
  - `booster.open {pack}` : tirage serveur, cartes vedettes, garanties, Numérotées, doublons → éclats, en une seule transaction. Renvoie les 5 cartes, leur statut et les compteurs ;
  - `collection.craft {cardId, variant}` ;
  - `collection.recycle {cardId, variant}` ;
  - `collection.choose {cardId, variant}`, qui vérifie que la variante est possédée.
- En partie : quand une carte est posée, le serveur joint la variante choisie par son propriétaire, et les clients affichent `CarteVar` avec cette variante.
- Les variantes sont purement visuelles : **aucun** effet sur le moteur de jeu ni sur les tests de règles.

## À trancher

- **Booster gratuit quotidien** : conseillé pour fidéliser, mais il faut ajuster les gains de pièces pour que la Boutique garde de l'intérêt.
- **Échanges entre amis** (comme Pokémon TCG Pocket) : à garder pour plus tard. Il faudrait des règles anti-abus (même rareté, une fois par jour, Numérotées non échangeables).
