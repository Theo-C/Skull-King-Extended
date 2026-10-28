# Ouverture de booster : notes techniques (board 35, version 2)

Maquette : `docs/maquettes/Booster.dc.html` (toute la logique d'états est dans sa classe `Component`).

## États

`choose` → `focus` → `opening` (1,6 s) → `stack` → `recap`

- `focus` : appeler `booster.open` **à l'entrée** de cet état (pièces débitées, cartes tirées côté serveur). Si l'appel échoue, retour à `choose` avec un message. Le joueur ne peut plus annuler une fois la coupe commencée.
- `opening` : séquence fixe (1,95 s), **identique quel que soit le contenu** (lumière dorée neutre), sauf les paillettes d'or du booster divin. **Le sachet ne change jamais de forme ni d'échelle.**
  - 0 → 0,55 s : la bande s'envole (`lidoff`) ; le corps du sachet est découpé en bord déchiré (`clip-path`) ;
  - 0,2 → 1,3 s : lumière et rayons qui jaillissent par l'ouverture (`leak`, `lrays`) ;
  - 0,5 → 1,1 s : la pile (réduite à 82 %) **monte depuis l'intérieur du sachet**, placée derrière lui (`z-index` sous le sachet) : on ne la voit qu'au-dessus du bord déchiré ;
  - 1,05 → 1,65 s : le sachet glisse vers le bas et s'efface (`pdrop`), pendant que la pile passe devant et redescend au centre à 100 % (fin à 1,85 s).
- `stack` : index `top`. Seules 3 cartes sont rendues (la carte du dessus, la suivante, un dos derrière) + la carte qui s'envole.
- `recap` : grille, éclats et collection animés.

## Geste de coupe

- Zone tactile : 80 px de haut autour des pointillés, 30 px de débord de chaque côté, `touch-action: none`, `setPointerCapture`.
- La progression ne fait qu'augmenter ; elle démarre seulement si le doigt se pose dans le premier tiers.
- Ouverture à 92 %. Lâcher avant : retour à 0 avec une transition.
- Vibration légère à chaque palier de 10 %.

## Geste de la pile

- Glisser horizontal : la carte suit le doigt et pivote (`dx / 18` degrés). Au-delà de 90 px, elle s'envole du côté du geste.
- Toucher sans glisser : carte suivante. Sur une carte face cachée : la retourner.
- Clavier : flèches gauche / droite ou Espace = suivante ; Entrée = révéler.

## Dos de carte

- `web/public/cards/dos.webp` (720 × 1024), généré depuis `docs/boosters/dos-carte.svg` (polices Pirata One et IM Fell English SC).
- Reflet doré qui passe toutes les 4,5 s. En booster, la 5e carte cachée a une lueur dorée et un flottement **identiques pour toutes les raretés** (la prop `glow` de `CarteVar` existe mais n'est pas utilisée en booster, pour ne rien dévoiler).

## Rareté et couleurs

| Rareté | Variantes | Losanges | Couleur |
|---|---|---|---|
| Commune | Patinée, Étain | ◆ | blanc cassé |
| Rare | Holographique | ◆◆ | #4fa8ff |
| Épique | Nacre, Vivante | ◆◆◆ | #b77dff |
| Légendaire | Signée | ★ | #ffc94a |
| Mythique | Numérotée | ★★ | #e7c6ff + arc-en-ciel |

## Booster divin

- `booster.open` renvoie `divine: true`. Indices discrets : 8 paillettes d'or pendant l'ouverture, points de progression en étoiles. Annonce explicite seulement au butin (« ✦ Booster divin · 1 sur 2 000 ✦ »), puis aux amis et dans le salon.
- Comparaison : dans Pokémon TCG Pocket, rien ne signale un booster divin avant de voir les cartes ; dans Hearthstone, la couleur de rareté apparaît au survol d'une carte face cachée. Nous gardons le suspense comme Pocket, avec juste un frisson à l'ouverture.

## Performances

- `CarteVar` en `still` pour les cartes derrière et celle qui s'envole ; seule la carte du dessus est animée et inclinable.
- Précharger les calques et masques des 5 cartes pendant l'état `focus`.
- `prefers-reduced-motion` : pas de tremblement, pas de rayons qui tournent, flash supprimé ; la coupe reste un geste mais l'ouverture devient un fondu.
