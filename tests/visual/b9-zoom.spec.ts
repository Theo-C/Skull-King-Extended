// B9 · Zoom identique dans toutes les variantes (docs/cartes-couches/SPEC.md, « Zoom identique pour toutes les variantes ») :
// l'illustration a la même taille partout ; seule la Vivante (et la Numérotée, qui l'inclut) bouge, avec un zoom de
// 2 à 3,5 % et un déplacement d'1 % au plus (le personnage : 2,5 à 3 %).
import { test, expect } from '@playwright/test';
import { openBanc } from './outils';

const VARIANTS = ['std', 'patine', 'etain', 'holo', 'vivante', 'nacre', 'signee', 'numero'];
const KEYS = ['rosie', 'sk', 'suit-green', 'kraken', 'whale', 'wild'];

test('l’illustration a la même taille dans toutes les variantes ; la Vivante zoome de 2 à 3,5 %', async ({ page }) => {
  await openBanc(page);
  await page.evaluate(([vs, ks]) => { const b = (window as any).banc; for (const v of vs) b.render({ keys: ks, variant: v, label: v }); }, [VARIANTS, KEYS] as const);
  await page.evaluate(() => (window as any).banc.ready());
  // échantillonne l'animation (10 s aller, 10 s retour) en la positionnant à la main
  const res = await page.evaluate(([vs, ks]) => {
    const rows = [...document.querySelectorAll('.row')], out: { v: string; k: string; part: string; t: number; sx: number; sy: number; dx: number; dy: number }[] = [];
    const box = (el: Element) => el.getBoundingClientRect();
    for (let r = 0; r < vs.length; r++) for (const k of ks) {
      const cell = rows[r].querySelector(`.cell[data-k="${k}"]`)!, ref = rows[0].querySelector(`.cell[data-k="${k}"] .mv.bg`)!;
      const rb = box(ref), rc = box(rows[0].querySelector(`.cell[data-k="${k}"] .card`)!), cc = box(cell.querySelector('.card')!);
      for (const part of ['.mv.bg', '.mv.fgm']) {
        const el = cell.querySelector(part); if (!el) continue;
        for (const t of [0, 2500, 5000, 7500, 10000, 15000]) {
          el.getAnimations().forEach(a => { a.pause(); a.currentTime = t; });
          const b = box(el);
          out.push({ v: vs[r], k, part, t, sx: b.width / rb.width, sy: b.height / rb.height,
            dx: ((b.left + b.width / 2 - cc.left) - (rb.left + rb.width / 2 - rc.left)) / rb.width, dy: ((b.top + b.height / 2 - cc.top) - (rb.top + rb.height / 2 - rc.top)) / rb.height });
        }
      }
    }
    return out;
  }, [VARIANTS, KEYS] as const);
  const lim = { '.mv.bg': [1.02, 1.035], '.mv.fgm': [1.025, 1.03] } as Record<string, [number, number]>, eps = .0015;
  for (const m of res) {
    const label = `${m.v} · ${m.k} · ${m.part} à ${m.t} ms : ×${m.sx.toFixed(4)}, décalage ${(m.dx * 100).toFixed(2)} % / ${(m.dy * 100).toFixed(2)} %`;
    expect(Math.abs(m.sx - m.sy), label).toBeLessThan(eps);
    if (m.v === 'vivante' || m.v === 'numero') {
      const [a, b] = lim[m.part];
      expect(m.sx, label).toBeGreaterThanOrEqual(a - eps); expect(m.sx, label).toBeLessThanOrEqual(b + eps);
      expect(Math.abs(m.dx), label).toBeLessThanOrEqual(.01 + eps); expect(Math.abs(m.dy), label).toBeLessThanOrEqual(.01 + eps);
    } else {
      expect(Math.abs(m.sx - 1), label).toBeLessThan(eps);
      expect(Math.abs(m.dx) + Math.abs(m.dy), label).toBeLessThan(eps);
    }
  }
  expect(res.filter(m => m.v === 'vivante').length).toBeGreaterThan(0);
});
