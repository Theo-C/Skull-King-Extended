// Avatar commun (en-tête, table, listes, classement). Trois rendus :
//   - photo       : la photo recadrée dans Supabase Storage (<img>) ;
//   - art         : un des 8 pirates préréglés (compatibilité ascendante : v = 0..7) ;
//   - composé    : rendu SVG en couches à partir d'un objet `look`, décrit dans la section « Avatar composé et garde-robe »
//                   de docs/ecrans-compte/SPEC.md. Tracés repris de docs/ecrans-compte/maquettes/Avatar.dc.html.
// La valeur par défaut à la création du compte reste l'initiale sur fond de couleur.
import { esc } from './util';

export const PALETTE = ['#d9b25a', '#c8644b', '#7ab874', '#5c9db6', '#a982c4', '#e0954a', '#c9c0ae', '#d77fa1'];
export const ART_NAMES = ['Tricorne', 'Bandana', 'Chapeau à plume', 'Bicorne', 'Bandana et bandeau', 'Couronne', 'Cheveux longs', 'Tricorne et perroquet'];

/** Apparence composée (profiles.look). Chaque emplacement est optionnel ; les objets qui n'appartiennent pas au joueur sont refusés
 *  côté serveur. Les couleurs de cheveux et de peau sont des entiers dans la palette, pour qu'un œil mal réglé reste cohérent. */
export interface Look {
  skin?: number;        // 0 à 5
  hair?: 'court' | 'meche' | 'long' | 'boucles' | 'chignon' | 'tresse' | 'queue' | 'none' | string;
  hc?: number | string; // index 0..5 ou hex direct
  beard?: 'none' | 'mous' | 'short' | 'long' | string;
  hat?: string | null;
  htc?: string;
  face?: string | null;
  neck?: string | null;
  nkc?: string;
  pet?: string | null;
  ptc?: string;
  bg?: string;
  frame?: string | null;
}

export interface AvatarData { kind?: 'initial' | 'art' | 'photo' | string | null; art?: number | null; url?: string | null; letter?: string; color?: string | null; look?: Look | null }

/** Catalogue d'objets (aligné sur public.cosmetics / maquettes/Profil.dc.html).
 *  id = `slot:value`. default_owned = libre pour tout le monde. how = source d'obtention.
 *  5 niveaux de rareté : c (Commun) · r (Rare) · e (Épique) · l (Légendaire) · m (Mythique : cartes animées). */
