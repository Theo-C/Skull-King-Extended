// Cartes animées, rareté Mythique (docs/cartes-animees/SPEC.md, maquette CartesAnimees) : six cartes dont l'illustration
// est une courte vidéo en boucle. Trois couches dans .art : l'image normale (repli, toujours là), la vidéo masquée par
// l'image (coins arrondis), puis le cadre seul (<fichier>-cadre.webp) pour que la compression ne touche jamais le cadre.
// Garde-fous : réglage « toutes / les miennes / aucune » (localStorage pli.cartesAnimees), une seule lecture à la fois
// par vidéo, pause quand l'onglet est masqué. Le réglage utilisateur prime : prefers-reduced-motion et saveData ne
// coupent plus les cartes animées (seul « aucune » les désactive), le poster sert de repli si la vidéo ne peut pas lire.
import { ART } from './cards';

/** Clé de carte du moteur (cardKey) → fichier dans web/public/cards/anim/ et couleur du halo d'arrivée. */
export const ANIM: Record<string, { file: string; halo: string }> = {
  kraken: { file: 'kraken', halo: '#ff5a3a' },
  sk: { file: 'sk', halo: '#ffd36b' },
  stingray: { file: 'raie', halo: '#6fe6ff' },
  whale: { file: 'baleine', halo: '#ff9a3a' },
  mermaid0: { file: 'sirene', halo: '#bff6ff' },
  davy: { file: 'fosse', halo: '#5dff8a' },
};
/** Fichier de l'animation (= valeur du cosmétique carte:<fichier>) → clé de carte du moteur. */
export const KEY_OF_FILE: Record<string, string> = Object.fromEntries(Object.entries(ANIM).map(([k, a]) => [a.file, k]));
/** Halo du pli : 1,2 s (décision 3 de docs/ETAT.md). */
export const HALO_MS = 1200;

export type AnimMode = 'toutes' | 'miennes' | 'aucune';
export const ANIM_MODES: [AnimMode, string][] = [['toutes', 'toutes'], ['miennes', 'les miennes'], ['aucune', 'aucune']];
const STORE = 'pli.cartesAnimees';
const listeners = new Set<() => void>();
export function getAnimMode(): AnimMode {
  try { const v = localStorage.getItem(STORE); if (v === 'miennes' || v === 'aucune') return v; } catch { /* stockage indisponible */ }
  return 'toutes';
}
export function setAnimMode(m: AnimMode) {
  try { localStorage.setItem(STORE, m); } catch { /* ignoré */ }
  listeners.forEach(f => f());
}
/** Prévenu à chaque changement du réglage (table et profil). Renvoie de quoi se désabonner. */
export function onAnimMode(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

// une seule lecture par vidéo : pour chaque fichier, la dernière vidéo attachée joue, les autres attendent en pause
const stacks = new Map<string, HTMLVideoElement[]>();
const top = (file: string) => { const s = stacks.get(file) || []; return s[s.length - 1] ?? null; };
const play = (v: HTMLVideoElement) => { if (document.hidden || !v.isConnected) return; v.muted = true; v.play().catch(() => { /* le poster reste affiché */ }); };
let watching = false;
function watchVisibility() {
  if (watching) return; watching = true;
  document.addEventListener('visibilitychange', () => {
    for (const s of stacks.values()) { const v = s[s.length - 1]; if (v) document.hidden ? v.pause() : play(v); }
  });
}

/** Ajoute la vidéo et le cadre sur une carte (élément .card avec une face illustrée), puis lance la lecture. */
export function attachAnim(cardEl: HTMLElement, key: string): boolean {
  const a = ANIM[key], art = cardEl.querySelector('.art'), img = art?.querySelector(':scope>img');
  if (!a || !art || !img) return false;
  if (art.querySelector('video.anim')) return true;
  watchVisibility();
  const v = document.createElement('video');
  v.className = 'anim'; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.poster = ART[key];
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
  v.style.setProperty('--mask', `url("${ART[key]}")`);
  v.innerHTML = `<source src="cards/anim/${a.file}.webm" type="video/webm"><source src="cards/anim/${a.file}.mp4" type="video/mp4">`;
  const frame = document.createElement('img');
  frame.className = 'cadre'; frame.alt = ''; frame.draggable = false; frame.src = `cards/anim/${a.file}-cadre.webp`;
  img.after(v, frame);
  cardEl.classList.add('animated'); cardEl.dataset.anim = key;
  const s = (stacks.get(a.file) || []).filter(x => x.isConnected);
  s[s.length - 1]?.pause(); s.push(v); stacks.set(a.file, s);
  play(v);
  return true;
}
/** Arrête et retire la vidéo et le cadre (la carte retrouve son image fixe). */
export function detachAnim(cardEl: HTMLElement) {
  const v = cardEl.querySelector('video.anim') as HTMLVideoElement | null;
  cardEl.querySelector('img.cadre')?.remove();
  cardEl.classList.remove('animated'); delete cardEl.dataset.anim;
  if (!v) return;
  v.pause(); v.remove();
  for (const [file, s] of stacks) {
    const i = s.indexOf(v); if (i < 0) continue;
    const was = i === s.length - 1; s.splice(i, 1);
    const left = s.filter(x => x.isConnected); stacks.set(file, left);
    if (was) { const t = top(file); if (t) play(t); }
  }
}
