// Aperçu d'un joueur au survol de sa plaque (ou au toucher sur téléphone), à la table. Maquette docs/maquettes/ApercuJoueur.dc.html.
// Identité (avatar porté, niveau, titre, Élo et tendance, présence), cette partie (place, score, manche par manche), 3 statistiques,
// objets rares portés et lien vers le profil. Version courte pour les bots. Ne recouvre ni la main ni le pli en cours.
import { esc } from './util';
import { avatarHTML, type AvatarData } from './avatar';
import { levelFor } from './xp';
import { BY_ID, RARITY, SLOTS, type Look } from '@shared/cosmetics.ts';
import { objectSVG, itemPreview } from './objects';

/** Ce que la table sait d'un siège (partie en cours). */
export interface SeatInfo {
  seat: number; uid: string | null; bot: boolean; me: boolean; name: string; color: string; avatar: AvatarData;
  place: number; score: number; bid: number | null; won: number; round: number;
  hist: { bid: number; won: number }[]; online: boolean | null;
}
/** Réponse de l'action player.card. */
export interface PlayerCard {
  id: string; pseudo: string; color: string; look: Look | null; avatar_kind?: string; avatar_art?: number | null; xp: number;
  elo: number; trend: number; ranked_games: number; games: number; wins: number; bids_made: number; bids_total: number;
}
const nth = (r: number) => r === 1 ? '1er' : r + 'e';
const pct = (a: number, b: number) => b ? Math.round(100 * a / b) + ' %' : '—';

