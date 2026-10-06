// Rendu des cartes : illustrations Cartes-v3 (web/public/cards/*.webp, docs/cartes-v3/PROMPT-claude-code.md, Prompt A)
// pour toutes les cartes ; seul le dos garde la face « Mers Sauvages », qui sert aussi de repli si une image ne se charge pas.
// Le médaillon du coin haut-droit des cartes numérotées est vide dans l'image : c'est le code qui écrit le chiffre.
import { ALT2, ALT2B, NUM2 } from './cardsdata';
import { cname, DESC, PIRATES, type Card, type Entry } from '@engine';
import { esc } from './util';

const wrapF = (b: number, h: string) => `<div class="fb${b}">${h}</div>`;
const A = ALT2 as Record<string, string>, AB = ALT2B as Record<string, number>, NUM = NUM2 as Record<string, any>;

/** Version des illustrations, ajoutée aux URL : un nouveau jeu de cartes est rechargé sans vider le cache à la main. */
export const ART_VERSION = 3;
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
/** Face illustrée (image + médaillon chiffre + sceau) ; data-c permet de revenir à l'ancienne face. */
function artFace(c: Partial<Card>, key: string): string {
  let overlays = '';
  if (c.kind === 'num' && !c.wild) overlays += medallion(c);
  const d = esc(JSON.stringify({ kind: c.kind, suit: c.suit, rank: c.rank, pid: c.pid, v: c.v, zf: c.zf, wild: c.wild, exp: c.exp }));
  return `<div class="art" data-c="${d}"><img src="${ART[key]}" alt="" decoding="async" draggable="false">${overlays}</div>`;
}

export function faceOf(key: string) { return wrapF(AB[key], A[key]); }
export function faceHTML(c: Partial<Card>): string {
  const key = cardKey(c);
  return ART[key] ? artFace(c, key) : oldFace(c);
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
export function cardHTML(c: Partial<Card>, e?: Partial<Entry> | null, extra = '', attrs = '') {
  const k = c.kind; let cl = 'card k-' + (c.wild ? 'wild' : k);
  if (k === 'num' && !c.wild) cl += ' s-' + c.suit;
  let tag = '';
  if (e && e.as) tag = e.as === 'pirate' ? 'Pirate' : 'Fuite';
  if (e && c.zf && e.val != null) tag = 'vaut ' + e.val;
  // Grand Quinze (le capucin) : plus d'étiquette, un liseré de la couleur choisie (le nom reste dans le libellé accessible)
  if (e && c.wild && e.ws) cl += ' ws-' + e.ws;
  // données pour le zoom au survol long : nom affichable (noms officiels du moteur) + règle en français
  const key = cardKey(c);
  let dataAttrs = '';
  if (ART[key]) {
    const name = c.kind === 'pirate' && c.pid ? PIRATES[c.pid].n : cname(c as Card), rule = ruleOf(c);
    dataAttrs = ` data-art-name="${esc(name)}"${rule ? ` data-art-rule="${esc(rule)}"` : ''}`;
  }
  // nom accessible pour les lecteurs d'écran ; pas d'attribut title (l'info-bulle native fait doublon avec la fiche de zoom) ;
  // la main remplace role et libellé quand la carte devient jouable
  return `<div class="${cl} ${extra}" data-id="${c.id}" role="img" aria-label="${esc(cname(c as Card, e ?? undefined))}"${dataAttrs} ${attrs}><div class="face">${faceHTML(c)}</div>${tag ? `<span class="tag">${tag}</span>` : ''}</div>`;
}
export const backFace = () => `<div class="face">${faceOf('back')}</div>`;

/** Précharge les illustrations au premier affichage de la table pour éviter un clignotement. */
let preloaded = false;
export function preloadArt() {
  if (preloaded) return; preloaded = true;
  for (const k of Object.keys(ART)) { try { const img = new Image(); img.decoding = 'async'; img.src = ART[k]; } catch { /* navigateur très ancien : tant pis */ } }
}
/** Une illustration qui ne se charge pas est remplacée par l'ancienne face (toutes les pages). */
let fallback = false;
export function installArtFallback() {
  if (fallback) return; fallback = true;
  document.addEventListener('error', ev => {
    const img = ev.target as HTMLElement; if (img?.tagName !== 'IMG') return;
    const art = img.parentElement; if (!art?.classList.contains('art')) return;
    try { art.outerHTML = oldFace(JSON.parse(art.dataset.c || '{}')); } catch { /* face laissée telle quelle */ }
  }, true);
}
