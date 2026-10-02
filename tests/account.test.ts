// Tests des calculs du compte (fonctions pures) : Élo par paires, niveaux d'XP, règlement de fin de partie.
// Lancer : npx tsx tests/account.test.ts
import { eloDeltas, expected } from '../supabase/functions/_shared/elo.ts';
import { levelFor, xpToReach, titleFor } from '../supabase/functions/_shared/xp.ts';
import { settleGame, type SettleInput } from '../supabase/functions/_shared/settle.ts';
import * as E from '../supabase/functions/_shared/engine.ts';

let fails = 0, passes = 0;
const ok = (n: string, c: boolean, i?: unknown) => { if (c) passes++; else { fails++; console.error('ÉCHEC', n, i ?? ''); } };
const near = (a: number, b: number, eps = .051) => Math.abs(a - b) <= eps;

/* ---------- Élo ---------- */
{
  // 4 joueurs à 100, K = 20 (plus de 10 parties classées)
  const r = eloDeltas(['a', 'b', 'c', 'd'].map((id, i) => ({ id, elo: 100, games: 20, place: i + 1 })));
  ok('Élo : 4 joueurs à 100 → +10 / +3,3 / −3,3 / −10', near(r[0].delta, 10) && near(r[1].delta, 3.33, .01) && near(r[2].delta, -3.33, .01) && near(r[3].delta, -10), r.map(x => x.delta));
  ok('Élo : la somme des Δ vaut 0', near(r.reduce((s, x) => s + x.delta, 0), 0, .02));
  // K = 40 pendant les 10 premières parties classées
  const r40 = eloDeltas([{ id: 'a', elo: 100, games: 0, place: 1 }, { id: 'b', elo: 100, games: 9, place: 2 }]);
  ok('Élo : K = 40 au début', near(r40[0].delta, 20) && near(r40[1].delta, -20), r40);
  // exemple de la maquette : 133 / 122 / 172 / 99
  const ex = eloDeltas([{ id: 'theo', elo: 133, games: 30, place: 1 }, { id: 'corentin', elo: 122, games: 30, place: 2 }, { id: 'maelle', elo: 172, games: 30, place: 3 }, { id: 'ysolde', elo: 99, games: 30, place: 4 }]);
  ok('Élo : exemple 133 / 122 / 172 / 99 → +9,7 / +4,6 / −8,8 / −5,6', near(ex[0].delta, 9.7) && near(ex[1].delta, 4.6) && near(ex[2].delta, -8.8) && near(ex[3].delta, -5.6), ex.map(x => x.delta));
  const vs = Object.fromEntries(ex[0].vs.map(v => [v.id, v.delta]));
  ok('Élo : détail de Théo (Maëlle +4,7, Corentin +2,9, Ysolde +2,1)', near(vs.maelle, 4.7) && near(vs.corentin, 2.9) && near(vs.ysolde, 2.1), vs);
  // duel 60 contre 200, K = 20
  ok('Élo : 60 bat 200 → +19', near(eloDeltas([{ id: 'a', elo: 60, games: 20, place: 1 }, { id: 'b', elo: 200, games: 20, place: 2 }])[0].delta, 19.2, .3));
  ok('Élo : 200 bat 60 → +1', near(eloDeltas([{ id: 'a', elo: 200, games: 20, place: 1 }, { id: 'b', elo: 60, games: 20, place: 2 }])[0].delta, .8, .3));
  // plancher à 0
  const fl = eloDeltas([{ id: 'a', elo: 3, games: 0, place: 1 }, { id: 'b', elo: 3, games: 0, place: 2 }]);
  ok('Élo : plancher à 0', fl[1].after === 0 && fl[1].delta === -3, fl[1]);
  ok('Élo : égalité = 0,5', near(eloDeltas([{ id: 'a', elo: 100, games: 20, place: 1 }, { id: 'b', elo: 100, games: 20, place: 1 }])[0].delta, 0));
  ok('Élo : espérance symétrique', near(expected(120, 80) + expected(80, 120), 1, 1e-9));
  ok('Élo : un seul humain ne compte pas', eloDeltas([{ id: 'a', elo: 100, games: 0, place: 1 }]).length === 0);
}

