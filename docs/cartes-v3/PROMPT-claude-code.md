# Prompt A : nouvelles illustrations de cartes

Les fichiers `web/public/cards/*.webp` sont de nouvelles faces de cartes illustrées.
- Format : 720 × 1024 px. Version **à bord blanc**, marges identiques (le corps du cadre est à 40 px du bord sur 720 pour toutes les cartes) : chaque carte a un fond papier crème identique, des coins arrondis (rayon 38 px sur 720) et un fin liseré. Le cadre coloré ressort sur le blanc, ce qui aide à identifier la couleur de la carte.
- Planche de contrôle : `docs/cartes-v3/planche.jpg`.

## Correspondance avec le moteur

| Fichier | Carte | Nom affiché (déjà écrit sur la carte) |
|---|---|---|
| rosie.webp | pirate `rosie` | Rosie la douce |
| bahij.webp | pirate `bahij` | Bendt le Ripate |
| rascal.webp | pirate `rascal` | Rascal le Flambeur |
| juanita.webp | pirate `juanita` | Juanita Jade |
| harry.webp | pirate `harry` | Harry le géant |
| mary.webp | pirate `mary` (extension) | Marie Thorne |
| con.webp | `con` (extension) | Con le belliqueux |
| sk.webp | `sk` | Skull King |
| mermaid0.webp | `mermaid`, `v: 0` | Alyra |
| mermaid1.webp | `mermaid`, `v: 1` | Circé |
| tigress.webp | `tigress` | Morgane la Louve |
| kraken.webp | `kraken` | Le Kraken (pas de nom écrit) |
| whale.webp | `whale` | La Baleine Fantôme (pas de nom écrit) |
| escape.webp | `escape` | Drapeau blanc (pas de nom écrit) |
| loot.webp | `loot` | Pacte de Butin (pas de nom écrit) |
| volley.webp | `volley` (extension) | Dernière Bordée (pas de nom écrit) |
| stingray.webp | `stingray` (extension) | La Raie Étoilée (pas de nom écrit) |
| plank.webp | `plank` (extension) | La Planche (pas de nom écrit) |
| davy.webp | `davy` (extension) | La Fosse des Noyés (pas de nom écrit) |
| wild.webp | `wild` (extension) | Le Grand Quinze : le « 15 » est déjà dessiné dans le médaillon, n'ajoute pas de chiffre par-dessus |
| suit-yellow.webp | cartes numérotées `yellow` | Doublon |
| suit-purple.webp | cartes numérotées `purple` | Carte marine |
| suit-green.webp | cartes numérotées `green` | Perroquet |
| suit-black.webp | cartes numérotées `black` | Pavillon noir |

Toutes les cartes du jeu ont maintenant une illustration. Seul le dos garde sa face actuelle « Mers Sauvages » ; garde aussi les anciennes faces dans le code, comme solution de secours si une image ne se charge pas.

Les cartes spéciales sans personnage (Kraken, Baleine, Drapeau blanc, Butin, Bordée, Raie, Planche, Fosse des Noyés, Grand Quinze) ont leur symbole dans le médaillon en haut à droite et pas de nom écrit. Le nom s'affiche au survol et dans le zoom.

**Noms** : les noms écrits sur les illustrations (Rosie la douce, Bendt le Ripate, Rascal le Flambeur, Juanita Jade, Harry le géant, Marie Thorne, Con le belliqueux, Skull King, Alyra, Circé, Morgane la Louve) sont les noms officiels voulus. Mets à jour les noms affichés par le moteur (`PIRATES`, `SPECIAL`, `DESC`, noms des sirènes, règles, journal, zoom) pour qu'ils correspondent exactement à ceux des cartes.

## Ce qu'il faut faire

### 1. Rendu de la face (`web/src/cards.ts`)

- Ajoute `ART: Record<string, string>` qui associe chaque clé de carte à son fichier.
- Dans `faceHTML`, si `ART[clé]` existe, rends `<div class="art"><img src="cards/<clé>.webp" alt="" decoding="async" draggable="false"></div>` à la place du HTML actuel. L'image remplit toute la face 252 × 352 (`object-fit: cover`). Arrondis les coins de `.card` à `calc(13px * var(--s))` pour suivre ceux de l'image, et garde l'ombre portée actuelle pour détacher la carte du tapis.
- Utilise un chemin relatif (`cards/...`) pour que l'appli Capacitor fonctionne (`base './'`).
- Précharge les 14 images au démarrage de la table (`new Image().src = …`) pour qu'elles ne clignotent pas au premier affichage.

