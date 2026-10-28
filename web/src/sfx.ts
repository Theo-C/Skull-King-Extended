// Gestionnaire de sons commun (A12, docs/sons/PROMPT-son-carte.md) : Web Audio API, un seul AudioContext, un GainNode
// général relié au réglage Son (coupé = rien ne joue) et au curseur Volume, sons de fichiers décodés une fois en AudioBuffer,
// et effets synthétisés (coffre, plis, tour…). Rien ne joue quand l'onglet est caché. Le contexte est débloqué au premier
// geste de l'utilisateur (indispensable sur iOS et Safari).

/* ---------- Réglages : Son (interrupteur) et Volume (0 à 100 %), sur cet appareil ---------- */
const K_ON = 'pli-sound', K_VOL = 'pli-volume';
const store = {
  get: (k: string) => { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch { return null; } },
  set: (k: string, v: string) => { try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
};
let on = store.get(K_ON) !== '0';
let volume = (() => { const v = Number(store.get(K_VOL)); return Number.isFinite(v) && store.get(K_VOL) != null ? Math.min(1, Math.max(0, v)) : 1; })();
export const soundOn = () => on;
export function setSound(v: boolean) { on = v; store.set(K_ON, v ? '1' : '0'); applyGain(); }
export const soundVolume = () => volume;
export function setVolume(v: number) { volume = Math.min(1, Math.max(0, v)); store.set(K_VOL, String(volume)); applyGain(); }

/* ---------- Contexte audio ---------- */
let ctx: AudioContext | null = null, master: GainNode | null = null;
function applyGain() { if (master && ctx) master.gain.setTargetAtTime(on ? volume : 0, ctx.currentTime, .015); }
function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext; if (!C) return null;
    ctx = new C(); master = ctx.createGain(); master.connect(ctx.destination); applyGain();
  }
  return ctx;
}
/** Contexte prêt à jouer, ou null : son coupé, onglet caché, ou navigateur qui attend encore un geste. */
function ready(): AudioContext | null {
  if (!on || volume <= 0 || (typeof document !== 'undefined' && document.hidden)) return null;
  const c = context(); if (!c) return null;
  if (c.state === 'suspended') c.resume().catch(() => { /* attend un geste de l'utilisateur */ });
  return c.state === 'running' ? c : null;
}
// déverrouillage au premier geste (clic, toucher ou touche)
if (typeof window !== 'undefined') {
  const unlock = () => { const c = context(); if (c && c.state === 'suspended') c.resume().catch(() => { /* réessayé au geste suivant */ }); if (c?.state === 'running') { removeEventListener('pointerdown', unlock, true); removeEventListener('keydown', unlock, true); } };
  addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true);
}

/* ---------- Sons de fichiers : décodés une fois ---------- */
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<void>>();
/** .ogg (Opus) si le navigateur le lit, sinon .mp3. */
export function soundExt(): 'ogg' | 'mp3' {
  try { return typeof document !== 'undefined' && document.createElement('audio').canPlayType('audio/ogg; codecs=opus') ? 'ogg' : 'mp3'; } catch { return 'mp3'; }
}
/** Charge et décode des sons (chemin sans extension, relatif au site), une seule fois chacun. */
export function preload(names: Record<string, string>) {
  const c = context(); if (!c) return Promise.resolve();
  const ext = soundExt();
  return Promise.all(Object.entries(names).map(([name, path]) => {
    if (buffers.has(name) || loading.has(name)) return loading.get(name);
    const p = fetch(`${path}.${ext}`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then(b => c.decodeAudioData(b)).then(buf => { buffers.set(name, buf); }).catch(() => { /* son absent : on joue sans */ });
    loading.set(name, p); return p;
  })).then(() => undefined);
}
/** Joue un son chargé : volume (0 à 1) et vitesse de lecture, éventuellement décalé (secondes). Faux s'il n'a pas joué. */
export function play(name: string, opts: { volume?: number; rate?: number; delay?: number } = {}): boolean {
  const c = ready(), buf = buffers.get(name); if (!c || !buf || !master) return false;
  const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = opts.rate ?? 1;
  const g = c.createGain(); g.gain.value = opts.volume ?? 1;
  src.connect(g).connect(master); src.start(c.currentTime + Math.max(0, opts.delay ?? 0));
  return true;
}

/* ---------- Carte posée (A12) ---------- */
export const CARD_VARIANTS = ['carte-posee-a', 'carte-posee-b', 'carte-posee-c'] as const;
/** Charge les 3 variantes du son « carte posée » (au chargement de la table). */
export const preloadTableSounds = () => preload(Object.fromEntries(CARD_VARIANTS.map(n => [n, 'sounds/cartes/' + n])));
/** Variante au hasard, jamais deux fois la même d'affilée. */
export function nextVariant(prev: number, rnd: () => number = Math.random): number {
  const k = Math.floor(rnd() * (CARD_VARIANTS.length - 1)); return prev < 0 ? Math.floor(rnd() * CARD_VARIANTS.length) : (k >= prev ? k + 1 : k);
}
/** Au-delà de ce nombre d'événements reçus d'un coup, c'est une resynchronisation (reconnexion, rattrapage) et pas du direct.
 *  Un coup ordinaire, robots compris, en produit jusqu'à 22 (voir tests/engine.test.ts). */
export const LIVE_BATCH_MAX = 40;
/** Faut-il jouer « carte posée » ? Son activé, événement en direct (pas une resynchronisation), carte non animée. */
export const shouldPlayCard = (o: { soundOn: boolean; live: boolean; animated: boolean }) => o.soundOn && o.live && !o.animated;
let lastVariant = -1, lastCardAt = 0;
/** Carte qui touche le tapis : variante aléatoire, vitesse 0,97 à 1,03, plus fort pour la vôtre ; deux cartes à moins de
 *  60 ms d'écart sont espacées de 60 ms. */
export function cardPlaced(o: { mine: boolean; animated: boolean; live: boolean }): boolean {
  if (!shouldPlayCard({ soundOn: on, live: o.live, animated: o.animated })) return false;
  lastVariant = nextVariant(lastVariant);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const at = Math.max(now, lastCardAt + 60); lastCardAt = at;
  return play(CARD_VARIANTS[lastVariant], { volume: o.mine ? .8 : .55, rate: .97 + Math.random() * .06, delay: (at - now) / 1000 });
}

/* ---------- Effets synthétisés (coffre, plis, tour, réactions…) ---------- */
/** Bruit filtré très court : frottement d'une carte. */
function swish(when: number, dur: number, freq: number, gain: number) {
  const c = ready(); if (!c || !master) return; const t = c.currentTime + when;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .9;
  const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t);
}
function tone(when: number, dur: number, freq: number, gain: number, type: OscillatorType = 'sine') {
  const c = ready(); if (!c || !master) return; const t = c.currentTime + when;
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
/** Grincement : dent de scie grave qui glisse, filtrée (bois et charnières). */
function creak(when: number, dur: number, from: number, to: number, gain: number) {
  const c = ready(); if (!c || !master) return; const t = c.currentTime + when;
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(from, t); o.frequency.linearRampToValueAtTime(to, t + dur);
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 4;
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .04); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
/** Souffle : bruit filtré qui monte puis retombe. */
function breath(when: number, dur: number, gain: number) {
  const c = ready(); if (!c || !master) return; const t = c.currentTime + when;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1800, t + dur * .7);
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * .6); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t);
}
/** Accords du coffre, du commun (2 notes) au mythique (6 notes, plus long). */
const CHORDS: Record<string, number[]> = { c: [523, 659], r: [523, 659, 784], e: [440, 554, 659, 880], l: [392, 494, 587, 784, 988], m: [349, 440, 523, 659, 784, 1047] };

