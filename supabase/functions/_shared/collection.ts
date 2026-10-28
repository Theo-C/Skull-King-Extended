// Collection de cartes (docs/boosters/SPEC.md) : variantes visuelles, boosters et Atelier, partagés par le serveur et
// le site. Les variantes sont purement esthétiques : le moteur de jeu ne les connaît pas.
import { cname, SUIT_ORDER, type Card, type Suit } from './engine.ts';

/** Les 8 variantes, de la plus commune à la plus rare. Standard est possédée par tout le monde. */
export const VARIANTS = ['std', 'patine', 'etain', 'holo', 'vivante', 'nacre', 'signee', 'numero'] as const;
export type Variant = typeof VARIANTS[number];
export const isVariant = (v: unknown): v is Variant => typeof v === 'string' && (VARIANTS as readonly string[]).includes(v);
/** Variantes à collectionner (Standard est donnée à tous). */
export const COLLECTIBLE: Variant[] = VARIANTS.filter(v => v !== 'std');

/** Raretés (docs/boosters/OUVERTURE.md, « Rareté et couleurs ») ; c commune, r rare, e épique, l légendaire, m mythique. */
export type Tier = 'c' | 'r' | 'e' | 'l' | 'm';
export const TIER_OF: Record<Exclude<Variant, 'std'>, Tier> = { patine: 'c', etain: 'c', holo: 'r', vivante: 'e', nacre: 'e', signee: 'l', numero: 'm' };
export const VARIANTS_OF: Record<Exclude<Tier, 'm'>, Variant[]> = { c: ['patine', 'etain'], r: ['holo'], e: ['nacre', 'vivante'], l: ['signee'] };
export const VARIANT_INFO: Record<Variant, { name: string; official: string; tier: Tier | null; stars: string; color: string }> = {
  std: { name: 'Standard', official: 'Regular', tier: null, stars: '', color: '#8f8270' },
  patine: { name: 'Patinée', official: 'Vintage', tier: 'c', stars: '◆', color: '#c9d3dc' },
  etain: { name: 'Bord d’étain', official: 'Silver Border', tier: 'c', stars: '◆', color: '#c9d3dc' },
  holo: { name: 'Holographique', official: 'Holo', tier: 'r', stars: '◆◆', color: '#4fa8ff' },
  vivante: { name: 'Vivante', official: 'Animated', tier: 'e', stars: '◆◆◆', color: '#b77dff' },
  nacre: { name: 'Nacre', official: 'Pearl Foil', tier: 'e', stars: '◆◆◆', color: '#b77dff' },
  signee: { name: 'Signée', official: 'Signature', tier: 'l', stars: '★', color: '#ffc94a' },
  numero: { name: 'Numérotée', official: 'Serialized', tier: 'm', stars: '★★', color: '#e7c6ff' },
};
export const TIER_NAME: Record<Tier, string> = { c: 'Commune', r: 'Holographique', e: 'Épique', l: 'Signée', m: 'Numérotée' };

/** Éclats (docs/boosters/ATELIER.md) : doublon recyclé, fabrication au hasard (prix de base), au choix (×4).
 *  Les Numérotées ne se recyclent ni ne se fabriquent. */
export const SHARDS = {
  recycle: { c: 5, r: 20, e: 60, l: 200 } as Record<Exclude<Tier, 'm'>, number>,
  random: { c: 20, r: 80, e: 240, l: 800 } as Record<Exclude<Tier, 'm'>, number>,
  pickFactor: 4,
};
export const recycleValue = (v: Variant) => v === 'std' || v === 'numero' ? 0 : SHARDS.recycle[TIER_OF[v] as Exclude<Tier, 'm'>];
export const pickCost = (v: Variant) => v === 'std' || v === 'numero' ? 0 : SHARDS.random[TIER_OF[v] as Exclude<Tier, 'm'>] * SHARDS.pickFactor;

/* ---------- Catalogue : 76 cartes (56 de couleur + 20 spéciales) ---------- */
export type Family = 'pir' | 'cre' | Suit;
export interface CollCard { id: string; name: string; family: Family; card: Partial<Card> }
const LETTER: Record<Suit, string> = { yellow: 'y', green: 'g', purple: 'p', black: 'b' };
const SPECIALS: [string, Partial<Card>, Family][] = [
  ['rosie', { kind: 'pirate', pid: 'rosie' }, 'pir'], ['bahij', { kind: 'pirate', pid: 'bahij' }, 'pir'], ['rascal', { kind: 'pirate', pid: 'rascal' }, 'pir'],
  ['juanita', { kind: 'pirate', pid: 'juanita' }, 'pir'], ['harry', { kind: 'pirate', pid: 'harry' }, 'pir'], ['mary', { kind: 'pirate', pid: 'mary' }, 'pir'],
  ['con', { kind: 'con' }, 'pir'], ['tigress', { kind: 'tigress' }, 'pir'],
  ['sk', { kind: 'sk' }, 'cre'], ['mermaid0', { kind: 'mermaid', v: 0 }, 'cre'], ['mermaid1', { kind: 'mermaid', v: 1 }, 'cre'],
  ['kraken', { kind: 'kraken' }, 'cre'], ['whale', { kind: 'whale' }, 'cre'], ['escape', { kind: 'escape' }, 'cre'], ['loot', { kind: 'loot' }, 'cre'],
  ['volley', { kind: 'volley' }, 'cre'], ['stingray', { kind: 'stingray' }, 'cre'], ['plank', { kind: 'plank' }, 'cre'], ['davy', { kind: 'davy' }, 'cre'],
  ['wild', { kind: 'num', suit: 'wild' as Suit, rank: 15, wild: 1, exp: 1 }, 'cre'],
];
export const CARDS: CollCard[] = [
  ...SPECIALS.map(([id, card, family]) => ({ id, name: cname(card as Card), family, card })),
  ...(['yellow', 'green', 'purple', 'black'] as Suit[]).flatMap(suit => Array.from({ length: 14 }, (_, i) => {
    const card: Partial<Card> = { kind: 'num', suit, rank: i + 1 };
    return { id: LETTER[suit] + (i + 1), name: cname(card as Card), family: suit as Family, card };
  })),
];
export const CARD_BY_ID: Record<string, CollCard> = Object.fromEntries(CARDS.map(c => [c.id, c]));
/** Nombre de variantes à collectionner (76 × 7). */
export const COLLECTION_SIZE = CARDS.length * COLLECTIBLE.length;

