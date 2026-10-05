// Objets de la garde-robe dessinés seuls, sans cadre de carte (tracés repris de docs/maquettes/Objet.dc.html, viewBox 120),
// et aperçu d'un objet quelconque : son dessin s'il en a un, sinon l'avatar qui le porte.
import { avatarHTML } from './avatar';
import type { Cosmetic, Look } from '@shared/cosmetics.ts';

// les couleurs viennent des listes fermées du catalogue ; on les filtre quand même avant de les injecter dans le SVG
const safe = (c: unknown, d: string) => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : d;

// 17 perles en arc de cercle (calcul de la maquette)
const PEARLS = Array.from({ length: 17 }, (_, i) => {
  const a = Math.PI * (0.05 + 0.9 * i / 16);
  return `<circle cx="${(60 - Math.cos(a) * 46).toFixed(1)}" cy="${(24 + Math.sin(a) * 50).toFixed(1)}" r="${(5 + Math.sin(a) * 1.6).toFixed(1)}" fill="url(#og-pearl)" stroke="#9a8790" stroke-width=".6"/>`;
}).join('');

/** Tracés par objet ; {c} = couleur de l'objet, #og-… = dégradés communs (renommés à chaque dessin pour rester uniques). */
const DRAW: Record<string, string> = {
  bandana: '<path d="M12 46c26-16 70-16 96 0L60 102z" fill="{c}"/>' +
    '<path d="M60 102l48-56c-12 6-28 12-42 16z" fill="#000" opacity=".22"/>' +
    '<path d="M12 46c26-16 70-16 96 0-26-6-70-6-96 0z" fill="#fff" opacity=".22"/>' +
    '<circle cx="40" cy="52" r="3.2" fill="#f3e8cf"/><circle cx="60" cy="48" r="3.2" fill="#f3e8cf"/><circle cx="80" cy="52" r="3.2" fill="#f3e8cf"/><circle cx="50" cy="68" r="3.2" fill="#f3e8cf"/><circle cx="70" cy="68" r="3.2" fill="#f3e8cf"/><circle cx="60" cy="86" r="3.2" fill="#f3e8cf"/>' +
    '<path d="M102 44l16-8-3 14zM102 48l13 13-15-3z" fill="{c}"/><circle cx="103" cy="46" r="5" fill="{c}" stroke="#000" stroke-opacity=".25"/>',
  tricorne: '<path d="M32 66c2-30 54-30 56 0z" fill="#5a3b26"/><path d="M40 50c8-10 32-10 40 0" fill="none" stroke="#8a6040" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M8 68c20-30 84-30 104 0-26 14-78 14-104 0z" fill="#4a2f1d"/><path d="M8 68c20-30 84-30 104 0" fill="none" stroke="#7d5636" stroke-width="3"/>' +
    '<path d="M10 68c26 14 74 14 100 0" fill="none" stroke="url(#og-gold)" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M24 58c14-12 58-12 72 0" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3"/>' +
    '<circle cx="60" cy="72" r="5" fill="url(#og-gold)"/>',
  lunettes: '<path d="M18 58L4 50M102 58l14-8" stroke="url(#og-gold)" stroke-width="4" stroke-linecap="round"/>' +
    '<circle cx="38" cy="62" r="19" fill="url(#og-glass)" stroke="url(#og-gold)" stroke-width="5"/>' +
    '<circle cx="82" cy="62" r="19" fill="url(#og-glass)" stroke="url(#og-gold)" stroke-width="5"/>' +
    '<path d="M55 58c3-5 7-5 10 0" fill="none" stroke="url(#og-gold)" stroke-width="4"/>' +
    '<path d="M28 54c3-5 8-7 12-6M72 54c3-5 8-7 12-6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".85"/>',
  mouette: '<path d="M22 78c0-22 20-36 44-30 18 4 24 20 14 32-12 14-46 14-58-2z" fill="#f6f3ec"/>' +
    '<path d="M40 60c10-22 34-34 58-30-16 6-28 16-36 32z" fill="#c9d1d8"/>' +
    '<circle cx="80" cy="48" r="13" fill="#f6f3ec"/>' +
    '<path d="M92 48l16 3-16 5z" fill="#e3a83a"/><circle cx="84" cy="45" r="2.2" fill="#15110e"/>' +
    '<path d="M30 92l-4 10M46 94l2 10" stroke="#e3a83a" stroke-width="3" stroke-linecap="round"/>',
  monocle: '<path d="M74 74c8 10 6 18 14 24s14 2 20 12" fill="none" stroke="url(#og-gold)" stroke-width="3" stroke-dasharray="5 3" stroke-linecap="round"/>' +
    '<circle cx="108" cy="110" r="5" fill="none" stroke="url(#og-gold)" stroke-width="3"/>' +
    '<circle cx="50" cy="50" r="32" fill="url(#og-glass)" stroke="url(#og-gold)" stroke-width="8"/>' +
    '<circle cx="50" cy="50" r="32" fill="none" stroke="#6b4c14" stroke-width="1.5" opacity=".6"/>' +
    '<path d="M30 38c6-10 16-14 26-12" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/>' +
    '<circle cx="66" cy="66" r="3" fill="#fff" opacity=".6"/>',
  perroquet: '<path d="M54 74l-14 40 22-30z" fill="#2f6fb0"/><path d="M60 76l-4 40 14-34z" fill="#c0392b"/>' +
    '<path d="M44 82c-12-22-2-48 22-50 20-2 30 18 22 36-6 14-28 28-44 14z" fill="url(#og-green)"/>' +
    '<path d="M50 70c4-14 18-22 32-18-6 10-16 18-32 18z" fill="#2f6f3a" opacity=".8"/>' +
    '<circle cx="74" cy="36" r="16" fill="url(#og-green)"/>' +
    '<path d="M86 32c10 0 14 8 10 16-2-6-6-8-12-6z" fill="#f2c14e" stroke="#9a6e1c" stroke-width="1.5"/>' +
    '<circle cx="78" cy="32" r="5" fill="#fff"/><circle cx="79" cy="32" r="2.6" fill="#15110e"/>',
  perles: PEARLS +
    '<path d="M60 78v6" stroke="url(#og-gold)" stroke-width="3"/>' +
    '<circle cx="60" cy="92" r="9" fill="url(#og-pearl)" stroke="#9a8790"/>',
  patch: '<path d="M6 40c30 6 78 22 108 40" fill="none" stroke="#6b4226" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M36 50c10-6 30-6 40 4 6 14-4 30-20 30S30 64 36 50z" fill="#3a2214" stroke="#8a5a34" stroke-width="2"/>' +
    '<path d="M40 54c10-4 24-4 32 4 4 10-2 22-16 22" fill="none" stroke="url(#og-gold)" stroke-width="1.6" stroke-dasharray="3 3"/>' +
    '<path d="M44 56c4-3 10-4 14-3" stroke="#fff" stroke-opacity=".25" stroke-width="2.5" stroke-linecap="round"/>',
  poulpe: '<path d="M36 70c-10 14-24 16-28 30M48 76c-4 16-14 24-14 36M60 78c0 16 4 26 0 36M72 76c4 16 14 24 14 36M84 70c10 14 24 16 28 30" fill="none" stroke="#7a3fa0" stroke-width="9" stroke-linecap="round"/>' +
    '<path d="M36 70c-10 14-24 16-28 30M48 76c-4 16-14 24-14 36M60 78c0 16 4 26 0 36M72 76c4 16 14 24 14 36M84 70c10 14 24 16 28 30" fill="none" stroke="#d9a8f5" stroke-width="2" stroke-dasharray="1 6" stroke-linecap="round"/>' +
    '<ellipse cx="60" cy="48" rx="34" ry="36" fill="url(#og-purple)"/>' +
    '<circle cx="46" cy="30" r="4" fill="#c58fe6" opacity=".8"/><circle cx="74" cy="26" r="3" fill="#c58fe6" opacity=".8"/><circle cx="80" cy="44" r="2.5" fill="#c58fe6" opacity=".8"/>' +
    '<ellipse cx="48" cy="54" rx="7" ry="8" fill="#fff"/><ellipse cx="72" cy="54" rx="7" ry="8" fill="#fff"/>' +
    '<circle cx="49" cy="56" r="3.6" fill="#15110e"/><circle cx="73" cy="56" r="3.6" fill="#15110e"/>' +
    '<path d="M54 68c4 3 8 3 12 0" fill="none" stroke="#3a1a52" stroke-width="2.5" stroke-linecap="round"/>',
  couronne: '<path d="M14 90l-6-56 26 22 26-36 26 36 26-22-6 56z" fill="url(#og-gold)" stroke="#6b4c14" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<rect x="14" y="88" width="92" height="14" rx="3" fill="url(#og-gold)" stroke="#6b4c14" stroke-width="2.5"/>' +
    '<circle cx="60" cy="70" r="8" fill="#c0392b" stroke="#6b4c14" stroke-width="2"/><circle cx="34" cy="76" r="5.5" fill="#2f6fb0" stroke="#6b4c14" stroke-width="2"/><circle cx="86" cy="76" r="5.5" fill="#3e8e4e" stroke="#6b4c14" stroke-width="2"/>' +
    '<circle cx="8" cy="34" r="4" fill="url(#og-gold)"/><circle cx="60" cy="20" r="5" fill="url(#og-gold)"/><circle cx="112" cy="34" r="4" fill="url(#og-gold)"/>' +
    '<path d="M57 67c2-2 4-2 6 0" stroke="#fff" stroke-width="2" opacity=".7"/>',
  medaillon: '<path d="M22 8c4 30 18 44 38 44S94 38 98 8" fill="none" stroke="url(#og-gold)" stroke-width="3" stroke-dasharray="5 3"/>' +
    '<circle cx="60" cy="74" r="34" fill="url(#og-gold)" stroke="#6b4c14" stroke-width="3"/>' +
    '<circle cx="60" cy="74" r="26" fill="none" stroke="#6b4c14" stroke-width="1.5" opacity=".7"/>' +
    '<path d="M60 54l5.5 12.5 13.5 1.2-10.2 9 3 13.3L60 83l-11.8 7 3-13.3-10.2-9 13.5-1.2z" fill="#8a6620"/>' +
    '<path d="M40 60c4-8 12-12 20-12" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>',
  mystere: '<circle cx="60" cy="60" r="44" fill="#1b1f26" stroke="#8d99a3" stroke-width="3" stroke-dasharray="6 5"/>' +
    '<path d="M46 48c0-10 6-16 14-16s14 6 14 14c0 10-12 12-12 22M62 82v4" fill="none" stroke="#c9d1d8" stroke-width="7" stroke-linecap="round"/>',
};

