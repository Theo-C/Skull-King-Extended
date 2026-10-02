// Edge Function « game » : arbitre toutes les actions de partie.
// Déploiement : supabase functions deploy game
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handle, HttpError, type Store, type GameRow, type SeatRow } from '../_shared/service.ts';

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
const GAME_COLS = 'id, code, host, status, options, state, version';

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
};

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
