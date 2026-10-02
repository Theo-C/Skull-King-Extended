// Rendu des cartes « Mers Sauvages ».
import { ALT2, ALT2B, NUM2 } from './cardsdata';
import { cardTitle, cname, SUIT, type Card, type Entry } from '@engine';
import { esc } from './util';

const wrapF = (b: number, h: string) => `<div class="fb${b}">${h}</div>`;
const A = ALT2 as Record<string, string>, AB = ALT2B as Record<string, number>, NUM = NUM2 as Record<string, any>;

export function faceOf(key: string) { return wrapF(AB[key], A[key]); }
export function faceHTML(c: Partial<Card>): string {
  if (c.kind === 'num') {
    if (c.wild) return wrapF(2, A.wild);
    const S = NUM[c.suit as string];
    if (c.exp) return wrapF(2, c.zf ? S.xzf : S['x' + c.rank]);
    return wrapF(1, c.rank === 14 ? S['14'] : S.t.split('{N}').join(String(c.rank)));
  }
  let k = c.kind as string; if (k === 'pirate') k = c.pid!; if (k === 'mermaid') k = 'mermaid' + (c.v || 0);
  return wrapF(AB[k], A[k]);
}
export function cardHTML(c: Partial<Card>, e?: Partial<Entry> | null, extra = '', attrs = '') {
  const k = c.kind; let cl = 'card k-' + (c.wild ? 'wild' : k);
  if (k === 'num' && !c.wild) cl += ' s-' + c.suit;
  let tag = '';
  if (e && e.as) tag = e.as === 'pirate' ? 'Pirate' : 'Fuite';
  if (e && c.zf && e.val != null) tag = 'vaut ' + e.val;
  if (e && c.wild && e.ws) tag = SUIT[e.ws].n;
  // nom accessible (le title seul n'est pas fiable pour les lecteurs d'écran) ; la main remplace role et libellé quand la carte devient jouable
  return `<div class="${cl} ${extra}" data-id="${c.id}" role="img" aria-label="${esc(cname(c as Card, e ?? undefined))}" title="${esc(cardTitle(c as Card))}" ${attrs}><div class="face">${faceHTML(c)}</div>${tag ? `<span class="tag">${tag}</span>` : ''}</div>`;
}
export const backFace = () => `<div class="face">${faceOf('back')}</div>`;
