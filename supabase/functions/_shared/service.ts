// Logique serveur des parties, indépendante du stockage (testable en mémoire, branchée sur Supabase dans game/index.ts).
import * as E from './engine.ts';
import { settleGame, type SettleInput } from './settle.ts';

export interface GameRow { id: string; code: string; host: string; status: 'lobby' | 'playing' | 'finished'; options: any; state: any; version: number; /** dernier coup enregistré */ updated_at?: string }
export interface SeatRow { seat: number; user_id: string | null; bot: boolean; name: string; final_score?: number | null; rank?: number | null }
export interface Commit {
  patch: { status?: string; options?: any; state?: any };
  secret?: E.State; hands?: { user_id: string; seat: number; data: any }[]; events?: any[]; seats?: SeatRow[];
}
export interface CosmeticRow { id: string; slot: string; value: string | null; default_owned: boolean; how: string | null; variants?: string[] | null }
export interface Store {
  /** Adresse du projet Supabase (https://<ref>.supabase.co) : seule origine acceptée pour les photos de profil. */
  readonly origin: string;
  pseudo(uid: string): Promise<string>;
  insertGame(row: { code: string; host: string; options: any }): Promise<GameRow | null>; // null si le code existe déjà
  gameById(id: string): Promise<GameRow | null>;
  gameByCode(code: string): Promise<GameRow | null>;
  seats(gameId: string): Promise<SeatRow[]>;
  secret(gameId: string): Promise<E.State | null>;
  commit(gameId: string, expectedVersion: number, c: Commit): Promise<number | null>; // null : conflit de version
  /** Appel d'une fonction SQL réservée au serveur (settle_inputs, game_settle, history_page, history_get, profile_update, unsettled_games, rematch_claim, chest_open, shop_buy). */
  rpc(name: string, args: Record<string, unknown>): Promise<any>;
  /** Catalogue complet (public.cosmetics), chargé une fois. */
  cosmetics(): Promise<CosmeticRow[]>;
  /** Identifiants des objets possédés par le joueur, en plus de ceux qui sont libres par défaut. */
  userCosmetics(uid: string): Promise<string[]>;
  /** Porte-monnaie du joueur (pièces et coffres non ouverts). Zéro par défaut si la ligne n'existe pas encore. */
  wallet(uid: string): Promise<{ coins: number; chests: number; jokers: number }>;
  /** Boutique du jour (3 objets déterministes à partir de la date, prix inclus). */
  shopDay(day?: string): Promise<{ cosmetic_id: string; price: number }[]>;
}
export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
const bad = (m: string) => new HttpError(400, m);

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() { let s = ''; for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]; return s; }
function botName(used: Set<string>) { const n = E.BOT_NAMES.find(x => !used.has(x)) ?? `Bot ${used.size + 1}`; used.add(n); return n; }
/** Entier au hasard dans [0, n) (Web Crypto : Deno et navigateurs). */
function randomInt(n: number) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
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
    case 'profile.wardrobe': return wardrobe(store, uid);
    case 'player.card': return playerCard(store, body);
    case 'chest.open': return chestOpen(store, uid);
    case 'shop.list': return { shop: await store.shopDay() };
    case 'shop.buy': return shopBuy(store, uid, body);
    case 'chest.buy': { const r = await store.rpc('chest_buy', { p_user: uid }); if (r?.error) throw bad(r.error); return r; }
    case 'joker.buy': { const r = await store.rpc('joker_buy', { p_user: uid }); if (r?.error) throw bad(r.error); return r; }
    case 'joker.use': return withRetry(() => jokerUse(store, uid, body));
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function mustGame(store: Store, id: any) { const g = typeof id === 'string' && UUID.test(id) ? await store.gameById(id) : null; if (!g) throw new HttpError(404, 'Partie introuvable.'); return g; }

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
  if (body.kick != null) {
    // l'hôte retire un joueur du salon : sa place redevient libre
    const k = old.find(x => x.user_id != null && x.user_id === body.kick && x.user_id !== g.host);
    if (!k) throw bad("Ce joueur n'est pas dans le salon.");
    k.user_id = null; k.name = '';
  }
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
  // places tirées au sort au lancement (l'ordre du salon ne décide plus de qui joue après qui)
  for (let i = seats.length - 1; i > 0; i--) { const j = randomInt(i + 1); [seats[i], seats[j]] = [seats[j], seats[i]]; }
  seats.forEach((s, i) => { s.seat = i; });
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
  // temps de réflexion pour une carte : depuis le coup précédent (début du tour), mesuré par le serveur
  const thinkMs = body.move?.t === 'play' && g.updated_at ? Date.now() - Date.parse(g.updated_at) : null;
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
  if (thinkMs != null && thinkMs >= 0) {
    try { await store.rpc('play_time_add', { p_user: uid, p_ms: Math.min(Math.round(thinkMs), 120000) }); } catch (e) { console.error('temps de jeu', e); }
  }
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
const HAIR_STYLES = ['court', 'meche', 'long', 'boucles', 'chignon', 'tresse', 'queue', 'none'];
const BEARDS = ['none', 'mous', 'short', 'long'];
const SLOT_KEYS = ['hat', 'face', 'neck', 'pet', 'bg', 'frame'] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Vérifie qu'un `look` ne contient que des objets possédés et des valeurs connues.
 *  Les champs libres (teint, coiffure, pilosité) sont vérifiés dans leur plage ; les couleurs doivent être au format #RRGGBB. */
