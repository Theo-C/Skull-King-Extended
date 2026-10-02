// Niveaux d'XP côté site : même formule que le serveur (supabase/functions/_shared/xp.ts, testée dans tests/account.test.ts).
export { levelFor, xpToReach, titleFor, LEVEL_TITLES, XP } from '@shared/xp';
import { levelFor } from '@shared/xp';

const nf = new Intl.NumberFormat('fr-FR');
export const fmt = (n: number) => nf.format(Math.round(n));
/** Barre d'XP : « 2 340 / 3 000 ». */
export function xpLine(xp: number) { const l = levelFor(xp); return { ...l, pct: Math.min(100, Math.round(100 * l.inLevel / l.need)), text: `${fmt(l.inLevel)} / ${fmt(l.need)}` }; }

const ACH_NAMES: Record<string, string> = {
  first_game: 'Premier abordage', perfect: 'Sans fausse note', kraken_bet: 'Pari du Kraken', siren_hunter: 'Chasseur de sirènes', grand_quinze: 'Grand Quinze',
  silk_thread: 'Fil-de-Soie', captain: 'Capitaine des mers', abyss: 'Fosse insondable', mermaid_king: 'La Sirène et le Roi', velvet: 'Main de velours',
};
/** Libellé d'une ligne d'XP (game, bids, win, ach:<code>). */
export function xpReason(reason: string, amount: number) {
  if (reason === 'game') return 'Partie terminée';
  if (reason === 'bids') return `${amount / 10} mise${amount > 10 ? 's' : ''} tenue${amount > 10 ? 's' : ''} × 10`;
  if (reason === 'win') return 'Victoire';
  if (reason.startsWith('ach:')) return 'Haut fait : ' + (ACH_NAMES[reason.slice(4)] ?? reason.slice(4));
  return reason;
}
