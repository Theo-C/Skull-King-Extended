// Tests du moteur : règles sensibles + parties complètes.
// Lancer : npx tsx tests/engine.test.ts
import * as E from '../supabase/functions/_shared/engine.ts';

let fails = 0, passes = 0;
function ok(name: string, cond: boolean, info?: unknown) { if (cond) passes++; else { fails++; console.error('ÉCHEC', name, info ?? ''); } }

/* ---------- Règles ---------- */
let id = 1000;
const N = (suit: any, rank: number, p: number, x: any = {}): E.Entry => ({ p, card: { id: id++, kind: 'num', suit, rank, ...x } });
const W = (p: number, ws: any): E.Entry => ({ p, card: { id: id++, kind: 'num', suit: 'wild', rank: 15, wild: 1 }, ws });
const S_ = (kind: string, p: number, x: any = {}): E.Entry => ({ p, card: { id: id++, kind, ...x }, ...(x.as ? { as: x.as } : {}) });
const win = (es: E.Entry[], rem: E.Entry[] = []) => { const r = E.resolve(es, rem); return r.discarded ? 'd' + r.next : r.winner!.p; };

ok('atout noir bat la couleur demandée', win([N('yellow', 14, 0), N('black', 1, 1)]) === 1);
ok('couleur non demandée perd', win([N('yellow', 2, 0), N('green', 14, 1)]) === 0);
ok('Sirène bat les chiffres', win([N('black', 14, 0), S_('mermaid', 1)]) === 1);
ok('Pirate bat Sirène', win([S_('mermaid', 0), S_('pirate', 1, { pid: 'rosie' })]) === 1);
ok('Skull King bat Pirate', win([S_('pirate', 0, { pid: 'rosie' }), S_('sk', 1)]) === 1);
ok('Sirène capture Skull King', win([S_('sk', 0), S_('mermaid', 1)]) === 1);
ok('Pirate + Skull King + Sirène : Sirène', win([S_('pirate', 0, { pid: 'rosie' }), S_('sk', 1), S_('mermaid', 2)]) === 2);
ok('premier Pirate gagne', win([S_('pirate', 0, { pid: 'rosie' }), S_('pirate', 1, { pid: 'harry' })]) === 0);
ok('Fuites seules : la première', win([S_('escape', 0), S_('escape', 1)]) === 0);
ok('Kraken : défaussé, gagnant virtuel entame', win([N('green', 3, 0), N('green', 9, 1), S_('kraken', 2)]) === 'd1');
ok('Baleine : plus haut chiffre toutes couleurs', win([N('green', 3, 0), N('yellow', 12, 1), S_('sk', 2), S_('whale', 3)]) === 1);
ok('Raie : plus petit chiffre', win([N('green', 9, 0), N('yellow', 2, 1), S_('stingray', 2)]) === 1);
ok('dernier monstre joué décide', win([N('green', 9, 0), N('yellow', 2, 1), S_('stingray', 2), S_('whale', 3)]) === 0);
ok('Fosse détruit le Kraken', win([S_('kraken', 0), N('green', 9, 1), S_('davy', 2)]) === 1);
ok('spéciales non gagnantes seules : défaussé', win([S_('davy', 0), S_('stingray', 1), S_('plank', 2)]) === 'd0');
ok('Fuites + Bordée : 1re Fuite', win([S_('escape', 0), S_('volley', 1), S_('escape', 2)]) === 0);
ok('Con bat Pirate', win([S_('pirate', 0, { pid: 'rosie' }), S_('con', 1)]) === 1);
ok('Pirate + Sirène + Con : Sirène', win([S_('pirate', 0, { pid: 'rosie' }), S_('mermaid', 1), S_('con', 2)]) === 1);
ok('Skull King bat Con', win([S_('con', 0), S_('sk', 1)]) === 1);
ok('Grand Quinze jaune bat 14 jaune', win([W(0, 'yellow'), N('yellow', 14, 1)]) === 0);
ok('Grand Quinze coupé par le noir', win([N('yellow', 3, 0), W(1, 'yellow'), N('black', 2, 2)]) === 2);
ok('noir demandé : Grand Quinze perd', win([N('black', 1, 0), W(1, null)]) === 0);
ok('Grand Quinze fixe la couleur', E.leadSuitOf([W(0, 'green')]) === 'green');
ok('0/14 à 14 après un 14 : premier joué', win([N('green', 14, 0), N('green', 14, 1, { zf: 1 })]) === 0);
{ const es = [S_('pirate', 0, { pid: 'rosie' }), S_('pirate', 1, { pid: 'harry' }), S_('plank', 2)]; ok('Planche retire le pirate gagnant', win(es, [es[0]]) === 1); }
ok('entame Fuite : couleur fixée ensuite', E.leadSuitOf([S_('escape', 0), N('purple', 4, 1)]) === 'purple');
ok('entame personnage : pas de couleur', E.leadSuitOf([S_('pirate', 0, { pid: 'rosie' }), N('purple', 4, 1)]) === null);
{ const hand: any[] = [{ id: 1, kind: 'num', suit: 'yellow', rank: 3 }, { id: 2, kind: 'num', suit: 'green', rank: 3 }, { id: 3, kind: 'escape' }, { id: 4, kind: 'num', suit: 'wild', rank: 15, wild: 1 }];
  const l = E.legalCards(hand, [N('yellow', 5, 0)]).map(c => c.id); ok('fournir la couleur, spéciales et Quinze permis', l.join() === '1,3,4', l); }
