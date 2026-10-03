// Rendu SVG des objets cosmétiques (tracés portés depuis docs/ecrans-compte/maquettes/Objet.dc.html).
// Pour les objets qui n'ont pas de dessin dédié (foulard noué, chapeau à plume, bicorne, décors, cadres…),
// `objectSVG` retombe sur l'avatar qui porte l'objet, grâce à `avatarSVG`.
import { avatarSVG, type Look } from './avatar';

const DEFS = `<defs>
<linearGradient id="og-gold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".35" stop-color="#e8c76a"/><stop offset="1" stop-color="#9a6e1c"/></linearGradient>
<radialGradient id="og-glass" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".4" stop-color="#bfe3f2" stop-opacity=".55"/><stop offset="1" stop-color="#5b8fa6" stop-opacity=".35"/></radialGradient>
<radialGradient id="og-pearl" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f1e6e4"/><stop offset="1" stop-color="#bba9b0"/></radialGradient>
<radialGradient id="og-purple" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#d9a8f5"/><stop offset=".55" stop-color="#9b5cc4"/><stop offset="1" stop-color="#5a2d7a"/></radialGradient>
<radialGradient id="og-green" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#8fd68f"/><stop offset="1" stop-color="#2f6f3a"/></radialGradient>
</defs>`;

