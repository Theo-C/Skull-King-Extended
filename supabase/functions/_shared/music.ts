// Juke-box partagé (A19, docs/jukebox/SPEC.md) : règles communes au serveur et au site, sans dépendance.
// Analyse des liens, quotas, seuil de vote et position attendue d'un morceau à l'heure du serveur.

export type Provider = 'youtube' | 'soundcloud';
/** 3 morceaux en attente par joueur, 10 min au plus par morceau, 30 dans la file de la partie. */
export const MUSIC = { perUser: 3, maxSeconds: 600, maxQueue: 30, resyncS: 1.5, checkMs: 5000 } as const;

/** Messages d'erreur montrés sous le champ d'ajout (codes renvoyés par le serveur). */
export const MUSIC_ERR: Record<string, string> = {
  unknown: "Ce lien n'est pas reconnu. Collez un lien YouTube ou SoundCloud.",
  closed: 'Spotify et Deezer ne peuvent pas être lus dans le jeu. Collez un lien YouTube ou SoundCloud.',
  playlist: "Les playlists ne sont pas prises en charge : collez le lien d'un seul morceau.",
  notfound: 'Ce morceau est introuvable, privé ou supprimé.',
  embed: "Ce morceau refuse d'être lu hors de son site (droits ou restriction d'âge). Essayez une autre version.",
  live: 'Les directs ne sont pas pris en charge : collez une vidéo terminée.',
  preview: "SoundCloud n'offre qu'un extrait de 30 s de ce morceau. Essayez une autre version.",
  long: '10 minutes maximum par morceau.',
  quota: 'Vous avez déjà 3 morceaux en attente. Attendez qu’un des vôtres passe.',
  full: 'La file est pleine (30 morceaux). Attendez que quelques-uns passent.',
  off: "Le juke-box est coupé par l'hôte.",
  unavailable: 'Le juke-box est indisponible pour le moment. Réessayez dans un instant.',
};

export type ParsedLink = { provider: 'youtube'; id: string } | { provider: 'soundcloud'; url: string } | { error: 'unknown' | 'closed' | 'playlist' };
/** Lien collé → vidéo YouTube (watch, youtu.be, shorts, embed, m. / music.) ou morceau SoundCloud ; Spotify et Deezer refusés. */
export function parseLink(raw: unknown): ParsedLink {
  const s = String(raw ?? '').trim();
  if (!s || s.length > 500) return { error: 'unknown' };
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return { error: 'unknown' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'unknown' };
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (/(^|\.)(spotify\.com|spotify\.link|deezer\.com|deezer\.page\.link|dzr\.page\.link)$/.test(host)) return { error: 'closed' };
  const ytId = (x: string | null | undefined) => x && /^[\w-]{11}$/.test(x) ? x : null;
  if (host === 'youtu.be') { const id = ytId(u.pathname.split('/')[1]); return id ? { provider: 'youtube', id } : { error: 'unknown' }; }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const p = u.pathname.split('/').filter(Boolean);
    const id = p[0] === 'watch' ? ytId(u.searchParams.get('v')) : (p[0] === 'shorts' || p[0] === 'embed' || p[0] === 'live' || p[0] === 'v') ? ytId(p[1]) : null;
    if (id) return { provider: 'youtube', id };
    return p[0] === 'playlist' ? { error: 'playlist' } : { error: 'unknown' };
  }
  if (host === 'soundcloud.com' || host === 'm.soundcloud.com' || host === 'on.soundcloud.com') {
    const p = u.pathname.split('/').filter(Boolean);
    if (host === 'on.soundcloud.com') return p.length === 1 ? { provider: 'soundcloud', url: `https://on.soundcloud.com/${p[0]}` } : { error: 'unknown' };
    if (p.length < 2 || !p.every(x => /^[\w.-]+$/.test(x))) return { error: 'unknown' };
    if (p[1] === 'sets' || p[1] === 'albums' || p[1] === 'tracks' || p[1] === 'likes' || p[1] === 'reposts') return { error: 'playlist' };
    // lien privé : soundcloud.com/artiste/morceau/s-XXXX (le jeton fait partie du lien)
    if (p.length > 3 || (p.length === 3 && !/^s-[\w]+$/.test(p[2]))) return { error: 'unknown' };
    return { provider: 'soundcloud', url: `https://soundcloud.com/${p.join('/')}` };
  }
  return { error: 'unknown' };
}

/** Durée ISO 8601 de YouTube (PT1H2M3S) en secondes ; 0 si elle est absente (direct). */
export function isoSeconds(d: unknown): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(d ?? ''));
  return m ? ((+(m[1] ?? 0) * 24 + +(m[2] ?? 0)) * 60 + +(m[3] ?? 0)) * 60 + +(m[4] ?? 0) : 0;
}

/** Votes nécessaires pour passer : la moitié des joueurs humains, arrondie au supérieur (au moins 1). */
export const skipNeed = (humans: number) => Math.max(1, Math.ceil(humans / 2));

/** État du juke-box tel que le site le lit (music_state). */
export interface MusicStateRow { enabled: boolean; current_id: string | null; started_at: string | null; paused_at: string | null; skip_votes: string[]; reports?: string[] }
/** Position attendue du morceau en cours (secondes), à l'heure du serveur ; figée pendant une coupure de l'hôte. */
export function expectedPosition(st: Pick<MusicStateRow, 'started_at' | 'paused_at'>, serverNowMs: number, durationS?: number): number {
  if (!st.started_at) return 0;
  const end = st.paused_at ? Date.parse(st.paused_at) : serverNowMs;
  const pos = Math.max(0, (end - Date.parse(st.started_at)) / 1000);
  return durationS != null ? Math.min(pos, durationS) : pos;
}
/** Faut-il recaler le lecteur ? Écart de plus de 1,5 s avec la position attendue. */
export const needsResync = (playerS: number, expectedS: number) => Math.abs(playerS - expectedS) > MUSIC.resyncS;
/** Décalage horloge du site → serveur : sur plusieurs allers-retours, on garde celui au trajet le plus court. */
export function clockOffset(samples: { t0: number; t1: number; server: number }[]): number {
  if (!samples.length) return 0;
  const best = samples.reduce((a, b) => (b.t1 - b.t0 < a.t1 - a.t0 ? b : a));
  return best.server - (best.t0 + best.t1) / 2;
}
/** 2:34, 1:02:03 */
export function fmtDuration(s: number): string {
  s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
}
