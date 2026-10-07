# Pouvoir de Juanita Jade : les cartes non distribuées (A13)

Maquette : `docs/maquettes/Juanita.dc.html`. Elle remplace la fenêtre actuelle, qui empile les ~80 cartes en 5 rangées : illisible, et immense si on étale les cartes.

## Principe
- **Lisible sans défilement** : les cartes non distribuées sont montrées en petites cases, triées, et une seule grande carte s'affiche à droite, celle qu'on survole.
- **Aucune déduction faite à la place du joueur.** La fenêtre montre uniquement ce que le pouvoir révèle : les cartes hors jeu. Les cartes manquantes ne sont pas signalées (simple espace, aucun cadre ni marque), pas de « chez les autres », pas de marquage de votre main, pas de compte « x / 17 ». C'est au joueur de remarquer qu'il manque le 9 et le 12 noirs.

## Contenu de la fenêtre (environ 810 × 400 sur ordinateur, sans défilement)
1. **En-tête** : petite vignette de Juanita Jade (34 × 48), « Cartes non distribuées » (23 px), « Juanita Jade · manche 3 · visible par vous seul », et une pastille « 81 hors jeu ».
2. **Une ligne par couleur** (Noir, Doublon, Marine, Perroquet ; nom complet au survol) : les cartes hors jeu seulement, en cases de 26 × 36 (3 px d'écart), **alignées en colonnes** : chaque valeur a toujours la même place (le 1 dans la 1re colonne… le 14 dans la 14e), puis les 3 colonnes de l'extension (7 −5, 8 +5, 0/14) après un séparateur. Une carte absente laisse sa place vide, sans cadre ni marque. Case pleine à la couleur de la famille, chiffre en Pirata One 17 px.
3. **Ligne « Spéciales »** : les spéciales hors jeu en vignettes d'illustration de 31 × 44, sans texte ; pastille « ×4 » s'il y a plusieurs exemplaires hors jeu. Le nom s'affiche dans l'aperçu.
   **Ordre logique, par famille** (même espacement de 6 px partout) :
   1. Skull King ;
   2. pirates : Rosie la douce, Bendt le Ripate, Rascal le Flambeur, Juanita Jade, Harry le géant, Marie Thorne, Con le belliqueux ;
   3. Morgane la Louve ;
   4. sirènes : Alyra, Circé ;
   5. monstres des abysses : Kraken, Baleine, Raie, Fosse des Noyés ;
   6. fuites : Drapeau blanc, Butin ;
   7. cartes d'action : Dernière Bordée, Planche, Grand Quinze.
4. **Aperçu** à droite (150 × 214) : la carte survolée ou touchée, avec son nom. Pour une carte numérotée, le chiffre est posé dans le médaillon de l'illustration de la couleur.
5. **Pied** : « Survolez une carte pour l'agrandir. Une fois fermée, cette fenêtre ne se rouvre pas. » et bouton Fermer.

## Une seule consultation
Comme pour la carte physique, on regarde une fois : la fenêtre ne se rouvre pas après fermeture (pas d'icône pour la revoir). Elle reste ouverte tant que le joueur ne la ferme pas.

## Téléphone
Même disposition en plus petit : cases de 18 × 26 (17 par ligne tiennent sur 390 px), vignettes spéciales de 24 × 34 sur plusieurs lignes, aperçu au toucher par-dessus la fenêtre. Fenêtre en bas d'écran, pas en plein écran.

## Accessibilité
Chaque case est un bouton avec un libellé complet (« 12 Pavillon noir »).

## Secret
Seul le joueur de Juanita reçoit la liste des cartes non distribuées (message privé du serveur). Les autres voient seulement « Juanita Jade consulte les cartes non distribuées » dans le journal.