const DEFS = '<linearGradient id="og-gold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".35" stop-color="#e8c76a"/><stop offset="1" stop-color="#9a6e1c"/></linearGradient>' +
  '<radialGradient id="og-glass" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".4" stop-color="#bfe3f2" stop-opacity=".55"/><stop offset="1" stop-color="#5b8fa6" stop-opacity=".35"/></radialGradient>' +
  '<radialGradient id="og-pearl" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f1e6e4"/><stop offset="1" stop-color="#bba9b0"/></radialGradient>' +
  '<radialGradient id="og-purple" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#d9a8f5"/><stop offset=".55" stop-color="#9b5cc4"/><stop offset="1" stop-color="#5a2d7a"/></radialGradient>' +
  '<radialGradient id="og-green" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#8fd68f"/><stop offset="1" stop-color="#2f6f3a"/></radialGradient>';

let uid = 0;

/** Objets qui ont un dessin dédié (valeurs du catalogue), plus « mystere ». */
export const DRAWN = Object.keys(DRAW);
export const hasDrawing = (value: string) => Object.prototype.hasOwnProperty.call(DRAW, value);

/** Dessin seul d'un objet (SVG viewBox 120, occupe 100 % de son conteneur), ou null si l'objet n'a pas de dessin dédié.
 *  `color` : couleur de l'objet (utilisée par le bandana). `silhouette` : objet pas encore obtenu (tout noir). */
