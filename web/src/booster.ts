// Boosters de cartes (D14, D14b) : visuels des sachets et des dos, et écran d'ouverture (docs/boosters/OUVERTURE.md,
// maquette Booster) en 5 états : choose → focus → opening (1,95 s) → stack → recap. Le tirage est fait par le serveur à
// l'entrée de focus (booster.open, pièces débitées) : l'écran ne fait que le mettre en scène, sans rien dévoiler avant
// (lumière dorée identique pour tous les boosters ; seuls les boosters divins laissent échapper quelques paillettes).
import './styles/booster.css';
import { callGame } from './api';
import { esc, toast } from './util';
import { cardHTML } from './cards';
import { sfx } from './sfx';
import type { CallGame } from './pages/collection';
import { othersAnimated } from './locker';
import { PACKS, PACK_BY_ID, CARD_BY_ID, VARIANT_INFO, BOOSTER_PRICE, ODDS, SERIES, TIER_OF, NUMBERED_MAX, serialLabel, drawBooster, type Variant } from '@shared/collection.ts';

/** Comptes qui voient le bouton « Essai gratuit » (aussi en développement, ou avec localStorage pli-debug = 1 sur l'appareil). */
const TESTEURS = ['theo.capitaine@clesence.fr'];
export function isTester(email: string | null | undefined) {
  let dbg = import.meta.env.DEV; try { dbg ||= localStorage.getItem('pli-debug') === '1'; } catch { /* stockage indisponible */ }
  return dbg || TESTEURS.includes((email ?? '').toLowerCase());
}

/** Sachet de chaque booster (web/public/boosters/, docs/boosters/README.md). Contenu et poids : web/public/boosters/CONTENU.md. */
const SACHET: Record<string, string> = { profondeurs: 'sachet_profondeurs.webp', sirenes: 'sachet_sirenes.webp', couronne: 'sachet_couronne.webp' };
export const packArt = (id: string) => `boosters/${SACHET[id] ?? SACHET.profondeurs}`;
/** Dos des cartes du booster ouvert (la 5e carte arrive face cachée avec ce dos) ; dos neutre par défaut. */
export const packBack = (id: string) => PACK_BY_ID[id] ? `cards/dos_${id}.webp` : 'cards/dos.webp';

export interface OpenedCard { card_id: string; variant: Variant; serial: number | null; duplicate: boolean; shards: number }
export interface OpenResult {
  ok: true; pack: string; divine: boolean; cards: OpenedCard[]; paid: 'booster' | 'coins' | 'essai';
  shards_gained: number; new: number; owned: number; owned_before: number; total: number; coins: number; boosters: number; shards: number;
}
interface Wallet { coins: number; shards: number; boosters: number; free_today: boolean; free_daily: boolean; owned?: unknown[]; total?: number }

const sOf = (w: number) => (w / 252).toFixed(4);
/** Carte d'un booster, dans sa variante (numéro des Numérotées compris). */
export function boosterCard(c: Pick<OpenedCard, 'card_id' | 'variant' | 'serial'>, w: number, extra = '', still = false) {
  return cardHTML({ id: 0, ...CARD_BY_ID[c.card_id].card }, null, extra, `style="--s:${sOf(w)}"`, { variant: c.variant, serial: c.serial, still });
}
/** Dos de carte (sans rien de la carte : aucun indice sur sa rareté). */
const backHTML = (pack: string, w: number) => `<div class="card bo-dos" style="--s:${sOf(w)}" role="img" aria-label="Carte face cachée"><div class="face"><img src="${packBack(pack)}" alt="" draggable="false"><span class="gsh"></span></div></div>`;
const tierOf = (v: Variant) => v === 'std' ? 'c' : TIER_OF[v];

/** Vibrations (app mobile : Capacitor Haptics si présent, sinon l'API du navigateur). */
function haptic(kind: 'light' | 'medium' | 'heavy') {
  try {
    const H = (window as any).Capacitor?.Plugins?.Haptics;
    if (H?.impact) { H.impact({ style: kind.toUpperCase() }); return; }
    navigator.vibrate?.(kind === 'light' ? 8 : kind === 'medium' ? 25 : [40, 30, 60]);
  } catch { /* pas de vibration */ }
}

