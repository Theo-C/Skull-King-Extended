# Écrans du compte : spécification

Maquettes de référence dans `maquettes/`. Ces fichiers `.dc.html` viennent de l'outil de design : on les lit pour la mise en page, les textes, les couleurs et les données d'exemple, mais on ne les copie pas tels quels. La logique d'affichage se trouve dans le `<script type="text/x-dc">` en bas de chaque fichier.

## Repères visuels (communs à toutes les pages)

- **Couleurs**
  - fond `#120e0b`, avec un dégradé radial `#2a1f17` en haut à gauche ;
  - panneaux `linear-gradient(180deg,#2a2019,#1f1813)`, bordure `rgba(234,208,138,.18)`, rayon 14 px ;
  - or `#c9a14a` et `#ead08a` ;
  - parchemin `#f6ecd4` → `#eadbb7`, utilisé pour les bandeaux importants ;
  - encre `#2b2117`, texte atténué `#a8987f` ;
  - réussite `#9bd69f`, échec `#f0a08b`.
- **Polices** : IM Fell English SC pour les titres, Alegreya Sans pour le texte, Pirata One pour les gros chiffres (scores, rangs, XP).
- **Boutons** : principal en or (`.gold`, 46 à 50 px de haut) ; secondaire contour or (`.ghost`).
- **Mise en page fluide** : `main` à `max-width:1200px`, grilles en `repeat(auto-fit, minmax(min(100%, 340px), 1fr))`. Sur téléphone (moins de 720 px), la barre du haut est remplacée par une barre d'onglets en bas (voir `AccueilMobile`).
- **Médaillons du podium** : or, argent, bronze (dégradés dans `DetailPartie`).
- **Animations** : courtes (0,3 à 0,6 s) et désactivées par `prefers-reduced-motion`.

## Pages et routes

| Route | Maquette | Contenu |
|---|---|---|
| `#/` | Accueil, AccueilMobile | Héros (avatar, niveau, barre d'XP, créer / code / entraînement), bandeau « À vous de jouer » si c'est votre tour quelque part, parties en cours, terminées récemment, mini classement entre amis, derniers hauts faits |
| `#/salon/:code` | Salon | Code en grand, lien d'invitation, bouton Copier (devient « Lien copié ✓ » pendant 1,8 s), Partager (`navigator.share`), QR code ; places (hôte, prêt, bot, place libre + « Ajouter un bot ») ; réglages ; « Lever l'ancre » réservé à l'hôte, 2 joueurs minimum |
| `#/profil` | Profil | Identité + XP, éditeur d'image de profil, 6 tuiles de stats, liste des titres, hauts faits, réglages du compte |
| `#/historique` | Historique | Résumé de la période, filtres (Toutes, Victoires, Avec extension, Règles de base), liste regroupée par mois, pagination « plus anciennes » |
| `#/partie/:id` | DetailPartie | Podium, courbe des scores cumulés, XP gagnée, temps forts, tableau manche par manche, « Revanche » |
| `#/classement` | Classement | Entre amis / Tous, Semaine / Mois / Toujours, podium, tableau, votre ligne surlignée (et ajoutée en bas si vous êtes hors du top) |
| superposition en fin de partie | FinPartie | Remplace l'écran de fin actuel : podium animé, détail XP, barre qui se remplit, haut fait débloqué |

`AppBar` est l'en-tête commun : logo, navigation et pastille de profil (avatar, « Pseudo · Niv. N », mini barre d'XP).

## Avatar

Le composant `Avatar(v, letter, color, size, ring)` sert partout : à la table, dans les listes et dans le classement.

