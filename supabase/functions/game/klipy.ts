// Client KLIPY (GIF en partie, A10) : la clé reste ici, côté serveur (secret Supabase KLIPY_API_KEY).
// KLIPY reprend l'API v2 de Tenor (même paramètres, même réponse) ; on lit aussi son format natif par précaution.
// Filtre de contenu le plus strict, formats légers en priorité (mp4, puis webp, puis gif), cache de 10 min par requête.
import type { GifApi, GifItem } from '../_shared/service.ts';

const BASE = 'https://api.klipy.com/v2';
const TTL = 10 * 60_000;
const cache = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key); if (hit && Date.now() - hit.at < TTL) return hit.v as T;
  const v = await load(); cache.set(key, { at: Date.now(), v });
  if (cache.size > 300) cache.delete(cache.keys().next().value!); // le plus ancien
  return v;
}

type Fmt = { url?: string; dims?: number[]; width?: number; height?: number };
const pick = (m: Record<string, Fmt> | undefined, order: string[]) => { for (const k of order) if (m?.[k]?.url) return m[k]; return null; };
/** Résultat Tenor v2 ({ id, media_formats }) ou KLIPY natif ({ slug, file: { sm: { mp4 } } }) → GifItem. */
function toItem(r: any): GifItem | null {
  if (r?.type === 'ad') return null; // publicités KLIPY : on n'en affiche pas
  let preview: Fmt | null, full: Fmt | null;
  if (r?.media_formats) {
    preview = pick(r.media_formats, ['tinymp4', 'nanomp4', 'tinywebp', 'tinygif', 'nanogif', 'mp4', 'gif']);
    full = pick(r.media_formats, ['mp4', 'tinymp4', 'webp', 'tinywebp', 'gif', 'tinygif']);
  } else if (r?.file) {
    const f = r.file, at = (size: string) => f[size] ? { mp4: f[size].mp4, webp: f[size].webp, gif: f[size].gif } : {};
    preview = pick(at('sm') as any, ['mp4', 'webp', 'gif']) ?? pick(at('xs') as any, ['mp4', 'webp', 'gif']);
    full = pick(at('md') as any, ['mp4', 'webp', 'gif']) ?? preview;
  } else return null;
  const id = String(r.id ?? r.slug ?? '');
  if (!id || !preview?.url || !full?.url) return null;
  const w = full.dims?.[0] ?? full.width ?? 160, h = full.dims?.[1] ?? full.height ?? 120;
  return { id, preview: preview.url, full: full.url, w: Number(w), h: Number(h) };
}

export function klipy(key: string): GifApi {
  const common = `key=${encodeURIComponent(key)}&client_key=pli-des-pirates&contentfilter=high&locale=fr_FR&media_filter=tinymp4,nanomp4,mp4,tinywebp,webp,tinygif,gif`;
  const get = async (path: string) => {
    const res = await fetch(`${BASE}/${path}${path.includes('?') ? '&' : '?'}${common}`);
    if (!res.ok) throw new Error(`KLIPY ${res.status}`);
    return res.json();
  };
  const list = (j: any) => ((j?.results ?? j?.data?.data ?? []) as any[]).map(toItem).filter((x): x is GifItem => !!x);
  return {
    search(q, cursor) {
      const pos = cursor ? `&pos=${encodeURIComponent(cursor)}` : '';
      const path = q ? `search?q=${encodeURIComponent(q)}&limit=24${pos}` : `featured?limit=24${pos}`;
      return cached('s:' + path, async () => { const j = await get(path); return { items: list(j), next: j?.next ? String(j.next) : null }; });
    },
    get(id) {
      return cached('g:' + id, async () => list(await get(`posts?ids=${encodeURIComponent(id)}`))[0] ?? null);
    },
  };
}