export type Rar = 'c' | 'r' | 'e' | 'l' | 'm';
export const CATALOG = (() => {
  interface Item { id: string; slot: string; value: string | null; name: string; rarity: Rar; defaultOwned: boolean; how: string | null; variantKey?: 'htc' | 'nkc' | 'ptc'; variants?: string[] }
  const C: Item[] = [
    { id: 'hat:none', slot: 'hat', value: null, name: 'Tête nue', rarity: 'c', defaultOwned: true, how: null },
    { id: 'hat:bandana', slot: 'hat', value: 'bandana', name: 'Bandana', rarity: 'c', defaultOwned: true, how: null, variantKey: 'htc', variants: ['#9e2a22', '#2f5f8a', '#3e8e4e'] },
    { id: 'hat:bandana-violet', slot: 'hat', value: 'bandana', name: 'Bandana violet', rarity: 'c', defaultOwned: false, how: 'shop', variantKey: 'htc', variants: ['#5b3a7a'] },
    { id: 'hat:foulard', slot: 'hat', value: 'foulard', name: 'Foulard noué', rarity: 'c', defaultOwned: true, how: null, variantKey: 'htc', variants: ['#5b3a7a', '#9e2a22', '#c9a14a'] },
    { id: 'hat:tricorne', slot: 'hat', value: 'tricorne', name: 'Tricorne', rarity: 'c', defaultOwned: false, how: 'title:5', variantKey: 'htc', variants: ['#1d1814', '#3a2a1c', '#2a3142'] },
    { id: 'hat:plume', slot: 'hat', value: 'plume', name: 'Chapeau à plume', rarity: 'r', defaultOwned: false, how: 'title:11' },
    { id: 'hat:bicorne', slot: 'hat', value: 'bicorne', name: 'Bicorne', rarity: 'r', defaultOwned: false, how: 'title:16' },
    { id: 'hat:amiral', slot: 'hat', value: 'amiral', name: 'Chapeau d\'amiral', rarity: 'l', defaultOwned: false, how: 'title:25' },
    { id: 'hat:couronne', slot: 'hat', value: 'couronne', name: 'Couronne', rarity: 'l', defaultOwned: false, how: 'achievement:captain' },

    { id: 'face:none', slot: 'face', value: null, name: 'Rien', rarity: 'c', defaultOwned: true, how: null },
    { id: 'face:cicatrice', slot: 'face', value: 'cicatrice', name: 'Cicatrice', rarity: 'c', defaultOwned: true, how: null },
    { id: 'face:lunettes', slot: 'face', value: 'lunettes', name: 'Lunettes rondes', rarity: 'c', defaultOwned: true, how: null },
    { id: 'face:khol', slot: 'face', value: 'khol', name: 'Khôl', rarity: 'c', defaultOwned: true, how: null },
    { id: 'face:patch', slot: 'face', value: 'patch', name: 'Cache-œil', rarity: 'r', defaultOwned: false, how: 'chest' },
    { id: 'face:monocle', slot: 'face', value: 'monocle', name: 'Monocle de l\'armateur', rarity: 'r', defaultOwned: false, how: 'chest' },

    { id: 'neck:none', slot: 'neck', value: null, name: 'Rien', rarity: 'c', defaultOwned: true, how: null },
    { id: 'neck:foulard', slot: 'neck', value: 'foulard', name: 'Foulard', rarity: 'c', defaultOwned: true, how: null, variantKey: 'nkc', variants: ['#9e2a22', '#2f5f8a', '#c9a14a'] },
    { id: 'neck:jabot', slot: 'neck', value: 'jabot', name: 'Jabot de dentelle', rarity: 'e', defaultOwned: false, how: 'chest' },
    { id: 'neck:perles', slot: 'neck', value: 'perles', name: 'Collier de perles', rarity: 'e', defaultOwned: false, how: 'achievement:siren_hunter' },
    { id: 'neck:medaillon', slot: 'neck', value: 'medaillon', name: 'Médaillon d\'or', rarity: 'l', defaultOwned: false, how: 'achievement:silk_thread' },

    { id: 'pet:none', slot: 'pet', value: null, name: 'Personne', rarity: 'c', defaultOwned: true, how: null },
    { id: 'pet:mouette', slot: 'pet', value: 'mouette', name: 'Mouette', rarity: 'c', defaultOwned: false, how: 'chest' },
    { id: 'pet:perroquet', slot: 'pet', value: 'perroquet', name: 'Perroquet', rarity: 'r', defaultOwned: false, how: 'chest', variantKey: 'ptc', variants: ['#3e8e4e', '#c0392b', '#2f6fb0'] },
    { id: 'pet:singe', slot: 'pet', value: 'singe', name: 'Singe', rarity: 'r', defaultOwned: false, how: 'shop' },
    { id: 'pet:poulpe', slot: 'pet', value: 'poulpe', name: 'Poulpe', rarity: 'l', defaultOwned: false, how: 'achievement:abyss' },

    { id: 'bg:mer', slot: 'bg', value: 'mer', name: 'Haute mer', rarity: 'c', defaultOwned: true, how: null },
    { id: 'bg:nuit', slot: 'bg', value: 'nuit', name: 'Nuit étoilée', rarity: 'c', defaultOwned: true, how: null },
    { id: 'bg:taverne', slot: 'bg', value: 'taverne', name: 'Taverne', rarity: 'c', defaultOwned: false, how: 'chest' },
    { id: 'bg:couchant', slot: 'bg', value: 'couchant', name: 'Couchant', rarity: 'r', defaultOwned: false, how: 'chest' },
    { id: 'bg:tempete', slot: 'bg', value: 'tempete', name: 'Tempête', rarity: 'r', defaultOwned: false, how: 'shop' },
    { id: 'bg:or', slot: 'bg', value: 'or', name: 'Salle au trésor', rarity: 'l', defaultOwned: false, how: 'title:30' },

    { id: 'frame:none', slot: 'frame', value: null, name: 'Sans cadre', rarity: 'c', defaultOwned: true, how: null },
    { id: 'frame:corde', slot: 'frame', value: 'corde', name: 'Corde', rarity: 'c', defaultOwned: true, how: null },
    { id: 'frame:tentacules', slot: 'frame', value: 'tentacules', name: 'Tentacules', rarity: 'l', defaultOwned: false, how: 'achievement:kraken_bet' },
    { id: 'frame:or', slot: 'frame', value: 'or', name: 'Cadre d\'or', rarity: 'l', defaultOwned: false, how: 'leaderboard:top3-month' },

    // cartes animées (docs/cartes-animees/SPEC.md) : value = fichier dans web/public/cards/anim/ ; posséder suffit
    { id: 'carte:kraken', slot: 'carte', value: 'kraken', name: 'Le Kraken', rarity: 'm', defaultOwned: false, how: 'chest' },
    { id: 'carte:sk', slot: 'carte', value: 'sk', name: 'Skull King', rarity: 'm', defaultOwned: false, how: 'chest' },
    { id: 'carte:raie', slot: 'carte', value: 'raie', name: 'La Raie Étoilée', rarity: 'm', defaultOwned: false, how: 'chest' },
    { id: 'carte:baleine', slot: 'carte', value: 'baleine', name: 'La Baleine Fantôme', rarity: 'm', defaultOwned: false, how: 'chest' },
    { id: 'carte:sirene', slot: 'carte', value: 'sirene', name: 'Alyra', rarity: 'm', defaultOwned: false, how: 'chest' },
    { id: 'carte:fosse', slot: 'carte', value: 'fosse', name: 'La Fosse des Noyés', rarity: 'm', defaultOwned: false, how: 'chest' },
  ];
  const bySlot: Record<string, Item[]> = {};
  for (const it of C) (bySlot[it.slot] ||= []).push(it);
  const byId: Record<string, Item> = {}; for (const it of C) byId[it.id] = it;
  return { all: C, bySlot, byId };
})();
export type CosmeticItem = typeof CATALOG['all'][number];

