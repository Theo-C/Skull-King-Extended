// Garde-robe : catalogue des objets, tirage des coffres, échoppe du jour et validation d'un « look » (docs/ecrans-compte/SPEC.md,
// « Avatar composé et garde-robe » et « Ouverture de coffre »). Partagé par le serveur et le site ; le catalogue est recopié
// dans la migration 20261005000000_wardrobe.sql (tests/sql.test.ts vérifie qu'ils concordent).

export type Slot = 'hat' | 'face' | 'neck' | 'pet' | 'bg' | 'frame';
export type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire';
/** free : possédé par tous · chest : coffres et échoppe · title : passage d'un titre (et coffres) · achievement : haut fait (unique) · top3 : classement du mois */
export type Source = 'free' | 'chest' | 'title' | 'achievement' | 'top3';
export interface Cosmetic {
  id: string; slot: Slot; value: string; name: string; rarity: Rarity; source: Source;
  variants?: { key: 'htc' | 'nkc' | 'ptc'; colors: string[] };
  level?: number; achievement?: string;
}

export const SLOTS: Slot[] = ['hat', 'face', 'neck', 'pet', 'bg', 'frame'];
export const RARITY: Record<Rarity, { name: string; color: string; weight: number; dup: number; stars: number }> = {
  commun: { name: 'Commun', color: '#d6dde4', weight: 62, dup: 30, stars: 1 },
  rare: { name: 'Rare', color: '#4fa8ff', weight: 26, dup: 80, stars: 2 },
  epique: { name: 'Épique', color: '#c27dff', weight: 9, dup: 140, stars: 3 },
  legendaire: { name: 'Légendaire', color: '#ffc94a', weight: 3, dup: 200, stars: 4 },
};
export const RARITIES: Rarity[] = ['commun', 'rare', 'epique', 'legendaire'];
export const SHOP_PRICE: Partial<Record<Rarity, number>> = { commun: 60, rare: 150 };
/** Pièces gagnées en fin de partie en ligne. */
export const COINS = { game: 10, bid: 5 } as const;

const c = (slot: Slot, value: string, name: string, rarity: Rarity, source: Source, extra: Partial<Cosmetic> = {}): Cosmetic =>
  ({ id: `${slot}:${value}`, slot, value, name, rarity, source, ...extra });
export const CATALOG: Cosmetic[] = [
  c('hat', 'bandana', 'Bandana', 'commun', 'chest', { variants: { key: 'htc', colors: ['#9e2a22', '#2f5f8a', '#3e8e4e', '#5b3a7a'] } }),
  c('hat', 'tricorne', 'Tricorne', 'commun', 'title', { level: 5, variants: { key: 'htc', colors: ['#1d1814', '#3a2a1c', '#2a3142'] } }),
  c('hat', 'foulard', 'Foulard noué', 'commun', 'chest', { variants: { key: 'htc', colors: ['#5b3a7a', '#9e2a22', '#c9a14a'] } }),
  c('hat', 'plume', 'Chapeau à plume', 'epique', 'title', { level: 11 }),
  c('hat', 'bicorne', 'Bicorne', 'rare', 'title', { level: 16 }),
  c('hat', 'amiral', "Chapeau d'amiral", 'legendaire', 'title', { level: 25 }),
  c('hat', 'couronne', 'Couronne', 'legendaire', 'achievement', { achievement: 'captain' }),
  c('face', 'cicatrice', 'Cicatrice', 'commun', 'chest'),
  c('face', 'lunettes', 'Lunettes rondes', 'commun', 'chest'),
  c('face', 'khol', 'Khôl', 'commun', 'chest'),
  c('face', 'patch', 'Cache-œil', 'rare', 'chest'),
  c('face', 'monocle', "Monocle de l'armateur", 'rare', 'chest'),
  c('neck', 'foulard', 'Foulard', 'commun', 'chest', { variants: { key: 'nkc', colors: ['#9e2a22', '#2f5f8a', '#c9a14a'] } }),
  c('neck', 'jabot', 'Jabot de dentelle', 'rare', 'chest'),
  c('neck', 'perles', 'Perles des sirènes', 'epique', 'achievement', { achievement: 'siren_hunter' }),
  c('neck', 'medaillon', "Médaillon d'or", 'legendaire', 'achievement', { achievement: 'silk_thread' }),
  c('pet', 'mouette', 'Mouette', 'commun', 'chest'),
  c('pet', 'perroquet', 'Perroquet', 'rare', 'chest', { variants: { key: 'ptc', colors: ['#3e8e4e', '#c0392b', '#2f6fb0'] } }),
  c('pet', 'singe', 'Singe', 'rare', 'chest'),
  c('pet', 'poulpe', 'Poulpe', 'legendaire', 'achievement', { achievement: 'abyss' }),
  c('bg', 'mer', 'Haute mer', 'commun', 'free'),
  c('bg', 'nuit', 'Nuit étoilée', 'commun', 'chest'),
  c('bg', 'taverne', 'Taverne', 'commun', 'chest'),
  c('bg', 'couchant', 'Couchant', 'epique', 'chest'),
  c('bg', 'tempete', 'Tempête', 'rare', 'chest'),
  c('bg', 'or', 'Salle au trésor', 'legendaire', 'title', { level: 30 }),
  c('frame', 'corde', 'Corde', 'commun', 'chest'),
  c('frame', 'tentacules', 'Tentacules', 'legendaire', 'achievement', { achievement: 'kraken_bet' }),
  c('frame', 'or', "Cadre d'or", 'legendaire', 'top3'),
];
export const BY_ID: Record<string, Cosmetic> = Object.fromEntries(CATALOG.map(x => [x.id, x]));
/** Objets qui peuvent sortir d'un coffre : tout sauf la base gratuite, les objets de haut fait (uniques) et le cadre du top 3. */
export const chestPool = (r: Rarity) => CATALOG.filter(x => x.rarity === r && (x.source === 'chest' || x.source === 'title'));
/** Comment obtenir un objet (affiché sous un objet verrouillé). */
export function howTo(x: Cosmetic, titleAt: (level: number) => string): string {
  if (x.source === 'title') return `Niveau ${x.level} · ${titleAt(x.level!)} (ou coffre)`;
  if (x.source === 'achievement') return `Haut fait : ${ACH_LABEL[x.achievement!] ?? x.achievement}`;
  if (x.source === 'top3') return 'Top 3 du classement du mois';
  if (x.source === 'free') return '';
  return SHOP_PRICE[x.rarity] ? 'Coffre de victoire ou échoppe' : 'Coffre de victoire';
}
const ACH_LABEL: Record<string, string> = { captain: '10 victoires', siren_hunter: 'Chasseur de sirènes', silk_thread: 'Fil-de-Soie', abyss: 'Fosse insondable', kraken_bet: 'Pari du Kraken' };

