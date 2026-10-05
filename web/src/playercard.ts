// Aperçu d'un joueur au survol d'un pod à la table (maquette ApercuJoueur). Ouvre après 250 ms à la souris,
// instantanément au focus clavier ou au toucher. Se ferme en quittant la zone, au clic ailleurs, au scroll ou
// en pressant Échap. Le positionnement évite la main et le pli en cours.
import { avatarHTML, CATALOG, type Look } from './avatar';
import { xpLine } from './xp';
import { esc } from './util';

export interface PlayerCardData {
  user_id: string;
  pseudo: string; color: string;
  avatar_kind?: string | null; avatar_art?: number | null; avatar_url?: string | null; look?: Look | null;
  xp: number;
  elo: number; elo_best: number; ranked_games: number;
  games: number; wins: number;
  bids_made: number; bids_total: number;
  last_delta: number | null;
  cosmetics: string[];
}

export interface SeatSnapshot {
  seat: number; isBot: boolean; isMe: boolean;
  name: string; color: string;
  placeNow: { place: number; score: number; total: number } | null;
  hist: { bid: number; won: number; made: boolean; played: boolean }[]; // une case par manche de la partie
  current: { round: number; bid: number | null; won: number } | null;
}

const RARITY_INK: Record<string, string> = { r: '#4fa8ff', e: '#c27dff', l: '#ffc94a' };
const RARITY_LBL: Record<string, string> = { r: 'Rare', e: 'Épique', l: 'Légendaire' };

export class PlayerCardCtl {
  private el: HTMLElement;
  private cache = new Map<string, Promise<PlayerCardData | null>>();
  private timer: any = null;
  private shownFor: HTMLElement | null = null;
  private onPointerDown: (ev: PointerEvent) => void;
  private onScroll: () => void;
  private onResize: () => void;
  private onKey: (ev: KeyboardEvent) => void;

  constructor(
    private fetchData: (uid: string) => Promise<PlayerCardData | null>,
    private goProfile: () => void,
    private avoidEls: () => HTMLElement[] = () => [],
  ) {
    this.el = document.createElement('div');
    this.el.className = 'pcard'; this.el.hidden = true;
    this.el.setAttribute('role', 'tooltip'); this.el.setAttribute('aria-label', 'Aperçu du joueur');
    document.body.append(this.el);
    this.onPointerDown = (ev) => {
      const t = ev.target as HTMLElement | null;
      if (!this.shownFor || this.el.contains(t) || this.shownFor.contains(t)) return;
      this.close();
    };
    this.onScroll = () => this.close();
    this.onResize = () => this.close();
    this.onKey = (ev) => { if (ev.key === 'Escape' && this.shownFor) { ev.preventDefault(); this.close(); } };
    document.addEventListener('pointerdown', this.onPointerDown, true);
    addEventListener('scroll', this.onScroll, true);
    addEventListener('resize', this.onResize);
    document.addEventListener('keydown', this.onKey);
  }

  /** Fixe le survol d'un pod : une fois attaché, les mêmes handlers servent pour toute la vie du pod. */
  attach(pod: HTMLElement, info: () => { snapshot: SeatSnapshot; uid: string | null }) {
    if ((pod as any)._pcard) return; (pod as any)._pcard = true;
    pod.tabIndex = 0;
    pod.addEventListener('pointerenter', (ev) => {
      if (ev.pointerType !== 'mouse') return;
      this.schedule(pod, info, 250);
    });
    pod.addEventListener('pointerleave', (ev) => {
      if (ev.pointerType !== 'mouse') return;
      this.cancel();
      if (this.shownFor === pod) this.close();
    });
    pod.addEventListener('click', (ev) => {
      // Tactile : ouverture immédiate au toucher (souris ignorée pour éviter un double déclencheur)
      const t = (ev as PointerEvent).pointerType;
      if (t !== 'touch' && t !== 'pen') return;
      ev.preventDefault(); this.cancel(); this.open(pod, info);
    });
    pod.addEventListener('focus', () => { if (!this.shownFor) this.schedule(pod, info, 0); });
    pod.addEventListener('blur', () => { if (this.shownFor === pod) this.close(); });
  }

