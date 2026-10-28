// D14b · Fluidité de l'ouverture avec le composant <booster-opening> (docs/boosters/ANIMATIONS.md, section 7) : téléphone émulé, processeur 4 fois plus lent.
// Ouverture complète d'un booster avec moins de 5 % d'images perdues, aucune tâche de plus de 50 ms pendant la coupe et le
// glisser de la pile. Trace de performance dans tests/visual/.resultats/, vidéo dans docs/captures/booster-ouverture-mobile.webm.
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, video: { mode: 'on', size: { width: 390, height: 844 } } });

/** Compteur d'images (requestAnimationFrame) et tâches longues, installés avant le chargement de la page. */
const probe = () => {
  const w = window as any; w.__frames = [] as number[]; w.__long = [] as { t: number; d: number }[];
  const tick = (t: number) => { w.__frames.push(t); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  try { new PerformanceObserver(l => l.getEntries().forEach(e => w.__long.push({ t: e.startTime, d: e.duration }))).observe({ type: 'longtask', buffered: true }); } catch { /* non disponible */ }
};
const now = (page: Page) => page.evaluate(() => performance.now());
/** Part des images perdues entre t0 et t1 : chaque intervalle de plus d'une image (16,7 ms) compte les images sautées. */
const lostFrames = (page: Page, t0: number, t1: number) => page.evaluate(([a, b]) => {
  const f = ((window as any).__frames as number[]).filter(t => t >= a && t <= b), F = 1000 / 60;
  let expected = 0, lost = 0;
  for (let i = 1; i < f.length; i++) { const n = Math.max(1, Math.round((f[i] - f[i - 1]) / F)); expected += n; lost += n - 1; }
  return { lost: expected ? lost / expected : 1, frames: f.length };
}, [t0, t1]);
const longTasks = (page: Page, t0: number, t1: number) => page.evaluate(([a, b]) => ((window as any).__long as { t: number; d: number }[]).filter(e => e.t + e.d >= a && e.t <= b && e.d > 50), [t0, t1]);

// deux cibles mesurées dans les mêmes conditions : l'écran du jeu (nos cartes rendues dans le composant) et la démo autonome
// du composant (référence) ; un écart entre les deux viendrait de notre intégration, pas du composant
const CIBLES = [
  { nom: 'jeu', video: true, ouvrir: async (page: Page) => { await page.goto('/banc/ecrans.html?ecran=boosters&force=numero'); await page.waitForFunction(() => !!(window as any).banc); await page.evaluate(() => (window as any).banc.ready); } },
  { nom: 'démo', video: false, ouvrir: async (page: Page) => { await page.goto('http://localhost:5200/docs/boosters/demo/booster-demo.html'); await page.click('.force button[data-f="m"]'); } },
];
for (const cible of CIBLES) test(`${cible.nom} : ouverture fluide sur téléphone (CPU ×4), < 5 % d’images perdues, aucune tâche > 50 ms pendant les gestes`, async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  mkdirSync('docs/captures', { recursive: true });
  await page.addInitScript(probe);
  await cible.ouvrir(page);
  await page.waitForTimeout(800);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await browser.startTracing(page, { path: info.outputPath('trace-ouverture.json'), screenshots: true });

  // carrousel : un voisin devient le centre en glissant (transition .55 s, rien n'est recréé)
  const pws = page.locator('booster-opening .pw'), before = await pws.count();
  await pws.nth(1).click(); await page.waitForTimeout(150);
  const mid = await pws.nth(1).evaluate(e => getComputedStyle(e).transform);
  await page.waitForTimeout(900);
  const end = await pws.nth(1).evaluate(e => getComputedStyle(e).transform);
  expect(await pws.count(), 'mêmes sachets (non recréés)').toBe(before);
  expect(mid, 'à 150 ms, le sachet est encore en mouvement').not.toBe(end);

  const tStart = await now(page);
  await page.locator('booster-opening .go').click(); await page.waitForTimeout(900);
  // coupe au doigt, lente et régulière
  const z = (await page.locator('booster-opening .cutzone').boundingBox())!, y = z.y + z.height / 2, s = z.width / 280, x0 = z.x + 30 * s + 4;
  const tCut0 = await now(page);
  await page.mouse.move(x0, y); await page.mouse.down();
  for (let i = 0; i <= 24; i++) { await page.mouse.move(x0 + i * (220 * s) / 24, y); await page.waitForTimeout(30); }
  await page.mouse.up();
  const tCut1 = await now(page);
  await page.waitForTimeout(2600);
  await expect(page.locator('booster-opening .slot.top .flipw.up')).toHaveCount(1);
  // glisser de la pile : 4 cartes envoyées sur le côté
  const tDrag0 = await now(page);
  for (let i = 0; i < 4; i++) {
    const b = (await page.locator('booster-opening .slot.top').boundingBox())!, cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down();
    for (let j = 1; j <= 10; j++) { await page.mouse.move(cx + j * 16, cy); await page.waitForTimeout(16); }
    await page.mouse.up(); await page.waitForTimeout(600);
  }
  const tDrag1 = await now(page);
  // 5e carte : retournement (1,1 s) puis butin
  await page.locator('booster-opening .slot.top').click(); await page.waitForTimeout(1800);
  await expect(page.locator('booster-opening .ban.m')).toHaveText('Numérotée !');
  await page.locator('booster-opening .slot.top').click(); await page.waitForTimeout(2600);
  await expect(page.locator('booster-opening .grid .gc')).toHaveCount(5);
  const tEnd = await now(page);
  await browser.stopTracing();

  const all = await lostFrames(page, tStart, tEnd), cutL = await longTasks(page, tCut0, tCut1), dragL = await longTasks(page, tDrag0, tDrag1);
  const report = `${cible.nom} : images perdues ${(all.lost * 100).toFixed(1)} % sur ${all.frames} images · tâches > 50 ms : coupe ${cutL.length}, pile ${dragL.length}`;
  console.log(report); info.annotations.push({ type: 'performance', description: report });
  // vidéo de l'ouverture dans le jeu, jointe au compte rendu (enregistrée avant les vérifications : gardée même si la mesure échoue)
  if (cible.video) {
    await page.close();
    await page.video()!.saveAs('docs/captures/booster-ouverture-mobile.webm');
    await info.attach('ouverture-mobile', { path: 'docs/captures/booster-ouverture-mobile.webm', contentType: 'video/webm' });
  }
  expect(all.lost, report).toBeLessThan(.05);
  expect(cutL, `tâches longues pendant la coupe : ${JSON.stringify(cutL)}`).toHaveLength(0);
  expect(dragL, `tâches longues pendant le glisser : ${JSON.stringify(dragL)}`).toHaveLength(0);
});
