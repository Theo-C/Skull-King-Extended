// Tests du juke-box partagé (A19) : liens, quotas, droits de retrait, vote à la moitié, music.next idempotent,
// coupure par l'hôte, position attendue, métadonnées YouTube / SoundCloud (réponses simulées, aucun appel réseau).
// Lancer : npx tsx tests/music.test.ts
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { handle, HttpError, type Store, type MediaInfo } from '../supabase/functions/_shared/service.ts';
import * as M from '../supabase/functions/_shared/music.ts';
import { media } from '../supabase/functions/game/media.ts';

let fails = 0, passes = 0;
const ok = (n: string, c: boolean, i?: unknown) => { if (!c) { fails++; console.error('ÉCHEC', n, i ?? ''); } else passes++; };
async function expectErr(name: string, p: Promise<any>, status?: number, msg?: RegExp) {
  try { await p; ok(name, false, 'pas d’erreur'); }
  catch (e: any) { ok(name, e instanceof HttpError && (status == null || e.status === status) && (!msg || msg.test(e.message)), e?.message); }
}

/* ---------- Liens ---------- */
const P = (u: string) => M.parseLink(u) as any;
ok('youtube.com/watch', P('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42').id === 'dQw4w9WgXcQ');
ok('youtu.be', P('youtu.be/dQw4w9WgXcQ?si=abc').id === 'dQw4w9WgXcQ');
ok('shorts', P('https://youtube.com/shorts/dQw4w9WgXcQ').id === 'dQw4w9WgXcQ');
ok('m.youtube.com', P('https://m.youtube.com/watch?v=dQw4w9WgXcQ').provider === 'youtube');
ok('playlist YouTube refusée', P('https://www.youtube.com/playlist?list=PL123').error === 'playlist');
ok('SoundCloud', P('https://soundcloud.com/forss/flickermood').url === 'https://soundcloud.com/forss/flickermood');
ok('SoundCloud privé (jeton)', P('https://soundcloud.com/forss/flickermood/s-AbC12').provider === 'soundcloud');
ok('set SoundCloud refusé', P('https://soundcloud.com/forss/sets/soulhack').error === 'playlist');
ok('Spotify refusé', P('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC').error === 'closed');
ok('Deezer refusé', P('https://www.deezer.com/fr/track/3135556').error === 'closed');
ok('lien Deezer court refusé', P('https://deezer.page.link/abc').error === 'closed');
ok('lien inconnu', P('https://vimeo.com/123').error === 'unknown' && P('pas un lien').error === 'unknown' && P('').error === 'unknown');
ok('identifiant YouTube invalide', P('https://youtu.be/abc').error === 'unknown');

/* ---------- Règles et synchronisation ---------- */
ok('durée ISO', M.isoSeconds('PT2M34S') === 154 && M.isoSeconds('PT1H2M') === 3720 && M.isoSeconds('PT00H03M33S') === 213 && M.isoSeconds('P0D') === 0);
ok('vote à 3 joueurs : 2', M.skipNeed(3) === 2);
ok('vote à 4 joueurs : 2', M.skipNeed(4) === 2);
ok('vote à 6 joueurs : 3', M.skipNeed(6) === 3);
ok('vote seul : 1', M.skipNeed(1) === 1);
const t0 = Date.parse('2026-10-18T12:00:00Z');
ok('position attendue', M.expectedPosition({ started_at: '2026-10-18T12:00:00Z', paused_at: null }, t0 + 74_500) === 74.5);
ok('position figée pendant la coupure', M.expectedPosition({ started_at: '2026-10-18T12:00:00Z', paused_at: '2026-10-18T12:00:30Z' }, t0 + 99_000) === 30);
ok('position bornée à la durée', M.expectedPosition({ started_at: '2026-10-18T12:00:00Z', paused_at: null }, t0 + 999_000, 154) === 154);
ok('sans morceau : 0', M.expectedPosition({ started_at: null, paused_at: null }, t0) === 0);
ok('recalage au-delà de 1,5 s', M.needsResync(10, 11.6) && !M.needsResync(10, 11.4));
ok('décalage : aller-retour le plus court', M.clockOffset([{ t0: 0, t1: 400, server: 5000 }, { t0: 1000, t1: 1100, server: 6300 }, { t0: 2000, t1: 2600, server: 7000 }]) === 5250);
ok('durée affichée', M.fmtDuration(154) === '2:34' && M.fmtDuration(3720) === '1:02:00');

