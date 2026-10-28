// Banc d'essai des cartes pour les tests visuels (tests/visual/) : rend des cartes du jeu avec le vrai composant.
import '../src/game.css';
import { cardHTML, setLayered } from '../src/cards';
import { attachAnim } from '../src/animatedCards';
import { CALQUES, cadreUrl, windowBox } from '../src/calques';
import type { Card } from '@engine';

/** Une carte du moteur par calque (la couleur affiche un 7 pour avoir un chiffre dans le médaillon). */
export const SAMPLE: Record<string, Partial<Card>> = {
  'suit-yellow': { kind: 'num', suit: 'yellow', rank: 7 }, 'suit-purple': { kind: 'num', suit: 'purple', rank: 12 },
  'suit-green': { kind: 'num', suit: 'green', rank: 3 }, 'suit-black': { kind: 'num', suit: 'black', rank: 14 },
  rosie: { kind: 'pirate', pid: 'rosie' }, bahij: { kind: 'pirate', pid: 'bahij' }, rascal: { kind: 'pirate', pid: 'rascal' },
  juanita: { kind: 'pirate', pid: 'juanita' }, harry: { kind: 'pirate', pid: 'harry' }, mary: { kind: 'pirate', pid: 'mary' },
  con: { kind: 'con' }, sk: { kind: 'sk' }, mermaid0: { kind: 'mermaid', v: 0 }, mermaid1: { kind: 'mermaid', v: 1 },
  tigress: { kind: 'tigress' }, kraken: { kind: 'kraken' }, whale: { kind: 'whale' }, escape: { kind: 'escape' }, loot: { kind: 'loot' },
  volley: { kind: 'volley' }, stingray: { kind: 'stingray' }, plank: { kind: 'plank' }, davy: { kind: 'davy' },
  wild: { kind: 'num', suit: 'wild' as any, rank: 15, wild: 1, exp: 1 },
};

interface RenderOpts { keys?: string[]; s?: number; flat?: boolean; cadre?: boolean; anim?: boolean; extra?: string }
function render(o: RenderOpts = {}) {
  const keys = o.keys ?? Object.keys(CALQUES), root = document.getElementById('banc')!;
  setLayered(!o.flat);
  const row = document.createElement('div'); row.className = 'row';
  // cadre : le calque cadre seul, posé comme une image unique (référence des personnages sans bandeau)
  const one = (k: string, i: number) => o.cadre
    ? `<div class="card" style="--s:${o.s ?? 1}"><div class="face"><div class="art"><img src="${cadreUrl(k)}" alt=""></div></div></div>`
    : cardHTML({ id: i, ...SAMPLE[k] }, null, o.extra ?? '', `style="--s:${o.s ?? 1}"`);
  row.innerHTML = keys.map((k, i) => `<div class="cell" data-k="${k}">${one(k, i)}<span class="lbl">${k}</span></div>`).join('');
  root.append(row);
  setLayered(true);
  if (o.anim) row.querySelectorAll<HTMLElement>('.cell').forEach(c => attachAnim(c.querySelector('.card')!, c.dataset.k!));
  return row;
}
/** Attend que toutes les images (et les polices) soient prêtes. */
async function ready() {
  await document.fonts.ready;
  await Promise.all([...document.images].map(img => img.decode().catch(() => null)));
  await Promise.all([...document.querySelectorAll('video')].map(v => v.readyState >= 2 ? null : new Promise(r => { v.onloadeddata = v.onerror = r; setTimeout(r, 5000); })));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
(window as any).banc = {
  keys: Object.keys(CALQUES), calques: CALQUES, windows: Object.fromEntries(Object.keys(CALQUES).map(k => [k, windowBox(k)])),
  render, ready, clear: () => { document.getElementById('banc')!.innerHTML = ''; },
};
