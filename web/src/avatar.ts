// Avatar commun (en-tête, table, listes, classement) : initiale, pirate illustré (8 silhouettes) ou photo.
// Tracés repris de docs/ecrans-compte/maquettes/Avatar.dc.html.
import { esc } from './util';

export interface AvatarData { kind?: 'initial' | 'art' | 'photo' | string | null; art?: number | null; url?: string | null; letter?: string; color?: string | null }
export const PALETTE = ['#d9b25a', '#c8644b', '#7ab874', '#5c9db6', '#a982c4', '#e0954a', '#c9c0ae', '#d77fa1'];
export const ART_NAMES = ['Tricorne', 'Bandana', 'Chapeau à plume', 'Bicorne', 'Bandana et bandeau', 'Couronne', 'Cheveux longs', 'Tricorne et perroquet'];

const P: Record<string, string> = {
  hair: '<path d="M35 48c-7 14-7 30-1 42h7c-4-11-4-25 0-38zM65 48c7 14 7 30 1 42h-7c4-11 4-25 0-38z" fill="#15110E"/>',
  tricorne: '<path d="M23 40c8-17 46-17 54 0-9 4-45 4-54 0z" fill="#15110E"/><path d="M24 40c11 4 41 4 52 0" fill="none" stroke="#C9A24A" stroke-width="2.5"/>',
  bandana: '<path d="M35 42c1-14 29-14 30 0z" fill="#9E2A22"/><path d="M64 39l11 5-7 5z" fill="#9E2A22"/>',
  plume: '<path d="M19 43c10-7 52-7 62 0-10 4-52 4-62 0z" fill="#15110E"/><path d="M36 41c0-14 28-14 28 0z" fill="#15110E"/><path d="M60 34c9-13 22-15 28-10-9 0-15 4-22 12z" fill="#E3C47A"/>',
  bicorne: '<path d="M20 41l30-16 30 16c-15 6-45 6-60 0z" fill="#15110E"/><circle cx="50" cy="33" r="3.5" fill="#C9A24A"/>',
  patch: '<path d="M36 46l28 10" stroke="#C9A24A" stroke-width="1.5"/><ellipse cx="44" cy="50" rx="5" ry="4" fill="#C9A24A"/>',
  crown: '<path d="M34 37l4-15 6 9 6-11 6 11 6-9 4 15z" fill="#E3C47A"/>',
  parrot: '<path d="M72 76c-5-11 1-20 8-18 5 2 5 9 0 13z" fill="#3E8E4E"/><circle cx="78" cy="61" r="1.6" fill="#EFE3C8"/><path d="M81 59l5 2-5 2z" fill="#E3C47A"/>',
};
const STY = [['tricorne'], ['bandana'], ['plume'], ['bicorne'], ['bandana', 'patch'], ['crown'], ['hair', 'tricorne'], ['tricorne', 'parrot']];

/** SVG d'un pirate illustré (0 à 7). */
export function artSVG(v: number) {
  const h = STY[v] || STY[0];
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1.5"/>` +
    (h.includes('hair') ? P.hair : '') +
    '<path d="M16 102c3-25 17-35 34-35s31 10 34 35z" fill="#15110E"/><path d="M44 58h12v12H44z" fill="#15110E"/><ellipse cx="50" cy="48" rx="14" ry="17" fill="#15110E"/>' +
    h.filter(k => k !== 'hair').map(k => P[k]).join('') + '</svg>';
}

/** Médaillon rond : `ring` = ombre portée CSS (anneau), sinon un liseré sombre. */
export function avatarHTML(a: AvatarData, size: number, ring?: string) {
  const color = a.color || PALETTE[0], letter = esc((a.letter || '?').trim().charAt(0).toUpperCase() || '?');
  let inner: string;
  if (a.kind === 'photo' && a.url) inner = `<img src="${esc(a.url)}" alt="" loading="lazy" decoding="async">`;
  else if (a.kind === 'art' && a.art != null && a.art >= 0) inner = artSVG(Number(a.art));
  // initiale relative au médaillon (cqw) : suit sa taille réelle même si le CSS la change ; px en repli
  else inner = `<span style="font-size:${Math.round(size * .45)}px;font-size:45cqw">${letter}</span>`;
  return `<span class="avatar" style="width:${size}px;height:${size}px;background:${esc(color)};box-shadow:${ring || '0 0 0 2px #1b140e'}">${inner}</span>`;
}
/** Données d'avatar à partir d'une ligne de la table profiles. */
export const fromProfile = (p: any, fallbackName = '?'): AvatarData => p ? ({ kind: p.avatar_kind, art: p.avatar_art, url: p.avatar_url, letter: p.pseudo || fallbackName, color: p.color }) : { letter: fallbackName };
