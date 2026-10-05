// Avatar commun (en-tête, table, listes, classement) : personnage composé en couches SVG (garde-robe), ou initiale tant que
// le joueur n'a rien choisi. Tracés repris de docs/maquettes/Avatar.dc.html.
import { esc } from './util';
import type { Look } from '@shared/cosmetics.ts';

export interface AvatarData { look?: Look | null; kind?: string | null; art?: number | null; letter?: string; color?: string | null }
export const PALETTE = ['#d9b25a', '#c8644b', '#7ab874', '#5c9db6', '#a982c4', '#e0954a', '#c9c0ae', '#d77fa1'];
export const SKINS: [string, string][] = [['#f3d2b3', '#d9ab88'], ['#e6b48f', '#c48e69'], ['#c98e66', '#a66f4b'], ['#a56a45', '#83512f'], ['#7a4a2c', '#5e371f'], ['#5a3420', '#43261a']];
export const HAIR_COLORS = ['#1d1510', '#4a2c1a', '#8a5a2b', '#c9a14a', '#a33a26', '#d8d2c4'];
// anciens pirates illustrés (0 à 7) : même personnage en couches, pour les profils qui n'ont pas encore de look
const PRESETS: Look[] = [
  { skin: 0, hair: 'long', hc: 4, beard: 'none', hat: 'tricorne', htc: '#2a3142', bg: 'nuit' },
  { skin: 3, hair: 'none', hc: 0, beard: 'mous', hat: 'bandana', htc: '#9e2a22', neck: 'perles', bg: 'mer' },
  { skin: 1, hair: 'meche', hc: 1, beard: 'short', hat: 'plume', htc: '#1d1814', neck: 'foulard', nkc: '#9e2a22', bg: 'mer', frame: 'corde' },
  { skin: 2, hair: 'court', hc: 0, beard: 'long', hat: 'bicorne', htc: '#15110e', face: 'cicatrice', bg: 'tempete' },
  { skin: 4, hair: 'court', hc: 0, beard: 'short', hat: 'bandana', htc: '#2f5f8a', face: 'patch', bg: 'mer' },
  { skin: 1, hair: 'long', hc: 5, beard: 'long', hat: 'couronne', bg: 'or', frame: 'or' },
  { skin: 5, hair: 'chignon', hc: 0, beard: 'none', face: 'lunettes', neck: 'medaillon', bg: 'couchant' },
  { skin: 0, hair: 'court', hc: 3, beard: 'none', hat: 'tricorne', htc: '#3a2a1c', pet: 'perroquet', ptc: '#3e8e4e', bg: 'taverne' },
];
const BG: Record<string, { c1: string; c2: string; c3?: string; deco?: string }> = {
  mer: { c1: '#16434a', c2: '#2a6f73', c3: '#0f3238', deco: 'waves' },
  nuit: { c1: '#0f1830', c2: '#1d2b52', deco: 'stars' },
  couchant: { c1: '#5a2a4a', c2: '#c0613e', deco: 'sun' },
  tempete: { c1: '#2a2f36', c2: '#4c5560', deco: 'bolt' },
  taverne: { c1: '#3a2416', c2: '#6b4226', deco: 'lamp' },
  or: { c1: '#6b4c14', c2: '#c9a14a' },
};
const DECO: Record<string, (c3: string) => string> = {
  stars: () => '<circle cx="20" cy="22" r="1.1" fill="#f3e8cf"/><circle cx="78" cy="16" r="1.4" fill="#f3e8cf"/><circle cx="86" cy="38" r=".9" fill="#f3e8cf"/><circle cx="14" cy="44" r=".8" fill="#f3e8cf"/><path d="M74 26a6 6 0 1 0 6 -7a5 5 0 1 1 -6 7z" fill="#f3e8cf" opacity=".8"/>',
  waves: c3 => `<path d="M0 74c8-4 14-4 22 0s14 4 22 0 14-4 22 0 14 4 22 0 8-2 12 0V100H0z" fill="${c3}" opacity=".7"/>`,
  sun: () => '<circle cx="50" cy="70" r="26" fill="#f0a35b" opacity=".55"/>',
  bolt: () => '<path d="M80 8l-8 18h6l-6 16 14-22h-7l6-12z" fill="#f6e3a8" opacity=".75"/>',
  lamp: () => '<circle cx="18" cy="26" r="12" fill="#f0b45b" opacity=".35"/><circle cx="18" cy="26" r="4" fill="#f6d58a"/>',
};
const HAIR_BACK: Record<string, string> = {
  long: '<path d="M33 44c-4 18-4 34 3 46h28c7-12 7-28 3-46z" fill="{hc}"/>',
  queue: '<path d="M60 40c10 6 12 22 6 36-2-12-6-22-10-28z" fill="{hc}"/>',
};
const COURT = '<path d="M35 46c-1-14 9-18.5 15-18.5 8 0 16 4.5 15 18.5-3-8-9-10.5-15-10s-12 2-15 10z" fill="{hc}"/>';
const HAIR_FRONT: Record<string, string> = {
  court: COURT,
  meche: '<path d="M35 47c-2-16 12-21 22-17 7 3 9 10 8 17-4-9-11-13-18-10-5 2-9 6-12 10z" fill="{hc}"/>',
  long: '<path d="M35 46c-2-16 32-16 30 0l1 20c-4-6-4-16-6-24-6-5-14-5-20 0-2 8-2 18-6 24z" fill="{hc}"/>',
  boucles: '<circle cx="38" cy="38" r="6" fill="{hc}"/><circle cx="45" cy="32" r="6.5" fill="{hc}"/><circle cx="53" cy="31" r="6.5" fill="{hc}"/><circle cx="61" cy="35" r="6" fill="{hc}"/><circle cx="64" cy="43" r="4.5" fill="{hc}"/><circle cx="36" cy="45" r="4.5" fill="{hc}"/>',
  chignon: '<circle cx="50" cy="26" r="7" fill="{hc}"/>' + COURT,
  tresse: COURT + '<circle cx="34" cy="56" r="3.4" fill="{hc}"/><circle cx="33" cy="63" r="3.2" fill="{hc}"/><circle cx="32.5" cy="70" r="3" fill="{hc}"/><circle cx="32.5" cy="76" r="2.4" fill="#c9a14a"/>',
};
const BEARD: Record<string, string> = {
  short: '<path d="M35.5 50c0 12 7 17.5 14.5 17.5S64.5 62 64.5 50c-2 8-7 11-14.5 11S37.5 58 35.5 50z" fill="{hc}"/>',
  long: '<path d="M35.5 50c0 16 7 28 14.5 30 7.5-2 14.5-14 14.5-30-2 8-7 10.5-14.5 10.5S37.5 58 35.5 50z" fill="{hc}"/>',
};
const MOUSTACHE = '<path d="M42.5 56c3.5-2.6 6.4-1.6 7.5-.4 1.1-1.2 4-2.2 7.5.4-3.4 1.6-6 1.2-7.5.4-1.5.8-4.1 1.2-7.5-.4z" fill="{hc}"/>';
const FACE: Record<string, string> = {
  patch: '<path d="M34 41l32 11" stroke="#15110e" stroke-width="1.6"/><ellipse cx="44.5" cy="49" rx="5" ry="4.4" fill="#15110e"/>',
  lunettes: '<circle cx="44.5" cy="49" r="4.6" fill="rgba(200,230,240,.25)" stroke="#c9a14a" stroke-width="1.4"/><circle cx="55.5" cy="49" r="4.6" fill="rgba(200,230,240,.25)" stroke="#c9a14a" stroke-width="1.4"/><path d="M49.1 49h1.8M39.9 48l-4.4-1.6M60.1 48l4.4-1.6" stroke="#c9a14a" stroke-width="1.2"/>',
  monocle: '<circle cx="55.5" cy="49" r="4.8" fill="rgba(200,230,240,.25)" stroke="#e3c47a" stroke-width="1.6"/><path d="M60 52c2 8-1 14-5 18" fill="none" stroke="#e3c47a" stroke-width=".9"/>',
  cicatrice: '<path d="M57.5 42l4 13M58 46l2.5-.8M59.2 50l2.5-.8" stroke="#9b4a3c" stroke-width="1.3" stroke-linecap="round"/>',
  khol: '<path d="M41 51.5c2 1.2 5 1.2 7 0M52 51.5c2 1.2 5 1.2 7 0M40 48.5l-2-1M60 48.5l2-1" stroke="#15110e" stroke-width="1" fill="none" stroke-linecap="round"/>',
};
const NECK: Record<string, string> = {
  foulard: '<path d="M41 72c5 6 13 6 18 0l-1.5 9c-5 3-10 3-15 0z" fill="{nkc}"/><path d="M48 80l-3 9 4-2 1 3 2-10z" fill="{nkc}"/>',
  perles: '<circle cx="41" cy="75" r="1.5" fill="#f3efe6"/><circle cx="43.5" cy="78" r="1.5" fill="#f3efe6"/><circle cx="46.5" cy="80" r="1.5" fill="#f3efe6"/><circle cx="50" cy="80.8" r="1.6" fill="#f3efe6"/><circle cx="53.5" cy="80" r="1.5" fill="#f3efe6"/><circle cx="56.5" cy="78" r="1.5" fill="#f3efe6"/><circle cx="59" cy="75" r="1.5" fill="#f3efe6"/>',
  medaillon: '<path d="M42 73c2 8 5 11 8 11s6-3 8-11" fill="none" stroke="#c9a14a" stroke-width=".9"/><circle cx="50" cy="86" r="4.2" fill="#e3c47a" stroke="#8a6620" stroke-width="1"/><path d="M50 83l1 2.2 2.3.3-1.7 1.5.5 2.3-2.1-1.2-2.1 1.2.5-2.3-1.7-1.5 2.3-.3z" fill="#8a6620"/>',
  jabot: '<path d="M44 73l6 4 6-4-1 5 3 2-4 1 2 3h-12l2-3-4-1 3-2z" fill="#fbf6ea" stroke="#d9cdb6" stroke-width=".6"/>',
};
const HAT: Record<string, string> = {
  tricorne: '<path d="M36 35c2-12 26-12 28 0z" fill="{htc}"/><path d="M21 38c9-15 49-15 58 0-11 5-47 5-58 0z" fill="{htc}"/><path d="M22 38c11 4.5 45 4.5 56 0" fill="none" stroke="#c9a14a" stroke-width="2.2"/>',
  bicorne: '<path d="M17 39l33-18 33 18c-16 6-50 6-66 0z" fill="{htc}"/><path d="M18 39c16 5 48 5 64 0" fill="none" stroke="#c9a14a" stroke-width="2"/><circle cx="50" cy="31" r="3.6" fill="#c9a14a"/><circle cx="50" cy="31" r="1.6" fill="#9e2a22"/>',
  bandana: '<path d="M34.5 42c.5-16 30.5-16 31 0-9-4.5-22-4.5-31 0z" fill="{htc}"/><path d="M64 38l11 4-7 6z" fill="{htc}"/><circle cx="42" cy="34" r="1" fill="#f3e8cf" opacity=".8"/><circle cx="50" cy="31.5" r="1" fill="#f3e8cf" opacity=".8"/><circle cx="58" cy="34" r="1" fill="#f3e8cf" opacity=".8"/>',
  plume: '<path d="M35 40c0-14 30-14 30 0z" fill="{htc}"/><path d="M17 41c10-6 56-6 66 0-10 4.5-56 4.5-66 0z" fill="{htc}"/><path d="M35 38h30" stroke="#c9a14a" stroke-width="2"/><path d="M60 34c9-14 24-17 30-11-10 0-17 5-24 13z" fill="#e3c47a"/>',
  couronne: '<path d="M35 36l3-15 6 8 6-11 6 11 6-8 3 15z" fill="#e3c47a" stroke="#8a6620" stroke-width="1"/><circle cx="50" cy="31" r="1.8" fill="#9e2a22"/><circle cx="42" cy="32" r="1.3" fill="#3e6fb0"/><circle cx="58" cy="32" r="1.3" fill="#3e8e4e"/>',
  foulard: '<path d="M33 47c-1-21 35-21 34 0-2-7-8-11-17-11s-15 4-17 11z" fill="{htc}"/><path d="M64 40c8 6 8 18 4 24-2-8-4-14-6-18z" fill="{htc}"/>',
  amiral: '<path d="M14 40l36-21 36 21c-18 7-54 7-72 0z" fill="{htc}"/><path d="M16 40c18 6 50 6 68 0" fill="none" stroke="#e3c47a" stroke-width="2.6"/><path d="M22 36c6-6 12-10 18-12M78 36c-6-6-12-10-18-12" stroke="#fbf6ea" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="30" r="4" fill="#e3c47a"/>',
};
const PET: Record<string, string> = {
  perroquet: '<path d="M70 86c-6-12 0-22 8-20 6 2 7 10 2 16z" fill="{ptc}"/><circle cx="77" cy="64" r="5.5" fill="{ptc}"/><path d="M81.5 62.5l5 2-5 3z" fill="#e3c47a"/><circle cx="78.5" cy="63" r="1.1" fill="#15110e"/><path d="M72 86l-3 12 7-10z" fill="{ptc}"/><path d="M73 76c3-2 6-2 8 1" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/>',
  singe: '<circle cx="69" cy="64" r="3" fill="#6b4226"/><circle cx="83" cy="64" r="3" fill="#6b4226"/><circle cx="76" cy="67" r="7.5" fill="#6b4226"/><ellipse cx="76" cy="69" rx="5" ry="4.2" fill="#d9a77a"/><circle cx="74" cy="66" r=".9" fill="#15110e"/><circle cx="78" cy="66" r=".9" fill="#15110e"/><path d="M70 74c-2 6 0 12 8 12s10-6 8-12z" fill="#6b4226"/>',
  mouette: '<path d="M68 84c0-10 6-16 12-14 5 2 5 10 0 14z" fill="#f3efe6"/><circle cx="78" cy="66" r="5" fill="#f3efe6"/><path d="M82.5 66l5 1-5 2z" fill="#e3a83a"/><circle cx="79.5" cy="65" r=".9" fill="#15110e"/><path d="M66 78c6-2 10 0 12 4" fill="none" stroke="#8d99a3" stroke-width="2"/>',
  poulpe: '<path d="M68 82c-2 6-6 8-8 14M72 84c0 6-2 10-2 14M78 84c2 6 2 10 6 14M82 82c3 4 6 6 8 12" fill="none" stroke="#8a4fb0" stroke-width="3" stroke-linecap="round"/><ellipse cx="75" cy="72" rx="9" ry="10" fill="#9b5cc4"/><circle cx="72" cy="72" r="1.6" fill="#fff"/><circle cx="78" cy="72" r="1.6" fill="#fff"/><circle cx="72.3" cy="72.3" r=".8" fill="#15110e"/><circle cx="78.3" cy="72.3" r=".8" fill="#15110e"/>',
};
const FRAME: Record<string, string> = {
  corde: '<circle cx="50" cy="50" r="47" fill="none" stroke="#b08a5a" stroke-width="3.5" stroke-dasharray="4 2.2"/>',
  or: '<circle cx="50" cy="50" r="47.5" fill="none" stroke="#e3c47a" stroke-width="3"/><circle cx="50" cy="50" r="44" fill="none" stroke="#8a6620" stroke-width="1"/>',
  tentacules: '<circle cx="50" cy="50" r="47.5" fill="none" stroke="#6e3a8e" stroke-width="3"/><path d="M4 70c6-2 8 4 4 8M10 86c4-6 10-4 9 1M96 70c-6-2-8 4-4 8M90 86c-4-6-10-4-9 1M8 26c6 2 6 8 1 9" fill="none" stroke="#9b5cc4" stroke-width="3.2" stroke-linecap="round"/>',
};
// les couleurs viennent des listes fermées du catalogue ; on les filtre quand même avant de les injecter dans le SVG
const safe = (c: any, d: string) => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : d;

