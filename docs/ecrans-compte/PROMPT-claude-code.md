# Prompt 1 : cartes de la main proportionnelles au bloc (à faire en premier, c'est court)

Dans la table de jeu, les cartes de « Votre main » sont trop petites par rapport au bloc qui les contient. Il reste beaucoup de marge en haut, en bas et sur les côtés. Ne touche PAS à la taille du bloc `.rail` : ce sont les cartes qui doivent s'adapter au bloc.

1. Calcule l'échelle des cartes à partir de la place réellement disponible dans `#hand`. Utilise un `ResizeObserver` sur le conteneur, plus un recalcul à chaque rendu de la main, car le nombre de cartes change.
   - `H` = hauteur intérieure disponible : hauteur du `.rail` − hauteur de `.handhead` − marges verticales (environ 8 px en haut et en bas).
   - `W` = largeur intérieure disponible de `#hand`.
   - `n` = nombre de cartes.
   - Taille de la carte : `cardH = H`, `cardW = cardH / 1.4`, et `--s = cardW / 252` (252 × 352 est la taille de base d'une carte).
   - Écart entre deux cartes : `step = min(cardW × 0.96, (W − cardW) / (n − 1))`. Avec peu de cartes, elles s'étalent presque sans se chevaucher. Avec beaucoup de cartes, elles se chevauchent.
   - Si même avec un chevauchement maximal (`step < cardW × 0.38`) elles ne tiennent pas, réduis `cardH` jusqu'à ce que `step = cardW × 0.38` passe.
   - Applique `margin-left: step − cardW` (négatif) à partir de la 2e carte, au lieu du `-.2` codé en dur.
2. Pour gagner de la hauteur, place le titre « Votre main » et les pastilles Pari / Plis en surimpression dans les coins du bloc (position absolue). Ils ne doivent plus occuper une ligne au-dessus des cartes, et les cartes peuvent passer sous ces coins.
3. Éventail plus plat : rotation `(i − (n−1)/2) × 1°`, décalage vertical `d² × 1 px`. Au survol, la carte jouable monte de 12 % de sa hauteur et peut dépasser du bloc vers le haut (`overflow: visible`).
4. Le zoom au survol long garde sa taille (300 px de large). Le bouton de la carte doit faire au moins 44 px de large, même avec un fort chevauchement.
5. Sur mobile (moins de 720 px), applique la même règle, sans limite minimale de hauteur.
6. Contrôle en lançant la partie d'entraînement : avec 1, 4, 7 et 10 cartes, à 1366 × 768, 1920 × 1080 et 390 × 844, les cartes doivent remplir le bloc en hauteur sans être coupées.

Repère visuel : `docs/maquettes/Main.dc.html`. Le bloc mesure 204 px de haut, les cartes 140 × 196 px, et l'écart est calculé de la même façon (voir la fonction `renderVals`, variable `step`).

---

# Prompt 2 : écrans du compte (accueil, profil, historique, détail, classement, salon, fin de partie)

Lis d'abord `docs/ecrans-compte/SPEC.md`, puis les maquettes dans `docs/maquettes/`. Ouvre chaque `.dc.html` comme du HTML ; les données d'exemple et la logique sont dans le `<script type="text/x-dc">` en bas de chaque fichier. Reproduis la mise en page, les textes et les couleurs dans notre site Vite + TypeScript sans framework (`web/src/pages/*`, routage par hash), en réutilisant les classes et variables CSS existantes quand c'est possible. Ne reprends pas le format `.dc.html` (`sc-for`, `dc-import`) : c'est un format de maquette.

## Base de données

Crée une nouvelle migration `supabase/migrations/20261003000000_profiles_xp.sql`. Garde le style RLS existant.

- `profiles` : ajoute les colonnes
  - `avatar_kind text check in ('initial','art','photo') default 'initial'`
  - `avatar_art smallint` (0–7)
  - `avatar_url text`
  - `color text default '#d9b25a'`
  - `xp int default 0`
  - `public_rank bool default true`
  - `notify_turn bool default true`
  - `sounds bool default true`
- Bucket Storage `avatars` en lecture publique. Écriture limitée au dossier `auth.uid()/` (politique sur `storage.objects`). Fichier : `avatars/{uid}/avatar.webp`, avec un paramètre `?v=timestamp` dans l'URL pour casser le cache.
- `xp_events (id, user_id, game_id, reason text, amount int, created_at)` avec `unique (game_id, user_id, reason)`. RLS : lecture pour soi uniquement.
- `achievements (code pk, name, description)` en données de départ (la liste est dans SPEC.md) + `user_achievements (user_id, code, game_id, unlocked_at, pk (user_id, code))`. Lecture publique.
- `player_stats (user_id pk, games, wins, bids_made, bids_total, best_score, sirens_captured, zero_bids_made, elo numeric(7,2) default 100 check (elo >= 0), elo_best numeric(7,2) default 100, ranked_games int default 0)`, mise à jour en fin de partie.
- `game_results (game_id, user_id, place, score, bids_made, rounds, players, elo_before numeric(7,2), elo_after numeric(7,2), elo_delta numeric(6,2), finished_at, pk (game_id, user_id))` : c'est la source de l'historique et du classement. Garde aussi le détail manche par manche dans `games.public` (champ `hist`, déjà présent) pour l'écran de détail.
- Vue ou RPC `leaderboard_period(scope text, period text)` : trié par `player_stats.elo` décroissant. Renvoie le rang, le profil, l'Élo arrondi, le nombre de parties, de victoires, le pourcentage de mises tenues, le meilleur score, et la variation d'Élo sur la période (somme des `elo_delta` de `game_results` ; pour `ever`, renvoie `elo_best` à la place). `scope = 'friends'` = joueurs ayant partagé au moins une partie avec `auth.uid()`. `period` vaut `week`, `month` ou `ever`. Applique la règle des 5 parties minimum pour `all`, et exclut les profils dont `public_rank = false` du scope `all`.

## Serveur (Edge Function `game`)

- Quand une partie passe à `finished` (dans `service.ts`, pour rester testable), appelle une fonction pure `settleGame(state)`. Elle renvoie, pour chaque joueur humain :
  - la place, le score, le nombre de mises tenues, l'Élo avant / après / variation, et le détail par adversaire (pour FinPartie) ;
  - les lignes d'XP (`game` +50, `bids` +10 × tenues, `win` +100, `ach:<code>` +25) ;
  - les hauts faits débloqués.
  
  Les bots ne reçoivent rien. Écris le tout dans les tables de façon idempotente (`on conflict do nothing`), puis incrémente `profiles.xp`.
- Ajoute à l'état public l'événement `game_settled { perUser: { xp: [...], achievements: [...], levelBefore, levelAfter } }` pour l'écran FinPartie.
- Nouvelles actions :
  - `profile.update` : pseudo de 2 à 20 caractères, couleur prise dans la palette, `avatar_kind` / `avatar_art`, préférences ;
  - `history.list` (curseur) ;
  - `history.get` (gameId) : refuse si l'utilisateur n'a pas joué la partie ;
  - `rematch` (gameId) : crée un salon avec les mêmes réglages et invite les mêmes joueurs ; les bots sont repris.
- Ajoute des tests dans `tests/service.test.ts` :
  - XP et hauts faits après la partie à 4 comptes déjà testée ;
  - idempotence : appeler `settle` deux fois ne double pas l'XP ;
  - `kraken_bet` et `perfect` sur un état construit à la main.

- **Élo** : implémente `eloDeltas(players: {id, elo, games, place}[])` dans `_shared/elo.ts`, comme une fonction pure qui suit exactement la section « Élo et classement » de SPEC.md (paires, diviseur 100, K = 40 puis 20, plancher 0, bots exclus, abandon = dernière place). Appelle-la dans `settleGame` en lisant les Élo avant la partie, tous en même temps, dans la même transaction que l'écriture des résultats. Ajoute des tests :
  - 4 joueurs à 100 → +10 / +3,3 / −3,3 / −10 (K = 20) ;
  - la somme des Δ vaut 0 hors plancher ;
  - le plancher à 0 est respecté ;
  - l'exemple 133 / 122 / 172 / 99 → +9,7 / +4,6 / −8,8 / −5,6 ;
  - une partie avec un seul humain ne compte pas ;
  - l'idempotence (pas de double application si `settle` est rappelé).

## Site

- `web/src/avatar.ts` : `avatarHTML({kind, art, url, letter, color}, size, ring?)`. Recopie les tracés SVG de `docs/maquettes/Avatar.dc.html`. Utilise-le partout : en-tête, table de jeu (remplace les initiales des pods), listes, classement.
- `web/src/xp.ts` : `levelFor(xp)` → `{ level, title, inLevel, need }`. La formule est dans SPEC.md. Ajoute un test unitaire.
- **Profil**, éditeur d'image avec trois onglets :
  - Pirate illustré : grille de 8 avatars + couleur ;
  - Ma photo : `<input type=file accept=image/*>` ou glisser-déposer, recadrage carré avec curseur de zoom sur `<canvas>`, export WebP 256 px, envoi dans Storage ;
  - Initiale : couleur seule.
  
  L'aperçu est en direct, y compris l'aperçu « à la table ». Annuler / Enregistrer. Prévois les états de chargement et d'erreur (fichier trop lourd, format refusé).
- **Historique** : pagination par curseur (20 par page), filtres en paramètres du hash.
- **DetailPartie** : courbe SVG à l'échelle, calculée depuis `hist` (pas de bibliothèque de graphiques). Une ligne par joueur, celle du joueur courant plus épaisse, légende cliquable pour masquer une ligne, ligne du zéro mise en valeur. Tableau « mise / plis · points » avec les bonus inclus.
- **Classement** : `<table>` accessible, la ligne du joueur courant surlignée et ajoutée en bas s'il est hors du top 50.
- **Salon** : bouton Copier (`navigator.clipboard`, avec repli), Partager via `navigator.share`, et QR code généré localement avec un petit module, sans service externe.
- **FinPartie** : remplace l'écran de fin actuel par la superposition de la maquette. Ordre des animations : podium, lignes d'XP, barre qui se remplit, médaille du haut fait. En cas de montée de niveau, ajoute « Niveau 13 · Second ! » en or sous la barre. Boutons Retour au port / Détail / Revanche.
- **Navigation** : en-tête `AppBar` sur ordinateur ; sur téléphone (moins de 720 px), barre d'onglets en bas (Accueil, Classement, Historique, Profil), comme dans `AccueilMobile`. La table de jeu garde son propre en-tête.
- Pense à l'appli Capacitor : pas de `hover` obligatoire, cibles tactiles d'au moins 44 px, et `env(safe-area-inset-bottom)` pour la barre d'onglets.

## Vérifications

1. `npm test` passe en entier.
2. `npm run build` passe.
3. Dans le navigateur avec 2 comptes, en local :
   1. finir une partie ;
   2. vérifier l'XP, l'Élo (fin de partie, profil, historique), le détail et le classement ;
   3. changer d'avatar (illustré puis photo) et vérifier qu'il apparaît à la table chez l'autre joueur.
4. Fais un commit par étape : migration, serveur, puis une page à la fois.

---

# Prompt 3 : avatar composé et garde-robe

Lis la section « Avatar composé et garde-robe » de `docs/ecrans-compte/SPEC.md`, puis `docs/maquettes/Avatar.dc.html`, `docs/maquettes/Profil.dc.html` (section Garde-robe) et `docs/maquettes/FinPartie.dc.html` (coffre).

1. Remplace `web/src/avatar.ts` par un rendu SVG en couches qui reprend exactement les tracés de la maquette, avec la signature `avatarSVG(look, color, size)`. Garde le mode « initiale » pour les comptes qui n'ont encore rien choisi.
2. Migration :
   - colonne `profiles.look jsonb` ;
   - tables `cosmetics` (catalogue en données de départ, depuis la constante `CAT` de la maquette), `user_cosmetics` et `user_wallet` ;
   - règles RLS : lecture publique du catalogue et des looks, écriture uniquement par l'Edge Function.
3. Serveur :
   - à la fin d'une partie (dans `settleGame`), ajoute : 1 coffre au gagnant humain, les pièces, l'objet du titre et ceux des hauts faits ;
   - nouvelles actions : `chest.open` (tirage 62/26/9/3, conversion d'un doublon en pièces), `shop.list` (3 objets par jour, choisis de façon déterministe à partir de la date) et `shop.buy` ;
   - `profile.update` refuse un `look` qui contient un objet non possédé.
4. Pages :
   - Profil : garde-robe interactive (onglets, objets verrouillés en silhouette avec leur condition, variantes de couleur, Au hasard / Annuler / Enregistrer) ;
   - FinPartie : coffre cliquable avec l'animation d'ouverture ;
   - avatars partout (table, listes, classement) à partir de `look`.
5. Ajoute des tests :
   - le tirage d'un coffre suit les probabilités (graine fixe) ;
   - un doublon est converti en pièces ;
   - un `look` invalide est refusé ;
   - les récompenses ne sont pas distribuées deux fois si `settle` est rappelé.
