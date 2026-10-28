// Tests visuels (Playwright) : banc d'essai web/banc/ servi par Vite. Lancer : npm run test:visual
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/visual',
  outputDir: 'tests/visual/.resultats',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5199', viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 },
  webServer: { command: 'npx vite web --port 5199 --strictPort', url: 'http://localhost:5199/banc/cartes.html', reuseExistingServer: true, timeout: 60_000 },
});