ok('Fosse retirée sans monstre', E.normalizeOpts({ kraken: false, whale: false, ray: false, davy: true }).davy === false);

/* ---------- Parties complètes ---------- */
function roundTrip<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }
function randomAction(S: E.State, seat: number, r: () => number): E.Action {
  const pub = E.publicView(S), priv = E.privateView(S, seat);
  if (pub.phase === 'bid') return { t: 'bid', n: Math.floor(r() * (S.cards + 1)) };
  if (pub.pending && pub.pending.seat === seat) {
    if (pub.pending.t === 'bahij') { const k = priv.pendingData.k; return { t: 'choose', v: priv.hand.slice(0, k).map(c => c.id) }; }
    const o = (pub.pending.opts as any[]).filter(x => !x.disabled); const c = o[Math.floor(r() * o.length)];
    if (pub.pending.t === 'mary' && r() < .5) return { t: 'choose', v: { seat: c.v, pos: Math.floor(r() * c.count) } };
    return { t: 'choose', v: c.v };
  }
  const id = priv.legal[Math.floor(r() * priv.legal.length)];
  return { t: 'play', id, as: r() < .5 ? 'pirate' : 'escape', val: r() < .5 ? 0 : 14, ws: E.WILD_SUITS[Math.floor(r() * 3)] };
}
let games = 0, maxEv = 0;
for (let g = 0; g < 60; g++) {
  const n = 3 + (g % 7); const humans = g % 3; // 0, 1 ou 2 humains simulés, le reste en bots
  const seats = Array.from({ length: n }, (_, i) => ({ name: 'J' + i, bot: i >= humans }));
  let S = E.newGame(seats, { powers: true, exp: true }, 1000 + g);
  let seed = g * 7 + 1; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  E.runBots(S);
  let steps = 0;
  while (S.phase !== 'end' && steps < 20000) {
    S = roundTrip(S); // comme si l'état passait par la base de données à chaque coup
    const w = E.waitingFor(S); if (!w.length) throw new Error('blocage sans attente');
    const seat = w[0];
    ok('attend un humain', !S.players[seat].bot, { seat, phase: S.phase });
    E.apply(S, seat, randomAction(S, seat, r));
    E.runBots(S);
    maxEv = Math.max(maxEv, (S.ev || []).length); E.takeEvents(S);
    // invariant : pendant une manche, chaque main a au plus le nombre de cartes distribuées
    S.players.forEach((p, i) => ok('taille de main', p.hand.length <= S.cards + (S.pending[0]?.t === 'bahij' && S.pending[0].seat === i ? 2 : 0), p.hand.length));
    steps++;
  }
  ok('partie terminée', S.phase === 'end', { g, round: S.round, phase: S.phase });
  ok('10 manches notées', S.players.every(p => p.hist.length === 10));
  ok('scores cohérents', S.players.every(p => p.score === p.hist.reduce((s: number, h: any) => s + h.tot, 0)));
  games++;
}
// Rien de secret dans la vue publique
{ const S = E.newGame([{ name: 'A', bot: false }, { name: 'B', bot: true }, { name: 'C', bot: true }, { name: 'D', bot: true }], {}, 7);
  const pub = JSON.stringify(E.publicView(S));
  ok('aucune main dans la vue publique', !pub.includes('"hand"') && !pub.includes('"deck"'));
  ok('mise des autres cachée avant révélation', E.publicView(S).players.every(p => p.bid === null)); }

