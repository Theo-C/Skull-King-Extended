// Banc d'essai des cartes pour les tests visuels (tests/visual/) : rend des cartes du jeu avec le vrai composant.
import '../src/game.css';
import { cardHTML, setLayered } from '../src/cards';
import { attachAnim } from '../src/animatedCards';
import { CALQUES, cadreUrl, illuBox, masks, windowBox } from '../src/calques';
import { VARIANTS, type Variant } from '@shared/collection.ts';
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

interface RenderOpts { keys?: string[]; s?: number; flat?: boolean; cadre?: boolean; anim?: boolean; extra?: string; variant?: Variant; serial?: number; still?: boolean; label?: string }
function render(o: RenderOpts = {}) {
  const keys = o.keys ?? Object.keys(CALQUES), root = document.getElementById('banc')!;
  setLayered(!o.flat);
  const row = document.createElement('div'); row.className = 'row';
  // cadre : le calque cadre seul, posé comme une image unique (référence des personnages sans bandeau)
  const one = (k: string, i: number) => o.cadre
    ? `<div class="card" style="--s:${o.s ?? 1}"><div class="face"><div class="art"><img src="${cadreUrl(k)}" alt=""></div></div></div>`
    : cardHTML({ id: i, ...SAMPLE[k] }, null, o.extra ?? '', `style="--s:${o.s ?? 1}"`, { variant: o.variant, serial: o.serial, still: o.still });
  row.innerHTML = (o.label ? `<span class="rowlbl">${o.label}</span>` : '') + keys.map((k, i) => `<div class="cell" data-k="${k}">${one(k, i)}<span class="lbl">${k}</span></div>`).join('');
  root.append(row);
  setLayered(true);
  if (o.anim) row.querySelectorAll<HTMLElement>('.cell').forEach(c => attachAnim(c.querySelector('.card')!, c.dataset.k!));
  return row;
}
/** Planche « 8 variantes × chaque famille » (SPEC des boosters, règle n° 1) : une ligne par carte, une colonne par variante. */
function planche(o: { w?: number; keys?: string[]; still?: boolean } = {}) {
  const root = document.getElementById('banc')!, s = (o.w ?? 56) / 252;
  const grid = document.createElement('div'); grid.className = 'planche';
  grid.innerHTML = `<div class="prow head"><span></span>${VARIANTS.map(v => `<span>${v}</span>`).join('')}</div>`
    + (o.keys ?? Object.keys(CALQUES)).map((k, i) => `<div class="prow"><span>${k}</span>${VARIANTS.map(v => cardHTML({ id: i, ...SAMPLE[k] }, null, '', `style="--s:${s}"`, { variant: v, serial: 4, still: o.still })).join('')}</div>`).join('');
  root.append(grid);
  return grid;
}
/** Attend que toutes les images, les masques (variables CSS) et les polices soient prêts. */
async function ready() {
  await document.fonts.ready;
  const masks = new Set<string>();
  document.querySelectorAll<HTMLElement>('.art.fx').forEach(a => ['--mk', '--fo', '--fd'].forEach(p => { const m = /url\((.*)\)/.exec(a.style.getPropertyValue(p)); if (m) masks.add(m[1]); }));
  await Promise.all([...masks].map(u => { const i = new Image(); i.src = u; return i.decode().catch(() => null); }));
  await Promise.all([...document.images].map(img => img.decode().catch(() => null)));
  await Promise.all([...document.querySelectorAll('video')].map(v => v.readyState >= 2 ? null : new Promise(r => { v.onloadeddata = v.onerror = r; setTimeout(r, 5000); })));
  await new Promise(r => setTimeout(r, 600));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
/** Alpha (0 à 255) d'un masque posé sur le rectangle r (pixels de la face 252 × 352, s = 1). */
async function maskPx(url: string, r: [number, number, number, number]): Promise<number[]> {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = 252; c.height = 352;
  const g = c.getContext('2d')!; g.drawImage(img, r[0], r[1], r[2], r[3]);
  const d = g.getImageData(0, 0, 252, 352).data, out: number[] = [];
  for (let i = 3; i < d.length; i += 4) out.push(d[i]);
  return out;
}
(window as any).banc = {
  keys: Object.keys(CALQUES), calques: CALQUES, windows: Object.fromEntries(Object.keys(CALQUES).map(k => [k, windowBox(k)])),
  illus: Object.fromEntries(Object.keys(CALQUES).map(k => [k, illuBox(k)])), masks: Object.fromEntries(Object.keys(CALQUES).map(k => [k, masks(k)])),
  render, planche, ready, maskPx, clear: () => { document.getElementById('banc')!.innerHTML = ''; },
};
