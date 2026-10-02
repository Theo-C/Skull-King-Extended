// Niveaux d'XP côté site : même formule que le serveur (supabase/functions/_shared/xp.ts, testée dans tests/account.test.ts).
export { levelFor, xpToReach, titleFor, LEVEL_TITLES, XP } from '@shared/xp';
import { levelFor } from '@shared/xp';

const nf = new Intl.NumberFormat('fr-FR');
export const fmt = (n: number) => nf.format(Math.round(n));
/** Barre d'XP : « 2 340 / 3 000 ». */
export function xpLine(xp: number) { const l = levelFor(xp); return { ...l, pct: Math.min(100, Math.round(100 * l.inLevel / l.need)), text: `${fmt(l.inLevel)} / ${fmt(l.need)}` }; }
