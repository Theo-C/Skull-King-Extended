// D14b · Ouverture de booster (docs/boosters/OUVERTURE.md) : parcours complet sur le banc web/banc/ecrans.html (faux
// serveur en mémoire), règles anti-spoil, et captures dans docs/captures/ (à valider à l'œil).
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const shot = (page: Page, name: string) => page.locator('.bo').screenshot({ path: `docs/captures/booster-${name}.png` });
async function open(page: Page, force: string, w = 1280, h = 1000) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`/banc/ecrans.html?ecran=boosters&force=${force}`);
  await page.waitForFunction(() => !!(window as any).banc); await page.evaluate(() => (window as any).banc.ready);
  await page.waitForTimeout(600);
}

test('ouverture complète : coupe au doigt, pile, carte de chance, Numérotée, butin', async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync('docs/captures', { recursive: true });
  await open(page, 'numero');
  // lumière dorée identique pour les 3 boosters (aucun indice sur le contenu)
  const glows = await page.$$eval('.pw', els => els.map(e => getComputedStyle(e).getPropertyValue('--glow').trim()));
  expect(new Set(glows).size, 'même lumière pour tous les boosters').toBe(1);
  await shot(page, '1-choisir');
  await page.click('#bOpen'); await page.waitForTimeout(600);
  // coupe : lâcher avant 92 % → la ligne se rétracte
  const z = (await page.locator('#cutZ').boundingBox())!, y = z.y + z.height / 2;
  await page.mouse.move(z.x + 40, y); await page.mouse.down();
  for (let i = 0; i <= 5; i++) { await page.mouse.move(z.x + 40 + i * 25, y); await page.waitForTimeout(25); }
  await shot(page, '2-couper');
  await page.mouse.up(); await page.waitForTimeout(400);
  expect(await page.$eval('#cutL', e => (e as HTMLElement).style.width), 'lâcher avant la fin : retour à 0').toBe('0px');
  // coupe complète
  await page.mouse.move(z.x + 40, y); await page.mouse.down();
  for (let i = 0; i <= 14; i++) { await page.mouse.move(z.x + 40 + i * (z.width - 70) / 14, y); await page.waitForTimeout(25); }
  await page.mouse.up();
  await page.waitForTimeout(700); await shot(page, '3-ouverture');
  await page.waitForTimeout(1500);
  await expect(page.locator('#bTop .flipw.up')).toHaveCount(1);
  await shot(page, '4-pile');
  // cartes 1 à 4 face visible, glissées sur le côté ; la 5e arrive face cachée
  for (let i = 0; i < 4; i++) {
    const b = (await page.locator('#bTop').boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 140, b.y + b.height / 2, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(550);
  }
  await expect(page.locator('#bTop .flipw.hid')).toHaveCount(1);
  await shot(page, '5-carte-de-chance');
  await page.click('#bTop'); await page.waitForTimeout(1700);
  await expect(page.locator('.ban.m')).toHaveText('Numérotée !');
  await expect(page.locator('.info .ex')).toContainText('/ 10');
  await shot(page, '6-numerotee');
  await page.click('#bTop'); await page.waitForTimeout(2600);
  await expect(page.locator('.bo-grid figure')).toHaveCount(5);
  await shot(page, '7-butin');
});

test('booster divin signalé discrètement : paillettes à l’ouverture, étoiles, annonce au butin', async ({ page }) => {
  await open(page, 'divin');
  await page.click('#bOpen'); await page.waitForTimeout(500); await page.click('#bAuto'); await page.waitForTimeout(500);
  expect(await page.locator('.gsp').count(), '8 paillettes d’or').toBe(8);
  await page.waitForTimeout(1700);
  await expect(page.locator('.pdots.dv')).toHaveCount(1);
  await page.click('#bSkip'); await page.waitForTimeout(1200);
  await expect(page.locator('.divb')).toContainText('Booster divin · 1 sur 2 000');
});