/* ---------- Tirage ---------- */
/** Générateur pseudo-aléatoire à graine (mulberry32), pour des tirages reproductibles dans les tests. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Rareté d'un coffre : 62 / 26 / 9 / 3 %. */
export function drawRarity(rand: () => number): Rarity {
  let x = rand() * 100;
  for (const r of RARITIES) { x -= RARITY[r].weight; if (x < 0) return r; }
  return 'commun';
}
/** Objet tiré dans la rareté (index dans la liste triée par identifiant, comme la fonction SQL chest_open). */
export function drawItem(r: Rarity, rand: () => number): Cosmetic {
  const pool = chestPool(r).sort((a, b) => a.id < b.id ? -1 : 1);
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

/* ---------- Échoppe : 3 objets communs ou rares par jour, choisis à partir de la date ---------- */
export function shopFor(day: string): Cosmetic[] {
  let h = 2166136261; for (const ch of day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rand = seeded(h), pool = CATALOG.filter(x => SHOP_PRICE[x.rarity] && (x.source === 'chest' || x.source === 'title')).sort((a, b) => a.id < b.id ? -1 : 1);
  const out: Cosmetic[] = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
/** Jour de l'échoppe (heure de Paris). */
export const shopDay = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

/* ---------- Look ---------- */
export interface Look {
  skin: number; hair: string; hc: number; beard: string;
  hat?: string | null; htc?: string | null; face?: string | null; neck?: string | null; nkc?: string | null;
  pet?: string | null; ptc?: string | null; bg?: string | null; frame?: string | null;
}
export const HAIRS = ['court', 'meche', 'long', 'boucles', 'chignon', 'tresse', 'queue', 'none'];
export const BEARDS = ['none', 'mous', 'short', 'long'];
export const DEFAULT_LOOK: Look = { skin: 1, hair: 'court', hc: 1, beard: 'none', hat: null, face: null, neck: null, pet: null, bg: 'mer', frame: null };
/** Objets possédés par tous. */
export const FREE = CATALOG.filter(x => x.source === 'free').map(x => x.id);
/** Vérifie un look : base valide, et uniquement des objets possédés (avec une couleur prévue pour l'objet). Renvoie le look nettoyé ou une erreur. */
export function checkLook(raw: any, owned: Set<string>): { look?: Look; error?: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Apparence invalide.' };
  const int = (v: any, max: number) => Number.isInteger(v) && v >= 0 && v <= max;
  if (!int(raw.skin, 5) || !int(raw.hc, 5)) return { error: 'Teint ou couleur de cheveux invalide.' };
  if (!HAIRS.includes(raw.hair) || !BEARDS.includes(raw.beard)) return { error: 'Coiffure ou pilosité invalide.' };
  const look: Look = { skin: raw.skin, hair: raw.hair, hc: raw.hc, beard: raw.beard };
  for (const s of SLOTS) {
    const v = raw[s]; if (v == null || v === '') { (look as any)[s] = null; continue; }
    const item = BY_ID[`${s}:${v}`];
    if (!item) return { error: 'Objet inconnu.' };
    if (item.source !== 'free' && !owned.has(item.id)) return { error: `Vous ne possédez pas : ${item.name}.` };
    (look as any)[s] = v;
    if (item.variants) {
      const col = raw[item.variants.key];
      (look as any)[item.variants.key] = item.variants.colors.includes(col) ? col : item.variants.colors[0];
    }
  }
  return { look };
}
