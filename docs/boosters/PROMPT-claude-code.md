# D14. Boosters de cartes et variantes

Lis `docs/boosters/SPEC.md`, `docs/boosters/OUVERTURE.md` et `docs/boosters/ATELIER.md`, et ouvre les maquettes copiées dans `docs/maquettes/` : `CarteVar.dc.html` (rendu des 8 variantes et du dos), `Collection.dc.html`, `Booster.dc.html` et `Atelier.dc.html`.

1. **État des lieux** :
   - composant de carte actuel et cartes animées (D11) ;
   - Boutique (D12) et coffre de victoire ;
   - éclats et Atelier (D13) ;
   - envoi des cartes posées en partie.

   Propose un plan avant de coder.
2. **Composant de carte** :
   - respecte la **règle n° 1** de la SPEC : le cadre, les médaillons et le personnage ne sont jamais modifiés ni recouverts ;
   - s'appuie sur les cartes en couches et leurs masques (B7 puis B8, à faire avant) : les effets ne touchent que la fenêtre d'illustration et **toute** la marge ; le CSS de référence est `docs/cartes-couches/carte-variantes.css` ;
   - ajoute la prop `variant` au composant de carte du jeu, avec le rendu CSS de `CarteVar` : couches limitées à la fenêtre d'illustration et à la marge, reflets neutres qui suivent la souris ou l'inclinaison, animation lente par défaut ;
   - respecte `prefers-reduced-motion` et « Animations des autres » ;
   - ajoute l'option « Afficher les cartes des autres en Standard » ;
   - ajoute un test visuel (capture Playwright) qui génère la planche « 8 variantes × chaque famille » à 56 px, à valider à l'œil avant chaque nouvelle variante ;
   - ajoute le dos pour l'ouverture.
3. **Données** :
   - tables et colonnes de la SPEC, avec RLS ;
   - attribution des Numérotées en une seule transaction (`numbered_stock`) ;
   - variante Standard par défaut pour tout le monde.
4. **Fonctions Edge** :
   - `booster.open` : contenu par emplacement avec l'échelle de Pokémon TCG Pocket légèrement réduite (tableau de la SPEC), cartes vedettes ×3, booster divin à 1/2 000 (renvoie `divine: true`), Numérotées limitées à 100, doublons → éclats. **Plus de garanties 6 / 30** ;
   - `collection.craft` (modes `random` et `pick`, voir `docs/boosters/ATELIER.md`), `collection.recycle`, `collection.choose`.
5. **Boutique** :
   - le booster à 50 pièces remplace le coffre à 100 pièces, avec le choix parmi 3 boosters et un booster gratuit par jour joué, après la 1re partie (réglage serveur `free_daily_booster`) ;
   - la victoire donne 1 booster ;
   - les coffres de D13 ne restent que comme récompenses.
6. **Écran d'ouverture** comme la maquette `Booster` (version 2, voir la SPEC et `docs/boosters/OUVERTURE.md`) : carrousel des 3 boosters, coupe au doigt le long des pointillés (avec bouton « Ouvrir sans glisser »), lumière neutre identique pour tous les boosters (aucun spoil), pile qu'on fait glisser carte par carte, cartes 1 à 4 face visible et seule la 5e face cachée avec un dos neutre, booster divin signalé discrètement (paillettes, étoiles) puis annoncé au butin, moment Signée / Numérotée, grille du butin avec barre de collection, sons via `sfx.ts`, vibrations sur mobile, annonce aux amis. Le tirage est fait **côté serveur avant la coupe** (`booster.open`) : l'écran ne fait que le mettre en scène.
7. **Atelier** comme la maquette `Atelier` (board 37) : recyclage, fabrication au hasard par rareté (prix de base, jamais de doublon) et au choix (×4), animation de forge.
8. **Écran Collection** comme la maquette : filtres, grille avec pastilles, grande carte inclinable, liste des variantes, Utiliser / Fabriquer / Recycler, aperçu « À la table », récompenses de collection.
9. **En partie** : la carte posée s'affiche dans la variante choisie par son propriétaire, et le survol montre la variante et le joueur.
10. **Tests** :
   - probabilités par emplacement (100 000 ouvertures, graine fixe) ;
   - jamais deux fois la même carte dans un booster ;
   - fréquences par emplacement à ±0,2 % du tableau, cartes 1 à 3 toujours communes, booster divin ≈ 0,05 % ;
   - Numérotées : jamais plus de 100, numéros uniques sous concurrence (10 ouvertures simultanées) ;
   - doublons et éclats ;
   - `collection.choose` refuse une variante non possédée ;
   - le moteur de jeu ignore totalement la variante ;
   - aucune variante ne modifie les pixels de la zone protégée (comparaison des captures Standard / variante hors fenêtre et marge) ;
   - Atelier : au hasard ne donne jamais une variante déjà possédée, au choix coûte 4 × le prix de base, Numérotée refusée, solde jamais négatif sous concurrence.

Coche D14, D14b et D15 dans `docs/PROMPT-MAITRE.md`.
