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

1. Appliquer les migrations : `20261019000000_cartes_couches.sql`, `20261020000000_boosters.sql` et `20261021000000_atelier.sql` (`npx supabase db push`).
2. Redéployer la fonction Edge : `npx supabase functions deploy game`. Elle porte les nouvelles actions `booster.open`, `collection.list`, `collection.choose`, `collection.craft` et `collection.recycle`.
3. Réglages serveur, dans la table `app_settings` : `cards_layered` et `free_daily_booster`. Les deux valent `true` par défaut.

## Décisions prises (validées le 28 octobre)

- **Collection de 76 cartes** : 56 cartes de couleur et 20 spéciales, soit 532 variantes. Les cartes de l'extension 7 (−5), 8 (+5) et 0·14 affichent la variante du 7, du 8 ou du 14 de leur couleur.
- **Variante jouée à la table** : lue à l'ouverture de la table (`card_choices`), comme les cartes animées.
- **Coffres** : gardés pour la personnalisation du profil seulement. Le coffre coûte 50 pièces et les 3 coffres 135 (j'ai choisi −10 %, comme avant). Ils ne donnent plus de carte animée Mythique ; le tirage passe à Commun 62 %, Rare 26 %, Épique 9 %, Légendaire 3 %. Les SPEC sont mises à jour (`docs/boosters/SPEC.md`, `docs/casier-boutique/SPEC.md`).
- **Booster** : article principal de la Boutique, à 50 pièces. On en gagne un par victoire, plus un gratuit le premier jour où l'on termine une partie qui rapporte.

## À trancher

1. **Récompenses de collection** : la Collection affiche la progression, mais rien n'est encore attribué. Il faut choisir la règle pour le dos de carte, car deux documents se contredisent :
   - la SPEC dit : « compléter une famille en Holo » (par exemple les 14 cartes vertes) ;
   - le `README` des boosters dit : « compléter la collection du booster en Holo », ce qui donne le dos du booster.

   Pour les titres « Collectionneur de … » (les 7 variantes d'une carte), il faut créer les objets de titre.
2. **Cartes animées Mythiques (D11)** : elles ne sortent plus des coffres, donc **plus rien ne permet d'en gagner**. Celles qui sont déjà possédées restent. Faut-il en faire une variante « Animée » des boosters, les vendre, ou les attribuer comme récompense ?
3. **Illustrations des personnages** : les calques des 11 personnages viennent d'illustrations plus récentes (sans bandeau) que `web/public/cards/<personnage>.webp`. Trois endroits montrent donc encore l'ancienne version : le repli « image unique » (`cards_layered` = false), les miniatures du pouvoir de Juanita et le Casier. Il faudrait fournir les nouvelles images uniques.
4. **Visuels des boosters** (`web/public/boosters/`) :
   - `sachet_sirenes.webp` et `sachet_couronne.webp` étaient inversés : je les ai renommés d'après leur contenu ;
   - les `.png` ne correspondent pas à leur nom (`sachet_profondeurs.png` = illustration seule, `sachet_sirenes.png` = sachet Profondeurs) : le site ne les utilise pas ;
   - `sachet_profondeurs.webp` (1,6 Mo) et `sachet_sirenes.webp` (1,4 Mo) sont lourds pour le téléphone : à recompresser (moins de 200 Ko) ;
   - `art_couronne.jpg` manque (il n'est pas utilisé pour l'instant).
5. **Paiement du booster** : le tirage et le débit se font dès « Ouvrir », comme le demande `OUVERTURE.md`. Du coup, je n'ai pas mis de bouton « Changer de booster » à l'étape de la coupe, contrairement à la maquette : le booster est déjà payé. À confirmer.
6. **Écran d'ouverture sur téléphone** : la scène (680 × 900) est réduite à environ 55 % à 390 px de large, et les textes sous la carte deviennent petits. Une mise en page propre au téléphone serait plus confortable.
7. **Annonce des belles prises « dans le salon »** : faite par un toast pour **tous** les joueurs connectés (canal Realtime `annonces`), plus un fil « Belles prises » des amis sur l'Accueil. Faut-il limiter le toast aux amis ou au salon en cours ?
8. **Deuxième Numérotée de la même carte** : elle devient une Signée, selon ma lecture de « une Numérotée n'est jamais un doublon ». À confirmer.
9. **Changement de variante pendant une partie** : il ne s'affiche à la table qu'à la prochaine ouverture de la table, puisque la variante est lue à l'ouverture (décision prise).
10. **Équilibre des pièces** : il faut surveiller le booster gratuit quotidien avec le coffre à 50 (point « À trancher » de la SPEC).

## Notes techniques

- **Avertissement de Vite en développement** (« Assets in public directory cannot be imported ») : il vient de l'import de `cards/calques/calques.json`, qui reste dans `public/` pour les scripts Python. Il est sans effet sur le build.
- **Test de la zone protégée (D14)** : il tolère 0,5 % de pixels légèrement différents. Cela correspond au rééchantillonnage du cadre quand la carte est composée à part, et l'écart est identique pour toutes les variantes. Une recoloration réelle du cadre le ferait échouer.
- **Cartes animées** : elles jouent dans la fenêtre du calque, calées en CSS, sans recadrage ffmpeg (ffmpeg n'est pas installé). Le résultat est vérifié à l'œil et par test.
