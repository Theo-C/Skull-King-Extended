// Logique serveur des parties, indépendante du stockage (testable en mémoire, branchée sur Supabase dans game/index.ts).
import * as E from './engine.ts';

export interface GameRow { id: string; code: string; host: string; status: 'lobby' | 'playing' | 'finished'; options: any; state: any; version: number }
export interface SeatRow { seat: number; user_id: string | null; bot: boolean; name: string; final_score?: number | null; rank?: number | null }
export interface Commit {
  patch: { status?: string; options?: any; state?: any };
  secret?: E.State; hands?: { user_id: string; seat: number; data: any }[]; events?: any[]; seats?: SeatRow[];
}
export interface Store {
  pseudo(uid: string): Promise<string>;
  insertGame(row: { code: string; host: string; options: any }): Promise<GameRow | null>; // null si le code existe déjà
  gameById(id: string): Promise<GameRow | null>;
  gameByCode(code: string): Promise<GameRow | null>;
  seats(gameId: string): Promise<SeatRow[]>;
  secret(gameId: string): Promise<E.State | null>;
  commit(gameId: string, expectedVersion: number, c: Commit): Promise<number | null>; // null : conflit de version
}
export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
const bad = (m: string) => new HttpError(400, m);

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() { let s = ''; for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]; return s; }
function botName(used: Set<string>) { const n = E.BOT_NAMES.find(x => !used.has(x)) ?? `Bot ${used.size + 1}`; used.add(n); return n; }
function sanitizeSeatTypes(list: any): boolean[] {
  if (!Array.isArray(list) || list.length < 3 || list.length > 9) throw bad('Il faut entre 3 et 9 sièges.');
  return list.map((s: any) => !!(s && s.bot));
}

export async function handle(store: Store, uid: string | null, body: any): Promise<any> {
  if (!uid) throw new HttpError(401, 'Connectez-vous pour jouer.');
  const action = body?.action;
  switch (action) {
    case 'create': return create(store, uid, body);
    case 'preview': return preview(store, uid, body);
    case 'join': return withRetry(() => join(store, uid, body));
    case 'leave': return withRetry(() => leave(store, uid, body));
    case 'lobby': return withRetry(() => lobby(store, uid, body));
    case 'start': return withRetry(() => start(store, uid, body));
    case 'act': return withRetry(() => act(store, uid, body));
    default: throw bad('Action inconnue.');
  }
}
async function withRetry<T>(fn: () => Promise<T | 'conflict'>): Promise<T> {
  for (let i = 0; i < 4; i++) { const r = await fn(); if (r !== 'conflict') return r; }
  throw new HttpError(409, 'La partie a changé pendant votre action, réessayez.');
}
async function mustGame(store: Store, id: any) { const g = typeof id === 'string' ? await store.gameById(id) : null; if (!g) throw new HttpError(404, 'Partie introuvable.'); return g; }

