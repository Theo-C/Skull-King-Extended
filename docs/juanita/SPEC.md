# Pouvoir de Juanita Jade : les cartes non distribuées (A13)

Maquette : `docs/maquettes/Juanita.dc.html`. Elle remplace la fenêtre actuelle, qui empile les ~80 cartes en 5 rangées : illisible, et immense si on étale les cartes.

## Principe
- **Lisible sans défilement** : les cartes non distribuées sont montrées en petites cases, triées, et une seule grande carte s'affiche à droite, celle qu'on survole.
- **Aucune déduction faite à la place du joueur.** La fenêtre montre uniquement ce que le pouvoir révèle : les cartes hors jeu. Les cartes manquantes ne sont pas signalées (simple espace, aucun cadre ni marque), pas de « chez les autres », pas de marquage de votre main, pas de compte « x / 17 ». C'est au joueur de remarquer qu'il manque le 9 et le 12 noirs.

## Contenu de la fenêtre (environ 1000 × 590 sur ordinateur, sans défilement)
1. **En-tête** : petite vignette de Juanita Jade (34 × 48), « Cartes non distribuées » (23 px), « Juanita Jade · manche 3 · visible par vous seul », et une pastille « 81 hors jeu ».
2. **Une ligne par couleur** (Noir, Doublon, Marine, Perroquet ; nom complet au survol) : les cartes hors jeu seulement, en cases de 32 × 44 (3 px d'écart), **alignées en colonnes** : chaque valeur a toujours la même place (le 1 dans la 1re colonne… le 14 dans la 14e), puis les 3 colonnes de l'extension (7 −5, 8 +5, 0/14) après un séparateur. Une carte absente laisse sa place vide, sans cadre ni marque. Case pleine à la couleur de la famille, chiffre en Pirata One 17 px.
3. **Spéciales, regroupées par famille** dans des encadrés légers, sur deux lignes :
   - 1re ligne : Skull King · Pirates · Morgane · Sirènes ;
   - 2e ligne : Monstres (Kraken, Baleine, Raie, Fosse des Noyés) · Fuites (Drapeau blanc, Butin) · Actions (Dernière Bordée, Planche, Grand Quinze).
   Chaque encadré a un titre avec le **nombre de cartes hors jeu de la famille** (« PIRATES 5 »), pour compter d'un coup d'œil sans survoler. Dedans : vignettes de 48 × 68 avec le **nom court** dessous (Rosie, Bendt, Rascal, Juanita, Harry, Marie, Con, Morgane, Alyra, Circé, Kraken, Baleine, Raie, Fosse, Drapeau, Butin, Bordée, Planche, Grand 15), et une pastille « ×4 » bien visible s'il y a plusieurs exemplaires. Ordre interne : celui de la liste ci-dessus. Une famille sans aucune carte hors jeu n'est pas affichée.
4. **Aperçu** à droite (150 × 214) : la carte survolée ou touchée, avec son nom. Pour une carte numérotée, le chiffre est posé dans le médaillon de l'illustration de la couleur.
5. **Pied** : « Survolez une carte pour l'agrandir. Une fois fermée, cette fenêtre ne se rouvre pas. » et bouton Fermer.

## Une seule consultation
Comme pour la carte physique, on regarde une fois : la fenêtre ne se rouvre pas après fermeture (pas d'icône pour la revoir). Elle reste ouverte tant que le joueur ne la ferme pas.

## Téléphone
Même disposition en plus petit : cases de 18 × 26 (17 par ligne tiennent sur 390 px), familles de spéciales les unes sous les autres avec vignettes de 34 × 48 et nom court, aperçu au toucher par-dessus la fenêtre. Fenêtre en bas d'écran, pas en plein écran.

## Accessibilité
Chaque case est un bouton avec un libellé complet (« 12 Pavillon noir »).

## Secret
Seul le joueur de Juanita reçoit la liste des cartes non distribuées (message privé du serveur). Les autres voient seulement « Juanita Jade consulte les cartes non distribuées » dans le journal.
