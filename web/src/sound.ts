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

export const sfx = {
  card: () => swish(0, .11, 2200, .35),
  deal: (n: number) => { for (let i = 0; i < Math.min(n, 12); i++) swish(i * .07, .07, 2600, .22); },
  coin: () => { tone(0, .09, 1568, .07, 'triangle'); tone(.06, .16, 2349, .05, 'triangle'); },
  win: () => { tone(0, .2, 659, .08); tone(.11, .34, 988, .07); },
  turn: () => { tone(0, .3, 880, .06); tone(.09, .42, 1319, .045); },
  bad: () => { tone(0, .22, 294, .06, 'triangle'); tone(.14, .34, 220, .06, 'triangle'); },
};
