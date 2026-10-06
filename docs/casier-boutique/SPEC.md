# Casier et Boutique (D8 et D12)

Maquettes : `docs/maquettes/Casier.dc.html` (onglet Pirate), `CasierDos`, `CasierAnimees`, `CasierTitre`, `CasierReactions` (les autres onglets, même composant ouvert sur un autre emplacement) et `docs/maquettes/Boutique.dc.html`. Ces deux écrans remplacent la garde-robe et la petite échoppe qui étaient dans le profil.

Le principe, repris des jeux qui le font bien (le casier de Fortnite, le garage de Rocket League, la boutique de Clash Royale ou d'Hearthstone) : **le Casier sert à s'équiper et la Boutique à acheter**. Les deux sont reliés par un bouton, et le profil ne garde qu'un résumé avec un lien « Personnaliser ».

## Casier
Disposition en 3 colonnes :
1. **Aperçu en direct** à gauche : grand avatar, et en dessous la plaque telle qu'elle apparaît à la table (avatar, nom et titre).
2. **Emplacements** au milieu. Chaque ligne affiche le nom de l'emplacement, l'objet équipé et le compteur d'objets possédés (par exemple 4/7).
3. **Choix** à droite : une grille de vignettes, avec les filtres Tout, Possédés et À débloquer.

Trois onglets :
- **Pirate**
  - Visage : teint, coiffure, couleur des cheveux, pilosité, et manteau (qui sert aussi de couleur à la table). **Tout est gratuit**, sans verrou.
  - Chapeau, Yeux et visage, Cou, Compagnon, Décor, Cadre.
- **Cartes** (voir ci-dessous)
- **Titre et réactions** (voir ci-dessous)

### Onglet Cartes
L'aperçu de gauche devient une **mini table** (tapis vert) : en haut, une main adverse en éventail avec **votre dos** (« Ce que voient les autres ») ; au centre, la carte animée sélectionnée, posée et qui joue en boucle (les 3 couches de D11 : image, vidéo masquée, cadre fixe), avec une lueur à sa couleur quand elle est activée.
- **Dos de cartes** : grandes vignettes (4 par ligne), un seul dos équipé. Il s'applique à toutes vos cartes en main ; les faces ne changent jamais. Catalogue de départ : Classique, Carte marine, Voile rapiécée (communs), Ancre et cordage (rare), Rose des vents (rare, coffre), Kraken (épique, échoppe 300), Abysses (épique, niveau 22), Doublons (légendaire, coffre).
- **Cartes animées** : une ligne par carte (2 colonnes) avec la carte, la pastille irisée « Mythique », ce qui bouge (« Tentacules et œil rougeoyant »…) et un **interrupteur** par carte. Clic sur la ligne = aperçu dans la mini table ; une carte non possédée s'affiche quand même en aperçu (« pas encore gagnée »), interrupteur grisé, « 1 % par coffre ».
- Deux réglages en bas : **Son à l'impact** et **Animations des autres** (à couper si la partie rame). Ces réglages sont locaux à l'appareil.

### Onglet Titre et réactions
L'aperçu montre votre **place à la table** (avatar, nom, titre, mise et plis), la **carte au survol** (avatar, niveau, titre sur sa plaque, parties et victoires) et la barre de réactions au-dessus de la main.
- **Titre** : plaques en forme de bannière (3 par ligne), couleur selon la rareté. Sous chaque plaque, comment on l'obtient (« Niveau 15 », « Haut fait · capturer 5 sirènes ») ; pour un titre verrouillé, une **barre de progression** (« 18 / 25 »). Un titre verrouillé s'essaie mais ne s'enregistre pas.
- **Réactions rapides** :
  - en haut, **la barre de 4 emplacements** numérotés 1 à 4 (raccourcis clavier en partie), chacun avec une croix pour le vider ; le bouton GIF reste toujours en 5e position, non modifiable ;
  - en dessous, la **réserve** : chaque réaction en bulle, avec sa rareté et « Dans la barre · touche 2 », « Dans la réserve » ou sa provenance ;
  - un clic ajoute (si la barre est pleine, la plus ancienne sort) ou retire ; à chaque ajout, la bulle s'affiche au-dessus de votre place dans l'aperçu. Une réaction verrouillée peut s'entendre en aperçu, pas s'ajouter.

Vignette d'objet :
- l'aperçu de l'objet porté (avatar, objet dessiné, dos de carte ou texte) ;
- le nom ;
- une barre de rareté en bas : Commun `#c9d3dc`, Rare `#4fa8ff`, Épique `#b77dff`, Légendaire `#ffc94a`, Mythique en dégradé irisé.

États de la vignette :
- **Équipé** : bordure dorée et pastille ✓.
- **Possédé** : vignette normale.
- **Verrouillé** : image désaturée, cadenas, et sa provenance (« Coffre », « Échoppe · 150 », « Niveau 16 », « Haut fait »).

**Essayer avant d'avoir** : un clic sur un objet verrouillé l'affiche dans l'aperçu. Le bouton Enregistrer se désactive alors, avec le message « Vous essayez un objet que vous ne possédez pas encore » et un lien « Voir dans la boutique ».

Barre du bas : état (« Modifications non enregistrées » ou « Enregistré ✓ ») et les boutons Au hasard (parmi les objets possédés), Annuler et Enregistrer.

## Boutique
- **En-tête** : catégories À la une, Coffres et bonus, Apparence, Cartes, Titres et réactions, et le porte-monnaie (pièces, coffres, jokers).
- **Coffres et bonus**, toujours disponibles :
  - Coffre : **100 pièces** ;
  - 3 coffres : **270 pièces** (−10 %) ;
  - Joker : **150 pièces**.
- **Échoppe de la semaine** : 6 objets en vente temporaire contre des pièces.
  - Renouvelée **chaque lundi à 00:00 (heure de Paris)**, avec un compte à rebours en jours et heures (« encore 4 j 13 h »).
  - Composition fixe : **3 communs, 2 rares, 1 épique**. Jamais de Légendaire ni de Mythique : ceux-là se gagnent (coffres, niveaux, hauts faits).
  - Prix : commun **50 à 60**, rare **150**, épique **300**.
  - Même sélection pour tout le monde. Un objet déjà possédé reste affiché avec la mention « Possédé » (pas de bouton d'achat).
  - Le tirage évite les objets vendus les 4 semaines précédentes.
- **Bientôt** : des emplacements réservés pour la suite (tapis de table, effets d'impact, packs de réactions, passe de saison). Le catalogue est générique : un nouveau type d'objet = un nouveau `slot`.
- **Achat** :
  1. Fenêtre de confirmation : prix et solde après l'achat.
  2. Écran de réussite avec l'action suivante : « Ouvrir maintenant » pour un coffre, « Aller au salon » pour un joker, « Équiper » pour un objet, qui renvoie au Casier.
- **Colonne d'aide** :
  - « Gagner des pièces » : partie terminée +10, victoire +30, toutes ses mises tenues +15, haut fait +50, doublon de coffre +30 à +400.
  - Les règles du Joker.

## Joker (manche bonus)
- Se pose dans le **salon** avant le lancement, par n'importe quel joueur. Un seul par partie.
- Ajoute une **11e manche** de 11 cartes, comptée normalement, pour tous les joueurs.
- **Jusqu'à 6 joueurs** : au-delà, le paquet ne suffit pas pour 11 cartes chacun. À vérifier avec le nombre exact de cartes du moteur.
- Consommé au lancement de la partie, rendu si la partie est annulée avant la 1re manche.
- Le salon affiche « Joker posé par Théo : 11 manches ».
- La barre de partie affiche « Manche 11 · bonus ».

## Données
- **`items`** (catalogue générique) : `id`, `slot` (`hat`, `face`, `neck`, `pet`, `bg`, `frame`, `card_back`, `card_anim`, `title`, `reaction`, et plus tard `table`, `impact`…), `value`, `name`, `rarity`, `variants jsonb`, `source` (`base`, `chest`, `shop`, `level`, `achievement`), `price int null`, `active bool`.
- **`user_items`** : `user_id`, `item_id`, `variant`, `obtained_at`, `source`.
- **`user_wallet`** : `coins`, `chests`, `jokers`.
- **`weekly_shop`** : `week_start date` (le lundi), `item_ids int[]` (6 objets : 3 communs, 2 rares, 1 épique), rempli par une tâche planifiée Supabase le lundi à 00:00, heure de Paris.
- **`profiles.look`** (jsonb) contient en plus `card_back`, `card_anims[]` (cartes animées activées), `title` et `reactions[]` (4 au plus, dans l'ordre de la barre). Les réglages « Son à l'impact » et « Animations des autres » restent en `localStorage`.
- **Edge Function** :
  - `shop.list` : catalogue permanent, échoppe de la semaine (avec la date de fin) et prix ;
  - `shop.buy {itemId | 'chest' | 'chest3' | 'joker'}` : une seule transaction, solde vérifié, objet déjà possédé refusé, objet absent de l'échoppe de la semaine en cours refusé ;
  - `profile.update` : refuse tout objet non possédé ;
  - `lobby.useJoker {gameId}`.