  private schedule(pod: HTMLElement, info: () => any, delay: number) {
    this.cancel();
    this.timer = setTimeout(() => this.open(pod, info), delay);
  }
  private cancel() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }

  private async open(pod: HTMLElement, info: () => { snapshot: SeatSnapshot; uid: string | null }) {
    const { snapshot, uid } = info();
    this.shownFor = pod;
    if (snapshot.isBot || !uid) {
      this.el.innerHTML = botCardHTML(snapshot);
      this.show(pod);
      return;
    }
    // Aperçu immédiat (données disponibles côté client), remplacé par la version complète dès que le serveur répond
    this.el.innerHTML = loadingCardHTML(snapshot);
    this.show(pod);
    try {
      if (!this.cache.has(uid)) this.cache.set(uid, this.fetchData(uid).catch(() => null));
      const data = await this.cache.get(uid)!;
      if (this.shownFor !== pod || !data) return;
      this.el.innerHTML = fullCardHTML(data, snapshot, snapshot.isMe);
      this.show(pod);
      const prof = this.el.querySelector('.pc-prof') as HTMLButtonElement | null;
      if (prof) prof.onclick = () => { this.close(); this.goProfile(); };
    } catch { /* on garde l'état de chargement */ }
  }

  private show(pod: HTMLElement) { this.el.hidden = false; this.place(pod); }

  close() {
    this.cancel();
    this.el.hidden = true;
    this.shownFor = null;
  }

  /** Nettoyage à quitter la table. */
  destroy() {
    this.cancel(); this.close();
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    removeEventListener('scroll', this.onScroll, true);
    removeEventListener('resize', this.onResize);
    document.removeEventListener('keydown', this.onKey);
    this.el.remove(); this.cache.clear();
  }

  private place(pod: HTMLElement) {
    const a = pod.getBoundingClientRect();
    const vp = { w: innerWidth, h: innerHeight }, m = 12;
    const pw = this.el.offsetWidth, ph = this.el.offsetHeight;
    const avoid = this.avoidEls().map(e => e.getBoundingClientRect());
    const overlaps = (x: number, y: number) => avoid.some(r => !(x + pw < r.left || x > r.right || y + ph < r.top || y > r.bottom));
    const inView = (x: number, y: number) => x >= m && y >= m && x + pw <= vp.w - m && y + ph <= vp.h - m;
    // Candidats dans l'ordre : à droite, à gauche, en bas, en haut
    const candidates = [
      { x: a.right + m, y: a.top + a.height / 2 - ph / 2 },
      { x: a.left - pw - m, y: a.top + a.height / 2 - ph / 2 },
      { x: a.left + a.width / 2 - pw / 2, y: a.bottom + m },
      { x: a.left + a.width / 2 - pw / 2, y: a.top - ph - m },
    ];
    for (const c of candidates) {
      c.x = Math.max(m, Math.min(c.x, vp.w - pw - m));
      c.y = Math.max(m, Math.min(c.y, vp.h - ph - m));
      if (inView(c.x, c.y) && !overlaps(c.x, c.y)) {
        this.el.style.left = c.x + 'px'; this.el.style.top = c.y + 'px'; return;
      }
    }
    // Repli : première candidate clampée (meilleure que rien, même si elle recouvre un peu)
    const c = candidates[0];
    this.el.style.left = c.x + 'px'; this.el.style.top = c.y + 'px';
  }
}

/* ---------- Rendus ---------- */

function nthShort(p: number) { return p === 1 ? '1er' : p + 'e'; }

function loadingCardHTML(s: SeatSnapshot): string {
  return `<div class="pc-id">${avatarHTML({ letter: s.name, color: s.color }, 56, ring(s.color))}
    <div class="pc-idtxt"><b class="pc-nm">${esc(s.name)}</b><span class="pc-chip">chargement…</span></div></div>`;
}

function botCardHTML(s: SeatSnapshot): string {
  const bid = s.current?.bid, won = s.current?.won ?? 0;
  const placeStr = s.placeNow ? `${nthShort(s.placeNow.place)} · ${s.placeNow.score} pts` : '';
  return `<div class="pc-id">${avatarHTML({ letter: s.name, color: s.color }, 56, ring(s.color))}
    <div class="pc-idtxt"><div class="pc-row1"><b class="pc-nm">${esc(s.name)}</b><span class="pc-chip bot">Bot</span></div><span class="pc-lvl">adversaire géré par le serveur</span></div></div>
  <div class="pc-game"><div class="pc-hdr"><span>Cette partie</span>${placeStr ? `<b>${esc(placeStr)}</b>` : ''}</div>
    ${histHTML(s.hist, s.current)}
    <span class="pc-sub">${sumHist(s.hist)}${s.current ? ` · manche en cours : mise ${bid == null ? '—' : bid}, ${won} pli${won > 1 ? 's' : ''}` : ''}</span></div>`;
}

