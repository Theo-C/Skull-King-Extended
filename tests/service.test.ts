// Test de bout en bout de la fonction serveur, sur la vraie migration SQL (PGlite) :
// 4 comptes créent, rejoignent par invitation, jouent une partie complète en ne lisant que ce que la RLS leur montre.
// Lancer : npx tsx tests/service.test.ts
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { handle, HttpError, type Store } from '../supabase/functions/_shared/service.ts';
import * as E from '../supabase/functions/_shared/engine.ts';

const db = new PGlite();
let fails = 0, passes = 0;
const ok = (n: string, c: boolean, i?: unknown) => { if (!c) { fails++; console.error('ÉCHEC', n, i ?? ''); } else passes++; };

await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create publication supabase_realtime;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated;
`);
const dir = new URL('../supabase/migrations/', import.meta.url);
for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));

// Store branché sur PGlite (équivalent de game/index.ts, en SQL direct, rôle « service »)
const store: Store = {
  async pseudo(uid) { return (await db.query<any>('select pseudo from profiles where id=$1', [uid])).rows[0]?.pseudo ?? 'Pirate'; },
  async insertGame(row) {
    try { return (await db.query<any>('insert into games(code,host,options) values($1,$2,$3) returning id,code,host,status,options,state,version', [row.code, row.host, JSON.stringify(row.options)])).rows[0]; }
    catch (e: any) { if (String(e.code) === '23505') return null; throw e; }
  },
  async gameById(id) { return (await db.query<any>('select id,code,host,status,options,state,version from games where id=$1', [id])).rows[0] ?? null; },
  async gameByCode(code) { return (await db.query<any>('select id,code,host,status,options,state,version from games where code=$1', [code])).rows[0] ?? null; },
  async seats(g) { return (await db.query<any>('select seat,user_id,bot,name,final_score,rank from game_players where game_id=$1 order by seat', [g])).rows; },
  async secret(g) { return (await db.query<any>('select state from game_secrets where game_id=$1', [g])).rows[0]?.state ?? null; },
  async commit(g, v, c) {
    const j = (x: any) => x == null ? null : JSON.stringify(x);
    await db.exec('set role service_role');
    try {
      return (await db.query<any>('select game_commit($1,$2,$3,$4,$5,$6,$7) as v', [g, v, j(c.patch), j(c.secret), j(c.hands), j(c.events), j(c.seats)])).rows[0].v;
    } finally { await db.exec('reset role'); }
  },
};
async function as<T = any>(uid: string, sql: string, params: any[] = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec('reset role;'); }
}
async function expectErr(name: string, p: Promise<any>, status?: number) {
  try { await p; ok(name, false, 'pas d’erreur'); } catch (e) { ok(name, e instanceof HttpError && (status == null || e.status === status), (e as any).message); }
}

const U = { alice: 'a0000000-0000-0000-0000-000000000001', bob: 'b0000000-0000-0000-0000-000000000002', chloe: 'c0000000-0000-0000-0000-000000000003', david: 'd0000000-0000-0000-0000-000000000004', eve: 'e0000000-0000-0000-0000-000000000005' };
for (const [n, id] of Object.entries(U)) await db.exec(`insert into auth.users values ('${id}', '${n}@exemple.fr')`);

// ---------- Salon et invitations ----------
await expectErr('non connecté refusé', handle(store, null, { action: 'create' }), 401);
const { id: G, code } = await handle(store, U.alice, { action: 'create', seats: [{ bot: false }, { bot: false }, { bot: false }, { bot: true }], options: { powers: true, exp: true } });
ok('code d’invitation au bon format', /^[A-Z2-9]{6}$/.test(code), code);
const pv = await handle(store, U.bob, { action: 'preview', code: code.toLowerCase() });
ok('aperçu de l’invitation', pv.host === 'alice' && pv.seats.length === 4 && !pv.member, pv);
ok('un invité ne voit pas encore la partie', (await as(U.bob, 'select id from games')).length === 0);
await handle(store, U.bob, { action: 'join', code });
await handle(store, U.bob, { action: 'join', code }); // rejoindre deux fois ne prend pas deux sièges
await handle(store, U.chloe, { action: 'join', code });
await expectErr('partie complète', handle(store, U.eve, { action: 'join', code }));
await expectErr('seul l’hôte modifie', handle(store, U.bob, { action: 'lobby', id: G, seats: [{}, {}, {}, {}, {}] }), 403);
await handle(store, U.alice, { action: 'lobby', id: G, seats: [{ bot: false }, { bot: false }, { bot: false }, { bot: false }] });
await handle(store, U.david, { action: 'join', code });
let seats = await as(U.chloe, 'select seat, user_id, bot, name from game_players order by seat');
ok('4 humains assis dans l’ordre d’arrivée', seats.map((s: any) => s.name).join() === 'alice,bob,chloe,david', seats);
await expectErr('seul l’hôte lance', handle(store, U.bob, { action: 'start', id: G }), 403);
await handle(store, U.alice, { action: 'start', id: G });
await expectErr('rejoindre une partie lancée', handle(store, U.eve, { action: 'join', code }));
ok('statut en cours', (await as(U.bob, 'select status from games'))[0].status === 'playing');

// ---------- Confidentialité ----------
const handsBob = await as(U.bob, 'select seat, data from hands');
ok('Bob ne lit que sa main', handsBob.length === 1 && handsBob[0].seat === 1);
ok('la vue publique ne contient aucune main', !JSON.stringify((await as(U.bob, 'select state from games'))[0].state).includes('"hand"'));
ok('les secrets restent inaccessibles', (await as(U.bob, 'select * from game_secrets')).length === 0);
ok('un étranger ne voit rien', (await as(U.eve, 'select * from hands')).length === 0 && (await as(U.eve, 'select * from game_events')).length === 0);

// ---------- Partie complète, chaque client ne lisant que sa vue ----------
const users = [U.alice, U.bob, U.chloe, U.david];
let seed = 42; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
let moves = 0, wrongTurnChecked = false, illegalChecked = false;
for (let step = 0; step < 5000; step++) {
  const st = (await as(U.alice, 'select status, state from games'))[0];
  if (st.status === 'finished') break;
  const pub = st.state as E.PublicView;
  const seat = pub.phase === 'bid' ? pub.players.findIndex(p => !p.hasBid) : (pub.pending ? pub.pending.seat : pub.current!);
  const uid = users[seat];
  const priv = (await as(uid, 'select data from hands'))[0].data as E.PrivateView;
  let move: E.Action;
  if (pub.phase === 'bid') move = { t: 'bid', n: Math.floor(r() * (pub.cards + 1)) };
  else if (pub.pending) move = pub.pending.t === 'bahij' ? { t: 'choose', v: priv.hand.slice(0, priv.pendingData.k).map(c => c.id) } : { t: 'choose', v: (pub.pending.opts as any[]).filter(o => !o.disabled)[0].v };
  else {
    if (!wrongTurnChecked) { wrongTurnChecked = true; await expectErr('jouer hors de son tour', handle(store, users[(seat + 1) % 4], { action: 'act', id: G, move: { t: 'play', id: priv.legal[0] } })); }
    const illegal = priv.hand.find(c => !priv.legal.includes(c.id));
    if (illegal && !illegalChecked) { illegalChecked = true; await expectErr('carte interdite refusée', handle(store, uid, { action: 'act', id: G, move: { t: 'play', id: illegal.id } })); }
    move = { t: 'play', id: priv.legal[Math.floor(r() * priv.legal.length)], as: r() < .5 ? 'pirate' : 'escape', val: r() < .5 ? 0 : 14, ws: E.WILD_SUITS[Math.floor(r() * 3)] };
  }
  await handle(store, uid, { action: 'act', id: G, move });
  moves++;
}
const fin = (await as(U.bob, 'select status, state from games'))[0];
ok('partie terminée', fin.status === 'finished', fin.status);
ok('10 manches jouées', fin.state.players.every((p: any) => p.hist.length === 10));
const lb = await as(U.eve, 'select pseudo, games, wins from leaderboard order by pseudo');
ok('classement alimenté', lb.length === 4 && lb.every((x: any) => x.games === 1) && lb.reduce((s: number, x: any) => s + x.wins, 0) >= 1, lb);
const evLeft = (await db.query<any>('select count(*)::int as n from game_events')).rows[0].n;
ok('événements nettoyés en fin de partie', evLeft < 40, evLeft);

// ---------- Conflit de version ----------
const g2 = await handle(store, U.alice, { action: 'create' });
const row = await store.gameById(g2.id);
const v1 = await store.commit(g2.id, row!.version, { patch: {} });
const v2 = await store.commit(g2.id, row!.version, { patch: {} });
ok('écriture concurrente détectée', v1 != null && v2 == null, { v1, v2 });

console.log(`Serveur : ${passes} vérifications réussies, ${fails} échec(s), ${moves} actions jouées par 4 comptes.`);
if (fails) process.exit(1);