/** Apparence avec un objet porté : son emplacement, et sa couleur ramenée à sa première variante
 *  (sinon la couleur de l'objet précédent resterait, et le serveur la refuserait). */
export function withItem(look: Look, cosmeticId: string): Look {
  const it = CATALOG.byId[cosmeticId]; if (!it) return look;
  const out: Look = { ...look, [it.slot]: it.value };
  if (it.variantKey && it.variants?.length) (out as any)[it.variantKey] = it.variants[0];
  return out;
}

/** Tableau des id de cosmétiques possédés par défaut (libres pour tout le monde). */
export const defaultOwned = (): string[] => CATALOG.all.filter(c => c.defaultOwned).map(c => c.id);

const SK: readonly [string, string][] = [['#f3d2b3', '#d9ab88'], ['#e6b48f', '#c48e69'], ['#c98e66', '#a66f4b'], ['#a56a45', '#83512f'], ['#7a4a2c', '#5e371f'], ['#5a3420', '#43261a']];
const HAIR_C = ['#1d1510', '#4a2c1a', '#8a5a2b', '#c9a14a', '#a33a26', '#d8d2c4'];
const BG_DEFS: Record<string, { c1: string; c2: string; c3?: string; waves?: boolean; stars?: boolean; sun?: boolean; bolt?: boolean; lamp?: boolean }> = {
  mer: { c1: '#16434a', c2: '#2a6f73', c3: '#0f3238', waves: true },
  nuit: { c1: '#0f1830', c2: '#1d2b52', stars: true },
  couchant: { c1: '#5a2a4a', c2: '#c0613e', sun: true },
  tempete: { c1: '#2a2f36', c2: '#4c5560', bolt: true },
  taverne: { c1: '#3a2416', c2: '#6b4226', lamp: true },
  or: { c1: '#6b4c14', c2: '#c9a14a' },
};

/** SVG composé en couches à partir d'un `look` (section « Avatar composé et garde-robe » de SPEC.md).
 *  La `color` est aussi la couleur du manteau (= couleur du joueur à la table).
 *  Décor → cheveux arrière → buste → cou → tête → yeux et bouche → pilosité → cheveux avant → accessoire visage → cou → chapeau → compagnon → cadre. */