function fullCardHTML(d: PlayerCardData, s: SeatSnapshot, isMe: boolean): string {
  const level = xpLine(d.xp);
  const elo = Math.round(Number(d.elo));
  const delta = d.last_delta != null ? Math.round(Number(d.last_delta)) : null;
  const winPct = d.games > 0 ? Math.round(100 * d.wins / d.games) : null;
  const bidPct = d.bids_total > 0 ? Math.round(100 * d.bids_made / d.bids_total) : null;
  const look = d.look || {} as Look;
  const worn = (d.cosmetics || [])
    .map(id => CATALOG.byId[id])
    .filter(c => c && (c.rarity === 'r' || c.rarity === 'e' || c.rarity === 'l'))
    .filter(c => (look as any)[c.slot] === c.value)
    .slice(0, 6);
  const avatarD = { kind: d.avatar_kind as any, art: d.avatar_art, url: d.avatar_url, look: d.look, letter: d.pseudo, color: d.color };
  const trendHTML = delta == null ? '' : delta > 0 ? `<span class="pc-up">▲ ${delta}</span>` : delta < 0 ? `<span class="pc-down">▼ ${Math.abs(delta)}</span>` : '';
  const bid = s.current?.bid, won = s.current?.won ?? 0;
  const placeStr = s.placeNow ? `${nthShort(s.placeNow.place)} · ${s.placeNow.score} pts` : '';

  return `<div class="pc-id">${avatarHTML(avatarD, 68, ring(d.color))}
    <div class="pc-idtxt">
      <div class="pc-row1"><b class="pc-nm">${esc(d.pseudo)}</b><span class="pc-chip on">en ligne</span></div>
      <span class="pc-lvl">Niv. ${level.level} · ${esc(level.title)}</span>
      <span class="pc-elo">Élo ${elo}${trendHTML ? ' ' + trendHTML : ''}</span>
    </div></div>
  <div class="pc-game"><div class="pc-hdr"><span>Cette partie</span>${placeStr ? `<b>${esc(placeStr)}</b>` : ''}</div>
    ${histHTML(s.hist, s.current)}
    <span class="pc-sub">${sumHist(s.hist)}${s.current ? ` · manche en cours : mise ${bid == null ? '—' : bid}, ${won} pli${won > 1 ? 's' : ''}` : ''}</span></div>
  <div class="pc-stats">
    <div class="pc-tile"><b>${winPct == null ? '—' : winPct + ' %'}</b><span>victoire${d.wins > 1 ? 's' : ''}</span></div>
    <div class="pc-tile"><b>${bidPct == null ? '—' : bidPct + ' %'}</b><span>mises tenues</span></div>
    <div class="pc-tile"><b>${d.games}</b><span>partie${d.games > 1 ? 's' : ''}</span></div>
  </div>
  <div class="pc-items">
    ${worn.length ? worn.map(it => itemHTML(it, d.color, (look as any)[it.variantKey ?? ''])).join('') : '<span class="pc-ilbl">Pas encore d\'objet rare porté.</span>'}
    ${worn.length ? '<span class="pc-ilbl">Objets rares portés</span>' : ''}
    ${isMe ? '<button class="pc-prof" type="button">Profil ›</button>' : ''}
  </div>`;
}

function itemHTML(it: any, color: string, variantColor: string | undefined): string {
  const o: Record<string, unknown> = { [it.slot]: it.value };
  if (it.variantKey && it.variants) o[it.variantKey] = variantColor || it.variants[0];
  return `<span class="pc-item" style="--rar:${RARITY_INK[it.rarity] || '#4fa8ff'}" title="${esc(it.name)} · ${esc(RARITY_LBL[it.rarity] || '')}">${avatarHTML({ look: o as Look, color } as any, 36)}</span>`;
}

function histHTML(hist: SeatSnapshot['hist'], current: SeatSnapshot['current']): string {
  let s = '<div class="pc-rounds" aria-label="Bilan manche par manche">';
  for (let r = 1; r <= hist.length; r++) {
    const h = hist[r - 1];
    const cur = !!current && current.round === r && !h?.played;
    const cls = h?.played ? (h.made ? 'ok' : 'ko') : (cur ? 'now' : 'empty');
    const tip = h?.played ? `Manche ${r} : mise ${h.bid}, plis ${h.won}` : (cur ? `Manche ${r} : en cours` : `Manche ${r}`);
    s += `<i class="pc-cell ${cls}" title="${esc(tip)}"></i>`;
  }
  return s + '</div>';
}

function sumHist(hist: SeatSnapshot['hist']): string {
  const played = hist.filter(h => h.played);
  const made = played.filter(h => h.made).length;
  if (!played.length) return 'aucune manche terminée';
  return `${made} mise${made > 1 ? 's' : ''} tenue${made > 1 ? 's' : ''} sur ${played.length}`;
}

function ring(color: string) { return `0 0 0 2px #1b140e,0 0 0 4px ${color}`; }