type Phase = 'choose' | 'focus' | 'opening' | 'stack' | 'recap';
/** Écran d'ouverture. api : callGame (remplacé par le banc d'essai web/banc/ecrans.ts). */
export async function boosterPage(root: HTMLElement, query = new URLSearchParams(), api: CallGame = callGame, tester = false) {
  // Mode essai (#/boosters?essai=1) : tirage fait ici, avec les mêmes chances que le serveur (drawBooster), sans appeler
  // booster.open : ni pièces, ni booster offert, ni collection, ni éclats, ni annonce. Pour tester l'ouverture à volonté.
  const essai = query.get('essai') === '1', server = api;
  if (essai) api = (async (action: string, p: Record<string, any> = {}) => {
    if (action !== 'booster.open') return server(action, p);
    const d = drawBooster(p.pack, Math.random), n = w.owned?.length ?? 0;
    return { ok: true, pack: p.pack, divine: d.divine, paid: 'essai', shards_gained: 0, new: 0, owned: n, owned_before: n, total: w.total ?? 0,
      coins: w.coins, boosters: w.boosters, shards: w.shards,
      cards: d.cards.map(c => ({ ...c, serial: c.variant === 'numero' ? 1 + Math.floor(Math.random() * NUMBERED_MAX) : null, duplicate: false, shards: 0 })) };
  }) as CallGame;
  // calme : mouvement réduit du système ou « Animations des autres » coupées (Casier) — pas de flottement, de rayons ni de
  // flash, ouverture en fondu de 300 ms ; le geste de coupe reste (docs/boosters/ANIMATIONS.md, règle 7)
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches || !othersAnimated();
  let sel = Math.max(0, PACKS.findIndex(p => p.id === query.get('pack'))), phase: Phase = 'choose', res: OpenResult | null = null;
  let up: boolean[] = [], top = 0, cut = 0, cutting = false, touched = false, k = 0, boom = 0, flash = 0, lastBuzz = 0, lastTick = 0;
  let w: Wallet = { coins: 0, shards: 0, boosters: 0, free_today: false, free_daily: true };
  const timers: any[] = [];
  const later = (ms: number, f: () => void) => { const kk = k; timers.push(setTimeout(() => { if (k === kk && root.isConnected) f(); }, ms)); };
  try { w = await api<Wallet>('collection.list', {}); } catch (e: any) { toast(e.message, 'err'); }

  root.innerHTML = `<section class="bo${calm ? ' calm' : ''}"><div class="bo-caus" aria-hidden="true"></div>
    <header class="bo-head"><h1>Boosters</h1>${essai ? '<span class="bo-essai-tag">Mode essai · rien n’est enregistré</span>' : ''}<span class="bo-ser">Série 1 · <b>${esc(SERIES.name)}</b></span>
      <span class="bo-wallet" id="boW"></span></header>
    <div class="bo-cols">
      <aside class="bo-left">
        <div class="bo-panel"><div class="bo-lbl">Ouverture</div><div id="boSteps"></div></div>
        <div class="bo-panel" id="boFree"></div>
        <div class="bo-panel"><div class="bo-lbl">Chances par carte</div>
          <p class="bo-note">Cartes 1 à 3 : toujours Patinée ou Bord d’étain.</p>
          <table class="bo-odds"><tr class="h"><td>Variante</td><td>Carte 4</td><td>Carte 5</td></tr>
          ${ODDS.map(o => `<tr><td style="color:${VARIANT_INFO[o.tier === 'r' ? 'holo' : o.tier === 'e' ? 'nacre' : o.tier === 'l' ? 'signee' : 'numero'].color}">${o.label}</td><td>${String(o.slot4).replace('.', ',')} %</td><td>${String(o.slot5).replace('.', ',')} %</td></tr>`).join('')}</table>
          <p class="bo-note">Booster divin : 1 sur 2 000, 5 cartes Signées ou Numérotées. Les doublons sont recyclés en éclats à l’ouverture.</p></div>
      </aside>
      <div class="bo-stage-w" id="boSW"><div class="bo-stage" id="boS" tabindex="-1"></div></div>
    </div></section>`;
  const stage = root.querySelector<HTMLElement>('#boS')!, sw = root.querySelector<HTMLElement>('#boSW')!;
  // la scène est dessinée à 680 × 900 et mise à l'échelle de la place disponible ; sur téléphone (moins de 560 px), une scène
  // étroite de 400 × 820 (classe .m, booster.css) affichée presque à taille réelle : textes lisibles, cartes plus grandes
  // format choisi dès le premier rendu : sinon les boosters glisseraient de la scène large vers la scène étroite à l'arrivée
  let mob = sw.clientWidth > 0 && sw.clientWidth < 560; stage.classList.toggle('m', mob);
  const fit = () => {
    const m = sw.clientWidth < 560;
    if (m !== mob) { mob = m; stage.classList.toggle('m', m); underKey = ''; render(); }
    const W = mob ? 400 : 680, H = mob ? 820 : 900, kx = Math.min(1, sw.clientWidth / W);
    stage.style.transform = `scale(${kx})`; sw.style.height = H * kx + 'px';
  };
  const ro = new ResizeObserver(fit); ro.observe(sw);

  const pack = () => PACKS[sel], price = () => essai ? 'essai gratuit' : w.boosters ? 'offert' : `${BOOSTER_PRICE} 🪙`;
  const paintSide = () => {
    root.querySelector('#boW')!.innerHTML = `<span><span class="coin"></span> ${w.coins.toLocaleString('fr-FR')}</span><span class="sh">◆ ${w.shards.toLocaleString('fr-FR')} éclats</span><span>${w.boosters} offert${w.boosters > 1 ? 's' : ''}</span><a href="#/collection">Collection</a>`
      + (essai ? '<a href="#/boosters" class="bo-essai on">Quitter l’essai</a>' : tester ? '<a href="#/boosters?essai=1" class="bo-essai">Essai gratuit</a>' : '');
    const stepI = { choose: 0, focus: 1, opening: 1, stack: 2, recap: 3 }[phase];
    root.querySelector('#boSteps')!.innerHTML = ['Choisir le booster', 'Couper le sachet', 'Faire défiler la pile', 'Le butin'].map((t, i) => `<div class="bo-step${i === stepI ? ' on' : i < stepI ? ' done' : ''}"><i>${i + 1}</i>${t}</div>`).join('');
    root.querySelector('#boFree')!.innerHTML = `<div class="bo-lbl">Booster gratuit</div><div class="bo-free"><span class="hg" aria-hidden="true">⏳</span><b>${
      w.boosters ? `${w.boosters} booster${w.boosters > 1 ? 's' : ''} offert${w.boosters > 1 ? 's' : ''} à ouvrir` : !w.free_daily ? 'Pas de booster gratuit en ce moment' : w.free_today ? 'Reçu aujourd’hui : à demain !' : 'Après votre 1re partie du jour'}</b></div>
      <p class="bo-note">1 booster gratuit par jour où vous jouez. Une victoire en donne un aussi.</p>`;
  };

  /* ---------- scène en couches persistantes (docs/boosters/ANIMATIONS.md, règle 2) ----------
     Les éléments animés ne sont jamais recréés : on change leurs classes et leurs styles, et les transitions de la maquette
     jouent (carrousel 3D .55 s, retournement 1,1 s, retour de la carte .25 s). Les animations à relancer alternent deux
     classes aux keyframes identiques (pa / pb, ba / bb, fa / fb), comme la maquette. */
  const el = (cls: string, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };
  const car = el('bo-car'), under = el('bo-underw'), stkw = el('bo-stkw'), recap = el('bo-recapw'), flashEl = el('bo-flash');
  const pws = PACKS.map((p, i) => {
    const pw = el('pw', `<div class="pin"><div class="lrays"></div><div class="pbody"><img src="${packArt(p.id)}" alt="${esc(p.name)}" draggable="false"><span class="pfoil"></span></div>
      <div class="lid"><img src="${packArt(p.id)}" alt="" draggable="false"></div><div class="leak"></div></div>`);
    pw.dataset.i = String(i); car.append(pw); return pw;
  });
  const shadow = el('shadow'); car.append(shadow);
  stage.append(car, under, stkw, recap, flashEl);
  let underKey = '', stkFor: OpenResult | null = null, shownTop = -1, shownBoom = -1, flashShown = 0;

  const render = () => { paintSide(); paintCar(); paintUnder(); paintStack(); paintRecap(); paintFlash(); };

  const paintCar = () => {
    const inFocus = phase === 'focus' || phase === 'opening';
    car.hidden = !(phase === 'choose' || inFocus);
    const pos = (i: number) => { const o = ((i - sel) % 3 + 3) % 3; return o === 2 ? -1 : o; };
    // téléphone : boosters voisins plus serrés et plus petits (ils dépassent à peine des bords), sachet coupé un peu plus bas
    const dx = mob ? 150 : 240, side = mob ? .7 : .82;
    pws.forEach((pw, i) => {
      const o = pos(i), isCur = o === 0, gone = inFocus && !isCur;
      pw.style.transform = inFocus ? (isCur ? `translateY(${mob ? 60 : 40}px) scale(${mob ? 1.25 : 1.22})` : `translateX(${o * 420}px) scale(.6)`)
        : `translateX(${o * dx}px) translateZ(${isCur ? 0 : -160}px) rotateY(${o * -32}deg) scale(${isCur ? 1 : side})`;
      pw.style.opacity = String(gone ? 0 : isCur ? 1 : .55);
      pw.style.filter = isCur ? 'none' : 'brightness(.6) saturate(.8)';
      pw.style.zIndex = isCur ? '3' : '1';
      pw.classList.toggle('off', gone);
      if (isCur) pw.removeAttribute('role'); else { pw.setAttribute('role', 'button'); pw.setAttribute('aria-label', PACKS[i].name); }
      const pin = pw.firstElementChild as HTMLElement, want = isCur ? (phase === 'opening' ? 'opening' : phase === 'choose' ? 'pfloat' : '') : '';
      pin.className = 'pin' + (want ? ' ' + want : '');
      // will-change seulement pendant l'ouverture (règle 4)
      pin.style.willChange = isCur && phase === 'opening' ? 'transform, opacity' : '';
      const cutUI = pin.querySelector('.cutui');
      if (isCur && phase === 'focus') { if (!cutUI) mountCut(pin); } else cutUI?.remove();
      if (isCur && phase === 'opening' && res?.divine && !pin.querySelector('.gsp'))
        pin.insertAdjacentHTML('beforeend', [8, 22, 35, 47, 58, 70, 83, 93].map((x, j) => `<i class="gsp" style="left:${x}%;animation-delay:${(.35 + (j * .37) % 1.1).toFixed(2)}s"></i>`).join(''));
      if (phase !== 'opening') pin.querySelectorAll('.gsp').forEach(g => g.remove());
    });
    shadow.style.opacity = phase === 'choose' ? '1' : '0';
  };

  const paintUnder = () => {
    const cur = pack(), key = phase === 'choose' ? `c${sel}|${price()}|${w.boosters}` : phase === 'focus' ? 'f' : '';
    if (key === underKey) return; underKey = key;
    under.innerHTML = phase === 'choose' ? `<div class="bo-under fi">
        <div class="bo-name"><button type="button" class="bo-arrow" id="bPrev" aria-label="Booster précédent">‹</button><b>${esc(cur.name)}</b><button type="button" class="bo-arrow" id="bNext" aria-label="Booster suivant">›</button></div>
        <p>${esc(cur.desc)}</p>
        <div class="bo-feat">${cur.featured.map(id => `<span>${boosterCard({ card_id: id, variant: 'holo', serial: null }, 78, '', true)}<i>×3</i></span>`).join('')}</div>
        <div class="bo-btns"><button type="button" class="bo-btn gold big" id="bOpen">Ouvrir · ${price()}</button></div>
        <p class="bo-note">${essai ? 'Mode essai : ouvertures illimitées et gratuites, rien n’est ajouté à votre collection.' : w.boosters ? 'Un booster offert est utilisé en premier.' : `Un booster coûte ${BOOSTER_PRICE} pièces, débitées à l’ouverture.`}</p></div>`
      : phase === 'focus' ? `<div class="bo-under low fi"><b class="bo-cta">Glissez le long des pointillés pour ouvrir</b><p>De gauche à droite, d’un seul geste. Au clavier : Entrée.</p>
        <div class="bo-btns"><button type="button" class="bo-btn" id="bAuto">Ouvrir sans glisser</button></div></div>` : '';
    under.querySelector('#bPrev')?.addEventListener('click', () => pick((sel + 2) % 3));
    under.querySelector('#bNext')?.addEventListener('click', () => pick((sel + 1) % 3));
    under.querySelector('#bOpen')?.addEventListener('click', focus);
    under.querySelector('#bAuto')?.addEventListener('click', () => { touched = true; hideGhost(); [.25, .5, .75, 1].forEach((p, j) => later(90 * (j + 1), () => p < 1 ? setCut(p) : doCut())); });
  };

  /* ---------- pile ---------- */
  const paintStack = () => {
    const on = (phase === 'opening' || phase === 'stack') && !!res;
    stkw.hidden = !on;
    if (!on) { if (stkFor) { stkw.innerHTML = ''; stkFor = null; } return; }
    if (stkFor !== res) {
      stkFor = res; shownTop = -1; shownBoom = -1;
      stkw.innerHTML = `<div class="stk"><div class="bigw"></div><div class="burst"></div><div class="ring"></div><div class="sparks"></div>
        <div class="peek2"></div><div class="peek"></div><div class="top" id="bTop" role="button" tabindex="0"></div><div class="info"></div></div>
        <button type="button" class="bo-btn ghost bo-skip" id="bSkip">Tout voir ⏭</button>`;
      stkw.querySelector('#bSkip')!.addEventListener('click', finish);
      wirePile(stkw.querySelector<HTMLElement>('#bTop')!);
    }
    const cs = res!.cards, n = cs.length, c = top < n ? cs[top] : null, cUp = !!c && up[top], rk = c ? tierOf(c.variant) : 'c';
    const stk = stkw.querySelector<HTMLElement>('.stk')!, topEl = stkw.querySelector<HTMLElement>('#bTop')!;
    stk.classList.toggle('rise', phase === 'opening'); stk.style.zIndex = phase === 'opening' ? '1' : '9';
    (stkw.querySelector('#bSkip') as HTMLElement).hidden = phase !== 'stack';
    // nouvelle carte sur le dessus : on remplace son contenu (une carte neuve, sans transition) et on relance le « pop »
    if (shownTop !== top) {
      shownTop = top;
      const face = (j: number) => cs[j] && up[j] ? boosterCard(cs[j], 280, '', true) : backHTML(res!.pack, 280);
      stkw.querySelector('.peek2')!.innerHTML = top + 2 < n ? backHTML(res!.pack, 280) : '';
      stkw.querySelector('.peek')!.innerHTML = top + 1 < n ? face(top + 1) : '';
      topEl.hidden = !c;
      topEl.className = 'top ' + (top % 2 ? 'pa' : 'pb');
      topEl.innerHTML = c ? `<div class="flipw${cUp ? ' up' : ' hid'}"><div class="flip"><div class="fside back">${backHTML(res!.pack, 280)}</div><div class="fside front">${boosterCard(c, 280)}</div></div></div>` : '';
    }
    if (c) topEl.setAttribute('aria-label', cUp ? `${CARD_BY_ID[c.card_id].name}, ${VARIANT_INFO[c.variant].name} : carte suivante` : 'Carte de chance, face cachée : la retourner');
    // onde, anneau et étincelles : une fois par carte révélée (boom), en alternant ba / bb
    if (shownBoom !== boom) {
      shownBoom = boom;
      const par = boom % 2 ? 'ba' : 'bb', fx = phase === 'stack' && cUp && rk !== 'c', rc = { c: 'rgba(255,244,214,.9)', r: '#4fa8ff', e: '#b77dff', l: '#ffc94a', m: '#e7c6ff' }[rk];
      const burst = stkw.querySelector<HTMLElement>('.burst')!, ring = stkw.querySelector<HTMLElement>('.ring')!;
      burst.className = 'burst' + (fx ? ` ${rk} ${par}` : ''); ring.className = 'ring' + (fx ? ' ' + par : ''); ring.style.setProperty('--rc', rc);
      let sparks = '';
      if (fx) for (let i = 0; i < { r: 10, e: 16, l: 26, m: 32 }[rk]!; i++) { const a = i / 7.3 * Math.PI * 2 + i, d = 160 + (i * 37) % 140; sparks += `<i class="spark ${par}" style="--rc:${rc};--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d)}px;--d:${((i % 6) * .04).toFixed(2)}s"></i>`; }
      stkw.querySelector('.sparks')!.innerHTML = sparks;
    }
    // moment Signée / Numérotée : voile, rayons, bannière (posés une fois, retirés à la carte suivante)
    const big = phase === 'stack' && cUp && (rk === 'l' || rk === 'm'), bigw = stkw.querySelector<HTMLElement>('.bigw')!;
    const bigKey = big ? `${top}${rk}` : '';
    if (bigw.dataset.k !== bigKey) {
      bigw.dataset.k = bigKey;
      bigw.innerHTML = big ? `<div class="bo-dim"></div><div class="grays${rk === 'm' ? ' m' : ''}"></div><div class="ban${rk === 'm' ? ' m' : ''}">${rk === 'm' ? 'Numérotée !' : 'Signée !'}</div>` : '';
    }
    const vi = c ? VARIANT_INFO[c.variant] : null;
    stkw.querySelector('.info')!.innerHTML = phase !== 'stack' ? '' : `${c && cUp ? `<b class="nm">${esc(CARD_BY_ID[c.card_id].name)}</b>${c.serial ? `<span class="ex">EXEMPLAIRE ${serialLabel(c.serial)}</span>` : ''}
        <span class="vn" style="color:${vi!.color}">${vi!.stars} ${esc(vi!.name)}</span><span class="tag${c.duplicate ? ' dup' : ''}">${c.duplicate ? `Doublon · +${c.shards} ◆` : 'Nouveau'}</span>`
      : c ? '<b class="nm gold">Carte de chance</b><span class="bo-note">Touchez pour la retourner</span>' : ''}
      <div class="pdots${res!.divine ? ' dv' : ''}">${cs.map((_, i) => `<span class="${i < top ? 'on' : i === top ? 'cur' : ''}"></span>`).join('')}</div>
      <span class="bo-note">${c && !cUp ? '' : top === n - 1 ? 'Dernière carte : touchez pour voir le butin' : 'Glissez la carte sur le côté, ou touchez-la'}</span>`;
    if (phase === 'stack' && document.activeElement !== topEl && !topEl.hidden) topEl.focus({ preventScroll: true });
  };

  const paintRecap = () => {
    const on = phase === 'recap' && !!res;
    if (!on) { if (recap.firstChild) recap.innerHTML = ''; return; }
    if (recap.dataset.for === String(k)) return; recap.dataset.for = String(k);
    recap.innerHTML = recapHTML(res!, price(), mob ? 112 : 150);
    recap.querySelector('#bAgain')?.addEventListener('click', again);
    recap.querySelector('#bShop')?.addEventListener('click', () => { phase = 'choose'; res = null; k++; render(); });
    recap.querySelector('#bColl')?.addEventListener('click', () => { location.hash = '#/collection'; });
  };
  // le flash ne joue qu'une fois par demande (coupe, Signée, Numérotée) : fa / fb alternés
  const paintFlash = () => { if (flash > flashShown) { flashShown = flash; flashEl.className = 'bo-flash ' + (flash % 2 ? 'fa' : 'fb'); } };

  /* ---------- actions ---------- */
  const pick = (i: number) => { if (phase !== 'choose' || i === sel) return; sel = i; sfx.fwip(); render(); };
  const focus = async () => {
    if (phase !== 'choose') return;
    k++; phase = 'focus'; cut = 0; touched = false; cutting = false; res = null; up = []; top = 0;
    sfx.crinkle(); render();
    try {
      const r = await api<OpenResult>('booster.open', { pack: pack().id });
      res = r; up = r.cards.map((_, i) => i < r.cards.length - 1); w = { ...w, coins: r.coins, boosters: r.boosters, shards: r.shards };
      paintSide(); preload(r);
    } catch (e: any) { toast(e?.message || 'Ouverture impossible pour le moment.', 'err'); phase = 'choose'; render(); }
  };
  /** Précharge pendant la coupe (règle 6) : calques et masques des 5 cartes, le dos des cartes et l'illustration du sachet. */
  const preload = (r: OpenResult) => {
    const tmp = document.createElement('div'); tmp.style.cssText = 'position:absolute;left:-9999px;top:0;contain:strict;width:1px;height:1px;overflow:hidden';
    tmp.innerHTML = r.cards.map(c => boosterCard(c, 40, '', true)).join('') + backHTML(r.pack, 40);
    document.body.append(tmp); later(4000, () => tmp.remove());
    [packBack(r.pack), packArt(r.pack)].forEach(src => { const i = new Image(); i.decoding = 'async'; i.src = src; i.decode?.().catch(() => { /* ignoré */ }); });
  };
  const doCut = () => {
    if (phase !== 'focus') return;
    if (!res) { later(150, doCut); return; }   // le tirage n'est pas encore arrivé : on attend un instant
    k++; phase = 'opening'; cut = 1; cutting = false; flash = calm ? flash : flash + 1; top = 0;
    sfx.tear(); haptic('medium'); render();
    later(calm ? 300 : 1950, () => { phase = 'stack'; boom++; render(); onTop(); });
  };
  /** Une carte arrive sur le dessus : carillon, accord ou fanfare selon sa rareté (si elle est face visible). */
  const onTop = () => {
    const c = res?.cards[top]; if (!c || !up[top]) return;
    const t = tierOf(c.variant); if (t !== 'c') sfx.reveal(t); if (t === 'l' || t === 'm') haptic('heavy');
  };
  const advance = (dir: number) => {
    if (phase !== 'stack' || !res || top >= res.cards.length) return;
    if (!up[top]) { reveal(); return; }
    const leaving = res.cards[top]; top++; boom++; sfx.fwip();
    // la carte qui s'envole du côté du geste : un élément jetable par envol (.45 s), will-change le temps du vol
    if (!calm) {
      const fly = el('fly ' + (dir < 0 ? 'l' : 'r'), boosterCard(leaving, 280, '', true)); fly.style.willChange = 'transform, opacity';
      stkw.querySelector('.stk')?.append(fly); setTimeout(() => fly.remove(), 460);
    }
    render();
    if (top >= res.cards.length) later(420, finish); else onTop();
  };
  const reveal = () => {
    if (!res || up[top]) return;
    up[top] = true; const c = res.cards[top], big = ['signee', 'numero'].includes(c.variant);
    // retournement de 1,1 s : on bascule seulement la classe ; rien n'est recréé ensuite, la transition va jusqu'au bout
    const fw = stkw.querySelector('.flipw'); fw?.classList.add('up'); fw?.classList.remove('hid');
    later(650, () => { boom++; if (big && !calm) flash++; render(); onTop(); });
  };
  const finish = () => { if (!res) return; k++; phase = 'recap'; up = res.cards.map(() => true); top = res.cards.length; render(); };
  const again = () => { phase = 'choose'; focus(); };

  /* ---------- gestes ---------- */
  // carrousel : clic sur un voisin, ou glisser horizontal au doigt (plus de 40 px)
  let swipeX: number | null = null, swiped = false;
  car.addEventListener('pointerdown', ev => { if (phase === 'choose') { swipeX = ev.clientX; swiped = false; } });
  car.addEventListener('pointerup', ev => {
    if (swipeX == null || phase !== 'choose') return; const d = ev.clientX - swipeX; swipeX = null;
    if (Math.abs(d) > 40) { swiped = true; pick((sel + (d < 0 ? 1 : 2)) % 3); }
  });
  car.addEventListener('click', ev => {
    if (swiped) { swiped = false; return; }
    const pw = (ev.target as HTMLElement).closest<HTMLElement>('.pw'); if (!pw || phase !== 'choose') return;
    // comme la maquette : un voisin devient le centre, le sachet du centre s'ouvre
    if (Number(pw.dataset.i) === sel) focus(); else pick(Number(pw.dataset.i));
  });
  /** Coupe : la ligne de lumière est un scaleX(var(--cut)) et l'étincelle une translation (règle 1), mis à jour une fois par
   *  image (requestAnimationFrame) ; la progression ne fait qu'augmenter, démarre dans le premier tiers, ouvre à 92 %. */
  const mountCut = (pin: HTMLElement) => {
    const ui = el('cutui', `<div class="dots"></div><div class="scis" aria-hidden="true">✂</div><div class="cutline" id="cutL"></div><div class="tip" id="cutT" hidden></div>
      ${touched ? '' : '<div class="runner"></div><div class="chev" aria-hidden="true">›››</div>'}<div class="cutzone" id="cutZ" role="slider" aria-label="Glissez le long des pointillés pour ouvrir" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"></div>`);
    pin.append(ui); ui.style.setProperty('--cut', String(cut));
    const z = ui.querySelector<HTMLElement>('.cutzone')!;
    const prog = (ev: PointerEvent) => { const r = z.getBoundingClientRect(), s = r.width / 280; return (ev.clientX - r.left - 30 * s) / (220 * s); };
    let want = 0, raf = 0;
    z.onpointerdown = ev => { try { z.setPointerCapture(ev.pointerId); } catch { /* ignoré */ } const p = prog(ev); cutting = true; ui.classList.add('cutting'); hideGhost(); setCut(p < .35 ? Math.max(0, p) : 0); };
    z.onpointermove = ev => {
      if (!cutting) return; want = Math.max(cut, want, Math.min(1, prog(ev)));
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (!cutting) return; if (want - cut > .015) setCut(want); if (want >= .92) { cutting = false; doCut(); } });
    };
    z.onpointerup = z.onpointercancel = () => { if (phase !== 'focus' || !cutting) return; cutting = false; want = 0; ui.classList.remove('cutting'); setCut(0); };
    z.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); touched = true; doCut(); } };
    z.focus({ preventScroll: true });
  };
  const hideGhost = () => { if (!touched) touched = true; stage.querySelectorAll('.runner,.chev').forEach(x => x.remove()); };
  const setCut = (p: number) => {
    cut = p; const ui = stage.querySelector<HTMLElement>('.cutui'); if (!ui) return;
    ui.style.setProperty('--cut', String(p)); ui.classList.toggle('back', p === 0);
    ui.querySelector('.tip')!.toggleAttribute('hidden', !cutting || p <= 0);
    ui.querySelector('.cutzone')!.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    const now = performance.now(); if (p > 0 && now - lastTick > 45) { lastTick = now; sfx.cut(p); }
    const step = Math.floor(p * 10); if (step > lastBuzz) { lastBuzz = step; haptic('light'); } if (p === 0) lastBuzz = 0;
  };
  /** Pile : la carte suit le doigt sans transition (une écriture par image), retour .25 s avec rebond sous 90 px,
   *  envol au-delà ; un toucher sans glisser = carte suivante (ou retourner la carte de chance). */
  const wirePile = (t: HTMLElement) => {
    let x0 = 0, dx = 0, drag = false, moved = false, raf = 0;
    const paint = () => { raf = 0; if (drag && up[top]) t.style.transform = `translateX(${dx}px) rotate(${(dx / 18).toFixed(1)}deg)`; };
    t.onpointerdown = ev => { if (phase !== 'stack') return; try { t.setPointerCapture(ev.pointerId); } catch { /* ignoré */ } x0 = ev.clientX; dx = 0; drag = true; moved = false; t.classList.add('drag'); t.style.willChange = 'transform'; };
    t.onpointermove = ev => { if (!drag) return; dx = ev.clientX - x0; if (Math.abs(dx) > 6) moved = true; if (!raf) raf = requestAnimationFrame(paint); };
    t.onpointerup = t.onpointercancel = () => {
      if (!drag) return; drag = false; cancelAnimationFrame(raf); raf = 0; t.classList.remove('drag'); t.style.transform = '';
      setTimeout(() => { t.style.willChange = ''; }, 260);
      if (Math.abs(dx) > 90 && up[top]) advance(dx < 0 ? -1 : 1); else if (!moved) advance(-1);
    };
  };
  const onKey = (ev: KeyboardEvent) => {
    if (!root.isConnected) { removeEventListener('keydown', onKey); return; }
    if (phase === 'stack') {
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === ' ') { ev.preventDefault(); advance(ev.key === 'ArrowLeft' ? -1 : 1); }
      else if (ev.key === 'Enter') { ev.preventDefault(); res && !up[top] ? reveal() : advance(1); }
    } else if (phase === 'focus' && ev.key === 'Enter' && !(ev.target as HTMLElement).closest?.('button')) { ev.preventDefault(); touched = true; doCut(); }
  };
  addEventListener('keydown', onKey);
  render();
  return { destroy: () => { k++; timers.forEach(clearTimeout); ro.disconnect(); removeEventListener('keydown', onKey); } };
}