export function objectSVG(value: string, color?: string, silhouette = false): string | null {
  if (!hasDrawing(value)) return null;
  // identifiants des dégradés propres à chaque dessin : plusieurs SVG sur une page ne doivent pas se marcher dessus
  const id = `og${++uid}`;
  const body = ('<defs>' + DEFS + '</defs>' + DRAW[value]).replace(/og-(gold|glass|pearl|purple|green)/g, `${id}-$1`).split('{c}').join(safe(color, '#2f5f8a'));
  const filter = silhouette ? 'brightness(0)' : 'drop-shadow(0 6px 10px rgba(0,0,0,.45))';
  return `<svg viewBox="0 0 120 120" width="100%" height="100%" style="display:block;overflow:visible;filter:${filter}" aria-hidden="true">${body}</svg>`;
}

/** Look de base pour montrer un objet porté. */
const BASE_LOOK: Look = { skin: 1, hair: 'court', hc: 1, beard: 'none', bg: 'mer' };
const VARIANT_KEY: Record<string, 'htc' | 'nkc' | 'ptc'> = { hat: 'htc', neck: 'nkc', pet: 'ptc' };

/** Aperçu HTML d'un objet de `size` px : son dessin s'il en a un, sinon l'avatar (couleur de manteau `color`) qui le porte.
 *  `variantColor` : couleur choisie pour l'objet (sinon la première de ses variantes). `silhouette` : objet verrouillé. */
export function itemPreview(item: Cosmetic, color: string, size: number, opts: { silhouette?: boolean; look?: Partial<Look>; variantColor?: string } = {}): string {
  const vc = opts.variantColor ?? item.variants?.colors[0];
  const svg = objectSVG(item.value, vc, !!opts.silhouette);
  const box = `display:inline-block;flex:none;line-height:0;width:${size}px;height:${size}px`;
  if (svg) return `<span class="ipv" style="${box}">${svg}</span>`;
  const look: Partial<Look> = { ...BASE_LOOK, ...(opts.look || {}), [item.slot]: item.value };
  const key = item.variants?.key ?? VARIANT_KEY[item.slot];
  if (key && vc) (look as any)[key] = vc;
  // verrouillé : avatar grisé et assombri par la classe .avatar.locked (app.css), comme la maquette Avatar
  return `<span class="ipv ipv-av" style="${box}">${avatarHTML({ look: look as Look, color }, size, undefined, !!opts.silhouette)}</span>`;
}
