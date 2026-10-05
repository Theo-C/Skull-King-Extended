# Ambiance pirate de la table (A9)

Maquette : `docs/maquettes/TableAmbiance.dc.html` (le bouton « Voir en sobre » compare avec la table actuelle). Tout est décoratif : **aucune donnée, aucune interaction nouvelle**.

## Règle d'or
Rien de décoratif sous les cartes du pli, sous la main ni sous un texte. Les décors restent dans les marges et les coins vides, et leur opacité est faible. Tous les éléments ont `pointer-events: none` et `aria-hidden="true"`.

## Couches (dans l'ordre, du fond vers l'avant)
1. **Fond de la page** : cloison en planches horizontales (dégradés `repeating-linear-gradient` brun foncé, joints de 1 px plus sombres), un halo chaud de lanterne en haut à gauche et un vignettage sur les bords.
2. **Rebord de la table** : bois veiné (dégradé + fines rayures), une rangée de clous en laiton (cercles en pointillés sur le pourtour de l'ellipse) et une corde tressée (deux traits en pointillés décalés) à la jonction avec le tapis.
3. **Tapis = carte marine** : un SVG découpé à l'ellipse du tapis, au-dessus du feutre et sous tout le reste.
   - quadrillage : opacité 0,07 ;
   - lignes de rhumb : 0,06 ;
   - rose des vents sous le pli : 0,08 ;
   - serpent de mer, « Mare Incognitum » et une tache de café : 0,10 maximum.
4. **Accessoires dans les coins vides** (masqués sous 1100 px de large et sur téléphone) :
   - une lanterne suspendue en haut à gauche, qui se balance (`sway`, 6 s, ±2°), avec une flamme qui vacille (`flicker`) ;
   - un hublot en haut à droite : lune, et houle qui défile (deux vagues SVG, 7 s et 9 s) ;
   - une dague et une pile de doublons en bas à gauche, immobiles.
5. **Informations habillées** :
   - plaques des joueurs : 2 rivets en laiton ;
   - rang du pli : sceau de cire rouge (forme irrégulière en `clip-path`), chiffre en Pirata One ;
   - pastille « Couleur demandée » : bout de parchemin (fond crème, texte encre foncée, contraste ≥ 4,5:1) ;
   - en-tête : bois, avec une corde de N nœuds pour les manches (passées en doré, manche en cours avec un anneau) ;
   - rail de la main : planches, liseré de corde en haut, embouts en laiton.

## Garde-fous
- `@media (prefers-reduced-motion: reduce)` : toutes les animations sont coupées.
- Réglage **« Ambiance sobre »** (localStorage `pli.ambiance = 'sobre'`) : ajoute la classe `.sobre` sur la table, ce qui masque les couches 1, 3 et 4 et rend le style actuel aux informations.
- Les animations ne touchent que `transform` et `opacity`, pour rester fluides. Pas d'image lourde : tout est en CSS et SVG inline.
- Le contraste des textes existants doit rester inchangé : vérifie-le.
