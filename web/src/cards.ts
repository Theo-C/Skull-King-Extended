// Rendu des cartes : faces illustrées (web/public/cards, docs/cartes-v3), avec repli sur les faces « Mers Sauvages ».
import { ALT2, ALT2B, NUM2 } from './cardsdata';
import { cardTitle, cname, DESC, PIRATES, SUIT, type Card, type Entry } from '@engine';
import { esc } from './util';
import PASTILLES from './pastilles.json';

const wrapF = (b: number, h: string) => `<div class="fb${b}">${h}</div>`;
const A = ALT2 as Record<string, string>, AB = ALT2B as Record<string, number>, NUM = NUM2 as Record<string, any>;
const PAST = PASTILLES as Record<string, string>;

/** Clé d'illustration → fichier de web/public/cards (con.webp s'appelle corbin.webp : « CON » est un nom réservé sous Windows). */
export const ART: Record<string, string> = {
  rosie: 'rosie', bahij: 'bahij', rascal: 'rascal', juanita: 'juanita', harry: 'harry', mary: 'mary', con: 'corbin',
  sk: 'sk', mermaid0: 'mermaid0', mermaid1: 'mermaid1', tigress: 'tigress', kraken: 'kraken', whale: 'whale', escape: 'escape',
  loot: 'loot', volley: 'volley', stingray: 'stingray', plank: 'plank', davy: 'davy', wild: 'wild',
  yellow: 'suit-yellow', purple: 'suit-purple', green: 'suit-green', black: 'suit-black',
};
// couleur du chiffre dans le médaillon, selon la couleur de la carte
const INK: Record<string, string> = { yellow: '#2b1d0c', purple: '#2b1838', green: '#12301a', black: '#f0d078' };

