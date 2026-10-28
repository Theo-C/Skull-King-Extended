# B8. Personnages sans bandeau, masques d'effets, variantes renforcées

À faire **après B7** et **avant D14**. Lis `docs/cartes-couches/SPEC.md` (sections « Personnages sans bandeau », « Masques d'effets », « Variantes : rendu »), regarde `carte-vivante.gif` et ouvre `docs/maquettes/CarteVar.dc.html`.

1. **Calques** : les fichiers de `web/public/cards/calques/` sont déjà générés (cadres et illustrations sans bandeau, `marge_*`, `foil_*`, `fond_*`, `calques.json`). Pour une nouvelle carte : `decoupe_calques.py`, puis `sans_bandeau.py`, puis `masques_effets.py`, depuis la racine du dépôt.
2. **Composant de carte** :
   - ajoute les variables CSS `--mk`, `--fo`, `--fd` (URL des 3 masques de la carte) ;
   - reprends les règles de `docs/cartes-couches/carte-variantes.css` (classes `.ring`, `.foil`, `.engr`, `.crest`, `.glit`, `.mv.bg`, `.mv.fgm`, `.rip`, `.rays`, `.light`, `.motes`, `.sig`) ;
   - ajoute une seule fois dans la page le filtre SVG `#k4rip` (voir la maquette) ;
   - drapeau `mer` par carte dans `cards.ts` (Skull King, sirènes, Kraken, Baleine, Fuite, Davy Jones, Raie, Bordée) pour l'ondulation.
3. **Noms** : les personnages n'ont plus leur nom peint. Affiche le nom (B6) au survol long, dans le zoom, dans l'infobulle de la carte posée et pour les lecteurs d'écran (`aria-label`).
4. **Performances** : au-delà de 8 cartes animées à l'écran (main + pli), ne garde que la carte survolée et les cartes du pli en mouvement ; les autres passent en `still`. Les masques sont petits (≈ 15 à 150 Ko) : précharge ceux des cartes en main.
5. **Tests visuels** (Playwright) :
   - Patinée / Étain / Nacre : aucun pixel blanc de la marge d'origine ne reste blanc (comparaison avec `marge_<clé>.png`) ;
   - Holo : les pixels du personnage (masque inverse de `foil_`) diffèrent de moins de 2 % de la variante Standard ;
   - Vivante à 0 s et 4 s : les pixels hors fenêtre sont identiques ;
   - planche « 8 variantes × chaque famille » à 56 px, à valider à l'œil.

Coche B8 dans `docs/PROMPT-MAITRE.md`.
