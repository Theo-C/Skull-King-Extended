// Moteur de règles du Pli des Pirates (règles Skull King + extension).
// Module sans dépendance : utilisé par la fonction serveur (Deno) et par le site (navigateur).
// L'état complet (mains, pioche) ne quitte jamais le serveur : le site ne reçoit que publicView() et privateView().

export type Suit = 'yellow' | 'purple' | 'green' | 'black';
export interface Card {
  id: number; kind: string; suit?: Suit | 'wild'; rank?: number; pid?: string; v?: number;
  mod?: number; zf?: 1; wild?: 1; exp?: 1;
}
export interface Entry { p: number; card: Card; as?: 'pirate' | 'escape'; val?: number; ws?: Suit | null; extra?: boolean; imposed?: boolean; imposedBy?: number }
export interface Opts {
  kraken: boolean; whale: boolean; loot: boolean; powers: boolean; score: 'sk' | 'rascal';
  exp: boolean; con: boolean; volley: boolean; ray: boolean; davy: boolean; plank: boolean;
  /** nombre de manches (1 à 10) : une partie de moins de 10 manches ne compte pas pour l'Élo */
  rounds: number;
}
export const DEFAULT_OPTS: Opts = { kraken: true, whale: true, loot: true, powers: true, score: 'sk', exp: true, con: true, volley: true, ray: true, davy: true, plank: true, rounds: 10 };
export const MAX_ROUNDS = 10;
/** Nombre de manches d'une partie (10 pour les parties créées avant l'option). */
export const roundsOf = (o?: Partial<Opts> | null) => { const r = Math.round(Number(o?.rounds)); return r >= 1 && r <= MAX_ROUNDS ? r : MAX_ROUNDS; };
export type LogSeg = string | { c: Card; e?: Partial<Entry> };
export interface LogLine { s: LogSeg[]; cls?: string }
export interface Pending { t: string; seat: number; data?: any }
export interface Player {
  name: string; bot: boolean; uid?: string | null; score: number; hist: any[];
  bid: number | null; won: number; bonus: [number, string][]; rascal: number; hand: Card[];
  /** Compteurs pour les hauts faits (jamais dans la vue publique) : sirènes capturées, plis gagnés avec le Grand Quinze ou la carte imposée par Marie Thorne, monstres engloutis par la Fosse, Skull King capturé par une Sirène. */
  feats?: Feats;
}
export interface Feats { sirens: number; wild: number; silk: number; abyss: number; mermaidKing: number }
export interface State {
  v: number; opts: Opts; n: number; players: Player[]; round: number; cards: number; dealer: number; leader: number;
  phase: 'bid' | 'play' | 'end'; bidsRevealed: boolean; trickNo: number; deck: Card[];
  trick: null | { entries: Entry[]; order: number[]; pos: number; volleyQ: number[]; vpos: number; stage: 'main' | 'volley' | 'plank' | 'powers'; removals: number[]; res: any };
  forced: Record<number, number>; /** qui a imposé la carte (Marie Thorne), pour le haut fait */ forcedBy?: Record<number, number>; alliances: [number, number][]; pending: Pending[]; rosieNext: number | null;
  lastTrick: any; log: LogLine[]; ev?: any[]; rng?: number;
  /** Dernier pouvoir de Marie Thorne : qui a choisi, dans quelle main, à quelle position de l'éventail face cachée. */
  lastLise?: LiseInfo | null;
}
export interface LiseInfo { by: number; seat: number; pos: number; round: number; trickNo: number }

/* ---------- Données ---------- */
export const SUIT_ORDER: Suit[] = ['black', 'yellow', 'purple', 'green'];
export const SUIT: Record<string, { n: string }> = { yellow: { n: 'Doublon' }, purple: { n: 'Carte marine' }, green: { n: 'Perroquet' }, black: { n: 'Pavillon noir' } };
export const PIRATES: Record<string, { n: string; s: string; pw: string }> = {
  rosie: { n: 'Rosie la douce', s: 'Rosie', pw: 'choisit qui entame le prochain pli' },
  bahij: { n: 'Bendt le Ripate', s: 'Bendt', pw: 'pioche 2 cartes non distribuées puis en défausse 2' },
  rascal: { n: 'Rascal le Flambeur', s: 'Rascal', pw: 'mise 0, 10 ou 20 points sur la réussite de son pari' },
  juanita: { n: 'Juanita Jade', s: 'Juanita', pw: 'consulte en secret les cartes non distribuées' },
  harry: { n: 'Harry le géant', s: 'Harry', pw: 'peut modifier son pari de +1 ou −1' },
  mary: { n: 'Marie Thorne', s: 'Marie', pw: "tire au hasard une carte dans la main d'un joueur, lui compris : il devra la jouer au pli suivant" },
};
export const SPECIAL: Record<string, string> = {
  escape: 'Drapeau blanc', tigress: 'Morgane la Louve', sk: 'Skull King', mermaid: 'Sirène', kraken: 'Le Kraken',
  whale: 'La Baleine Fantôme', loot: 'Pacte de Butin', con: 'Con le belliqueux', volley: 'Dernière Bordée',
  stingray: 'La Raie Étoilée', davy: 'La Fosse des Noyés', plank: 'La Planche',
};
export const DESC: Record<string, string> = {
  escape: "Drapeau blanc (Fuite) : perd contre toutes les autres cartes. Si le pli ne contient que des Fuites, la première jouée l'emporte.",
  tigress: 'Morgane la Louve : annoncez en la jouant si elle compte comme un Pirate ou comme une Fuite.',
  sk: 'Skull King, roi des pirates : bat les cartes numérotées et tous les Pirates (+30 par Pirate capturé). Perd contre les Sirènes.',
  mermaid: 'Sirène : bat les cartes numérotées et capture Skull King (+40). Perd contre les Pirates.',
  pirate: 'Pirate : bat les cartes numérotées et les Sirènes (+20 par Sirène capturée).',
  kraken: "Le Kraken : le pli est détruit, personne ne le remporte. Le joueur qui l'aurait gagné entame le suivant.",
  whale: "La Baleine Fantôme : les cartes spéciales du pli perdent leur effet, la plus haute carte numérotée l'emporte, toutes couleurs confondues.",
  loot: 'Pacte de Butin : se joue comme une Fuite. Vous vous alliez au joueur qui remporte le pli : +20 chacun si vous réussissez tous deux votre mise.',
  con: 'Con le belliqueux : bat toutes les cartes sauf Skull King et les Sirènes. Le gagnant utilise les pouvoirs des Pirates capturés ; qui le capture gagne +30.',
  volley: 'Dernière Bordée : ne gagne pas. Une fois que tout le monde a joué, vous jouez une carte de plus dans ce pli.',
  stingray: "La Raie Étoilée : les cartes spéciales perdent leur effet, la plus petite carte numérotée l'emporte.",
  davy: 'La Fosse des Noyés : ne gagne pas. Engloutit tous les monstres des abysses du pli (+20 par monstre pour vous).',
  plank: 'La Planche : ne gagne pas. En fin de pli, vous retirez un Pirate du pli.',
  wild: "Le Grand Quinze : se joue comme un 15 Doublon, Carte marine ou Perroquet. Il suit la couleur demandée ; s'il ouvre la couleur, vous choisissez laquelle. Le Pavillon noir le bat.",
  zf: '0/14 : annoncez 0 ou 14 en la jouant. Pas de bonus de 14.',
};
export const WILD_SUITS: Suit[] = ['yellow', 'purple', 'green'];
export const BOT_NAMES = ['Ysolde', 'Corentin', 'Maëlle', 'Elouan', 'Lucie', 'Armel', 'Soizic', 'Tanguy', 'Rozenn'];