export const sfx = {
  /** Carte qui touche le tapis (A12) : voir cardPlaced. */
  cardPlaced,
  deal: (n: number) => { for (let i = 0; i < Math.min(n, 12); i++) swish(i * .07, .07, 2600, .22); },
  coin: () => { tone(0, .09, 1568, .07, 'triangle'); tone(.06, .16, 2349, .05, 'triangle'); },
  win: () => { tone(0, .2, 659, .08); tone(.11, .34, 988, .07); },
  turn: () => { tone(0, .3, 880, .06); tone(.09, .42, 1319, .045); },
  // coffre (spécification « Ouverture de coffre ») : grincement, souffle, accord selon la rareté, ouverture
  creak: () => { creak(0, .35, 140, 95, .05); creak(.45, .35, 150, 100, .05); },
  breath: (dur: number) => breath(0, Math.max(.6, dur), .1),
  chord: (rarity: string) => { const n = CHORDS[rarity] ?? CHORDS.c, rich = n.length > 3; n.forEach((f, i) => { tone(i * (rich ? .07 : .05), rich ? 1.4 : .8, f, .05); if (rich) tone(i * .07 + .02, 1.2, f * 2, .015, 'triangle'); }); },
  open: () => { swish(0, .18, 1200, .2); tone(0, .16, 110, .1, 'triangle'); tone(.04, .25, 1760, .03, 'triangle'); },
  bad: () => { tone(0, .22, 294, .06, 'triangle'); tone(.14, .34, 220, .06, 'triangle'); },
  // booster (docs/boosters/SPEC.md, « Sons ») : froissement du sachet, crissement de la coupe dont la hauteur suit la
  // progression, déchirure et souffle, « fwip » de chaque carte, carillon (Holo), accord (Épique), fanfare (Signée, Numérotée)
  crinkle: () => { for (let i = 0; i < 5; i++) swish(i * .045 + Math.random() * .02, .06, 3000 + Math.random() * 2500, .12); },
  cut: (p: number) => swish(0, .05, 1400 + Math.min(1, Math.max(0, p)) * 3200, .08),
  tear: () => { swish(0, .32, 2200, .26); swish(.05, .2, 900, .16); breath(.1, .9, .08); },
  /** Déchirure du sachet : une vingtaine de petits craquements aigus qui courent sur une demi-seconde (le papier qui se
   *  sépare), puis un souffle léger ; aucune bouffée grave (l'ancien tear sonnait comme un ballon qui éclate). */
  rip: () => {
    let t = 0;
    for (let i = 0; i < 22; i++) { const k = i / 21; swish(t, .012 + Math.random() * .016, 2600 + Math.random() * 3200, .05 + .05 * Math.sin(Math.PI * k)); t += .012 + .018 * Math.abs(k - .45) + Math.random() * .01; }
    breath(.05, .55, .025);
  },
  /** Carte retournée : deux frottements doux. */
  flip: () => { swish(0, .08, 2600, .07); swish(.11, .07, 1900, .05); },
  fwip: () => swish(0, .13, 3400, .17),
  reveal: (tier: string) => {
    if (tier === 'r') [1319, 1760, 2349].forEach((f, i) => tone(i * .07, .5, f, .035, 'triangle'));
    else if (tier === 'e') CHORDS.e.forEach((f, i) => tone(i * .06, 1, f, .045));
    else if (tier === 'l' || tier === 'm') {
      [523, 659, 784, 1047].forEach((f, i) => tone(i * .09, .28, f, .06, 'triangle'));
      (tier === 'm' ? CHORDS.m : CHORDS.l).forEach((f, i) => { tone(.4 + i * .05, 1.6, f, .05); tone(.42 + i * .05, 1.3, f * 2, .014, 'triangle'); });
    }
  },
};
