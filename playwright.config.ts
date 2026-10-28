// Tests visuels (Playwright) : banc d'essai web/banc/ servi par Vite. Lancer : npm run test:visual
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/visual',
  outputDir: 'tests/visual/.resultats',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5199', viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 },
  // la mesure de fluidité (d14b-performance) passe seule, après les autres : en parallèle, ils lui prendraient le processeur
  projects: [
    { name: 'visuel', testIgnore: /performance/ },
    { name: 'performance', testMatch: /performance/, dependencies: ['visuel'] },
  ],
  webServer: [
    { command: 'npx vite web --port 5199 --strictPort', url: 'http://localhost:5199/banc/cartes.html', reuseExistingServer: true, timeout: 60_000 },
    // démo autonome du composant <booster-opening> (docs/boosters/demo/), servie depuis la racine du dépôt
    { command: 'node tests/visual/serveur-statique.mjs 5200', url: 'http://localhost:5200/docs/boosters/demo/booster-demo.html', reuseExistingServer: true, timeout: 60_000 },
  ],
});