export function avatarSVG(look: Look | null | undefined, color: string, size: number): string {
  const L = look || {};
  const sk = SK[typeof L.skin === 'number' && L.skin >= 0 && L.skin < SK.length ? L.skin : 1];
  const hc = typeof L.hc === 'number' ? (HAIR_C[L.hc] ?? HAIR_C[0]) : (typeof L.hc === 'string' ? L.hc : HAIR_C[0]);
  const bg = { c3: '#000', waves: false, stars: false, sun: false, bolt: false, lamp: false, ...(BG_DEFS[L.bg || 'mer'] || BG_DEFS.mer) };
  const hair = L.hair || 'court', beard = L.beard || 'none';
  const hat = L.hat || null, htc = L.htc || '#1d1814';
  const face = L.face || null, neck = L.neck || null, nkc = L.nkc || '#9e2a22';
  const pet = L.pet || null, ptc = L.ptc || '#3e8e4e', frame = L.frame || null;

  // Décor
  let s = `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="display:block;width:100%;height:100%" aria-hidden="true">`;
  s += `<rect width="100" height="100" fill="${bg.c1}"/><circle cx="50" cy="38" r="46" fill="${bg.c2}" opacity=".85"/>`;
  if (bg.stars) s += '<circle cx="20" cy="22" r="1.1" fill="#f3e8cf"/><circle cx="78" cy="16" r="1.4" fill="#f3e8cf"/><circle cx="86" cy="38" r=".9" fill="#f3e8cf"/><circle cx="14" cy="44" r=".8" fill="#f3e8cf"/><path d="M74 26a6 6 0 1 0 6 -7a5 5 0 1 1 -6 7z" fill="#f3e8cf" opacity=".8"/>';
  if (bg.waves) s += `<path d="M0 74c8-4 14-4 22 0s14 4 22 0 14-4 22 0 14 4 22 0 8-2 12 0V100H0z" fill="${bg.c3}" opacity=".7"/>`;
  if (bg.sun) s += '<circle cx="50" cy="70" r="26" fill="#f0a35b" opacity=".55"/>';
  if (bg.bolt) s += '<path d="M80 8l-8 18h6l-6 16 14-22h-7l6-12z" fill="#f6e3a8" opacity=".75"/>';
  if (bg.lamp) s += '<circle cx="18" cy="26" r="12" fill="#f0b45b" opacity=".35"/><circle cx="18" cy="26" r="4" fill="#f6d58a"/>';

  // Groupe principal : pirate ré-échelonné à 1.13 pour remplir le médaillon
  s += '<g transform="translate(50 64) scale(1.13) translate(-50 -64)">';
  // Cheveux arrière (long, queue)
  if (hair === 'long') s += `<path d="M33 44c-4 18-4 34 3 46h28c7-12 7-28 3-46z" fill="${hc}"/>`;
  if (hair === 'queue') s += `<path d="M60 40c10 6 12 22 6 36-2-12-6-22-10-28z" fill="${hc}"/>`;
  // Buste (manteau = couleur du joueur) + col + chemise
  s += `<path d="M12 104c2-22 18-32 38-32s36 10 38 32z" fill="${color}"/>`;
  s += '<path d="M12 104c2-22 18-32 38-32s36 10 38 32z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/>';
  s += '<path d="M42 73l8 20 8-20z" fill="#efe3c8"/>';
  // Cou
  s += `<path d="M44 59h12v15c-4 3-8 3-12 0z" fill="${sk[1]}"/>`;
  // Oreilles
  s += `<circle cx="35" cy="50" r="3.6" fill="${sk[0]}"/><circle cx="65" cy="50" r="3.6" fill="${sk[0]}"/>`;
  // Tête
  s += `<ellipse cx="50" cy="48" rx="15" ry="17.5" fill="${sk[0]}"/>`;
  // Blush
  s += '<ellipse cx="43" cy="54" rx="2.6" ry="1.6" fill="#d9776a" opacity=".25"/><ellipse cx="57" cy="54" rx="2.6" ry="1.6" fill="#d9776a" opacity=".25"/>';
  // Yeux
  s += '<ellipse cx="44.5" cy="49" rx="1.6" ry="2" fill="#24170f"/><ellipse cx="55.5" cy="49" rx="1.6" ry="2" fill="#24170f"/>';
  // Sourcils
  s += `<path d="M41 45c2.2-1.6 4.8-1.6 7 0M52 45c2.2-1.6 4.8-1.6 7 0" fill="none" stroke="${hc}" stroke-width="1.6" stroke-linecap="round"/>`;
  // Nez
  s += `<path d="M50 50.5c-1.4 3-1 4.6.8 5" fill="none" stroke="${sk[1]}" stroke-width="1.2" stroke-linecap="round"/>`;
  // Bouche
  s += '<path d="M46.5 58.5c2.4 2 4.6 2 7 0" fill="none" stroke="#7a3b2c" stroke-width="1.4" stroke-linecap="round"/>';
  // Pilosité
  if (beard === 'short') s += `<path d="M35.5 50c0 12 7 17.5 14.5 17.5S64.5 62 64.5 50c-2 8-7 11-14.5 11S37.5 58 35.5 50z" fill="${hc}"/>`;
  if (beard === 'long') s += `<path d="M35.5 50c0 16 7 28 14.5 30 7.5-2 14.5-14 14.5-30-2 8-7 10.5-14.5 10.5S37.5 58 35.5 50z" fill="${hc}"/>`;
  if (beard === 'mous' || beard === 'short' || beard === 'long') s += `<path d="M42.5 56c3.5-2.6 6.4-1.6 7.5-.4 1.1-1.2 4-2.2 7.5.4-3.4 1.6-6 1.2-7.5.4-1.5.8-4.1 1.2-7.5-.4z" fill="${hc}"/>`;
  // Cheveux avant
  if (hair === 'court') s += `<path d="M35 46c-1-14 9-18.5 15-18.5 8 0 16 4.5 15 18.5-3-8-9-10.5-15-10s-12 2-15 10z" fill="${hc}"/>`;
  if (hair === 'meche') s += `<path d="M35 47c-2-16 12-21 22-17 7 3 9 10 8 17-4-9-11-13-18-10-5 2-9 6-12 10z" fill="${hc}"/>`;
  if (hair === 'long') s += `<path d="M35 46c-2-16 32-16 30 0l1 20c-4-6-4-16-6-24-6-5-14-5-20 0-2 8-2 18-6 24z" fill="${hc}"/>`;
  if (hair === 'boucles') s += `<circle cx="38" cy="38" r="6" fill="${hc}"/><circle cx="45" cy="32" r="6.5" fill="${hc}"/><circle cx="53" cy="31" r="6.5" fill="${hc}"/><circle cx="61" cy="35" r="6" fill="${hc}"/><circle cx="64" cy="43" r="4.5" fill="${hc}"/><circle cx="36" cy="45" r="4.5" fill="${hc}"/>`;
  if (hair === 'chignon') s += `<circle cx="50" cy="26" r="7" fill="${hc}"/><path d="M35 46c-1-14 9-18.5 15-18.5 8 0 16 4.5 15 18.5-3-8-9-10.5-15-10s-12 2-15 10z" fill="${hc}"/>`;
  if (hair === 'tresse') s += `<path d="M35 46c-1-14 9-18.5 15-18.5 8 0 16 4.5 15 18.5-3-8-9-10.5-15-10s-12 2-15 10z" fill="${hc}"/><circle cx="34" cy="56" r="3.4" fill="${hc}"/><circle cx="33" cy="63" r="3.2" fill="${hc}"/><circle cx="32.5" cy="70" r="3" fill="${hc}"/><circle cx="32.5" cy="76" r="2.4" fill="#c9a14a"/>`;
  // Accessoire de visage
  if (face === 'patch') s += '<path d="M34 41l32 11" stroke="#15110e" stroke-width="1.6"/><ellipse cx="44.5" cy="49" rx="5" ry="4.4" fill="#15110e"/>';
  if (face === 'lunettes') s += '<circle cx="44.5" cy="49" r="4.6" fill="rgba(200,230,240,.25)" stroke="#c9a14a" stroke-width="1.4"/><circle cx="55.5" cy="49" r="4.6" fill="rgba(200,230,240,.25)" stroke="#c9a14a" stroke-width="1.4"/><path d="M49.1 49h1.8M39.9 48l-4.4-1.6M60.1 48l4.4-1.6" stroke="#c9a14a" stroke-width="1.2"/>';
  if (face === 'monocle') s += '<circle cx="55.5" cy="49" r="4.8" fill="rgba(200,230,240,.25)" stroke="#e3c47a" stroke-width="1.6"/><path d="M60 52c2 8-1 14-5 18" fill="none" stroke="#e3c47a" stroke-width=".9"/>';
  if (face === 'cicatrice') s += '<path d="M57.5 42l4 13M58 46l2.5-.8M59.2 50l2.5-.8" stroke="#9b4a3c" stroke-width="1.3" stroke-linecap="round"/>';
  if (face === 'khol') s += '<path d="M41 51.5c2 1.2 5 1.2 7 0M52 51.5c2 1.2 5 1.2 7 0M40 48.5l-2-1M60 48.5l2-1" stroke="#15110e" stroke-width="1" fill="none" stroke-linecap="round"/>';
  // Cou (accessoire)
  if (neck === 'foulard') s += `<path d="M41 72c5 6 13 6 18 0l-1.5 9c-5 3-10 3-15 0z" fill="${nkc}"/><path d="M48 80l-3 9 4-2 1 3 2-10z" fill="${nkc}"/>`;
  if (neck === 'perles') s += '<circle cx="41" cy="75" r="1.5" fill="#f3efe6"/><circle cx="43.5" cy="78" r="1.5" fill="#f3efe6"/><circle cx="46.5" cy="80" r="1.5" fill="#f3efe6"/><circle cx="50" cy="80.8" r="1.6" fill="#f3efe6"/><circle cx="53.5" cy="80" r="1.5" fill="#f3efe6"/><circle cx="56.5" cy="78" r="1.5" fill="#f3efe6"/><circle cx="59" cy="75" r="1.5" fill="#f3efe6"/>';
  if (neck === 'medaillon') s += '<path d="M42 73c2 8 5 11 8 11s6-3 8-11" fill="none" stroke="#c9a14a" stroke-width=".9"/><circle cx="50" cy="86" r="4.2" fill="#e3c47a" stroke="#8a6620" stroke-width="1"/><path d="M50 83l1 2.2 2.3.3-1.7 1.5.5 2.3-2.1-1.2-2.1 1.2.5-2.3-1.7-1.5 2.3-.3z" fill="#8a6620"/>';
  if (neck === 'jabot') s += '<path d="M44 73l6 4 6-4-1 5 3 2-4 1 2 3h-12l2-3-4-1 3-2z" fill="#fbf6ea" stroke="#d9cdb6" stroke-width=".6"/>';
  // Chapeau
  if (hat === 'tricorne') s += `<path d="M36 35c2-12 26-12 28 0z" fill="${htc}"/><path d="M21 38c9-15 49-15 58 0-11 5-47 5-58 0z" fill="${htc}"/><path d="M22 38c11 4.5 45 4.5 56 0" fill="none" stroke="#c9a14a" stroke-width="2.2"/>`;
  if (hat === 'bicorne') s += `<path d="M17 39l33-18 33 18c-16 6-50 6-66 0z" fill="${htc}"/><path d="M18 39c16 5 48 5 64 0" fill="none" stroke="#c9a14a" stroke-width="2"/><circle cx="50" cy="31" r="3.6" fill="#c9a14a"/><circle cx="50" cy="31" r="1.6" fill="#9e2a22"/>`;
  if (hat === 'bandana') s += `<path d="M34.5 42c.5-16 30.5-16 31 0z" fill="${htc}"/><path d="M64 38l11 4-7 6z" fill="${htc}"/><circle cx="42" cy="34" r="1" fill="#f3e8cf" opacity=".8"/><circle cx="50" cy="31.5" r="1" fill="#f3e8cf" opacity=".8"/><circle cx="58" cy="34" r="1" fill="#f3e8cf" opacity=".8"/>`;
  if (hat === 'plume') s += `<path d="M35 40c0-14 30-14 30 0z" fill="${htc}"/><path d="M17 41c10-6 56-6 66 0-10 4.5-56 4.5-66 0z" fill="${htc}"/><path d="M35 38h30" stroke="#c9a14a" stroke-width="2"/><path d="M60 34c9-14 24-17 30-11-10 0-17 5-24 13z" fill="#e3c47a"/>`;
  if (hat === 'couronne') s += '<path d="M35 36l3-15 6 8 6-11 6 11 6-8 3 15z" fill="#e3c47a" stroke="#8a6620" stroke-width="1"/><circle cx="50" cy="31" r="1.8" fill="#9e2a22"/><circle cx="42" cy="32" r="1.3" fill="#3e6fb0"/><circle cx="58" cy="32" r="1.3" fill="#3e8e4e"/>';
  if (hat === 'foulard') s += `<path d="M33 47c-1-21 35-21 34 0-2-7-8-11-17-11s-15 4-17 11z" fill="${htc}"/><path d="M64 40c8 6 8 18 4 24-2-8-4-14-6-18z" fill="${htc}"/>`;
  if (hat === 'amiral') s += `<path d="M14 40l36-21 36 21c-18 7-54 7-72 0z" fill="${htc}"/><path d="M16 40c18 6 50 6 68 0" fill="none" stroke="#e3c47a" stroke-width="2.6"/><path d="M22 36c6-6 12-10 18-12M78 36c-6-6-12-10-18-12" stroke="#fbf6ea" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="30" r="4" fill="#e3c47a"/>`;
  // Compagnon d'épaule
  if (pet === 'perroquet') s += `<path d="M70 86c-6-12 0-22 8-20 6 2 7 10 2 16z" fill="${ptc}"/><circle cx="77" cy="64" r="5.5" fill="${ptc}"/><path d="M81.5 62.5l5 2-5 3z" fill="#e3c47a"/><circle cx="78.5" cy="63" r="1.1" fill="#15110e"/><path d="M72 86l-3 12 7-10z" fill="${ptc}"/>`;
  if (pet === 'singe') s += '<circle cx="69" cy="64" r="3" fill="#6b4226"/><circle cx="83" cy="64" r="3" fill="#6b4226"/><circle cx="76" cy="67" r="7.5" fill="#6b4226"/><ellipse cx="76" cy="69" rx="5" ry="4.2" fill="#d9a77a"/><circle cx="74" cy="66" r=".9" fill="#15110e"/><circle cx="78" cy="66" r=".9" fill="#15110e"/><path d="M70 74c-2 6 0 12 8 12s10-6 8-12z" fill="#6b4226"/>';
  if (pet === 'mouette') s += '<path d="M68 84c0-10 6-16 12-14 5 2 5 10 0 14z" fill="#f3efe6"/><circle cx="78" cy="66" r="5" fill="#f3efe6"/><path d="M82.5 66l5 1-5 2z" fill="#e3a83a"/><circle cx="79.5" cy="65" r=".9" fill="#15110e"/><path d="M66 78c6-2 10 0 12 4" fill="none" stroke="#8d99a3" stroke-width="2"/>';
  if (pet === 'poulpe') s += '<path d="M68 82c-2 6-6 8-8 14M72 84c0 6-2 10-2 14M78 84c2 6 2 10 6 14M82 82c3 4 6 6 8 12" fill="none" stroke="#8a4fb0" stroke-width="3" stroke-linecap="round"/><ellipse cx="75" cy="72" rx="9" ry="10" fill="#9b5cc4"/><circle cx="72" cy="72" r="1.6" fill="#fff"/><circle cx="78" cy="72" r="1.6" fill="#fff"/><circle cx="72.3" cy="72.3" r=".8" fill="#15110e"/><circle cx="78.3" cy="72.3" r=".8" fill="#15110e"/>';
  s += '</g>';
  // Cadre
  if (frame === 'corde') s += '<circle cx="50" cy="50" r="47" fill="none" stroke="#b08a5a" stroke-width="3.5" stroke-dasharray="4 2.2"/>';
  if (frame === 'or') s += '<circle cx="50" cy="50" r="47.5" fill="none" stroke="#e3c47a" stroke-width="3"/><circle cx="50" cy="50" r="44" fill="none" stroke="#8a6620" stroke-width="1"/>';
  if (frame === 'tentacules') s += '<circle cx="50" cy="50" r="47.5" fill="none" stroke="#6e3a8e" stroke-width="3"/><path d="M4 70c6-2 8 4 4 8M10 86c4-6 10-4 9 1M96 70c-6-2-8 4-4 8M90 86c-4-6-10-4-9 1M8 26c6 2 6 8 1 9" fill="none" stroke="#9b5cc4" stroke-width="3.2" stroke-linecap="round"/>';
  s += '</svg>';
  return s;
}

