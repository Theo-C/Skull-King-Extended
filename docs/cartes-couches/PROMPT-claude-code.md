# B7. Cartes en couches (cadre d'origine en calque, illustration dessous)

À faire **avant D11 (cartes animées) et D14 (boosters)**, qui s'appuient dessus.

Lis `docs/cartes-couches/SPEC.md`, regarde `docs/cartes-couches/carte-vivante.gif` et ouvre `docs/maquettes/CarteVar.dc.html` (composant de référence).

1. **État des lieux** : composant de carte actuel, `cards.ts`, chiffres et pastilles (tâches B1 à B6), cartes animées (D11). Propose un plan avant de coder.
2. **Données** :
   - charge `web/public/cards/calques/calques.json` ;
   - chaque carte du moteur pointe vers sa clé de calques : les 56 cartes de couleur utilisent le calque de leur couleur et affichent leur valeur dans le médaillon.
3. **Composant de carte** : réécris-le comme `CarteVar`, de bas en haut :
   - fenêtre (`overflow:hidden`) contenant l'illustration et les effets de variante ;
   - cadre d'origine `cadre_<clé>.webp` (`inset:0`) ;
   - valeur, pastille de pouvoir, sceaux ;
   - matières de marge.

   Positions en pourcentage, depuis `calques.json`.
4. **Règle absolue** :
   - rien d'animé ne passe au-dessus du cadre ;
   - les animations ne touchent que `.illu`, avec un zoom compris entre 1,02 et 1,035 et un déplacement d'1 % au plus (l'illustration doit garder la même taille dans toutes les variantes).
5. **Cartes animées** :
   - recadre les 6 vidéos sur le rectangle `illu` de `calques.json` (ffmpeg `crop`, même découpe que l'image), puis place-les à la place de `.illu` ;
   - remplace `<clé>-cadre.webp` par `cadre_<clé>.webp`.
6. **Tests visuels** (Playwright) :
   - toutes les cartes au repos : comparaison avec l'image d'origine, moins de 1 % de pixels différents ;
   - une carte en variante Vivante à 0 s et 4 s : les pixels hors fenêtre doivent être identiques au pixel près.
7. Garde les anciennes images en solution de repli derrière un réglage serveur `cards_layered` (activé par défaut).

Coche B7 dans `docs/PROMPT-MAITRE.md`.
