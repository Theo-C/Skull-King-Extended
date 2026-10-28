// Boosters de cartes (D14, D14b) : visuels des sachets et des dos, et écran d'ouverture.
// L'écran est le composant <booster-opening> (web/src/booster/booster-opening.js, docs/boosters/PROMPT-ouverture-composant.md),
// portage fidèle de la maquette Booster : on ne fait ici que le brancher (sachets, tirage du serveur, rendu de nos cartes,
// sons, vibrations, gyroscope) sans toucher à ses durées, courbes ni distances. Le tirage est fait par le serveur
// (booster.open, pièces débitées) dès que l'on choisit le sachet ; le composant le met en scène sans rien dévoiler avant.
import './styles/booster.css';
import './booster/booster-opening.js';
import { callGame } from './api';
import { esc, toast } from './util';
import { cardHTML, RIP_SVG } from './cards';
import { sfx } from './sfx';
import type { CallGame } from './pages/collection';
import { boosterReduced, cardsStill } from './locker';
import { PACKS, PACK_BY_ID, CARD_BY_ID, VARIANT_INFO, BOOSTER_PRICE, ODDS, SERIES, TIER_OF, NUMBERED_MAX, serialLabel, drawBooster, type Variant } from '@shared/collection.ts';

/** Comptes qui voient le bouton « Essai gratuit » (aussi en développement, ou avec localStorage pli-debug = 1 sur l'appareil). */
const TESTEURS = ['theo.capitaine2@gmail.com', 'theo.capitaine@clesence.fr'];
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
/** Carte telle que le composant l'attend (rarity : c, r, e, l, m), plus le numéro brut pour notre rendu. */
interface CompCard { id: string; name: string; variant: Variant; rarity: string; isNew: boolean; shards: number; serial: string; n: number | null }

const tierOf = (v: Variant) => v === 'std' ? 'c' : TIER_OF[v];

/** Vibrations (app mobile : Capacitor Haptics si présent, sinon l'API du navigateur). */
function haptic(kind: 'light' | 'medium' | 'heavy') {
  try {
    const H = (window as any).Capacitor?.Plugins?.Haptics;
    if (H?.impact) { H.impact({ style: kind.toUpperCase() }); return; }
    navigator.vibrate?.(kind === 'light' ? 8 : kind === 'medium' ? 25 : [40, 30, 60]);
  } catch { /* pas de vibration */ }
}

/** Styles des cartes, partagés (une seule feuille construite) par toutes les cartes rendues dans le composant : ses cartes
 *  vivent dans son Shadow DOM, où game.css ne s'applique pas. Chaque carte a sa propre petite racine fantôme : nos
 *  classes (.face, .tag…) n'y croisent jamais celles du composant. On n'y recopie que ce qui concerne les cartes (~10 %
 *  des règles du site) : avec la feuille entière, chaque racine coûtait un calcul de styles qui faisait perdre des images. */
const CARD_RULE = /\.(card|art|art-num|art-seal|face|lay|layered|cadre|illu|fx|cname|serial)(?![\w-])|:root/;
let cardSheet: CSSStyleSheet | null = null;
function cardStyles() {
  if (cardSheet) return cardSheet;
  const keep = (r: CSSRule): string => {
    if (r instanceof CSSStyleRule) return CARD_RULE.test(r.selectorText) ? r.cssText : '';
    if (r instanceof CSSKeyframesRule || (typeof CSSPropertyRule !== 'undefined' && r instanceof CSSPropertyRule)) return r.cssText;
    // l'écran Booster ignore le réglage système (animations de Windows coupées = variantes figées) : c'est l'option du
    // Casier « Ouverture des boosters réduite » qui fige les cartes (renderCard, still)
    if (r instanceof CSSMediaRule && /prefers-reduced-motion/.test(r.conditionText)) return '';
    if (r instanceof CSSMediaRule || r instanceof CSSSupportsRule) {
      const inner = Array.from(r.cssRules).map(keep).join('');
      return inner ? `${r instanceof CSSMediaRule ? '@media ' + r.conditionText : '@supports ' + r.conditionText}{${inner}}` : '';
    }
    return '';   // @import, @font-face (polices déjà chargées par la page)
  };
  const css: string[] = [];
  for (const s of Array.from(document.styleSheets)) {
    try { for (const r of Array.from(s.cssRules)) { const t = keep(r); if (t) css.push(t); } }
    catch { /* feuille d'une autre origine (polices Google) : rien à recopier */ }
  }
  cardSheet = new CSSStyleSheet(); cardSheet.replaceSync(css.join('\n'));
  return cardSheet;
}
/** renderCard du composant : notre carte (calques, variante, numéro), à la largeur demandée. */
function renderCard(c: Partial<CompCard> & { id: string; variant?: Variant }, { width, still }: { width: number; still?: boolean }) {
  const host = document.createElement('div'), def = CARD_BY_ID[c.id];
  host.className = 'pli-card'; host.style.cssText = 'position:relative;display:block';
  const sr = host.attachShadow({ mode: 'open' }); sr.adoptedStyleSheets = [cardStyles()];
  // filtre SVG de la mer qui ondule (Vivante) embarqué : url(#k4rip) ne voit pas au-delà de la racine fantôme
  sr.innerHTML = def ? `${RIP_SVG}<div style="display:flex;justify-content:center;width:100%;height:100%">${cardHTML({ id: 0, ...def.card }, null, '', `style="--s:${(width / 252).toFixed(4)}"`, { variant: c.variant ?? 'std', serial: c.n ?? null, still: still || boosterReduced() || cardsStill() })}</div>` : '';
  return host;
}

