// Boosters et collection (D14, docs/boosters/PROMPT-claude-code.md, point 10) : tirage par emplacement (graine fixe),
// puis enregistrement en base (PGlite, vraies migrations) : paiement, Numérotées, doublons → éclats, variante jouée.
// Lancer : npx tsx tests/collection.test.ts
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import * as C from '../supabase/functions/_shared/collection.ts';

let fails = 0, passes = 0;
const ok = (n: string, c: boolean, i?: unknown) => { if (!c) { fails++; console.error('ÉCHEC', n, i ?? ''); } else passes++; };
const pct = (n: number, d: number) => n / d * 100;

/* ---------- 1. Tirage : 100 000 boosters, graine fixe ---------- */
{
  const N = 100_000, r = C.rng(20261028);
  const slot = Array.from({ length: 5 }, () => ({ c: 0, r: 0, e: 0, l: 0, m: 0 } as Record<C.Tier, number>));
  let divine = 0, dupInPack = 0, normal = 0, feat = 0, other = 0;
  const pack = C.PACK_BY_ID.profondeurs;
  for (let i = 0; i < N; i++) {
    const d = C.drawBooster('profondeurs', r);
    if (new Set(d.cards.map(c => c.card_id)).size !== 5) dupInPack++;
    if (d.divine) { divine++; ok('booster divin : 5 Signées ou Numérotées', d.cards.every(c => c.variant === 'signee' || c.variant === 'numero'), d); continue; }
    normal++;
    d.cards.forEach((c, k) => { slot[k][C.TIER_OF[c.variant as Exclude<C.Variant, 'std'>]]++; });
    for (const c of d.cards) pack.featured.includes(c.card_id) ? feat++ : other++;
  }
  ok('jamais deux fois la même carte dans un booster', dupInPack === 0, dupInPack);
  ok('cartes 1 à 3 toujours communes', [0, 1, 2].every(k => slot[k].c === normal), slot.slice(0, 3));
  for (const o of C.ODDS) {
    ok(`carte 4 : ${o.label} ${o.slot4} % (± 0,2)`, Math.abs(pct(slot[3][o.tier], normal) - o.slot4) <= .2, pct(slot[3][o.tier], normal));
    ok(`carte 5 : ${o.label} ${o.slot5} % (± 0,2)`, Math.abs(pct(slot[4][o.tier], normal) - o.slot5) <= .2, pct(slot[4][o.tier], normal));
  }
  ok('booster divin ≈ 0,05 % (1 sur 2 000)', pct(divine, N) > .02 && pct(divine, N) < .09, pct(divine, N));
  // fréquence par carte : vedette (poids 3) contre carte ordinaire ; le tirage sans remise (5 cartes différentes)
  // ramène le rapport un peu sous 3
  const ratio = (feat / 3) / (other / 73);
  ok('cartes vedettes environ 3 fois plus fréquentes', ratio > 2.6 && ratio < 3.05, ratio);
  let pat = 0, eta = 0, nac = 0, viv = 0;
  for (let i = 0; i < 20_000; i++) for (const c of C.drawBooster('couronne', r).cards) {
    if (c.variant === 'patine') pat++; else if (c.variant === 'etain') eta++; else if (c.variant === 'nacre') nac++; else if (c.variant === 'vivante') viv++;
  }
  ok('communes : Patinée ou Étain, moitié-moitié', Math.abs(pat / (pat + eta) - .5) < .02, { pat, eta });
  ok('épiques : Nacre ou Vivante, moitié-moitié', Math.abs(nac / (nac + viv) - .5) < .05, { nac, viv });
  ok('catalogue : 76 cartes, 532 variantes', C.CARDS.length === 76 && C.COLLECTION_SIZE === 532, C.CARDS.length);
  ok('extension : 7 (−5), 8 (+5) et 0·14 montrent le 7, le 8 et le 14 de leur couleur',
    C.collId({ kind: 'num', suit: 'green', rank: 7, mod: -5, exp: 1 }) === 'g7' && C.collId({ kind: 'num', suit: 'black', rank: 14, zf: 1, exp: 1 }) === 'b14' && C.collId({ kind: 'num', suit: 'wild' as any, rank: 15, wild: 1 }) === 'wild');
}

