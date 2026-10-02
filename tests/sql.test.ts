// Vérifie la migration sur un Postgres embarqué (PGlite) avec un faux schéma « auth » comme celui de Supabase,
// puis contrôle les règles RLS : chacun ne voit que sa main, les secrets sont inaccessibles.
// Lancer : npx tsx tests/sql.test.ts
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

const db = new PGlite();
let fails = 0;
const ok = (n: string, c: boolean, i?: unknown) => { if (!c) { fails++; console.error('ÉCHEC', n, i ?? ''); } else console.log('ok  ', n); };

await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create publication supabase_realtime;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated;
`);
const dir = new URL('../supabase/migrations/', import.meta.url);
for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
ok('migrations appliquées', true);

const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', C = '00000000-0000-0000-0000-00000000000c';
await db.exec(`insert into auth.users values ('${A}','alice@x.fr'),('${B}','bob@x.fr'),('${C}','c@x.fr');`);
const pro = await db.query<{ pseudo: string }>(`select pseudo from profiles order by pseudo`);
ok('profils créés à l’inscription', pro.rows.map(r => r.pseudo).join() === 'alice,bob,c-0000', pro.rows);

const G = '10000000-0000-0000-0000-000000000001';
await db.exec(`
  insert into games(id, code, host, status, state) values ('${G}', 'ABC234', '${A}', 'finished', '{"phase":"end"}');
  insert into game_players(game_id, seat, user_id, bot, name, final_score, rank) values
    ('${G}',0,'${A}',false,'alice',180,1), ('${G}',1,'${B}',false,'bob',90,2), ('${G}',2,null,true,'Ysolde',40,3);
  insert into game_secrets values ('${G}', '{"deck":[1,2,3]}', now());
  insert into hands(game_id,user_id,seat,data) values ('${G}','${A}',0,'{"hand":["a"]}'), ('${G}','${B}',1,'{"hand":["b"]}');
  insert into game_events(game_id, version, idx, payload) values ('${G}', 1, 0, '{"k":"play"}');
