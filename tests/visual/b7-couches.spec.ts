// B7 · Cartes en couches (docs/cartes-couches/PROMPT-claude-code.md, point 6).
import { test, expect } from '@playwright/test';
import { openBanc, png, diff, keep, maskBand, strictDiff, winPx, type R } from './outils';

test('au repos, la carte en couches est identique à l’image d’origine (< 1 % de pixels)', async ({ page }) => {
  const banc = await openBanc(page);
  await page.evaluate(() => { const b = (window as any).banc; b.render({}); b.render({ flat: true }); b.render({ cadre: true }); });
  await page.evaluate(() => (window as any).banc.ready());
  const rows = page.locator('.row');
  const out: string[] = [];
  for (const k of banc.keys) {
    const sb = banc.calques[k].sans_bandeau;
    const a = png(await rows.nth(0).locator(`.cell[data-k="${k}"] .card`).screenshot());
    // Personnages sans bandeau : leurs calques viennent d'illustrations plus récentes que cards/<clé>.webp et n'ont
    // plus de parchemin du nom (B8) ; la référence est le calque cadre lui-même, comparé hors de la fenêtre.
    const b = png(await rows.nth(sb ? 2 : 1).locator(`.cell[data-k="${k}"] .card`).screenshot());
    // le bord de la fenêtre est adouci sur 1,5 px dans le calque (SPEC) : on ne compte pas cette bande de 3 px ;
    // seuil 0,2 : la recompression de l'illustration (JPEG) ne compte pas, un décalage d'un pixel si
    const r: R = sb ? winPx(banc, k, 5) : [0, 0, 0, 0], w = winPx(banc, k);
    const d = diff(maskBand(keep(a, r, false), w, 3), maskBand(keep(b, r, false), w, 3), .2);
    out.push(`${k} ${(d * 100).toFixed(2)} %`);
    expect(d, `${k} : ${(d * 100).toFixed(2)} % de pixels différents`).toBeLessThan(.01);
  }
  console.log(out.join(' · '));
});

test('animation : les pixels hors de la fenêtre ne bougent pas (0 s et 4 s)', async ({ page }) => {
  const banc = await openBanc(page);
  // mouvement de la Vivante (zoom 1,02 → 1,035, déplacement d'1 %) sur l'illustration, et vidéos des cartes animées
  await page.addStyleTag({ content: '.viv .mv{animation:kbt 4s linear both}@keyframes kbt{from{transform:scale(1.02) translate(.6%,0)}to{transform:scale(1.035) translate(-1%,.5%)}}' });
  await page.evaluate(() => { const b = (window as any).banc; b.render({ keys: ['rosie', 'suit-green', 'whale'], extra: 'viv' }); b.render({ keys: ['kraken', 'sk', 'mermaid0'], anim: true }); });
  await page.evaluate(() => (window as any).banc.ready());
  const cells = page.locator('.cell');
  const n = await cells.count(), t0: Buffer[] = [];
  for (let i = 0; i < n; i++) t0.push(await cells.nth(i).locator('.card').screenshot());
  await page.waitForTimeout(4000);
  for (let i = 0; i < n; i++) {
    const k = (await cells.nth(i).getAttribute('data-k'))!;
    const a = png(t0[i]), b = png(await cells.nth(i).locator('.card').screenshot());
    const r = winPx(banc, k, 5);
    expect(diff(keep(a, r, true), keep(b, r, true), 0), `${k} : la fenêtre doit bouger`).toBeGreaterThan(0);
    expect(strictDiff(keep(a, r, false), keep(b, r, false)), `${k} : pixels hors fenêtre modifiés`).toBe(0);
  }
});