async function validateLook(store: Store, uid: string, look: any): Promise<Record<string, unknown>> {
  if (typeof look !== 'object' || look === null || Array.isArray(look)) throw bad("Format d'apparence invalide.");
  const out: Record<string, unknown> = {};
  if ('skin' in look) {
    const v = look.skin; if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 5) throw bad('Teint inconnu.');
    out.skin = v;
  }
  if ('hair' in look) {
    const v = look.hair; if (typeof v !== 'string' || !HAIR_STYLES.includes(v)) throw bad('Coiffure inconnue.');
    out.hair = v;
  }
  if ('hc' in look) {
    const v = look.hc; if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 5) throw bad('Couleur de cheveux inconnue.');
    out.hc = v;
  }
  if ('beard' in look) {
    const v = look.beard; if (typeof v !== 'string' || !BEARDS.includes(v)) throw bad('Pilosité inconnue.');
    out.beard = v;
  }
  for (const key of ['htc', 'nkc', 'ptc'] as const) if (key in look) {
    const v = look[key]; if (typeof v !== 'string' || !HEX.test(v)) throw bad('Couleur invalide.');
    out[key] = v;
  }
  // Vérifier que chaque emplacement (chapeau, visage, cou, compagnon, décor, cadre) pointe sur un objet possédé.
  const needs: { slot: string; value: string | null }[] = [];
  for (const slot of SLOT_KEYS) if (slot in look) {
    const v = look[slot]; if (v !== null && typeof v !== 'string') throw bad('Objet invalide.');
    needs.push({ slot, value: v }); out[slot] = v;
  }
  const colors = (['htc', 'nkc', 'ptc'] as const).filter(k => k in out);
  if (needs.length || colors.length) {
    const cat = await store.cosmetics();
    const ownedExtra = new Set(await store.userCosmetics(uid));
    // couleur d'un objet : seulement une variante d'une version possédée de l'objet porté (le « Bandana violet » est un objet à part) ;
    // sans objet, ou pour un objet sans variantes, la couleur est sans effet et acceptée
    const COLOR_SLOT = { htc: 'hat', nkc: 'neck', ptc: 'pet' } as const;
    for (const key of colors) {
      const slot = COLOR_SLOT[key], color = String(out[key]).toLowerCase();
      if (!(slot in look)) throw bad('Couleur sans objet.');
      const value = look[slot]; if (value == null) continue;
      const versions = cat.filter(c => c.slot === slot && c.value === value && (c.variants?.length ?? 0) > 0);
      if (!versions.length) continue;
      if (!versions.some(c => (c.default_owned || ownedExtra.has(c.id)) && c.variants!.some(v => v.toLowerCase() === color))) throw bad('Couleur non possédée pour cet objet.');
    }
    const ownsSlotValue = (slot: string, value: string | null) =>
      cat.some(c => c.slot === slot && c.value === value && (c.default_owned || ownedExtra.has(c.id)));
    for (const { slot, value } of needs) {
      if (value === null && (slot === 'bg')) continue; // décor null = Haute mer par défaut, toujours autorisé
      if (!ownsSlotValue(slot, value)) throw bad(`Objet non possédé pour la rubrique ${slot}.`);
    }
  }
  return out;
}