// Tracés directs (120 × 120). La couleur `c` sert aux objets qui en acceptent une variante (bandana surtout).
const PATHS: Record<string, (c: string) => string> = {
  bandana: c => `<path d="M12 46c26-16 70-16 96 0L60 102z" fill="${c}"/><path d="M60 102l48-56c-12 6-28 12-42 16z" fill="#000" opacity=".22"/><path d="M12 46c26-16 70-16 96 0-26-6-70-6-96 0z" fill="#fff" opacity=".22"/><circle cx="40" cy="52" r="3.2" fill="#f3e8cf"/><circle cx="60" cy="48" r="3.2" fill="#f3e8cf"/><circle cx="80" cy="52" r="3.2" fill="#f3e8cf"/><circle cx="50" cy="68" r="3.2" fill="#f3e8cf"/><circle cx="70" cy="68" r="3.2" fill="#f3e8cf"/><circle cx="60" cy="86" r="3.2" fill="#f3e8cf"/><path d="M102 44l16-8-3 14zM102 48l13 13-15-3z" fill="${c}"/><circle cx="103" cy="46" r="5" fill="${c}" stroke="#000" stroke-opacity=".25"/>`,
  tricorne: () => `<path d="M32 66c2-30 54-30 56 0z" fill="#5a3b26"/><path d="M40 50c8-10 32-10 40 0" fill="none" stroke="#8a6040" stroke-width="3" stroke-linecap="round"/><path d="M8 68c20-30 84-30 104 0-26 14-78 14-104 0z" fill="#4a2f1d"/><path d="M8 68c20-30 84-30 104 0" fill="none" stroke="#7d5636" stroke-width="3"/><path d="M10 68c26 14 74 14 100 0" fill="none" stroke="url(#og-gold)" stroke-width="5" stroke-linecap="round"/><path d="M24 58c14-12 58-12 72 0" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3"/><circle cx="60" cy="72" r="5" fill="url(#og-gold)"/>`,
  lunettes: () => `<path d="M18 58L4 50M102 58l14-8" stroke="url(#og-gold)" stroke-width="4" stroke-linecap="round"/><circle cx="38" cy="62" r="19" fill="url(#og-glass)" stroke="url(#og-gold)" stroke-width="5"/><circle cx="82" cy="62" r="19" fill="url(#og-glass)" stroke="url(#og-gold)" stroke-width="5"/><path d="M55 58c3-5 7-5 10 0" fill="none" stroke="url(#og-gold)" stroke-width="4"/><path d="M28 54c3-5 8-7 12-6M72 54c3-5 8-7 12-6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".85"/>`,
  mouette: () => `<path d="M22 78c0-22 20-36 44-30 18 4 24 20 14 32-12 14-46 14-58-2z" fill="#f6f3ec"/><path d="M40 60c10-22 34-34 58-30-16 6-28 16-36 32z" fill="#c9d1d8"/><circle cx="80" cy="48" r="13" fill="#f6f3ec"/><path d="M92 48l16 3-16 5z" fill="#e3a83a"/><circle cx="84" cy="45" r="2.2" fill="#15110e"/><path d="M30 92l-4 10M46 94l2 10" stroke="#e3a83a" stroke-width="3" stroke-linecap="round"/>`,
  monocle: () => `<path d="M74 74c8 10 6 18 14 24s14 2 20 12" fill="none" stroke="url(#og-gold)" stroke-width="3" stroke-dasharray="5 3" stroke-linecap="round"/><circle cx="108" cy="110" r="5" fill="none" stroke="url(#og-gold)" stroke-width="3"/><circle cx="50" cy="50" r="32" fill="url(#og-glass)" stroke="url(#og-gold)" stroke-width="8"/><circle cx="50" cy="50" r="32" fill="none" stroke="#6b4c14" stroke-width="1.5" opacity=".6"/><path d="M30 38c6-10 16-14 26-12" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/><circle cx="66" cy="66" r="3" fill="#fff" opacity=".6"/>`,
  perroquet: () => `<path d="M54 74l-14 40 22-30z" fill="#2f6fb0"/><path d="M60 76l-4 40 14-34z" fill="#c0392b"/><path d="M44 82c-12-22-2-48 22-50 20-2 30 18 22 36-6 14-28 28-44 14z" fill="url(#og-green)"/><path d="M50 70c4-14 18-22 32-18-6 10-16 18-32 18z" fill="#2f6f3a" opacity=".8"/><circle cx="74" cy="36" r="16" fill="url(#og-green)"/><path d="M86 32c10 0 14 8 10 16-2-6-6-8-12-6z" fill="#f2c14e" stroke="#9a6e1c" stroke-width="1.5"/><circle cx="78" cy="32" r="5" fill="#fff"/><circle cx="79" cy="32" r="2.6" fill="#15110e"/>`,
  perles: () => {
    let p = '';
    for (let i = 0; i < 17; i++) { const a = Math.PI * (0.05 + 0.9 * i / 16);
      const x = (60 - Math.cos(a) * 46).toFixed(1), y = (24 + Math.sin(a) * 50).toFixed(1), r = (5 + Math.sin(a) * 1.6).toFixed(1);
      p += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#og-pearl)" stroke="#9a8790" stroke-width=".6"/>`;
    }
    return p + '<path d="M60 78v6" stroke="url(#og-gold)" stroke-width="3"/><circle cx="60" cy="92" r="9" fill="url(#og-pearl)" stroke="#9a8790"/>';
  },
  patch: () => `<path d="M6 40c30 6 78 22 108 40" fill="none" stroke="#6b4226" stroke-width="5" stroke-linecap="round"/><path d="M36 50c10-6 30-6 40 4 6 14-4 30-20 30S30 64 36 50z" fill="#3a2214" stroke="#8a5a34" stroke-width="2"/><path d="M40 54c10-4 24-4 32 4 4 10-2 22-16 22" fill="none" stroke="url(#og-gold)" stroke-width="1.6" stroke-dasharray="3 3"/><path d="M44 56c4-3 10-4 14-3" stroke="#fff" stroke-opacity=".25" stroke-width="2.5" stroke-linecap="round"/>`,
  poulpe: () => `<path d="M36 70c-10 14-24 16-28 30M48 76c-4 16-14 24-14 36M60 78c0 16 4 26 0 36M72 76c4 16 14 24 14 36M84 70c10 14 24 16 28 30" fill="none" stroke="#7a3fa0" stroke-width="9" stroke-linecap="round"/><path d="M36 70c-10 14-24 16-28 30M48 76c-4 16-14 24-14 36M60 78c0 16 4 26 0 36M72 76c4 16 14 24 14 36M84 70c10 14 24 16 28 30" fill="none" stroke="#d9a8f5" stroke-width="2" stroke-dasharray="1 6" stroke-linecap="round"/><ellipse cx="60" cy="48" rx="34" ry="36" fill="url(#og-purple)"/><circle cx="46" cy="30" r="4" fill="#c58fe6" opacity=".8"/><circle cx="74" cy="26" r="3" fill="#c58fe6" opacity=".8"/><circle cx="80" cy="44" r="2.5" fill="#c58fe6" opacity=".8"/><ellipse cx="48" cy="54" rx="7" ry="8" fill="#fff"/><ellipse cx="72" cy="54" rx="7" ry="8" fill="#fff"/><circle cx="49" cy="56" r="3.6" fill="#15110e"/><circle cx="73" cy="56" r="3.6" fill="#15110e"/><path d="M54 68c4 3 8 3 12 0" fill="none" stroke="#3a1a52" stroke-width="2.5" stroke-linecap="round"/>`,
  couronne: () => `<path d="M14 90l-6-56 26 22 26-36 26 36 26-22-6 56z" fill="url(#og-gold)" stroke="#6b4c14" stroke-width="2.5" stroke-linejoin="round"/><rect x="14" y="88" width="92" height="14" rx="3" fill="url(#og-gold)" stroke="#6b4c14" stroke-width="2.5"/><circle cx="60" cy="70" r="8" fill="#c0392b" stroke="#6b4c14" stroke-width="2"/><circle cx="34" cy="76" r="5.5" fill="#2f6fb0" stroke="#6b4c14" stroke-width="2"/><circle cx="86" cy="76" r="5.5" fill="#3e8e4e" stroke="#6b4c14" stroke-width="2"/><circle cx="8" cy="34" r="4" fill="url(#og-gold)"/><circle cx="60" cy="20" r="5" fill="url(#og-gold)"/><circle cx="112" cy="34" r="4" fill="url(#og-gold)"/><path d="M57 67c2-2 4-2 6 0" stroke="#fff" stroke-width="2" opacity=".7"/>`,
  medaillon: () => `<path d="M22 8c4 30 18 44 38 44S94 38 98 8" fill="none" stroke="url(#og-gold)" stroke-width="3" stroke-dasharray="5 3"/><circle cx="60" cy="74" r="34" fill="url(#og-gold)" stroke="#6b4c14" stroke-width="3"/><circle cx="60" cy="74" r="26" fill="none" stroke="#6b4c14" stroke-width="1.5" opacity=".7"/><path d="M60 54l5.5 12.5 13.5 1.2-10.2 9 3 13.3L60 83l-11.8 7 3-13.3-10.2-9 13.5-1.2z" fill="#8a6620"/><path d="M40 60c4-8 12-12 20-12" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
  mystere: () => '<circle cx="60" cy="60" r="44" fill="#1b1f26" stroke="#8d99a3" stroke-width="3" stroke-dasharray="6 5"/><path d="M46 48c0-10 6-16 14-16s14 6 14 14c0 10-12 12-12 22M62 82v4" fill="none" stroke="#c9d1d8" stroke-width="7" stroke-linecap="round"/>',
};

/** Objets qui ont un tracé dédié dans Objet.dc.html (1 fichier source → affichage SVG unique). */
export const DIRECT_OBJECTS = Object.keys(PATHS);

/** SVG d'un objet 120 × 120. Si l'objet n'a pas de tracé dédié, on retombe sur un avatar qui le porte. */
export function objectSVG(slot: string, value: string | null, size = 120, color = '#2f5f8a', manteau = '#d9b25a'): string {
  if (!value) return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" style="display:block" aria-hidden="true">${DEFS}${PATHS.mystere('#2f5f8a')}</svg>`;
  const path = PATHS[value];
  if (path) return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" style="display:block;overflow:visible" aria-hidden="true">${DEFS}${path(color)}</svg>`;
  // Repli : avatar portant l'objet (foulard noué, chapeau à plume, bicorne, décors, cadres…)
  const look: Look = { hat: null, face: null, neck: null, pet: null, bg: 'mer', frame: null };
  (look as any)[slot] = value;
  const variantKey = slot === 'hat' ? 'htc' : slot === 'neck' ? 'nkc' : slot === 'pet' ? 'ptc' : null;
  if (variantKey) (look as any)[variantKey] = color;
  return `<span style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;background:${manteau};box-shadow:0 0 0 2px rgba(90,60,10,.4)">${avatarSVG(look, manteau, size)}</span>`;
}
