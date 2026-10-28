// Cartes en couches (docs/cartes-couches/SPEC.md, B7) : chaque carte est le cadre d'origine (fenêtre transparente,
// cards/calques/cadre_<clé>.webp) posé sur l'illustration seule (illu_<clé>.jpg). Les rectangles viennent de
// calques.json (pixels de l'image 720 × 1024, écrit par docs/cartes-couches/decoupe_calques.py et sans_bandeau.py) ;
// ici on les convertit en pourcentages pour le rendu.
import RAW from '../public/cards/calques/calques.json';

type Rect = [number, number, number, number];
interface Calque { gabarit: 'suit' | 'pir' | 'cre'; fenetre: Rect; illu: Rect; medaillons: [number, number, number][]; sans_bandeau?: boolean }
export const CALQUES = RAW as unknown as Record<string, Calque>;

export const IMG_W = 720, IMG_H = 1024;
/** Version des calques, ajoutée aux URL (même rôle que ART_VERSION). */
export const CALQUES_VERSION = 1;
const url = (f: string) => `cards/calques/${f}?v=${CALQUES_VERSION}`;
export const cadreUrl = (k: string) => url(`cadre_${k}.webp`);
export const illuUrl = (k: string) => url(`illu_${k}.jpg`);
export const masks = (k: string) => ({ marge: url(`marge_${k}.png`), foil: url(`foil_${k}.png`), fond: url(`fond_${k}.png`) });

/** Rectangle en % : left, top, width, height. */
export interface Box { l: number; t: number; w: number; h: number }
const r4 = (n: number) => Math.round(n * 1000) / 1000;
const box = (l: number, t: number, w: number, h: number): Box => ({ l: r4(l), t: r4(t), w: r4(w), h: r4(h) });

/** Fenêtre en % de la carte. */
export function windowBox(k: string): Box {
  const [x0, y0, x1, y1] = CALQUES[k].fenetre;
  return box(x0 / IMG_W * 100, y0 / IMG_H * 100, (x1 - x0) / IMG_W * 100, (y1 - y0) / IMG_H * 100);
}
/** Rectangle de l'illustration, en % de la fenêtre. */
export function illuBox(k: string): Box {
  const [x0, y0, x1, y1] = CALQUES[k].fenetre, [a0, b0, a1, b1] = CALQUES[k].illu, w = x1 - x0, h = y1 - y0;
  return box((a0 - x0) / w * 100, (b0 - y0) / h * 100, (a1 - a0) / w * 100, (b1 - b0) / h * 100);
}

// Personnages sans bandeau : sans_bandeau.py agrandit la partie de l'illustration au-dessus de l'ancien bandeau
// (y 98 → 690) pour remplir la nouvelle fenêtre (y 98 → 925), recadrée sur un point focal horizontal.
const SB = { X0: 96, Y0: 98, X1: 624, YT: 690, YB: 925 };
const FOCUS: Record<string, number> = { harry: .6, con: .45, bahij: .47 };
/** Position d'une image de la carte entière (720 × 1024, ex. les vidéos des cartes animées) dans la fenêtre, en %
 *  de la fenêtre, pour qu'elle tombe exactement sur l'illustration du calque (même découpe que l'image). */
export function fullCardInWindow(k: string): Box {
  const c = CALQUES[k], [x0, y0, x1, y1] = c.fenetre, w = x1 - x0, h = y1 - y0;
  if (!c.sans_bandeau) return box(-x0 / w * 100, -y0 / h * 100, IMG_W / w * 100, IMG_H / h * 100);
  const W = SB.X1 - SB.X0, H = SB.YB - SB.Y0, s = H / (SB.YT - SB.Y0), nw = Math.round(W * s);
  const ox = Math.min(Math.max((FOCUS[k] ?? .5) * nw - W / 2, 0), nw - W) | 0;
  const sx = SB.X0 + ox / s;           // abscisse source qui tombe au bord gauche de la fenêtre
  return box(-sx * s / W * 100, -SB.Y0 * s / H * 100, IMG_W * s / W * 100, IMG_H * s / H * 100);
}

/** Cartes marines : la mer ondule en variante Vivante (B8). */
export const MER = new Set(['sk', 'mermaid0', 'mermaid1', 'kraken', 'whale', 'escape', 'davy', 'stingray', 'volley']);
