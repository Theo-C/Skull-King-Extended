// Élo multijoueur par paires (docs/ecrans-compte/SPEC.md, « Élo et classement »). Fonction pure, testée dans tests/elo.test.ts.
//   S = 1 si i finit devant j, 0,5 à égalité, 0 sinon ; E = 1 / (1 + 10^((Rj − Ri) / 100)) ;
//   Δi = K / (n − 1) × Σj (S − E), avec K = 40 pendant les 10 premières parties classées, 20 ensuite ; plancher à 0.
// Les bots sont exclus par l'appelant ; une partie avec un seul humain ne compte pas (aucun Δ).

export interface EloPlayer { id: string; elo: number; games: number; place: number }
export interface EloResult { id: string; before: number; after: number; delta: number; k: number; vs: { id: string; delta: number }[] }

export const ELO_START = 100;
export const kFor = (rankedGames: number) => rankedGames < 10 ? 40 : 20;
export const expected = (ri: number, rj: number) => 1 / (1 + Math.pow(10, (rj - ri) / 100));

export function eloDeltas(players: EloPlayer[]): EloResult[] {
  const n = players.length;
  if (n < 2) return [];
  return players.map(p => {
    const k = kFor(p.games), w = k / (n - 1);
    const vs = players.filter(q => q.id !== p.id).map(q => {
      const s = p.place < q.place ? 1 : p.place === q.place ? .5 : 0;
      return { id: q.id, delta: w * (s - expected(p.elo, q.elo)) };
    });
    const delta = vs.reduce((a, x) => a + x.delta, 0);
    const after = Math.max(0, p.elo + delta);
    return { id: p.id, before: p.elo, after: round2(after), delta: round2(after - p.elo), k, vs: vs.map(x => ({ id: x.id, delta: round2(x.delta) })) };
  });
}
export const round2 = (x: number) => Math.round(x * 100) / 100;
