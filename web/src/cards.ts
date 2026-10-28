// Rendu des cartes : illustrations Cartes-v3 (web/public/cards/*.webp, docs/cartes-v3/PROMPT-claude-code.md, Prompt A)
// pour toutes les cartes ; seul le dos garde la face « Mers Sauvages », qui sert aussi de repli si une image ne se charge pas.
// Le médaillon du coin haut-droit des cartes numérotées est vide dans l'image : c'est le code qui écrit le chiffre.
// Depuis B7, chaque face est en deux calques (docs/cartes-couches/) : cadre d'origine par-dessus l'illustration seule.
import { ALT2, ALT2B, NUM2 } from './cardsdata';
import { cname, DESC, PIRATES, type Card, type Entry } from '@engine';
import { esc } from './util';
import { CALQUES, MER, cadreUrl, illuUrl, illuBox, masks, signer, windowBox } from './calques';
import { serialLabel, type Variant } from '@shared/collection.ts';

const wrapF = (b: number, h: string) => `<div class="fb${b}">${h}</div>`;
const A = ALT2 as Record<string, string>, AB = ALT2B as Record<string, number>, NUM = NUM2 as Record<string, any>;

/** Version des illustrations, ajoutée aux URL : un nouveau jeu de cartes est rechargé sans vider le cache à la main. */
export const ART_VERSION = 4;
const file = (f: string) => `cards/${f}.webp?v=${ART_VERSION}`;
/** Correspondance clé → fichier illustré (web/public/cards/<fichier>). Chemin relatif pour Capacitor (base './').
 *  Note : Con le belliqueux est servi par corbin.webp (et pas con.webp) parce que CON est un nom de périphérique
 *  réservé sous Windows — le fichier est inaccessible dès qu'il s'appelle ainsi. */
export const ART: Record<string, string> = Object.fromEntries(Object.entries({
  rosie: 'rosie', bahij: 'bahij', rascal: 'rascal', juanita: 'juanita', harry: 'harry', mary: 'mary', con: 'corbin', sk: 'sk',
  mermaid0: 'mermaid0', mermaid1: 'mermaid1', tigress: 'tigress', kraken: 'kraken', whale: 'whale', escape: 'escape', loot: 'loot',
  volley: 'volley', stingray: 'stingray', plank: 'plank', davy: 'davy', wild: 'wild',
  'suit-yellow': 'suit-yellow', 'suit-purple': 'suit-purple', 'suit-green': 'suit-green', 'suit-black': 'suit-black',
}).map(([k, f]) => [k, file(f)]));

/** Clé « canonique » d'une carte pour chercher l'illustration. */
export function cardKey(c: Partial<Card>): string {
  if (c.kind === 'pirate') return c.pid!;
  if (c.kind === 'mermaid') return 'mermaid' + (c.v || 0);
  if (c.kind === 'num') return c.wild ? 'wild' : 'suit-' + c.suit;
  return c.kind as string;
}

/** Chiffre et éventuel sceau (bonus) pour une carte numérotée illustrée (pas le Grand Quinze : son « 15 » est dessiné). */
function medallion(c: Partial<Card>): string {
  const suit = c.suit as string, suitClass = ' s-' + suit;
  // 0/14 : « 0·14 » plus petit, pas de sceau
  if (c.zf) return `<span class="art-num zf${suitClass}">0·14</span>`;
  const r = c.rank!;
  const two = r > 9 ? ' n2' : '';
  let num = `<span class="art-num${two}${suitClass}">${r}</span>`;
  let seal = '';
  if (r === 14) seal = `<span class="art-seal">+${suit === 'black' ? 20 : 10}</span>`;
  else if (c.exp && r === 7) seal = '<span class="art-seal neg">−5</span>';
  else if (c.exp && r === 8) seal = '<span class="art-seal">+5</span>';
  return num + seal;
}
/** Ancienne face « Mers Sauvages » (repli si l'illustration ne se charge pas). */
function oldFace(c: Partial<Card>): string {
  if (c.kind === 'num') {
    if (c.wild) return wrapF(2, A.wild);
    const S = NUM[c.suit as string];
    if (c.exp) return wrapF(2, c.zf ? S.xzf : S['x' + c.rank]);
    return wrapF(1, c.rank === 14 ? S['14'] : S.t.split('{N}').join(String(c.rank)));
  }
  const k = c.kind === 'pirate' ? c.pid! : c.kind === 'mermaid' ? 'mermaid' + (c.v || 0) : c.kind as string;
  return wrapF(AB[k], A[k]);
}
/** Cartes en couches : réglage serveur cards_layered (table app_settings), activé par défaut. Coupé, chaque face
 *  revient à l'image unique cards/<fichier>.webp. */