export function normalizeOpts(o: Partial<Opts> | undefined): Opts {
  const x: Opts = { ...DEFAULT_OPTS, ...(o || {}) } as Opts;
  for (const k of Object.keys(DEFAULT_OPTS) as (keyof Opts)[]) if (k !== 'score' && k !== 'rounds') (x as any)[k] = !!(x as any)[k];
  x.rounds = roundsOf(x);
  x.score = x.score === 'rascal' ? 'rascal' : 'sk';
  if (!x.exp) { x.con = x.volley = x.ray = x.davy = x.plank = false; }
  // Le Casier/Fosse ne s'utilise qu'avec au moins un monstre des abysses dans le paquet (règle FR de l'extension)
  if (!(x.kraken || x.whale || x.ray)) x.davy = false;
  return x;
}

export function buildDeck(o: Opts): Card[] {
  let id = 0; const d: Card[] = []; const add = (c: Omit<Card, 'id'>) => { d.push({ ...c, id: id++ } as Card); };
  for (const s of SUIT_ORDER) for (let r = 1; r <= 14; r++) add({ kind: 'num', suit: s, rank: r });
  for (let i = 0; i < 5; i++) add({ kind: 'escape' });
  for (const pid of ['rosie', 'bahij', 'rascal', 'juanita', 'harry']) add({ kind: 'pirate', pid });
  add({ kind: 'tigress' }); add({ kind: 'sk' }); add({ kind: 'mermaid', v: 0 }); add({ kind: 'mermaid', v: 1 });
  if (o.kraken) add({ kind: 'kraken' });
  if (o.whale) add({ kind: 'whale' });
  if (o.loot) { add({ kind: 'loot' }); add({ kind: 'loot' }); }
  if (o.exp) {
    for (const s of SUIT_ORDER) { add({ kind: 'num', suit: s, rank: 7, mod: -5, exp: 1 }); add({ kind: 'num', suit: s, rank: 8, mod: 5, exp: 1 }); add({ kind: 'num', suit: s, rank: 14, zf: 1, exp: 1 }); }
    add({ kind: 'num', suit: 'wild', rank: 15, wild: 1, exp: 1 });
    add({ kind: 'pirate', pid: 'mary', exp: 1 });
    if (o.con) add({ kind: 'con', exp: 1 });
    if (o.volley) add({ kind: 'volley', exp: 1 });
    if (o.ray) add({ kind: 'stingray', exp: 1 });
    if (o.davy) add({ kind: 'davy', exp: 1 });
    if (o.plank) add({ kind: 'plank', exp: 1 });
  }
  return d;
}
const SPEC_ORDER = ['sk', 'con', 'pirate', 'tigress', 'mermaid', 'kraken', 'whale', 'stingray', 'davy', 'plank', 'volley', 'loot', 'escape'];
export function sortKey(c: Card) {
  if (c.kind === 'num') { if (c.wild) return 990; return 100 + SUIT_ORDER.indexOf(c.suit as Suit) * 100 + (c.zf ? 14.5 : c.rank!) + (c.mod ? .2 : 0); }
  return SPEC_ORDER.indexOf(c.kind);
}
export const sortHand = (h: Card[]) => h.sort((a, b) => sortKey(a) - sortKey(b));

export function cname(c: Card, e?: Partial<Entry>): string {
  if (c.kind === 'num') {
    if (c.wild) return e && e.ws ? `Grand Quinze (${SUIT[e.ws].n})` : 'Le Grand Quinze';
    const s = SUIT[c.suit as string].n;
    if (c.zf) return e && e.val != null ? `${e.val} ${s} (0/14)` : `0/14 ${s}`;
    return `${c.rank} ${s}` + (c.mod ? (c.mod > 0 ? ' (+5)' : ' (−5)') : '');
  }
  if (c.kind === 'pirate') return PIRATES[c.pid!].n;
  if (c.kind === 'mermaid') return c.v ? 'Circé' : 'Alyra';
  if (c.kind === 'tigress') return 'Morgane la Louve' + (e && e.as ? (e.as === 'pirate' ? ' (pirate)' : ' (fuite)') : '');
  return SPECIAL[c.kind];
}
export function cardTitle(c: Card) {
  if (c.kind === 'num') {
    if (c.wild) return DESC.wild; if (c.zf) return DESC.zf;
    if (c.mod) return `${cname(c)} : capturé, ${c.mod > 0 ? '+5' : '−5'} points si le pari est réussi.`;
    return cname(c) + (c.suit === 'black' ? ' (atout)' : '');
  }
  if (c.kind === 'pirate') return `${PIRATES[c.pid!].n} — Pirate. Pouvoir : ${PIRATES[c.pid!].pw}.`;
  return DESC[c.kind] || cname(c);
}