/* ---------- 2. Le moteur de jeu ignore totalement la variante ---------- */
{
  const src = readFileSync(new URL('../supabase/functions/_shared/engine.ts', import.meta.url), 'utf8');
  ok('le moteur ne connaît pas les variantes', !/variant|collection/i.test(src));
}

/* ---------- 3. En base : booster_apply, Numérotées, éclats, variante jouée ---------- */
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
const uid = (i: number) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`;
for (let i = 1; i <= 12; i++) await db.exec(`insert into auth.users values ('${uid(i)}', 'u${i}@x.fr')`);
const rpc = async (name: string, args: Record<string, unknown>) => {
  const keys = Object.keys(args), vals = Object.values(args).map(v => v != null && typeof v === 'object' ? JSON.stringify(v) : v);
  return (await db.query<any>(`select ${name}(${keys.map((k, i) => `${k} => $${i + 1}${Array.isArray(args[k]) && k === 'p_users' ? '::uuid[]' : ''}`).join(', ')}) as r`, vals)).rows[0].r;
};
const wallet = async (u: string) => (await db.query<any>('select coins, boosters, shards from user_wallet where user_id=$1', [u])).rows[0];
const A = uid(1);
const draw: C.Drawn[] = [{ card_id: 'g3', variant: 'patine' }, { card_id: 'y7', variant: 'etain' }, { card_id: 'p12', variant: 'patine' }, { card_id: 'kraken', variant: 'holo' }, { card_id: 'rosie', variant: 'vivante' }];

ok('sans pièces ni booster → refus', !!(await rpc('booster_apply', { p_user: A, p_pack: 'profondeurs', p_divine: false, p_cards: draw }))?.error);
await db.exec(`update user_wallet set coins = 120, boosters = 1 where user_id = '${A}'`);
const o1 = await rpc('booster_apply', { p_user: A, p_pack: 'profondeurs', p_divine: false, p_cards: draw });
ok('un booster en réserve passe avant les pièces', o1.ok && o1.paid === 'booster' && o1.coins === 120 && o1.boosters === 0, o1);
ok('5 nouvelles variantes, aucun doublon', o1.new === 5 && o1.shards_gained === 0 && o1.owned === 5 && o1.total === 532, o1);
const o2 = await rpc('booster_apply', { p_user: A, p_pack: 'profondeurs', p_divine: false, p_cards: draw });
ok('puis 50 pièces', o2.paid === 'coins' && o2.coins === 70, o2);
ok('doublons recyclés à l’ouverture : 5 + 5 + 5 + 20 + 60 éclats', o2.shards_gained === 95 && o2.shards === 95 && o2.cards.every((c: any) => c.duplicate), o2);
ok('journal des éclats', (await db.query<any>(`select sum(amount)::int as s from shard_events where user_id = '${A}' and reason = 'booster'`)).rows[0].s === 95);
const copies = (await db.query<any>(`select max(copies) as m from user_card_variants where user_id = '${A}'`)).rows[0].m;
ok('un doublon de booster ne s’ajoute pas aux exemplaires', copies === 1, copies);
ok('tirage invalide refusé', !!(await rpc('booster_apply', { p_user: A, p_pack: 'profondeurs', p_divine: false, p_cards: draw.slice(0, 4) }))?.error);
ok('booster inconnu refusé', !!(await rpc('booster_apply', { p_user: A, p_pack: 'atlantide', p_divine: false, p_cards: draw }))?.error);

// Numérotées : il reste 6 exemplaires de Rosie (95 à 100) ; 10 ouvertures lancées en même temps
await db.exec(`insert into numbered_stock (series_id, card_id, next_serial) values ('S1', 'rosie', 95)`);
for (let i = 2; i <= 11; i++) await db.exec(`insert into user_wallet (user_id, coins) values ('${uid(i)}', 100)`);
const numDraw: C.Drawn[] = [{ card_id: 'g1', variant: 'patine' }, { card_id: 'g2', variant: 'patine' }, { card_id: 'g4', variant: 'patine' }, { card_id: 'kraken', variant: 'holo' }, { card_id: 'rosie', variant: 'numero' }];
const many = await Promise.all(Array.from({ length: 10 }, (_, i) => rpc('booster_apply', { p_user: uid(i + 2), p_pack: 'couronne', p_divine: false, p_cards: numDraw })));
const serials = many.map(m => m.cards[4]).filter((c: any) => c.variant === 'numero').map((c: any) => c.serial);
ok('Numérotées : 6 exemplaires restants attribués, numéros uniques de 95 à 100', serials.length === 6 && new Set(serials).size === 6 && Math.min(...serials) === 95 && Math.max(...serials) === 100, serials);
ok('Numérotées : stock épuisé → Signée', many.filter(m => m.cards[4].variant === 'signee').length === 4);
const top = (await db.query<any>(`select max(serial) as m, count(*)::int as n from user_card_variants where card_id = 'rosie' and variant = 'numero'`)).rows[0];
ok('Numérotées : jamais plus de 100', top.m <= 100 && top.n === 6, top);
const stock = (await db.query<any>(`select next_serial from numbered_stock where card_id = 'rosie'`)).rows[0].next_serial;
ok('stock bloqué à 101', stock === 101, stock);
// une Numérotée n'est jamais un doublon : déjà celle de cette carte → Signée
await db.exec(`update user_wallet set coins = 100 where user_id = '${uid(2)}'; insert into numbered_stock (series_id, card_id) values ('S1', 'kraken')`);
const owner = many.findIndex(m => m.cards[4].variant === 'numero') + 2;
await db.exec(`update user_wallet set coins = 100 where user_id = '${uid(owner)}'`);
const again = await rpc('booster_apply', { p_user: uid(owner), p_pack: 'couronne', p_divine: false, p_cards: numDraw });
ok('deuxième Numérotée de la même carte → Signée', again.cards[4].variant === 'signee', again.cards[4]);
const ann = (await db.query<any>(`select count(*)::int as n from card_announcements where kind = 'numero'`)).rows[0].n;
ok('Signées et Numérotées annoncées', ann === 6, ann);

// variante jouée : refusée si non possédée, Standard toujours permise, lue par la table
ok('collection.choose refuse une variante non possédée', !!(await rpc('collection_choose', { p_user: A, p_card: 'rosie', p_variant: 'signee' }))?.error);
ok('collection.choose : carte inconnue refusée', !!(await rpc('collection_choose', { p_user: A, p_card: 'rosie2', p_variant: 'std' }))?.error);
ok('collection.choose accepte une variante possédée', (await rpc('collection_choose', { p_user: A, p_card: 'rosie', p_variant: 'vivante' }))?.ok);
const ch = (await db.query<any>(`select * from card_choices($1::uuid[])`, [[A, uid(2)]])).rows;
ok('card_choices : la variante jouée de chaque joueur', ch.length === 1 && ch[0].card_id === 'rosie' && ch[0].variant === 'vivante', ch);
await rpc('collection_choose', { p_user: A, p_card: 'rosie', p_variant: 'std' });
ok('retour à la Standard', (await db.query<any>(`select * from card_choices($1::uuid[])`, [[A]])).rows.length === 0);
const st = await rpc('collection_state', { p_user: A });
ok('collection_state : possession, éclats, total', st.owned.length === 5 && st.shards === 95 && st.total === 532 && st.coins === 70, st);
// RLS : chacun ne voit que sa collection
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid(3)}', false);`);
const seen = (await db.query<any>('select distinct user_id from user_card_variants')).rows;
let blocked = false; try { await db.query(`insert into user_card_variants (user_id, card_id, variant) values ('${uid(3)}', 'sk', 'signee')`); } catch { blocked = true; }
await db.exec('reset role');
ok('RLS : on ne voit que sa collection', seen.length === 1 && seen[0].user_id === uid(3), seen);
ok('RLS : impossible de s’ajouter une variante', blocked);
/* ---------- 4. Atelier (D15) : fabrication et recyclage ---------- */
const F = uid(12);
// F possède toutes les Holo sauf celles de rosie et de kraken
await db.exec(`insert into user_card_variants (user_id, card_id, variant, source) select '${F}', card_id, 'holo', 'test' from card_catalog where card_id not in ('rosie', 'kraken');
  insert into user_wallet (user_id, shards) values ('${F}', 2000)`);
