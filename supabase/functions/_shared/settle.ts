// Règlement d'une partie terminée (fonction pure) : places, mises tenues, XP, hauts faits, Élo et résumé pour l'écran de fin.
// Les bots ne reçoivent rien ; une partie avec un seul humain donne de l'XP mais ne compte pas pour l'Élo.
// Le résultat est écrit par la fonction SQL game_settle (idempotente) : voir supabase/migrations/20261003000000_profiles_xp.sql.
import * as E from './engine.ts';
import { eloDeltas } from './elo.ts';
import { XP, levelFor } from './xp.ts';

export const ACHIEVEMENTS: Record<string, { name: string; description: string }> = {
  first_game: { name: 'Premier abordage', description: 'Terminer une partie' },
  perfect: { name: 'Sans fausse note', description: 'Tenir toutes ses mises sur une partie' },
  kraken_bet: { name: 'Pari du Kraken', description: 'Tenir une mise de 0 à la manche 10' },
  siren_hunter: { name: 'Chasseur de sirènes', description: 'Capturer 10 sirènes au total' },
  grand_quinze: { name: 'Grand Quinze', description: 'Remporter un pli avec le Grand Quinze' },
  silk_thread: { name: 'Fil-de-Soie', description: 'Imposer avec Lise une carte qui remporte le pli' },
  captain: { name: 'Capitaine des mers', description: 'Gagner 10 parties' },
  abyss: { name: 'Fosse insondable', description: 'Engloutir un monstre avec la Fosse des Noyés' }, // la Fosse ne remporte jamais de pli (règle)
  mermaid_king: { name: 'La Sirène et le Roi', description: 'Capturer Barbe-Cendre avec une sirène' },
  velvet: { name: 'Main de velours', description: 'Tenir 5 mises à 0 au total' },
};

export interface SettleSeat { seat: number; user_id: string | null; bot: boolean; name: string }
/** Ce que la base sait d'un joueur avant la partie (fonction SQL settle_inputs). */
export interface SettleInput {
  xp: number; elo: number; ranked_games: number; games: number; wins: number;
  sirens_captured: number; zero_bids_made: number; achievements: string[];
}
export interface Settlement {
  results: { user_id: string; place: number; score: number; bids_made: number; rounds: number; players: number; elo_before: number; elo_after: number | null; elo_delta: number | null;
    /** état lu avant le calcul : game_settle refuse le règlement si l'un d'eux a changé entre-temps */ ranked_before: number; games_before: number }[];
  xp: { user_id: string; reason: string; amount: number }[];
  achievements: { user_id: string; code: string }[];
  stats: { user_id: string; win: number; bids_made: number; bids_total: number; score: number; sirens: number; zero_bids_made: number; ranked: boolean; elo_after: number }[];
  /** Résumé par utilisateur, publié dans games.state.settled pour l'écran de fin de partie. */
  public: Record<string, any>;
}

export function settleGame(S: E.State, seats: SettleSeat[], inputs: Record<string, SettleInput>): Settlement {
  const ranks = E.finalRanks(S);
  const humans = seats.filter(s => s.user_id && !s.bot && inputs[s.user_id]);
  const ranked = humans.length >= 2;
  const elo = ranked ? eloDeltas(humans.map(s => ({ id: s.user_id!, elo: Number(inputs[s.user_id!].elo), games: inputs[s.user_id!].ranked_games, place: ranks[s.seat] }))) : [];
  const out: Settlement = { results: [], xp: [], achievements: [], stats: [], public: {} };
  const nameOf = (uid: string) => humans.find(h => h.user_id === uid)?.name ?? '?';

  for (const s of humans) {
    const uid = s.user_id!, inp = inputs[uid], p = S.players[s.seat], hist = p.hist || [];
    const made = hist.filter((h: any) => h.bid === h.won).length;
    const zeroMade = hist.filter((h: any) => h.bid === 0 && h.won === 0).length;
    const place = ranks[s.seat], win = place === 1 ? 1 : 0;
    const f = p.feats ?? { sirens: 0, wild: 0, silk: 0, abyss: 0, mermaidKing: 0 };
    const last = hist.find((h: any) => h.r === 10);
    const earned: string[] = [];
    const check = (code: string, cond: boolean) => { if (cond) earned.push(code); };
    check('first_game', true);
    check('perfect', hist.length === 10 && made === 10);
    check('kraken_bet', !!last && last.bid === 0 && last.won === 0);
    check('siren_hunter', inp.sirens_captured + f.sirens >= 10);
    check('grand_quinze', f.wild > 0);
    check('silk_thread', f.silk > 0);
    check('captain', inp.wins + win >= 10);
    check('abyss', f.abyss > 0);
    check('mermaid_king', f.mermaidKing > 0);
    check('velvet', inp.zero_bids_made + zeroMade >= 5);
    const fresh = earned.filter(c => !inp.achievements.includes(c));

    const lines: { reason: string; amount: number }[] = [{ reason: 'game', amount: XP.game }];
    if (made) lines.push({ reason: 'bids', amount: XP.bid * made });
    if (win) lines.push({ reason: 'win', amount: XP.win });
    for (const c of fresh) lines.push({ reason: 'ach:' + c, amount: XP.achievement });
    const gain = lines.reduce((a, x) => a + x.amount, 0);

    const e = elo.find(x => x.id === uid);
    out.results.push({ user_id: uid, place, score: p.score, bids_made: made, rounds: hist.length, players: seats.length,
      elo_before: Number(inp.elo), elo_after: e ? e.after : null, elo_delta: e ? e.delta : null, ranked_before: inp.ranked_games, games_before: inp.games });
    out.xp.push(...lines.map(l => ({ user_id: uid, ...l })));
    out.achievements.push(...fresh.map(code => ({ user_id: uid, code })));
    out.stats.push({ user_id: uid, win, bids_made: made, bids_total: hist.length, score: p.score, sirens: f.sirens, zero_bids_made: zeroMade, ranked, elo_after: e ? e.after : Number(inp.elo) });
    out.public[uid] = {
      place, score: p.score, bidsMade: made, rounds: hist.length,
      xp: lines, xpTotal: gain, xpBefore: inp.xp, xpAfter: inp.xp + gain,
      levelBefore: levelFor(inp.xp).level, levelAfter: levelFor(inp.xp + gain).level,
      achievements: fresh.map(code => ({ code, ...ACHIEVEMENTS[code] })),
      elo: e ? { before: e.before, after: e.after, delta: e.delta, vs: e.vs.map(v => ({ ...v, name: nameOf(v.id) })) } : null,
    };
  }
  return out;
}