/* ---------- Métadonnées (fetch simulé) ---------- */
const realFetch = globalThis.fetch;
const fake = (routes: [RegExp, number, string][]) => { globalThis.fetch = (async (u: any) => {
  const r = routes.find(([re]) => re.test(String(u))); return new Response(r ? r[2] : 'introuvable', { status: r ? r[1] : 404 });
}) as any; };
const yt = (v: any) => JSON.stringify({ items: v ? [v] : [] });
const ytVideo = (x: any = {}) => ({ snippet: { title: 'Wellerman', liveBroadcastContent: 'none', thumbnails: { medium: { url: 'https://i.ytimg.com/vi/x/mq.jpg' } }, ...x.snippet },
  contentDetails: { duration: 'PT2M34S', contentRating: {}, ...x.contentDetails }, status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed', ...x.status } });
{
  const api = media('cle-de-test');
  const look = async (v: any, id: string) => { fake([[/googleapis/, 200, yt(v)]]); return api.lookup({ provider: 'youtube', id }) as any; };
  const r = await look(ytVideo(), 'aaaaaaaaaa1');
  ok('YouTube : titre, durée, miniature', r.title === 'Wellerman' && r.duration_s === 154 && r.media_id === 'aaaaaaaaaa1' && /mq\.jpg/.test(r.thumb_url), r);
  ok('YouTube : non intégrable refusé', (await look(ytVideo({ status: { embeddable: false } }), 'aaaaaaaaaa2')).error === 'embed');
  ok('YouTube : restriction d’âge refusée', (await look(ytVideo({ contentDetails: { contentRating: { ytRating: 'ytAgeRestricted' } } }), 'aaaaaaaaaa3')).error === 'embed');
  ok('YouTube : direct refusé', (await look(ytVideo({ snippet: { liveBroadcastContent: 'live' } }), 'aaaaaaaaaa4')).error === 'live');
  ok('YouTube : privée refusée', (await look(ytVideo({ status: { privacyStatus: 'private' } }), 'aaaaaaaaaa5')).error === 'notfound');
  ok('YouTube : introuvable', (await look(null, 'aaaaaaaaaa6')).error === 'notfound');
  ok('YouTube : sans clé, indisponible', ((await media(undefined).lookup({ provider: 'youtube', id: 'aaaaaaaaaa7' })) as any).error === 'unavailable');
  const oembed = (kind = 'tracks', id = 293) => JSON.stringify({ title: 'Flickermood by Forss', thumbnail_url: 'https://i1.sndcdn.com/a.jpg',
    html: `<iframe src="https://w.soundcloud.com/player/?visual=true&amp;url=https%3A%2F%2Fapi.soundcloud.com%2F${kind}%2F${id}&amp;show_artwork=true"></iframe>` });
  const page = (extra = '') => `<html><meta itemprop="duration" content="PT00H03M33S" /><script>{"kind":"track","policy":"MONETIZE","embeddable_by":"all","streamable":true${extra}}</script></html>`;
  const sc = async (url: string, oe: string, html: string) => { fake([[/oembed/, 200, oe], [/soundcloud\.com\//, 200, html]]); return api.lookup({ provider: 'soundcloud', url }) as any; };
  const s1 = await sc('https://soundcloud.com/forss/flickermood', oembed(), page());
  ok('SoundCloud : durée lue sur la page, lecteur officiel', s1.duration_s === 213 && s1.media_id === 'https://api.soundcloud.com/tracks/293' && s1.title === 'Flickermood by Forss', s1);
  ok('SoundCloud : extrait de 30 s refusé', (await sc('https://soundcloud.com/a/b1', oembed(), page().replace('MONETIZE', 'SNIP'))).error === 'preview');
  ok('SoundCloud : intégration interdite', (await sc('https://soundcloud.com/a/b2', oembed(), page().replace('"all"', '"none"'))).error === 'embed');
  ok('SoundCloud : playlist refusée', (await sc('https://soundcloud.com/a/b3', oembed('playlists'), page())).error === 'playlist');
  ok('SoundCloud : durée en repli (données de la page)', (await sc('https://soundcloud.com/a/b4', oembed(), page(',"full_duration":120400').replace(/<meta[^>]*>/, ''))).duration_s === 120);
  fake([]);
  ok('SoundCloud : introuvable', ((await api.lookup({ provider: 'soundcloud', url: 'https://soundcloud.com/a/b5' })) as any).error === 'notfound');
  globalThis.fetch = realFetch;
}

/* ---------- Serveur (vraie migration sur PGlite) ---------- */
const db = new PGlite();
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

/** Morceaux simulés : l'identifiant YouTube dit la durée (« long » = 11 min, « bloque » = non intégrable). */
const store: Store = {
  origin: 'https://proj.supabase.co',
  music: {
    async lookup(l): Promise<MediaInfo | { error: string }> {
      if (l.provider === 'soundcloud') return { provider: 'soundcloud', media_id: 'https://api.soundcloud.com/tracks/1', title: 'Taverne du port', thumb_url: null, duration_s: 300 };
      if (l.id.startsWith('bloque')) return { error: 'embed' };
      return { provider: 'youtube', media_id: l.id, title: 'Chant ' + l.id, thumb_url: null, duration_s: l.id.startsWith('longlong') ? 660 : 154 };
    },
  },
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
    return (await db.query<any>('select game_commit($1,$2,$3,$4,$5,$6,$7) as v', [g, v, j(c.patch), j(c.secret), j(c.hands), j(c.events), j(c.seats)])).rows[0].v;
  },
  async deleteGame(g, v) { return (await db.query<any>('delete from games where id=$1 and version=$2 returning id', [g, v])).rows.length > 0; },
  async rpc(name, args) {
    const keys = Object.keys(args), vals = Object.values(args).map(v => v != null && typeof v === 'object' ? JSON.stringify(v) : v);
    return (await db.query<any>(`select ${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, vals)).rows[0].r;
  },
  async cosmetics() { return []; },
  async userCosmetics() { return []; },
  async wallet() { return { coins: 0, chests: 0, jokers: 0 }; },
};
const U = Array.from({ length: 7 }, (_, i) => `${'abcdef1'[i]}0000000-0000-0000-0000-00000000000${i + 1}`);
for (const [i, id] of U.entries()) await db.exec(`insert into auth.users values ('${id}', 'joueur${i}@exemple.fr')`);
/** Partie en cours avec n humains (U[0] hôte) et des bots pour faire au moins 3 places. */
async function game(n: number) {
  const { id, code } = await handle(store, U[0], { action: 'create', seats: [...Array(n).fill({ bot: false }), ...Array(Math.max(1, 3 - n)).fill({ bot: true })] });
  for (let i = 1; i < n; i++) await handle(store, U[i], { action: 'join', code });
  await handle(store, U[0], { action: 'start', id });
  return id as string;
}
const act = (u: string, action: string, b: any) => handle(store, u, { action, ...b });
const state = async (g: string) => (await db.query<any>('select * from music_state where game_id=$1', [g])).rows[0];
const queue = async (g: string) => (await db.query<any>('select * from music_queue where game_id=$1 order by position', [g])).rows;
const yid = (k: number) => `chant${String(k).padStart(6, '0')}`; // 11 caractères

// heure du serveur
ok('time : heure du serveur', Math.abs((await handle(store, U[0], { action: 'time' })).now - Date.now()) < 1000);

{
  const G = await game(3);
  await expectErr('juke-box : salon refusé (avant la partie)', act(U[0], 'music.add', { id: (await handle(store, U[0], { action: 'create' })).id, url: 'youtu.be/' + yid(1) }), 400, /pendant la partie/);
  await expectErr('juke-box : pas joueur → refus', act(U[5], 'music.add', { id: G, url: 'youtu.be/' + yid(1) }), 403);
  await expectErr('juke-box : Spotify refusé', act(U[1], 'music.add', { id: G, url: 'https://open.spotify.com/track/x' }), 400, /Spotify et Deezer/);
  await expectErr('juke-box : non intégrable refusé', act(U[1], 'music.add', { id: G, url: 'youtu.be/bloque00000' }), 400, /refuse d'être lu/);
  await expectErr('juke-box : plus de 10 min refusé', act(U[1], 'music.add', { id: G, url: 'youtu.be/longlong000' }), 400, /dure 11:00/);
  const a1 = await act(U[1], 'music.add', { id: G, url: 'https://youtu.be/' + yid(1) });
  let st = await state(G);
  ok('premier ajout : démarre tout de suite', a1.started && st.current_id === a1.id && st.started_at, st);
  // quota : 3 en attente par joueur, le morceau en cours ne compte pas
  for (let k = 2; k <= 4; k++) await act(U[1], 'music.add', { id: G, url: 'youtu.be/' + yid(k) });
  await expectErr('quota : 4e morceau en attente refusé', act(U[1], 'music.add', { id: G, url: 'youtu.be/' + yid(5) }), 400, /3 morceaux en attente/);
  const sc = await act(U[2], 'music.add', { id: G, url: 'https://soundcloud.com/forss/flickermood' });
  ok('SoundCloud ajouté', sc.ok && (await queue(G)).length === 5);
  // retrait : le sien oui, celui d'un autre non, l'hôte tous ; pas le morceau en cours
  const q = await queue(G), mineU1 = q.filter(x => x.added_by === U[1] && x.id !== a1.id), ofU2 = q.find(x => x.added_by === U[2])!;
  await expectErr('retrait : morceau d’un autre refusé', act(U[1], 'music.remove', { id: G, item: ofU2.id }), 403);
  await act(U[1], 'music.remove', { id: G, item: mineU1[0].id });
  ok('retrait : son propre morceau', !(await queue(G)).some(x => x.id === mineU1[0].id));
  await act(U[0], 'music.remove', { id: G, item: ofU2.id });
  ok('retrait : l’hôte retire celui d’un autre', !(await queue(G)).some(x => x.id === ofU2.id));
  await expectErr('retrait : pas le morceau en cours', act(U[0], 'music.remove', { id: G, item: a1.id }), 400, /votez pour le passer/);
  // music.next : trop tôt refusé, puis deux appels simultanés = un seul passage
  ok('music.next trop tôt : rien', (await act(U[2], 'music.next', { id: G, item: a1.id })).result === 'early' && (await state(G)).current_id === a1.id);
  await db.query(`update music_state set started_at = now() - interval '160 seconds' where game_id=$1`, [G]);
  const before = (await queue(G)).length;
  const rr = await Promise.all([act(U[1], 'music.next', { id: G, item: a1.id }), act(U[2], 'music.next', { id: G, item: a1.id })]);
  st = await state(G);
  ok('music.next idempotent : un seul passage', rr.filter(r => r.result === 'ok').length === 1 && rr.filter(r => r.result === 'already').length === 1 && (await queue(G)).length === before - 1 && st.current_id === mineU1[1].id, { rr, st });
  // vote à la moitié : 3 humains → 2 votes ; un second clic retire son vote
  const cur = st.current_id;
  ok('vote 1/2', (await act(U[1], 'music.vote', { id: G, item: cur })).votes === 1);
  ok('vote retiré', (await act(U[1], 'music.vote', { id: G, item: cur })).votes === 0);
  await act(U[1], 'music.vote', { id: G, item: cur });
  const v2 = await act(U[2], 'music.vote', { id: G, item: cur });
  ok('3 joueurs : passé à 2 votes', v2.skipped && v2.need === 2 && (await state(G)).current_id !== cur, v2);
  await expectErr('vote sur un morceau fini', act(U[0], 'music.vote', { id: G, item: cur }), 400);
  // hôte : passer, couper, rallumer
  await expectErr('passer sans vote : hôte seulement', act(U[1], 'music.skip', { id: G, item: (await state(G)).current_id }), 403);
  await expectErr('couper : hôte seulement', act(U[1], 'music.toggle', { id: G, on: false }), 403);
  await db.query(`update music_state set started_at = now() - interval '40 seconds' where game_id=$1`, [G]);
  await act(U[0], 'music.toggle', { id: G, on: false });
  st = await state(G);
  ok('coupé : file gardée, position figée', !st.enabled && st.paused_at && (await queue(G)).length > 0);
  await expectErr('coupé : ajout refusé', act(U[2], 'music.add', { id: G, url: 'youtu.be/' + yid(9) }), 400, /coupé par l'hôte/);
  ok('coupé : music.next sans effet', (await act(U[1], 'music.next', { id: G, item: st.current_id })).result !== 'ok');
  await act(U[0], 'music.toggle', { id: G, on: true });
  st = await state(G);
  const pos = M.expectedPosition(st, Date.now());
  ok('rallumé : reprend là où il était', st.enabled && !st.paused_at && pos > 38 && pos < 43, pos);
  // morceau illisible : l'hôte et un autre joueur le signalent → passé
  const r1 = await act(U[1], 'music.report', { id: G, item: st.current_id });
  const r2 = await act(U[0], 'music.report', { id: G, item: st.current_id });
  ok('illisible : passé après l’hôte et un joueur', !r1.skipped && r2.skipped && (await state(G)).current_id !== st.current_id);
  // file vidée : le juke-box s'arrête
  for (const it of await queue(G)) if (it.id !== (await state(G)).current_id) await act(U[0], 'music.remove', { id: G, item: it.id });
  const last = (await state(G)).current_id; if (last) await act(U[0], 'music.skip', { id: G, item: last });
  st = await state(G);
  ok('file vide : arrêt', st.current_id == null && st.started_at == null && (await queue(G)).length === 0, st);
  // RLS : lecture pour les joueurs de la partie seulement, aucune écriture depuis le site
  await act(U[1], 'music.add', { id: G, url: 'youtu.be/' + yid(10) });
  const as = async (u: string, sql: string) => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false);`);
    try { return (await db.query<any>(sql)).rows; } finally { await db.exec('reset role;'); }
  };
  ok('RLS : file lisible par un joueur', (await as(U[2], `select id from music_queue where game_id='${G}'`)).length === 1);
  ok('RLS : file invisible pour les autres', (await as(U[5], `select id from music_queue where game_id='${G}'`)).length === 0);
  let wrote = true; try { await as(U[1], `update music_state set enabled=false where game_id='${G}'`); wrote = !(await state(G)).enabled; } catch { wrote = false; }
  ok('RLS : pas d’écriture depuis le site', !wrote);
  let called = true; try { await as(U[1], `select music_advance('${G}', null)`); } catch { called = false; }
  ok('fonctions réservées au serveur', !called);
}
// vote à la moitié avec 4 et 6 joueurs (les bots ne votent pas)
for (const [n, need] of [[4, 2], [6, 3]] as const) {
  const G = await game(n);
  const a = await act(U[1], 'music.add', { id: G, url: 'youtu.be/' + yid(50 + n) });
  for (let i = 1; i < need; i++) ok(`${n} joueurs : pas encore passé à ${i} vote(s)`, !(await act(U[i], 'music.vote', { id: G, item: a.id })).skipped);
  const last = await act(U[need], 'music.vote', { id: G, item: a.id });
  ok(`${n} joueurs : passé à ${need} votes`, last.skipped && last.need === need, last);
}
// 30 morceaux au plus dans la file
{
  const G = await game(1);
  await db.query(`insert into music_state(game_id) values($1)`, [G]);
  await db.query(`insert into music_queue(game_id, added_by, provider, media_id, title, duration_s, position) select $1, $2, 'youtube', 'x', 't', 100, g from generate_series(1, 30) g`, [G, U[3]]);
  await expectErr('file pleine à 30', act(U[0], 'music.add', { id: G, url: 'youtu.be/' + yid(99) }), 400, /30 morceaux/);
}

console.log(`Juke-box : ${passes} vérifications réussies, ${fails} échec(s).`);
if (fails) process.exit(1);
