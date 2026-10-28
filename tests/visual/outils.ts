// Outils des tests visuels : décodage des captures et comparaison de pixels.
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { Page } from '@playwright/test';

export type Img = { width: number; height: number; data: Buffer };
export const png = (buf: Buffer): Img => PNG.sync.read(buf);

/** Rectangle en pixels (x, y, largeur, hauteur). */
export type R = [number, number, number, number];
/** Garde les pixels du rectangle (dedans = true) ou hors du rectangle (dedans = false) ; les autres deviennent noirs. */
export function keep(img: Img, r: R, dedans: boolean): Img {
  const out = { width: img.width, height: img.height, data: Buffer.from(img.data) };
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const inR = x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
    if (inR !== dedans) { const i = (y * img.width + x) * 4; out.data[i] = out.data[i + 1] = out.data[i + 2] = 0; out.data[i + 3] = 255; }
  }
  return out;
}
/** Met en noir une bande autour du bord d'un rectangle (de r agrandi de m à r réduit de m). */
export function maskBand(img: Img, r: R, m: number): Img {
  const out = { width: img.width, height: img.height, data: Buffer.from(img.data) };
  const inside = (x: number, y: number, d: number) => x >= r[0] - d && x < r[0] + r[2] + d && y >= r[1] - d && y < r[1] + r[3] + d;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (inside(x, y, m) && !inside(x, y, -m)) {
    const i = (y * img.width + x) * 4; out.data[i] = out.data[i + 1] = out.data[i + 2] = 0; out.data[i + 3] = 255;
  }
  return out;
}
/** Part des pixels différents (0 à 1) ; threshold de pixelmatch (0 = strict). */
export function diff(a: Img, b: Img, threshold = .1): number {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`tailles différentes : ${a.width}×${a.height} / ${b.width}×${b.height}`);
  const n = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold, includeAA: true });
  return n / (a.width * a.height);
}
/** Nombre de pixels qui ne sont pas exactement identiques. */
export function strictDiff(a: Img, b: Img): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++;
  return n;
}
export interface Banc { keys: string[]; calques: Record<string, { sans_bandeau?: boolean }>; windows: Record<string, { l: number; t: number; w: number; h: number }> }
export async function openBanc(page: Page): Promise<Banc> {
  await page.goto('/banc/cartes.html');
  await page.waitForFunction(() => !!(window as any).banc);
  return page.evaluate(() => { const b = (window as any).banc; return { keys: b.keys, calques: b.calques, windows: b.windows }; });
}
const FACE_W = 252, LAY_H = 358.4, LAY_TOP = -3.2;
/** Fenêtre d'une carte en pixels de la face (s = 1), agrandie de m px de chaque côté (bord adouci du cadre). */
export function winPx(b: Banc, k: string, m = 0, s = 1): R {
  const w = b.windows[k];
  return [Math.floor((w.l / 100 * FACE_W - m) * s), Math.floor((w.t / 100 * LAY_H + LAY_TOP - m) * s), Math.ceil((w.w / 100 * FACE_W + 2 * m) * s), Math.ceil((w.h / 100 * LAY_H + 2 * m) * s)];
}