let layered = true;
export const isLayered = () => layered;
export function setLayered(v: boolean) { layered = v; }
const pc = (n: number) => n + '%';
const boxStyle = (b: { l: number; t: number; w: number; h: number }) => `left:${pc(b.l)};top:${pc(b.t)};width:${pc(b.w)};height:${pc(b.h)}`;
/** Calques de bas en haut : fenêtre (overflow:hidden) avec l'illustration, puis cadre d'origine (inset:0).
 *  .lay reprend le rognage de l'image unique (720 × 1024 posée sur 252 × 352 : 3,2 px en haut et en bas), pour que
 *  les chiffres et les sceaux, placés en % de la face, ne bougent pas. */
/** Variante visuelle (B8, D14) : n'a aucun effet sur le jeu. still = sans animation. */
export interface CardLook { variant?: Variant; serial?: number | null; still?: boolean }
const RING: Partial<Record<Variant, string>> = { patine: 'patine', etain: 'etain', holo: 'prism', nacre: 'nacre', signee: 'signe', numero: 'nacre' };
function layers(key: string, v: Variant, serial?: number | null): string {
  const holo = v === 'holo' || v === 'numero', viv = v === 'vivante' || v === 'numero', sig = v === 'signee' || v === 'numero';
  const ib = boxStyle(illuBox(key)), src = illuUrl(key), bgImg = `style="background-image:url(${src})"`;
  // 1. fenêtre d'illustration : seule zone animée (fond, personnage en parallaxe, reflets, signature)
  let bg = `<img class="illu" src="${src}" alt="" decoding="async" draggable="false">`;
  if (viv && MER.has(key)) { bg += `<div class="rip" ${bgImg}></div>`; ensureRipFilter(); }
  if (holo) bg += '<div class="foil"></div><div class="engr"></div><div class="crest"></div><div class="glit"></div>';
  if (viv) bg += '<div class="motes"></div>';
  let win = `<div class="mv bg" style="${ib}">${bg}</div>`;
  if (viv) win += `<div class="mv fgm" style="${ib}"><div class="fg" ${bgImg}></div></div><div class="rays"></div><div class="light"></div>`;
  if (v === 'patine') win += '<div class="stain"></div>';
  if (v === 'nacre' || v === 'signee') win += '<div class="sheen"></div>';
  if (sig) { const s = signer(key); win += `<div class="sig" style="--sz:${Math.min(.25, 1.8 / s.length).toFixed(3)}">${esc(s)}</div>`; }
  // 2. cadre d'origine (fenêtre transparente) : jamais animé, jamais recoloré ; 3. matière de toute la marge, ajouts
  let top = RING[v] ? `<div class="ring ${RING[v]}"></div>` : '';
  if (v === 'etain') top += '<div class="riv" style="left:1%;top:.8%"></div><div class="riv" style="right:1%;top:.8%"></div><div class="riv" style="left:1%;bottom:.8%"></div><div class="riv" style="right:1%;bottom:.8%"></div>';
  if (v === 'numero' && serial) top += `<div class="serial">${serialLabel(serial)}</div>`;
  return `<div class="lay"><div class="win" style="${boxStyle(windowBox(key))}">${win}</div>`
    + `<img class="cadre" src="${cadreUrl(key)}" alt="" decoding="async" draggable="false">${top}</div>`;
}
/** Filtre SVG de l'ondulation de la mer (Vivante des cartes marines), ajouté une seule fois dans la page. */
function ensureRipFilter() {
  if (typeof document === 'undefined' || document.getElementById('k4rip')) return;
  const add = () => {
    if (document.getElementById('k4rip')) return;
    const d = document.createElement('div');
    d.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="k4rip" x="-5%" y="-5%" width="110%" height="110%" primitiveUnits="objectBoundingBox"><feTurbulence type="fractalNoise" baseFrequency="1.6 9" numOctaves="1" seed="4" result="n"><animate attributeName="baseFrequency" dur="8s" values="1.6 9;1.9 11;1.6 9" repeatCount="indefinite"/></feTurbulence><feOffset in="n" dx="0" dy="0" result="m"><animate attributeName="dy" dur="8s" values="0;.04;0" repeatCount="indefinite"/></feOffset><feDisplacementMap in="SourceGraphic" in2="m" scale=".022" xChannelSelector="R" yChannelSelector="G"/></filter></svg>';
    document.body.append(d.firstChild!);
  };
  document.body ? add() : addEventListener('DOMContentLoaded', add);
}
/** Masques d'une carte déjà demandés (préchargés une seule fois). */
const maskLoaded = new Set<string>();
function preloadMasks(key: string) {
  if (maskLoaded.has(key) || typeof Image === 'undefined') return; maskLoaded.add(key);
  for (const u of Object.values(masks(key))) { try { const i = new Image(); i.src = u; } catch { /* ignoré */ } }
}
const cardData = (c: Partial<Card>) => esc(JSON.stringify({ kind: c.kind, suit: c.suit, rank: c.rank, pid: c.pid, v: c.v, zf: c.zf, wild: c.wild, exp: c.exp }));
/** Face illustrée (calques ou image unique, + médaillon chiffre + sceau) ; data-c permet de revenir en arrière. */
function artFace(c: Partial<Card>, key: string, flat = !layered, look: CardLook = {}): string {
  const overlays = c.kind === 'num' && !c.wild ? medallion(c) : '';
  if (!flat && CALQUES[key]) {
    const v = look.variant && look.variant !== 'std' ? look.variant : 'std';
    let cls = 'art layered', style = '';
    if (v !== 'std') {
      const m = masks(key); preloadMasks(key);
      cls += ` fx ${v === 'numero' ? 'vivante numero' : v}${look.still ? ' still' : ' auto'}`;
      style = ` style="--mk:url(${m.marge});--fo:url(${m.foil});--fd:url(${m.fond})"`;
    }
    return `<div class="${cls}" data-c="${cardData(c)}" data-k="${key}"${style}>${layers(key, v, look.serial)}${overlays}</div>`;
  }
  return `<div class="art" data-c="${cardData(c)}"><img src="${ART[key]}" alt="" decoding="async" draggable="false">${overlays}</div>`;
}

