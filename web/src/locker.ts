// Outils communs au Casier et à la Boutique (D8, D12, docs/casier-boutique/SPEC.md) : raretés, possession des objets
// (achetés, gagnés au coffre, ou débloqués par le niveau et les hauts faits), provenance et progression, réglages locaux.
import { CATALOG, type CosmeticItem } from './avatar';
import { levelFor } from './xp';
import { getAnimMode, setAnimMode } from './animatedCards';

/** Barre de rareté des vignettes et couleur des plaques de titre. */
export const RC: Record<string, string> = { c: '#c9d3dc', r: '#4fa8ff', e: '#b77dff', l: '#ffc94a', m: 'linear-gradient(90deg,#ff9ad5,#ffd36b,#8dffb0,#7fc8ff,#c39bff)' };
export const PLQ: Record<string, string> = {
  c: 'linear-gradient(180deg,#e9e2d2,#b9b0a0)', r: 'linear-gradient(180deg,#a9d4ff,#4f8fd6)', e: 'linear-gradient(180deg,#dcbcff,#9a62e0)',
  l: 'linear-gradient(180deg,#ffe49a,#d9a53a)', m: 'linear-gradient(90deg,#ff9ad5,#ffd36b,#8dffb0,#7fc8ff,#c39bff)',
};
export const RAR_NAME: Record<string, string> = { c: 'Commun', r: 'Rare', e: 'Épique', l: 'Légendaire', m: 'Mythique' };

/** Ce qui débloque les objets de niveau et de haut fait (lu dans le profil et les statistiques). */
export interface Progress { xp: number; achievements: Set<string>; sirens: number; wins: number; zeroBids: number; achNames: Map<string, string> }
export const levelOf = (p: Progress) => levelFor(p.xp).level;

/** Objet possédé : libre, acheté ou gagné au coffre (inventaire), ou débloqué par le niveau / le haut fait. */
export function owns(it: CosmeticItem, owned: Set<string>, p: Progress | null): boolean {
  if (it.defaultOwned || owned.has(it.id)) return true;
  if (!p || !it.how) return false;
  const m = /^title:(\d+)$/.exec(it.how); if (m) return levelOf(p) >= Number(m[1]);
  return it.how.startsWith('achievement:') && p.achievements.has(it.how.slice(12));
}
/** Provenance d'un objet verrouillé : « Coffre », « Échoppe · 150 », « Niveau 16 », « Haut fait · … ». */
export function howText(it: CosmeticItem, p: Progress | null): string {
  const h = it.how ?? '';
  if (h === 'chest') return it.rarity === 'm' ? 'Coffre · 1 %' : 'Coffre';
  if (h === 'shop') return 'Échoppe' + (it.price ? ' · ' + it.price : '');
  const m = /^title:(\d+)$/.exec(h); if (m) return 'Niveau ' + m[1];
  if (h.startsWith('achievement:')) return 'Haut fait · ' + (p?.achNames.get(h.slice(12)) ?? 'à débloquer');
  if (h.startsWith('leaderboard')) return 'Top 3 du mois';
  return '';
}
/** Progression vers un objet verrouillé (titres surtout) : [fait, total], ou null si elle ne se mesure pas. */
export function progressOf(it: CosmeticItem, p: Progress | null): [number, number] | null {
  if (!p || !it.how) return null;
  const m = /^title:(\d+)$/.exec(it.how); if (m) return [Math.min(levelOf(p), Number(m[1])), Number(m[1])];
  const code = it.how.startsWith('achievement:') ? it.how.slice(12) : '';
  if (code === 'siren_hunter') return [Math.min(p.sirens, 10), 10];
  if (code === 'captain') return [Math.min(p.wins, 10), 10];
  if (code === 'velvet') return [Math.min(p.zeroBids, 5), 5];
  return null;
}
/** Catalogue d'un emplacement, dans l'ordre. */
export const itemsOf = (slot: string) => CATALOG.bySlot[slot] ?? [];

/* ---------- Réglages de l'onglet Cartes (sur cet appareil) ---------- */
const K_SON = 'pli.anim.son';
/** « Son à l'impact » : un accord quand votre carte animée tombe sur le tapis. */
export function impactSound(): boolean { try { return localStorage.getItem(K_SON) !== '0'; } catch { return true; } }
export function setImpactSound(on: boolean) { try { localStorage.setItem(K_SON, on ? '1' : '0'); } catch { /* stockage indisponible */ } }
/** « Animations des autres » : le réglage Cartes animées de la table (toutes / les miennes). */
export const othersAnimated = () => getAnimMode() === 'toutes';
export function setOthersAnimated(on: boolean) { setAnimMode(on ? 'toutes' : 'miennes'); }