/** Personnage en couches (viewBox 100 × 100) : décor → cheveux arrière → buste → cou → tête → yeux et bouche → pilosité →
 *  cheveux avant → accessoire de visage → cou → chapeau → compagnon → cadre. `color` = manteau (couleur du joueur). */
export function avatarSVG(look: Partial<Look>, color: string) {
  const L = look || {}, sk = SKINS[L.skin ?? 1] || SKINS[1];
  const hc = typeof L.hc === 'number' ? HAIR_COLORS[L.hc] || HAIR_COLORS[0] : HAIR_COLORS[0];
  const fill = (s: string | undefined) => (s || '').split('{hc}').join(hc).split('{htc}').join(safe(L.htc, '#1d1814'))
    .split('{nkc}').join(safe(L.nkc, '#9e2a22')).split('{ptc}').join(safe(L.ptc, '#3e8e4e'));
  const bg = BG[L.bg || 'mer'] || BG.mer, hair = L.hair || 'court', beard = L.beard || 'none';
  return '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    `<rect width="100" height="100" fill="${bg.c1}"/><circle cx="50" cy="38" r="46" fill="${bg.c2}" opacity=".85"/>` + (bg.deco ? DECO[bg.deco](bg.c3 || '#000') : '') +
    '<g transform="translate(50 64) scale(1.13) translate(-50 -64)">' +
    fill(HAIR_BACK[hair]) +
    `<path d="M12 104c2-22 18-32 38-32s36 10 38 32z" fill="${safe(color, '#5e1714')}"/><path d="M12 104c2-22 18-32 38-32s36 10 38 32z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/>` +
    `<path d="M42 73l8 20 8-20z" fill="#efe3c8"/><path d="M44 59h12v15c-4 3-8 3-12 0z" fill="${sk[1]}"/>` +
    `<circle cx="35" cy="50" r="3.6" fill="${sk[0]}"/><circle cx="65" cy="50" r="3.6" fill="${sk[0]}"/><ellipse cx="50" cy="48" rx="15" ry="17.5" fill="${sk[0]}"/>` +
    '<ellipse cx="43" cy="54" rx="2.6" ry="1.6" fill="#d9776a" opacity=".25"/><ellipse cx="57" cy="54" rx="2.6" ry="1.6" fill="#d9776a" opacity=".25"/>' +
    '<ellipse cx="44.5" cy="49" rx="1.6" ry="2" fill="#24170f"/><ellipse cx="55.5" cy="49" rx="1.6" ry="2" fill="#24170f"/>' +
    `<path d="M41 45c2.2-1.6 4.8-1.6 7 0M52 45c2.2-1.6 4.8-1.6 7 0" fill="none" stroke="${hc}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M50 50.5c-1.4 3-1 4.6.8 5" fill="none" stroke="${sk[1]}" stroke-width="1.2" stroke-linecap="round"/>` +
    '<path d="M46.5 58.5c2.4 2 4.6 2 7 0" fill="none" stroke="#7a3b2c" stroke-width="1.4" stroke-linecap="round"/>' +
    fill(BEARD[beard]) + (beard !== 'none' ? fill(MOUSTACHE) : '') +
    fill(HAIR_FRONT[hair]) + (L.face ? FACE[L.face] || '' : '') + (L.neck ? fill(NECK[L.neck]) : '') +
    (L.hat ? fill(HAT[L.hat]) : '') + (L.pet ? fill(PET[L.pet]) : '') +
    '</g>' + (L.frame ? FRAME[L.frame] || '' : '') + '</svg>';
}

