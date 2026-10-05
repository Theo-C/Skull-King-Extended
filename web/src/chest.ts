// Ouverture de coffre : superposition plein écran qui reproduit l'animation de docs/maquettes/Coffre.dc.html
// (docs/ecrans-compte/SPEC.md, « Ouverture de coffre »). Le serveur tire le résultat avant l'animation : `open()` est
// appelé au clic, pendant que le coffre commence à trembler.
import './chest.css';
import { BY_ID, RARITY, RARITIES, type Cosmetic, type Rarity, type Slot } from '@shared/cosmetics.ts';
import { itemPreview } from './objects';
import { soundOn } from './sound';
import { esc } from './util';

export interface ChestResult {
  item: { id: string; slot: string; value: string; name: string; rarity: Rarity };
  duplicate: boolean; coinsGained: number; coins: number; chests: number;
}
export interface ChestOverlayOptions {
  chests: number; coins: number;
  /** Couleur du joueur (manteau de l'avatar dans l'aperçu des objets sans dessin dédié). */
  color: string;
  /** Ouvre un coffre côté serveur et renvoie le résultat. */
  open: () => Promise<ChestResult>;
  /** Porte l'objet obtenu (bouton « Équiper », absent pour un doublon). */
  equip?: (r: ChestResult) => Promise<void>;
  /** false : aucun son (sinon suit l'option Sons du site). */
  sounds?: boolean;
  onClose?: (last: { coins: number; chests: number }) => void;
}

export const SLOT_LABEL: Record<Slot, string> = { hat: 'Chapeau', face: 'Yeux et visage', neck: 'Cou', pet: 'Compagnon', bg: 'Décor', frame: 'Cadre' };
const SOFT: Record<Rarity, string> = { commun: 'rgba(214,221,228,.5)', rare: 'rgba(79,168,255,.55)', epique: 'rgba(194,125,255,.6)', legendaire: 'rgba(255,201,74,.7)' };
const WHITE = { c: '#ffffff', soft: 'rgba(255,255,255,.45)' };
/** Durée de la lueur blanche : plus l'objet est rare, plus la teinte se fait attendre. */
const HOLD: Record<Rarity, number> = { commun: 1500, rare: 1800, epique: 2100, legendaire: 2500 };
const PHASES = ['idle', 'shake', 'glow', 'tint', 'open', 'item', 'convert', 'done'] as const;
type Phase = typeof PHASES[number];

const STAR = '<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z" fill="var(--rc)"/>';
const CLOSE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
// socle, caisse et couvercle : tracés de la maquette (la scène reprend ses coordonnées, décalées de 420 × 84)
const SOCLE = '<svg class="chx-socle" viewBox="420 84 600 620" aria-hidden="true"><ellipse cx="720" cy="640" rx="250" ry="38" fill="#000" opacity=".45"/>' +
  '<path d="M500 630c0-24 98-38 220-38s220 14 220 38v24c0 24-98 38-220 38s-220-14-220-38z" fill="#3a2416"/>' +
  '<ellipse cx="720" cy="630" rx="220" ry="36" fill="#5a3720"/><ellipse cx="720" cy="630" rx="220" ry="36" fill="none" stroke="#c9a14a" stroke-width="2" opacity=".6"/></svg>';