/* ---------- Résolution d'un pli ---------- */
const MONSTERS = ['kraken', 'whale', 'stingray'];
const isNum = (e: Entry) => e.card.kind === 'num';
const numVal = (e: Entry) => e.card.wild ? 15 : (e.card.zf ? (e.val ?? 14) : e.card.rank!);
export const isPir = (e: Entry) => e.card.kind === 'pirate' || (e.card.kind === 'tigress' && e.as === 'pirate');
export const isEsc = (e: Entry) => { const k = e.card.kind; return k === 'escape' || k === 'loot' || (k === 'tigress' && e.as !== 'pirate'); };
export function leadStateOf(es: Entry[]): { suit: Suit | null; locked?: boolean } {
  for (const e of es) {
    const k = e.card.kind;
    if (k === 'num') { if (e.card.wild) { if (e.ws) return { suit: e.ws }; continue; } return { suit: e.card.suit as Suit }; }
    if (k === 'sk' || k === 'mermaid' || k === 'kraken' || k === 'whale' || k === 'con' || isPir(e)) return { suit: null, locked: true };
  }
  return { suit: null };
}
export const leadSuitOf = (es: Entry[]) => leadStateOf(es).suit;
// Grand Quinze : il suit la couleur demandée (sauf noir) ; si aucune couleur n'est définie, le joueur la choisit.
export function wildRule(entries: Entry[]): { auto?: Suit | null; choose?: boolean } {
  const st = leadStateOf(entries);
  if (st.suit && st.suit !== 'black') return { auto: st.suit };
  if (st.suit === 'black') return { auto: null };
  return { choose: true };
}
function normalWinner(es: Entry[]): { w: Entry | null; b: [number, string][] } {
  const sk = es.find(e => e.card.kind === 'sk'), con = es.find(e => e.card.kind === 'con');
  const mer = es.filter(e => e.card.kind === 'mermaid'), pir = es.filter(isPir); const b: [number, string][] = [];
  if (mer.length && (sk || con)) {
    if (sk) b.push([40, 'Skull King capturé par une Sirène']);
    if (con) b.push([30, 'Con capturé']);
    return { w: mer[0], b };
  }
  if (sk) { pir.forEach(() => b.push([30, 'Pirate capturé par Skull King'])); if (con) b.push([30, 'Con capturé']); return { w: sk, b }; }
  if (con) return { w: con, b };
  if (pir.length) { mer.forEach(() => b.push([20, 'Sirène capturée par un pirate'])); return { w: pir[0], b }; }
  if (mer.length) return { w: mer[0], b };
  const nums = es.filter(isNum);
  if (nums.length) {
    let ls = leadSuitOf(es);
    if (!ls) { const f = nums.find(e => !e.card.wild || e.ws); ls = f ? (f.card.wild ? f.ws! : f.card.suit as Suit) : null; }
    let best: Entry | null = null, bs = -1e9;
    for (const e of nums) {
      const c = e.card; let s: number;
      if (c.wild) s = (e.ws && e.ws === ls) ? 65 : (15 - 100);
      else if (c.suit === 'black') s = 100 + numVal(e);
      else if (c.suit === ls) s = 50 + numVal(e);
      else s = numVal(e) - 100;
      if (s > bs) { bs = s; best = e; }
    }
    return { w: best, b };
  }
  const ex = es.filter(isEsc); if (ex.length) return { w: ex[0], b };
  return { w: null, b };
}
export interface Resolution { winner: Entry | null; discarded: boolean; next: number; mode: string | null; bonus: [number, string][]; captured: Entry[]; removed: Entry[]; davy: { p: number; n: number } | null }
export function resolve(entries: Entry[], removals: Entry[] = []): Resolution {
  const leaderP = entries[0].p; let es = entries.slice(); const removed: Entry[] = []; let davy: any = null;
  const dj = es.find(e => e.card.kind === 'davy');
  if (dj) {
    const ms = es.filter(e => MONSTERS.includes(e.card.kind)); davy = { p: dj.p, n: ms.length };
    es = es.filter(e => { if (e === dj || ms.includes(e)) { removed.push(e); return false; } return true; });
  }
  if (removals.length) es = es.filter(e => { if (removals.includes(e)) { removed.push(e); return false; } return true; });
  const R: Resolution = { winner: null, discarded: false, next: leaderP, mode: null, bonus: [], captured: es, removed, davy };
  if (!es.length) { R.discarded = true; return R; }
  const ms = es.filter(e => MONSTERS.includes(e.card.kind)); const last = ms[ms.length - 1];
  const rest = es.filter(e => !MONSTERS.includes(e.card.kind));
  if (last && last.card.kind === 'kraken') { const nw = normalWinner(rest).w; R.discarded = true; R.mode = 'kraken'; R.next = nw ? nw.p : leaderP; return R; }
  if (last) {
    const hi = last.card.kind === 'whale'; R.mode = last.card.kind; const nums = es.filter(isNum);
    if (!nums.length) { R.discarded = true; R.next = last.p; return R; }
    let best = nums[0]; for (const e of nums) { if (hi ? numVal(e) > numVal(best) : numVal(e) < numVal(best)) best = e; }
    R.winner = best; R.next = best.p; return R;
  }
  const { w, b } = normalWinner(rest);
  if (!w) { R.discarded = true; R.next = leaderP; return R; }
  R.winner = w; R.bonus = b; R.next = w.p; return R;
}
function cardBonuses(es: Entry[]): [number, string][] {
  const out: [number, string][] = [];
  for (const e of es) {
    const c = e.card; if (c.kind !== 'num' || c.wild || c.zf) continue;
    if (c.rank === 14) out.push([c.suit === 'black' ? 20 : 10, `14 ${SUIT[c.suit as string].n} capturé`]);
    if (c.mod) out.push([c.mod, `${c.rank} ${SUIT[c.suit as string].n} capturé`]);
  }
  return out;
}
export function legalCards(hand: Card[], entries: Entry[], forcedId?: number | null): Card[] {
  if (forcedId != null) { const c = hand.find(x => x.id === forcedId); if (c) return [c]; }
  const ls = leadSuitOf(entries);
  if (ls && hand.some(c => c.kind === 'num' && c.suit === ls)) return hand.filter(c => c.kind !== 'num' || c.suit === ls || c.wild);
  return hand.slice();
}

