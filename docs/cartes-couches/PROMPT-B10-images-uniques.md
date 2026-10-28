# B10. Images uniques des cartes à jour (nouvelles illustrations)

Les cartes en couches (illustration + cadre) sont le rendu par défaut. Mais 3 endroits affichent encore l'image unique `web/public/cards/<clé>.webp`, qui contient l'**ancienne** illustration (avec bandeau) : la miniature du personnage dans le Casier, les petites cartes du pouvoir de Juanita, et tout le jeu quand `cards_layered` est coupé. Il faut que l'image unique montre exactement la même carte que la version en couches.

**Solution : on ne dessine rien, on assemble.** Le script `docs/cartes-couches/aplatir_cartes.py` recompose chaque carte en 720 × 1024 : l'illustration (`illu_<clé>.jpg`, à sa place `illu` de `calques.json`), puis le cadre (`cadre_<clé>.webp`) par-dessus. Le résultat est identique au pixel près à la carte en couches au repos.

1. **Garder les originaux comme sources**, avant tout le reste :
   - `git mv web/public/cards/<clé>.webp web/public/cards/sources/<clé>.webp` pour les 24 cartes (pas `calques/`, pas `anim/`) ;
   - les scripts `decoupe_calques.py` et `sans_bandeau.py` lisent désormais `web/public/cards/sources/` (déjà modifié dans `docs/cartes-couches/`). Ne jamais régénérer les calques à partir des images aplaties.
2. **Générer les images uniques** : `python3 docs/cartes-couches/aplatir_cartes.py` (racine du dépôt). Il écrit les 24 `web/public/cards/<clé>.webp` (RGBA, qualité 90, environ 70 à 110 Ko). Les 11 personnages changent visiblement ; les autres cartes sont identiques à avant, régénérées pour rester cohérentes.
3. **Vérifier les 3 usages** : miniature du Casier, pouvoir de Juanita, et jeu entier avec `cards_layered = off`. Aucun code à changer si les chemins restent `cards/<clé>.webp` ; sinon, aligne-les.
4. **Chaîne complète pour une nouvelle carte** (à écrire dans `docs/cartes-couches/SPEC.md`, section « Découpe ») : image d'origine dans `sources/` → `decoupe_calques.py` → `sans_bandeau.py` (personnages) → `masques_effets.py` → `aplatir_cartes.py`.
5. **Test** (Playwright) : pour 3 cartes (`rosie`, `g7`, `kraken`), capture de la carte en couches au repos et de l'image unique à la même taille : moins de 1 % de pixels différents.

Coche B10 dans `docs/PROMPT-MAITRE.md`.