/** Préréglages des 8 pirates illustrés (compatibilité avec les comptes qui ont choisi « v = 0..7 » avant la garde-robe). */
const ART_PRESETS: Look[] = [
  { skin: 0, hair: 'long', hc: 4, beard: 'none', hat: 'tricorne', htc: '#2a3142', bg: 'nuit' },
  { skin: 3, hair: 'none', hc: 0, beard: 'mous', hat: 'bandana', htc: '#9e2a22', neck: 'perles', bg: 'mer' },
  { skin: 1, hair: 'meche', hc: 1, beard: 'short', hat: 'plume', htc: '#1d1814', neck: 'foulard', nkc: '#9e2a22', bg: 'mer', frame: 'corde' },
  { skin: 2, hair: 'court', hc: 0, beard: 'long', hat: 'bicorne', htc: '#15110e', face: 'cicatrice', bg: 'tempete' },
  { skin: 4, hair: 'court', hc: 0, beard: 'short', hat: 'bandana', htc: '#2f5f8a', face: 'patch', bg: 'mer' },
  { skin: 1, hair: 'long', hc: 5, beard: 'long', hat: 'couronne', bg: 'or', frame: 'or' },
  { skin: 5, hair: 'chignon', hc: 0, beard: 'none', face: 'lunettes', neck: 'medaillon', bg: 'couchant' },
  { skin: 0, hair: 'court', hc: 3, beard: 'none', hat: 'tricorne', htc: '#3a2a1c', pet: 'perroquet', ptc: '#3e8e4e', bg: 'taverne' },
];

