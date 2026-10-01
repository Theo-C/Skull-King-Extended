import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// base './' : chemins relatifs, pour que le même build serve sur Vercel et dans l'appli Android (Capacitor).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  resolve: { alias: { '@engine': fileURLToPath(new URL('../supabase/functions/_shared/engine.ts', import.meta.url)) } },
  build: { outDir: fileURLToPath(new URL('../dist', import.meta.url)), emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