function roundsBar(s: SeatInfo) {
  return `<div class="pcr" role="img" aria-label="Manche par manche : ${s.hist.filter(h => h.bid === h.won).length} mises tenues sur ${s.hist.length}">${Array.from({ length: 10 }, (_, i) => {
    const h = s.hist[i];
    if (h) { const ok = h.bid === h.won; return `<span class="${ok ? 'ok' : 'ko'}" title="Manche ${i + 1} : ${ok ? 'mise tenue' : 'mise ratée'}"></span>`; }
    return `<span class="${i === s.hist.length && i < s.round ? 'cur' : ''}" title="Manche ${i + 1}${i === s.hist.length ? ' : en cours' : ''}"></span>`;
  }).join('')}</div>`;
}
function gameLine(s: SeatInfo) {
  const made = s.hist.filter(h => h.bid === h.won).length;
  const cur = s.bid != null ? ` · manche en cours : mise ${s.bid}, ${s.won} pli${s.won > 1 ? 's' : ''}` : '';
  return `${made} mise${made > 1 ? 's' : ''} tenue${made > 1 ? 's' : ''} sur ${s.hist.length}${cur}`;
}
/** Carte d'un joueur humain ; `c` absent : chargement en cours (identité de la table seulement). */
export function humanCardHTML(s: SeatInfo, c: PlayerCard | null, profileHref: string, loading = true) {
  const lv = c ? levelFor(c.xp) : null, trend = c ? Math.round(c.trend) : 0;
  const av: AvatarData = c ? { look: c.look, kind: c.avatar_kind, art: c.avatar_art, letter: c.pseudo, color: s.color } : s.avatar;
  const worn = c?.look ? SLOTS.map(k => (c.look as any)[k] ? BY_ID[`${k}:${(c.look as any)[k]}`] : null).filter(x => x && x.rarity !== 'commun') : [];
  return `<div class="pchead" style="--glow:${s.color}33">${avatarHTML({ ...av, color: s.color }, 68, `0 0 0 3px #1b140e,0 0 0 5px ${s.color}`)}
      <div class="pcid"><div class="pcn"><b>${esc(s.me ? 'Vous' : s.name)}</b>${s.online ? '<span class="pcon">en ligne</span>' : s.online === false ? '<span class="pcoff">hors ligne</span>' : ''}</div>
        <span class="lbl">${lv ? `Niv. ${lv.level} · ${esc(lv.title)}` : loading ? 'Chargement…' : "Partie d'entraînement"}</span>
        ${c ? `<span class="pcelo">Élo ${c.elo}${trend ? ` <span class="${trend > 0 ? 'up' : 'down'}">${trend > 0 ? '▲' : '▼'} ${Math.abs(trend)}</span>` : ''}</span>` : ''}</div></div>
    <div class="pcgame"><div class="pcgl"><span class="lbl">Cette partie</span><span><b>${nth(s.place)}</b> · ${s.score} pts</span></div>${roundsBar(s)}<span class="lbl">${gameLine(s)}</span></div>
    ${c ? `<div class="pcstats"><div><span class="k">${pct(c.wins, c.games)}</span><span class="lbl">victoires</span></div><div><span class="k">${pct(c.bids_made, c.bids_total)}</span><span class="lbl">mises tenues</span></div>
      <div><span class="k">${c.games}</span><span class="lbl">partie${c.games > 1 ? 's' : ''}</span></div></div>` : ''}
    <div class="pcfoot"><span class="pcobj">${worn.map(x => `<span class="pcb" title="${esc(x!.name)} · ${RARITY[x!.rarity].name}" style="--rar:${RARITY[x!.rarity].color}">${objectSVG(x!.value, (c!.look as any)[x!.variants?.key ?? ''] || undefined) ?? itemPreview(x!, s.color, 24)}</span>`).join('')}
      <span class="lbl">${c ? worn.length ? 'Objets rares portés' : 'Aucun objet rare porté' : ''}</span></span>${profileHref ? `<a href="${profileHref}">Profil ›</a>` : ''}</div>`;
}
export function botCardHTML(s: SeatInfo) {
  return `<div class="pchead bot">${avatarHTML(s.avatar, 52, `0 0 0 2px #1b140e,0 0 0 4px ${s.color}`)}<div class="pcid"><b>${esc(s.name)}</b><span class="lbl">Bot · niveau moyen</span></div></div>
    <p class="pctxt">Joue en 1 à 2 secondes. Mise d'après la force de sa main, sans tricher : il ne voit pas vos cartes.</p>
    <div class="pcgl"><span>Cette partie : <b>${nth(s.place)}</b> · ${s.score} pts</span><span class="lbl">${gameLine(s).split(' · ')[0]}</span></div>
    <p class="pctxt dim">Les parties avec des bots ne comptent pas pour l'Élo.</p>`;
}

/** Branche l'aperçu sur la table : `seatOf` donne le siège de la plaque survolée, `info` ce que la table en sait,
 *  `load` la fiche du serveur (mise en cache par l'appelant). `avoid` : zones à ne jamais recouvrir (main, pli). */