### 2. Chiffre des cartes numérotées

Une même illustration sert pour toutes les valeurs d'une couleur : le médaillon en haut à droite a été vidé, et c'est le code qui écrit le chiffre dedans (exemple : `docs/cartes-v3/exemple-pavillon-noir-12.png`).

- **Position du médaillon**, en pourcentage de l'image : centre à `left: 80.6 %`, `top: 13.2 %`, diamètre `18.9 %` de la largeur.
- **Chiffre** : police `Pirata One`. Taille environ `14 %` de la largeur de la carte pour 1 chiffre, `12 %` pour 2 chiffres. Utilise une unité qui suit `--s`, par exemple `calc(252px * var(--s) * .14)`.
- **Couleur du chiffre** selon la couleur de la carte :
  - jaune : `#2b1d0c`
  - violet : `#2b1838`
  - vert : `#12301a`
  - noir : `#f0d078` (doré sur la pièce en fer)
- **Cas particuliers** : affiche un petit sceau doré juste sous le médaillon (centre `left: 80.6 %`, `top: 25 %`, diamètre `11 %`) dans les cas suivants :
  - 14 : `+10`, ou `+20` pour le 14 noir ;
  - 7 de l'extension : `−5`, sceau rouge ;
  - 8 de l'extension : `+5` ;
  - 0/14 : le médaillon affiche `0·14` en plus petit, et pas de sceau.

### 3. Pastille de pouvoir sur les personnages

Les cartes de personnages n'ont plus de texte. Pour qu'on les reconnaisse même quand la main est en éventail (seul le bord gauche est visible), pose une pastille par-dessus le médaillon en haut à gauche, celui de l'ancre ou de la coquille.

