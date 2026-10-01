// Vérifie la migration sur un Postgres embarqué (PGlite) avec un faux schéma « auth » comme celui de Supabase,
// puis contrôle les règles RLS : chacun ne voit que sa main, les secrets sont inaccessibles.
// Lancer : npx tsx tests/sql.test.ts
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

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
await db.exec(readFileSync(new URL('../supabase/migrations/20261001000000_init.sql', import.meta.url), 'utf8'));
ok('migration appliquée', true);

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
const lb = await as(C, 'select pseudo, games, wins, avg_score, best_score from leaderboard order by wins desc, avg_score desc');
ok('classement visible par tous, sans les bots', JSON.stringify(lb) === JSON.stringify([{ pseudo: 'Alice', games: 1, wins: 1, avg_score: 180, best_score: 180 }, { pseudo: 'bob', games: 1, wins: 0, avg_score: 90, best_score: 90 }]), lb);

console.log(fails ? `${fails} échec(s)` : 'Schéma : toutes les vérifications passent.');
if (fails) process.exit(1);
