# Pli en ligne : l'ordre de pose se lit d'un coup d'œil

Maquette : `docs/maquettes/PliOrdre.dc.html`. Clique sur « Carte suivante » pour voir le pli se construire.

- **Disposition :** les cartes jouées ne sont plus posées devant chaque joueur autour de la table. Elles s'alignent au centre du tapis, de gauche à droite, dans l'ordre où elles ont été jouées.
- **En-tête de chaque carte :** une pastille ronde de la couleur du joueur, avec son rang (1, 2, 3…) et son nom.
- **Places vides :** les joueurs qui n'ont pas encore joué ont une place vide en pointillés. Celle du prochain joueur pulse, avec « X réfléchit… » ou « À vous de jouer ».
- **Repères :**
  - de petites flèches entre les places ;
  - la couleur demandée rappelée au-dessus du pli ;
  - l'étiquette « ouvre » sous la première carte.
- **Carte qui mène :**
  - elle est entourée d'or avec « prend le pli », et les autres sont légèrement assombries ;
  - une phrase sous le pli explique pourquoi elle mène : réutilise `resolve` / `legalCards` de l'engine.
- **Plaques des joueurs :** chacune porte une pastille avec le rang du joueur dans le pli en cours.
- **Animation :** la carte vole depuis la plaque du joueur jusqu'à sa place dans la ligne. À la fin du pli, toutes les cartes glissent vers le gagnant.
- **Taille des cartes :** la ligne doit tenir entre les plaques de gauche et de droite jusqu'à 6 joueurs ; réduis la taille des cartes au-delà de 4 joueurs. Sur téléphone, même ligne en plus petit.
- **Dernière Bordée :** la carte supplémentaire s'ajoute en fin de ligne, avec son propre numéro.

Vérifie l'affichage à 3, 4 et 6 joueurs.
