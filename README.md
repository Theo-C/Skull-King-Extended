# Skull King Extended — site multijoueur

Jeu de plis et de paris aux règles de Skull King (base + extension), avec le design de cartes « Mers Sauvages ».
Comptes par lien magique, parties en direct entre amis via un lien d'invitation, classement, entraînement hors ligne contre des bots.
Pensé pour devenir une appli Android (Capacitor) sans réécriture.

## Architecture

```
web/                      Site (Vite + TypeScript, sans framework) — routage par ancre #/…
  src/table.ts            Table de jeu (plateau, main, animations), partagée en ligne / hors ligne
  src/pages/              Connexion, accueil, invitation, salon + partie, classement, entraînement
  src/cardsdata.ts        Faces des cartes « Mers Sauvages » (issues de ton fichier de design)
supabase/
  migrations/             Schéma SQL, sécurité (RLS), classement, écriture atomique des coups
  functions/_shared/      engine.ts : moteur de règles + bots · service.ts : logique serveur
  functions/game/         Edge Function « game » : arbitre de toutes les actions
tests/                    Moteur, schéma SQL, parcours complet à 4 comptes
```

**Qui voit quoi.** Le serveur détient l'état complet (mains, pioche) dans `game_secrets`, illisible par les joueurs.
Chaque joueur ne lit que : l'état public de la table (`games.state`), sa propre main (`hands`, filtrée par RLS) et les
événements de sa partie (`game_events`, rejoués par le site pour animer chaque carte). Toute action passe par
l'Edge Function, qui vérifie le tour, la carte et les règles, fait jouer les bots puis enregistre le tout en une transaction
(`game_commit`, avec verrou de version : deux coups simultanés ne peuvent pas se télescoper).

**Temps réel.** Le site s'abonne aux changements de sa partie (Supabase Realtime) ; chaque signal déclenche une relecture
des nouveaux événements, de l'état et de la main. Une relecture toutes les 15 s et au retour sur l'onglet sert de filet.

## Mise en route

### 1. Projet Supabase

1. Créer un nouveau projet sur supabase.com (région Europe).
2. Installer le CLI : `npm i -g supabase`, puis à la racine :
   ```bash
   supabase login
   supabase link --project-ref <ref-du-projet>
   supabase db push                 # applique les migrations
   supabase functions deploy game   # déploie l'arbitre
   ```
3. **Authentication → URL Configuration** :
   - *Site URL* : l'adresse du site (ex. `https://skull-king-extended.vercel.app`)
   - *Redirect URLs* : la même adresse avec `/`, `http://localhost:5173/` pour le développement,
     et `fr.plidespirates.app://connexion` pour l'appli Android.
4. **Authentication → Providers → Email** : laisser l'e-mail activé (lien magique).
   Pour la production, brancher un SMTP (Resend, Brevo…) : l'envoi intégré de Supabase est limité à quelques e-mails par heure.
5. Optionnel : personnaliser le modèle d'e-mail « Magic Link » en français (Authentication → Emails).

### 2. Site en local

```bash
cp .env.example .env     # renseigner l'URL et la clé « anon » (Paramètres → API)
npm install
npm run dev              # http://localhost:5173
```

### 3. Mise en ligne (Vercel)

Importer le dépôt sur vercel.com : `vercel.json` règle déjà la commande de build et le dossier `dist`.
Ajouter les variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SITE_URL` dans les paramètres du projet Vercel.

### 4. Appli Android (plus tard)

Le build est en chemins relatifs et le routage par ancre, il fonctionne tel quel dans Capacitor :

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/app
npm run build
npx cap add android
npx cap sync
npx cap open android     # ouvre Android Studio pour générer l'APK / l'AAB
```

- `SITE_URL` doit pointer vers le site public : c'est lui qui apparaît dans les liens d'invitation.
- Dans `android/app/src/main/AndroidManifest.xml`, ajouter un `intent-filter` pour le schéma `fr.plidespirates.app`
  (retour du lien magique) et, pour ouvrir les invitations directement dans l'appli, un App Link sur le domaine du site.
  Le code qui récupère la session et l'invitation est déjà en place (`web/src/api.ts`).
- L'identifiant `fr.plidespirates.app` se change dans `capacitor.config.json` et dans `APP_SCHEME`.

## Tests

```bash
npm test                 # moteur + parcours serveur
npx tsx tests/sql.test.ts
```

- `engine.test.ts` : 29 cas de règles (Kraken, Baleine, Raie, Fosse, Planche, Second, Grand Quinze, 0/14…)
  et 60 parties complètes de 3 à 9 joueurs, l'état repassant par du JSON à chaque coup.
- `sql.test.ts` : migration appliquée sur un Postgres embarqué, contrôles RLS (main privée, secrets, écriture interdite).
- `service.test.ts` : 4 comptes créent, invitent, rejoignent et jouent une partie entière en ne lisant que ce que la RLS leur montre ;
  refus des coups hors tour et des cartes interdites, classement alimenté, conflit d'écriture détecté.

## Pistes suivantes

- Minuteur de tour et remplacement par un bot si un joueur s'absente.
- Notifications (e-mail ou push dans l'appli) quand c'est votre tour.
- Revanche en un clic avec la même table ; parties publiques.
- Nettoyage automatique des salons abandonnés (tâche planifiée Supabase).