// Marie Thorne : carte choisie face cachée
{
  // on cherche une vraie situation de jeu où un humain doit utiliser Marie Thorne
  let S: E.State | null = null;
  for (let g = 0; g < 400 && !S; g++) {
    let T = E.newGame(['A', 'B', 'C', 'D'].map(name => ({ name, bot: false })), { powers: true, exp: true }, 5000 + g);
    let seed = g + 3; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let k = 0; k < 3000 && T.phase !== 'end'; k++) {
      if (T.pending[0]?.t === 'mary') { S = T; break; }
      const w = E.waitingFor(T); const a = randomAction(T, w[0], r);
      if (a.t === 'choose' && T.pending[0]?.t === 'mary') continue;
      E.apply(T, w[0], a); E.takeEvents(T);
    }
  }
  ok('situation Marie Thorne trouvée', !!S);
  if (S) {
    const pd = S.pending[0], by = pd.seat, pub = E.publicView(S);
    const opts = pub.pending!.opts as any[];
    ok('Lise : options avec le nombre de cartes', opts.every(o => o.count === S!.players[o.v].hand.length), opts);
    ok('Lise : ordre secret absent de la vue publique', !JSON.stringify(pub).includes('perm') && !JSON.stringify(E.privateView(S, by)).includes('perm'));
    ok('Lise : ordre secret présent côté serveur', opts.every(o => Array.isArray(pd.data.perm[o.v]) && pd.data.perm[o.v].length === o.count));
    const target = opts.find(o => o.v !== by) ?? opts[0];
    // positions invalides refusées
    for (const pos of [-1, target.count, 1.5, '0' as any]) {
      const T = roundTrip(S); let refused = false;
      try { E.apply(T, by, { t: 'choose', v: { seat: target.v, pos } }); } catch (e) { refused = e instanceof E.RuleError; }
      ok('Lise : position invalide refusée (' + pos + ')', refused);
    }
    // la carte cliquée devient la carte imposée
    const pos = target.count - 1, T = roundTrip(S);
    const expected = T.players[target.v].hand[T.pending[0].data.perm[target.v][pos]].id;
    E.apply(T, by, { t: 'choose', v: { seat: target.v, pos } });
    ok('Lise : la carte cliquée devient S.forced[seat]', T.forced[target.v] === expected, { got: T.forced[target.v], expected });
    const ll = E.publicView(T).lastLise;
    ok('Lise : lastLise public', !!ll && ll.by === by && ll.seat === target.v && ll.pos === pos);
    ok("Lise : lastLise ne révèle pas la carte", !!ll && Object.keys(ll).sort().join() === 'by,pos,round,seat,trickNo');
    const ev = E.takeEvents(T).find((x: any) => x.k === 'lise');
    ok('Lise : événement « lise »', !!ev && ev.seat === target.v && ev.pos === pos && !JSON.stringify(ev).includes('perm'));
    // l'ancien format (siège seul) tire toujours une carte au hasard dans cette main
    const U = roundTrip(S); E.apply(U, by, { t: 'choose', v: target.v });
    ok('Lise : siège seul accepté', U.players[target.v].hand.some(c => c.id === U.forced[target.v]));
    // au pli suivant, la carte arrive sur la table marquée « imposée »
    let seed = 99; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let played: E.Entry | undefined;
    for (let k = 0; k < 200 && !played && T.phase === 'play'; k++) {
      const w = E.waitingFor(T); E.apply(T, w[0], randomAction(T, w[0], r)); E.takeEvents(T);
      played = (T.trick?.entries || []).find(e => e.card.id === expected) ?? (T.lastTrick?.entries || []).find((e: E.Entry) => e.card.id === expected);
    }
    ok('Lise : carte jouée marquée imposée', !!played && played.imposed === true && played.p === target.v, played);
  }
}

// Journal : une ligne « bonus » / « malus » par bonus gagné
{
  let found = { bonus: 0, malus: 0, wrong: 0 };
  for (let g = 0; g < 30; g++) {
    const S = E.newGame(['A', 'B', 'C', 'D'].map((name, i) => ({ name, bot: true })), { powers: true, exp: true }, 9000 + g);
    E.runBots(S);
    for (const l of S.log) if (l.cls === 'bonus' || l.cls === 'malus') {
      const txt = l.s.join(''); const m = /^([+−])(\d+) pour (.+?) : (.+)$/.exec(txt);
      if (!m || (l.cls === 'malus') !== (m[1] === '−')) found.wrong++; else found[l.cls]++;
    }
  }
  ok('journal : lignes de bonus', found.bonus > 0, found);
  ok('journal : lignes de malus (7 / 8 de l\'extension)', found.malus > 0, found);
  ok('journal : format « +30 pour Maëlle : raison »', found.wrong === 0, found);
}

console.log(`Moteur : ${passes} vérifications réussies, ${fails} échec(s), ${games} parties complètes, max ${maxEv} événements par coup.`);
if (fails) process.exit(1);
