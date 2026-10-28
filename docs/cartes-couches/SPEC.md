# Cartes en couches : cadre d'origine en calque, illustration dessous

Maquettes :
- `CarteCouches` (board 36) : avant / après, vue éclatée, familles, test de lisibilité ;
- `CarteVar` : le composant de carte de référence. Il est utilisé par les boards 34 et 35.

Démonstration animée : `carte-vivante.gif` (Vivante, Holo, Signée).

CSS de référence de toutes les variantes : `carte-variantes.css`.

## Le problème

Aujourd'hui, chaque carte est une seule image : cadre, médaillons, volutes, bandeau du nom et illustration sont peints ensemble. Animer l'illustration (variante Vivante, reflets, cartes animées) anime aussi des morceaux du cadre, qui glisse, se déforme ou se casse.

## La solution : on garde les cadres d'origine, mais en calque séparé

Chaque carte est découpée en **2 calques alignés au pixel**, tirés de l'image d'origine :

1. **`illu_<clé>.jpg` : l'illustration seule**, dessous. C'est **la seule couche qui bouge**.
   - Personnages (pirates, sirènes, Skull King) : **plus de bandeau du nom** (B8). L'illustration descend jusqu'au bas du cadre ; le nom s'affiche au survol et dans les infobulles.
   - Elle couvre la fenêtre d'illustration, plus 24 px de débord sous le cadre.
   - Les zones cachées par les médaillons et le débord sont reconstruites, pour qu'aucun vide n'apparaisse quand elle bouge.
2. **`cadre_<clé>.webp` : la carte d'origine, avec sa fenêtre d'illustration rendue transparente**, dessus.
   - Le cadre peint, les médaillons, les volutes et la marge sont **intacts** : ce sont les bordures d'origine, pas une version simplifiée. Seul le parchemin du nom des personnages a été retiré (B8).
   - Le bord de la fenêtre est adouci sur 1,5 px pour éviter tout crénelage.

**Au repos, la carte assemblée est identique à l'ancienne** (au bandeau près pour les personnages). Quand on l'anime, seule l'illustration bouge sous un cadre net et immobile.

Par-dessus le cadre, on ajoute seulement :
- la **valeur** des cartes de couleur, dans le médaillon vide (comme B2) ;
- les **matières de marge** des variantes (étain, nacre, irisé), le **numéro** des Numérotées ;
- la pastille de pouvoir (B3) et les sceaux +10 / +20 / −5.

## Découpe

- Script : `docs/cartes-couches/decoupe_calques.py`. Il prend les images d'origine 720 × 1024 et écrit `web/public/cards/calques/`.
- Réglages par **gabarit**, en pixels de l'image 720 × 1024 :
  - `suit` (cartes de couleur) : fenêtre `116,104 → 602,911`, médaillon `(583,135) r101` ;
  - `pir` (personnages : pirates, sirènes, Skull King) : fenêtre `96,98 → 624,690`, au-dessus du parchemin du nom ; médaillons d'angle `(119,119) r86` et `(612,108) r80` ;
  - `cre` (spéciales sans nom) : fenêtre `136,116 → 594,894`, médaillon `(560,140) r104`.
- Certaines cartes ont leurs propres réglages (dictionnaire `OVR`) : Baleine, Davy Jones, Butin, Planche, Raie, Bordée, Grand Quinze, Fuite, sirènes, Skull King (ses volutes), Bendt.
- `calques.json` donne pour chaque carte :
  - `fenetre` : le rectangle transparent du cadre ;
  - `illu` : le rectangle couvert par l'image d'illustration ;
  - `medaillons` : les médaillons qui restent opaques.
- **Nouvelle carte** = une ligne dans `C` (et dans `OVR` si son cadre diffère), puis on relance le script.

## Rendu dans le jeu

```html
<div class="carte" style="--w: 120px">
  <div class="fenetre" style="left:13.3%; top:9.57%; width:73.3%; height:57.8%">   <!-- calques.json · fenetre -->
    <div class="illu" style="left:-4.5%; top:-4.1%; width:109%; height:108.2%;
         background-image:url(cards/calques/illu_rosie.jpg)"></div>               <!-- calques.json · illu, relatif à la fenêtre -->
    <!-- effets de variante : taches, reflets, paillettes, signature -->
  </div>
  <img class="cadre" src="cards/calques/cadre_rosie.webp">                         <!-- inset: 0 -->
  <!-- valeur, pastille de pouvoir, sceaux, matières de marge, numéro -->
</div>
```

- `fenetre` : `position:absolute; overflow:hidden`.
- `illu` : `background-size: 100% 100%`.
- Toutes les positions sont en pourcentage de la carte, donc nettes à toutes les tailles.
- **Animation** :
  - uniquement sur `.illu`, avec `transform-origin` au centre de la fenêtre ;
  - **zoom entre 1,02 et 1,035**, déplacement d'1 % au plus (même taille apparente que la carte Standard) ;
  - au-delà, le débord de 24 px ne suffit plus.
- **Cartes animées (D11)** :
  - la vidéo remplace `.illu` dans la fenêtre ;
  - `<clé>-cadre.webp` est remplacé par `cadre_<clé>.webp` ;
  - les vidéos doivent être recadrées sur le rectangle `illu` de `calques.json`, avec le même découpage que l'image.