/** Butin : grille 3 + 2 en cascade, nouveautés et doublons convertis en éclats, barre de collection qui avance. */
export function recapHTML(r: OpenResult, price = `${BOOSTER_PRICE} 🪙`, size = 150) {
  return `<div class="bo-recap">
    <h2 class="fi">Votre butin</h2>
    ${r.divine ? '<div class="fi divb">✦ Booster divin · 1 sur 2 000 ✦</div>' : ''}
    <div class="bo-grid">${r.cards.map((c, i) => { const vi = VARIANT_INFO[c.variant];
      return `<figure style="animation-delay:${(.08 + i * .1).toFixed(2)}s">${boosterCard(c, size)}<figcaption><b>${esc(CARD_BY_ID[c.card_id].name)}</b>
        <span style="color:${vi.color}">${vi.stars} ${esc(vi.name)}${c.serial ? ` · ${serialLabel(c.serial)}` : ''}</span>
        <span class="tag${c.duplicate ? ' dup' : ''}">${c.duplicate ? `Doublon · +${c.shards} ◆` : 'Nouveau'}</span></figcaption></figure>`; }).join('')}</div>
    <div class="bo-sum fi"><span class="nw">+${r.new} nouvelle${r.new > 1 ? 's' : ''} variante${r.new > 1 ? 's' : ''}</span><span class="sh">+${r.shards_gained} ◆ éclats</span></div>
    <div class="bo-ct fi"><span>Collection · Série 1</span><b>${r.owned} / ${r.total} variantes</b></div>
    <div class="bo-bar fi"><div style="--a:${(r.owned_before / r.total * 100).toFixed(1)}%;--b:${(r.owned / r.total * 100).toFixed(1)}%"></div></div>
    <div class="bo-btns fi"><button type="button" class="bo-btn gold big" id="bAgain">Ouvrir un autre · ${price}</button><button type="button" class="bo-btn big" id="bColl">Voir la collection</button><button type="button" class="bo-btn ghost" id="bShop">Changer de booster</button></div>
  </div>`;
}
