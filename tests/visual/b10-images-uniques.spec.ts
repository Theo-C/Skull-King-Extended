// B10 · Images uniques à jour (docs/cartes-couches/PROMPT-B10-images-uniques.md, point 5) : l'image unique cards/<clé>.webp
// (aplatir_cartes.py) montre la même carte que la version en couches au repos, nouvelle illustration comprise.
import { test, expect } from '@playwright/test';
import { openBanc, png, diff } from './outils';

// g7 : les cartes de couleur partagent l'illustration de leur famille (calque suit-green pour le 7 vert)
const CARTES: [string, string][] = [['rosie', 'rosie'], ['g7', 'suit-green'], ['kraken', 'kraken']];

test('image unique = carte en couches au repos (< 1 % de pixels, même taille)', async ({ page }) => {
  await openBanc(page);
  const keys = CARTES.map(([, k]) => k);
  await page.evaluate(keys => { const b = (window as any).banc; b.render({ keys, still: true }); b.render({ keys, flat: true, still: true }); }, keys);
  await page.evaluate(() => (window as any).banc.ready());
  const rows = page.locator('.row'), out: string[] = [];
  for (const [nom, k] of CARTES) {
    const a = png(await rows.nth(0).locator(`.cell[data-k="${k}"] .card`).screenshot());
    const b = png(await rows.nth(1).locator(`.cell[data-k="${k}"] .card`).screenshot());
    // seuil 0,2 de pixelmatch : la recompression WebP de l'image unique ne compte pas, un décalage ou une autre illustration si
    const d = diff(a, b, .2);
    out.push(`${nom} ${(d * 100).toFixed(2)} %`);
    expect(d, `${nom} : ${(d * 100).toFixed(2)} % de pixels différents`).toBeLessThan(.01);
  }
  console.log(out.join(' · '));
});