/** Écran d'ouverture. api : callGame (remplacé par le banc d'essai web/banc/ecrans.ts). */
export async function boosterPage(root: HTMLElement, query = new URLSearchParams(), api: CallGame = callGame, tester = false) {
  // Mode essai (#/boosters?essai=1) : tirage fait ici, avec les mêmes chances que le serveur (drawBooster), sans appeler
  // booster.open : ni pièces, ni booster offert, ni collection, ni éclats, ni annonce. Pour tester l'ouverture à volonté.
  const essai = query.get('essai') === '1';
  let w: Wallet = { coins: 0, shards: 0, boosters: 0, free_today: false, free_daily: true };
  try { w = await api<Wallet>('collection.list', {}); } catch (e: any) { toast(e.message, 'err'); }

  root.innerHTML = `<section class="bo"><header class="bo-head"><h1>Boosters</h1>${essai ? '<span class="bo-essai-tag">Mode essai · rien n’est enregistré</span>' : ''}<span class="bo-ser">Série 1 · <b>${esc(SERIES.name)}</b></span>
      <span class="bo-wallet" id="boW"></span></header>
    <div class="bo-cols">
      <aside class="bo-left">
        <div class="bo-panel" id="boFree"></div>
        <div class="bo-panel"><div class="bo-lbl">Chances par carte</div>
          <p class="bo-note">Cartes 1 à 3 : toujours Patinée ou Bord d’étain.</p>
          <table class="bo-odds"><tr class="h"><td>Variante</td><td>Carte 4</td><td>Carte 5</td></tr>
          ${ODDS.map(o => `<tr><td style="color:${VARIANT_INFO[o.tier === 'r' ? 'holo' : o.tier === 'e' ? 'nacre' : o.tier === 'l' ? 'signee' : 'numero'].color}">${o.label}</td><td>${String(o.slot4).replace('.', ',')} %</td><td>${String(o.slot5).replace('.', ',')} %</td></tr>`).join('')}</table>
          <p class="bo-note">Booster divin : 1 sur 2 000, 5 cartes Signées ou Numérotées. Les doublons sont recyclés en éclats à l’ouverture.</p></div>
      </aside>
      <booster-opening class="bo-comp"></booster-opening>
    </div></section>`;
  const sec = root.querySelector<HTMLElement>('.bo')!, comp = root.querySelector('booster-opening') as HTMLElement & Record<string, any>;

  const paint = () => {
    root.querySelector('#boW')!.innerHTML = `<span><span class="coin"></span> ${w.coins.toLocaleString('fr-FR')}</span><span class="sh">◆ ${w.shards.toLocaleString('fr-FR')} éclats</span><span>${w.boosters} offert${w.boosters > 1 ? 's' : ''}</span><a href="#/collection">Collection</a>`
      + (essai ? '<a href="#/boosters" class="bo-essai on">Quitter l’essai</a>' : tester ? '<a href="#/boosters?essai=1" class="bo-essai">Essai gratuit</a>' : '');
    root.querySelector('#boFree')!.innerHTML = `<div class="bo-lbl">Booster gratuit</div><div class="bo-free"><span class="hg" aria-hidden="true">⏳</span><b>${
      w.boosters ? `${w.boosters} booster${w.boosters > 1 ? 's' : ''} offert${w.boosters > 1 ? 's' : ''} à ouvrir` : !w.free_daily ? 'Pas de booster gratuit en ce moment' : w.free_today ? 'Reçu aujourd’hui : à demain !' : 'Après votre 1re partie du jour'}</b></div>
      <p class="bo-note">${essai ? 'Mode essai : ouvertures illimitées et gratuites, rien n’est ajouté à votre collection.' : '1 booster gratuit par jour où vous jouez. Une victoire en donne un aussi. Un booster offert est utilisé en premier.'}</p>`;
    comp.coins = w.coins;
    comp.price = essai ? 0 : BOOSTER_PRICE;
    comp.freeLabel = essai ? 'mode essai' : w.boosters ? `${w.boosters} offert${w.boosters > 1 ? 's' : ''}` : w.free_daily && !w.free_today ? 'après votre 1re partie du jour' : '';
  };

  /* ---------- branchement du composant ---------- */
  const toComp = (r: OpenResult) => {
    const cards = r.cards.map((c): CompCard => ({ id: c.card_id, name: CARD_BY_ID[c.card_id]?.name ?? c.card_id, variant: c.variant, rarity: tierOf(c.variant),
      isNew: !c.duplicate, shards: c.shards, serial: c.serial ? serialLabel(c.serial).replace(/^N° /, '') : '', n: c.serial }));
    preload(cards);
    return { divine: !!r.divine, collection: { before: r.owned_before, after: r.owned, total: r.total || 1 }, cards };
  };
  /** Pendant la coupe (ANIMATIONS.md, règle 6) : les 5 cartes rendues une fois hors écran, aux largeurs de la pile et du
   *  butin, pour que calques, masques et illustrations soient déjà décodés quand on fait défiler la pile. */
  const preload = (cards: CompCard[]) => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-4000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none';
    for (const c of cards) for (const width of [280, 150]) box.append(renderCard(c, { width, still: true }));
    document.body.append(box); setTimeout(() => box.remove(), 6000);
  };
  const openServer = async (pack: string) => {
    const r = await api<OpenResult>('booster.open', { pack });
    w = { ...w, coins: r.coins, boosters: r.boosters, shards: r.shards }; paint();
    return toComp(r);
  };
  const openEssai = async (pack: string) => {
    const d = drawBooster(pack, Math.random), n = w.owned?.length ?? 0;
    return toComp({ ok: true, pack, divine: d.divine, paid: 'essai', shards_gained: 0, new: 0, owned: n, owned_before: n, total: w.total ?? 1,
      coins: w.coins, boosters: w.boosters, shards: w.shards,
      cards: d.cards.map(c => ({ ...c, serial: c.variant === 'numero' ? 1 + Math.floor(Math.random() * NUMBERED_MAX) : null, duplicate: false, shards: 0 })) });
  };
  // animation complète, quel que soit le réglage du système ; le Casier propose « Ouverture des boosters réduite » (fondu)
  comp.toggleAttribute('reduce', boosterReduced());
  comp.cardsBase = 'cards/';
  comp.renderCard = renderCard;
  comp.open = essai ? openEssai : openServer;
  // sons du composant → sfx.ts. « tear » sert à la coupe (déchirure du papier) et au retournement de la 5e carte
  // (frottement) ; le composant ne joue « cut » qu'au premier contact : le crissement suit le doigt grâce à la vibration
  // légère qu'il envoie tous les 10 % de coupe
  let cutStep = 0;
  const SFX: Record<string, () => void> = {
    crinkle: () => sfx.crinkle(), cut: () => { cutStep = 0; sfx.cut(0); }, tear: () => comp.phase === 'stack' ? sfx.flip() : sfx.rip(),
    swipe: () => sfx.fwip(), chime: () => sfx.reveal('r'), chord: () => sfx.reveal('e'), fanfare: () => sfx.reveal('l'),
  };
  comp.haptics = (kind: 'light' | 'medium' | 'heavy') => { haptic(kind); if (kind === 'light' && comp.phase === 'focus') sfx.cut(Math.min(1, ++cutStep / 10)); };
  comp.sfx = (name: string) => SFX[name]?.();
  // inclinaison des cartes au gyroscope sur téléphone ; iOS demande la permission au premier toucher
  comp.gyro = matchMedia('(pointer: coarse)').matches;
  if (comp.gyro) comp.addEventListener('pointerdown', () => { (window as any).DeviceOrientationEvent?.requestPermission?.().catch(() => { /* refusée : inclinaison au doigt */ }); }, { once: true });
  paint();
  comp.packs = PACKS.map(p => ({ id: p.id, name: p.name, desc: p.desc, sachet: packArt(p.id), back: packBack(p.id), featured: p.featured }));
  // sachet demandé par la Boutique (#/boosters?pack=…)
  const want = PACKS.findIndex(p => p.id === query.get('pack'));
  if (want > 0) { comp.sel = want; comp.renderChoose?.(); }

  /* ---------- événements ---------- */
  comp.addEventListener('booster-done', async () => {
    if (essai) return;
    try { w = await api<Wallet>('collection.list', {}); paint(); } catch { /* le porte-monnaie reste celui de l'ouverture */ }
  });
  comp.addEventListener('booster-collection', () => { location.hash = '#/collection'; });
  comp.addEventListener('booster-close', () => paint());
  comp.addEventListener('booster-error', (ev: Event) => { toast((ev as CustomEvent).detail?.message || 'Ouverture impossible pour le moment.', 'err'); });

  /* ---------- toute la hauteur sous la barre du site (au téléphone, moins la barre d'onglets du bas) ---------- */
  const fit = () => {
    const tab = document.querySelector<HTMLElement>('.tabbar'), tabH = tab && getComputedStyle(tab).display !== 'none' ? tab.offsetHeight : 0;
    sec.style.height = Math.max(560, Math.floor(innerHeight - (sec.getBoundingClientRect().top + scrollY) - tabH)) + 'px';
  };
  fit(); addEventListener('resize', fit);
  return { destroy: () => { removeEventListener('resize', fit); comp.remove(); } };
}
