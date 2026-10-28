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
import { PACKS, PACK_BY_ID, CARD_BY_ID, VARIANT_INFO, BOOSTER_PRICE, ODDS, SERIES, TIER_OF, type Variant } from '@shared/collection.ts';

/** Sachet de chaque booster (web/public/boosters/, docs/boosters/README.md). Les .png fournis ne correspondent pas à leur nom (voir suivi.md). */
const SACHET: Record<string, string> = { profondeurs: 'sachet_profondeurs.webp', sirenes: 'sachet_sirenes.webp', couronne: 'sachet_couronne.webp' };
export const packArt = (id: string) => `boosters/${SACHET[id] ?? SACHET.profondeurs}`;
/** Dos des cartes du booster ouvert (la 5e carte arrive face cachée avec ce dos) ; dos neutre par défaut. */
export const packBack = (id: string) => PACK_BY_ID[id] ? `cards/dos_${id}.webp` : 'cards/dos.webp';

export interface OpenedCard { card_id: string; variant: Variant; serial: number | null; duplicate: boolean; shards: number }
export interface OpenResult {
  ok: true; pack: string; divine: boolean; cards: OpenedCard[]; paid: 'booster' | 'coins';
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
export async function boosterPage(root: HTMLElement, query = new URLSearchParams(), api: CallGame = callGame) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sel = Math.max(0, PACKS.findIndex(p => p.id === query.get('pack'))), phase: Phase = 'choose', res: OpenResult | null = null;
  let up: boolean[] = [], top = 0, cut = 0, cutting = false, touched = false, k = 0, boom = 0, flash = 0, flashShown = 0, lastBuzz = 0, lastTick = 0;
  let w: Wallet = { coins: 0, shards: 0, boosters: 0, free_today: false, free_daily: true };
  const timers: any[] = [];
  const later = (ms: number, f: () => void) => { const kk = k; timers.push(setTimeout(() => { if (k === kk && root.isConnected) f(); }, ms)); };
  try { w = await api<Wallet>('collection.list', {}); } catch (e: any) { toast(e.message, 'err'); }