/** Carte de la collection d'une carte du moteur. Les cartes de l'extension 7 (−5), 8 (+5) et 0·14 montrent la variante
 *  du 7, du 8 et du 14 de leur couleur. */
export function collId(c: Partial<Card>): string | null {
  if (c.kind === 'num') {
    if (c.wild) return 'wild';
    if (!SUIT_ORDER.includes(c.suit as Suit)) return null;
    return LETTER[c.suit as Suit] + (c.zf ? 14 : c.rank);
  }
  if (c.kind === 'pirate') return c.pid ?? null;
  if (c.kind === 'mermaid') return 'mermaid' + (c.v || 0);
  return c.kind && CARD_BY_ID[c.kind] ? c.kind : null;
}

/* ---------- Boosters (série 1 « Les Sept Mers ») ---------- */
export const BOOSTER_PRICE = 50;
export const SERIES = { id: 'S1', name: 'Les Sept Mers' } as const;
export interface Pack { id: string; name: string; featured: string[]; desc: string }
export const PACKS: Pack[] = [
  { id: 'profondeurs', name: 'Profondeurs', featured: ['kraken', 'whale', 'b14'], desc: 'Kraken, Baleine Fantôme et 14 noir trois fois plus fréquents.' },
  { id: 'sirenes', name: 'Chant des sirènes', featured: ['mermaid0', 'juanita', 'mary'], desc: 'Alyra, Juanita et Marie trois fois plus fréquentes.' },
  { id: 'couronne', name: 'Couronne du roi', featured: ['sk', 'rosie', 'rascal'], desc: 'Skull King, Rosie et Rascal trois fois plus fréquents.' },
];
export const PACK_BY_ID: Record<string, Pack> = Object.fromEntries(PACKS.map(p => [p.id, p]));
export const FEATURED_WEIGHT = 3;

/** Chances des cartes 4 et 5, en % (échelle de Pokémon TCG Pocket un peu réduite). Cartes 1 à 3 : toujours communes. */
export const ODDS: { tier: 'r' | 'e' | 'l' | 'm'; label: string; slot4: number; slot5: number }[] = [
  { tier: 'r', label: 'Holographique', slot4: 92, slot5: 66 },
  { tier: 'e', label: 'Nacre ou Vivante', slot4: 5, slot5: 21 },
  { tier: 'l', label: 'Signée', slot4: 2.3, slot5: 10 },
  { tier: 'm', label: 'Numérotée', slot4: .7, slot5: 3 },
];
/** Booster divin : 1 sur 2 000 ; ses 5 cartes sont Signées (90 %) ou Numérotées (10 %). */
export const DIVINE_ODDS = 1 / 2000, DIVINE_NUMBERED = .1;
export const NUMBERED_MAX = 100;

/** Générateur pseudo-aléatoire reproductible (mulberry32), pour les tests à graine fixe. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export interface Drawn { card_id: string; variant: Variant }
/** Tirage d'un booster : 5 cartes différentes (vedettes ×3) et leur variante par emplacement. Pas de garanties.
 *  Les Numérotées sont attribuées ensuite par la base (stock de 100 par carte et par saison, sinon Signée). */
export function drawBooster(packId: string, random: () => number): { divine: boolean; cards: Drawn[] } {
  const pack = PACK_BY_ID[packId]; if (!pack) throw new Error('Booster inconnu.');
  const divine = random() < DIVINE_ODDS;
  const tierFor = (slot: 'slot4' | 'slot5') => { let r = random() * 100; for (const o of ODDS) { r -= o[slot]; if (r < 0) return o.tier; } return 'r'; };
  const variantOf = (t: Tier): Variant => t === 'c' ? (random() < .5 ? 'patine' : 'etain') : t === 'r' ? 'holo' : t === 'e' ? (random() < .5 ? 'nacre' : 'vivante') : t === 'l' ? 'signee' : 'numero';
  const tiers: Tier[] = divine ? Array.from({ length: 5 }, () => random() < DIVINE_NUMBERED ? 'm' : 'l') : ['c', 'c', 'c', tierFor('slot4'), tierFor('slot5')];
  const left = CARDS.map(c => ({ id: c.id, w: pack.featured.includes(c.id) ? FEATURED_WEIGHT : 1 }));
  return {
    divine,
    cards: tiers.map(t => {
      const tot = left.reduce((a, c) => a + c.w, 0); let r = random() * tot, i = 0;
      for (; i < left.length - 1; i++) { r -= left[i].w; if (r < 0) break; }
      const [c] = left.splice(i, 1);
      return { card_id: c.id, variant: variantOf(t) };
    }),
  };
}
