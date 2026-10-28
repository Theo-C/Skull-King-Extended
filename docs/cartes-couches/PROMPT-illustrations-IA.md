# Prompt pour générer de nouvelles illustrations de cartes (IA image)

Adapté de la direction artistique « cadre or antique mat + fond holographique texturé + signature dorée à chaud ».

**Ce qui change avec nos cartes en couches** : le cadre, la feuille holo, la gravure, les reflets et la signature sont faits **par le code**, pas dans l'image. L'IA ne doit produire que **l'illustration seule, sans cadre, sans bandeau, sans texte**. Sinon on retombe dans le problème des bords qui bougent avec l'image.

## 1. Illustration seule (à utiliser pour chaque nouvelle carte)

```
Pirate fantasy trading card illustration, full-bleed, NO frame, NO border, NO banner, NO text, NO lettering, NO signature.
Subject: [SUJET : ex. « a one-eyed female pirate cook holding a rolling pin, standing in a ship galley »], waist-up, centered, facing the viewer, the subject occupies the middle 60 % of the width.
Background: a clearly separated, readable background [ex. « stormy sea with tall wave crests and a moody sky with sun rays »], with strong light on the wave crests and sky so a holographic foil can be applied on it later.
Composition: vertical 2:3, the illustration continues to the very bottom edge (no empty zone, no parchment), keep 6 % safe margin on all sides with nothing important there (it will sit under a frame).
Style: highly detailed digital painting, rich saturated colors, dramatic raking light, crisp edges between subject and background, same style as classic collectible card games.
Output: 1600 x 2400 px.
```

Négatif (si l'outil le permet) : `frame, border, card template, banner, ribbon, text, letters, watermark, signature, logo, rainbow foil, holographic, blurry, cropped head`.

## 2. Nouveau cadre (facultatif, si on veut un cadre baroque or antique)

```
Ornate baroque card frame only, antique gold, MATTE / satin finish (no shine, no rainbow, no holographic effect), carved rope, small skulls and shells, a round medallion at top-left and one at bottom-right.
The inside of the frame is a perfectly flat pure #00FF00 green rectangle (it will be cut out). The outside margin is flat off-white parchment #F1E6CC.
Front view, perfectly symmetrical and straight, no perspective, no shadow cast inside the window, vertical card ratio 720 x 1024.
```

Je détoure ensuite le vert (fenêtre) et je génère `cadre_<clé>.webp` + `marge_<clé>.png` avec les scripts du dossier.

## 3. Ce que fait le code (ne pas le demander à l'IA)

- **Feuille holo texturée** : arc-en-ciel limité au fond (`foil_<clé>.png`), vagues concentriques micro-gravées, reflets blancs sur les crêtes, paillettes : variante Holographique.
- **Dorure à chaud** : signature manuscrite or miroir avec gaufrage léger : variante Signée.
- **Parallaxe et mer qui ondule** : variante Vivante (le fond et le sujet sont séparés automatiquement).
- **Lumière rasante** : reflet qui suit la souris ou l'inclinaison du téléphone.

## 4. Après génération

1. Recadrer l'illustration au format du rectangle `illu` de sa famille dans `calques.json` (personnages : 528 × 827, soit 792 × 1240 à ×1,5) et l'enregistrer en `web/public/cards/calques/illu_<clé>.jpg`.
2. Reprendre le cadre d'une carte de la même famille (`cadre_<clé>.webp`), ou le nouveau cadre détouré, et ajouter l'entrée dans `calques.json`.
3. Lancer `masques_effets.py` pour créer `marge_`, `foil_` et `fond_`.
4. Vérifier la planche « 8 variantes × familles » à 56 px.

## 5. Variante « Full Art » (plus tard)

Variante mise de côté pour l'instant : ce prompt servira quand les illustrations sans bordure seront prêtes. **Important : le personnage doit garder la même taille et la même position que dans la carte d'origine** (même zoom), seuls les bords sont à peindre ; donner la carte d'origine en image de référence et demander un « outpainting » des 4 côtés.

```
Role: senior concept artist for a digital pirate trading card game.
Borderless full-art card illustration, strict orthographic front view, flat 2D texture, no perspective, no tilt, vertical 720 x 1024 (ratio 0.703), deliver at 1440 x 2048.
NO frame, NO border, NO banner, NO parchment, NO text, NO signature, NO logo: the illustration fills 100 % of the surface up to the four edges.
Subject: [SUJET, ex. « Rosie, one-eyed female pirate cook holding a rolling pin »], same character design as the reference image, waist-up, centered.
Background fully painted everywhere, including the bottom 25 % (sea, deck or landscape, never empty), clearly separated from the subject for later parallax.
Lighting for foil shaders: strong contrast, saturated colors, specular highlights close to pure white on sea foam, lightning, moon reflections and metal glints; keep skin tones natural.
Outpainting: keep the reference illustration at exactly the same scale and position, only paint the missing outer band (about 15 % on each side).
Style: same painterly digital style as the reference card.
```

Négatif : `frame, border, card template, banner, text, letters, signature, watermark, logo, perspective, tilt, 3D card mockup, drop shadow, blurry`.

Le Full Art reste nu : pas de signature, pas de médaillon, pas de texte.
