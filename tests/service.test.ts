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
  async gameById(id) { return (await db.query<any>('select id,code,host,status,options,state,version,updated_at from games where id=$1', [id])).rows[0] ?? null; },
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
  async cosmetics() {
    return (await db.query<any>('select id, slot, value, default_owned, how, variants from cosmetics')).rows;
  },
  async userCosmetics(uid) {
    return (await db.query<any>('select cosmetic_id from user_cosmetics where user_id=$1', [uid])).rows.map(r => r.cosmetic_id);
  },
  async wallet(uid) {
    const r = (await db.query<any>('select coins, chests, jokers from user_wallet where user_id=$1', [uid])).rows[0];
    return { coins: r?.coins ?? 0, chests: r?.chests ?? 0, jokers: r?.jokers ?? 0 };
  },
  async shopDay(day) {
    await db.exec('set role service_role');
    try { return (await db.query<any>(day ? 'select cosmetic_id, price from shop_day($1::date)' : 'select cosmetic_id, price from shop_day()', day ? [day] : [])).rows; }
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
// places tirées au sort au lancement : mêmes joueurs, sièges 0 à 3, et l'état de partie suit le nouvel ordre
const after = (await db.query<any>('select seat, user_id, name from game_players where game_id=$1 order by seat', [G])).rows;
const users = after.map((s: any) => s.user_id as string), bobSeat = users.indexOf(U.bob);
ok('places tirées au sort : mêmes joueurs, sièges 0 à 3', after.map((s: any) => s.seat).join() === '0,1,2,3' && [...users].sort().join() === [U.alice, U.bob, U.chloe, U.david].sort().join(), after);
ok('places tirées au sort : noms de l’état dans l’ordre des sièges', ((await as(U.bob, 'select state from games'))[0].state as E.PublicView).players.map(p => p.name).join() === after.map((s: any) => s.name).join());

// ---------- Confidentialité ----------
const handsBob = await as(U.bob, 'select seat, data from hands');
ok('Bob ne lit que sa main', handsBob.length === 1 && handsBob[0].seat === bobSeat);
ok('la vue publique ne contient aucune main', !JSON.stringify((await as(U.bob, 'select state from games'))[0].state).includes('"hand"'));
ok('les secrets restent inaccessibles', (await as(U.bob, 'select * from game_secrets')).length === 0);
ok('un étranger ne voit rien', (await as(U.eve, 'select * from hands')).length === 0 && (await as(U.eve, 'select * from game_events')).length === 0);

// ---------- Partie complète, chaque client ne lisant que sa vue ----------
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
ok('10 manches jouées (plus les départages)', fin.state.players.every((p: any) => p.hist.length === 10 + (fin.state.extra ?? 0)));
const lb = (await db.query<any>('select games, wins from player_stats')).rows;
ok('statistiques alimentées', lb.length === 4 && lb.every((x: any) => x.games === 1) && lb.reduce((s: number, x: any) => s + x.wins, 0) >= 1, lb);
const pt = (await db.query<any>('select user_id, plays, play_ms from player_stats')).rows;
ok('temps de jeu : cartes mesurées pour chaque joueur', pt.length === 4 && pt.every((x: any) => x.plays > 0 && Number(x.play_ms) >= 0), pt);
const pcard = await handle(store, U.bob, { action: 'player.card', user_id: U.alice });
ok("temps de jeu : moyenne dans l'aperçu", typeof pcard.avg_play_ms === 'number' || (pcard.avg_play_ms === null && pt.find((x: any) => x.user_id === U.alice).plays < 10), pcard.avg_play_ms);
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

// Porte-monnaie et objets gagnés : 1 coffre au vainqueur, 10 + 5 × mises tenues pièces, pas de double application
const winnerUid = res[0].user_id as string;
const winnerBids = Number((await db.query<any>('select bids_made from game_results where game_id=$1 and user_id=$2', [G, winnerUid])).rows[0].bids_made);
const wWin = await store.wallet(winnerUid);
ok('porte-monnaie : 1 coffre au vainqueur humain', wWin.chests === 1, wWin);
ok('porte-monnaie : 10 + 5 × mises tenues', wWin.coins === 10 + 5 * winnerBids, { wWin, winnerBids });
await settleFinished(store, G, S_end!, await store.seats(G));
const wWin2 = await store.wallet(winnerUid);
ok('porte-monnaie : règlement rejoué n’ajoute rien', wWin2.coins === wWin.coins && wWin2.chests === wWin.chests, { wWin, wWin2 });

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

// ---------- Joker : acheté à l'échoppe, joué pendant une partie, une manche de 10 cartes en plus ----------
{
  const { id: J, code: jc } = await handle(store, U.eve, { action: 'create', seats: [{ bot: false }, { bot: false }, { bot: true }], options: { rounds: 3 } });
  await handle(store, U.chloe, { action: 'join', code: jc });
  await handle(store, U.eve, { action: 'start', id: J });
  await db.exec(`insert into user_wallet (user_id, coins, chests) values ('${U.eve}', 100, 0) on conflict (user_id) do update set coins = 100, jokers = 0`);
  await expectErr('joker : sans joker → refus', handle(store, U.eve, { action: 'joker.use', id: J }), 400);
  await expectErr('joker : pas assez de pièces → refus', handle(store, U.eve, { action: 'joker.buy' }), 400);
  await db.exec(`update user_wallet set coins = 160 where user_id = '${U.eve}'`);
  const jb = await handle(store, U.eve, { action: 'joker.buy' });
  ok('joker : acheté 150 pièces', jb?.ok && jb.jokers === 1 && jb.coins === 10, jb);
  const ju = await handle(store, U.eve, { action: 'joker.use', id: J });
  const js = (await db.query<any>('select state from games where id=$1', [J])).rows[0].state;
  const eveSeat = (await db.query<any>('select seat from game_players where game_id=$1 and user_id=$2', [J, U.eve])).rows[0].seat;
  ok('joker : une manche de plus, joueur noté', ju?.ok && js.extra === 1 && js.jokers.join() === String(eveSeat) && (await store.wallet(U.eve)).jokers === 0, { ju, extra: js.extra, jokers: js.jokers });
  await db.exec(`update user_wallet set jokers = 1 where user_id = '${U.eve}'`);
  await expectErr('joker : un seul par partie', handle(store, U.eve, { action: 'joker.use', id: J }), 400);
  ok('joker : refusé sans être retiré du porte-monnaie', (await store.wallet(U.eve)).jokers === 1);
  await expectErr('joker : hors de la partie → refus', handle(store, U.alice, { action: 'joker.use', id: J }), 403);
}

// ---------- Cosmétiques : coffre, boutique, apparence ----------
// Catalogue : les objets de titre et de haut fait sont bien dans la base
const titleIds = ['hat:tricorne', 'hat:plume', 'hat:bicorne', 'hat:amiral', 'bg:or', 'frame:tentacules', 'neck:perles', 'neck:medaillon', 'hat:couronne', 'pet:poulpe'];
const catIds = ((await db.query<any>('select id from cosmetics where id = any($1::text[])', [titleIds])).rows).map((r: any) => r.id).sort();
ok('catalogue : objets de titre et de haut fait présents', catIds.join() === [...titleIds].sort().join(), catIds);

// chest.open : graine fixe → objet attendu ; appel sans coffre → erreur ; payload complet
const nobodyUid = U.eve;
await db.exec(`insert into user_wallet (user_id, chests) values ('${nobodyUid}', 1) on conflict (user_id) do update set chests = 1`);
const open1 = await store.rpc('chest_open', { p_user: nobodyUid, p_seed: 123 });
ok('coffre : graine fixe → objet déterministe', open1?.ok && typeof open1.cosmetic_id === 'string' && ['c', 'r', 'e', 'l'].includes(open1.rarity), open1);
ok('coffre : payload complet (slot, value, coins, chests)', typeof open1.slot === 'string' && 'value' in open1 && typeof open1.coins === 'number' && typeof open1.chests === 'number' && open1.chests === 0 && open1.coins_gained === 0, open1);
const noMore = await store.rpc('chest_open', { p_user: nobodyUid, p_seed: 456 });
ok('coffre : rien à ouvrir → erreur', !!noMore?.error, noMore);
// doublon : on force un second coffre avec la même graine (donc même objet) et on vérifie la conversion en pièces
await db.exec(`update user_wallet set chests = 1, coins = 0 where user_id = '${nobodyUid}'`);
const open2 = await store.rpc('chest_open', { p_user: nobodyUid, p_seed: 123 });
ok('coffre : doublon converti en pièces', open2?.duplicate === true && open2.cosmetic_id === open1.cosmetic_id && open2.coins_gained > 0, open2);
const payouts: Record<string, number> = { c: 30, r: 80, e: 140, l: 200 };
const payout = payouts[open2.rarity as string];
ok('coffre : barème du doublon (c:30 r:80 e:140 l:200)', Number(open2.coins) === payout && Number(open2.coins_gained) === payout, { expected: payout, got: open2 });

// Tirage : vérifier la répartition commune/rare/épique sur 500 ouvertures. Le pool légendaire reste vide dans le
// catalogue de départ (poulpe est le seul 'l' chest_pool, et c'est aussi un objet de haut fait très rare au tirage),
// donc on ne contrôle pas la fréquence légendaire — on vérifie juste commune/rare/épique.
let cC = 0, cR = 0, cE = 0, cL = 0;
for (let i = 0; i < 500; i++) {
  await db.exec(`update user_wallet set chests = 1 where user_id = '${nobodyUid}'`);
  const r = await store.rpc('chest_open', { p_user: nobodyUid, p_seed: 1_000_000 + i * 2017 });
  if (r?.rarity === 'c') cC++; else if (r?.rarity === 'r') cR++; else if (r?.rarity === 'e') cE++; else if (r?.rarity === 'l') cL++;
}
ok('coffre : fréquence commune autour de 61 %', Math.abs(cC - 305) <= 60, { cC, cR, cE, cL });
ok('coffre : fréquence rare autour de 26 %', Math.abs(cR - 130) <= 50, { cC, cR, cE, cL });
ok('coffre : fréquence épique autour de 9 %', Math.abs(cE - 45) <= 30, { cC, cR, cE, cL });

// Légendaire (le Poulpe est le seul légendaire du coffre) : environ 3 fois sur 100 ; Mythique (cartes animées) : environ 1 fois sur 100
let leg = 0, myth = 0;
for (let i = 0; i < 1000; i++) {
  await db.exec(`update user_wallet set chests = 1 where user_id = '${nobodyUid}'`);
  const r = await store.rpc('chest_open', { p_user: nobodyUid, p_seed: 7_000_000 + i * 7919 });
  if (r?.rarity === 'l') leg++; else if (r?.rarity === 'm') { myth++; if (r.slot !== 'carte') myth = -999; }
}
ok('coffre : fréquence légendaire autour de 3 %', leg >= 15 && leg <= 50, { leg, myth });
ok('coffre : fréquence mythique autour de 1 %, toujours une carte animée', myth >= 3 && myth <= 22, { leg, myth });
// graine 9950 : tirage 0,995 → Mythique, première carte par ordre d'identifiant (carte:baleine)
await db.exec(`delete from user_cosmetics where user_id = '${nobodyUid}' and cosmetic_id like 'carte:%'; update user_wallet set chests = 2 where user_id = '${nobodyUid}'`);
const m1 = await store.rpc('chest_open', { p_user: nobodyUid, p_seed: 9950 }), m2 = await store.rpc('chest_open', { p_user: nobodyUid, p_seed: 9950 });
ok('coffre : Mythique → carte animée, doublon à 400 pièces', m1?.rarity === 'm' && m1.cosmetic_id === 'carte:baleine' && !m1.duplicate && m2?.duplicate && m2.coins_gained === 400, { m1, m2 });
await db.exec(`insert into user_cosmetics (user_id, cosmetic_id, source) select '${nobodyUid}', id, 'test' from cosmetics where slot = 'carte' on conflict do nothing; update user_wallet set chests = 1 where user_id = '${nobodyUid}'`);
const m3 = await store.rpc('chest_open', { p_user: nobodyUid, p_seed: 9950 });
ok('coffre : les 6 cartes possédées → la Mythique devient une Légendaire', m3?.rarity === 'l', m3);
const ca = (await db.query<any>('select * from cartes_animees($1::uuid[])', [[nobodyUid, U.alice]])).rows;
ok('cartes animées : lecture de qui possède quoi', ca.length === 6 && ca.every((r: any) => r.user_id === nobodyUid), ca);
await db.exec(`delete from user_cosmetics where user_id = '${nobodyUid}' and cosmetic_id like 'carte:%'`);

// chest.open par l'action du service (le site passe par là) : un coffre ouvert, puis refus quand il n'y en a plus
await db.exec(`update user_wallet set chests = 1 where user_id = '${nobodyUid}'`);
const viaAction = await handle(store, nobodyUid, { action: 'chest.open' });
ok('coffre : action chest.open', viaAction?.ok && typeof viaAction.cosmetic_id === 'string' && viaAction.chests === 0 && (await store.wallet(nobodyUid)).chests === 0, viaAction);
await expectErr('coffre : action chest.open sans coffre → refus', handle(store, nobodyUid, { action: 'chest.open' }), 400);

// Boutique : 3 objets déterministes à partir de la date, puis achat et refus (prix et pool)
const shop1 = await store.shopDay('2026-10-03'), shop2 = await store.shopDay('2026-10-03'), shop3 = await store.shopDay('2026-10-04');
ok('boutique : 3 objets déterministes par jour', shop1.length === 3 && JSON.stringify(shop1) === JSON.stringify(shop2) && shop3.length === 3, { shop1, shop3 });
ok('boutique : jamais deux fois le même objet le même jour', [shop1, shop3].every(sh => new Set(sh.map((x: any) => x.cosmetic_id)).size === sh.length), { shop1, shop3 });
await expectErr('boutique : objet pas en vente → refus', handle(store, nobodyUid, { action: 'shop.buy', cosmetic_id: 'hat:couronne' }), 400);
// achat : on crédite assez de pièces, on prend un objet de la boutique du jour
const todayShop = await store.shopDay();
await db.exec(`update user_wallet set coins = 500 where user_id = '${nobodyUid}'`);
const buy = await handle(store, nobodyUid, { action: 'shop.buy', cosmetic_id: todayShop[0].cosmetic_id });
ok('boutique : achat réussi', !!buy?.ok && buy.cosmetic_id === todayShop[0].cosmetic_id, buy);
await expectErr('boutique : rachat refusé', handle(store, nobodyUid, { action: 'shop.buy', cosmetic_id: todayShop[0].cosmetic_id }), 400);

// Apparence (look) : un objet non possédé est refusé, un objet libre + couleur hex passent
await expectErr('look : objet non possédé → refus', handle(store, U.alice, { action: 'profile.update', look: { hat: 'bicorne' } }), 400);
await expectErr('look : coiffure inconnue → refus', handle(store, U.alice, { action: 'profile.update', look: { hair: 'rose' } }), 400);
await expectErr('look : couleur mal formée → refus', handle(store, U.alice, { action: 'profile.update', look: { htc: 'rouge' } }), 400);
await expectErr('look : teint hors plage → refus', handle(store, U.alice, { action: 'profile.update', look: { skin: 42 } }), 400);
await handle(store, U.alice, { action: 'profile.update', look: { skin: 2, hair: 'meche', hc: 1, beard: 'short', hat: 'bandana', htc: '#9e2a22', face: null, neck: 'foulard', nkc: '#2f5f8a', bg: 'nuit' } });
const look = (await db.query<any>('select look from profiles where id=$1', [U.alice])).rows[0].look;
ok('look : apparence libre enregistrée', look?.hair === 'meche' && look?.hat === 'bandana' && look?.htc === '#9e2a22' && look?.bg === 'nuit', look);
// couleurs : seulement une variante possédée de l'objet porté (le bandana violet s'achète à l'échoppe)
await expectErr('look : variante non possédée (bandana violet) → refus', handle(store, U.alice, { action: 'profile.update', look: { hat: 'bandana', htc: '#5b3a7a' } }), 400);
await expectErr('look : couleur hors variantes → refus', handle(store, U.alice, { action: 'profile.update', look: { neck: 'foulard', nkc: '#123456' } }), 400);
await expectErr('look : couleur sans objet indiqué → refus', handle(store, U.alice, { action: 'profile.update', look: { htc: '#9e2a22' } }), 400);
await db.exec(`insert into user_cosmetics (user_id, cosmetic_id, source) values ('${U.alice}', 'hat:bandana-violet', 'test') on conflict do nothing`);
await handle(store, U.alice, { action: 'profile.update', look: { hat: 'bandana', htc: '#5b3a7a' } });
ok('look : variante possédée acceptée', (await db.query<any>('select look from profiles where id=$1', [U.alice])).rows[0].look?.htc === '#5b3a7a');
const sl = await handle(store, U.alice, { action: 'shop.list' });
ok('échoppe : action shop.list', Array.isArray(sl.shop) && sl.shop.length === 3, sl);

// profile.wardrobe : résumé pour l'UI (inventaire + porte-monnaie + boutique du jour)
const wr = await handle(store, winnerUid, { action: 'profile.wardrobe' });
ok('garde-robe : inventaire + porte-monnaie + boutique', Array.isArray(wr.owned) && typeof wr.coins === 'number' && typeof wr.chests === 'number' && wr.shop.length === 3, wr);

console.log(`Serveur : ${passes} vérifications réussies, ${fails} échec(s), ${moves} actions jouées par 4 comptes.`);
if (fails) process.exit(1);
