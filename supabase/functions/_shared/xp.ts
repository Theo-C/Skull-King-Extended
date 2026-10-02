// XP et niveaux (docs/ecrans-compte/SPEC.md, « XP et niveaux »), partagés par le serveur et le site.
// Passer du niveau L au niveau L+1 coûte 250 × L XP : il faut 125 × L × (L − 1) XP au total pour atteindre le niveau L.

export const XP = { game: 50, bid: 10, win: 100, achievement: 25 } as const;

const TITLES: [number, string][] = [
  [1, 'Mousse'], [3, 'Matelot'], [5, 'Gabier'], [8, 'Quartier-maître'], [11, 'Bosco'],
  [13, 'Second'], [16, 'Capitaine'], [20, 'Corsaire'], [25, 'Amiral'], [30, 'Légende des 7 mers'],
];
export const LEVEL_TITLES = TITLES;

export const xpToReach = (level: number) => 125 * level * (level - 1);
export function titleFor(level: number) { let t = TITLES[0][1]; for (const [l, n] of TITLES) if (level >= l) t = n; return t; }

/** Niveau atteint avec `xp` points : numéro, titre, XP gagnée dans le niveau et XP nécessaire pour le suivant. */
export function levelFor(xp: number) {
  const x = Math.max(0, Math.floor(xp || 0));
  let level = 1; while (xpToReach(level + 1) <= x) level++;
  return { level, title: titleFor(level), inLevel: x - xpToReach(level), need: 250 * level };
}
