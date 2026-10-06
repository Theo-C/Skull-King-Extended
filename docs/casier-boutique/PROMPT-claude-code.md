Lis `docs/casier-boutique/SPEC.md` et les maquettes `docs/maquettes/Casier.dc.html`, `CasierDos`, `CasierAnimees`, `CasierTitre`, `CasierReactions` et `Boutique.dc.html`. Ce travail remplace la garde-robe et l'échoppe du profil (ancien D8).

1. **Données.**
   - Migre `cosmetics` et `user_cosmetics` vers le catalogue générique `items` et `user_items` (garde les données existantes).
   - Ajoute `jokers` à `user_wallet` et crée la table `weekly_shop`.
   - Ajoute dans le catalogue les dos de cartes, les titres et les réactions de la maquette.
   - L'apparence de base (teint, coiffure, cheveux, pilosité, manteau) n'est pas dans `items` : elle est toujours libre.
2. **Serveur.**
   - Actions `shop.list` et `shop.buy` : coffre 100, 3 coffres 270, joker 150, objets de l'échoppe à leur prix, tout dans une seule transaction.
   - `weekly_shop` : 6 objets (3 communs à 50–60, 2 rares à 150, 1 épique à 300, jamais de Légendaire ni de Mythique), tirés chaque lundi à 00:00 heure de Paris par une tâche planifiée Supabase, sans reprendre les objets des 4 semaines précédentes. `shop.buy` refuse un objet qui n'est pas dans l'échoppe en cours.
   - Pièces gagnées dans `settleGame` : +10 par partie terminée, +30 par victoire, +15 si toutes les mises sont tenues, +50 par haut fait.
   - `profile.update` refuse tout objet non possédé.
3. **Page `/casier`.** Trois onglets (Pirate, Cartes, Titre et réactions) et trois colonnes (aperçu, emplacements, grille), conformes à la maquette :
   - filtres Tout, Possédés, À débloquer ;
   - essayage des objets verrouillés, avec Enregistrer désactivé ;
   - boutons Au hasard, Annuler, Enregistrer ;
   - onglet Cartes : mini table en aperçu (main adverse avec votre dos, carte animée posée qui joue), dos en grandes vignettes, cartes animées en lignes avec un interrupteur chacune, réglages Son à l'impact et Animations des autres (localStorage) ;
   - onglet Titre et réactions : place à la table, carte au survol et bulle de réaction en aperçu ; titres en plaques avec barre de progression ; barre de 4 réactions numérotées (touches 1 à 4 en partie, GIF fixe en 5e) au-dessus de la réserve ;
   - sur téléphone : l'aperçu en haut, les emplacements en défilement horizontal, puis la grille sur 3 colonnes.
4. **Page `/boutique`.**
   - Catégories, cartes Coffres et bonus, échoppe de la semaine (6 objets, compte à rebours jusqu'au lundi, « Possédé » sur les objets déjà acquis), encarts « Bientôt ».
   - Achat : fenêtre de confirmation, puis écran de réussite avec l'action suivante (ouvrir le coffre, aller au salon, équiper).
   - Colonne « Gagner des pièces » et règles du Joker.
5. **Joker.**
   - Dans le salon, bouton « Poser un Joker (11e manche) » si le joueur en possède un et qu'il y a 6 joueurs au plus. Action `lobby.useJoker`.
   - Le moteur joue 11 manches, et la barre de partie affiche « Manche 11 · bonus ».
   - Joker rendu si la partie est annulée avant la 1re manche.
6. **Profil.** Remplace la garde-robe par un résumé (avatar, titre, nombre d'objets) avec les boutons « Personnaliser », qui mène au Casier, et « Boutique ». Ajoute Casier et Boutique dans la barre de navigation.
7. **Tests.**
   - Achat avec un solde insuffisant ou un objet déjà possédé : refusé.
   - L'échoppe de la semaine est la même pour tout le monde, contient 3 communs, 2 rares, 1 épique, et change le lundi.
   - Réactions : 4 au plus, et les touches 1 à 4 envoient la bonne réaction en partie.
   - Le Joker est refusé à plus de 6 joueurs, puis rendu si la partie est annulée.
   - `look` invalide : refusé.

   Lance `npm test` et `npm run build`, coche D8 et D12 dans `docs/ETAT.md`, puis fais un commit.
