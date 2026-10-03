// Rendu des cartes. Deux styles cohabitent :
//   - « Mers Sauvages » (face HTML) pour escape, tigress, kraken, whale, loot, volley, stingray, davy, plank et le Grand Quinze ;
//   - illustrations Cartes-v3 (fichiers web/public/cards/*.webp) pour pirates, Barbe-Cendre, sirènes, Corbin et les 4 couleurs
//     numérotées. Le médaillon du coin haut-droit est vide dans l'image : c'est le code qui écrit le chiffre.
import { ALT2, ALT2B, NUM2 } from './cardsdata';
import { cardTitle, cname, DESC, PIRATES, SPECIAL, SUIT, type Card, type Entry } from '@engine';
import { esc } from './util';

const wrapF = (b: number, h: string) => `<div class="fb${b}">${h}</div>`;
const A = ALT2 as Record<string, string>, AB = ALT2B as Record<string, number>, NUM = NUM2 as Record<string, any>;

/** Correspondance clé → fichier illustré (web/public/cards/<fichier>). Chemin relatif pour Capacitor (base './').
 *  Note : Corbin le Second est servi par corbin.webp (et pas con.webp) parce que CON est un nom de périphérique
 *  réservé sous Windows — le fichier est inaccessible dès qu'il s'appelle ainsi. */
export const ART: Record<string, string> = {
  rosie: 'cards/rosie.webp', bahij: 'cards/bahij.webp', rascal: 'cards/rascal.webp', juanita: 'cards/juanita.webp', harry: 'cards/harry.webp',
  mary: 'cards/mary.webp', con: 'cards/corbin.webp', sk: 'cards/sk.webp', mermaid0: 'cards/mermaid0.webp', mermaid1: 'cards/mermaid1.webp',
  'suit-yellow': 'cards/suit-yellow.webp', 'suit-purple': 'cards/suit-purple.webp', 'suit-green': 'cards/suit-green.webp', 'suit-black': 'cards/suit-black.webp',
};

/** Pastilles de pouvoir (docs/cartes-v3/pastilles.json) : SVG avec stroke="currentColor" ou texte court en Pirata One. */
const PST: Record<string, string> = {
  rosie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  bahij: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7" width="9" height="13" rx="1.5"/><rect x="10.5" y="3" width="9" height="13" rx="1.5"/><path d="M15 6.5v6M12 9.5h6"/></svg>',
  rascal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.4" fill="currentColor"/></svg>',
  juanita: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  harry: '±1',
  mary: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3-1 4-5 7-6s5 1 7-2"/><rect x="13.5" y="2.5" width="7" height="9" rx="1.2" transform="rotate(14 17 7)"/></svg>',
  sk: '+30', mermaid0: '+40', mermaid1: '+40', con: '+30',
};

/** Clé « canonique » d'une carte pour chercher l'illustration et la pastille. */
export function cardKey(c: Partial<Card>): string {
  if (c.kind === 'pirate') return c.pid!;
  if (c.kind === 'mermaid') return 'mermaid' + (c.v || 0);
  if (c.kind === 'num' && !c.wild) return 'suit-' + c.suit;
  return c.kind as string;
}

/** Chiffre et éventuel sceau (bonus) pour une carte numérotée illustrée. */
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
/** Pastille de pouvoir en haut à gauche (pirates, sirènes, Barbe-Cendre, Corbin). */
function pastille(key: string): string {
  const s = PST[key]; if (!s) return '';
  const isSvg = s.startsWith('<svg');
  return `<span class="art-pw ${isSvg ? 'svg' : 'txt'}">${s}</span>`;
}
/** Face illustrée (image + médaillon chiffre + sceau + pastille). */
function artFace(c: Partial<Card>, key: string): string {
  let overlays = '';
  if (c.kind === 'num' && !c.wild) overlays += medallion(c);
  overlays += pastille(key);
  return `<div class="art"><img src="${ART[key]}" alt="" decoding="async" draggable="false">${overlays}</div>`;
}

export function faceOf(key: string) { return wrapF(AB[key], A[key]); }
export function faceHTML(c: Partial<Card>): string {
  if (c.kind === 'num') {
    if (c.wild) return wrapF(2, A.wild);
    const key = 'suit-' + c.suit;
    if (ART[key]) return artFace(c, key);
    const S = NUM[c.suit as string];
    if (c.exp) return wrapF(2, c.zf ? S.xzf : S['x' + c.rank]);
    return wrapF(1, c.rank === 14 ? S['14'] : S.t.split('{N}').join(String(c.rank)));
  }
  const key = cardKey(c);
  if (ART[key]) return artFace(c, key);
  return wrapF(AB[key], A[key]);
}
export function cardHTML(c: Partial<Card>, e?: Partial<Entry> | null, extra = '', attrs = '') {
  const k = c.kind; let cl = 'card k-' + (c.wild ? 'wild' : k);
  if (k === 'num' && !c.wild) cl += ' s-' + c.suit;
  let tag = '';
  if (e && e.as) tag = e.as === 'pirate' ? 'Pirate' : 'Fuite';
  if (e && c.zf && e.val != null) tag = 'vaut ' + e.val;
  if (e && c.wild && e.ws) tag = SUIT[e.ws].n;
  // données pour le zoom au survol long : nom affichable + règle en français (DESC ou pouvoir des Pirates)
  const key = cardKey(c), hasArt = !!ART[key];
  let dataAttrs = '';
  if (hasArt) {
    let name = cname(c as Card), rule = '';
    if (c.kind === 'pirate' && c.pid) { name = PIRATES[c.pid].n; rule = PIRATES[c.pid].pw.charAt(0).toUpperCase() + PIRATES[c.pid].pw.slice(1) + '.'; }
    else if (c.kind === 'mermaid') { name = c.v ? 'Néréa' : 'Ondine'; rule = DESC.mermaid; }
    else if (c.kind === 'sk') { name = SPECIAL.sk; rule = DESC.sk; }
    else if (c.kind === 'con') { name = SPECIAL.con; rule = DESC.con; }
    else if (c.kind === 'num') {
      if (c.zf) rule = DESC.zf;
      else if (c.rank === 14) rule = 'Si vous remportez ce pli, bonus de +' + (c.suit === 'black' ? 20 : 10) + ' points.';
      else if (c.exp && c.rank === 7) rule = 'Si vous remportez ce pli, malus de −5 points.';
      else if (c.exp && c.rank === 8) rule = 'Si vous remportez ce pli, bonus de +5 points.';
    }
    dataAttrs = ` data-art-name="${esc(name)}"${rule ? ` data-art-rule="${esc(rule)}"` : ''}`;
  }
  // nom accessible (le title seul n'est pas fiable pour les lecteurs d'écran) ; la main remplace role et libellé quand la carte devient jouable
  return `<div class="${cl} ${extra}" data-id="${c.id}" role="img" aria-label="${esc(cname(c as Card, e ?? undefined))}" title="${esc(cardTitle(c as Card))}"${dataAttrs} ${attrs}><div class="face">${faceHTML(c)}</div>${tag ? `<span class="tag">${tag}</span>` : ''}</div>`;
}
export const backFace = () => `<div class="face">${faceOf('back')}</div>`;

/** Précharge les 14 illustrations au premier affichage de la table pour éviter un clignotement. */
let preloaded = false;
export function preloadArt() {
  if (preloaded) return; preloaded = true;
  for (const k of Object.keys(ART)) { try { const img = new Image(); img.decoding = 'async'; img.src = ART[k]; } catch { /* navigateur très ancien : tant pis */ } }
}
