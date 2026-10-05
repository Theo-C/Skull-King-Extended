// Test de bout en bout de la fonction serveur, sur la vraie migration SQL (PGlite) :
// 4 comptes créent, rejoignent par invitation, jouent une partie complète en ne lisant que ce que la RLS leur montre.
// Lancer : npx tsx tests/service.test.ts
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { handle, HttpError, settleFinished, type Store } from '../supabase/functions/_shared/service.ts';
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
const ORIGIN = 'https://proj.supabase.co';
const store: Store = {
  origin: ORIGIN,
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
  async rpc(name, args) {
    const keys = Object.keys(args);
    const vals = Object.values(args).map(v => v != null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v);
    await db.exec('set role service_role');
    try { return (await db.query<any>(`select ${name}(${keys.map((k, i) => `${k} => $${i + 1}${Array.isArray(args[k]) ? '::uuid[]' : ''}`).join(', ')}) as r`, vals)).rows[0].r; }
    finally { await db.exec('reset role'); }
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
const lb = (await db.query<any>('select games, wins from player_stats')).rows;
ok('statistiques alimentées', lb.length === 4 && lb.every((x: any) => x.games === 1) && lb.reduce((s: number, x: any) => s + x.wins, 0) >= 1, lb);
const evLeft = (await db.query<any>('select count(*)::int as n from game_events')).rows[0].n;
ok('événements nettoyés en fin de partie', evLeft < 40, evLeft);

// ---------- Fin de partie : XP, hauts faits, statistiques, Élo ----------
const res = (await db.query<any>(`select user_id, place, elo_before::float, elo_after::float, elo_delta::float from game_results where game_id=$1 order by place`, [G])).rows;
ok('résultats : un par humain', res.length === 4, res);
ok('Élo : départ à 100, somme des variations nulle', res.every((r: any) => r.elo_before === 100) && Math.abs(res.reduce((a: number, r: any) => a + r.elo_delta, 0)) < .05, res);
const xpRows = (await db.query<any>('select p.id, p.xp, (select coalesce(sum(amount),0)::int from xp_events x where x.user_id=p.id) as total from profiles p where p.id = any($1::uuid[])', [users])).rows;
ok('XP : profil = somme des lignes, au moins 50 chacun', xpRows.every((x: any) => x.xp === x.total && x.xp >= 50), xpRows);
ok('XP : +100 pour le vainqueur', (await db.query<any>("select count(*)::int as n from xp_events where game_id=$1 and reason='win'", [G])).rows[0].n >= 1);
ok('hauts faits : Premier abordage pour les 4', (await db.query<any>("select count(*)::int as n from user_achievements where code='first_game'")).rows[0].n === 4);
const stats = (await db.query<any>('select games, ranked_games, bids_total from player_stats where user_id = any($1::uuid[])', [users])).rows;
ok('statistiques : 1 partie classée, 10 mises', stats.length === 4 && stats.every((x: any) => x.games === 1 && x.ranked_games === 1 && x.bids_total === 10), stats);
const settledPub = (await as(U.chloe, 'select state from games where id=$1', [G]))[0].state.settled;
ok('résumé de fin de partie publié', !!settledPub && users.every(u => settledPub[u]?.xpTotal > 0 && settledPub[u]?.elo?.vs.length === 3), settledPub && Object.keys(settledPub));
// idempotence : un second règlement ne change rien
const xpBefore = xpRows.map((x: any) => x.xp).join();
const S_end = await store.secret(G);
ok('règlement rejoué : « already »', await settleFinished(store, G, S_end!, await store.seats(G)) === 'already');
const xpAfter = (await db.query<any>('select xp from profiles where id = any($1::uuid[])', [users])).rows.map((x: any) => x.xp);
ok('règlement rejoué : XP inchangée', xpAfter.sort().join() === xpBefore.split(',').sort().join());

// ---------- Garde-robe : récompenses, coffres, doublons, échoppe, look ----------
const wallet = async (u: string) => (await db.query<any>('select coins, chests from user_wallet where user_id=$1', [u])).rows[0] ?? { coins: 0, chests: 0 };
const winners = res.filter((r: any) => r.place === 1).map((r: any) => r.user_id), loser = res.find((r: any) => r.place > 1).user_id;
const w0 = await wallet(winners[0]);
ok('récompenses : un coffre pour le gagnant, des pièces pour tous', w0.chests === 1 && (await wallet(loser)).chests === 0
  && (await Promise.all(users.map(wallet))).every((w: any) => w.coins >= 10), { w0, all: await Promise.all(users.map(wallet)) });
await settleFinished(store, G, S_end!, await store.seats(G));
ok('récompenses : pas distribuées deux fois si le règlement est rappelé', (await wallet(winners[0])).chests === 1 && (await wallet(winners[0])).coins === w0.coins);
await expectErr('coffre : refusé sans coffre', handle(store, loser, { action: 'chest.open' }), 400);
const op = await handle(store, winners[0], { action: 'chest.open' });
ok('coffre : un objet tiré, le coffre est consommé', !!op.item?.id && op.chests === 0 && typeof op.duplicate === 'boolean', op);
ok('coffre : objet ajouté à la garde-robe', op.duplicate || (await db.query<any>('select 1 from user_cosmetics where user_id=$1 and cosmetic_id=$2', [winners[0], op.item.id])).rows.length === 1);
await expectErr('coffre : impossible de l’ouvrir deux fois', handle(store, winners[0], { action: 'chest.open' }), 400);
// doublon : tous les objets déjà possédés → converti en pièces selon la rareté
await db.exec(`insert into user_cosmetics (user_id, cosmetic_id, source) select '${loser}', id, 'test' from cosmetics on conflict do nothing;
  insert into user_wallet (user_id, chests) values ('${loser}', 2) on conflict (user_id) do update set chests = 2;`);
const cBefore = (await wallet(loser)).coins, dup = await handle(store, loser, { action: 'chest.open' });
const DUP: Record<string, number> = { commun: 30, rare: 80, epique: 140, legendaire: 200 };
ok('coffre : un doublon devient des pièces (30 / 80 / 140 / 200)', dup.duplicate === true && dup.coinsGained === DUP[dup.item.rarity] && dup.coins === cBefore + dup.coinsGained && dup.chests === 1, dup);
// look : uniquement des objets possédés
const fresh = users.find(u => u !== loser)!;
const owned = (await db.query<any>('select cosmetic_id from user_cosmetics where user_id=$1', [fresh])).rows.map((r: any) => r.cosmetic_id);
const notOwned = ['hat:amiral', 'hat:bicorne', 'pet:singe'].find(id => !owned.includes(id))!;
await expectErr('look : objet non possédé refusé', handle(store, fresh, { action: 'profile.update', look: { skin: 1, hair: 'court', hc: 1, beard: 'none', [notOwned.split(':')[0]]: notOwned.split(':')[1] } }), 400);
await expectErr('look : base invalide refusée', handle(store, fresh, { action: 'profile.update', look: { skin: 1, hair: '<script>', hc: 1, beard: 'none' } }), 400);
await handle(store, loser, { action: 'profile.update', look: { skin: 2, hair: 'long', hc: 3, beard: 'mous', hat: 'bandana', htc: '#2f5f8a', pet: 'perroquet', bg: 'nuit' } });
const lk = (await as(U.eve, 'select look from profiles where id=$1', [loser]))[0].look;
ok('look : enregistré et visible des autres joueurs', lk?.hat === 'bandana' && lk.htc === '#2f5f8a' && lk.pet === 'perroquet' && lk.ptc === '#3e8e4e', lk);
// échoppe : 3 objets du jour, achat avec des pièces
await db.exec(`insert into user_wallet (user_id, coins) values ('${U.eve}', 500) on conflict (user_id) do update set coins = 500;`);
const shop = await handle(store, U.eve, { action: 'shop.list' });
ok('échoppe : 3 objets du jour avec leur prix', shop.items.length === 3 && shop.items.every((x: any) => x.price > 0) && shop.coins === 500, shop);
const buy = await handle(store, U.eve, { action: 'shop.buy', id: shop.items[0].id });
ok('échoppe : achat payé et objet ajouté', buy.coins === 500 - shop.items[0].price && (await db.query<any>('select 1 from user_cosmetics where user_id=$1 and cosmetic_id=$2', [U.eve, shop.items[0].id])).rows.length === 1, buy);
await expectErr('échoppe : pas deux fois le même objet', handle(store, U.eve, { action: 'shop.buy', id: shop.items[0].id }), 400);
await expectErr('échoppe : objet hors vente refusé', handle(store, U.eve, { action: 'shop.buy', id: 'hat:couronne' }), 400);
ok('garde-robe : un joueur ne voit pas les objets des autres', (await as(U.eve, 'select * from user_cosmetics where user_id=$1', [loser])).length === 0);

// ---------- Historique, détail, revanche, profil ----------
const hist = await handle(store, U.alice, { action: 'history.list' });
ok('historique : la partie terminée', hist.items.length === 1 && hist.items[0].id === G && hist.next === null, hist);
ok('historique : filtre victoires', (await handle(store, U.alice, { action: 'history.list', filter: 'wins' })).items.length === (res.find((r: any) => r.user_id === U.alice).place === 1 ? 1 : 0));
const det = await handle(store, U.bob, { action: 'history.get', id: G });
ok('détail : manches et résultats', det.state.players[0].hist.length === 10 && det.results.length === 4 && det.xp.length >= 1, Object.keys(det));
await expectErr('détail : refusé à qui n’a pas joué', handle(store, U.eve, { action: 'history.get', id: G }), 403);
const rm = await handle(store, U.bob, { action: 'rematch', id: G });
const rm2 = await handle(store, U.chloe, { action: 'rematch', id: G });
ok('revanche : un seul salon même si deux joueurs la demandent', rm2.id === rm.id, { rm, rm2 });
const rmSeats = (await db.query<any>('select seat, user_id, bot from game_players where game_id=$1 order by seat', [rm.id])).rows;
ok('revanche : mêmes joueurs, demandeur hôte', rmSeats.length === 4 && rmSeats[0].user_id === U.bob && rmSeats.filter((x: any) => x.user_id).length === 4, rmSeats);
await expectErr('revanche : refusée à qui n’a pas joué', handle(store, U.eve, { action: 'rematch', id: G }), 403);
await expectErr('profil : couleur hors palette', handle(store, U.alice, { action: 'profile.update', color: '#000000' }), 400);
await expectErr('profil : pseudo trop court', handle(store, U.alice, { action: 'profile.update', pseudo: 'A' }), 400);
await expectErr('profil : photo d’un autre', handle(store, U.alice, { action: 'profile.update', avatar_kind: 'photo', avatar_url: `${ORIGIN}/storage/v1/object/public/avatars/${U.bob}/avatar.webp` }), 400);
await expectErr('profil : photo hébergée ailleurs', handle(store, U.alice, { action: 'profile.update', avatar_kind: 'photo', avatar_url: `https://evil.tld/storage/v1/object/public/avatars/${U.alice}/avatar.webp` }), 400);
await expectErr('profil : réglage non booléen', handle(store, U.alice, { action: 'profile.update', sounds: 'false' }), 400);
await expectErr('détail : identifiant invalide', handle(store, U.alice, { action: 'history.get', id: 'abc' }), 404);
await handle(store, U.alice, { action: 'profile.update', avatar_kind: 'photo', avatar_url: `${ORIGIN}/storage/v1/object/public/avatars/${U.alice}/avatar.jpg?v=1700000000000` });
ok('profil : sa propre photo acceptée', (await db.query<any>('select avatar_kind from profiles where id=$1', [U.alice])).rows[0].avatar_kind === 'photo');
// salon de revanche : l'hôte (bob) retire chloé, sa place redevient libre
await handle(store, U.bob, { action: 'lobby', id: rm.id, kick: U.chloe });
const kicked = (await db.query<any>('select user_id from game_players where game_id=$1 and user_id=$2', [rm.id, U.chloe])).rows;
ok('salon : l’hôte retire un joueur', kicked.length === 0, kicked);
await expectErr('salon : l’hôte ne peut pas se retirer', handle(store, U.bob, { action: 'lobby', id: rm.id, kick: U.bob }), 400);
// règlement perdu (simulé) : history.list le refait
await db.exec(`delete from xp_events where game_id='${G}'; delete from game_results where game_id='${G}';`);
const re = await handle(store, U.alice, { action: 'history.list' });
ok('historique : règlement perdu refait avant de lister', re.items.length === 1 && re.items[0].id === G, re);
await handle(store, U.alice, { action: 'profile.update', pseudo: 'Alice la Rouge', color: '#c8644b', avatar_kind: 'art', avatar_art: 3, sounds: false });
const pr = (await as(U.bob, 'select pseudo, color, avatar_kind, avatar_art, sounds from profiles where id=$1', [U.alice]))[0];
ok('profil : enregistré', pr.pseudo === 'Alice la Rouge' && pr.color === '#c8644b' && pr.avatar_kind === 'art' && pr.avatar_art === 3 && pr.sounds === false, pr);

// ---------- Conflit de version ----------
const g2 = await handle(store, U.alice, { action: 'create' });
const row = await store.gameById(g2.id);
const v1 = await store.commit(g2.id, row!.version, { patch: {} });
const v2 = await store.commit(g2.id, row!.version, { patch: {} });
ok('écriture concurrente détectée', v1 != null && v2 == null, { v1, v2 });

console.log(`Serveur : ${passes} vérifications réussies, ${fails} échec(s), ${moves} actions jouées par 4 comptes.`);
if (fails) process.exit(1);