/* ---------- Hasard ---------- */
function rand(S: State) {
  if (S.rng == null) return Math.random();
  // mulberry32 : rend les tests reproductibles quand une graine est fournie
  let t = (S.rng = (S.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(S: State, a: T[]) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(S) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---------- Création et vues ---------- */
export interface SeatInit { name: string; bot: boolean; uid?: string | null }
export function newGame(seats: SeatInit[], opts: Partial<Opts>, seed?: number): State {
  if (seats.length < 3 || seats.length > 9) throw new Error('Il faut entre 3 et 9 joueurs.');
  const S: State = {
    v: 1, opts: normalizeOpts(opts), n: seats.length,
    players: seats.map(s => ({ name: s.name, bot: !!s.bot, uid: s.uid ?? null, score: 0, hist: [], bid: null, won: 0, bonus: [], rascal: 0, hand: [] })),
    round: 0, cards: 0, dealer: 0, leader: 0, phase: 'bid', bidsRevealed: false, trickNo: 0, deck: [], trick: null,
    forced: {}, alliances: [], pending: [], rosieNext: null, lastTrick: null, log: [], ev: [], rng: seed,
  };
  S.dealer = Math.floor(rand(S) * S.n) - 1;
  startRound(S);
  return S;
}
export function currentSeat(S: State): number | null {
  if (S.phase !== 'play' || !S.trick) return null;
  if (S.pending.length) return S.pending[0].seat;
  const t = S.trick;
  if (t.stage === 'main') return t.order[t.pos] ?? null;
  if (t.stage === 'volley') return t.volleyQ[t.vpos] ?? null;
  return null;
}
/** Sièges dont le jeu attend une action (pour savoir à qui c'est le tour). */
export function waitingFor(S: State): number[] {
  if (S.phase === 'bid') return S.players.map((p, i) => p.bid == null ? i : -1).filter(i => i >= 0);
  const c = currentSeat(S); return c == null ? [] : [c];
}
export function publicView(S: State, lite = false, withHist = true) {
  const t = S.trick;
  return {
    round: S.round, cards: S.cards, phase: S.phase, dealer: S.dealer, leader: S.leader, trickNo: S.trickNo, n: S.n,
    bidsRevealed: S.bidsRevealed, opts: S.opts, deckCount: S.deck.length,
    players: S.players.map(p => ({ name: p.name, bot: p.bot, score: p.score, hist: withHist ? p.hist.slice() : undefined, won: p.won, bid: S.bidsRevealed ? p.bid : null, hasBid: p.bid != null, handCount: p.hand.length, rascal: p.rascal })),
    // copies : chaque instantané doit garder le pli tel qu'il était à ce moment (sinon les bots semblent jouer tous ensemble)
    trick: t ? { entries: t.entries.slice(), stage: t.stage, removals: t.removals.slice(), res: t.res } : null,
    current: currentSeat(S), waiting: waitingFor(S),
    pending: S.pending[0] ? { t: S.pending[0].t, seat: S.pending[0].seat, opts: S.pending[0].data?.pub ?? null } : null,
    forcedSeats: Object.keys(S.forced).map(Number), lastTrick: lite ? null : S.lastTrick, log: lite ? S.log.slice(-1) : S.log.slice(-60),
    lastLise: S.lastLise ? { ...S.lastLise } : null,
  };
}
export type PublicView = ReturnType<typeof publicView>;
export function privateView(S: State, seat: number) {
  const p = S.players[seat]; const pd = S.pending[0];
  let pendingData: any = null;
  if (pd && pd.seat === seat) {
    if (pd.t === 'juanita') pendingData = { deck: sortHand(S.deck.slice()) };
    if (pd.t === 'bahij') pendingData = { k: pd.data?.k ?? 0, drawn: pd.data?.drawn ?? [] };
  }
  const cur = currentSeat(S);
  const legal = (S.phase === 'play' && cur === seat && !S.pending.length && S.trick) ? legalCards(p.hand, S.trick.entries, S.forced[seat]).map(c => c.id) : [];
  return { seat, hand: p.hand, bid: p.bid, forced: S.forced[seat] ?? null, pendingData, legal };
}
export type PrivateView = ReturnType<typeof privateView>;

// Instantané allégé pour les animations : sans historique (sauf fin de manche) et avec la dernière ligne du journal.
function emit(S: State, k: string, data: any = {}) { (S.ev = S.ev || []).push({ k, ...data, snap: publicView(S, true, k === 'round' || k === 'end') }); }
function log(S: State, s: LogSeg[], cls?: string) { S.log.push(cls ? { s, cls } : { s }); if (S.log.length > 200) S.log.splice(0, S.log.length - 200); }
const nm = (S: State, i: number) => S.players[i].name;

/* ---------- Déroulement ---------- */
function startRound(S: State) {
  const deck = shuffle(S, buildDeck(S.opts));
  S.round++; S.cards = Math.min(S.round, Math.floor(deck.length / S.n));
  S.players.forEach(p => { p.hand = sortHand(deck.splice(0, S.cards)); p.bid = null; p.won = 0; p.bonus = []; p.rascal = 0; });
  S.deck = deck; S.forced = {}; S.forcedBy = {}; S.alliances = []; S.trickNo = 0; S.bidsRevealed = false; S.trick = null; S.pending = []; S.lastTrick = null; S.lastLise = null;
  S.dealer = (S.dealer + 1 + S.n) % S.n; S.leader = (S.dealer + 1) % S.n; S.phase = 'bid';
  log(S, [`Manche ${S.round} — ${S.cards} carte${S.cards > 1 ? 's' : ''} par joueur`], 'rnd');
  S.players.forEach(p => { if (p.bot) p.bid = botBid(S, p); });
  emit(S, 'deal');
  checkBids(S);
}
function checkBids(S: State) {
  if (S.players.some(p => p.bid == null)) return;
  S.bidsRevealed = true; S.phase = 'play';
  log(S, ['Paris : ' + S.players.map(p => `${p.name} ${p.bid}`).join(' · ')]);
  emit(S, 'bids', { msg: 'Yo-ho-ho ! Les paris sont révélés' });
  startTrick(S);
}
function startTrick(S: State) {
  const order: number[] = [];
  for (let k = 0; k < S.n; k++) { const i = (S.leader + k) % S.n; if (S.players[i].hand.length) order.push(i); }
  if (!order.length) return endRound(S);
  S.trickNo++; S.leader = order[0];
  S.trick = { entries: [], order, pos: 0, volleyQ: [], vpos: 0, stage: 'main', removals: [], res: null };
}
/** Passe au joueur suivant ; renvoie true quand tout le monde a joué (le pli est alors à résoudre). */
function advance(S: State): boolean {
  const t = S.trick!;
  if (t.stage === 'main') { t.pos++; if (t.pos >= t.order.length) t.stage = 'volley'; else return false; }
  else if (t.stage === 'volley') t.vpos++;
  while (t.vpos < t.volleyQ.length && !S.players[t.volleyQ[t.vpos]].hand.length) t.vpos++;
  return t.vpos >= t.volleyQ.length;
}
function endOfPlays(S: State) {
  const t = S.trick!; t.stage = 'plank';
  t.entries.forEach((e, idx) => { if (e.card.kind === 'plank') S.pending.push({ t: 'plank', seat: e.p, data: { eidx: idx } }); });
  processPending(S);
}
function plankOptions(S: State) { const t = S.trick!; return t.entries.map((e, i) => (isPir(e) && !t.removals.includes(i)) ? i : -1).filter(i => i >= 0); }
/** Prépare l'action en tête de file ; résout seul ce qui n'a pas de choix. Renvoie true s'il faut attendre un joueur. */
function processPending(S: State) {
  const t = S.trick!;
  while (S.pending.length) {
    const pd = S.pending[0]; const p = S.players[pd.seat];
    if (pd.t === 'plank') {
      const opts = plankOptions(S);
      if (!opts.length) { S.pending.shift(); continue; }
      if (opts.length === 1) { applyPlank(S, pd.seat, opts[0]); S.pending.shift(); continue; }
      pd.data.pub = opts.map(i => ({ v: i, label: `${cname(t.entries[i].card, t.entries[i])} (${nm(S, t.entries[i].p)})` }));
      return true;
    }
    if (pd.t === 'rosie' || pd.t === 'mary') {
      const c = S.players.map((q, i) => q.hand.length ? i : -1).filter(i => i >= 0);
      if (!c.length) { S.pending.shift(); continue; }
      if (pd.t === 'mary') {
        // Les mains sont triées : sans ce mélange secret, la position cliquée révélerait la carte. perm ne sort jamais de l'état secret.
        if (!pd.data?.perm) pd.data = {
          pub: c.map(i => ({ v: i, label: nm(S, i) + (i === pd.seat ? ' (vous)' : ''), count: S.players[i].hand.length })),
          perm: Object.fromEntries(c.map(i => [i, shuffle(S, S.players[i].hand.map((_, k) => k))])),
        };
      } else pd.data = { pub: c.map(i => ({ v: i, label: nm(S, i) + (i === pd.seat ? ' (vous)' : '') })) };
      return true;
    }
    if (pd.t === 'bahij') {
      if (!pd.data) { const drawn = S.deck.splice(0, 2); if (!drawn.length) { S.pending.shift(); continue; } p.hand.push(...drawn); sortHand(p.hand); pd.data = { k: drawn.length, drawn: drawn.map(c => c.id), pub: { k: drawn.length } }; }
      return true;
    }
    if (pd.t === 'rascal') { pd.data = { pub: [0, 10, 20].map(v => ({ v, label: String(v) })) }; return true; }
    if (pd.t === 'harry') { pd.data = { pub: [{ v: -1, label: '−1', disabled: p.bid! <= 0 }, { v: 0, label: 'Garder' }, { v: 1, label: '+1', disabled: p.bid! >= S.cards }] }; return true; }
    if (pd.t === 'juanita') { pd.data = { pub: [{ v: 1, label: 'Compris' }] }; return true; }
    S.pending.shift();
  }
  if (t.stage === 'plank') resolveTrick(S);
  else if (t.stage === 'powers') finishTrick(S);
  return false;
}
function applyPlank(S: State, seat: number, idx: number) {
  const t = S.trick!; t.removals.push(idx);
  log(S, [`${nm(S, seat)} fait marcher `, { c: t.entries[idx].card, e: t.entries[idx] }, ' sur la planche']);
}
function resolveTrick(S: State) {
  const t = S.trick!;
  const R = resolve(t.entries, t.removals.map(i => t.entries[i]));
  const idx = (e: Entry | null) => e ? t.entries.indexOf(e) : null;
  let msg: string;
  if (R.davy && R.davy.n) log(S, [`La Fosse des Noyés engloutit ${R.davy.n} monstre${R.davy.n > 1 ? 's' : ''} des abysses`]);
  if (R.mode === 'kraken') msg = `Le Kraken engloutit le pli ! ${nm(S, R.next)} entame.`;
  else if (R.discarded) msg = `Pli défaussé. ${nm(S, R.next)} entame.`;
  else msg = `${nm(S, R.winner!.p)} remporte le pli` + (R.mode === 'whale' ? ' (Baleine Fantôme)' : R.mode === 'stingray' ? ' (Raie Étoilée)' : '');
  t.res = { winner: idx(R.winner), discarded: R.discarded, next: R.next, mode: R.mode, removed: R.removed.map(idx), msg };
  log(S, R.winner ? [msg + ' avec ', { c: R.winner.card, e: R.winner }] : [msg], 'win');
  emit(S, 'trick', { msg });
  // chaque bonus gagné a sa ligne de journal (cls 'bonus', ou 'malus' si négatif) : « +30 pour Maëlle : Pirate capturé par Skull King »
  const feats = (i: number) => (S.players[i].feats ??= { sirens: 0, wild: 0, silk: 0, abyss: 0, mermaidKing: 0 });
  if (R.davy && R.davy.n) feats(R.davy.p).abyss += R.davy.n;
  if (R.winner) {
    const f = feats(R.winner.p), wc = R.winner.card;
    if (wc.wild) f.wild++;
    // Fil-de-Soie : le haut fait revient à celui qui a imposé la carte gagnante avec Marie Thorne
    if (R.winner.imposed) feats(R.winner.imposedBy ?? R.winner.p).silk++;
    if (!R.mode) {
      if (wc.kind === 'mermaid' && R.captured.some(e => e.card.kind === 'sk')) f.mermaidKing++;
      if (wc.kind !== 'mermaid') f.sirens += R.captured.filter(e => e.card.kind === 'mermaid').length;
    }
  }
  const logBonus = (who: number, b: [number, string]) => log(S, [`${b[0] > 0 ? '+' : '−'}${Math.abs(b[0])} pour ${nm(S, who)} : ${b[1]}`], b[0] < 0 ? 'malus' : 'bonus');
  if (R.davy && R.davy.n) { const db: [number, string] = [20 * R.davy.n, `Fosse des Noyés : ${R.davy.n} monstre(s) englouti(s)`]; S.players[R.davy.p].bonus.push(db); logBonus(R.davy.p, db); }
  S.rosieNext = null; t.stage = 'powers';
  if (R.winner) {
    const w = S.players[R.winner.p], wi = R.winner.p; w.won++;
    const cb = cardBonuses(R.captured); w.bonus.push(...cb); cb.forEach(b => logBonus(wi, b));
    if (!R.mode) {
      w.bonus.push(...R.bonus);
      R.bonus.forEach(b => logBonus(wi, b));
      for (const e of R.captured) if (e.card.kind === 'loot' && e.p !== wi) { S.alliances.push([e.p, wi]); log(S, [`Pacte de Butin : ${nm(S, e.p)} & ${w.name}`]); }
      if (S.opts.powers) {
        let list: string[] = [];
        if (R.winner.card.kind === 'pirate') list = [R.winner.card.pid!];
        else if (R.winner.card.kind === 'con') list = R.captured.filter(e => e.card.kind === 'pirate').map(e => e.card.pid!);
        for (const pid of list) { S.pending.push({ t: pid, seat: wi }); log(S, [`Pouvoir de ${PIRATES[pid].n} : ${w.name} ${PIRATES[pid].pw}`]); }
      }
    }
  }
  processPending(S);
}
function finishTrick(S: State) {
  const t = S.trick!;
  S.lastTrick = { entries: t.entries, res: t.res, trickNo: S.trickNo };
  S.leader = S.rosieNext != null ? S.rosieNext : t.res.next; S.rosieNext = null;
  S.trick = null;
  emit(S, 'trickEnd');
  if (S.players.every(p => !p.hand.length)) endRound(S); else startTrick(S);
}
function endRound(S: State) {
  const made = S.players.map(p => p.won === p.bid);
  S.players.forEach((p, i) => {
    let base: number; const d = Math.abs(p.won - p.bid!);
    if (S.opts.score === 'rascal') base = d === 0 ? 10 * S.cards : d === 1 ? 5 * S.cards : 0;
    else if (p.bid === 0) base = made[i] ? 10 * S.cards : -10 * S.cards; else base = made[i] ? 20 * p.bid! : -10 * d;
    const items: [number, string][] = [];
    if (made[i]) {
      items.push(...p.bonus);
      for (const [a, b] of S.alliances) if ((a === i || b === i) && made[a] && made[b]) items.push([20, 'Pacte de Butin']);
    }
    if (p.rascal) items.push([made[i] ? p.rascal : -p.rascal, 'Mise de Rascal']);
    const bonus = items.reduce((s, x) => s + x[0], 0);
    p.score += base + bonus;
    p.hist.push({ r: S.round, cards: S.cards, bid: p.bid, won: p.won, base, bonus, items, tot: base + bonus, score: p.score });
  });
  log(S, ['Scores : ' + S.players.map(p => `${p.name} ${p.hist.at(-1).tot >= 0 ? '+' : ''}${p.hist.at(-1).tot}`).join(' · ')]);
  S.trick = null;
  emit(S, 'round', { round: S.round });
  if (S.round >= roundsOf(S.opts)) { S.phase = 'end'; log(S, ['Partie terminée'], 'rnd'); emit(S, 'end'); }
  else startRound(S);
}
/** Classement final : rang partagé en cas d'égalité. */
export function finalRanks(S: State) {
  const sc = S.players.map(p => p.score);
  return sc.map(s => 1 + sc.filter(x => x > s).length);
}

/* ---------- Actions ---------- */
export type Action =
  | { t: 'bid'; n: number }
  | { t: 'play'; id: number; as?: 'pirate' | 'escape'; val?: number; ws?: Suit }
  | { t: 'choose'; v: any };
export class RuleError extends Error { }
export function apply(S: State, seat: number, a: Action) {
  if (S.phase === 'end') throw new RuleError('La partie est terminée.');
  const p = S.players[seat]; if (!p) throw new RuleError('Siège inconnu.');
  if (a.t === 'bid') {
    if (S.phase !== 'bid') throw new RuleError("Ce n'est pas le moment de parier.");
    if (p.bid != null) throw new RuleError('Pari déjà fait.');
    const n = Number(a.n); if (!Number.isInteger(n) || n < 0 || n > S.cards) throw new RuleError('Pari invalide.');
    p.bid = n; checkBids(S); return;
  }
  if (S.phase !== 'play' || !S.trick) throw new RuleError("Ce n'est pas le moment de jouer.");
  if (a.t === 'choose') {
    const pd = S.pending[0]; if (!pd || pd.seat !== seat) throw new RuleError("Aucun choix n'est attendu de votre part.");
    choose(S, pd, a.v); S.pending.shift(); processPending(S); return;
  }
  if (a.t === 'play') {
    if (S.pending.length) throw new RuleError('Un choix est en attente.');
    if (currentSeat(S) !== seat) throw new RuleError("Ce n'est pas votre tour.");
    const t = S.trick;
    const legal = legalCards(p.hand, t.entries, S.forced[seat]);
    const card = legal.find(c => c.id === a.id); if (!card) throw new RuleError('Cette carte ne peut pas être jouée.');
    const e: Entry = { p: seat, card, extra: t.stage === 'volley' };
    if (S.forced[seat] === card.id) { e.imposed = true; const by = S.forcedBy?.[seat]; if (by != null) e.imposedBy = by; }
    if (card.kind === 'tigress') { if (a.as !== 'pirate' && a.as !== 'escape') throw new RuleError('Choisissez Pirate ou Fuite.'); e.as = a.as; }
    if (card.zf) { if (a.val !== 0 && a.val !== 14) throw new RuleError('Choisissez 0 ou 14.'); e.val = a.val; }
    if (card.wild) { const wr = wildRule(t.entries); if (wr.choose) { if (!WILD_SUITS.includes(a.ws as Suit)) throw new RuleError('Choisissez la couleur du Grand Quinze.'); e.ws = a.ws; } else e.ws = wr.auto ?? null; }
    p.hand = p.hand.filter(c => c.id !== card.id);
    if (S.forced[seat] === card.id) delete S.forced[seat];
    t.entries.push(e);
    if (card.kind === 'volley' && !e.extra) t.volleyQ.push(seat);
    log(S, [`${p.name} joue `, { c: card, e }, e.extra ? ' (Dernière Bordée)' : '']);
    // l'instantané est pris après le passage au joueur suivant : il montre qui doit jouer maintenant
    const done = advance(S);
    emit(S, 'play', { seat });
    if (done) endOfPlays(S);
    return;
  }
  throw new RuleError('Action inconnue.');
}
function choose(S: State, pd: Pending, v: any) {
  const p = S.players[pd.seat]; const pub = pd.data?.pub;
  const allowed = (x: any) => Array.isArray(pub) && pub.some((o: any) => o.v === x && !o.disabled);
  switch (pd.t) {
    case 'plank': if (!allowed(v)) throw new RuleError('Choix invalide.'); applyPlank(S, pd.seat, v); break;
    case 'rosie': if (!allowed(v)) throw new RuleError('Choix invalide.'); S.rosieNext = v; log(S, [`${nm(S, v)} entamera le prochain pli`]); break;
    case 'rascal': if (!allowed(v)) throw new RuleError('Mise invalide.'); p.rascal += v; log(S, [`${p.name} mise ${v} points`]); break;
    case 'harry': if (!allowed(v)) throw new RuleError('Choix invalide.'); if (v) { p.bid! += v; log(S, [`${p.name} change son pari : ${p.bid}`]); } else log(S, [`${p.name} garde son pari`]); break;
    case 'juanita': break;
    case 'mary': {
      const seat = v && typeof v === 'object' ? v.seat : v;
      if (!allowed(seat)) throw new RuleError('Choix invalide.');
      const q = S.players[seat];
      let pos: number;
      if (v && typeof v === 'object' && v.pos != null) {
        pos = v.pos;
        if (!Number.isInteger(pos) || pos < 0 || pos >= q.hand.length) throw new RuleError('Cette carte n\'existe pas.');
      } else pos = Math.floor(rand(S) * q.hand.length);
      const perm: number[] = pd.data?.perm?.[seat] ?? q.hand.map((_, k) => k);
      S.forced[seat] = q.hand[perm[pos] ?? pos].id; (S.forcedBy ??= {})[seat] = pd.seat;
      S.lastLise = { by: pd.seat, seat, pos, round: S.round, trickNo: S.trickNo };
      log(S, seat === pd.seat ? [`${p.name} tire une carte face cachée dans sa propre main : elle devra la jouer au prochain pli`]
        : [`${p.name} tire une carte face cachée dans la main de ${q.name} : elle devra être jouée au prochain pli`]);
      emit(S, 'lise', { by: pd.seat, seat, pos });
      break;
    }
    case 'bahij': {
      const ids: number[] = Array.isArray(v) ? v.map(Number) : [];
      const k = pd.data.k;
      if (ids.length !== k || new Set(ids).size !== k || !ids.every(id => p.hand.some(c => c.id === id))) throw new RuleError(`Choisissez ${k} carte${k > 1 ? 's' : ''} à défausser.`);
      p.hand = p.hand.filter(c => !ids.includes(c.id));
      for (const f in S.forced) if (ids.includes(S.forced[f])) delete S.forced[f];
      log(S, [`${p.name} pioche et défausse ${k} carte${k > 1 ? 's' : ''}`]); break;
    }
    default: throw new RuleError('Choix inconnu.');
  }
}

/* ---------- Bots ---------- */
function pw(e: Partial<Entry> & { card: Card }) {
  const c = e.card; switch (c.kind) {
    case 'num': { if (c.wild) return 30; const v = numVal(e as Entry); return c.suit === 'black' ? 16 + v : v; }
    case 'sk': return 50; case 'con': return 44; case 'pirate': return 40; case 'mermaid': return 34;
    case 'tigress': return e.as === 'pirate' ? 38 : -5; case 'escape': return -6; case 'loot': return -5;
    default: return 2;
  }
}
function botBid(S: State, p: Player) {
  let s = 0;
  for (const c of p.hand) {
    switch (c.kind) {
      case 'sk': s += .92; break; case 'con': s += .8; break; case 'pirate': s += .72; break; case 'tigress': s += .65; break; case 'mermaid': s += .5; break;
      case 'num':
        if (c.wild) { s += .55; break; } if (c.zf) { s += .35; break; }
        if (c.suit === 'black') s += c.rank! >= 12 ? .7 : c.rank! >= 9 ? .42 : c.rank! >= 5 ? .18 : .06;
        else s += c.rank === 14 ? .45 : c.rank === 13 ? .3 : c.rank === 12 ? .18 : c.rank === 11 ? .08 : 0; break;
    }
  }
  const f = S.n <= 3 ? 1.12 : S.n >= 6 ? .82 : 1;
  return Math.max(0, Math.min(S.cards, Math.round(s * f + (rand(S) - .5) * .5)));
}
function expand(cards: Card[], entries: Entry[]) {
  const o: any[] = []; const wr = wildRule(entries);
  for (const c of cards) {
    if (c.wild) { if (wr.choose) WILD_SUITS.forEach(ws => o.push({ card: c, ws })); else o.push({ card: c, ws: wr.auto }); continue; }
    if (c.kind === 'tigress') { o.push({ card: c, as: 'pirate' }); o.push({ card: c, as: 'escape' }); }
    else if (c.zf) { o.push({ card: c, val: 14 }); o.push({ card: c, val: 0 }); }
    else o.push({ card: c });
  }
  return o;
}
function botPlayChoice(S: State, seat: number): Action {
  const p = S.players[seat], t = S.trick!;
  const legal = legalCards(p.hand, t.entries, S.forced[seat]);
  const remaining = t.stage === 'main' ? t.order.length - t.pos - 1 : 0;
  const need = p.bid! - p.won;
  const opts = expand(legal, t.entries).map(o => { const e = { p: seat, ...o }; const r = resolve([...t.entries, e]); return { o, e, wins: !!(r.winner && r.winner.p === seat), pw: pw(e) }; });
  let pick: any;
  if (need > 0) {
    const win = opts.filter(x => x.wins).sort((a, b) => a.pw - b.pw);
    if (win.length) { const th = remaining > 0 ? (remaining > 1 ? 24 : 16) : -99; pick = win.find(x => x.pw >= th) || win[win.length - 1]; }
    else { const non = opts.filter(x => !isEsc(x.e)).sort((a, b) => a.pw - b.pw); pick = (non[0] || opts.sort((a, b) => a.pw - b.pw)[0]); }
  } else {
    const lose = opts.filter(x => !x.wins).sort((a, b) => b.pw - a.pw);
    if (lose.length) { const strong = lose.filter(x => !isEsc(x.e)); pick = (remaining === 0 || strong.length) ? (strong[0] || lose[0]) : lose[0]; }
    else pick = opts.sort((a, b) => a.pw - b.pw)[0];
  }
  return { t: 'play', id: pick.o.card.id, as: pick.o.as, val: pick.o.val, ws: pick.o.ws ?? undefined };
}
function botChoose(S: State, pd: Pending): any {
  const p = S.players[pd.seat]; const pub = pd.data?.pub;
  switch (pd.t) {
    case 'plank': { const cur = resolve(S.trick!.entries, S.trick!.removals.map(i => S.trick!.entries[i])).winner; const ci = cur ? S.trick!.entries.indexOf(cur) : -1; return pub.some((o: any) => o.v === ci) ? ci : pub[0].v; }
    case 'rosie': { const others = pub.filter((o: any) => o.v !== pd.seat); return (p.bid! > p.won && p.hand.length) ? pd.seat : (others[0] || pub[0]).v; }
    case 'rascal': { const d = p.bid! - p.won; return d === 0 && p.hand.length <= 2 ? 20 : (d >= 0 && d <= 1 ? 10 : 0); }
    case 'harry': { let d = p.won > p.bid! ? 1 : (p.bid! - p.won > p.hand.length ? -1 : 0); if (p.bid! + d < 0 || p.bid! + d > S.cards) d = 0; return d; }
    case 'juanita': return 1;
    case 'mary': { const o = pub.filter((x: any) => x.v !== pd.seat).sort((a: any, b: any) => S.players[b.v].score - S.players[a.v].score); const t = (o[0] || pub[0]); return { seat: t.v, pos: Math.floor(rand(S) * t.count) }; }
    case 'bahij': { const need = p.bid! - p.won; const s = p.hand.map(c => ({ c, v: pw({ card: c, as: 'pirate', val: 14 }) })).sort((a, b) => need > 0 ? a.v - b.v : b.v - a.v); return s.slice(0, pd.data.k).map(x => x.c.id); }
  }
  return null;
}
/** Fait jouer les bots jusqu'à ce qu'un humain doive agir (ou fin de partie). */
export function runBots(S: State) {
  for (let guard = 0; guard < 5000; guard++) {
    if (S.phase !== 'play') return;
    const pd = S.pending[0];
    if (pd) { if (!S.players[pd.seat].bot) return; apply(S, pd.seat, { t: 'choose', v: botChoose(S, pd) }); continue; }
    const c = currentSeat(S); if (c == null) return;
    if (!S.players[c].bot) return;
    apply(S, c, botPlayChoice(S, c));
  }
  throw new Error('Boucle des bots interrompue.');
}
/** Prend les événements produits depuis le dernier appel (pour les animations côté site). */
export function takeEvents(S: State) { const ev = S.ev || []; S.ev = []; return ev; }
