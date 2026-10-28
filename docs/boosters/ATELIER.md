# Atelier : fabriquer des cartes avec les éclats (board 37)

Maquette : `docs/maquettes/Atelier.dc.html`. La fabrication au choix est aussi accessible depuis la Collection (board 34), sur la variante manquante.

## Ce qui existe ailleurs

| Jeu | Monnaie | Fonctionnement |
|---|---|---|
| Hearthstone | poussière arcanique | on recycle une carte pour 1/4 de son prix (légendaire : 400 / 1 600) ; fabrication de la carte exacte |
| Pokémon TCG Pocket | points de booster | 5 points par booster ouvert, échangés contre une carte précise du booster |
| Magic Arena | jokers par rareté | un joker de la bonne rareté donne la carte de son choix |
| Jeux « gacha » | fragments | fragments échangés contre un tirage garanti d'une rareté |

Nous combinons les deux approches : **tirage garanti d'une rareté** (moins cher, avec surprise) ou **carte précise** (4 fois plus cher), avec le rapport 1 pour 4 de Hearthstone entre recyclage et fabrication.

## Prix

| Rareté | Variantes | Doublon recyclé | Au hasard | Au choix (×4) |
|---|---|---|---|---|
| Commune | Patinée, Bord d'étain | 5 | 20 | 80 |
| Rare | Holographique | 20 | 80 | 320 |
| Épique | Nacre, Vivante | 60 | 240 | 960 |
| Légendaire | Signée | 200 | 800 | 3 200 |
| Mythique | Numérotée | — | — | — |

- **Au hasard** : une variante de la rareté choisie que le joueur **ne possède pas encore** (protection contre les doublons), carte tirée uniformément parmi celles qui lui manquent. Si tout est déjà possédé dans cette rareté, le bouton est désactivé (« Toutes les variantes … sont à vous »).
- **Au choix** : carte + variante exactes. Impossible si déjà possédée.
- Les **cartes vedettes** des boosters n'ont pas de bonus dans l'Atelier.

## Rythme attendu (notre groupe)

Simulation à ~9 boosters par joueur et par semaine : ~85 éclats la 1re semaine, ~240 la 2e, puis **~400 à 500 par semaine** à mi-saison (~5 600 cumulés en 3 mois). Soit, par semaine : environ 2 Épiques au hasard, ou une Signée au hasard toutes les 2 semaines, ou une Signée au choix toutes les 7 à 8 semaines.

## Écran

1. **Recycler** (colonne gauche) : liste des doublons hors boosters (récompenses, défis), total, « Tout recycler ». Valeur d'un doublon par rareté. On garde toujours 1 exemplaire.
2. **Au hasard** : 4 raretés (gemme de couleur, variantes concernées, nombre à découvrir, prix). « Forger » : les éclats convergent vers le centre (1,1 s), éclat de lumière de la couleur de la rareté, la carte apparaît face cachée puis se retourne (1 s), anneau, « Nouveau ». « Encore une » relance.
3. **Au choix** : filtres (Toutes, Pirates, Créatures, Couleurs), grille des cartes, grande carte de la variante choisie (grisée si non possédée), 6 variantes avec « possédée » ou leur prix, prix ×4 et rappel du prix au hasard. « Fabriquer » : même animation, la carte se colore.
4. Panneau des prix et notes.

## Serveur

- `collection.craft({ mode: 'random', tier })` : vérifie le solde, tire parmi les variantes manquantes de la rareté (graine serveur), débite, ajoute, renvoie la variante. Transaction unique.
- `collection.craft({ mode: 'pick', cardId, variant })` : refuse `numero`, refuse si déjà possédée, débite `4 × prix de base`.
- `collection.recycle({ all: true })` : recycle tous les doublons sauf 1 exemplaire par variante.
- Journal `shard_events` (gain, dépense, motif) pour l'historique et l'anti-abus.

## Tests

- Au hasard ne renvoie jamais une variante déjà possédée ; refusé si aucune variante manquante.
- Au choix coûte exactement 4 × le prix de base ; Numérotée refusée dans les deux modes.
- Solde jamais négatif sous concurrence (2 fabrications simultanées).