- **Variantes des boosters (D14)** : tout se passe dans la fenêtre et sur la marge (règle n° 1), avec les masques d'effets ci-dessous.

## Personnages sans bandeau (B8)

- Script `sans_bandeau.py`, à lancer après `decoupe_calques.py`. Cartes : Rosie, Rascal, Juanita, Harry, Marie, Morgane, Con, Skull King, Alyra, Circé, Bendt.
- Le parchemin du nom est effacé : les bords du cadre à sa hauteur sont reconstruits en miroir, le médaillon du bas est remis à l'identique.
- La fenêtre devient `96,98 → 624,925` (moins les médaillons) ; l'illustration est recadrée sur son point d'intérêt et agrandie pour la remplir. `calques.json` indique `sans_bandeau: true`.
- Le nom n'est plus peint sur la carte : afficher le nom (B6) **au survol**, dans le zoom et dans les infobulles.

## Masques d'effets (B8)

Script `masques_effets.py` (après les deux précédents ; `pip install rembg onnxruntime`). Pour chaque carte :

| Fichier | Contenu | Utilisé par |
|---|---|---|
| `marge_<clé>.png` | **toute** la bordure blanche (parchemin clair relié au bord de la carte), 360 × 512 | matières de marge : Patinée, Étain, Nacre, Holo, Signée, Numérotée |
| `foil_<clé>.png` | le **fond** de l'illustration (ciel, mer, jungle), pondéré par la lumière et les crêtes ; le personnage est exclu (détourage IA) | feuille holographique |
| `fond_<clé>.png` | le fond seul (1 − sujet) | Vivante : parallaxe 2 plans, mer qui ondule, particules |

Les trois masques sont alignés sur leur calque : `marge_` sur la carte entière, `foil_` et `fond_` sur le rectangle `illu`.

## Variantes : rendu (voir `carte-variantes.css`)

- **Marge** : un calque `.ring` couvre toute la carte, masqué par `marge_<clé>.png` (`mask-image`), en `mix-blend-mode: multiply` : la matière remplit tout le blanc et garde le grain du papier. Plus jamais de bande partielle.
- **Holographique** (inspiré d'une vraie carte « textured foil ») :
  - feuille arc-en-ciel en `color-dodge` masquée par `foil_` : seul le fond brille, le personnage et le cadre restent mats ;
  - gravure : fines vagues concentriques et lignes de vent, en `overlay` ;
  - reflet blanc qui glisse sur les crêtes, paillettes qui scintillent ;
  - tout suit la souris ou l'inclinaison du téléphone, sinon un mouvement lent automatique.
- **Vivante** :
  - fond : zoom 1,02 → 1,035 et glissement d'1 % ; personnage (masque inverse de `fond_`) : mouvement opposé (1,025 → 1,03) → profondeur, sans grossir l'illustration ;
  - cartes marines (Skull King, sirènes, Kraken, Baleine, Fuite, Davy Jones, Raie, Bordée) : ondulation de la mer (filtre SVG `feTurbulence` + `feDisplacementMap`) sur la moitié basse du fond ;
  - rayons de lumière qui tournent lentement, tache de lumière qui passe, particules dorées qui montent dans le fond.
- **Signée** : signature manuscrite en **or miroir** (dégradé or en `background-clip: text`), léger gaufrage (ombres claire au-dessus, sombre au-dessous), reflet qui glisse ; taille adaptée à la longueur du nom.
- **Numérotée** : Holo + Vivante + Signée + numéro gravé dans la marge.
- `prefers-reduced-motion` et « Animations des autres » coupent toutes les animations ; la carte reste belle à l'arrêt.

## Full Art : en attente

La variante Full Art (illustration seule jusqu'aux quatre bords) est **mise de côté** : elle sera faite à partir d'illustrations sans bordure fournies plus tard (prompt prêt dans `PROMPT-illustrations-IA.md`, section 5). Rien à implémenter pour l'instant.

## Zoom identique pour toutes les variantes

L'illustration a **la même taille dans toutes les variantes** (Standard, Patinée, Étain, Holo, Nacre, Signée, Numérotée). Seule la Vivante bouge, avec un zoom de **2 à 3,5 %** et un déplacement d'**1 % au plus** (le personnage : 2,5 à 3 %), juste assez pour ne jamais montrer de vide.

## Limites connues

- La fenêtre est un rectangle. Les volutes peintes **à l'intérieur** de ce rectangle (rares : Skull King) sont traitées comme des médaillons opaques. Autour d'elles, quelques pixels d'illustration restent fixes, ce qui ne se voit pas avec un zoom doux.
- Les zones reconstruites sous les médaillons sont un peu floues. Elles restent cachées tant qu'on ne dépasse pas le zoom maximal.

## Ce que ça remplace

- **B4** : coins et ombre, puisque l'image du cadre est la carte d'origine.
- Les **cadres vectoriels simplifiés** de la version précédente de ce dossier, abandonnés parce que pas assez beaux.
- Les anciennes images `cards/*.webp` restent la source du script et la solution de repli.