/** Médaillon rond : `ring` = ombre portée CSS (anneau), sinon un liseré sombre. `locked` : silhouette (objet pas encore obtenu). */
export function avatarHTML(a: AvatarData, size: number, ring?: string, locked = false) {
  const color = a.color || PALETTE[0], letter = esc((a.letter || '?').trim().charAt(0).toUpperCase() || '?');
  const look = a.look || (a.kind === 'art' && a.art != null && a.art >= 0 ? PRESETS[Number(a.art)] : null);
  // initiale relative au médaillon (cqw) : suit sa taille réelle même si le CSS la change ; px en repli
  const inner = look ? avatarSVG(look, color) : `<span style="font-size:${Math.round(size * .45)}px;font-size:45cqw">${letter}</span>`;
  return `<span class="avatar${locked ? ' locked' : ''}" style="width:${size}px;height:${size}px;background:${esc(color)};box-shadow:${ring || '0 0 0 2px #1b140e'}">${inner}</span>`;
}
/** Données d'avatar à partir d'une ligne de la table profiles (ou d'une ligne qui en reprend les colonnes). */
export const fromProfile = (p: any, fallbackName = '?'): AvatarData => p ? ({ look: p.look ?? null, kind: p.avatar_kind, art: p.avatar_art, letter: p.pseudo || p.name || fallbackName, color: p.color }) : { letter: fallbackName };