`);

async function as(uid: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return (await db.query<any>(sql)).rows; } finally { await db.exec(`reset role;`); }
}
ok('Alice ne voit que sa main', JSON.stringify(await as(A, 'select seat from hands')) === '[{"seat":0}]');
ok('Bob ne voit que sa main', JSON.stringify(await as(B, 'select seat from hands')) === '[{"seat":1}]');
ok('secrets inaccessibles', (await as(A, 'select * from game_secrets')).length === 0);
ok('partie visible par ses joueurs', (await as(B, 'select id from games')).length === 1);
ok('partie invisible pour un non-joueur', (await as(C, 'select id from games')).length === 0);
ok('sièges invisibles pour un non-joueur', (await as(C, 'select * from game_players')).length === 0);
ok('événements visibles par les joueurs', (await as(A, 'select * from game_events')).length === 1);
let blocked = false; try { await as(A, `update games set status='lobby'`); const r = await db.query<any>(`select status from games`); blocked = r.rows[0].status === 'finished'; } catch { blocked = true; }
ok('un joueur ne peut pas modifier une partie', blocked);
let blocked2 = false; try { await as(A, `insert into hands(game_id,user_id,seat,data) values ('${G}','${A}',3,'{}')`); } catch { blocked2 = true; }
ok('un joueur ne peut pas écrire de main', blocked2);
await as(A, `update profiles set pseudo='Alice' where id='${A}'`);
await as(A, `update profiles set pseudo='Pirate' where id='${B}'`);
const ps = await db.query<any>(`select pseudo from profiles where id in ('${A}','${B}') order by pseudo`);
ok('chacun ne modifie que son pseudo', ps.rows.map((r: any) => r.pseudo).join() === 'Alice,bob', ps.rows);
const oldView = (await db.query<any>(`select to_regclass('public.leaderboard') as v`)).rows[0].v;
ok('ancienne vue de classement supprimée (ignorait public_rank)', oldView == null, oldView);

// ---------- Écrans du compte : profils, XP, Élo, résultats ----------
const prof = (await db.query<any>(`select avatar_kind, color, xp, public_rank from profiles where id='${A}'`)).rows[0];
ok('profil : valeurs par défaut', prof.avatar_kind === 'initial' && prof.color === '#d9b25a' && prof.xp === 0 && prof.public_rank === true, prof);
let colorRefused = false; try { await db.exec(`update profiles set color='#123456' where id='${A}'`); } catch { colorRefused = true; }
ok('profil : couleur hors palette refusée', colorRefused);
let xpBlocked = false; try { await as(A, `update profiles set xp = 9999 where id='${A}'`); } catch { xpBlocked = true; }
ok('profil : un joueur ne peut pas changer son XP', xpBlocked || (await db.query<any>(`select xp from profiles where id='${A}'`)).rows[0].xp === 0);
ok('hauts faits : 10 codes', (await as(C, 'select code from achievements')).length === 10);
let svcBlocked = false; try { await as(A, `select game_settle('${G}', '{}'::jsonb)`); } catch { svcBlocked = true; }
ok('fonctions serveur interdites aux joueurs', svcBlocked);

const settle = (payload: any) => db.query<any>('select game_settle($1, $2) as r', [G, JSON.stringify(payload)]).then(x => x.rows[0].r);
const payload = {
  results: [
    { user_id: A, place: 1, score: 180, bids_made: 7, rounds: 10, players: 3, elo_before: 100, elo_after: 110, elo_delta: 10 },
    { user_id: B, place: 2, score: 90, bids_made: 4, rounds: 10, players: 3, elo_before: 100, elo_after: 90, elo_delta: -10 },
  ],
  xp: [{ user_id: A, reason: 'game', amount: 50 }, { user_id: A, reason: 'win', amount: 100 }, { user_id: B, reason: 'game', amount: 50 }, { user_id: A, reason: 'ach:first_game', amount: 25 }],
  achievements: [{ user_id: A, code: 'first_game' }],
  stats: [
    { user_id: A, win: 1, bids_made: 7, bids_total: 10, score: 180, sirens: 2, zero_bids_made: 1, ranked: true, elo_after: 110 },
    { user_id: B, win: 0, bids_made: 4, bids_total: 10, score: 90, sirens: 0, zero_bids_made: 0, ranked: true, elo_after: 90 },
  ],
  public: { [A]: { xp: 175 } },
};
// conflit : l'Élo de départ annoncé ne correspond pas
ok('règlement : Élo de départ incohérent → conflit', await settle({ ...payload, results: payload.results.map(r => ({ ...r, elo_before: 120 })) }) === 'conflict');
ok('règlement : écrit', await settle(payload) === 'ok');
ok('règlement : rejoué → rien de plus', await settle(payload) === 'already');
const xpA = (await db.query<any>(`select xp from profiles where id='${A}'`)).rows[0].xp;
ok('XP cumulée une seule fois', xpA === 175, xpA);
const st = (await db.query<any>(`select games, wins, elo::float, elo_best::float, ranked_games, best_score, sirens_captured from player_stats where user_id='${A}'`)).rows[0];
ok('statistiques et Élo mis à jour', st.games === 1 && st.wins === 1 && st.elo === 110 && st.elo_best === 110 && st.ranked_games === 1 && st.best_score === 180 && st.sirens_captured === 2, st);
ok('résumé public dans la partie', (await db.query<any>(`select state->'settled' as s from games where id='${G}'`)).rows[0].s?.[A]?.xp === 175);
ok('XP : chacun ne voit que la sienne', (await as(B, 'select * from xp_events')).every((x: any) => x.user_id === B) && (await as(B, 'select * from xp_events')).length === 1);
ok('résultats : visibles par les joueurs de la partie', (await as(B, 'select * from game_results')).length === 2);
ok('résultats : invisibles pour les autres', (await as(C, 'select * from game_results')).length === 0);
ok('hauts faits obtenus : lisibles', (await as(C, 'select * from user_achievements')).length === 1);
const lbF = await as(B, `select pseudo, elo, me from leaderboard_period('friends', 'week')`);
ok('classement entre amis : trié par Élo', lbF.map((x: any) => x.pseudo).join() === 'Alice,bob' && lbF[1].me === true, lbF);
const lbAll = await as(B, `select * from leaderboard_period('all', 'ever')`);
ok('classement « Tous » : 5 parties classées minimum', lbAll.length === 0, lbAll);
const hl = (await db.query<any>(`select history_list('${A}') as h`)).rows[0].h;
ok('historique : une partie avec ses joueurs', hl.length === 1 && hl[0].xp === 175 && hl[0].seats.length === 3, hl);
ok('détail : refusé à qui n’a pas joué', (await db.query<any>(`select history_get('${C}', '${G}') as d`)).rows[0].d === null);
ok('détail : accessible au joueur', (await db.query<any>(`select history_get('${B}', '${G}') as d`)).rows[0].d?.results.length === 2);

console.log(fails ? `${fails} échec(s)` : 'Schéma : toutes les vérifications passent.');
if (fails) process.exit(1);