/** SVG d'un pirate illustré (0 à 7) : garde-robe des comptes qui n'ont pas encore personnalisé leur look. */
export function artSVG(v: number) { return avatarSVG(ART_PRESETS[v] ?? ART_PRESETS[0], PALETTE[0], 100); }

/** Médaillon rond : `ring` = ombre portée CSS (anneau), sinon un liseré sombre.
 *  Si `a.look` est fourni (compte avec garde-robe), on l'affiche en priorité ; sinon on retombe sur photo / pirate illustré / initiale. */
export function avatarHTML(a: AvatarData, size: number, ring?: string) {
  const color = a.color || PALETTE[0], letter = esc((a.letter || '?').trim().charAt(0).toUpperCase() || '?');
  let inner: string;
  if (a.look && (a.look.hat !== undefined || a.look.hair !== undefined || a.look.skin !== undefined || a.look.bg !== undefined)) inner = avatarSVG(a.look, color, size);
  else if (a.kind === 'photo' && a.url) inner = `<img src="${esc(a.url)}" alt="" loading="lazy" decoding="async">`;
  else if (a.kind === 'art' && a.art != null && a.art >= 0) inner = avatarSVG(ART_PRESETS[Number(a.art)] ?? ART_PRESETS[0], color, size);
  // initiale relative au médaillon (cqw) : suit sa taille réelle même si le CSS la change ; px en repli
  else inner = `<span style="font-size:${Math.round(size * .45)}px;font-size:45cqw">${letter}</span>`;
  return `<span class="avatar" style="width:${size}px;height:${size}px;background:${esc(color)};box-shadow:${ring || '0 0 0 2px #1b140e'}">${inner}</span>`;
}
/** Données d'avatar à partir d'une ligne de la table profiles. */
export const fromProfile = (p: any, fallbackName = '?'): AvatarData => p ? ({ kind: p.avatar_kind, art: p.avatar_art, url: p.avatar_url, look: p.look, letter: p.pseudo || fallbackName, color: p.color }) : { letter: fallbackName };