async function profileUpdate(store: Store, uid: string, body: any) {
  const p: Record<string, unknown> = {};
  if (body.pseudo != null) {
    const ps = String(body.pseudo).trim().replace(/\s+/g, ' ');
    if (ps.length < 2 || ps.length > 20) throw bad('Le pseudo doit faire entre 2 et 20 caractères.');
    p.pseudo = ps;
  }
  if (body.color != null) { if (!PALETTE.includes(body.color)) throw bad('Couleur inconnue.'); p.color = body.color; }
  if (body.avatar_kind == null && body.avatar_art != null) throw bad("Précisez le type d'image.");
  if (body.avatar_kind != null) {
    if (!['initial', 'art', 'photo'].includes(body.avatar_kind)) throw bad("Type d'image inconnu.");
    p.avatar_kind = body.avatar_kind;
    if (body.avatar_kind === 'art') {
      const a = body.avatar_art; if (typeof a !== 'number' || !Number.isInteger(a) || a < 0 || a > 7) throw bad('Pirate illustré inconnu.');
      p.avatar_art = a;
    }
    if (body.avatar_kind === 'photo') {
      // la photo doit être celle de l'utilisateur, dans le stockage du projet : avatars/<uid>/avatar.webp
      // origine exacte du projet, fichier du joueur (WebP, ou JPEG quand le navigateur n'encode pas le WebP), éventuel ?v=horodatage
      const u = String(body.avatar_url || ''), base = `${store.origin.replace(/\/$/, '')}/storage/v1/object/public/avatars/${uid}/avatar.`;
      if (!u.startsWith(base) || !/^(webp|jpg)(\?v=\d{1,15})?$/.test(u.slice(base.length))) throw bad('Photo invalide.');
      p.avatar_url = u;
    }
  }
  if (body.look != null) p.look = await validateLook(store, uid, body.look);
  for (const k of ['public_rank', 'notify_turn', 'sounds']) if (body[k] != null) {
    if (typeof body[k] !== 'boolean') throw bad('Réglage invalide.');
    p[k] = body[k];
  }
  if (!Object.keys(p).length) throw bad('Rien à enregistrer.');
  await store.rpc('profile_update', { p_user: uid, p });
  return { ok: true };
}

/* ---------- Aperçu d'un joueur (ApercuJoueur) : identité, Élo, statistiques, inventaire ---------- */
async function playerCard(store: Store, body: any) {
  const t = body?.user_id;
  if (typeof t !== 'string' || !UUID.test(t)) throw bad('Joueur inconnu.');
  const d = await store.rpc('player_card', { p_user: t });
  if (!d) throw new HttpError(404, 'Profil introuvable.');
  return d;
}