  root.innerHTML = `<section class="bo"><div class="bo-caus" aria-hidden="true"></div>
    <header class="bo-head"><h1>Boosters</h1><span class="bo-ser">Série 1 · <b>${esc(SERIES.name)}</b></span>
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
  // la scène est dessinée à 680 × 900 et mise à l'échelle de la place disponible (téléphone compris)
  const fit = () => { const kx = Math.min(1, sw.clientWidth / 680); stage.style.transform = `scale(${kx})`; sw.style.height = 900 * kx + 'px'; };
  const ro = new ResizeObserver(fit); ro.observe(sw);

  const pack = () => PACKS[sel], price = () => w.boosters ? 'offert' : `${BOOSTER_PRICE} 🪙`;
  const paintSide = () => {
    root.querySelector('#boW')!.innerHTML = `<span><span class="coin"></span> ${w.coins.toLocaleString('fr-FR')}</span><span class="sh">◆ ${w.shards.toLocaleString('fr-FR')} éclats</span><span>${w.boosters} offert${w.boosters > 1 ? 's' : ''}</span><a href="#/collection">Collection</a>`;
    const stepI = { choose: 0, focus: 1, opening: 1, stack: 2, recap: 3 }[phase];
    root.querySelector('#boSteps')!.innerHTML = ['Choisir le booster', 'Couper le sachet', 'Faire défiler la pile', 'Le butin'].map((t, i) => `<div class="bo-step${i === stepI ? ' on' : i < stepI ? ' done' : ''}"><i>${i + 1}</i>${t}</div>`).join('');
    root.querySelector('#boFree')!.innerHTML = `<div class="bo-lbl">Booster gratuit</div><div class="bo-free"><span class="hg" aria-hidden="true">⏳</span><b>${
      w.boosters ? `${w.boosters} booster${w.boosters > 1 ? 's' : ''} offert${w.boosters > 1 ? 's' : ''} à ouvrir` : !w.free_daily ? 'Pas de booster gratuit en ce moment' : w.free_today ? 'Reçu aujourd’hui : à demain !' : 'Après votre 1re partie du jour'}</b></div>
      <p class="bo-note">1 booster gratuit par jour où vous jouez. Une victoire en donne un aussi.</p>`;
  };

  /* ---------- rendu de la scène (à chaque changement d'état) ---------- */
  const render = () => {
    paintSide();
    const P = PACKS, cur = pack(), inFocus = phase === 'focus' || phase === 'opening', showCar = phase === 'choose' || inFocus;
    const pos = (i: number) => { const o = ((i - sel) % 3 + 3) % 3; return o === 2 ? -1 : o; };
    let h = '';
    if (showCar) {
      h += `<div class="bo-car">${P.map((p, i) => { const o = pos(i), isCur = o === 0;
        const tf = inFocus ? (isCur ? 'translateY(40px) scale(1.22)' : `translateX(${o * 420}px) scale(.6)`) : `translateX(${o * 240}px) translateZ(${isCur ? 0 : -160}px) rotateY(${o * -32}deg) scale(${isCur ? 1 : .82})`;
        const inner = isCur ? (phase === 'opening' ? 'opening' : phase === 'choose' ? 'float' : '') : '';
        return `<div class="pw${inFocus && !isCur ? ' off' : ''}" data-i="${i}" style="transform:${tf};opacity:${inFocus && !isCur ? 0 : isCur ? 1 : .55};filter:${isCur ? 'none' : 'brightness(.6) saturate(.8)'};z-index:${isCur ? 3 : 1}" ${isCur ? '' : `role="button" aria-label="${esc(p.name)}"`}>
          <div class="pin ${inner}">
            <div class="lrays"></div>
            <div class="pbody"><img src="${packArt(p.id)}" alt="${esc(p.name)}" draggable="false"><span class="pfoil"></span></div>
            <div class="lid"><img src="${packArt(p.id)}" alt="" draggable="false"></div>
            <div class="leak"></div>
            ${isCur && phase === 'opening' && res?.divine ? [8, 22, 35, 47, 58, 70, 83, 93].map((x, j) => `<i class="gsp" style="left:${x}%;animation-delay:${(.35 + (j * .37) % 1.1).toFixed(2)}s"></i>`).join('') : ''}
            ${isCur && phase === 'focus' ? `<div class="dots"></div><div class="scis" aria-hidden="true">✂</div><div class="cutline" id="cutL" style="width:${Math.round(cut * 220)}px"></div><div class="tip" id="cutT" hidden></div>
              ${touched ? '' : '<div class="runner"></div><div class="chev" aria-hidden="true">›››</div>'}<div class="cutzone" id="cutZ" role="slider" aria-label="Glissez le long des pointillés pour ouvrir" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(cut * 100)}" tabindex="0"></div>` : ''}
          </div></div>`; }).join('')}<div class="shadow" style="opacity:${phase === 'choose' ? 1 : 0}"></div></div>`;
    }
    if (phase === 'choose') h += `<div class="bo-under fi">
        <div class="bo-name"><button type="button" class="bo-arrow" id="bPrev" aria-label="Booster précédent">‹</button><b>${esc(cur.name)}</b><button type="button" class="bo-arrow" id="bNext" aria-label="Booster suivant">›</button></div>
        <p>${esc(cur.desc)}</p>
        <div class="bo-feat">${cur.featured.map(id => `<span>${boosterCard({ card_id: id, variant: 'holo', serial: null }, 78, '', true)}<i>×3</i></span>`).join('')}</div>
        <div class="bo-btns"><button type="button" class="bo-btn gold big" id="bOpen">Ouvrir · ${price()}</button></div>
        <p class="bo-note">${w.boosters ? 'Un booster offert est utilisé en premier.' : `Un booster coûte ${BOOSTER_PRICE} pièces, débitées à l’ouverture.`}</p></div>`;
    if (phase === 'focus') h += `<div class="bo-under low fi"><b class="bo-cta">Glissez le long des pointillés pour ouvrir</b><p>De gauche à droite, d’un seul geste. Au clavier : Entrée.</p>
        <div class="bo-btns"><button type="button" class="bo-btn" id="bAuto">Ouvrir sans glisser</button></div></div>`;
    if ((phase === 'opening' || phase === 'stack') && res) h += stackHTML();
    if (phase === 'recap' && res) h += recapHTML(res, price());
    // le flash ne joue qu'une fois par demande (coupe, Signée, Numérotée), pas à chaque rendu
    h += `<div class="bo-flash${flash > flashShown ? (flash % 2 ? ' fa' : ' fb') : ''}" id="boFl"></div>`; flashShown = flash;
    stage.innerHTML = h;
    wire();
  };
  const stackHTML = () => {
    const cs = res!.cards, n = cs.length, c = top < n ? cs[top] : null, cUp = !!c && up[top], rk = c ? tierOf(c.variant) : 'c';
    const big = phase === 'stack' && cUp && (rk === 'l' || rk === 'm'), par = boom % 2 ? 'ba' : 'bb', rc = { c: 'rgba(255,244,214,.9)', r: '#4fa8ff', e: '#b77dff', l: '#ffc94a', m: '#e7c6ff' }[rk];
    let sparks = '';
    if (phase === 'stack' && cUp && rk !== 'c') for (let i = 0; i < { r: 10, e: 16, l: 26, m: 32 }[rk]!; i++) { const a = i / 7.3 * Math.PI * 2 + i, d = 160 + (i * 37) % 140; sparks += `<i class="spark ${par}" style="--rc:${rc};--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d)}px;--d:${((i % 6) * .04).toFixed(2)}s"></i>`; }
    const face = (j: number) => cs[j] && up[j] ? boosterCard(cs[j], 280, '', true) : backHTML(res!.pack, 280);
    const vi = c ? VARIANT_INFO[c.variant] : null;
    return `${big ? '<div class="bo-dim"></div>' : ''}<div class="stk${phase === 'opening' ? ' rise' : ''}" style="z-index:${phase === 'opening' ? 1 : 9}">
      ${big ? `<div class="grays${rk === 'm' ? ' m' : ''}"></div><div class="ban${rk === 'm' ? ' m' : ''}">${rk === 'm' ? 'Numérotée !' : 'Signée !'}</div>` : ''}
      <div class="burst ${cUp && phase === 'stack' && rk !== 'c' ? rk + ' ' + par : ''}"></div><div class="ring ${cUp && phase === 'stack' && rk !== 'c' ? par : ''}" style="--rc:${rc}"></div>${sparks}
      ${top + 2 < n ? `<div class="peek2">${backHTML(res!.pack, 280)}</div>` : ''}
      ${top + 1 < n ? `<div class="peek">${face(top + 1)}</div>` : ''}
      ${c ? `<div class="top ${top % 2 ? 'pa' : 'pb'}" id="bTop" role="button" tabindex="0" aria-label="${cUp ? esc(CARD_BY_ID[c.card_id].name) + ', ' + esc(vi!.name) + ' : carte suivante' : 'Carte de chance, face cachée : la retourner'}">
        <div class="flipw${cUp ? ' up' : ' hid'}"><div class="flip"><div class="fside back">${backHTML(res!.pack, 280)}</div><div class="fside front">${boosterCard(c, 280)}</div></div></div></div>` : ''}
      <div id="bFly"></div>
      ${phase === 'stack' ? `<div class="info">${c && cUp ? `<b class="nm">${esc(CARD_BY_ID[c.card_id].name)}</b>${c.serial ? `<span class="ex">EXEMPLAIRE N° ${String(c.serial).padStart(3, '0')} / 100</span>` : ''}
          <span class="vn" style="color:${vi!.color}">${vi!.stars} ${esc(vi!.name)}</span><span class="tag${c.duplicate ? ' dup' : ''}">${c.duplicate ? `Doublon · +${c.shards} ◆` : 'Nouveau'}</span>`
        : c ? '<b class="nm gold">Carte de chance</b><span class="bo-note">Touchez pour la retourner</span>' : ''}
        <div class="pdots${res!.divine ? ' dv' : ''}">${cs.map((_, i) => `<span class="${i < top ? 'on' : i === top ? 'cur' : ''}"></span>`).join('')}</div>
        <span class="bo-note">${c && !cUp ? '' : top === n - 1 ? 'Dernière carte : touchez pour voir le butin' : 'Glissez la carte sur le côté, ou touchez-la'}</span></div>` : ''}
    </div>${phase === 'stack' ? '<button type="button" class="bo-btn ghost bo-skip" id="bSkip">Tout voir ⏭</button>' : ''}`;
  };

