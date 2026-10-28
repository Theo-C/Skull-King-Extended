// Banc d'essai des écrans de la collection : faux serveur en mémoire qui suit les règles de booster_apply,
// collection_choose et collection_craft / collection_recycle (supabase/migrations/), pour les captures Playwright.
import '../src/game.css';
import '../src/app.css';
import { installVariantFx } from '../src/variantFx';
import { collectionPage } from '../src/pages/collection';
import { boosterPage } from '../src/booster';
import { atelierPage } from '../src/pages/atelier';
import * as C from '@shared/collection.ts';

const q = new URLSearchParams(location.search), force = q.get('force');
const R = C.rng(Number(q.get('graine') ?? 7));
// une collection de départ crédible : environ un tiers des communes, quelques Holo et Épiques, une Signée
const owned = new Map<string, { card_id: string; variant: C.Variant; copies: number; serial: number | null }>();
for (const c of C.CARDS) for (const v of C.COLLECTIBLE) {
  const p = { patine: .4, etain: .35, holo: .22, vivante: .06, nacre: .07, signee: c.id === 'rosie' ? 1 : .01, numero: 0, std: 0 }[v];
  if (R() < p) owned.set(c.id + ':' + v, { card_id: c.id, variant: v, copies: 1 + (R() < .3 ? Math.floor(R() * 3) : 0), serial: null });
}
const st = { coins: 1240, shards: 1180, boosters: 2, choices: { rosie: 'signee', kraken: 'holo', g12: 'patine' } as Record<string, C.Variant> };
const total = C.COLLECTION_SIZE;
let serial = 41;

function open(pack: string) {
  if (st.boosters > 0) st.boosters--; else if (st.coins >= 50) st.coins -= 50; else throw new Error('Il vous manque des pièces.');
  const d = C.drawBooster(pack, R);
  if (force === 'divin') { d.divine = true; d.cards.forEach((c, i) => c.variant = i === 2 ? 'numero' : 'signee'); }
  else if (force === 'signee' || force === 'numero' || force === 'epique') d.cards[4].variant = force === 'epique' ? 'vivante' : force;
  let gained = 0, fresh = 0;
  const before = owned.size;
  const cards = d.cards.map(c => {
    const k = c.card_id + ':' + c.variant, dup = owned.has(k), s = c.variant === 'numero' ? ++serial : null, shards = dup ? C.recycleValue(c.variant) : 0;
    if (!dup) { owned.set(k, { card_id: c.card_id, variant: c.variant, copies: 1, serial: s }); fresh++; }
    gained += shards;
    return { ...c, serial: s, duplicate: dup, shards };
  });
  st.shards += gained;
  return { ok: true, pack, divine: d.divine, cards, paid: 'coins', shards_gained: gained, new: fresh, owned: owned.size, owned_before: before, total, coins: st.coins, boosters: st.boosters, shards: st.shards };
}
const state = () => ({ owned: [...owned.values()], choices: st.choices, total, coins: st.coins, shards: st.shards, boosters: st.boosters, free_today: false, free_daily: true });

/** Faux callGame : mêmes actions et mêmes réponses que supabase/functions/_shared/service.ts. */
export async function fakeApi<T = any>(action: string, p: Record<string, any> = {}): Promise<T> {
  await new Promise(r => setTimeout(r, 120));
  switch (action) {
    case 'collection.list': return state() as T;
    case 'booster.open': return open(p.pack) as T;
    case 'collection.choose':
      if (p.variant !== 'std' && !owned.has(p.cardId + ':' + p.variant)) throw new Error('Vous ne possédez pas cette variante.');
      if (p.variant === 'std') delete st.choices[p.cardId]; else st.choices[p.cardId] = p.variant;
      return { ok: true } as T;
    case 'collection.craft': {
      if (p.mode === 'random') {
        const vs = C.VARIANTS_OF[p.tier as 'c' | 'r' | 'e' | 'l'], miss = C.CARDS.flatMap(c => vs.filter(v => !owned.has(c.id + ':' + v)).map(v => ({ card_id: c.id, variant: v })));
        const cost = C.SHARDS.random[p.tier as 'c'];
        if (!miss.length) throw new Error('Toutes les variantes de cette rareté sont à vous.');
        if (st.shards < cost) throw new Error('Il vous manque des éclats.');
        const m = miss[Math.floor(R() * miss.length)]; st.shards -= cost; owned.set(m.card_id + ':' + m.variant, { ...m, copies: 1, serial: null });
        return { ok: true, ...m, cost, shards: st.shards } as T;
      }
      const cost = C.pickCost(p.variant);
      if (p.variant === 'numero') throw new Error('Les Numérotées ne se fabriquent pas.');
      if (owned.has(p.cardId + ':' + p.variant)) throw new Error('Déjà dans votre collection.');
      if (st.shards < cost) throw new Error('Il vous manque des éclats.');
      st.shards -= cost; owned.set(p.cardId + ':' + p.variant, { card_id: p.cardId, variant: p.variant, copies: 1, serial: null });
      return { ok: true, card_id: p.cardId, variant: p.variant, cost, shards: st.shards } as T;
    }
    case 'collection.recycle': {
      let gained = 0, n = 0;
      for (const o of owned.values()) if (o.copies > 1 && o.variant !== 'numero' && (p.all || (o.card_id === p.cardId && o.variant === p.variant))) { gained += (o.copies - 1) * C.recycleValue(o.variant); n += o.copies - 1; o.copies = 1; }
      st.shards += gained;
      return { ok: true, recycled: n, shards_gained: gained, shards: st.shards } as T;
    }
  }
  throw new Error('Action inconnue : ' + action);
}

installVariantFx();
const view = document.getElementById('view')!, ecran = q.get('ecran') ?? 'collection';
const ready = ecran === 'boosters' ? boosterPage(view, q, fakeApi) : ecran === 'atelier' ? atelierPage(view, q, fakeApi) : collectionPage(view, q, fakeApi);
(window as any).banc = { ready, fakeApi };