const BOX = '<svg viewBox="0 0 260 150" aria-hidden="true"><defs><linearGradient id="chx-cgw" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8a5833"/><stop offset="1" stop-color="#4a2b16"/></linearGradient></defs>' +
  '<rect x="10" y="0" width="240" height="142" rx="8" fill="url(#chx-cgw)" stroke="#2a170b" stroke-width="3"/>' +
  '<path d="M14 48h232M14 96h232" stroke="#3a2214" stroke-width="2" opacity=".7"/>' +
  '<rect x="36" y="0" width="18" height="142" fill="#c9a14a" stroke="#6b4c14" stroke-width="1.5"/><rect x="206" y="0" width="18" height="142" fill="#c9a14a" stroke="#6b4c14" stroke-width="1.5"/>' +
  '<circle cx="45" cy="24" r="3" fill="#6b4c14"/><circle cx="45" cy="118" r="3" fill="#6b4c14"/><circle cx="215" cy="24" r="3" fill="#6b4c14"/><circle cx="215" cy="118" r="3" fill="#6b4c14"/>' +
  '<rect x="10" y="130" width="240" height="12" rx="4" fill="#c9a14a" stroke="#6b4c14" stroke-width="1.5"/>' +
  '<path d="M108 0h44v44c0 10-10 16-22 16s-22-6-22-16z" fill="#e3c47a" stroke="#6b4c14" stroke-width="2"/>' +
  '<circle cx="130" cy="22" r="6" fill="#2a170b"/><path d="M127 26h6l2 16h-10z" fill="#2a170b"/></svg>';
const LID = '<svg viewBox="0 0 260 116" aria-hidden="true"><defs><linearGradient id="chx-clw" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#9a6439"/><stop offset="1" stop-color="#6b4226"/></linearGradient></defs>' +
  '<path d="M10 112V64C10 22 62 4 130 4s120 18 120 60v48z" fill="url(#chx-clw)" stroke="#2a170b" stroke-width="3"/>' +
  '<path d="M40 112V30M220 112V30" stroke="#c9a14a" stroke-width="18"/>' +
  '<path d="M14 64C30 34 80 22 130 22s100 12 116 42" fill="none" stroke="#3a2214" stroke-width="2" opacity=".6"/>' +
  '<rect x="10" y="100" width="240" height="12" rx="4" fill="#c9a14a" stroke="#6b4c14" stroke-width="1.5"/>' +
  '<circle cx="40" cy="50" r="3" fill="#6b4c14"/><circle cx="220" cy="50" r="3" fill="#6b4c14"/>' +
  '<path d="M112 100h36v12h-36z" fill="#e3c47a" stroke="#6b4c14" stroke-width="1.5"/></svg>';

const plural = (n: number) => n <= 0 ? 'Aucun coffre à ouvrir' : n === 1 ? '1 coffre à ouvrir' : `${n} coffres à ouvrir`;
const fmt = (n: number) => n.toLocaleString('fr-FR');

/* ---------- Sons courts synthétisés (Web Audio), coupés avec l'option Sons ---------- */
let actx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!actx) { const C = window.AudioContext || (window as any).webkitAudioContext; if (!C) return null; actx = new C(); }
    if (actx.state === 'suspended') actx.resume().catch(() => { /* attend un geste */ });
    return actx;
  } catch { return null; }
}
function noise(c: AudioContext, dur: number) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; return s;
}
function env(c: AudioContext, t: number, peak: number, attack: number, dur: number) {
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  g.connect(c.destination); return g;
}
function note(c: AudioContext, when: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const t = c.currentTime + when, o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  o.connect(env(c, t, gain, .02, dur)); o.start(t); o.stop(t + dur + .05);
}
const SFX = {
  /** grincement : bois qui force, deux fois */
  creak(c: AudioContext) {
    for (const w of [0, .45]) {
      const t = c.currentTime + w, o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(140, t + .18); o.frequency.linearRampToValueAtTime(80, t + .38);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 6;
      o.connect(f).connect(env(c, t, .05, .04, .4)); o.start(t); o.stop(t + .45);
    }
  },
  /** souffle : bruit qui monte doucement */
  whoosh(c: AudioContext, dur: number) {
    const t = c.currentTime, s = noise(c, dur), f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2200, t + dur);
    s.connect(f).connect(env(c, t, .06, dur * .6, dur)); s.start(t);
  },
  /** accord du changement de teinte : plus riche pour Épique et Légendaire */
  chord(c: AudioContext, r: Rarity) {
    const notes = { commun: [523, 784], rare: [523, 659, 784], epique: [523, 659, 784, 1047], legendaire: [523, 659, 784, 1047, 1319, 1568] }[r];
    const step = r === 'legendaire' ? .07 : r === 'epique' ? .05 : 0;
    notes.forEach((f, i) => { note(c, i * step, f, 1.2, .05 / Math.sqrt(notes.length) * 1.6); if (r !== 'commun') note(c, i * step, f * 2, .8, .012, 'triangle'); });
  },
  /** ouverture : éclat de bruit et tintement */
  open(c: AudioContext) {
    const t = c.currentTime, s = noise(c, .35), f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200;
    s.connect(f).connect(env(c, t, .12, .01, .35)); s.start(t);
    note(c, .02, 1568, .4, .05, 'triangle'); note(c, .08, 2349, .5, .035, 'triangle');
  },
  coins(c: AudioContext) { for (let i = 0; i < 6; i++) { note(c, .9 + i * .08, 1568 + (i % 3) * 200, .1, .04, 'triangle'); } },
};

