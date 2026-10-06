# GIF en partie (A10)

Maquette : `docs/maquettes/GifPartie.dc.html`. Les GIF de la maquette sont des exemples dessinés pour l'occasion. Dans le jeu, ils viennent d'une API de GIF.

## Expérience
- **Bouton « GIF »** dans la barre de réactions rapides, au-dessus de la main. Il ouvre un sélecteur (un panneau qui monte depuis le bas sur téléphone) qui contient :
  - un champ de recherche ;
  - les catégories en un clic : Tendances, Bravo, Rire, Rage, Pirate, Récents ;
  - une grille de GIF en 4 colonnes (2 sur téléphone).
- **Un clic sur un GIF l'envoie** et ferme le sélecteur.
- **Affichage pour tous, comme une émote sur Twitch.** Le GIF fait 160 × 120 px sur ordinateur et 110 × 82 px sur téléphone, avec le nom de l'envoyeur dessous. Il surgit au centre du tapis, puis :
  1. **Apparition avec rebond** (0 à 0,6 s) : il grossit de 35 % à 112 %, puis revient à 96 % et à 100 %, et atteint environ 68 % d'opacité.
  2. **Montée qui ralentit** (3,2 s au total) : environ 280 px vers le haut, avec une courbe `cubic-bezier(.22,.61,.36,1)`. L'opacité descend vers 58 %, puis le GIF s'efface sur la fin.
  3. **Balancement indépendant** pendant toute la montée : un élément intérieur oscille de gauche à droite (`translateX` et `rotate`, en aller-retour avec `ease-in-out`). Tire au hasard pour chaque GIF :
     - une amplitude de 10 à 22 px ;
     - une rotation de 3 à 8° ;
     - une période de 0,8 à 1,3 s ;
     - un départ décalé dans le cycle ;
     - une position horizontale décalée de ±50 px.

     C'est ce qui donne le mouvement naturel.

  Les keyframes exactes (`gifRise` sur l'élément extérieur, `gifSway` sur l'élément intérieur) sont dans la maquette.
- **Plusieurs GIF en même temps** : le premier est au centre exact. Les suivants se décalent d'environ 90 px vers le côté de leur envoyeur (gauche, droite, haut ou bas).
- **Superposition** : le GIF passe au-dessus du tapis et des cartes du pli (il est transparent), mais sous la main, le sélecteur et les boutons, avec `pointer-events: none` pour ne jamais bloquer un clic.

## Garde-fous
- **Débit** : 1 GIF toutes les 10 s par joueur, contrôlé côté serveur. Un seul GIF à l'écran par joueur : un nouveau remplace l'ancien. Le compte à rebours s'affiche à côté du bouton.
- **Bouton désactivé pendant votre propre tour** (on joue, on n'envoie pas de GIF pour faire attendre les autres).
- **Contenu** : filtre « tout public » côté serveur (paramètre de classement de l'API, le plus strict). Aucune URL libre : le client envoie seulement l'identifiant du GIF, et le serveur reconstruit l'URL à partir de l'API.
- **Options** :
  - « Masquer les GIF » dans les réglages ;
  - « Masquer les GIF de ce joueur » dans l'aperçu au survol (A7) ;
  - avec `prefers-reduced-motion`, le GIF apparaît et disparaît en fondu, sans montée ni balancement.
- **Parties classées** : les GIF restent autorisés, mais le joueur peut les couper.

## Technique
- **API** : Tenor a fermé son API publique le 30 juin 2026. On utilise **KLIPY**, conçue comme remplaçante de Tenor par les mêmes fondateurs, avec un niveau gratuit. Repli possible : GIPHY, dont le niveau gratuit est limité à 100 appels par heure en bêta et dont l'usage en production est payant. **Vérifie les conditions actuelles de KLIPY avant d'intégrer** : quotas, mention « Powered by KLIPY » obligatoire, publicités éventuelles à désactiver.
- **La clé API reste sur le serveur.** Edge Function, action `gif.search` avec `{q, cat, cursor}`. Elle met les résultats en cache 10 min par requête et renvoie pour chaque GIF : `{id, preview (petit mp4 ou webp), full, w, h}`. Préfère les formats mp4 ou webp aux .gif, beaucoup plus légers.
- **Action `gif.send` avec `{gameId, gifId}`.** Elle vérifie :
  - que le joueur est bien à la table ;
  - le débit de 10 s ;
  - que ce n'est pas son tour.

  Elle diffuse ensuite `{type: 'gif', userId, gifUrl, w, h, at}` sur le canal Realtime de la partie. Rien n'est stocké en base, à part un compteur pour le débit.
- **Côté client** : à la réception d'un message `gif`, il ignore les joueurs masqués, précharge le média, puis l'affiche près de la plaque de l'envoyeur. Il garde en local (localStorage) les 12 derniers GIF envoyés, pour la catégorie Récents.
