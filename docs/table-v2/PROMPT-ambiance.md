Lis `docs/table-v2/AMBIANCE.md` et la maquette `docs/maquettes/TableAmbiance.dc.html` (sa mise en page et ses SVG ; ne copie pas le format .dc.html).

Ajoute l'ambiance pirate à la table de jeu, sans rien changer à la logique :
1. Crée `web/src/ambiance.ts` : il exporte les SVG décoratifs (carte marine découpée à l'ellipse, clous et corde, lanterne, hublot, dague et doublons) et une fonction `mountAmbiance(tableEl)` qui les insère avec `aria-hidden="true"` et `pointer-events: none`.
2. Ajoute les styles dans `web/src/styles/ambiance.css` : planches, bois, sceau de cire, parchemin, nœuds de corde, keyframes `sway`, `flicker`, `swell`, `swell2`. Coupe tout sous `prefers-reduced-motion` et sous `.sobre`. Masque les accessoires des coins sous 1100 px et dans la version téléphone.
3. Habille les éléments existants : rang du pli en sceau, pastille de couleur demandée en parchemin, rivets sur les plaques, en-tête avec une corde de nœuds (une par manche), rail de la main.
4. Dans les réglages, ajoute « Ambiance : Pirate / Sobre » (localStorage `pli.ambiance`).
5. Vérifie qu'aucun décor ne passe sous une carte, la main ou un texte, à 1366 × 768, 1920 × 1080 et 390 × 844. Lance `npm run build`, puis coche A9 dans `docs/ETAT.md`. Fais un commit.
