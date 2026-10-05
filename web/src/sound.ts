// Effets sonores synthétisés (Web Audio) : aucun fichier à charger, coupables depuis la table.
let ctx: AudioContext | null = null;
let on = true;
try { on = localStorage.getItem('pli-sound') !== '0'; } catch { /* stockage indisponible */ }

export const soundOn = () => on;
export function setSound(v: boolean) { on = v; try { localStorage.setItem('pli-sound', v ? '1' : '0'); } catch { /* ignoré */ } }

function ac(): AudioContext | null {
  if (!on) return null;
  if (!ctx) { const C = window.AudioContext || (window as any).webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === 'suspended') ctx.resume().catch(() => { /* attend un geste de l'utilisateur */ });
  return ctx.state === 'running' ? ctx : null;
}
// Le navigateur n'autorise le son qu'après un geste : on débloque au premier clic.
addEventListener('pointerdown', () => { if (on) ac(); }, { once: true, capture: true });

/** Bruit filtré très court : frottement d'une carte. */
function swish(when: number, dur: number, freq: number, gain: number) {
  const c = ac(); if (!c) return; const t = c.currentTime + when;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .9;
  const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  src.connect(f).connect(g).connect(c.destination); src.start(t);
}
function tone(when: number, dur: number, freq: number, gain: number, type: OscillatorType = 'sine') {
  const c = ac(); if (!c) return; const t = c.currentTime + when;
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .05);
}

/** Grincement : dent de scie grave qui glisse, filtrée (bois et charnières). */
function creak(when: number, dur: number, from: number, to: number, gain: number) {
  const c = ac(); if (!c) return; const t = c.currentTime + when;
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(from, t); o.frequency.linearRampToValueAtTime(to, t + dur);
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 4;
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .04); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(f).connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .05);
}
/** Souffle : bruit filtré qui monte puis retombe. */
function breath(when: number, dur: number, gain: number) {
  const c = ac(); if (!c) return; const t = c.currentTime + when;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1800, t + dur * .7);
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * .6); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination); src.start(t);
}

/** Accords du coffre, du commun (2 notes) au légendaire (5 notes, plus long). */
const CHORDS: Record<string, number[]> = { c: [523, 659], r: [523, 659, 784], e: [440, 554, 659, 880], l: [392, 494, 587, 784, 988] };

export const sfx = {
  // Pose d'une carte : court frottement de papier + tap sourd (basses fréquences), moins strident que l'ancien swish seul
  card: () => { swish(0, .05, 1600, .14); tone(.015, .07, 190, .09, 'triangle'); tone(.02, .05, 95, .06); },
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
};
