// D15 · Atelier (docs/boosters/ATELIER.md) : parcours sur le banc web/banc/ecrans.html (faux serveur en mémoire) et
// captures dans docs/captures/ (à valider à l'œil).
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

async function open(page: Page, w = 1440, h = 1000, extra = '') {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/banc/ecrans.html?ecran=atelier' + extra);
  await page.waitForFunction(() => !!(window as any).banc); await page.evaluate(() => (window as any).banc.ready);
  await page.waitForTimeout(700);
}
const shards = (page: Page) => page.$eval('.at-w .sh', e => Number(e.textContent!.replace(/\D/g, '')));

test('au hasard : une variante qu’on n’avait pas, au prix de base', async ({ page }) => {
  test.setTimeout(90_000);
  mkdirSync('docs/captures', { recursive: true });
  await open(page);
  await page.locator('.at').screenshot({ path: 'docs/captures/atelier-1-hasard.png' });
  const before = await shards(page);
  const ownedHolo = await page.evaluate(async () => ((await (window as any).banc.fakeApi('collection.list')).owned as any[]).filter(o => o.variant === 'holo').map(o => o.card_id));
  await page.click('[data-tier="r"]'); await page.click('#forgeR');
  await page.waitForTimeout(800); await page.locator('.at').screenshot({ path: 'docs/captures/atelier-2-forge.png' });
  await expect(page.locator('.at-res .new')).toBeVisible({ timeout: 6000 });
  await page.locator('.at').screenshot({ path: 'docs/captures/atelier-3-nouveau.png' });
  expect(before - await shards(page), 'Holo au hasard : 80 éclats').toBe(80);
  const nowHolo = await page.evaluate(async () => ((await (window as any).banc.fakeApi('collection.list')).owned as any[]).filter(o => o.variant === 'holo').map(o => o.card_id));
  const fresh = nowHolo.filter((c: string) => !ownedHolo.includes(c));
  expect(fresh.length, 'une Holo nouvelle, jamais un doublon').toBe(1);
  await expect(page.locator('#forgeR')).toContainText('Encore une');
});

test('au choix : 4 fois le prix de base ; recycler tous les doublons', async ({ page }) => {
  await open(page, 1440, 1000, '&carte=sk&variante=nacre');
  await expect(page.locator('.at-pr .x4')).toContainText('au hasard : 240');
  await expect(page.locator('.at-pr .price')).toContainText('960');
  await page.locator('.at').screenshot({ path: 'docs/captures/atelier-4-au-choix.png' });
  const before = await shards(page);
  await page.click('#forgeP'); await page.waitForTimeout(2000);
  await expect(page.locator('#forgeP')).toContainText('Fabriquée');
  expect(before - await shards(page)).toBe(960);
  // Numérotée : absente des variantes fabricables
  await expect(page.locator('.vchip[data-v="numero"]')).toHaveCount(0);
  const rec = page.locator('#recAll');
  if (await rec.isEnabled()) { await rec.click(); await page.waitForTimeout(600); }
  await expect(page.locator('#recAll')).toBeDisabled();
  await expect(page.locator('#recAll')).toHaveText('Plus aucun doublon');
});

test('téléphone (390 × 844)', async ({ page }) => {
  await open(page, 390, 844);
  await page.screenshot({ path: 'docs/captures/atelier-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'pas de défilement horizontal').toBe(false);
});