- **Position** : centre à `left: 17.8 %`, `top: 12.1 %` pour les pirates et Corbin, `left: 19 %`, `top: 12.1 %` pour Barbe-Cendre et les sirènes ; diamètre `15 %` de la largeur.
- **Apparence** : disque doré en dégradé radial (`#fff2c4` → `#e2bd62` → `#a77b22`), bordure sombre fine, icône ou texte en `#2b1d0c`.
- **Contenu** : dans `docs/cartes-v3/pastilles.json`, soit un SVG avec `stroke="currentColor"`, soit un texte court écrit en `Pirata One`.
  - pirates : boussole, cartes, dé, œil, ±1, fil ;
  - `tigress` : pas de pastille (elle se joue comme Pirate ou comme Fuite ; l'étiquette `.tag` le précise une fois jouée) ;
  - `sk` : `+30` ;
  - sirènes : `+40` ;
  - `con` : `+30`.

### 4. Zoom au survol long

Le zoom au survol long (300 px de large) affiche la grande illustration. À côté, sur une petite fiche parchemin, il affiche le nom et la règle : réutilise `DESC` et `PIRATES[...].pw` de l'engine. C'est désormais le seul endroit où la règle d'une carte illustrée est écrite en toutes lettres.

### 5. Les éléments existants restent valables

Les états `.playable`, `.dim`, `.sel`, `.forced`, `.win`, l'étiquette `.tag` (Pirate / Fuite, vaut 0 ou 14, couleur du Grand Quinze) et le calcul de taille des cartes dans la main continuent de fonctionner, avec l'image comme avec l'ancienne face.

### 6. Contrôle

1. Lance une partie d'entraînement : chaque carte illustrée s'affiche, en main, sur la table, dans le journal et au zoom.
2. Vérifie les chiffres de 1 à 14 dans les 4 couleurs, ainsi que les cartes 7, 8 et 0/14 de l'extension.
3. Vérifie le rendu à 1366 × 768 et à 390 × 844.
4. Lance `npm run build`.

---

# Prompt B : ouverture de coffre et objets

Lis dans `docs/ecrans-compte/SPEC.md` les sections « Avatar composé et garde-robe » et « Ouverture de coffre ». Lis aussi les maquettes `docs/maquettes/Coffre.dc.html` (animation : le script en bas du fichier donne les étapes et les durées) et `Objet.dc.html` (les 11 objets en SVG).

## 1. Données

Si la migration de la garde-robe (prompt 3 de `docs/ecrans-compte/PROMPT-claude-code.md`) n'est pas encore faite, crée le minimum :
- `cosmetics (id, slot, value, rarity in ('commun','rare','epique','legendaire'), name, variants jsonb)`, avec en données de départ le catalogue de `Profil.dc.html` (constante `CAT`) ;
- `user_cosmetics (user_id, cosmetic_id, variant, obtained_at, source)` ;
- `user_wallet (user_id pk, coins int default 0, chests int default 0)`.

Les règles RLS suivent le modèle existant : lecture pour soi, écriture uniquement par l'Edge Function.

## 2. Serveur

- **À la fin d'une partie en ligne** (`settleGame`) : +1 coffre pour le gagnant humain, de façon idempotente.
- **Nouvelle action `chest.open`** :
  1. vérifie que `chests > 0`, puis retire 1 ;
  2. tire une rareté : 62 % Commun, 26 % Rare, 9 % Épique, 3 % Légendaire ;
  3. tire un objet de cette rareté ;
  4. si l'objet est déjà possédé, convertis-le en pièces (Commun 30, Rare 80, Épique 140, Légendaire 200) ;
  5. renvoie `{ item: {slot, value, name, rarity}, duplicate, coinsGained, coins, chests }`.
  
  Tout se passe dans une seule transaction. Le tirage est fait par le serveur, jamais par le client.
- **Tests** :
  - les probabilités avec une graine fixe ;
  - l'impossibilité d'ouvrir à 0 coffre ;
  - la conversion d'un doublon ;
  - un coffre ne peut pas être ouvert deux fois.

## 3. Site

- **`web/src/objects.ts`** : `objectSVG(value, color?)` reprend exactement les tracés de `Objet.dc.html`. Pour les objets sans dessin dédié (foulard, plume, bicorne, décors, cadres…), il renvoie un aperçu de l'avatar qui porte l'objet.
- **`web/src/chest.ts`** : `openChestOverlay(result)` est une superposition plein écran qui reproduit l'animation de `Coffre.dc.html`. Écris-la en CSS et TypeScript simples, sans bibliothèque.
  1. **Repos** : le coffre flotte doucement.
  2. **Secousse** : 0,9 s.
  3. **Lueur blanche** : le couvercle s'entrouvre et des rayons blancs sortent. Cette phase dure plus longtemps quand l'objet est plus rare : 1,5 s / 1,8 s / 2,1 s / 2,5 s.
  4. **Changement de teinte** : en 1 s, la lueur, le halo et les rayons passent à la couleur de rareté (`#d6dde4`, `#4fa8ff`, `#c27dff`, `#ffc94a`).
  5. **Ouverture** : le couvercle s'ouvre en grand, avec un éclat et des étincelles.
  6. **Objet** : il sort et flotte au-dessus du coffre, avec sa rareté, ses étoiles (1 à 4), son nom et son emplacement.
  7. **Doublon** : l'objet fond en pièces qui volent vers le compteur.
  
  Boutons : « Passer » pendant l'animation, puis « Ouvrir le suivant » (s'il reste des coffres) et « Équiper » (qui met à jour `profiles.look`).
- **Accès au coffre** :
  - depuis l'écran de fin de partie (bouton « Ouvrir le coffre ») ;
  - depuis la garde-robe du profil (bouton « Ouvrir N coffres ») ;
  - par un petit badge « coffre » dans l'en-tête quand `chests > 0`.
- **Accessibilité** : avec `prefers-reduced-motion`, affiche directement le résultat. Sons courts optionnels (secousse, changement de teinte, ouverture), coupés si l'option Sons est désactivée.

## 4. Contrôle

1. `npm test` et `npm run build` passent.
2. Gagne une partie d'entraînement en ligne avec 2 comptes, ouvre le coffre et vérifie l'objet dans la garde-robe.
3. Force un doublon (en mode développement) et vérifie que les pièces augmentent.
4. Fais un commit séparé pour les cartes et pour le coffre.
