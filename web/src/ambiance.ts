// Ambiance pirate de la table (A9, docs/table-v2/AMBIANCE.md, maquette TableAmbiance) : décor seulement, aucune donnée ni
// interaction. Tout est inséré avec aria-hidden="true" et pointer-events: none ; les styles sont dans styles/ambiance.css.
// Réglage « Ambiance : Pirate / Sobre » (localStorage pli.ambiance) : « sobre » ajoute la classe .sobre sur la table.
import './styles/ambiance.css';

/** Carte marine du tapis (repère du tapis, 988 × 468), découpée par l'ellipse du tapis : quadrillage, lignes de rhumb,
 *  rose des vents sous le pli, serpent de mer, « Mare Incognitum », tache de café. Opacités très faibles (≤ 0,10). */
export const CHART_SVG = `<svg class="amb-chart" viewBox="0 0 988 468" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <g fill="none" stroke="#e8dcc0">
    <g opacity=".07" stroke-width="1"><path d="M0 62h988M0 132h988M0 202h988M0 272h988M0 342h988M0 412h988M100 0v468M220 0v468M340 0v468M460 0v468M580 0v468M700 0v468M820 0v468M940 0v468"/></g>
    <g opacity=".06" stroke-width="1"><path d="M494 234L0 42M494 234L0 422M494 234L988 42M494 234L988 422M494 234L250 0M494 234L740 0M494 234L250 468M494 234L740 468"/></g>
    <g opacity=".08" transform="translate(494 372)"><circle r="62" stroke-width="1.2"/><circle r="48" stroke-width=".8" stroke-dasharray="2 4"/>
      <path d="M0 -70L8 -8 0 0-8-8zM0 70L8 8 0 0-8 8zM-70 0L-8-8 0 0-8 8zM70 0L8-8 0 0 8 8z" fill="#e8dcc0" stroke="none"/>
      <text y="-76" text-anchor="middle" font-size="13" font-family="IM Fell English SC, serif" fill="#e8dcc0" stroke="none">N</text></g>
    <g opacity=".09" stroke-width="1.6" transform="translate(100 332)"><path d="M0 30c20-20 40 10 60-8s34-24 50-4 30 20 48 2"/><path d="M150 18c8-10 20-10 26-2-6 2-10 6-12 12"/>
      <circle cx="168" cy="14" r="1.6" fill="#e8dcc0"/><path d="M20 34c0 8 6 12 12 10M70 26c0 8 6 12 12 10M120 20c0 8 6 12 12 10"/></g>
    <text x="740" y="380" opacity=".10" font-size="18" font-style="italic" font-family="IM Fell English SC, serif" fill="#e8dcc0" stroke="none" transform="rotate(-8 740 380)">Mare Incognitum</text>
    <g opacity=".08" stroke-width="1.2" transform="translate(855 77)"><path d="M0 22c12-3 18-14 30-12s16 12 28 8"/><path d="M10 34c10-2 16 4 26 2"/></g>
    <circle cx="730" cy="102" r="44" stroke="#3a2214" stroke-width="7" opacity=".10"/>
  </g></svg>`;

/** Rebord de la table (repère du plateau, 1040 × 520) : rangée de clous en laiton et corde tressée à la jonction avec le tapis. */
export const RIM_SVG = `<svg class="amb-rim" viewBox="0 0 1040 520" aria-hidden="true">
  <ellipse cx="520" cy="260" rx="507" ry="247" fill="none" stroke="#c9a14a" stroke-width="3.2" stroke-dasharray=".1 21" stroke-linecap="round" opacity=".85"/>
  <ellipse cx="520" cy="260" rx="497" ry="237" fill="none" stroke="#b08a5a" stroke-width="5" stroke-dasharray="5 3" opacity=".75"/>
  <ellipse cx="520" cy="260" rx="497" ry="237" fill="none" stroke="#5e4422" stroke-width="1" stroke-dasharray="5 3" stroke-dashoffset="2.5" opacity=".9"/></svg>`;

/** Lanterne suspendue (se balance), avec sa flamme qui vacille et son halo. */
export const LANTERN_SVG = `<svg viewBox="0 0 60 120" aria-hidden="true"><path d="M30 0v20" stroke="#5e4422" stroke-width="2"/><circle cx="30" cy="24" r="5" fill="none" stroke="#8a6a3a" stroke-width="2.5"/>
  <path d="M14 36h32l-4 8H18z" fill="#3a2a18"/><path d="M18 44h24v44H18z" fill="rgba(255,200,120,.25)" stroke="#3a2a18" stroke-width="3"/><path d="M24 44v44M36 44v44" stroke="#3a2a18" stroke-width="1.6"/>
  <g class="amb-flame"><path d="M30 58c5 6 6 12 0 18-6-6-5-12 0-18z" fill="#ffd27a"/><path d="M30 64c2 3 3 6 0 9-3-3-2-6 0-9z" fill="#fff6dc"/></g><path d="M12 88h36l-4 8H16z" fill="#3a2a18"/></svg>`;