export function installPlayerCards(root: HTMLElement, o: {
  seatOf(el: Element): number | null; info(seat: number): SeatInfo | null;
  load?(uid: string): Promise<PlayerCard>; avoid(): (DOMRect | null)[];
}) {
  const pop = document.createElement('div'); pop.className = 'pcard'; pop.hidden = true; pop.setAttribute('role', 'dialog');
  document.body.append(pop);
  let timer: any = null, leaveT: any = null, shown: { seat: number; el: HTMLElement } | null = null;
  const pod = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.('.pod, .opp') as HTMLElement | null;
  const place = (anchor: HTMLElement) => {
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, m = 10;
    // à droite de la plaque si possible, sinon à gauche ; sous la plaque sur téléphone (bandeau du haut)
    let x = r.right + 12, y = r.top;
    if (innerWidth < 720) { x = Math.min(Math.max(m, r.left + r.width / 2 - w / 2), innerWidth - w - m); y = r.bottom + 10; }
    else if (x + w > innerWidth - m) x = r.left - 12 - w;
    // jamais sur la barre de partie (56 px), ni sur la main ; à côté du pli plutôt qu'au-dessus
    const minY = innerWidth < 720 ? m : 64, [hand, ...rest] = o.avoid();
    const hit = (b: DOMRect) => x < b.right && x + w > b.left && y < b.bottom && y + h > b.top;
    y = Math.max(minY, y);
    if (hand && hit(hand)) y = Math.max(minY, hand.top - h - 10);
    for (const b of rest) {
      if (!b || !b.width || !hit(b)) continue;
      if (innerWidth >= 720) {
        const left = r.left + r.width / 2 < b.left + b.width / 2;
        const nx = left ? b.left - w - 10 : b.right + 10;
        if (nx >= m && nx + w <= innerWidth - m) { x = nx; continue; }
      }
      y = b.bottom + 10 + h <= (hand ? hand.top - 10 : innerHeight - m) ? b.bottom + 10 : Math.max(minY, b.top - h - 10);
    }
    pop.style.left = Math.max(m, Math.min(x, innerWidth - w - m)) + 'px';
    pop.style.top = Math.max(m, Math.min(y, innerHeight - h - m)) + 'px';
  };
  const show = async (seat: number, el: HTMLElement) => {
    const s = o.info(seat); if (!s) return;
    shown = { seat, el };
    pop.setAttribute('aria-label', `${s.me ? 'Vous' : s.name} : aperçu du profil`);
    const href = s.me ? '#/profil' : s.uid ? `#/joueur/${s.uid}` : '';
    pop.classList.toggle('bot', s.bot);
    // sans identifiant (entraînement) : la version courte, sans fiche du serveur
    pop.innerHTML = s.bot ? botCardHTML(s) : humanCardHTML(s, null, href, !!(s.uid && o.load));
    pop.hidden = false; place(el);
    if (!s.bot && s.uid && o.load) {
      try {
        const c = await o.load(s.uid);
        if (shown?.seat === seat) { pop.innerHTML = humanCardHTML(o.info(seat) ?? s, c, href); place(el); }
      } catch { /* on garde la version courte */ }
    }
  };
  const hide = () => { clearTimeout(timer); clearTimeout(leaveT); timer = null; pop.hidden = true; shown = null; };
  // souris : ouverture après 250 ms de survol ; fermeture en quittant la plaque et la carte
  root.addEventListener('pointerover', ev => {
    if (ev.pointerType !== 'mouse') return;
    const el = pod(ev.target); if (!el) return; clearTimeout(leaveT);
    const seat = o.seatOf(el); if (seat == null || shown?.seat === seat) return;
    clearTimeout(timer); timer = setTimeout(() => show(seat, el), 250);
  });
  const leave = (ev: PointerEvent) => {
    if (ev.pointerType !== 'mouse') return;
    const to = ev.relatedTarget as Node | null; if (to && (pop.contains(to) || pod(to))) return;
    clearTimeout(timer); leaveT = setTimeout(hide, 150);
  };
  root.addEventListener('pointerout', leave); pop.addEventListener('pointerout', leave);
  pop.addEventListener('pointerover', () => clearTimeout(leaveT));
  // toucher et clic : bascule l'aperçu ; un clic ailleurs le ferme
  root.addEventListener('click', ev => {
    const el = pod(ev.target); if (!el) return;
    const seat = o.seatOf(el); if (seat == null) return;
    if (shown?.seat === seat) hide(); else { clearTimeout(timer); show(seat, el); }
  });
  const down = (ev: Event) => { if (shown && !pop.contains(ev.target as Node) && !pod(ev.target)) hide(); };
  const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && shown) hide(); };
  const scroll = () => { if (shown) place(shown.el); };
  document.addEventListener('pointerdown', down, true); document.addEventListener('keydown', key);
  addEventListener('scroll', scroll, true); addEventListener('resize', hide);
  return {
    hide, destroy: () => {
      hide(); pop.remove();
      document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key);
      removeEventListener('scroll', scroll, true); removeEventListener('resize', hide);
    },
  };
}