const r1 = await rpc('collection_craft', { p_user: F, p_mode: 'random', p_tier: 'r', p_seed: 5 });
const r2 = await rpc('collection_craft', { p_user: F, p_mode: 'random', p_tier: 'r', p_seed: 5 });
ok('au hasard : seulement des variantes manquantes', r1.ok && r2.ok && new Set([r1.card_id, r2.card_id]).size === 2 && [r1.card_id, r2.card_id].every((c: string) => c === 'rosie' || c === 'kraken'), [r1, r2]);
ok('au hasard : prix de base (Holo 80)', r1.cost === 80 && r2.shards === 2000 - 160, r2);
const r3 = await rpc('collection_craft', { p_user: F, p_mode: 'random', p_tier: 'r', p_seed: 5 });
ok('au hasard : refusé quand tout est possédé', !!r3?.error && /déjà à vous/.test(r3.error), r3);
const p1 = await rpc('collection_craft', { p_user: F, p_mode: 'pick', p_card: 'sk', p_variant: 'vivante' });
ok('au choix : 4 × le prix de base (Épique 960)', p1.ok && p1.cost === 960 && p1.shards === 2000 - 160 - 960, p1);
ok('au choix : solde trop bas → refus', /manque/.test((await rpc('collection_craft', { p_user: F, p_mode: 'pick', p_card: 'sk', p_variant: 'signee' }))?.error ?? ''));
ok('au choix : refusé si déjà possédée', !!(await rpc('collection_craft', { p_user: F, p_mode: 'pick', p_card: 'g1', p_variant: 'holo' }))?.error);
ok('au choix : Numérotée refusée', /Numérotées/.test((await rpc('collection_craft', { p_user: F, p_mode: 'pick', p_card: 'sk', p_variant: 'numero' }))?.error ?? ''));
ok('au hasard : Numérotée refusée', !!(await rpc('collection_craft', { p_user: F, p_mode: 'random', p_tier: 'm' }))?.error);
// solde jamais négatif sous concurrence : 30 éclats, deux Communes au hasard (20 chacune) lancées ensemble
await db.exec(`update user_wallet set shards = 30 where user_id = '${F}'`);
const both = await Promise.all([rpc('collection_craft', { p_user: F, p_mode: 'random', p_tier: 'c', p_seed: 1 }), rpc('collection_craft', { p_user: F, p_mode: 'random', p_tier: 'c', p_seed: 2 })]);
const left = (await wallet(F)).shards;
ok('concurrence : une seule fabrication passe, solde jamais négatif', both.filter(b => b.ok).length === 1 && both.filter(b => b.error).length === 1 && left === 10, { both, left });
// recyclage : on garde 1 exemplaire
await db.exec(`update user_card_variants set copies = 3 where user_id = '${F}' and card_id = 'g2' and variant = 'holo';
  insert into user_card_variants (user_id, card_id, variant, copies, source) values ('${F}', 'g2', 'nacre', 2, 'test')`);
const one = await rpc('collection_recycle', { p_user: F, p_all: false, p_card: 'g2', p_variant: 'holo' });
ok('recycler une variante : 2 doublons Holo = 40 éclats', one.ok && one.recycled === 2 && one.shards_gained === 40, one);
const all = await rpc('collection_recycle', { p_user: F, p_all: true });
ok('tout recycler : le doublon Nacre = 60 éclats, 1 exemplaire gardé', all.ok && all.shards_gained === 60 && (await db.query<any>(`select max(copies) as m from user_card_variants where user_id = '${F}'`)).rows[0].m === 1, all);
ok('plus rien à recycler', !!(await rpc('collection_recycle', { p_user: F, p_all: true }))?.error);
ok('journal des éclats de l’Atelier', (await db.query<any>(`select count(*)::int as n from shard_events where user_id = '${F}' and reason in ('craft_random', 'craft_pick', 'recycle')`)).rows[0].n >= 6);

console.log(`Collection : ${passes} vérifications réussies, ${fails} échec(s).`);
if (fails) process.exit(1);