- `v = -1` : initiale sur fond de couleur (valeur par défaut d'un nouveau compte).
- `v = 0..7` : silhouettes de pirate en SVG. Les tracés sont dans `maquettes/Avatar.dc.html` : tricorne, bandana, chapeau à plume, bicorne, bandana + bandeau, couronne, cheveux longs + tricorne, tricorne + perroquet.
- **Photo** : téléversée dans Supabase Storage. Côté client, on la recadre en carré, on la réduit à 256 × 256 et on la convertit en WebP. Taille maximale : 5 Mo.
- **Couleur du médaillon** : elle sert aussi de couleur du joueur à la table. Palette fixe de 8 couleurs : `#d9b25a #c8644b #7ab874 #5c9db6 #a982c4 #e0954a #c9c0ae #d77fa1`.

## XP et niveaux

- **Gains, uniquement pour les parties en ligne terminées** (l'entraînement ne compte pas) :
  - +50 pour une partie terminée ;
  - +10 par mise tenue ;
  - +100 pour une victoire ;
  - +25 par haut fait débloqué.
- **Niveaux** : passer du niveau L au niveau L+1 coûte 250 × L XP, soit 125 × L × (L − 1) XP au total pour atteindre le niveau L. La barre affiche l'XP gagnée à l'intérieur du niveau, par exemple « 2 340 / 3 000 ».
- **Titres par niveau** : 1 Mousse, 3 Matelot, 5 Gabier, 8 Quartier-maître, 11 Bosco, 13 Second, 16 Capitaine, 20 Corsaire, 25 Amiral, 30 Légende des 7 mers.
- **Calcul côté serveur uniquement**, dans l'Edge Function, quand la partie passe à `finished`. Il doit être idempotent, avec une contrainte unique sur `xp_events (game_id, user_id, reason)`.

## Hauts faits (première série)

| Code | Nom | Condition |
|---|---|---|
| first_game | Premier abordage | terminer une partie |
| perfect | Sans fausse note | tenir toutes ses mises sur une partie |
| kraken_bet | Pari du Kraken | mise de 0 tenue à la manche 10 |
| siren_hunter | Chasseur de sirènes | 10 sirènes capturées au total (Barbe-Cendre ou pirate) |
| grand_quinze | Grand Quinze | remporter un pli avec le Grand Quinze |
| silk_thread | Fil-de-Soie | la carte imposée par Lise remporte le pli |
| captain | Capitaine des mers | 10 victoires |
| abyss | Fosse insondable | remporter un pli avec la Fosse des Noyés |
| mermaid_king | La Sirène et le Roi | capturer Barbe-Cendre avec une sirène |
| velvet | Main de velours | 5 mises à 0 tenues au total |

On les détecte à partir de `hist` et des `game_events` en fin de partie. Les compteurs cumulés (sirènes, victoires, mises à 0) sont tenus dans `player_stats`.

## Élo et classement

L'Élo mesure le niveau (il monte et descend) ; l'XP mesure l'assiduité (elle ne fait que monter). Les deux sont affichés séparément.

- **Départ et plancher** : tout compte commence à **100**. L'Élo ne descend jamais sous **0** (`max(0, …)`).
- **Formule multijoueur par paires**. Pour une partie à n joueurs humains, on compare le joueur i à chaque adversaire j :
  - `S = 1` si i finit devant j, `0,5` en cas d'égalité de score, `0` sinon ;
  - `E = 1 / (1 + 10^((Rj − Ri) / 100))` (diviseur 100, adapté à une échelle qui part de 100) ;
  - `Δi = K / (n − 1) × Σj (S − E)`.
- **K** : 40 pendant les 10 premières parties classées (pour trouver vite son niveau), 20 ensuite.
- **Calcul** : on part des Élo *avant* la partie pour tout le monde, puis on applique les Δ en même temps. On stocke la valeur décimale (`numeric(7,2)`) et on l'affiche arrondie.
- **Ordres de grandeur avec K = 20**, 4 joueurs à 100 :
  - le 1er gagne +10, le 2e +3, le 3e −3, le 4e −10 ;
  - un joueur à 60 qui bat un joueur à 200 en duel gagne +19 ;
  - à l'inverse, le joueur à 200 qui bat celui à 60 ne gagne que +1.
- **Ce qui compte** : les parties en ligne terminées, entre au moins 2 humains. Les bots sont ignorés (on les retire des paires) ; une partie avec un seul humain ne compte pas. L'entraînement ne compte jamais. Quitter une partie en cours = dernière place pour l'Élo.
- **Exemple de la maquette** (Table de Maëlle) :

| Joueur | Élo avant | Place | Variation | Élo après |
|---|---|---|---|---|
| Théo | 133 | 1 | +9,7 | 143 |
| Corentin | 122 | 2 | +4,6 | 127 |
| Maëlle | 172 | 3 | −8,8 | 163 |
| Ysolde | 99 | 4 | −5,6 | 93 |

  Détail pour Théo, affiché dans FinPartie : devant Maëlle +4,7, devant Corentin +2,9, devant Ysolde +2,1.

**Classement** : trié par Élo actuel. « Entre amis » = toutes les personnes avec qui l'on a déjà joué au moins une partie ; « Tous » = au moins 5 parties classées et `public_rank = true`. Le filtre Semaine / Mois / Toujours ne change pas le tri : il change la dernière colonne (variation d'Élo sur 7 jours, sur 30 jours, ou record).

**Où l'Élo apparaît** :
- Profil : pastille dans l'en-tête, tuile, panneau avec la courbe des 15 dernières parties ;
- Accueil : mini classement entre amis ;
- Historique : pastille ± par partie ;
- DetailPartie : Élo après et variation sous le podium ;
- FinPartie : avant → après et détail par adversaire ;
- Classement.
