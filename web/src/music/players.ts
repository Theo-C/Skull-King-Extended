// Lecteurs officiels du juke-box (A19, docs/jukebox/SPEC.md) : YouTube IFrame Player API et SoundCloud Widget API, derrière
// une même interface. Aucun audio ne transite par le jeu : chaque joueur lit le morceau avec le lecteur intégré du site
// d'origine, placé dans un bloc de 1 × 1 px hors écran (pas display:none, qui bloque certains lecteurs).
import type { Provider } from '@shared/music.ts';

export interface MusicPlayer {
  readonly provider: Provider;
  /** Charge un morceau et le lance à startAt secondes. */
  load(mediaId: string, startAt: number): void;
  seek(s: number): void;
  /** Volume 0 à 100. */
  setVolume(v: number): void;
  mute(m: boolean): void;
  /** Relance la lecture (premier geste du joueur, retour sur l'onglet). */
  play(): void;
  stop(): void;
  /** Position actuelle (secondes), ou null tant que le lecteur n'est pas prêt. */
  time(): number | null;
  /** En lecture (ou en chargement juste avant). */
  playing(): boolean;
  destroy(): void;
  onEnded?: () => void;
  /** Code d'erreur du lecteur (YouTube : 2, 5, 100, 101, 150). */
  onError?: (code: number) => void;
}

/** Bloc caché qui accueille les lecteurs (un seul pour la page). */
function host(): HTMLElement {
  let h = document.getElementById('jbhost');
  if (!h) {
    h = document.createElement('div'); h.id = 'jbhost'; h.setAttribute('aria-hidden', 'true');
    h.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none';
    document.body.append(h);
  }
  return h;
}
const scripts = new Map<string, Promise<void>>();
function script(src: string, ready?: (done: () => void) => void): Promise<void> {
  if (!scripts.has(src)) scripts.set(src, new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onerror = () => { scripts.delete(src); rej(new Error('lecteur indisponible')); };
    if (ready) ready(res); else s.onload = () => res();
    document.head.append(s);
  }));
  return scripts.get(src)!;
}

/* ---------- YouTube ---------- */
const ytApi = () => script('https://www.youtube.com/iframe_api', done => {
  const w = window as any; if (w.YT?.Player) { done(); return; }
  const prev = w.onYouTubeIframeAPIReady; w.onYouTubeIframeAPIReady = () => { prev?.(); done(); };
});
export function youtubePlayer(): MusicPlayer {
  let p: any = null, ready = false, vol = 60, muted = false, pending: [string, number] | null = null, current = '';
  const el = document.createElement('div'); host().append(el);
  const apply = () => { if (!ready) return; p.setVolume(vol); if (muted) p.mute(); else p.unMute(); };
  const self: MusicPlayer = {
    provider: 'youtube',
    load(id, at) {
      current = id;
      if (!ready) { pending = [id, at]; return; }
      p.loadVideoById({ videoId: id, startSeconds: Math.max(0, at) }); apply();
    },
    seek(s) { if (ready) p.seekTo(Math.max(0, s), true); },
    setVolume(v) { vol = v; apply(); },
    mute(m) { muted = m; apply(); },
    play() { if (ready && current) p.playVideo(); },
    stop() { current = ''; pending = null; if (ready) p.stopVideo(); },
    time() { return ready && current ? Number(p.getCurrentTime?.() ?? 0) : null; },
    playing() { const s = ready ? p.getPlayerState?.() : -1; return s === 1 || s === 3; },
    destroy() { try { p?.destroy(); } catch { /* déjà retiré */ } el.remove(); ready = false; },
  };
  ytApi().then(() => {
    const YT = (window as any).YT;
    p = new YT.Player(el, {
      width: 200, height: 200, host: 'https://www.youtube-nocookie.com',
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, iv_load_policy: 3, origin: location.origin },
      events: {
        onReady: () => { ready = true; apply(); if (pending) { const [id, at] = pending; pending = null; self.load(id, at); } },
        onStateChange: (e: any) => { if (e.data === 0 && current) self.onEnded?.(); },
        onError: (e: any) => { if (current) self.onError?.(Number(e.data)); },
      },
    });
  }).catch(() => self.onError?.(-1));
  return self;
}

/* ---------- SoundCloud ---------- */
const scApi = () => script('https://w.soundcloud.com/player/api.js');
export function soundcloudPlayer(): MusicPlayer {
  let w: any = null, ready = false, vol = 60, muted = false, pos: number | null = null, isPlaying = false, current = '', seekTo: number | null = null;
  const frame = document.createElement('iframe');
  frame.allow = 'autoplay; encrypted-media'; frame.width = '200'; frame.height = '200'; frame.title = 'Lecteur SoundCloud';
  const apply = () => { if (ready) w.setVolume(muted ? 0 : vol); };
  const widgetUrl = (url: string) => `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&buying=false&sharing=false&download=false&show_artwork=false&visual=false`;
  const startAt = (at: number) => { seekTo = at; };
  const self: MusicPlayer = {
    provider: 'soundcloud',
    load(url, at) {
      current = url; pos = null; startAt(at);
      if (!w) { frame.src = widgetUrl(url); host().append(frame); scApi().then(bind).catch(() => self.onError?.(-1)); return; }
      if (ready) w.load(url, { auto_play: true, buying: false, sharing: false, download: false, show_artwork: false, visual: false, callback: () => { apply(); } });
    },
    seek(s) { if (ready) w.seekTo(Math.max(0, s) * 1000); pos = s; },
    setVolume(v) { vol = v; apply(); },
    mute(m) { muted = m; apply(); },
    play() { if (ready && current) w.play(); },
    stop() { current = ''; pos = null; isPlaying = false; if (ready) w.pause(); },
    time() { return current ? pos : null; },
    playing() { return isPlaying; },
    destroy() { try { w?.unbind?.((window as any).SC?.Widget?.Events?.PLAY_PROGRESS); } catch { /* déjà retiré */ } frame.remove(); ready = false; },
  };
  function bind() {
    const SC = (window as any).SC; w = SC.Widget(frame); const E = SC.Widget.Events;
    w.bind(E.READY, () => { ready = true; apply(); w.play(); });
    w.bind(E.PLAY, () => { isPlaying = true; apply(); if (seekTo != null) { w.seekTo(seekTo * 1000); pos = seekTo; seekTo = null; } });
    w.bind(E.PAUSE, () => { isPlaying = false; });
    w.bind(E.PLAY_PROGRESS, (e: any) => { pos = Number(e.currentPosition) / 1000; });
    w.bind(E.FINISH, () => { isPlaying = false; if (current) self.onEnded?.(); });
    w.bind(E.ERROR, () => { if (current) self.onError?.(-2); });
  }
  return self;
}