async function create(store: Store, uid: string, body: any) {
  const types = sanitizeSeatTypes(body.seats ?? [{ bot: false }, { bot: true }, { bot: true }, { bot: true }]);
  types[0] = false; // l'hôte occupe le premier siège
  const options = E.normalizeOpts(body.options);
  let g: GameRow | null = null;
  for (let i = 0; i < 8 && !g; i++) g = await store.insertGame({ code: newCode(), host: uid, options });
  if (!g) throw new HttpError(500, 'Impossible de créer un code de partie.');
  const used = new Set<string>(); const me = await store.pseudo(uid);
  const seats: SeatRow[] = types.map((bot, seat) => ({ seat, bot, user_id: seat === 0 ? uid : null, name: seat === 0 ? me : (bot ? botName(used) : '') }));
  const v = await store.commit(g.id, g.version, { patch: {}, seats });
  if (v == null) throw new HttpError(500, 'Création interrompue.');
  return { id: g.id, code: g.code };
}
async function preview(store: Store, uid: string, body: any) {
  const code = String(body.code || '').toUpperCase().trim();
  const g = await store.gameByCode(code); if (!g) throw new HttpError(404, "Ce lien d'invitation ne correspond à aucune partie.");
  const seats = await store.seats(g.id);
  const host = await store.pseudo(g.host);
  return {
    id: g.id, code: g.code, status: g.status, host, options: g.options, member: seats.some(s => s.user_id === uid),
    seats: seats.map(s => ({ seat: s.seat, bot: s.bot, name: s.name, taken: !!s.user_id })),
  };
}
async function join(store: Store, uid: string, body: any) {
  const code = String(body.code || '').toUpperCase().trim();
  const g = await store.gameByCode(code); if (!g) throw new HttpError(404, "Ce lien d'invitation ne correspond à aucune partie.");
  const seats = await store.seats(g.id);
  if (seats.some(s => s.user_id === uid)) return { id: g.id };
  if (g.status !== 'lobby') throw bad('La partie a déjà commencé.');
  const free = seats.find(s => !s.bot && !s.user_id);
  if (!free) throw bad('La partie est complète.');
  free.user_id = uid; free.name = await store.pseudo(uid);
  const v = await store.commit(g.id, g.version, { patch: {}, seats });
  return v == null ? 'conflict' : { id: g.id };
}
async function leave(store: Store, uid: string, body: any) {
  const g = await mustGame(store, body.id);
  if (g.status !== 'lobby') throw bad('Impossible de quitter une partie commencée.');
  if (g.host === uid) throw bad("L'hôte ne peut pas quitter son salon.");
  const seats = await store.seats(g.id); const s = seats.find(x => x.user_id === uid);
  if (!s) return { ok: true };
  s.user_id = null; s.name = '';
  return (await store.commit(g.id, g.version, { patch: {}, seats })) == null ? 'conflict' : { ok: true };
}
async function lobby(store: Store, uid: string, body: any) {
  const g = await mustGame(store, body.id);
  if (g.host !== uid) throw new HttpError(403, "Seul l'hôte peut modifier la partie.");
  if (g.status !== 'lobby') throw bad('La partie a déjà commencé.');
  const old = await store.seats(g.id);
  const options = body.options ? E.normalizeOpts(body.options) : g.options;
  let seats = old;
  if (body.seats) {
    const types = sanitizeSeatTypes(body.seats); types[0] = false;
    const users = old.filter(s => s.user_id).sort((a, b) => a.seat - b.seat);
    const humanSlots = types.filter(b => !b).length;
    if (users.length > humanSlots) throw bad('Il y a plus de joueurs inscrits que de sièges humains.');
    const used = new Set<string>(); let ui = 0;
    // l'hôte reste au siège 0 ; les autres joueurs inscrits gardent leur ordre d'arrivée
    const hostRow = users.find(u => u.user_id === g.host)!; const others = users.filter(u => u !== hostRow);
    seats = types.map((bot, seat) => {
      if (seat === 0) return { seat, bot: false, user_id: g.host, name: hostRow.name };
      if (bot) return { seat, bot: true, user_id: null, name: botName(used) };
      const u = others[ui++]; return { seat, bot: false, user_id: u?.user_id ?? null, name: u?.name ?? '' };
    });
  }
  return (await store.commit(g.id, g.version, { patch: { options }, seats })) == null ? 'conflict' : { ok: true };
}
function snapshotsFor(S: E.State, seats: SeatRow[]) {
  return {
    hands: seats.filter(s => s.user_id).map(s => ({ user_id: s.user_id!, seat: s.seat, data: E.privateView(S, s.seat) })),
  };
}
async function start(store: Store, uid: string, body: any) {
  const g = await mustGame(store, body.id);
  if (g.host !== uid) throw new HttpError(403, "Seul l'hôte peut lancer la partie.");
  if (g.status !== 'lobby') throw bad('La partie a déjà commencé.');
  const seats = (await store.seats(g.id)).sort((a, b) => a.seat - b.seat);
  // les sièges humains restés vides sont confiés à des bots
  const used = new Set(seats.filter(s => s.bot).map(s => s.name));
  for (const s of seats) if (!s.bot && !s.user_id) { s.bot = true; s.name = botName(used); }
  const S = E.newGame(seats.map(s => ({ name: s.name, bot: s.bot, uid: s.user_id })), g.options);
  E.runBots(S);
  const events = E.takeEvents(S);
  const v = await store.commit(g.id, g.version, { patch: { status: 'playing', state: E.publicView(S) }, secret: S, events, seats, ...snapshotsFor(S, seats) });
  return v == null ? 'conflict' : { ok: true };
}
async function act(store: Store, uid: string, body: any) {
  const g = await mustGame(store, body.id);
  if (g.status !== 'playing') throw bad("La partie n'est pas en cours.");
  const seats = (await store.seats(g.id)).sort((a, b) => a.seat - b.seat);
  const me = seats.find(s => s.user_id === uid); if (!me) throw new HttpError(403, 'Vous ne jouez pas dans cette partie.');
  const S = await store.secret(g.id); if (!S) throw new HttpError(500, 'État de partie manquant.');
  try { E.apply(S, me.seat, body.move); }
  catch (e) { if (e instanceof E.RuleError) throw bad(e.message); throw e; }
  E.runBots(S);
  const events = E.takeEvents(S);
  const patch: Commit['patch'] = { state: E.publicView(S) };
  let outSeats: SeatRow[] | undefined;
  if (S.phase === 'end') {
    patch.status = 'finished';
    const ranks = E.finalRanks(S);
    outSeats = seats.map(s => ({ ...s, final_score: S.players[s.seat].score, rank: ranks[s.seat] }));
  }
  const v = await store.commit(g.id, g.version, { patch, secret: S, events, seats: outSeats, ...snapshotsFor(S, seats) });
  return v == null ? 'conflict' : { ok: true };
}
