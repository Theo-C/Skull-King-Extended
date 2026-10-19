// Métadonnées des morceaux du juke-box (A19, docs/jukebox/SPEC.md) : titre, durée, miniature, et droit d'être intégré.
// YouTube : API Data v3 (clé dans le secret Supabase YOUTUBE_API_KEY, jamais côté site).
// SoundCloud : oEmbed (titre, miniature, adresse du lecteur) et métadonnées publiques de la page du morceau (durée,
// extrait seul, intégration autorisée). On ne lit jamais l'audio : chaque joueur l'écoute avec le lecteur officiel.
import type { MusicApi, MediaInfo } from '../_shared/service.ts';
import { isoSeconds } from '../_shared/music.ts';

const TTL = 10 * 60_000;
const cache = new Map<string, { at: number; v: MediaInfo | { error: string; seconds?: number } }>();
async function cached(key: string, load: () => Promise<MediaInfo | { error: string; seconds?: number }>) {
  const hit = cache.get(key); if (hit && Date.now() - hit.at < TTL) return hit.v;
  const v = await load();
  if ('error' in v && v.error === 'unavailable') return v; // panne passagère : pas gardée en cache
  cache.set(key, { at: Date.now(), v });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return v;
}
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; PliDesPirates/1.0; +https://skull-king-extended.vercel.app)' };

async function youtube(key: string | undefined, id: string): Promise<MediaInfo | { error: string; seconds?: number }> {
  if (!key) return { error: 'unavailable' };
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`YouTube ${res.status}`);
  const v = (await res.json())?.items?.[0];
  if (!v || v.status?.privacyStatus === 'private' || v.status?.uploadStatus === 'rejected' || v.status?.uploadStatus === 'deleted') return { error: 'notfound' };
  if (v.snippet?.liveBroadcastContent && v.snippet.liveBroadcastContent !== 'none') return { error: 'live' };
  if (v.status?.embeddable === false || v.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted') return { error: 'embed' };
  const seconds = isoSeconds(v.contentDetails?.duration);
  if (!seconds) return { error: 'live' };
  const t = v.snippet?.thumbnails ?? {};
  return { provider: 'youtube', media_id: id, title: String(v.snippet?.title ?? 'Vidéo YouTube'), thumb_url: (t.medium ?? t.high ?? t.default)?.url ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, duration_s: seconds };
}

async function soundcloud(url: string): Promise<MediaInfo | { error: string; seconds?: number }> {
  const oe = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`, { headers: UA });
  if (oe.status === 404 || oe.status === 403) return { error: 'notfound' };
  if (!oe.ok) throw new Error(`SoundCloud oEmbed ${oe.status}`);
  const o = await oe.json();
  // adresse du lecteur officiel (avec le jeton d'un lien privé) : https://api.soundcloud.com/tracks/123[?secret_token=s-…]
  const src = /src="([^"]+)"/.exec(String(o?.html ?? ''))?.[1]?.replace(/&amp;/g, '&') ?? '';
  const player = (() => { try { return new URL(src).searchParams.get('url') ?? ''; } catch { return ''; } })();
  if (/\/playlists\//.test(player)) return { error: 'playlist' };
  if (!/^https:\/\/api\.soundcloud\.com\/tracks\/\d+(\?secret_token=s-[\w]+)?$/.test(player)) return { error: 'notfound' };
  // durée et droits : métadonnées publiques de la page du morceau (balise itemprop, puis données de la page)
  const page = await fetch(url, { headers: UA });
  if (!page.ok) return { error: page.status === 404 ? 'notfound' : 'unavailable' };
  const html = await page.text();
  if (/"policy":"SNIP"/.test(html)) return { error: 'preview' };
  if (/"embeddable_by":"none"/.test(html) || /"streamable":false/.test(html)) return { error: 'embed' };
  let seconds = isoSeconds(/itemprop="duration" content="([^"]+)"/.exec(html)?.[1]);
  if (!seconds) { const ms = Number(/"full_duration":(\d+)/.exec(html)?.[1] ?? /"duration":(\d+)/.exec(html)?.[1]); if (ms > 0) seconds = Math.round(ms / 1000); }
  if (!seconds) return { error: 'unavailable' };
  return { provider: 'soundcloud', media_id: player, title: String(o?.title ?? 'Morceau SoundCloud'), thumb_url: o?.thumbnail_url ?? null, duration_s: seconds };
}

export function media(youtubeKey: string | undefined): MusicApi {
  return {
    lookup(link) {
      return link.provider === 'youtube' ? cached('y:' + link.id, () => youtube(youtubeKey, link.id)) : cached('s:' + link.url, () => soundcloud(link.url));
    },
  };
}