/* ---------- Niveaux d'XP ---------- */
ok('XP : niveau 1 au départ', levelFor(0).level === 1 && levelFor(0).need === 250 && levelFor(0).title === 'Mousse');
ok('XP : 250 XP pour le niveau 2', levelFor(249).level === 1 && levelFor(250).level === 2);
ok('XP : total pour le niveau L = 125 × L × (L − 1)', xpToReach(13) === 125 * 13 * 12);
const l12 = levelFor(xpToReach(12) + 2340);
ok('XP : « 2 340 / 3 000 » au niveau 12', l12.level === 12 && l12.inLevel === 2340 && l12.need === 3000 && l12.title === 'Bosco', l12);
ok('XP : titres', titleFor(13) === 'Second' && titleFor(29) === 'Amiral' && titleFor(30) === 'Légende des 7 mers');

/* ---------- Règlement : état construit à la main ---------- */
{
  const S = E.newGame([{ name: 'Théo', bot: false }, { name: 'Maëlle', bot: false }, { name: 'Ysolde', bot: true }], {}, 1);
  const hist = (made: (r: number) => boolean, zeroLast: boolean) => Array.from({ length: 10 }, (_, k) => {
    const r = k + 1, bid = r === 10 && zeroLast ? 0 : 1, won = made(r) ? bid : bid + 1; return { r, cards: r, bid, won, base: 0, bonus: 0, items: [], tot: 0, score: 0 };
  });
  S.players[0].hist = hist(() => true, true);  S.players[0].score = 300;  // toutes les mises tenues, mise 0 tenue à la manche 10
  S.players[1].hist = hist(r => r !== 4, false); S.players[1].score = 120;
  S.players[2].score = 200;
  S.players[1].feats = { sirens: 3, wild: 1, silk: 0, abyss: 0, mermaidKing: 1 };
  const inputs: Record<string, SettleInput> = {
    u0: { xp: 0, elo: 100, ranked_games: 0, games: 0, wins: 0, sirens_captured: 0, zero_bids_made: 4, achievements: [] },
    u1: { xp: 1000, elo: 100, ranked_games: 0, games: 9, wins: 9, sirens_captured: 7, zero_bids_made: 0, achievements: ['first_game'] },
  };
  const seats = [{ seat: 0, user_id: 'u0', bot: false, name: 'Théo' }, { seat: 1, user_id: 'u1', bot: false, name: 'Maëlle' }, { seat: 2, user_id: null, bot: true, name: 'Ysolde' }];
  const st = settleGame(S, seats, inputs);
  const ach = (u: string) => st.achievements.filter(a => a.user_id === u).map(a => a.code).sort().join();
  ok('hauts faits : perfect, kraken_bet, velvet, first_game', ach('u0') === 'first_game,kraken_bet,perfect,velvet', ach('u0'));
  ok('hauts faits : cumuls (sirènes, Grand Quinze, Sirène et Roi) sans redonner first_game', ach('u1') === 'grand_quinze,mermaid_king,siren_hunter', ach('u1'));
  const xp0 = st.xp.filter(x => x.user_id === 'u0'), sum0 = xp0.reduce((s, x) => s + x.amount, 0);
  ok('XP : 50 + 10 × 10 mises + 100 victoire + 4 × 25 hauts faits', sum0 === 50 + 100 + 100 + 100, xp0);
  ok('XP : pas de victoire pour le 3e', !st.xp.some(x => x.user_id === 'u1' && x.reason === 'win'));
  ok('bots : rien', st.results.length === 2 && !st.xp.some(x => !x.user_id.startsWith('u')));
  ok('places : le bot compte dans les places', st.results.find(r => r.user_id === 'u1')!.place === 3);
  ok('Élo : entre humains seulement, 1er devant 3e', st.results[0].elo_delta! > 0 && st.results[1].elo_delta! < 0 && near(st.results[0].elo_delta! + st.results[1].elo_delta!, 0));
  ok('résumé : niveaux avant / après', st.public.u0.levelBefore === 1 && st.public.u0.levelAfter === 2 && st.public.u0.elo.vs[0].name === 'Maëlle', st.public.u0);
  // une seule personne : XP oui, Élo non
  const solo = settleGame(S, [seats[0], { ...seats[1], user_id: null, bot: true }, seats[2]], { u0: inputs.u0 });
  ok('un seul humain : XP sans Élo', solo.results[0].elo_delta === null && solo.stats[0].ranked === false && solo.xp.length > 0);
}

console.log(`Compte : ${passes} vérifications réussies, ${fails} échec(s).`);
if (fails) process.exit(1);
