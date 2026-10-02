import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

const envDir = fileURLToPath(new URL('..', import.meta.url));

// Variables publiques injectées dans le build, sans préfixe VITE_ (liste explicite : rien d'autre n'est exposé au navigateur).
const PUBLIC_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SITE_URL', 'APP_SCHEME'];

// base './' : chemins relatifs, pour que le même build serve sur Vercel et dans l'appli Android (Capacitor).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    envDir,
    define: Object.fromEntries(PUBLIC_ENV.map((k) => [`import.meta.env.${k}`, JSON.stringify(env[k] || '')])),
    resolve: { alias: { '@engine': fileURLToPath(new URL('../supabase/functions/_shared/engine.ts', import.meta.url)) } },
    build: { outDir: fileURLToPath(new URL('../dist', import.meta.url)), emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  };
});