  /* ---------- actions ---------- */
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
  /** Précharge calques et masques des 5 cartes pendant la coupe. */
  const preload = (r: OpenResult) => { const tmp = document.createElement('div'); tmp.style.cssText = 'position:absolute;left:-9999px;top:0'; tmp.innerHTML = r.cards.map(c => boosterCard(c, 40, '', true)).join(''); document.body.append(tmp); later(4000, () => tmp.remove()); };
  const doCut = () => {
    if (phase !== 'focus') return;
    if (!res) { later(150, doCut); return; }   // le tirage n'est pas encore arrivé : on attend un instant
    k++; phase = 'opening'; cut = 1; flash = reduced ? 0 : flash + 1; top = 0;
    sfx.tear(); haptic('medium'); render();
    later(reduced ? 400 : 1950, () => { phase = 'stack'; boom++; render(); onTop(); });
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
    render();
    // la carte qui s'envole du côté du geste
    const fly = stage.querySelector('#bFly'); if (fly && !reduced) { fly.className = 'fly ' + (dir < 0 ? 'l' : 'r'); fly.innerHTML = boosterCard(leaving, 280, '', true); later(460, () => { fly.innerHTML = ''; }); }
    if (top >= res.cards.length) later(420, finish); else onTop();
  };
  const reveal = () => {
    if (!res || up[top]) return;
    up[top] = true; const c = res.cards[top], big = ['signee', 'numero'].includes(c.variant);
    // retournement lent (1,1 s) : la face est déjà dans la carte, on bascule seulement la classe
    const fw = stage.querySelector('.flipw'); fw?.classList.add('up'); fw?.classList.remove('hid');
    later(650, () => { boom++; if (big && !reduced) flash++; render(); onTop(); });
  };
  const finish = () => { if (!res) return; k++; phase = 'recap'; up = res.cards.map(() => true); top = res.cards.length; render(); };
  const again = () => { phase = 'choose'; focus(); };

