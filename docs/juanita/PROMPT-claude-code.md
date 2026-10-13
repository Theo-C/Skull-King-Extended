Lis `docs/juanita/SPEC.md` et ouvre la maquette `docs/maquettes/Juanita.dc.html`. Remplace la fenêtre actuelle du pouvoir de Juanita Jade (cartes empilées par couleur).

Règle de conception importante : **la fenêtre ne fait aucune déduction pour le joueur.** Elle montre seulement les cartes non distribuées. Les cartes manquantes ne sont pas signalées (leur place reste un simple espace vide, sans cadre), pas de liste des cartes « chez les autres », pas de marquage de sa main, pas de compte par couleur sur le total.

1. **Serveur** : quand Juanita Jade est jouée, envoie au seul joueur concerné la liste des cartes non distribuées de la manche (message privé). Journal public : « Juanita Jade consulte les cartes non distribuées ».
2. **Client, nouvelle fenêtre compacte** conforme à la maquette (environ 810 × 400, sans défilement) :
   - un compteur « N cartes hors jeu » ;
   - une ligne par couleur : les cartes hors jeu seulement, en petites cases **alignées en colonnes par valeur** (1 à 14, puis les 3 de l'extension après un séparateur) ; une carte absente laisse sa place vide ;
   - les spéciales hors jeu en petites vignettes sans texte (31 × 44), avec « ×n » s'il y en a plusieurs, rangées dans l'ordre logique du SPEC (Skull King, pirates, Morgane, sirènes, monstres, fuites, actions) avec le même espacement partout ;
   - aperçu en grand de la carte survolée ou touchée.
3. **Une seule consultation** : la fenêtre ne se rouvre pas une fois fermée.
4. **Téléphone** : même disposition en plus petit (cases 18 × 26), aperçu au toucher.
5. **Accessibilité** : chaque case est un bouton avec un libellé complet.
6. **Tests** : la fenêtre ne contient que des cartes non distribuées ; les autres joueurs ne reçoivent pas la liste ; elle ne se rouvre pas.

`npm test`, `npm run build`, coche A13 dans `docs/ETAT.md`, commit.