test('téléphone (390 × 844) : scène étroite presque à taille réelle, à chaque étape', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, 'numero', 390, 844);
  // scène téléphone (400 × 820) : réduite à 85 % au plus, contre 53 % pour la scène de 680 px
  await expect(page.locator('#boS.m')).toHaveCount(1);
  const k = await page.$eval('#boS', e => (e as HTMLElement).getBoundingClientRect().width / 400);
  expect(k, `échelle de la scène : ${k.toFixed(2)}`).toBeGreaterThan(.85);
  const mshot = (name: string) => page.screenshot({ path: `docs/captures/booster-mobile-${name}.png` });
  const noScroll = async (when: string) => expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `pas de défilement horizontal (${when})`).toBe(false);
  await mshot('choisir'); await noScroll('choix');
  await page.click('#bOpen'); await page.waitForTimeout(700);
  await mshot('couper');
  await page.click('#bAuto'); await page.waitForTimeout(2600);
  await expect(page.locator('#bTop')).toHaveCount(1);
  await mshot('pile'); await noScroll('pile');
  for (let i = 0; i < 4; i++) { await page.click('#bTop'); await page.waitForTimeout(550); }
  await page.click('#bTop'); await page.waitForTimeout(1700);
  await expect(page.locator('.ban.m')).toHaveText('Numérotée !');
  await mshot('numerotee');
  await page.click('#bTop'); await page.waitForTimeout(2600);
  await expect(page.locator('.bo-grid figure')).toHaveCount(5);
  await mshot('butin'); await noScroll('butin');
  // le butin tient dans la scène : ses boutons ne dépassent pas du bas
  const [btn, st] = await Promise.all([page.locator('#bColl').boundingBox(), page.locator('#boS').boundingBox()]);
  expect(btn!.y + btn!.height, 'boutons du butin dans la scène').toBeLessThanOrEqual(st!.y + st!.height + 1);
});

test('mode essai : ouvertures gratuites et illimitées, sans effet sur la collection ni le porte-monnaie', async ({ page }) => {
  test.setTimeout(90_000);
  // sans le droit de testeur : pas de bouton ; avec : bouton « Essai gratuit » qui mène au mode essai
  await open(page, 'epique');
  await expect(page.locator('.bo-essai')).toHaveCount(0);
  await page.goto('/banc/ecrans.html?ecran=boosters&testeur=1');
  await page.waitForFunction(() => !!(window as any).banc); await page.evaluate(() => (window as any).banc.ready);
  await expect(page.locator('a.bo-essai')).toHaveAttribute('href', '#/boosters?essai=1');
  await page.goto('/banc/ecrans.html?ecran=boosters&essai=1');
  await page.waitForFunction(() => !!(window as any).banc); await page.evaluate(() => (window as any).banc.ready);
  await page.waitForTimeout(400);
  await expect(page.locator('.bo-essai-tag')).toBeVisible();
  await expect(page.locator('#bOpen')).toContainText('essai gratuit');
  const wallet = await page.locator('#boW').innerText();
  for (let i = 0; i < 2; i++) {
    await page.click(i ? '#bAgain' : '#bOpen'); await page.waitForTimeout(500); await page.click('#bAuto'); await page.waitForTimeout(2600);
    await page.click('#bSkip'); await page.waitForTimeout(2600);
    await expect(page.locator('.bo-grid figure')).toHaveCount(5);
    await expect(page.locator('.bo-sum .nw')).toContainText('+0');
  }
  expect(await page.locator('#boW').innerText(), 'porte-monnaie inchangé').toBe(wallet);
  // collection du faux serveur inchangée : booster.open n'a jamais été appelé
  const owned = await page.evaluate(async () => (await (window as any).banc.fakeApi('collection.list')).owned.length);
  const before = await page.evaluate(() => (window as any).banc.ownedAtStart);
  expect(owned, 'collection inchangée').toBe(before);
});