  /* ---------- gestes ---------- */
  const wire = () => {
    stage.querySelectorAll<HTMLElement>('.pw[data-i]').forEach(p => p.onclick = () => { if (phase !== 'choose') return; const i = Number(p.dataset.i); if (i !== sel) { sel = i; sfx.fwip(); render(); } });
    stage.querySelector('#bPrev')?.addEventListener('click', () => { sel = (sel + 2) % 3; render(); });
    stage.querySelector('#bNext')?.addEventListener('click', () => { sel = (sel + 1) % 3; render(); });
    stage.querySelector('#bOpen')?.addEventListener('click', focus);
    stage.querySelector('#bAuto')?.addEventListener('click', () => { touched = true; [.25, .5, .75, 1].forEach((p, j) => later(90 * (j + 1), () => p < 1 ? setCut(p) : doCut())); });
    stage.querySelector('#bSkip')?.addEventListener('click', finish);
    stage.querySelector('#bAgain')?.addEventListener('click', again);
    stage.querySelector('#bShop')?.addEventListener('click', () => { phase = 'choose'; res = null; k++; render(); });
    stage.querySelector('#bColl')?.addEventListener('click', () => { location.hash = '#/collection'; });
    // coupe : la progression ne fait qu'augmenter, elle démarre dans le premier tiers ; ouverture à 92 %
    const z = stage.querySelector<HTMLElement>('#cutZ');
    if (z) {
      const prog = (ev: PointerEvent) => { const r = z.getBoundingClientRect(), s = r.width / 280; return (ev.clientX - r.left - 30 * s) / (220 * s); };
      z.onpointerdown = ev => { try { z.setPointerCapture(ev.pointerId); } catch { /* ignoré */ } const p = prog(ev); cutting = true; if (!touched) { touched = true; stage.querySelectorAll('.runner,.chev').forEach(x => x.remove()); } setCut(p < .35 ? Math.max(0, p) : 0); };
      z.onpointermove = ev => { if (!cutting) return; const p = Math.max(cut, Math.min(1, prog(ev))); if (p - cut > .015) setCut(p); if (p >= .92) { cutting = false; doCut(); } };
      z.onpointerup = z.onpointercancel = () => { if (phase !== 'focus' || !cutting) return; cutting = false; const l = stage.querySelector<HTMLElement>('#cutL'); if (l) { l.style.transition = 'width .3s'; } setCut(0); stage.querySelector('#cutT')?.setAttribute('hidden', ''); };
      z.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); touched = true; doCut(); } };
      z.focus({ preventScroll: true });
    }
    // pile : la carte suit le doigt et pivote ; au-delà de 90 px elle s'envole ; toucher = suivante (ou retourner)
    const t = stage.querySelector<HTMLElement>('#bTop');
    if (t) {
      let x0 = 0, dx = 0, drag = false, moved = false;
      t.onpointerdown = ev => { try { t.setPointerCapture(ev.pointerId); } catch { /* ignoré */ } x0 = ev.clientX; dx = 0; drag = true; moved = false; t.classList.add('drag'); };
      t.onpointermove = ev => { if (!drag) return; dx = ev.clientX - x0; if (Math.abs(dx) > 6) moved = true; if (up[top]) t.style.transform = `translateX(${dx}px) rotate(${(dx / 18).toFixed(1)}deg)`; };
      t.onpointerup = t.onpointercancel = () => { if (!drag) return; drag = false; t.classList.remove('drag'); t.style.transform = '';
        if (Math.abs(dx) > 90 && up[top]) advance(dx < 0 ? -1 : 1); else if (!moved) advance(-1); };
      if (phase === 'stack') t.focus({ preventScroll: true });
    }
  };
  const setCut = (p: number) => {
    cut = p; const l = stage.querySelector<HTMLElement>('#cutL'), tip = stage.querySelector<HTMLElement>('#cutT'), z = stage.querySelector<HTMLElement>('#cutZ');
    if (l) { if (p > 0) l.style.transition = 'none'; l.style.width = Math.round(p * 220) + 'px'; }
    if (tip) { tip.hidden = !cutting || p <= 0; tip.style.left = Math.round(p * 220) + 'px'; }
    z?.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    const now = performance.now(); if (p > 0 && now - lastTick > 45) { lastTick = now; sfx.cut(p); }
    const step = Math.floor(p * 10); if (step > lastBuzz) { lastBuzz = step; haptic('light'); } if (p === 0) lastBuzz = 0;
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
export function recapHTML(r: OpenResult, price = `${BOOSTER_PRICE} 🪙`) {
  return `<div class="bo-recap">
    <h2 class="fi">Votre butin</h2>
    ${r.divine ? '<div class="fi divb">✦ Booster divin · 1 sur 2 000 ✦</div>' : ''}
    <div class="bo-grid">${r.cards.map((c, i) => { const vi = VARIANT_INFO[c.variant];
      return `<figure style="animation-delay:${(.08 + i * .1).toFixed(2)}s">${boosterCard(c, 150)}<figcaption><b>${esc(CARD_BY_ID[c.card_id].name)}</b>
        <span style="color:${vi.color}">${vi.stars} ${esc(vi.name)}${c.serial ? ` · N° ${String(c.serial).padStart(3, '0')} / 100` : ''}</span>
        <span class="tag${c.duplicate ? ' dup' : ''}">${c.duplicate ? `Doublon · +${c.shards} ◆` : 'Nouveau'}</span></figcaption></figure>`; }).join('')}</div>
    <div class="bo-sum fi"><span class="nw">+${r.new} nouvelle${r.new > 1 ? 's' : ''} variante${r.new > 1 ? 's' : ''}</span><span class="sh">+${r.shards_gained} ◆ éclats</span></div>
    <div class="bo-ct fi"><span>Collection · Série 1</span><b>${r.owned} / ${r.total} variantes</b></div>
    <div class="bo-bar fi"><div style="--a:${(r.owned_before / r.total * 100).toFixed(1)}%;--b:${(r.owned / r.total * 100).toFixed(1)}%"></div></div>
    <div class="bo-btns fi"><button type="button" class="bo-btn gold big" id="bAgain">Ouvrir un autre · ${price}</button><button type="button" class="bo-btn big" id="bColl">Voir la collection</button><button type="button" class="bo-btn ghost" id="bShop">Changer de booster</button></div>
  </div>`;
}