/** Clé de l'ancienne face et de l'illustration. */
function keyOf(c: Partial<Card>) {
  if (c.kind === 'num') return c.wild ? 'wild' : c.suit as string;
  if (c.kind === 'pirate') return c.pid!;
  if (c.kind === 'mermaid') return 'mermaid' + (c.v || 0);
  return c.kind as string;
}
export function faceOf(key: string) { return wrapF(AB[key], A[key]); }
/** Ancienne face « Mers Sauvages » (repli si l'illustration ne se charge pas). */
function oldFace(c: Partial<Card>): string {
  if (c.kind === 'num') {
    if (c.wild) return wrapF(2, A.wild);
    const S = NUM[c.suit as string];
    if (c.exp) return wrapF(2, c.zf ? S.xzf : S['x' + c.rank]);
    return wrapF(1, c.rank === 14 ? S['14'] : S.t.split('{N}').join(String(c.rank)));
  }
  const k = keyOf(c); return wrapF(AB[k], A[k]);
}
/** Chiffre dans le médaillon vide des cartes numérotées, et sceau des cas particuliers (14, 7 et 8 de l'extension). */
function numOverlay(c: Partial<Card>) {
  if (c.kind !== 'num' || c.wild) return ''; // le Grand Quinze a son « 15 » dessiné
  const ink = INK[c.suit as string];
  if (c.zf) return `<span class="anum zf" style="color:${ink}">0·14</span>`;
  const n = String(c.rank);
  let seal = '';
  if (c.mod) seal = c.mod < 0 ? '<span class="aseal neg">−5</span>' : '<span class="aseal">+5</span>';
  else if (c.rank === 14) seal = `<span class="aseal">${c.suit === 'black' ? '+20' : '+10'}</span>`;
  return `<span class="anum${n.length > 1 ? ' two' : ''}" style="color:${ink}">${n}</span>${seal}`;
}
/** Pastille de pouvoir sur le médaillon en haut à gauche des personnages (Morgane n'en a pas). */
function pastille(k: string) {
  const p = PAST[k]; if (!p) return '';
  const left = k === 'sk' || k.startsWith('mermaid') ? ' alt' : '';
  return `<span class="apow${left}${p.startsWith('<') ? '' : ' txt'}">${p}</span>`;
}
export function faceHTML(c: Partial<Card>): string {
  const k = keyOf(c), f = ART[k];
  if (!f) return oldFace(c);
  // la description de la carte permet de revenir à l'ancienne face si l'image manque (voir installArtFallback)
  const d = esc(JSON.stringify({ kind: c.kind, suit: c.suit, rank: c.rank, pid: c.pid, v: c.v, mod: c.mod, zf: c.zf, wild: c.wild, exp: c.exp }));
  return `<div class="art" data-c="${d}"><img src="cards/${f}.webp" alt="" decoding="async" draggable="false">${numOverlay(c)}${pastille(k)}</div>`;
}
/** Règle d'une carte en toutes lettres, pour la fiche du zoom (les illustrations n'ont plus de texte). */
export function ruleOf(c: Partial<Card>): string {
  if (c.kind === 'pirate') return `Pirate. Pouvoir : ${PIRATES[c.pid!].pw}.`;
  if (c.kind === 'num' && !c.wild && !c.zf && !c.mod) {
    const base = c.suit === 'black' ? 'Atout : bat toutes les cartes des autres couleurs.' : 'Carte de couleur.';
    return c.rank === 14 ? `${base} Capturée, elle rapporte ${c.suit === 'black' ? '+20' : '+10'} points si la mise est tenue.` : base;
  }
  if (c.kind === 'num' && c.mod) return `Capturée, elle rapporte ${c.mod > 0 ? '+5' : '−5'} points si la mise est tenue.`;
  // les descriptions du moteur commencent souvent par le nom (« Dernière Bordée : ne gagne pas… ») : la fiche l'affiche déjà en titre
  // (ou une variante : « 0/14 : », « Barbe-Cendre, Roi des Pirates : », « Drapeau blanc (Fuite) : »)
  const t = cardTitle(c as Card) || DESC[c.kind as string] || '', n = cname(c as Card), i = t.indexOf(' : '), pre = t.slice(0, i);
  return i > 0 && i < 45 && (pre.startsWith(n) || n.startsWith(pre)) ? t.charAt(i + 3).toUpperCase() + t.slice(i + 4) : t;
}
export function cardHTML(c: Partial<Card>, e?: Partial<Entry> | null, extra = '', attrs = '') {
  const k = c.kind; let cl = 'card k-' + (c.wild ? 'wild' : k);
  if (k === 'num' && !c.wild) cl += ' s-' + c.suit;
  let tag = '';
  if (e && e.as) tag = e.as === 'pirate' ? 'Pirate' : 'Fuite';
  if (e && c.zf && e.val != null) tag = 'vaut ' + e.val;
  if (e && c.wild && e.ws) tag = SUIT[e.ws].n;
  const name = cname(c as Card, e ?? undefined);
  // nom accessible (le title seul n'est pas fiable pour les lecteurs d'écran) ; la main remplace role et libellé quand la carte devient jouable.
  // data-n / data-r : nom et règle pour la fiche du zoom.
  return `<div class="${cl} ${extra}" data-id="${c.id}" role="img" aria-label="${esc(name)}" title="${esc(cardTitle(c as Card))}" data-n="${esc(name)}" data-r="${esc(ruleOf(c))}" ${attrs}><div class="face">${faceHTML(c)}</div>${tag ? `<span class="tag">${tag}</span>` : ''}</div>`;
}
export const backFace = () => `<div class="face">${faceOf('back')}</div>`;

/** Précharge les illustrations (évite le clignotement au premier affichage). */
let preloaded = false;
export function preloadArt() {
  if (preloaded) return; preloaded = true;
  for (const f of new Set(Object.values(ART))) { const i = new Image(); i.decoding = 'async'; i.src = `cards/${f}.webp`; }
}
/** Une illustration qui ne se charge pas est remplacée par l'ancienne face. */
let fallback = false;
export function installArtFallback() {
  if (fallback) return; fallback = true;
  document.addEventListener('error', ev => {
    const img = ev.target as HTMLElement; if (img?.tagName !== 'IMG') return;
    const art = img.parentElement; if (!art?.classList.contains('art')) return;
    try { art.outerHTML = oldFace(JSON.parse(art.dataset.c || '{}')); } catch { /* face laissée telle quelle */ }
  }, true);
}
