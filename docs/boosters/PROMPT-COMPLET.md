# Prompt Claude Code : cartes, boosters et recyclage (tout en un)

Colle ce prompt dans Claude Code à la racine du dépôt. Il enchaîne 6 tâches de `docs/PROMPT-MAITRE.md`, **dans cet ordre**, chacune avec son prompt détaillé. Fais une branche et un commit par tâche, et attends ma validation entre deux tâches si une décision n'est pas couverte par les documents.

## Avant de commencer

1. Lis `docs/PROMPT-MAITRE.md` (tâches B7, B8, B9, D14, D14b, D15) et l'état du code : composant de carte, `cards.ts`, Boutique, coffres, éclats (D13), `settleGame`, `sfx.ts`.
2. Ouvre les maquettes de `docs/maquettes/` : `CarteVar`, `CarteCouches`, `Booster`, `Collection`, `Atelier`. Elles contiennent tout le rendu et la logique d'états de référence (classe `Component` en bas de chaque fichier).
3. Propose un plan global (fichiers touchés, migrations, ordre) avant de coder.

## 1. B7 · Cartes en couches

Prompt : `docs/cartes-couches/PROMPT-claude-code.md`. Chaque carte = cadre d'origine (fenêtre transparente) au-dessus de l'illustration seule. Fichiers déjà générés dans `web/public/cards/calques/`.

## 2. B8 · Personnages sans bandeau, masques, variantes renforcées

Prompt : `docs/cartes-couches/PROMPT-B8-claude-code.md`. Masques `marge_` (toute la bordure blanche), `foil_` (fond seul), `fond_`. CSS de référence : `docs/cartes-couches/carte-variantes.css`. Le nom des personnages s'affiche au survol.

## 3. B9 · Même zoom dans toutes les variantes

L'illustration a la même taille dans toutes les variantes ; la Vivante ne zoome que de 2 à 3,5 % (déplacement ≤ 1 %). Voir `docs/cartes-couches/SPEC.md`, section « Zoom identique ». (Pas de Full Art pour l'instant.)

## 4. D14 · Boosters et variantes

Prompt : `docs/boosters/PROMPT-claude-code.md`, spécification `docs/boosters/SPEC.md`.
- Booster à **50 pièces**, 5 cartes, 3 boosters à thème (cartes vedettes ×3), 1 booster gratuit par jour joué, 1 booster par victoire.
- Chances par emplacement (échelle Pokémon TCG Pocket un peu réduite) : cartes 1 à 3 communes ; carte 4 Holo 92 / Épique 5 / Signée 2,3 / Numérotée 0,7 % ; carte 5 Holo 66 / Épique 21 / Signée 10 / Numérotée 3 %. Booster divin 1/2 000. Pas de garanties.
- Tirage côté serveur (`booster.open`), Numérotées limitées à 100 par carte et par saison.

## 5. D14b · Écran d'ouverture

`docs/boosters/OUVERTURE.md` + maquette `Booster` : carrousel, coupe au doigt, lumière neutre (aucun spoil), pile à faire glisser, seule la 5e carte face cachée (dos `web/public/cards/dos.webp`), moment Signée / Numérotée, booster divin signalé discrètement, butin et barre de collection, sons et vibrations.

## 6. D15 · Recyclage et Atelier

`docs/boosters/ATELIER.md` + maquette `Atelier` :
- doublons → éclats (5 / 20 / 60 / 200), recyclés à l'ouverture des boosters, « Tout recycler » pour les autres ;
- fabrication **au hasard** par rareté (20 / 80 / 240 / 800), jamais une variante déjà possédée ;
- fabrication **au choix** (×4 : 80 / 320 / 960 / 3 200), aussi depuis la Collection ;
- Numérotées jamais fabricables.

## À la fin

- Tests de chaque prompt détaillé au vert, plus les captures Playwright (planche des variantes à 56 px, ouverture d'un booster, Atelier).
- Coche B7, B8, B9, D14, D14b et D15 dans `docs/PROMPT-MAITRE.md`.
