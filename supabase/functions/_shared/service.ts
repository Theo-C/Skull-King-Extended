// Logique serveur des parties, indépendante du stockage (testable en mémoire, branchée sur Supabase dans game/index.ts).
import * as E from './engine.ts';
import { settleGame, type SettleInput } from './settle.ts';

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
  /** Appel d'une fonction SQL réservée au serveur (settle_inputs, game_settle, history_list, history_get, profile_update). */
  rpc(name: string, args: Record<string, unknown>): Promise<any>;
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
    case 'profile.update': return profileUpdate(store, uid, body);
    case 'history.list': return historyList(store, uid, body);
    case 'history.get': return historyGet(store, uid, body);
    case 'rematch': return rematch(store, uid, body);
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
  if (v == null) return 'conflict';
  if (S.phase === 'end') {
    // fin de partie : XP, hauts faits, statistiques et Élo (une erreur ici ne doit pas annuler le dernier coup : history.get réessaiera)
    try { await settleFinished(store, g.id, S, seats); } catch (e) { console.error('règlement de fin de partie', e); }
  }
  return { ok: true };
}

/* ---------- Fin de partie : règlement idempotent ---------- */
export async function settleFinished(store: Store, gameId: string, S: E.State, seats: SeatRow[]): Promise<string> {
  const uids = seats.filter(s => s.user_id && !s.bot).map(s => s.user_id!);
  if (!uids.length) return 'none';
  for (let i = 0; i < 4; i++) {
    const inputs = await store.rpc('settle_inputs', { p_users: uids }) as Record<string, SettleInput>;
    const payload = settleGame(S, seats, inputs);
    const r = await store.rpc('game_settle', { p_game: gameId, p_payload: payload });
    if (r !== 'conflict') return r; // 'ok' ou 'already'
  }
  throw new HttpError(409, 'Règlement de la partie interrompu, réessayez.');
}

/* ---------- Profil ---------- */
export const PALETTE = ['#d9b25a', '#c8644b', '#7ab874', '#5c9db6', '#a982c4', '#e0954a', '#c9c0ae', '#d77fa1'];
async function profileUpdate(store: Store, uid: string, body: any) {
  const p: Record<string, unknown> = {};
  if (body.pseudo != null) {
    const ps = String(body.pseudo).trim().replace(/\s+/g, ' ');
    if (ps.length < 2 || ps.length > 20) throw bad('Le pseudo doit faire entre 2 et 20 caractères.');
    p.pseudo = ps;
  }
  if (body.color != null) { if (!PALETTE.includes(body.color)) throw bad('Couleur inconnue.'); p.color = body.color; }
  if (body.avatar_kind != null) {
    if (!['initial', 'art', 'photo'].includes(body.avatar_kind)) throw bad("Type d'image inconnu.");
    p.avatar_kind = body.avatar_kind;
    if (body.avatar_kind === 'art') {
      const a = Number(body.avatar_art); if (!Number.isInteger(a) || a < 0 || a > 7) throw bad('Pirate illustré inconnu.');
      p.avatar_art = a;
    }
    if (body.avatar_kind === 'photo') {
      // la photo doit être celle de l'utilisateur, dans le stockage du projet : avatars/<uid>/avatar.webp
      const u = String(body.avatar_url || '');
      if (!/^https:\/\/[^/]+\/storage\/v1\/object\/public\/avatars\//.test(u) || !u.includes(`/avatars/${uid}/avatar.webp`)) throw bad('Photo invalide.');
      p.avatar_url = u;
    }
  }
  for (const k of ['public_rank', 'notify_turn', 'sounds']) if (body[k] != null) p[k] = !!body[k];
  if (!Object.keys(p).length) throw bad('Rien à enregistrer.');
  await store.rpc('profile_update', { p_user: uid, p });
  return { ok: true };
}

/* ---------- Historique ---------- */
const PAGE = 20;
async function historyList(store: Store, uid: string, body: any) {
  const filter = ['all', 'wins', 'ext', 'base'].includes(body.filter) ? body.filter : 'all';
  const before = typeof body.before === 'string' && !isNaN(Date.parse(body.before)) ? body.before : null;
  const items = (await store.rpc('history_list', { p_user: uid, p_before: before, p_filter: filter, p_limit: PAGE })) as any[] ?? [];
  return { items, next: items.length === PAGE ? items[items.length - 1].finished_at : null };
}
async function historyGet(store: Store, uid: string, body: any) {
  if (typeof body.id !== 'string') throw bad('Partie inconnue.');
  let d = await store.rpc('history_get', { p_user: uid, p_game: body.id });
  if (!d) throw new HttpError(403, "Vous n'avez pas joué cette partie.");
  // partie terminée mais pas encore réglée (règlement interrompu) : on le refait ici
  if (d.status === 'finished' && !d.state?.settled) {
    const S = await store.secret(body.id);
    if (S) { await settleFinished(store, body.id, S, await store.seats(body.id)); d = await store.rpc('history_get', { p_user: uid, p_game: body.id }); }
  }
  return d;
}

/* ---------- Revanche : même réglages, mêmes joueurs (déjà assis), mêmes bots ---------- */
async function rematch(store: Store, uid: string, body: any) {
  const g = await mustGame(store, body.id);
  const old = (await store.seats(g.id)).sort((a, b) => a.seat - b.seat);
  if (!old.some(s => s.user_id === uid)) throw new HttpError(403, "Vous n'avez pas joué cette partie.");
  if (g.status !== 'finished') throw bad("La partie n'est pas terminée.");
  let n: GameRow | null = null;
  for (let i = 0; i < 8 && !n; i++) n = await store.insertGame({ code: newCode(), host: uid, options: g.options });
  if (!n) throw new HttpError(500, 'Impossible de créer un code de partie.');
  // celui qui demande la revanche devient l'hôte (siège 0) ; les autres gardent leur ordre
  const humans = [uid, ...old.filter(s => s.user_id && s.user_id !== uid).map(s => s.user_id!)];
  const bots = old.filter(s => s.bot).map(s => s.name);
  const seats: SeatRow[] = [];
  for (const u of humans) seats.push({ seat: seats.length, bot: false, user_id: u, name: await store.pseudo(u) });
  for (const b of bots) seats.push({ seat: seats.length, bot: true, user_id: null, name: b });
  const v = await store.commit(n.id, n.version, { patch: {}, seats });
  if (v == null) throw new HttpError(500, 'Création interrompue.');
  return { id: n.id, code: n.code };
}