const WAVE = (a: number) => `M0 ${a} ${'q15 -' + a + ' 30 0 t30 0 '.repeat(6)}`;
/** Hublot : lune, et houle qui défile (deux vagues, 7 s et 9 s). */
export const PORTHOLE_HTML = `<span class="amb-moon"></span>
  <svg class="amb-swell" viewBox="0 0 180 14" aria-hidden="true"><path d="${WAVE(5)}V14 H0z" fill="#0a2230" opacity=".9"/><path d="${WAVE(5)}" fill="none" stroke="rgba(243,232,207,.35)" stroke-width="1.6"/></svg>
  <svg class="amb-swell2" viewBox="0 0 180 12" aria-hidden="true"><path d="${WAVE(4)}V12 H0z" fill="#0a2230" opacity=".9"/><path d="${WAVE(4)}" fill="none" stroke="rgba(243,232,207,.2)" stroke-width="1.2"/></svg>
  <span class="amb-glass"></span>`;

/** Dague et pile de doublons, immobiles. */
export const DAGGER_SVG = `<svg viewBox="0 0 170 110" aria-hidden="true">
  <g transform="rotate(-24 85 55)"><path d="M18 52h88l12 3-12 3H18z" fill="#c9d1d8"/><path d="M18 52h88" stroke="#fff" stroke-width=".8" opacity=".6"/><rect x="6" y="49" width="14" height="12" rx="2" fill="#6b4226"/><path d="M2 46h6v18H2z" fill="#c9a14a"/><path d="M20 46h4v18h-4z" fill="#c9a14a"/></g>
  <g><ellipse cx="112" cy="86" rx="13" ry="5" fill="#8a6620"/><ellipse cx="112" cy="83" rx="13" ry="5" fill="#e2bd62"/><ellipse cx="130" cy="92" rx="13" ry="5" fill="#8a6620"/><ellipse cx="130" cy="89" rx="13" ry="5" fill="#f0cf72"/>
  <ellipse cx="121" cy="78" rx="13" ry="5" fill="#8a6620"/><ellipse cx="121" cy="75" rx="13" ry="5" fill="#e8c766"/><circle cx="121" cy="75" r="5" fill="none" stroke="#a77b22" stroke-width="1"/></g></svg>`;

/** Accessoires des coins, dans le repère du plateau (x, y, largeur, hauteur) : la table masque ceux qui toucheraient une plaque.
 *  margin optionnelle : réduit la zone de collision avec les plaques (défaut 8 px autour) pour autoriser un chevauchement
 *  léger dans le padding de la plaque — utile pour un décor rond qui tient dans un coin serré. */
export const PROPS: { cls: string; html: string; box: [number, number, number, number]; margin?: number }[] = [
  { cls: 'amb-lantern', html: `${LANTERN_SVG}<span class="amb-halo"></span>`, box: [40, 0, 60, 120] },
  // hublot entièrement sous le haut du plateau (y >= 0) pour ne pas déborder sur le header de la page ;
  // en 6/9 joueurs la plaque haute-droite (866, 147) a son bord haut à 108, donc y+h <= 108 avec marge 0.
  // margin: 0 permet de garder un hublot un peu plus grand que l'original tout en restant visible 3 → 9 joueurs.
  { cls: 'amb-porthole', html: PORTHOLE_HTML, box: [921, 0, 108, 108], margin: 0 },
  { cls: 'amb-dagger', html: DAGGER_SVG, box: [12, 404, 170, 110] },
];

export type Ambiance = 'pirate' | 'sobre';
const KEY = 'pli.ambiance';
export function getAmbiance(): Ambiance { try { return localStorage.getItem(KEY) === 'sobre' ? 'sobre' : 'pirate'; } catch { return 'pirate'; } }
export function setAmbiance(a: Ambiance) { try { localStorage.setItem(KEY, a); } catch { /* navigation privée : réglage non retenu */ } }

/** Insère le décor dans la table (élément racine de TableView) : carte marine dans le tapis, clous et corde sur le rebord,
 *  accessoires dans les coins du plateau, sous le calque des plaques et des cartes. Applique le réglage Pirate / Sobre. */
export function mountAmbiance(tableEl: HTMLElement) {
  const stage = tableEl.querySelector('.bstage'), mat = tableEl.querySelector('.mat'), layer = tableEl.querySelector('#layer');
  if (!stage || !mat || !layer || stage.querySelector('.amb-rim')) return;
  const frag = (html: string) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; };
  mat.append(frag(CHART_SVG));
  stage.insertBefore(frag(RIM_SVG), layer);
  for (const p of PROPS) {
    const el = document.createElement('div');
    el.className = 'amb-prop ' + p.cls; el.setAttribute('aria-hidden', 'true'); el.innerHTML = p.html;
    const [x, y, w, h] = p.box; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
    stage.insertBefore(el, layer);
  }
  tableEl.classList.toggle('sobre', getAmbiance() === 'sobre');
}
/** Masque les accessoires qui toucheraient une plaque (positions des plaques en px du plateau, plaques de 236 × 78). */
export function fitProps(tableEl: HTMLElement, pods: { px: number; py: number }[]) {
  tableEl.querySelectorAll<HTMLElement>('.amb-prop').forEach((el, i) => {
    const [x, y, w, h] = PROPS[i].box, m = PROPS[i].margin ?? 8;
    el.hidden = pods.some(p => x - m < p.px + 118 && x + w + m > p.px - 118 && y - m < p.py + 39 && y + h + m > p.py - 39);
  });
}