/* ---------- Superposition ---------- */
export function openChestOverlay(opts: ChestOverlayOptions): void {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const before = document.activeElement as HTMLElement | null;
  let chests = opts.chests, coins = opts.coins;
  let phase: Phase = 'idle', result: ChestResult | null = null, busy = false, skipAsked = false, waiting = false;
  let timers: number[] = [];
  const later = (ms: number, f: () => void) => { timers.push(window.setTimeout(f, ms)); };
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const play = (f: (c: AudioContext) => void) => {
    if (opts.sounds === false || !soundOn() || reduce) return;
    const c = audio(); if (c) try { f(c); } catch { /* son facultatif */ }
  };

  const root = document.createElement('div');
  root.className = 'chx';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'chx-title');
  root.innerHTML = `
    <header class="chx-top">
      <div class="chx-head"><h2 class="chx-title" id="chx-title">Coffre de victoire</h2><span class="chx-left"></span></div>
      <span class="chx-coins"><span class="chx-coin" aria-hidden="true"></span><b></b><span>pièces</span></span>
      <button type="button" class="chx-ghost chx-skip" hidden>Passer</button>
      <button type="button" class="chx-x" aria-label="Fermer" title="Fermer">${CLOSE}</button>
    </header>
    <div class="chx-stage"><div class="chx-scene">
      <div class="chx-halo"></div>
      <div class="chx-rays"><div></div></div>
      ${SOCLE}
      <div class="chx-chest"><div class="chx-body bob">${BOX}<div class="chx-seam"></div><div class="chx-lid">${LID}</div></div></div>
      <div class="chx-fx"></div>
      <div class="chx-item" hidden></div>
    </div></div>
    <div class="chx-bottom">
      <div class="chx-idle">
        <button type="button" class="chx-gold chx-open">Ouvrir le coffre</button>
        <ul class="chx-odds" aria-label="Probabilités">${RARITIES.map(r => `<li><i style="background:${RARITY[r].color}"></i>${RARITY[r].name} ${RARITY[r].weight} %</li>`).join('')}</ul>
        <p class="chx-err" role="alert" hidden></p>
      </div>
      <div class="chx-res" aria-live="polite"></div>
      <div class="chx-actions" hidden></div>
    </div>
    <div class="chx-fly"></div>`;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector(s) as T;
  const el = {
    left: q('.chx-left'), coins: q('.chx-coins b'), coin: q('.chx-coin'), skip: q<HTMLButtonElement>('.chx-skip'), x: q<HTMLButtonElement>('.chx-x'),
    stage: q('.chx-stage'), scene: q('.chx-scene'), halo: q('.chx-halo'), rays: q('.chx-rays'), chest: q('.chx-chest'), body: q('.chx-body'),
    seam: q('.chx-seam'), lid: q('.chx-lid'), fx: q('.chx-fx'), item: q('.chx-item'),
    idle: q('.chx-idle'), openBtn: q<HTMLButtonElement>('.chx-open'), err: q('.chx-err'), res: q('.chx-res'), actions: q('.chx-actions'), fly: q('.chx-fly'),
  };

  /* mise à l'échelle de la scène (600 × 620, contenu utile ~460 px de large) */
  const fit = () => {
    const w = el.stage.clientWidth, h = el.stage.clientHeight;
    el.scene.style.setProperty('--k', String(Math.max(.3, Math.min(1, w / 460, h / 620))));
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;

  const counters = () => { el.left.textContent = plural(chests); el.coins.textContent = fmt(coins); };

  /** Applique l'état visuel d'une phase (même table que renderVals() de la maquette). */
  function paint() {
    const at = PHASES.indexOf(phase), r = result?.item.rarity ?? 'commun', dup = !!result?.duplicate;
    const G = at >= 3 ? { c: RARITY[r].color, soft: SOFT[r] } : WHITE;
    root.style.setProperty('--g', G.c); root.style.setProperty('--gs', G.soft); root.style.setProperty('--rc', RARITY[r].color);
    el.halo.style.opacity = String(at === 0 ? .08 : at === 1 ? .2 : at === 2 ? .55 : 1);
    el.halo.style.transform = `scale(${at >= 4 ? 1.15 : at === 3 ? 1 : .8})`;
    el.rays.style.opacity = String(at === 2 ? .35 : at >= 3 ? .6 : 0);
    el.seam.style.opacity = String(at === 0 ? .1 : at === 1 ? .5 : 1);
    el.seam.style.boxShadow = `0 0 ${[6, 14, 30, 44][Math.min(at, 3)]}px ${[0, 2, 8, 14][Math.min(at, 3)]}px var(--g)`;
    el.body.className = 'chx-body ' + (at === 0 ? 'bob' : at === 1 ? (waiting ? 'hum' : 'shake') : at === 2 || at === 3 ? 'hum' : '');
    el.chest.style.opacity = at >= 5 ? '.55' : '1';
    el.lid.className = 'chx-lid' + (at >= 4 ? ' open' : at >= 2 ? ' crack' : '');
    if (phase !== 'open' && phase !== 'item') el.fx.innerHTML = '';
    el.item.hidden = at < 5;
    const glowi = el.item.querySelector('.chx-glowi');
    if (glowi) glowi.className = 'chx-glowi' + (phase === 'convert' ? ' melt' : phase === 'done' && dup ? ' spent' : '');
    el.res.hidden = at < 5 || phase === 'convert';
    el.idle.hidden = phase !== 'idle';
    el.openBtn.disabled = busy || chests <= 0;
    el.openBtn.textContent = chests <= 0 ? 'Aucun coffre à ouvrir' : 'Ouvrir le coffre';
    el.actions.hidden = phase !== 'done';
    el.skip.hidden = phase === 'idle' || phase === 'done';
    el.x.hidden = !el.skip.hidden;
    el.coin.classList.toggle('bump', phase === 'convert');
    counters();
    // garde le focus dans la superposition quand le bouton qui l'avait disparaît
    if (!root.contains(document.activeElement) || (document.activeElement as HTMLElement).offsetParent === null) focusFirst();
  }
  function focusFirst() {
    const f = phase === 'idle' ? (el.openBtn.disabled ? el.x : el.openBtn) : phase === 'done' ? (el.actions.querySelector('button') as HTMLElement || el.x) : el.skip;
    f?.focus({ preventScroll: true });
  }
  const set = (p: Phase) => { phase = p; paint(); };

  /** Remplit l'objet, le texte et les boutons du résultat. */
  function fillResult(res: ChestResult) {
    const it = res.item, R = RARITY[it.rarity];
    const cos: Cosmetic = BY_ID[it.id] ?? { id: it.id, slot: it.slot as Slot, value: it.value, name: it.name, rarity: it.rarity, source: 'chest' };
    el.item.className = 'chx-item' + (reduce ? '' : ' rise');
    el.item.innerHTML = `<div class="chx-glowi"><div class="chx-float">${itemPreview(cos, opts.color, 170)}</div></div>`;
    const slot = SLOT_LABEL[it.slot as Slot] ?? '';
    const stars = Array.from({ length: R.stars }, (_, n) => `<svg class="star" viewBox="0 0 24 24" style="animation-delay:${(.2 + n * .15).toFixed(2)}s" aria-hidden="true">${STAR}</svg>`).join('');
    el.res.innerHTML = `<div class="chx-rar up"><span>${R.name}</span><span class="chx-stars" role="img" aria-label="${R.stars} étoile${R.stars > 1 ? 's' : ''} sur 4">${stars}</span></div>
      <p class="chx-name up" style="animation-delay:.15s">${esc(it.name)}</p>
      <div class="chx-sub up" style="animation-delay:.3s">${slot}${res.duplicate ? '' : ' · nouvel objet'}</div>
      ${res.duplicate ? `<div class="chx-dup up" style="animation-delay:.4s">Déjà dans votre garde-robe : +${fmt(res.coinsGained)} pièces</div>` : ''}`;
    el.actions.innerHTML = '';
    const btn = (label: string, cls: string, on: (b: HTMLButtonElement) => void) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.onclick = () => on(b); el.actions.append(b); return b;
    };
    if (res.chests > 0) btn('Ouvrir le suivant', 'chx-ghost', () => { reset(); later(reduce ? 0 : 350, start); });
    if (!res.duplicate && opts.equip) btn('Équiper', 'chx-gold', async b => {
      if (b.disabled) return; b.disabled = true; b.textContent = 'Équipement…';
      try { await opts.equip!(res); b.textContent = 'Équipé ✓'; b.classList.add('done'); }
      catch (e: any) { b.disabled = false; b.textContent = 'Équiper'; showErr(e?.message || "Impossible d'équiper cet objet."); }
    });
    btn('Fermer', res.duplicate || !opts.equip ? 'chx-gold' : 'chx-ghost', close);
  }
  // message d'erreur lisible : sous le bouton au repos, sinon au-dessus des boutons du résultat
  function showErr(msg: string) {
    let p = el.err;
    if (phase === 'done') { p = el.res.querySelector('.chx-err') as HTMLElement || Object.assign(document.createElement('p'), { className: 'chx-err' }); p.setAttribute('role', 'alert'); el.res.append(p); }
    p.textContent = msg; p.hidden = false;
  }

  function sparks() {
    const R = RARITY[result!.item.rarity].color;
    let h = '<div class="chx-burst"></div><div class="chx-sparks">';
    for (let k = 0; k < 26; k++) {
      const a = k / 26 * Math.PI * 2, d = 140 + (k * 53 % 160), c = k % 3 ? R : '#ffffff', sz = 4 + k % 4 * 2;
      h += `<span class="chx-sp" style="--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d * .7 - 40)}px;--t:${(.7 + k % 4 * .15).toFixed(2)}s;--d:${(k % 5 * .02).toFixed(2)}s;width:${sz}px;height:${sz}px;background:${c};box-shadow:0 0 10px ${c}"></span>`;
    }
    el.fx.innerHTML = h + '</div>';
  }
  /** Pièces qui partent de l'objet vers le compteur. */
  function coinFlight() {
    const box = root.getBoundingClientRect(), a = el.item.getBoundingClientRect(), b = el.coin.getBoundingClientRect();
    const ox = a.left + a.width / 2 - box.left, oy = a.top + a.height / 2 - box.top, tx = b.left + b.width / 2 - box.left, ty = b.top + b.height / 2 - box.top;
    let h = '';
    for (let j = 0; j < 12; j++) {
      const l = ((j * 29) % 60) - 30, t = ((j * 17) % 40) - 20;
      h += `<span class="chx-cn" style="left:${ox + l}px;top:${oy + t}px;--dx:${tx - ox - l + (j % 3) * 3}px;--dy:${ty - oy - t - (j % 2) * 2}px;--d:${(j * .06).toFixed(2)}s"></span>`;
    }
    el.fly.innerHTML = h;
  }
  function finish() {
    clear(); el.fx.innerHTML = '';
    if (result) coins = result.coins;
    el.fly.innerHTML = ''; set('done');
  }
  function convert() {
    clear(); set('convert'); coinFlight(); play(SFX.coins);
    later(1200, finish);
  }
  /** Déroulé après réception du résultat (durées de la maquette). */
  function run(elapsed: number) {
    const r = result!, rr = r.item.rarity;
    let t = Math.max(0, 900 - elapsed);
    const at = (d: number, f: () => void) => { t += d; later(t, f); };
    later(t, () => { waiting = false; set('glow'); play(c => SFX.whoosh(c, HOLD[rr] / 1000)); });
    at(HOLD[rr], () => { set('tint'); play(c => SFX.chord(c, rr)); });
    at(1300, () => { sparks(); set('open'); play(SFX.open); });
    at(350, () => set('item'));
    if (r.duplicate) at(1600, convert); else at(900, finish);
  }
  async function start() {
    if (phase !== 'idle' || busy || chests <= 0) return;
    busy = true; skipAsked = false; result = null; el.err.hidden = true; el.res.innerHTML = ''; el.item.innerHTML = '';
    const t0 = performance.now();
    if (!reduce) {
      waiting = false; set('shake'); play(SFX.creak);
      later(900, () => { if (!result && phase === 'shake') { waiting = true; paint(); } });
    } else paint();
    let res: ChestResult;
    try { res = await opts.open(); }
    catch (e: any) {
      busy = false; clear(); waiting = false; set('idle');
      showErr(e?.message || "Le coffre n'a pas pu être ouvert. Réessayez."); el.openBtn.focus(); return;
    }
    if (!root.isConnected) return;
    busy = false; result = res; chests = res.chests;
    if (!res.duplicate) coins = res.coins;
    fillResult(res);
    if (reduce) { finish(); return; }
    if (skipAsked) { if (res.duplicate) convert(); else finish(); return; }
    paint(); run(performance.now() - t0);
  }
  function skip() {
    if (phase === 'idle' || phase === 'done') return;
    if (!result) { skipAsked = true; return; }
    clear(); el.fx.innerHTML = '';
    if (result.duplicate && phase !== 'convert') convert(); else if (phase !== 'convert') finish();
  }
  function reset() { clear(); result = null; waiting = false; el.item.innerHTML = ''; el.res.innerHTML = ''; el.fly.innerHTML = ''; el.fx.innerHTML = ''; set('idle'); }

  function close() {
    if (!root.isConnected) return;
    clear(); ro?.disconnect(); removeEventListener('resize', fit); document.removeEventListener('keydown', onKey, true);
    root.remove(); document.body.style.overflow = prevOverflow;
    if (before && before.isConnected) before.focus({ preventScroll: true });
    opts.onClose?.({ coins, chests });
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); if (phase === 'idle' && !busy || phase === 'done') close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...root.querySelectorAll<HTMLElement>('button:not([disabled])')].filter(b => b.offsetParent !== null);
    if (!f.length) { e.preventDefault(); return; }
    const i = f.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  }

  el.openBtn.onclick = start; el.skip.onclick = skip; el.x.onclick = close;
  document.addEventListener('keydown', onKey, true);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  document.body.append(root);
  ro ? ro.observe(el.stage) : addEventListener('resize', fit);
  fit(); paint(); focusFirst();
}