export function faceOf(key: string) { return wrapF(AB[key], A[key]); }
export function faceHTML(c: Partial<Card>, look?: CardLook): string {
  const key = cardKey(c);
  return ART[key] ? artFace(c, key, !layered, look) : oldFace(c);
}
/** Règle en toutes lettres pour la fiche du zoom (les illustrations n'ont plus de texte), sans répéter le nom. */
function ruleOf(c: Partial<Card>): string {
  if (c.kind === 'pirate' && c.pid) { const pw = PIRATES[c.pid].pw; return pw.charAt(0).toUpperCase() + pw.slice(1) + '.'; }
  if (c.kind === 'num' && !c.wild) {
    if (c.zf) return DESC.zf.replace(/^0\/14 : a/, 'A');
    if (c.rank === 14) return 'Si vous remportez ce pli, bonus de +' + (c.suit === 'black' ? 20 : 10) + ' points.';
    if (c.exp && c.rank === 7) return 'Si vous remportez ce pli, malus de −5 points.';
    if (c.exp && c.rank === 8) return 'Si vous remportez ce pli, bonus de +5 points.';
    return c.suit === 'black' ? 'Atout : bat toutes les cartes des autres couleurs.' : '';
  }
  // les descriptions du moteur commencent par le nom (« Skull King, roi des pirates : … ») : la fiche l'affiche déjà en titre
  const t = DESC[c.wild ? 'wild' : c.kind as string] || '', n = cname(c as Card), i = t.indexOf(' : '), pre = t.slice(0, i);
  return i > 0 && i < 45 && (pre.startsWith(n) || n.startsWith(pre) || pre.startsWith(n.replace(/^(Le|La) /, ''))) ? t.charAt(i + 3).toUpperCase() + t.slice(i + 4) : t;
}
export function cardHTML(c: Partial<Card>, e?: Partial<Entry> | null, extra = '', attrs = '', look?: CardLook) {
  const k = c.kind; let cl = 'card k-' + (c.wild ? 'wild' : k);
  if (k === 'num' && !c.wild) cl += ' s-' + c.suit;
  let tag = '';
  if (e && e.as) tag = e.as === 'pirate' ? 'Pirate' : 'Fuite';
  if (e && c.zf && e.val != null) tag = 'vaut ' + e.val;
  // Grand Quinze (le capucin) : plus d'étiquette, un liseré de la couleur choisie (le nom reste dans le libellé accessible)
  if (e && c.wild && e.ws) cl += ' ws-' + e.ws;
  // données pour le zoom au survol long : nom affichable (noms officiels du moteur) + règle en français
  const key = cardKey(c);
  let dataAttrs = '', nameTag = '';
  if (ART[key]) {
    const name = c.kind === 'pirate' && c.pid ? PIRATES[c.pid].n : cname(c as Card), rule = ruleOf(c);
    dataAttrs = ` data-art-name="${esc(name)}"${rule ? ` data-art-rule="${esc(rule)}"` : ''}`;
    // personnages sans bandeau (B8) : le nom n'est plus peint, il s'affiche au survol
    if (layered && CALQUES[key]?.sans_bandeau) nameTag = `<span class="cname" aria-hidden="true">${esc(name)}</span>`;
  }
  if (look?.variant && look.variant !== 'std') dataAttrs += ` data-variant="${look.variant}"`;
  // nom accessible pour les lecteurs d'écran ; pas d'attribut title (l'info-bulle native fait doublon avec la fiche de zoom) ;
  // la main remplace role et libellé quand la carte devient jouable
  return `<div class="${cl} ${extra}" data-id="${c.id}" role="img" aria-label="${esc(cname(c as Card, e ?? undefined))}"${dataAttrs} ${attrs}><div class="face">${faceHTML(c, look)}</div>${nameTag}${tag ? `<span class="tag">${tag}</span>` : ''}</div>`;
}
export const backFace = () => `<div class="face">${faceOf('back')}</div>`;

/** Précharge les illustrations au premier affichage de la table pour éviter un clignotement. */
let preloaded = false;
export function preloadArt() {
  if (preloaded) return; preloaded = true;
  const urls = layered ? Object.keys(CALQUES).flatMap(k => [cadreUrl(k), illuUrl(k)]) : Object.values(ART);
  for (const u of urls) { try { const img = new Image(); img.decoding = 'async'; img.src = u; } catch { /* navigateur très ancien : tant pis */ } }
}
/** Une image de carte qui ne se charge pas : les calques laissent place à l'image unique, et l'image unique à
 *  l'ancienne face (toutes les pages). */
let fallback = false;
export function installArtFallback() {
  if (fallback) return; fallback = true;
  document.addEventListener('error', ev => {
    const img = ev.target as HTMLElement; if (img?.tagName !== 'IMG') return;
    const art = img.closest('.art') as HTMLElement | null; if (!art) return;
    try {
      const c = JSON.parse(art.dataset.c || '{}');
      art.outerHTML = art.classList.contains('layered') ? artFace(c, cardKey(c), true) : oldFace(c);
    } catch { /* face laissée telle quelle */ }
  }, true);
}
