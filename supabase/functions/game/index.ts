// Edge Function « game » : arbitre toutes les actions de partie.
// Déploiement : supabase functions deploy game
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handle, HttpError, type Store, type GameRow, type SeatRow, type CosmeticRow } from '../_shared/service.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function fail(e: { message: string } | null, what: string): never { throw new Error(`${what} : ${e?.message ?? 'erreur inconnue'}`); }
const GAME_COLS = 'id, code, host, status, options, state, version, updated_at';

const store: Store = {
  origin: URL_,
  async pseudo(uid) {
    const { data } = await admin.from('profiles').select('pseudo').eq('id', uid).maybeSingle();
    return data?.pseudo ?? 'Pirate';
  },
  async insertGame(row) {
    const { data, error } = await admin.from('games').insert(row).select(GAME_COLS).single();
    if (error) { if (error.code === '23505') return null; fail(error, 'création'); }
    return data as GameRow;
  },
  async gameById(id) {
    const { data, error } = await admin.from('games').select(GAME_COLS).eq('id', id).maybeSingle();
    if (error && error.code !== '22P02') fail(error, 'lecture');
    return (data as GameRow) ?? null;
  },
  async gameByCode(code) {
    const { data, error } = await admin.from('games').select(GAME_COLS).eq('code', code).maybeSingle();
    if (error) fail(error, 'lecture');
    return (data as GameRow) ?? null;
  },
  async seats(gameId) {
    const { data, error } = await admin.from('game_players').select('seat, user_id, bot, name, final_score, rank').eq('game_id', gameId).order('seat');
    if (error) fail(error, 'sièges');
    return (data ?? []) as SeatRow[];
  },
  async secret(gameId) {
    const { data, error } = await admin.from('game_secrets').select('state').eq('game_id', gameId).maybeSingle();
    if (error) fail(error, 'état');
    return data?.state ?? null;
  },
  async commit(gameId, expected, c) {
    const { data, error } = await admin.rpc('game_commit', {
      p_game: gameId, p_expected: expected, p_patch: c.patch,
      p_secret: c.secret ?? null, p_hands: c.hands ?? null, p_events: c.events ?? null, p_seats: c.seats ?? null,
    });
    if (error) fail(error, 'enregistrement');
    return (data as number | null) ?? null;
  },
  async rpc(name, args) {
    const { data, error } = await admin.rpc(name, args);
    if (error) fail(error, name);
    return data;
  },
  async cosmetics() {
    // cache 60 s : le catalogue est en données de départ (migration), il bouge rarement
    if (cosmeticsCache && Date.now() - cosmeticsCache.at < 60_000) return cosmeticsCache.rows;
    const { data, error } = await admin.from('cosmetics').select('id, slot, value, default_owned, how, variants');
    if (error) fail(error, 'catalogue');
    cosmeticsCache = { at: Date.now(), rows: (data ?? []) as CosmeticRow[] };
    return cosmeticsCache.rows;
  },
  async userCosmetics(uid) {
    const { data, error } = await admin.from('user_cosmetics').select('cosmetic_id').eq('user_id', uid);
    if (error) fail(error, 'inventaire');
    return (data ?? []).map(r => r.cosmetic_id);
  },
  async wallet(uid) {
    const { data, error } = await admin.from('user_wallet').select('coins, chests').eq('user_id', uid).maybeSingle();
    if (error) fail(error, 'porte-monnaie');
    return { coins: data?.coins ?? 0, chests: data?.chests ?? 0 };
  },
  async shopDay(day) {
    const { data, error } = await admin.rpc('shop_day', day ? { p_day: day } : {});
    if (error) fail(error, 'boutique');
    return ((data ?? []) as { cosmetic_id: string; price: number }[]).map(r => ({ cosmetic_id: r.cosmetic_id, price: r.price }));
  },
};
let cosmeticsCache: { at: number; rows: CosmeticRow[] } | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const body = await req.json().catch(() => ({}));
    const out = await handle(store, u.user?.id ?? null, body);
    return json(200, out);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: 'Erreur du serveur, réessayez dans un instant.' });
  }
});
