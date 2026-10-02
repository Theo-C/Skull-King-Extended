// Accès à Supabase : client, appel de la fonction « game », lien d'invitation.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.SUPABASE_URL as string | undefined;
const anon = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
export const configured = !!(url && anon);
export const sb = createClient(url || 'http://localhost', anon || 'cle-manquante', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});

/** Adresse publique du site, utilisée dans les liens d'invitation (utile aussi dans l'appli Android). */
export const SITE_URL = ((import.meta.env.SITE_URL as string) || location.origin + location.pathname).replace(/\/$/, '').replace(/\/index\.html$/, '');
export const inviteLink = (code: string) => `${SITE_URL}/#/rejoindre/${code}`;

/** Dans l'appli Android (Capacitor), le lien magique rouvre l'appli via son schéma d'URL. */
export const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
export const APP_SCHEME = (import.meta.env.APP_SCHEME as string) || 'fr.plidespirates.app';
export const AUTH_REDIRECT = isNative ? `${APP_SCHEME}://connexion` : SITE_URL + '/';
if (isNative) {
  const App = (window as any).Capacitor?.Plugins?.App;
  App?.addListener?.('appUrlOpen', async ({ url }: { url: string }) => {
    const u = new URL(url);
    const code = u.searchParams.get('code');
    if (code) { await sb.auth.exchangeCodeForSession(code); return; }
    const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
    if (hash.startsWith('#/')) location.hash = hash; // lien d'invitation ouvert depuis le téléphone
  });
}

export async function callGame<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb.functions.invoke('game', { body: { action, ...payload } });
  if (error) {
    let msg = 'Le serveur ne répond pas. Vérifiez votre connexion.';
    try { const ctx: any = (error as any).context; if (ctx?.json) { const j = await ctx.json(); if (j?.error) msg = j.error; } } catch { /* garde le message par défaut */ }
    throw new Error(msg);
  }
  return data as T;
}

export async function currentUser() { const { data } = await sb.auth.getSession(); return data.session?.user ?? null; }
