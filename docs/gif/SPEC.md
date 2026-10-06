# GIF en partie (A10)

Maquette : `docs/maquettes/GifPartie.dc.html`. Les GIF de la maquette sont des exemples dessinés pour l'occasion. Dans le jeu, ils viennent d'une API de GIF.

## Expérience

### Le panneau Réactions : un seul champ pour écrire ou chercher un GIF
Le panneau « Réactions » de la colonne de droite (celui qui contient les 4 réactions rapides et le champ de texte) intègre le GIF au lieu d'avoir un bouton GIF isolé sous le champ.
- **Réactions rapides** : grille 2 × 2, chaque bouton avec son numéro de touche (1 à 4). Un clic affiche la bulle au-dessus de votre plaque.
- **Le champ unique** (46 px de haut, coins 12 px) contient, de gauche à droite :
  - la saisie, avec le texte d'aide « Écrire une réaction ou /gif… » ;
  - le bouton **GIF** à l'intérieur du champ, à droite, comme sur Discord ;
  - la flèche d'envoi dorée, grisée si le champ est vide.
  - Sous le champ, une ligne d'aide : « Entrée pour envoyer · tapez « /gif bravo » pour chercher ».
- **Suggestions en tapant** : dès 2 lettres qui correspondent à des GIF (« bravo »), une bande de 3 vignettes (84 × 58) apparaît au-dessus du champ, avec « GIF pour « bravo » · clic = envoyer ». Un clic sur une vignette envoie le GIF ; Entrée envoie toujours le texte. Recherche avec un délai de 300 ms.
- **Mode GIF** (clic sur GIF, ou « /gif » suivi d'un espace dans le champ) :
  - le champ passe en bordure dorée et devient « Chercher un GIF… » ; le bouton GIF devient plein (doré) et la flèche disparaît ;
  - **le panneau grandit vers le haut, par-dessus le journal** (le journal rétrécit, rien ne couvre la table) : en-tête « ← Réactions · GIF · via KLIPY », catégories en une ligne (Récents, Tendances, Bravo, Rire, Rage, Pirate ; Récents par défaut), grille de 2 colonnes (vignettes de 104 px de haut, nom au survol) qui défile dans 340 px ;
  - un clic sur un GIF l'envoie et referme le mode GIF ; Entrée envoie le premier résultat ; Échap ou « ← Réactions » revient au texte.
- **Attente** : après un envoi, le bouton GIF affiche le décompte (« 7 s ») ; en mode GIF, la grille se grise avec une bande « Prochain GIF dans 7 s ». Les réactions texte restent libres pendant ce temps.
- **Sur téléphone** : le panneau Réactions est replié derrière un bouton ; le mode GIF s'ouvre en panneau qui monte depuis le bas (moitié d'écran), même champ en haut, grille de 2 colonnes.
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
- **Superposition** : le GIF passe au-dessus du tapis et des cartes du pli (il est transparent), mais sous la main et l'interface, avec `pointer-events: none` pour ne jamais bloquer un clic.

## Garde-fous
- **Débit** : 1 GIF toutes les 10 s par joueur, contrôlé côté serveur. Un seul GIF à l'écran par joueur : un nouveau remplace l'ancien. Le compte à rebours s'affiche dans le bouton GIF.
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
