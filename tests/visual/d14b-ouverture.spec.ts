// D14b · Ouverture de booster avec le composant <booster-opening> (docs/boosters/PROMPT-ouverture-composant.md) : parcours
// complet dans le jeu (banc web/banc/ecrans.html, faux serveur en mémoire) et sur la démo autonome, cartes qui montent du
// sachet, mouvement réduit, mode essai ; captures dans docs/captures/ (à valider à l'œil).
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const DEMO = 'http://localhost:5200/docs/boosters/demo/booster-demo.html';
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/captures/${name}.png` });

async function openGame(page: Page, force: string, w = 1280, h = 900, extra = '') {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`/banc/ecrans.html?ecran=boosters&force=${force}${extra}`);
  await page.waitForFunction(() => !!(window as any).banc); await page.evaluate(() => (window as any).banc.ready);
  await page.waitForTimeout(800);
}
/** Coupe au doigt le long des pointillés (départ dans le premier tiers, jusqu'au bout). */
async function cut(page: Page) {
  const z = (await page.locator('booster-opening .cutzone').boundingBox())!, s = z.width / 280, y = z.y + z.height / 2, x0 = z.x + 30 * s;
  await page.mouse.move(x0 + 4, y); await page.mouse.down();
  for (let i = 1; i <= 16; i++) { await page.mouse.move(x0 + 4 + i * (220 * s) / 16, y); await page.waitForTimeout(20); }
  await page.mouse.up();
}
/** Relevés dans la page à 0,4 s, 0,9 s et 1,4 s après la coupe : position et plan de la pile, haut du sachet. */
const sampleRise = (page: Page) => page.evaluate(async () => {
  const sr = document.querySelector('booster-opening')!.shadowRoot!, frame = () => new Promise(r => requestAnimationFrame(r));
  while (!sr.querySelector('.in.opening')) await frame();
  const t0 = performance.now(), out: { at: number; ty: number; z: string; stkTop: number; packTop: number }[] = [];
  for (const at of [400, 900, 1400]) {
    while (performance.now() - t0 < at) await frame();
    const s = sr.querySelector('.stk') as HTMLElement, cs = getComputedStyle(s);
    out.push({ at, ty: new DOMMatrix(cs.transform).m42, z: cs.zIndex, stkTop: s.getBoundingClientRect().top, packTop: sr.querySelector('.in.opening')?.getBoundingClientRect().top ?? NaN });
  }
  return out;
});
/** La pile sort par le haut DERRIÈRE le sachet, puis passe devant pendant qu'il glisse vers le bas (ANIMATIONS.md, §3). */
function expectRise(r: Awaited<ReturnType<typeof sampleRise>>) {
  const [a, b, c] = r;
  expect(a.z, '0,4 s : pile encore derrière le sachet').toBe('1');
  expect(b.z, '0,9 s : pile toujours derrière').toBe('1');
  expect(b.ty, `0,9 s : la pile monte (translateY ${b.ty.toFixed(0)} px)`).toBeLessThan(a.ty - 50);
  expect(c.z, '1,4 s : pile passée devant').toBe('9');
  expect(c.packTop, '1,4 s : le sachet glisse vers le bas').toBeGreaterThan(a.packTop + 20);
}
/** Glisse les 4 premières cartes, retourne la 5e (Numérotée), puis le butin. */
async function pileToRecap(page: Page, prefix: string | null) {
  await expect(page.locator('booster-opening .slot.top .flipw.up')).toHaveCount(1, { timeout: 4000 });
  if (prefix) await shot(page, `${prefix}-4-pile`);
  for (let i = 0; i < 4; i++) {
    const b = (await page.locator('booster-opening .slot.top').boundingBox())!, cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down();
    for (let j = 1; j <= 8; j++) await page.mouse.move(cx + j * 20, cy);
    await page.mouse.up(); await page.waitForTimeout(550);
  }
  await expect(page.locator('booster-opening .slot.top .flipw.hid')).toHaveCount(1);
  if (prefix) await shot(page, `${prefix}-5-carte-de-chance`);
  await page.locator('booster-opening .slot.top').click(); await page.waitForTimeout(1700);
  await expect(page.locator('booster-opening .ban.m')).toHaveText('Numérotée !');
  await expect(page.locator('booster-opening .info')).toContainText('EXEMPLAIRE N°');
  if (prefix) await shot(page, `${prefix}-6-numerotee`);
  await page.locator('booster-opening .slot.top').click(); await page.waitForTimeout(2600);
  await expect(page.locator('booster-opening .grid .gc')).toHaveCount(5);
  if (prefix) await shot(page, `${prefix}-7-butin`);
}

test('jeu : choix, coupe au doigt, cartes qui montent du sachet, pile, Numérotée, butin', async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync('docs/captures', { recursive: true });
  await openGame(page, 'numero');
  await expect(page.locator('booster-opening .pw')).toHaveCount(3);
  await expect(page.locator('booster-opening .pw .pbody').first()).toHaveAttribute('style', /boosters\/sachet_/);
  // nos cartes (calques et variantes) sont rendues dans le composant : les 3 vedettes
  await expect(page.locator('booster-opening .pli-card .card')).toHaveCount(3);
  await shot(page, 'booster-1-choisir');
  await page.locator('booster-opening .go').click(); await page.waitForTimeout(700);
  await shot(page, 'booster-2-couper');
  const rise = sampleRise(page);
  await cut(page);
  // captures pendant la sortie des cartes (le relevé exact, dans la page, est vérifié plus bas)
  const t = Date.now(), at = async (ms: number, n: string) => { await page.waitForTimeout(Math.max(0, ms - (Date.now() - t))); await shot(page, n); };
  await at(400, 'booster-3-ouverture-0.4s'); await at(900, 'booster-3-ouverture-0.9s'); await at(1400, 'booster-3-ouverture-1.4s');
  expectRise(await rise);
  await expect(page.locator('booster-opening .slot.top .pli-card .card')).toHaveCount(1, { timeout: 4000 });
  await pileToRecap(page, 'booster');
});

test('démo autonome : même parcours, mêmes cartes qui montent du sachet', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(DEMO); await page.waitForTimeout(800);
  await page.click('.force button[data-f="m"]');
  await page.locator('booster-opening .go').click(); await page.waitForTimeout(700);
  const rise = sampleRise(page);
  await cut(page);
  const t = Date.now(), at = async (ms: number, n: string) => { await page.waitForTimeout(Math.max(0, ms - (Date.now() - t))); await shot(page, n); };
  await at(400, 'demo-booster-ouverture-0.4s'); await at(900, 'demo-booster-ouverture-0.9s'); await at(1400, 'demo-booster-ouverture-1.4s');
  expectRise(await rise);
  await pileToRecap(page, null);
});

test('booster divin signalé discrètement : paillettes, étoiles, annonce au butin', async ({ page }) => {
  await openGame(page, 'divin');
  await page.locator('booster-opening .go').click(); await page.waitForTimeout(500);
  await page.locator('booster-opening .auto').click(); await page.waitForTimeout(700);
  expect(await page.locator('booster-opening .gsp').count(), '8 paillettes d’or').toBe(8);
  await page.waitForTimeout(1700);
  await expect(page.locator('booster-opening .pdots.dv')).toHaveCount(1);
  await page.locator('booster-opening .skip button').click(); await page.waitForTimeout(1200);
  await expect(page.locator('booster-opening .divb')).toContainText('Booster divin · 1 sur 2 000');
});

test('mouvement réduit : l’ouverture devient un simple fondu, rien ne flotte ni ne tourne', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openGame(page, 'epique');
  const anim = (sel: string) => page.locator(`booster-opening ${sel}`).first().evaluate(e => getComputedStyle(e).animationName);
  expect(await anim('.pw .in'), 'le sachet ne flotte pas').toBe('none');
  await page.locator('booster-opening .go').click(); await page.waitForTimeout(400);
  await page.locator('booster-opening .auto').click();
  await expect(page.locator('booster-opening .in.opening')).toHaveCount(1);
  expect(await anim('.in.opening .lid'), 'la bande ne s’envole pas').toBe('none');
  expect(await anim('.in.opening .lrays'), 'pas de rayons').toBe('none');
  expect(await anim('.stk'), 'la pile apparaît en fondu').toBe('fi');
  // tout s'enchaîne en 300 ms : la pile est là, le sachet retiré
  await expect(page.locator('booster-opening .car')).toHaveCount(0, { timeout: 1000 });
  await expect(page.locator('booster-opening .slot.top .flipw.up')).toHaveCount(1);
});

test('téléphone (390 × 844) : toute la hauteur, pas de défilement horizontal', async ({ page }) => {
  test.setTimeout(90_000);
  await openGame(page, 'numero', 390, 844);
  const box = (await page.locator('booster-opening').boundingBox())!;
  expect(box.y + box.height, 'le composant descend jusqu’en bas de l’écran').toBeGreaterThan(844 - 4);
  const noScroll = async (when: string) => expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `pas de défilement horizontal (${when})`).toBe(false);
  await shot(page, 'booster-mobile-choisir'); await noScroll('choix');
  await page.locator('booster-opening .go').click(); await page.waitForTimeout(600);
  await page.locator('booster-opening .auto').click(); await page.waitForTimeout(2600);
  await shot(page, 'booster-mobile-pile'); await noScroll('pile');
  await page.locator('booster-opening .skip button').click(); await page.waitForTimeout(2600);
  await expect(page.locator('booster-opening .grid .gc')).toHaveCount(5);
  await shot(page, 'booster-mobile-butin'); await noScroll('butin');
});

test('mode essai : ouvertures gratuites et illimitées, sans effet sur la collection ni le porte-monnaie', async ({ page }) => {
  test.setTimeout(90_000);
  await openGame(page, 'epique');
  await expect(page.locator('.bo-essai')).toHaveCount(0);
  await page.goto('/banc/ecrans.html?ecran=boosters&testeur=1');
  await page.waitForFunction(() => !!(window as any).banc); await page.evaluate(() => (window as any).banc.ready);
  await expect(page.locator('a.bo-essai')).toHaveAttribute('href', '#/boosters?essai=1');
  await openGame(page, '', 1280, 900, '&essai=1');
  await expect(page.locator('.bo-essai-tag')).toBeVisible();
  const wallet = await page.locator('#boW').innerText();
  for (let i = 0; i < 2; i++) {
    await page.locator(`booster-opening ${i ? '.again' : '.go'}`).click(); await page.waitForTimeout(500);
    await page.locator('booster-opening .auto').click(); await page.waitForTimeout(2600);
    await page.locator('booster-opening .skip button').click(); await page.waitForTimeout(1500);
    await expect(page.locator('booster-opening .grid .gc')).toHaveCount(5);
  }
  expect(await page.locator('#boW').innerText(), 'porte-monnaie inchangé').toBe(wallet);
  const owned = await page.evaluate(async () => (await (window as any).banc.fakeApi('collection.list')).owned.length);
  expect(owned, 'collection inchangée').toBe(await page.evaluate(() => (window as any).banc.ownedAtStart));
});