/* ---------- Garde-robe ---------- */
async function wardrobe(store: Store, uid: string) {
  const [owned, w, shop] = await Promise.all([store.userCosmetics(uid), store.wallet(uid), store.shopDay()]);
  return { owned, coins: w.coins, chests: w.chests, jokers: w.jokers, shop };
}
/** Joker joué pendant une partie : retiré du porte-monnaie, puis appliqué à l'état (rendu en cas de conflit). */
async function jokerUse(store: Store, uid: string, body: any) {
  const g = await mustGame(store, body.id);
  if (g.status !== 'playing') throw bad("La partie n'est pas en cours.");
  const seats = (await store.seats(g.id)).sort((a, b) => a.seat - b.seat);
  const me = seats.find(s => s.user_id === uid); if (!me) throw new HttpError(403, 'Vous ne jouez pas dans cette partie.');
  const S = await store.secret(g.id); if (!S) throw new HttpError(500, 'État de partie manquant.');
  if (!E.canJoker(S, me.seat)) { try { E.useJoker(S, me.seat); } catch (e) { if (e instanceof E.RuleError) throw bad(e.message); throw e; } }
  const take = await store.rpc('joker_take', { p_user: uid }); if (take?.error) throw bad(take.error);
  E.useJoker(S, me.seat);
  const events = E.takeEvents(S);
  const v = await store.commit(g.id, g.version, { patch: { state: E.publicView(S) }, secret: S, events, ...snapshotsFor(S, seats) });
  if (v == null) { await store.rpc('joker_refund', { p_user: uid }); return 'conflict'; }
  return { ok: true, jokers: take.jokers };
}
async function chestOpen(store: Store, uid: string) {
  const r = await store.rpc('chest_open', { p_user: uid, p_seed: null });
  if (r?.error) throw bad(r.error);
  // Le site attend { cosmetic_id, slot, value, name, rarity, duplicate, coins_gained, coins, chests } : voir web/src/chest.ts
  return r;
}
async function shopBuy(store: Store, uid: string, body: any) {
  if (typeof body.cosmetic_id !== 'string' || body.cosmetic_id.length > 48) throw bad('Objet inconnu.');
  const r = await store.rpc('shop_buy', { p_user: uid, p_cosmetic: body.cosmetic_id });
  if (r?.error) throw bad(r.error);
  return r;
}

/* ---------- Historique ---------- */
const PAGE = 20;
async function historyList(store: Store, uid: string, body: any) {
  const filter = ['all', 'wins', 'ext', 'base'].includes(body.filter) ? body.filter : 'all';
  const before = typeof body.before === 'string' && !isNaN(Date.parse(body.before)) ? body.before : null;
  const beforeId = typeof body.before_id === 'string' && UUID.test(body.before_id) ? body.before_id : null;
  // une partie dont le règlement a échoué n'a pas de résultat, donc pas de ligne : on le refait avant de lister
  if (!before) for (const id of ((await store.rpc('unsettled_games', { p_user: uid })) as string[] ?? [])) {
    try { const S = await store.secret(id); if (S) await settleFinished(store, id, S, await store.seats(id)); }
    catch (e) { console.error('règlement en retard', id, e); }
  }
  const items = (await store.rpc('history_page', { p_user: uid, p_before: before, p_before_id: beforeId, p_filter: filter, p_limit: PAGE })) as any[] ?? [];
  const last = items[items.length - 1];
  return { items, next: items.length === PAGE ? last.finished_at : null, next_id: items.length === PAGE ? last.id : null };
}
async function historyGet(store: Store, uid: string, body: any) {
  if (typeof body.id !== 'string' || !UUID.test(body.id)) throw new HttpError(404, 'Partie introuvable.');
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
  // deux joueurs qui cliquent en même temps doivent arriver dans le même salon : le premier réserve le code, les autres le retrouvent
  const mine = newCode();
  const code = (await store.rpc('rematch_claim', { p_game: g.id, p_code: mine })) as string;
  if (code !== mine) {
    for (let i = 0; i < 10; i++) {
      const ex = await store.gameByCode(code); if (ex) return { id: ex.id, code: ex.code };
      await new Promise(r => setTimeout(r, 150));
    }
    throw new HttpError(409, 'La revanche est en cours de préparation, réessayez.');
  }
  const n = await store.insertGame({ code, host: uid, options: g.options });
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
