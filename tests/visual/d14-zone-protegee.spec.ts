// D14 · Règle n° 1 (docs/boosters/SPEC.md) : aucune variante ne modifie la zone protégée, c'est-à-dire tout ce qui n'est
// ni la fenêtre d'illustration ni la marge (masque marge_<clé>.png) : cadre peint, médaillons, volutes.
import { test, expect } from '@playwright/test';
import { openBanc, png, winPx, type Img } from './outils';

const VARIANTS = ['patine', 'etain', 'holo', 'vivante', 'nacre', 'signee', 'numero'];

test('aucune variante ne touche au cadre ni aux médaillons (hors fenêtre et hors marge)', async ({ page }) => {
  test.setTimeout(240_000);
  const banc = await openBanc(page), out: string[] = [];
  await page.evaluate(vs => { const b = (window as any).banc; b.render({ still: true }); for (const v of vs) b.render({ variant: v, still: true, serial: 42 }); }, VARIANTS);
  await page.evaluate(() => (window as any).banc.ready());
  const rows = page.locator('.row');
  for (const k of banc.keys) {
    const mk: number[] = await page.evaluate(([u]) => (window as any).banc.maskPx(u, [0, -3.2, 252, 358.4]), [banc.masks[k].marge] as const);
    const w = winPx(banc, k, 4), std = png(await rows.nth(0).locator(`.cell[data-k="${k}"] .card`).screenshot());
    // Écart toléré : le cadre réduit (720 → 252 px) est rééchantillonné un peu autrement quand la carte est composée à part
    // (calque multiply de la marge) ; cela fait des colonnes d'écarts faibles tous les 7 px, pas une recoloration.
    // Une teinte ou un recouvrement du cadre changerait au contraire la plupart des pixels, et fortement.
    // zone protégée : hors fenêtre (bord adouci compris), hors marge (même légèrement couverte), hors coins arrondis
    const prot = (x: number, y: number) => !(x >= w[0] && x < w[0] + w[2] && y >= w[1] && y < w[1] + w[3]) && mk[y * 252 + x] < 3 && x > 6 && x < 246 && y > 6 && y < 346;
    for (let r = 0; r < VARIANTS.length; r++) {
      const v: Img = png(await rows.nth(r + 1).locator(`.cell[data-k="${k}"] .card`).screenshot());
      let n = 0, diff = 0;
      for (let y = 0; y < std.height; y++) for (let x = 0; x < std.width; x++) {
        if (!prot(x, y)) continue; n++;
        const i = (y * std.width + x) * 4;
        if (Math.abs(std.data[i] - v.data[i]) + Math.abs(std.data[i + 1] - v.data[i + 1]) + Math.abs(std.data[i + 2] - v.data[i + 2]) > 24) diff++;
      }
      if (diff) out.push(`${k}/${VARIANTS[r]} ${diff}/${n}`);
      expect(n, `${k} : zone protégée trouvée`).toBeGreaterThan(2000);
      expect(diff / n, `${k} · ${VARIANTS[r]} : ${diff} pixels protégés modifiés sur ${n}`).toBeLessThan(.005);
    }
  }
  console.log(out.join(' · ') || 'aucun pixel protégé modifié');
});
