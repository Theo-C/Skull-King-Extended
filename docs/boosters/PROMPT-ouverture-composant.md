# Écran Booster : intégrer le composant complet (toutes les animations)

Le composant `web/src/booster/booster-opening.js` est **l'écran entier déjà fait**, portage fidèle de la maquette `Booster` : carrousel 3D, coupe au doigt, ouverture (bande qui s'envole, flash, lumière, rayons), **cartes qui sortent réellement du sachet** (elles montent derrière lui puis passent devant pendant qu'il glisse vers le bas), pile qu'on fait glisser, 5e carte cachée et retournement, moment Signée / Numérotée, booster divin discret, butin avec barre de collection, **inclinaison des cartes** (souris, doigt, gyroscope) pour voir l'holo. Ne le réécris pas : branche-le.

Démo autonome : lance un serveur à la racine (`npx serve .`) et ouvre `/docs/boosters/demo/booster-demo.html` (boutons « Forcer » en bas à gauche). C'est la référence visuelle à atteindre dans le jeu.

1. **Remplace l'écran Booster actuel** par `<booster-opening>` (Web Component, sans dépendance). Dans React : `import './booster/booster-opening.js'`, un `ref` sur `<booster-opening>` et les propriétés dans un `useEffect` (pas d'attributs). Supprime l'ancienne implémentation de la sélection/ouverture pour ne pas garder deux versions.
2. **Branche les propriétés** :
   - `packs` : `[{ id, name, desc, sachet: '/boosters/sachet_<id>.webp', back: '/cards/dos_<id>.webp', featured: [cardId×3] }]` ;
   - `price` (50), `coins`, `freeLabel` ;
   - `open = async (packId) => ({ cards, divine, collection: { before, after, total } })` : appelle `booster.open` côté serveur ; `cards` = 5 objets `{ id, name, variant, rarity ('c'|'r'|'e'|'l'|'m'), isNew, shards, serial }` dans l'ordre des emplacements ;
   - `renderCard = (card, { width, still }) => HTMLElement` : rend **notre composant de carte avec sa variante** (calques, holo, vivante…) dans un élément DOM (en React : `createRoot(div).render(<Card … />)`, démonté au retrait). Sans `renderCard`, le composant affiche `cards/<clé>.webp` avec un reflet simple ;
   - `cardsBase = '/cards/'`, `gyro = true` sur mobile (sur iOS, demander `DeviceOrientationEvent.requestPermission()` au premier toucher) ;
   - `haptics = kind => Haptics.impact({ style: kind })` (Capacitor), `sfx = name => sfx.play(name)` (`crinkle`, `cut`, `tear`, `swipe`, `chime`, `chord`, `fanfare`).
3. **Événements** : `booster-done` (mettre à jour pièces, éclats, collection), `booster-collection` (aller à la Collection), `booster-close`, `booster-error` (message et retour au choix).
4. **Ne change pas** les durées, courbes et distances du composant (voir `docs/boosters/ANIMATIONS.md`). Si un réglage du jeu « vitesse des animations » existe, applique-le globalement avec un facteur sur toutes les durées, pas au cas par cas.
5. **Mise en page** : le composant remplit son conteneur et met à l'échelle sa scène de 680 × 900. Donne-lui toute la hauteur disponible sous la barre du site (téléphone compris). Le panneau des chances peut rester à côté sur grand écran (hors composant).
6. **Tests** :
   - Playwright sur la démo et sur l'écran du jeu : choisir, couper au glisser, vérifier que la pile monte du sachet (captures à 0,4 s, 0,9 s et 1,4 s après la coupe), glisser 4 cartes, retourner la 5e, butin ;
   - trace de performance sur téléphone émulé (CPU ×4) : moins de 5 % d'images perdues, aucune tâche > 50 ms pendant les glisser ;
   - `prefers-reduced-motion` : l'ouverture devient un fondu, rien ne flotte ni ne tourne.

Mets à jour la ligne D14b de `docs/PROMPT-MAITRE.md`.
