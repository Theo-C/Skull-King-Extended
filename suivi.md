# Suivi : cartes en couches, boosters et Atelier (28 octobre 2026)

Les 6 tâches demandées sont faites et cochées dans `docs/PROMPT-MAITRE.md` : B7, B8, B9, D14, D14b et D15. Le détail de chaque tâche est dans `docs/ETAT.md`.

## Branches (empilées, une par tâche)

Chaque branche part de la précédente : **`d15-atelier` contient tout**. Rien n'est encore fusionné dans `master`.

| Branche | Contenu |
|---|---|
| `b7-cartes-couches` | Documents et calques fournis (1er commit), puis B7 |
| `b8-variantes` | B8 |
| `b9-zoom-identique` | B9 |
| `d14-boosters` | D14 |
| `d14b-ouverture` | D14b |
| `d15-atelier` | D15 et ce fichier |

Pour tout fusionner : `git checkout master && git merge --ff-only d15-atelier`.

## Reprendre sur un autre poste

```bash
git fetch && git checkout d15-atelier
npm ci
npx playwright install chromium   # navigateur des tests visuels, environ 150 Mo
npm test                          # moteur, compte, SQL, serveur, juke-box, sons, collection
npm run test:visual               # Playwright : B7, B8, B9, D14, D14b, D15 (environ 2 min)
npm run build
```

- **Bancs d'essai** (en développement seulement, hors build), avec `npm run dev` :
  - `/banc/cartes.html` : cartes et variantes ;
  - `/banc/ecrans.html?ecran=collection|boosters|atelier&force=signee|numero|divin|epique` : écrans avec un faux serveur en mémoire.
- **Captures à valider à l'œil** : `docs/captures/`. On y trouve la planche des variantes à 56 et 40 px et en deutéranopie, l'ouverture d'un booster étape par étape, et l'Atelier, chacun sur ordinateur et sur téléphone.

## À faire pour la mise en ligne

Fait le 28 octobre : migrations jusqu'au 22 appliquées (Numérotées à 10 comprises), fonction `game` déployée, historique des migrations réparé (`migration repair` du 3 au 18, `temps_de_jeu` renommé en `20261012000100`).

**Reste à appliquer** (`npx supabase db push`) : `20261023000000_cartes_animees_retirees.sql`.

## Décisions prises (validées le 28 octobre)

- **Collection de 76 cartes** : 56 cartes de couleur et 20 spéciales, soit 532 variantes. Les cartes de l'extension 7 (−5), 8 (+5) et 0·14 affichent la variante du 7, du 8 ou du 14 de leur couleur.
- **Variante jouée à la table** : lue à l'ouverture de la table (`card_choices`), comme les cartes animées.
- **Coffres** : gardés pour la personnalisation du profil seulement. Le coffre coûte 50 pièces et les 3 coffres 135 (j'ai choisi −10 %, comme avant). Ils ne donnent plus de carte animée Mythique ; le tirage passe à Commun 62 %, Rare 26 %, Épique 9 %, Légendaire 3 %. Les SPEC sont mises à jour (`docs/boosters/SPEC.md`, `docs/casier-boutique/SPEC.md`).
- **Booster** : article principal de la Boutique, à 50 pièces. On en gagne un par victoire, plus un gratuit le premier jour où l'on termine une partie qui rapporte.

## Tranché le 28 octobre

- **Numérotées** : 10 exemplaires par carte et par saison (« N° 04 / 10 »), jamais un doublon (déjà possédée → Signée), chaque numéro à un seul joueur.
- **Cartes animées Mythiques** : mises de côté, retirées à tous les joueurs (migration du 23), rubrique du Casier masquée ; catalogue et vidéos gardés pour plus tard.
- **Images uniques (B10)** : originaux dans `web/public/cards/sources/`, 24 `cards/<clé>.webp` recomposées depuis les calques. Python n'est pas installé sur le second poste : l'assemblage y a été fait dans Chromium, à l'identique d'`aplatir_cartes.py` (test Playwright < 1 %).
- **Visuels des boosters** : nouvelles versions fournies (moins de 150 Ko, voir `web/public/boosters/CONTENU.md`), anciens `.png` retirés.
- **Paiement du booster** : débit dès « Ouvrir », pas de bouton « Changer de booster » à la coupe (confirmé).
- **Écran d'ouverture sur téléphone** : scène étroite 400 × 820 sous 560 px, affichée à ~90 %.
- **Annonce des belles prises** : toast pour tous les joueurs connectés (confirmé).

## À trancher

1. **Récompenses de collection** (reporté) : dos de carte pour une famille en Holo (SPEC) ou pour tout le booster en Holo (README) ; objets de titre « Collectionneur de … » à créer.
2. **Changement de variante pendant une partie** : visible à la prochaine ouverture de la table (décision prise).
3. **Équilibre des pièces** : surveiller le booster gratuit quotidien avec le coffre à 50.

## Notes techniques

- **Avertissement de Vite en développement** (« Assets in public directory cannot be imported ») : il vient de l'import de `cards/calques/calques.json`, qui reste dans `public/` pour les scripts Python. Il est sans effet sur le build.
- **Test de la zone protégée (D14)** : il tolère 0,5 % de pixels légèrement différents. Cela correspond au rééchantillonnage du cadre quand la carte est composée à part, et l'écart est identique pour toutes les variantes. Une recoloration réelle du cadre le ferait échouer.
- **Cartes animées** : elles jouent dans la fenêtre du calque, calées en CSS, sans recadrage ffmpeg (ffmpeg n'est pas installé). Le résultat est vérifié à l'œil et par test.
