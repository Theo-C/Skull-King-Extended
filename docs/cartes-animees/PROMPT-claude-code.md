Lis `docs/cartes-animees/SPEC.md` et la maquette `docs/maquettes/CartesAnimees.dc.html`. Les vidéos sont déjà prêtes dans `web/public/cards/anim/` : ne les régénère pas.

Prérequis : la garde-robe et le coffre (lot D) sont faits. Sinon, commence par là.

1. **Données.**
   - Ajoute la rareté `mythique` : contrainte SQL, `objects.ts`, couleurs.
   - Ajoute le slot `carte`, avec en données de départ 6 cosmétiques : `carte:kraken`, `carte:sk`, `carte:raie`, `carte:baleine`, `carte:sirene`, `carte:fosse`.
   - Dans `chest.open` : Mythique 1 %, Commun 61 %, doublon converti en 400 pièces, et une Mythique tirée devient une Légendaire quand le joueur possède déjà les 6.
2. **`web/src/animatedCards.ts`.**
   - Une table qui associe chaque clé de carte du moteur (`kraken`, `sk`, `stingray`, `whale`, `mermaid` avec `v: 0`, `davy`) au nom de sa vidéo.
   - `attachAnim(cardEl, key)` ajoute par-dessus l'image de la carte la vidéo (poster, webm puis mp4, `muted loop playsinline preload="none"`, masquée par l'image de la carte), puis le cadre seul `<clé>-cadre.webp` au-dessus de la vidéo (voir « Affichage : trois couches » dans la SPEC). Ensuite, elle lance la vidéo en JavaScript (`video.muted = true; video.play()`), car l'attribut `muted` seul ne suffit pas dans certains frameworks.
   - `detachAnim(cardEl)` met la vidéo en pause, puis retire la vidéo et le cadre.
3. **Qui voit quoi.** L'état de partie envoie, pour chaque joueur, ses cartes animées actives (`look.cartes`). Une carte est animée seulement si celui qui la pose possède le cosmétique et l'a activé.
4. **Comportement.**
   - En main : la vidéo démarre au survol et s'arrête à la sortie.
   - Dans le pli : classe `go` pendant 1,2 s (halo et léger grossissement), puis la vidéo tourne jusqu'au ramassage du pli. Une seule vidéo à la fois : `detachAnim` sur la précédente.
   - Zoom : la vidéo en grand.
   - Journal, miniatures et fin de manche : toujours l'image fixe.
5. **Réglages.** Ajoute « Cartes animées : toutes / les miennes / aucune ». Respecte `prefers-reduced-motion` et `saveData`.
6. **Coffre.** Pour une Mythique, la lueur passe par l'or puis devient irisée (voir SPEC).
7. **Garde-robe.** Ajoute l'onglet Cartes : les 6 cartes, en silhouette quand elles sont verrouillées, avec la vidéo en aperçu au survol.
8. **Contrôle.**
   - Vérifie Chrome, Firefox et Safari iOS (le mp4 sert de repli).
   - Joue une partie avec 2 comptes et pose une carte animée.
   - Lance `npm test` et `npm run build`, coche D11 dans `docs/ETAT.md`, puis fais un commit.
