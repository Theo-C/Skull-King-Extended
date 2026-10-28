// B8 · Personnages sans bandeau, masques d'effets, variantes (docs/cartes-couches/PROMPT-B8-claude-code.md, point 5).
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openBanc, png, strictDiff, keep, winPx, type Banc, type Img } from './outils';

const FACE_W = 252, LAY_H = 358.4, LAY_TOP = -3.2;
const px = (img: Img, i: number) => [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]];
const delta = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** Rend std puis la variante (immobiles, s = 1) et renvoie les captures de chaque carte. */
async function pair(page: Page, banc: Banc, variant: string) {
  await page.evaluate(v => { const b = (window as any).banc; b.clear(); b.render({ still: true }); b.render({ variant: v, still: true }); }, variant);
  await page.evaluate(() => (window as any).banc.ready());
  const rows = page.locator('.row'), out: Record<string, [Img, Img]> = {};
  for (const k of banc.keys) out[k] = [png(await rows.nth(0).locator(`.cell[data-k="${k}"] .card`).screenshot()), png(await rows.nth(1).locator(`.cell[data-k="${k}"] .card`).screenshot())];
  return out;
}

for (const variant of ['patine', 'etain', 'nacre']) {
  test(`${variant} : aucun pixel blanc de la marge d’origine ne reste blanc`, async ({ page }) => {
    const banc = await openBanc(page), shots = await pair(page, banc, variant), out: string[] = [];
    for (const k of banc.keys) {
      const [std, v] = shots[k];
      const mk = await page.evaluate(([u, r]) => (window as any).banc.maskPx(u, r), [banc.masks[k].marge, [0, LAY_TOP, FACE_W, LAY_H]] as const);
      let white = 0, kept = 0;
      for (let i = 0; i < mk.length; i++) {
        if (mk[i] < 200) continue;
        const a = px(std, i); if (Math.min(...a) < 215) continue;
        white++; if (delta(a, px(v, i)) < 9) kept++;
      }
      out.push(`${k} ${kept}/${white}`);
      expect(white, `${k} : marge trouvée`).toBeGreaterThan(1000);
      expect(kept / white, `${k} : ${kept} pixels blancs inchangés sur ${white}`).toBeLessThan(.01);
    }
    console.log(variant, out.join(' · '));
  });
}

test('holo : le personnage (hors masque foil_) diffère de moins de 2 % de la Standard', async ({ page }) => {
  const banc = await openBanc(page), shots = await pair(page, banc, 'holo'), out: string[] = [];
  for (const k of banc.keys) {
    const [std, v] = shots[k], w = winPx(banc, k), ib = banc.illus[k];
    const r = [w[0] + ib.l / 100 * w[2], w[1] + ib.t / 100 * w[3], ib.w / 100 * w[2], ib.h / 100 * w[3]];
    const fo = await page.evaluate(([u, rr]) => (window as any).banc.maskPx(u, rr), [banc.masks[k].foil, r] as const);
    let n = 0, changed = 0;
    for (let y = w[1] + 3; y < w[1] + w[3] - 3; y++) for (let x = w[0] + 3; x < w[0] + w[2] - 3; x++) {
      const i = y * FACE_W + x; if (fo[i] > 8) continue;
      n++; if (delta(px(std, i), px(v, i)) > 24) changed++;
    }
    out.push(`${k} ${(changed / n * 100).toFixed(2)} %`);
    expect(changed / n, `${k} : ${changed} pixels du personnage modifiés sur ${n}`).toBeLessThan(.02);
  }
  console.log('holo', out.join(' · '));
});

test('vivante : les pixels hors fenêtre sont identiques à 0 s et 4 s', async ({ page }) => {
  const banc = await openBanc(page), keys = ['rosie', 'sk', 'mermaid0', 'suit-black', 'kraken', 'whale', 'stingray', 'bahij'];
  await page.evaluate(k => (window as any).banc.render({ keys: k, variant: 'vivante' }), keys);
  await page.evaluate(() => (window as any).banc.ready());
  const cells = page.locator('.cell'), t0: Buffer[] = [];
  for (let i = 0; i < keys.length; i++) t0.push(await cells.nth(i).locator('.card').screenshot());
  await page.waitForTimeout(4000);
  for (let i = 0; i < keys.length; i++) {
    const a = png(t0[i]), b = png(await cells.nth(i).locator('.card').screenshot()), r = winPx(banc, keys[i], 5);
    expect(strictDiff(keep(a, r, true), keep(b, r, true)), `${keys[i]} : l’illustration doit bouger`).toBeGreaterThan(0);
    expect(strictDiff(keep(a, r, false), keep(b, r, false)), `${keys[i]} : pixels hors fenêtre modifiés`).toBe(0);
  }
});

test('planche « 8 variantes × chaque famille » à 56 et 40 px (et deutéranopie), à valider à l’œil', async ({ page }) => {
  await openBanc(page);
  mkdirSync('docs/captures', { recursive: true });
  await page.addStyleTag({ content: '.p40 .prow{--cw:40px}' });
  // filtre de deutéranopie (Machado 2009, sévérité 1)
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute"><filter id="deut"><feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0 0.280 0.673 0.047 0 0 -0.012 0.043 0.969 0 0 0 0 0 1 0"/></filter></svg>'));
  await page.evaluate(() => { const b = (window as any).banc; b.planche({ w: 56, still: true }); b.planche({ w: 40, still: true }).classList.add('p40'); b.planche({ w: 56, still: true }).style.filter = 'url(#deut)'; });
  await page.evaluate(() => (window as any).banc.ready());
  const p = page.locator('.planche');
  await p.nth(0).screenshot({ path: 'docs/captures/planche-variantes-56.png' });
  await p.nth(1).screenshot({ path: 'docs/captures/planche-variantes-40.png' });
  await p.nth(2).screenshot({ path: 'docs/captures/planche-variantes-56-deuteranopie.png' });
});

test('réglage système « réduire les animations » ignoré : seule l’option « Cartes figées » fige les variantes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openBanc(page);
  await page.evaluate(() => (window as any).banc.render({ keys: ['rosie'], variant: 'vivante' }));
  const bg = page.locator('.cell[data-k="rosie"] .art.vivante .bg').first();
  expect(await bg.evaluate(e => getComputedStyle(e).animationName), 'Vivante animée malgré le réglage système').toBe('k4bb');
  await page.evaluate(() => document.documentElement.classList.add('cartes-figees'));
  expect(await bg.evaluate(e => getComputedStyle(e).animationName), 'Cartes figées : immobile').toBe('none');
});
