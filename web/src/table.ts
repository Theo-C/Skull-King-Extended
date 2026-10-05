// Vue de la table, partagée par le mode en ligne et l'entraînement hors ligne.
// Elle affiche des instantanés publics (rejoués avec un délai pour animer) et la main privée du joueur.
import { cname, leadSuitOf, resolve, roundsOf, wildRule, SUIT, WILD_SUITS, PIRATES, type Action, type Card, type Entry, type PublicView, type PrivateView, type LogSeg } from '@engine';
import { cardHTML, backFace, preloadArt } from './cards';
import { $, esc, modal, sleep, toast, signed } from './util';
import { rulesHTML } from './rules';
import { sfx, soundOn, setSound } from './sound';
import { installCardZoom, setZoomNote } from './zoom';
import { avatarHTML, type AvatarData } from './avatar';
import { BY_ID, RARITY } from '@shared/cosmetics.ts';
import { itemPreview } from './objects';
import { openChestOverlay, type ChestResult } from './chest';
import { installPlayerCards, type PlayerCard } from './playercard';
import { levelFor, xpToReach, LEVEL_TITLES, fmt, xpReason as xpLabel } from './xp';


const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Remplace le contenu d'un élément seulement s'il a changé : évite de recréer le DOM (et de casser animations et survol). */
const htmlCache = new WeakMap<Element, string>();
function setHTML(el: Element, html: string) { if (htmlCache.get(el) !== html) { el.innerHTML = html; htmlCache.set(el, html); } }
function elFrom(html: string) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; }
const center = (r: DOMRect) => [r.left + r.width / 2, r.top + r.height / 2];
/** Écran tactile sans survol : premier appui = aperçu, second appui = jouer. */
const TOUCH = () => matchMedia('(hover: none)').matches;
/** « du Doublon », « de la Carte marine » ; « d'Ysolde », « de Corentin ». */
const du = (s: string) => /^Carte/.test(s) ? 'de la ' + s : 'du ' + s;
const de = (s: string) => s === 'vous' ? 'à vous' : /^[aeiouyhéèêàâîôûAEIOUYHÉÈÊÀÂÎÔÛ]/.test(s) ? "d'" + s : 'de ' + s;

export interface TableBackend {
  send(move: Action): Promise<void>; emote?(text: string): void; ready?(round: number): void;
  /** Partie en ligne : identifiant, utilisateur courant, utilisateur de chaque siège, et revanche (renvoie l'identifiant du nouveau salon). */
  gameId?: string; uid?: string; seatUids?: (string | null)[]; rematch?(): Promise<string>;
  /** Règlement de fin de partie relu au serveur (history.get) quand il tarde à arriver par l'état de la partie. */
  settled?(): Promise<any>;
  /** Coffre de victoire (partie en ligne) : ouverture côté serveur, objet porté tout de suite, état du porte-monnaie. */
  /** Aperçu d'un joueur au survol (action player.card, mise en cache par l'appelant pour toute la partie). */
  playerCard?(uid: string): Promise<PlayerCard>;
  chest?: { open(): Promise<ChestResult>; equip(r: ChestResult): Promise<void>; wallet(): Promise<{ coins: number; chests: number }> };
}
/** Réactions proposées (les seules acceptées, y compris depuis le réseau). */
export const EMOTES = ['Bien joué !', 'Aïe !', 'Hissez haut !', 'Bluff ?'];
const PCOL = ['#d9b25a', '#c8644b', '#5c9db6', '#7ab874', '#a982c4', '#e0954a', '#cfc6b0', '#6f8fd0', '#d47fa6'];
// Pauses entre deux événements rejoués (ms, multipliées par la vitesse choisie) : assez longues pour suivre ce que font les bots.
/** Durée de la révélation du pouvoir de Marie Thorne (× vitesse). */
const LISE_MS = 2600;
const DELAY: Record<string, number> = { play: 1250, trick: 2400, trickEnd: 700, bids: 2000, deal: 700, round: 600, end: 0, lise: LISE_MS };
const ICON = {
  last: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4a6 6 0 1 1-6 6M4 4v4h4"/></svg>',
  scores: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h12v14H4zM7 7h6M7 10h6M7 13h4"/></svg>',
  rules: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4c3-1 5-1 7 1 2-2 4-2 7-1v12c-3-1-5-1-7 1-2-2-4-2-7-1zM10 5v12"/></svg>',
  soundOn: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8h3l4-3v10l-4-3H3zM13 7.5a3.5 3.5 0 0 1 0 5M15.5 5a7 7 0 0 1 0 10"/></svg>',
  menu: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M4 10h12M4 14h12"/></svg>',
  soundOff: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8h3l4-3v10l-4-3H3zM13 8l4 4M17 8l-4 4"/></svg>',
};
/** Portrait de Marie Thorne (maquette Marie Thorne : silhouette sur médaillon prune). */
const LISE_PORTRAIT = '<span class="lport" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M14 100c3-26 18-36 36-36s33 10 36 36z" fill="#15110E"/><ellipse cx="50" cy="48" rx="14" ry="17" fill="#15110E"/><path d="M24 40c8-16 44-16 52 0-9 3-43 3-52 0z" fill="#15110E"/><path d="M25 40c11 3 39 3 50 0" stroke="#C9A24A" stroke-width="2.5" fill="none"/></svg></span>';
const SEAL = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4l3 13 13 3-13 3-3 13-3-13-13-3 13-3z" fill="#c9a14a"/></svg>';
/** Plateau dessiné en 1040 × 520 (comme la maquette) puis mis à l'échelle. */
const BW = 1040, BH = 520;
/** Plateau du téléphone (table rectangulaire de la maquette Mobile). */
const MW = 366, MH = 330;
/** Durée affichée du tour (visuelle : le serveur n'impose aucun temps). */
const TURN_S = 30;
/** Délai de la fenêtre de fin de manche avant la manche suivante. */
const READY_S = 8;
interface Spot { px: number; py: number; sx: number; sy: number; r: number }
/** Positions des plaques (px, py) et des cartes du pli (sx, sy, inclinaison r), indexées par place relative (0 = vous, en bas). */
function geometry(n: number): Spot[] {
  if (n === 4) return [
    { px: 520, py: 488, sx: 520, sy: 348, r: -2 }, { px: 136, py: 260, sx: 396, sy: 260, r: -7 },
    { px: 520, py: 28, sx: 520, sy: 168, r: 2 }, { px: 904, py: 260, sx: 644, sy: 260, r: 7 }];
  if (n === 3) return [
    { px: 520, py: 488, sx: 520, sy: 348, r: -2 }, { px: 250, py: 40, sx: 440, sy: 196, r: -6 }, { px: 790, py: 40, sx: 600, sy: 196, r: 6 }];
  // au-delà : ellipse (plaques au bord, cartes sur une ellipse intérieure)
  return Array.from({ length: n }, (_, rel) => {
    const a = (90 + rel * 360 / n) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return { px: 520 + 400 * c, py: 262 + 230 * s, sx: 520 + 215 * c, sy: 258 + 108 * s, r: Math.round(7 * c + (s < 0 ? 2 : -2) * (1 - Math.abs(c))) };
  });
}
/** Téléphone : cartes du pli en croix sur la table rectangulaire (les adversaires sont dans le bandeau du haut). */
function mobileGeometry(n: number): Spot[] {
  const at = (sx: number, sy: number, r: number): Spot => ({ px: sx, py: sy, sx, sy, r });
  if (n === 4) return [at(183, 254, -2), at(87, 164, -7), at(183, 102, 2), at(279, 164, 7)];
  const k = n - 1, out = [at(183, 254, -2)], wide = k > 4;
  for (let j = 0; j < k; j++) {
    const a = (k === 1 ? 270 : 200 + j * 140 / (k - 1)) * Math.PI / 180;
    out.push(at(183 + (wide ? 128 : 100) * Math.cos(a), (wide ? 168 : 172) + (wide ? 92 : 78) * Math.sin(a), Math.round(7 * Math.cos(a))));
  }
  return out;
}
const PENDING_LABEL: Record<string, string> = {
  plank: 'choisit le pirate qui marche sur la planche', rosie: 'choisit qui entame le prochain pli', bahij: 'pioche et défausse deux cartes',
  rascal: 'choisit sa mise', juanita: 'consulte la pioche', harry: 'décide de modifier sa mise', mary: 'choisit une carte face cachée',
};

export class TableView {
  pub: PublicView | null = null; priv: PrivateView | null = null;
  private latest: { pub: PublicView; priv: PrivateView | null } | null = null;
  private queue: any[] = []; private running = false; private busy = false;
  private banner: string | null = null; private bannerShown: string | null = null;
  private logLines: { s: LogSeg[]; cls?: string }[] = [];
  private pick: { k: number; sel: Set<number> } | null = null;
  private choice: { id: number; need: string[]; move: any } | null = null;
  private shownRound = 0; private shownEnd = false;
  // éléments conservés d'un rendu à l'autre
  private cards?: { hide(): void; destroy(): void }; private online: Set<string> | null = null;
  private seatEls: HTMLElement[] = []; private centerEl: HTMLElement | null = null;
  private tcards = new Map<string, HTMLElement>(); private collectTo: number | null = null;
  private handEls = new Map<number, HTMLElement>(); private handRound = -1;
  private flyFrom: { id: number; rect: DOMRect } | null = null; private sendingId: number | null = null;
  private prevScores: (number | undefined)[] = [];
  private wasMyTurn = false; private baseTitle = document.title; private resizeRaf = 0;
  private k = 1; private evk: string | null = null; private handObs: ResizeObserver | null = null;
  private roundGate: Promise<void> | null = null; private roundOpen: { round: number; ready: Set<number>; update: () => void; close: () => void } | null = null;
  private earlyReady: Record<number, number[]> = {};
  private prevWon: (number | undefined)[] = [];
  private oppEls: HTMLElement[] = [];
  private playedMine = new Set<number>(); private playedRound = -1;
  private histCache: any[][] = []; private lastEmote: Record<number, number> = {};
  private turnStart = Date.now(); private previewId: number | null = null; private ticker: any = 0;
  speed = 1;

  constructor(private root: HTMLElement, private mySeat: number | null, private backend: TableBackend, private onExit: () => void) {
    try { this.speed = Number(localStorage.getItem('pli-speed')) || 1; } catch { /* stockage indisponible */ }
    const allowed = [1.7, 1, 0.45]; const sel = allowed.includes(this.speed) ? this.speed : 1;
    root.innerHTML = `
    <header class="gbar">
      <svg class="glogo" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="#c9a14a" stroke-width="1.5"/><path d="M20 3l3.2 13.8L37 20l-13.8 3.2L20 37l-3.2-13.8L3 20l13.8-3.2z" fill="#c9a14a"/><circle cx="20" cy="20" r="2.4" fill="#ead08a"/></svg>
      <div class="gtitle"><b id="gRound">Manche</b><span id="gSub"></span></div>
      <div class="gdots" id="gDots" role="img" aria-label="Progression des manches"></div>
      <div class="gsp"></div>
      <div class="gtools">
        <select id="speed" class="tb" aria-label="Vitesse des animations"><option value="1.7">Lente</option><option value="1">Normale</option><option value="0.45">Rapide</option></select>
        <button class="tb" id="bLast" aria-label="Dernier pli">${ICON.last}<span class="lbl">Dernier pli</span></button>
        <button class="tb" id="bScores" aria-label="Scores">${ICON.scores}<span class="lbl">Scores</span></button>
        <button class="tb" id="bRules" aria-label="Règles">${ICON.rules}<span class="lbl">Règles</span></button>
        <button class="tb ico" id="bSound"></button>
        <button class="tb" id="bExit">Quitter</button>
        <button class="tb ico" id="bMenu" aria-label="Menu">${ICON.menu}</button>
      </div>
    </header>
    <div class="tmain">
      <div class="tstage">
        <div class="opps" id="opps" aria-label="Adversaires"></div>
        <section class="board" id="table" aria-label="Table de jeu"><div class="bstage" id="bstage"><div class="rim"></div><div class="mat">${roseSVG()}</div><div id="layer"></div></div></section>
        <div id="action" aria-live="polite"><div class="prompt">Chargement de la partie…</div></div>
        <section class="rail"><div class="handhead"><span id="handTitle"><b>Votre main</b></span><span id="handMeta" class="tags"></span></div><div id="hand"></div><div class="qemo">${[EMOTES[0], EMOTES[1], EMOTES[3]].map(e => `<button data-emo="${esc(e)}">${esc(e)}</button>`).join('')}</div></section>
      </div>
      <aside class="side" id="side">
        <div class="drawerbar"><button class="tb" id="dSheet">Feuille de scores</button><button class="tb" id="dClose">Fermer</button></div>
        <section class="panel"><h3>Classement <small>plis / mise · total</small></h3><div class="ladder" id="mini"></div></section>
        <section class="panel" id="stakesP" hidden><h3>Ce que vaut votre mise</h3><div id="stakes" class="stakes"></div><p class="fine">Les bonus (14, captures, Pacte de Butin) ne comptent que si la mise est exacte.</p></section>
        <section class="panel"><h3>Réactions</h3><div class="emotes">${EMOTES.map(e => `<button class="emo" data-emo="${esc(e)}">${esc(e)}</button>`).join('')}</div></section>
        <section class="panel"><h3>Journal <a href="#" id="allLog" class="more">Tout voir</a></h3><div id="log"></div></section>
      </aside>
    </div>`;
    const sp = $('#speed', root) as HTMLSelectElement; sp.value = String(sel);
    sp.onchange = () => { this.speed = Number(sp.value); this.root.style.setProperty('--spd', String(this.animMs || 1)); try { localStorage.setItem('pli-speed', sp.value); } catch { /* ignoré */ } };
    this.root.style.setProperty('--spd', String(this.animMs || 1));
    // sur téléphone, « Scores » ouvre un tiroir avec le classement et le journal
    $('#bScores', root).onclick = () => { if (this.mob) this.root.classList.toggle('drawer'); else this.scoreSheet(); };
    $('#dClose', root).onclick = () => this.root.classList.remove('drawer');
    $('#dSheet', root).onclick = () => this.scoreSheet();
    $('#bMenu', root).onclick = () => this.menu();
    $('#bLast', root).onclick = () => this.lastTrickModal();
    const coinN = (ev: Event) => { const b = (ev.target as HTMLElement).closest?.('[data-n]') as HTMLElement | null; return b ? Number(b.dataset.n) : null; };
    $('#action', root).addEventListener('mouseover', ev => { const n = coinN(ev); if (n != null) this.renderStakes(n); });
    $('#action', root).addEventListener('focusin', ev => { const n = coinN(ev); if (n != null) this.renderStakes(n); });
    $('#allLog', root).onclick = ev => { ev.preventDefault(); this.fullLog(); };
    root.addEventListener('click', ev => { const b = (ev.target as HTMLElement).closest('[data-emo]') as HTMLElement | null; if (b) this.sendEmote(b.dataset.emo!); });
    const bs = $('#bSound', root);
    const paintSound = () => { bs.innerHTML = soundOn() ? ICON.soundOn : ICON.soundOff; bs.setAttribute('aria-label', soundOn() ? 'Couper le son' : 'Activer le son'); bs.title = bs.getAttribute('aria-label')!; };
    paintSound(); bs.onclick = () => { setSound(!soundOn()); paintSound(); if (soundOn()) sfx.coin(); };
    installCardZoom(); setZoomNote(card => this.zoomNote(card)); preloadArt();
    this.cards = installPlayerCards(this.root, {
      seatOf: el => { const i = this.seatEls.indexOf(el as HTMLElement), j = this.oppEls.indexOf(el as HTMLElement); return i >= 0 ? i : j >= 0 ? j : null; },
      info: seat => this.seatInfo(seat),
      load: this.backend.playerCard ? uid => this.backend.playerCard!(uid) : undefined,
      // ni la main, ni le pli en cours
      avoid: () => {
        const rail = this.root.querySelector('.rail')?.getBoundingClientRect() ?? null;
        const rs = [...this.tcards.values(), ...(this.centerEl ? [this.centerEl] : [])].filter(e => e.isConnected).map(e => e.getBoundingClientRect()).filter(r => r.width);
        const trick = rs.length ? new DOMRect(Math.min(...rs.map(r => r.left)), Math.min(...rs.map(r => r.top)), Math.max(...rs.map(r => r.right)) - Math.min(...rs.map(r => r.left)), Math.max(...rs.map(r => r.bottom)) - Math.min(...rs.map(r => r.top))) : null;
        return [rail, trick];
      },
    });
    $('#bRules', root).onclick = () => modal(rulesHTML());
    $('#bExit', root).onclick = () => this.onExit();
    $('#layer', root).addEventListener('click', ev => {
      const b = (ev.target as HTMLElement).closest('button[data-lpos]') as HTMLElement | null;
      if (b && this.liseChoosing()) this.send({ t: 'choose', v: { seat: Number(b.dataset.lseat), pos: Number(b.dataset.lpos) } });
    });
    $('#hand', root).addEventListener('click', ev => { const el = (ev.target as HTMLElement).closest('.card') as HTMLElement | null; if (el) this.handClick(Number(el.dataset.id)); });
    const hid = (ev: Event) => { const el = (ev.target as HTMLElement).closest?.('.card') as HTMLElement | null; return el ? Number(el.dataset.id) : null; };
    $('#hand', root).addEventListener('mouseover', ev => { if (!TOUCH()) this.showHint(hid(ev)); });
    $('#hand', root).addEventListener('focusin', ev => this.showHint(hid(ev)));
    $('#hand', root).addEventListener('mouseleave', () => { if (!TOUCH()) this.showHint(null); });
    this.ticker = setInterval(() => this.tick(), 1000);
    $('#hand', root).addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { const el = (ev.target as HTMLElement).closest('.card') as HTMLElement | null; if (el) { ev.preventDefault(); this.handClick(Number(el.dataset.id)); } } });
    addEventListener('resize', this.onResize);
    this.handObs = new ResizeObserver(() => this.onResize()); this.handObs.observe($('#hand', root)); document.addEventListener('visibilitychange', this.onVis);
  }
  private onResize = () => { cancelAnimationFrame(this.resizeRaf); this.resizeRaf = requestAnimationFrame(() => { this.renderTable(); this.renderHand(); }); };
  private onVis = () => { if (!document.hidden) document.title = this.baseTitle; };
  /** Joueurs connectés au canal de la partie (présence Realtime), pour l'aperçu au survol. */
  setOnline(uids: string[]) { this.online = new Set(uids); }
  private seatInfo(seat: number) {
    const pb = this.pub; const p = pb?.players[seat]; if (!pb || !p) return null;
    const uid = this.backend.seatUids?.[seat] ?? null, me = seat === this.mySeat;
    return {
      seat, uid, bot: p.bot, me, name: p.name, color: this.colorOf(seat), avatar: { ...(this.avatars[seat] || {}), letter: p.name, color: this.colorOf(seat) },
      place: 1 + pb.players.filter(q => q.score > p.score).length, score: p.score, won: p.won, round: pb.round, rounds: roundsOf(pb.opts),
      bid: pb.bidsRevealed ? p.bid : me ? this.priv?.bid ?? null : null,
      // manches terminées à l'écran (l'état affiché n'a pas l'historique : il vient du dernier état reçu, sans rien dévoiler d'avance)
      hist: ((this.latest?.pub.players[seat]?.hist ?? p.hist ?? []) as any[]).filter(h => h.r < pb.round || pb.phase === 'end').map(h => ({ bid: h.bid, won: h.won })), online: this.online && uid ? this.online.has(uid) : null,
    };
  }
  destroy() { this.cards?.destroy(); this.closeFin(); setZoomNote(null); this.handObs?.disconnect(); clearInterval(this.ticker); clearTimeout(this.liseTimer); this.thread?.remove(); this.roundOpen?.close(); removeEventListener('resize', this.onResize); document.removeEventListener('visibilitychange', this.onVis); this.queue = []; document.title = this.baseTitle; }

  /** État de référence (dernier état du serveur), appliqué quand les animations sont terminées. */
  setLatest(pub: PublicView, priv: PrivateView | null) {
    if (!this.latest) {
      // premier état reçu : les manches déjà terminées sont « vues » (hormis celles dont l'événement 'round' attend encore dans la file)
      const done = pub.players[0]?.hist?.length ?? 0, queued = this.queue.filter(e => e.k === 'round').length;
      this.shownRound = Math.max(this.shownRound, done - queued);
    }
    this.latest = { pub, priv };
    if (this.finEl) this.fillSettled();
    if (!this.running && !this.queue.length) this.applyLatest();
    // révélation de Marie Thorne en cours : la main qui porte la carte imposée vient d'arriver, on la montre sans attendre la fin de la file
    else if (this.running && this.evk === 'lise' && this.liseNow()) { this.renderHand(); this.renderAction(); }
  }
  push(events: any[]) { if (!events.length) return; this.queue.push(...events); this.run(); }

  private applyLatest() {
    if (!this.latest) return;
    this.pub = this.latest.pub; this.priv = this.latest.priv; this.evk = null; this.logLines = this.pub.log.slice();
    this.banner = null; this.render();
    this.maybeFinal();
  }
  private async run() {
    if (this.running) return; this.running = true;
    try {
      while (this.queue.length) {
        if (this.roundGate) await this.roundGate;
        const ev = this.queue.shift();
        this.pub = ev.snap; this.evk = ev.k; const last = ev.snap.log?.at(-1);
        if (ev.k === 'lise') this.startLise(ev.by, ev.seat, ev.pos);
        if (last && JSON.stringify(this.logLines.at(-1)) !== JSON.stringify(last)) this.logLines.push(last);
        if (ev.k === 'trick') this.banner = ev.msg; else if (ev.k !== 'play') this.banner = null;
        this.render();
        if (ev.k === 'lise') this.drawThread();
        if (ev.k === 'trick') { sfx.win(); this.trickFx(ev.snap.trick?.res?.mode ?? null); } else if (ev.k === 'bids') sfx.coin();
        // fin de manche : la suite attend que la fenêtre soit fermée (tout le monde prêt, ou délai écoulé)
        if (ev.k === 'round') { this.roundGate = this.roundEnd(ev.snap); await this.roundGate; }
        let ms = (DELAY[ev.k] ?? 300) * this.speed * (this.queue.length > 40 ? .2 : 1);
        // dernier événement et c'est à nous : on laisse juste la carte arriver, inutile de faire attendre le joueur
        if (!this.queue.length && ev.k === 'play' && this.mySeat != null && ev.snap.current === this.mySeat) ms = Math.min(ms, 550);
        await sleep(ms);
        if (ev.k === 'bids' || ev.k === 'trick') this.banner = null;
      }
    } finally { this.running = false; }
    this.applyLatest();
  }
  private get live() { return !this.running && !this.queue.length && !!this.latest && this.pub === this.latest.pub; }

  /* ---------- Rendu ---------- */
  private bottom() { return this.mySeat ?? 0; }
  render() { if (!this.pub) return; this.renderBar(); this.renderTable(); this.renderHand(); this.renderMini(); this.renderStakes(); this.renderLog(); this.renderAction(); this.turnCue(); }
  /** Signale le début de son tour : son, barre d'action qui s'illumine, titre de l'onglet. */
  private turnCue() {
    const pb = this.pub!, pv = this.priv;
    const mine = this.live && !this.busy && this.mySeat != null && !!pv && pb.phase !== 'end' &&
      ((pb.phase === 'bid' && pv.bid == null) || (pb.pending ? pb.pending.seat === this.mySeat : pb.current === this.mySeat));
    $('#action', this.root).classList.toggle('mine', mine);
    if (mine && !this.wasMyTurn && document.hidden) notifyTurn();
    if (mine && !this.wasMyTurn) { this.turnStart = Date.now(); this.previewId = null; sfx.turn(); const a = $('#action', this.root); a.classList.remove('nudge'); void a.offsetWidth; a.classList.add('nudge'); }
    this.wasMyTurn = mine;
    document.title = mine && document.hidden ? '⚓ À vous de jouer ! · ' + this.baseTitle : this.baseTitle;
  }
  private get animMs() { return reduceMotion() ? 0 : Math.max(.5, Math.min(this.speed, 1.4)); }
  private renderBar() {
    const pb = this.pub!;
    setHTML($('#gRound', this.root), pb.round ? `Manche ${pb.round}` : 'Partie');
    // téléphone : « Manche 7 · pli 2/7 » ; ordinateur : « sur 10 · 7 cartes · pli 2 sur 7 »
    if (this.mob) { setHTML($('#gSub', this.root), pb.phase === 'play' && pb.trickNo ? `· pli ${pb.trickNo}/${pb.cards}` : pb.phase === 'bid' ? '· mises' : ''); }
    const parts = [`sur ${roundsOf(pb.opts)}`]; if (pb.cards) parts.push(`${pb.cards} carte${pb.cards > 1 ? 's' : ''}`);
    if (pb.phase === 'bid') parts.push('mises'); else if (pb.phase === 'play' && pb.trickNo) parts.push(`pli ${pb.trickNo} sur ${pb.cards}`);
    else if (pb.phase === 'end') parts.splice(0, parts.length, 'partie terminée');
    if (!this.mob) setHTML($('#gSub', this.root), parts.join(' · '));
    let h = ''; for (let r = 1; r <= roundsOf(pb.opts); r++) h += `<i class="${r < pb.round || pb.phase === 'end' ? 'done' : r === pb.round ? 'now' : ''}" title="Manche ${r}"></i>`;
    setHTML($('#gDots', this.root), h);
  }
  /** Met le plateau (1040 × 520) à l'échelle de la place disponible ; l'action et la main prennent la même largeur. */
  private get mob() { return innerWidth < 720; }
  private fitBoard() {
    const mob = this.mob; this.root.classList.toggle('mob', mob);
    if (!mob) this.root.classList.remove('drawer');
    const st = $('#bstage', this.root); st.style.width = (mob ? MW : BW) + 'px'; st.style.height = (mob ? MH : BH) + 'px';
    const board = $('#table', this.root), w = board.clientWidth, h = board.clientHeight;
    if (!w || !h) return;
    const k = mob ? w / MW : Math.max(.3, Math.min(w / BW, h / (BH + 28)));
    $('#bstage', this.root).style.setProperty('--k', k.toFixed(4)); this.k = k;
    $('.tstage', this.root).style.setProperty('--bw', Math.round(BW * k) + 'px');
  }
  private bidOf(i: number) {
    const p = this.pub!.players[i];
    if (this.pub!.bidsRevealed) return { txt: String(p.bid), wait: false };
    if (i === this.mySeat && this.priv?.bid != null) return { txt: String(this.priv.bid), wait: false };
    return { txt: p.hasBid ? '✓' : '…', wait: true };
  }
  /* ---------- Avatars (profils des joueurs, transmis par la page de partie) ---------- */
  private avatars: (AvatarData | null)[] = [];
  /** Avatars et couleurs des sièges (null : bot ou joueur sans profil, initiale sur la couleur par défaut). */
  setAvatars(list: (AvatarData | null)[]) { this.avatars = list; if (this.pub) this.render(); }
  private colorOf(i: number) { return this.avatars[i]?.color || PCOL[i % 9]; }
  private avatar(i: number, name: string, size: number) { return avatarHTML({ ...(this.avatars[i] || {}), letter: name, color: this.colorOf(i) }, size, size >= 50 ? `0 0 0 2px #1b140e,0 0 0 4px ${this.colorOf(i)}` : undefined); }

  /* ---------- Marie Thorne ---------- */
  private lise: { by: number; seat: number; pos: number; until: number } | null = null;
  private liseTimer: any = 0;
  /** C'est à moi de choisir une carte face cachée. */
  private liseChoosing() { const pd = this.pub?.pending; return this.live && !this.busy && !!pd && pd.t === 'mary' && pd.seat === this.mySeat; }
  /** Révélation en cours (environ 2,5 s). */
  private liseNow() { return this.lise && Date.now() < this.lise.until ? this.lise : null; }
  /** Carte imposée à moi : l'état de référence est plus récent que l'instantané rejoué. */
  private liseCard() { return this.latest?.priv?.forced ?? this.priv?.forced ?? null; }
  private startLise(by: number, seat: number, pos: number) {
    const ms = LISE_MS * this.speed; // même durée que la pause de l'événement « lise »
    this.lise = { by, seat, pos, until: Date.now() + ms };
    clearTimeout(this.liseTimer); this.liseTimer = setTimeout(() => { this.lise = null; this.thread?.remove(); if (this.pub) this.render(); }, ms + 30);
    sfx.coin();
  }
  /** Éventails face cachée : au choix (chez tous les joueurs ciblables), puis à la révélation (main ciblée). */
  private renderLise(geo: Spot[] | null, mob: boolean) {
    const pb = this.pub!, me = this.mySeat, n = pb.players.length, b = this.bottom();
    const box = this.piece('liseEl', 'lisebox', ''); box.classList.toggle('mob', mob);
    const fans: string[] = [];
    const place = (seat: number, count: number) => {
      if (!geo) return '';
      const g = geo[(seat - b + n) % n], w = 42 + (count - 1) * 30 + 24, h = 77;
      const x = Math.min(Math.max(g.px, w / 2 + 6), BW - w / 2 - 6), y = g.py < 400 ? g.py + 50 : g.py - 50 - h;
      return `left:${x}px;top:${y}px`;
    };
    const owner = (seat: number) => seat === me ? 'votre main' : 'la main ' + de(pb.players[seat].name);
    if (this.liseChoosing()) {
      for (const o of (pb.pending!.opts as any[]) || []) {
        const who = o.v === me ? 'Vous' : pb.players[o.v].name;
        let backs = '';
        for (let j = 0; j < o.count; j++) backs += `<button class="bk2 ok" data-lseat="${o.v}" data-lpos="${j}" aria-label="Carte ${j + 1} ${o.v === me ? 'de votre main' : esc(de(pb.players[o.v].name))}">${backFace()}</button>`;
        fans.push(`<div class="lfan pick" role="group" aria-label="${esc(owner(o.v))}" style="${place(o.v, o.count)}"><span class="lname">${esc(who)}</span><div class="lbacks">${backs}</div></div>`);
      }
    } else {
      const lf = this.liseNow();
      // la cible voit sa vraie carte dans sa main ; les autres (et celui qui a choisi) voient l'éventail face cachée
      if (lf && (me !== lf.seat || me === lf.by)) {
        const count = pb.players[lf.seat].handCount, by = lf.by === me ? 'vous' : pb.players[lf.by].name;
        let backs = '';
        // maquettes Marie Thorne / LiseAutres : « Imposée » chez celui qui a choisi, « Choisie par Théo » chez les autres
        for (let j = 0; j < count; j++) backs += `<div class="bk2 ${j === lf.pos ? 'pick' : 'off'}">${backFace()}${j === lf.pos ? `<span class="listag">${lf.by === me ? 'Imposée' : 'Choisie par ' + esc(by)}</span>` : ''}</div>`;
        const cap = lf.seat === me ? 'Vous devrez la jouer' : pb.players[lf.seat].name + ' devra la jouer';
        fans.push(`<div class="lfan done" id="liseFan" role="group" aria-label="${esc(owner(lf.seat))}" style="${place(lf.seat, count)}"><span class="lname">${esc(lf.seat === me ? 'Vous' : pb.players[lf.seat].name)}</span><div class="lbacks">${backs}</div><span class="lcap">${esc(cap)}</span></div>`);
      }
    }
    setHTML(box, fans.join('')); box.hidden = !fans.length;
  }
  /** Centre de la table pendant le pouvoir de Marie Thorne (maquettes Marie Thorne, LiseAutres, LiseCible) : portrait, titre, explication. */
  private liseMid(): string | null {
    const pb = this.pub!, me = this.mySeat, pd = pb.pending, lf = this.liseNow();
    const nm = (i: number) => pb.players[i]?.name ?? '?';
    // téléphone : les éventails occupent déjà tout le plateau
    if (this.mob && (this.liseChoosing() || (lf && (me !== lf.seat || me === lf.by)))) return null;
    let by: number, text: string;
    if (lf) {
      by = lf.by; const nth = lf.pos ? `${lf.pos + 1}e` : '1re';
      if (lf.seat === me) text = by === me ? 'Vous avez tiré une carte dans votre propre main.' : 'Une carte a été tirée au hasard dans votre main.';
      else if (by === me) text = 'Carte imposée. Personne ne sait laquelle, pas même vous.';
      else text = `${nth} carte ${lf.seat === by ? 'de sa propre main' : de(nm(lf.seat))} : ${nm(lf.seat)} devra la jouer au prochain pli.`;
    } else if (pd && pd.t === 'mary' && pb.phase === 'play') {
      by = pd.seat;
      text = by === me ? "Choisissez une carte face cachée dans la main d'un joueur, la vôtre comprise." : `${nm(by)} choisit une carte face cachée dans la main d'un joueur.`;
    } else return null;
    const title = by === me ? `Pouvoir de ${PIRATES.mary.n}` : `${nm(by)} utilise ${PIRATES.mary.n}`;
    return `<div class="lisemid">${LISE_PORTRAIT}<b>${esc(title)}</b><span>${esc(text)}</span></div>`;
  }
  private thread: SVGSVGElement | null = null;
  /** Fil doré en pointillés, de la plaque de celui qui a choisi vers la main ciblée (coordonnées de l'écran). */
  private drawThread() {
    const lf = this.liseNow(); this.thread?.remove(); this.thread = null; if (!lf) return;
    const from = this.anchor(lf.by)?.getBoundingClientRect();
    const toEl = (this.root.querySelector('#liseFan') as HTMLElement | null) ?? (lf.seat === this.mySeat ? $('#hand', this.root) : this.anchor(lf.seat));
    const to = toEl?.getBoundingClientRect(); if (!from || !to) return;
    const [x1, y1] = center(from), [x2, y2] = center(to), mx = (x1 + x2) / 2 + (y2 - y1) * .25, my = (y1 + y2) / 2 - Math.abs(x2 - x1) * .15;
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'lthread'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<path d="M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" fill="none" stroke="#ead08a" stroke-width="2.5" stroke-linecap="round" opacity=".85"/>`;
    document.body.append(svg); this.thread = svg;
  }
  /** Repère d'un joueur pour les animations : sa plaque (ordinateur), sa case du bandeau ou votre ligne (téléphone). */
  private anchor(i: number): HTMLElement | null {
    if (!this.mob) return this.seatEls[i] ?? null;
    return i === this.mySeat ? this.root.querySelector('#meav') as HTMLElement | null : this.oppEls[i] ?? null;
  }
  /** Bandeau des adversaires (téléphone) : avatar, nom, jauge plis / mise ou état de la mise, score. */
  private renderOpps() {
    const box = $('#opps', this.root), pb = this.pub!; box.hidden = !this.mob; if (!this.mob) return;
    const n = pb.players.length, b = this.bottom();
    for (let rel = 1; rel < n; rel++) {
      const i = (b + rel) % n, p = pb.players[i];
      let el = this.oppEls[i]; if (!el || !el.isConnected) { el = document.createElement('div'); el.className = 'opp'; box.append(el); this.oppEls[i] = el; }
      el.style.setProperty('--pc', this.colorOf(i)); el.classList.toggle('active', this.isActive(i));
      let st: string;
      if (pb.bidsRevealed && p.bid != null) st = `<b class="og ${p.won > p.bid ? 'over' : p.won === p.bid ? 'ok' : ''}">${p.won}/${p.bid}</b>`;
      else st = `<span class="ost">${p.hasBid ? 'a misé' : 'réfléchit…'}</span>`;
      setHTML(el, `<div class="oh">${this.avatar(i, p.name, 30)}<span class="onm">${esc(p.name)}</span>${pb.phase === 'play' && pb.leader === i ? '<span class="oent" title="Entame">E</span>' : ''}</div>
        <div class="ob">${st}<span>${p.score} pts</span></div>`);
    }
  }
  /** Morceaux de la ligne « vous » du téléphone : avatar avec anneau de tour, puis jauge plis / mise. */
  private meRow(part: 'pre' | 'post') {
    const pb = this.pub, me = this.mySeat; if (!this.mob || !pb || me == null) return '';
    const p = pb.players[me];
    if (part === 'pre') {
      const ring = this.isActive(me) ? '<svg class="ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="rgba(43,33,23,.15)" stroke-width="3"/><circle class="run" cx="20" cy="20" r="18" fill="none" stroke="#8a5e0e" stroke-width="3" stroke-linecap="round" transform="rotate(-90 20 20)"/></svg>' : '';
      return `<div class="meav" id="meav" style="--pc:${this.colorOf(me)}">${ring}<b>${this.avatar(me, p.name, 30)}</b></div>`;
    }
    if (!(pb.bidsRevealed && p.bid != null)) return '';
    return `<div class="megauge ${p.won > p.bid ? 'over' : p.won === p.bid ? 'ok' : ''}"><small>PLIS/MISE</small><b>${p.won}/${p.bid}</b></div>`;
  }
  /** Menu du téléphone : les boutons de la barre qui n'y tiennent pas. */
  private async menu() {
    const v = await modal('<h2>Menu</h2><p class="sub">Partie en cours.</p>', [
      { label: 'Dernier pli', value: 'last', cls: 'alt' }, { label: 'Règles', value: 'rules', cls: 'alt' },
      { label: soundOn() ? 'Couper le son' : 'Activer le son', value: 'sound', cls: 'alt' },
      { label: `Vitesse : ${this.speed === 1 ? 'normale' : this.speed > 1 ? 'lente' : 'rapide'}`, value: 'speed', cls: 'alt' },
      { label: 'Quitter la table', value: 'exit', cls: 'alt' }, { label: 'Fermer', value: null }]);
    if (v === 'last') this.lastTrickModal(); else if (v === 'rules') modal(rulesHTML()); else if (v === 'exit') this.onExit();
    else if (v === 'sound') { ($('#bSound', this.root) as HTMLButtonElement).click(); }
    else if (v === 'speed') { const sp = $('#speed', this.root) as HTMLSelectElement; const o = ['1', '0.45', '1.7']; sp.value = o[(o.indexOf(sp.value) + 1) % 3]; sp.dispatchEvent(new Event('change')); toast('Vitesse : ' + sp.selectedOptions[0].text.toLowerCase()); }
  }
  /** Joueur dont on attend l'action : celui qui joue (ou choisit), ou vous tant que vous n'avez pas misé. */
  private isActive(i: number) {
    const pb = this.pub!;
    if (pb.phase === 'play') return (pb.pending ? pb.pending.seat : pb.current) === i;
    return pb.phase === 'bid' && i === this.mySeat && this.priv?.bid == null;
  }
  private podHTML(i: number, active: boolean) {
    const pb = this.pub!, p = pb.players[i], me = i === this.mySeat;
    const ring = active ? `<svg class="ring" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="27" fill="none" stroke="rgba(234,208,138,.18)" stroke-width="3"/><circle class="run" cx="30" cy="30" r="27" fill="none" stroke="#ead08a" stroke-width="3" stroke-linecap="round" transform="rotate(-90 30 30)"/></svg>` : '';
    const lead = pb.phase === 'play' && pb.leader === i ? '<span class="entame">ENTAME</span>' : '';
    let status = `${p.score} pts · ${p.handCount} carte${p.handCount > 1 ? 's' : ''}`, gold = false, right: string;
    const lf = this.liseNow();
    if (lf && lf.by === i) { status = `joue ${PIRATES.mary.n}`; gold = true; }
    else if (pb.phase === 'play' && (pb.forcedSeats || []).includes(i)) { status = 'carte imposée'; gold = true; }
    const revealing = this.evk === 'bids' && pb.bidsRevealed && p.bid != null;
    if (revealing) {
      // révélation simultanée : toutes les pièces se retournent, avec un léger décalage d'un joueur à l'autre
      const rel = (i - this.bottom() + pb.players.length) % pb.players.length;
      right = `<div class="bidst"><div class="open flip" style="animation-delay:calc(${rel * 90}ms * var(--spd,1))">${p.bid}</div></div>`;
      status = `mise ${p.bid} pli${p.bid! > 1 ? 's' : ''}`; gold = true;
    } else if (pb.bidsRevealed && p.bid != null) {
      const cls = p.won > p.bid ? 'over' : p.won === p.bid ? 'ok' : '';
      right = `<div class="gauge ${cls}" title="Plis remportés / mise"><small>plis / mise</small><b>${p.won} / ${p.bid}</b></div>`;
    } else if (me && this.priv) {
      if (this.priv.bid == null) { right = '<div class="bidst"><div class="unknown">?</div></div>'; status = 'à vous de miser'; gold = true; }
      else { right = `<div class="bidst"><div class="sealed">${SEAL}</div></div>`; status = `mise scellée : ${this.priv.bid}`; }
    } else if (p.hasBid) { right = `<div class="bidst"><div class="sealed">${SEAL}</div></div>`; status = 'a misé'; }
    else { right = '<div class="bidst"><div class="think"><i></i><i></i><i></i></div></div>'; status = 'réfléchit…'; }
    return `<div class="av">${ring}${this.avatar(i, p.name, 56)}</div>
      <div class="pinfo"><div class="pn"><span class="nm">${esc(p.name)}</span>${lead}</div><div class="ps ${gold ? 'gold' : ''}">${status}</div></div>${right}`;
  }
  renderTable() {
    const pb = this.pub; if (!pb) return;
    this.fitBoard();
    const tbl = $('#table', this.root), layer = $('#layer', this.root);
    const n = pb.players.length, mob = this.mob, b = this.bottom(), geo = mob ? mobileGeometry(n) : geometry(n);
    // taille des cartes du pli, en px du plateau (92 px de large à 3-4 joueurs ; 74 px sur téléphone)
    const ts = (mob ? (n <= 5 ? 74 : n <= 7 ? 62 : 54) : (n <= 4 ? 92 : n <= 6 ? 84 : 76)) / 252;
    tbl.style.setProperty('--ts', ts.toFixed(3));
    if (this.seatEls.length && !this.seatEls[0].isConnected) { this.seatEls = []; this.centerEl = null; this.tcards.clear(); }

    this.renderOpps();
    this.renderLise(mob ? null : geometry(n), mob);
    pb.players.forEach((p, i) => {
      const g = geo[(i - b + n) % n];
      let el = this.seatEls[i];
      if (!el) { el = document.createElement('div'); el.className = 'pod'; layer.append(el); this.seatEls[i] = el; }
      el.style.left = g.px + 'px'; el.style.top = g.py + 'px'; el.style.setProperty('--pc', this.colorOf(i));
      const active = this.isActive(i);
      el.classList.toggle('active', active); el.classList.toggle('liseby', this.liseNow()?.by === i); el.classList.toggle('me', i === this.mySeat); el.classList.toggle('cpt', n >= 6);
      setHTML(el, this.podHTML(i, active));
      // pli remporté : la jauge grossit et « +1 pli » s'élève au-dessus de la plaque
      const pw = this.prevWon[i];
      if (pw != null && p.won > pw && pb.bidsRevealed && this.animMs) {
        const gg = el.querySelector('.gauge') as HTMLElement | null; if (gg) this.animate(gg, 'bump', {}, 550);
        const plus = document.createElement('div'); plus.className = 'plus1'; plus.textContent = '+1 pli';
        if (mob) { plus.classList.add('anch'); this.anchor(i)?.append(plus); } else { plus.style.left = (g.px + 70) + 'px'; plus.style.top = (g.py - 46) + 'px'; layer.append(plus); } this.animate(plus, 'go', {}, 1800, () => plus.remove());
      }
      this.prevWon[i] = p.won;
      // variation de score : bulle +/- au-dessus de la plaque (posée sur le plateau pour survivre aux mises à jour de la plaque)
      const prev = this.prevScores[i];
      if (prev != null && prev !== p.score && !reduceMotion()) {
        const d = p.score - prev, f = document.createElement('div');
        f.className = 'float ' + (d < 0 ? 'neg' : ''); f.textContent = (d > 0 ? '+' : '') + d;
        if (mob) this.anchor(i)?.append(f); else { f.style.left = g.px + 'px'; f.style.top = (g.py - 46) + 'px'; layer.append(f); }
        setTimeout(() => f.remove(), 2000);
      }
      this.prevScores[i] = p.score;
    });
    // pli en cours, en croix : chaque carte devant son joueur (élément conservé, qui arrive en volant et repart vers le gagnant)
    if (this.playedRound !== pb.round) { this.playedRound = pb.round; this.playedMine.clear(); }
    const t = pb.trick, want = new Set<string>(), cw = 252 * ts, ch = 352 * ts;
    const slotOf = (seat: number) => geo[(seat - b + n) % n];
    const lead = { at: null as [number, number] | null };
    if (t) {
      const base = `${pb.round}-${pb.trickNo}`, cnt: Record<number, number> = {}, seen: Record<number, number> = {};
      t.entries.forEach(e => { cnt[e.p] = (cnt[e.p] || 0) + 1; });
      const li = this.leadIndex();
      t.entries.forEach((e, idx) => {
        const key = `${base}-${idx}`; want.add(key); if (e.p === this.mySeat) this.playedMine.add(e.card.id);
        const j = seen[e.p] = (seen[e.p] ?? -1) + 1, g = slotOf(e.p);
        const x = g.sx + (j - (cnt[e.p] - 1) / 2) * cw * .55, y = g.sy;
        let w = this.tcards.get(key); const fresh = !w;
        if (!w) {
          w = elFrom(`<div class="tslot">${cardHTML(e.card, e)}${e.imposed ? '<span class="imptag">Imposée</span>' : ''}<span class="who" style="--pc:${this.colorOf(e.p)}"></span></div>`);
          (w.firstElementChild as HTMLElement).style.rotate = `${g.r}deg`;
          layer.append(w); this.tcards.set(key, w);
        }
        w.style.left = x + 'px'; w.style.top = y + 'px'; w.style.zIndex = String(10 + idx);
        const c = w.firstElementChild as HTMLElement, res = t.res;
        c.classList.toggle('win', !!res && res.winner === idx);
        c.classList.toggle('gone', res ? (!!res.removed?.includes(idx) || !!res.discarded) : !!t.removals?.includes(idx));
        if (li === idx) lead.at = [x, y + ch / 2 + 16];
        const who = w.querySelector('.who') as HTMLElement;
        who.textContent = pb.players[e.p].name + (mob && li === idx ? ' · en tête' : ''); who.classList.toggle('lead', mob && li === idx);
        who.hidden = !(mob || n > 4);
        if (fresh) this.flyIn(c, e.p, e.card.id);
      });
      this.collectTo = t.res ? (t.res.winner != null ? t.entries[t.res.winner].p : -1) : null;
    }
    let out = 0;
    for (const [key, w] of this.tcards) if (!want.has(key)) { this.tcards.delete(key); this.flyOut(w, this.collectTo, out++); }
    if (!t) this.collectTo = null;

    // « En tête » : une seule étiquette, qui glisse d'une carte à l'autre
    const tag = this.piece('leadEl', 'leadtag2', 'En tête');
    tag.hidden = !lead.at || mob; if (lead.at) { tag.style.left = lead.at[0] + 'px'; tag.style.top = lead.at[1] + 'px'; }
    // couleur demandée, au-dessus de la croix
    const chip = this.piece('chipEl', 'askchip', '');
    const topY = Math.min(...geo.map(g => g.sy)) - ch / 2 - 18;
    chip.style.left = (mob ? MW : BW) / 2 + 'px'; chip.style.top = Math.max(14, topY) + 'px';
    const ls = t && t.entries.length ? leadSuitOf(t.entries) : null;
    chip.hidden = !(pb.phase === 'play' && t && t.entries.length);
    setHTML(chip, ls ? `<i class="s-${ls}"></i>${SUIT[ls].n} demandé` : 'Aucune couleur demandée');
    chip.classList.toggle('none', !ls);
    // emplacement vide « Votre carte » quand c'est à vous
    const empty = this.piece('emptyEl', 'yourslot', 'Votre carte');
    const mine = this.mySeat != null && pb.phase === 'play' && !pb.pending && pb.current === this.mySeat && !this.sendingId;
    empty.hidden = !mine;
    if (mine) { const g = slotOf(this.mySeat!); empty.style.left = g.sx + 'px'; empty.style.top = g.sy + 'px'; empty.style.width = cw + 'px'; empty.style.height = ch + 'px'; empty.style.rotate = g.r + 'deg'; }

    let mid = ''; const lm = this.banner ? null : this.liseMid();
    if (this.banner) {
      const res = pb.trick?.res, we = res && res.winner != null ? pb.trick!.entries[res.winner] : null;
      const sub = we ? `<small>avec ${esc(cname(we.card, we))}</small>` : '';
      mid = `<div class="banner ${this.bannerShown !== this.banner ? 'fresh' : ''}">${esc(vous(this.banner))}${sub}</div>`; this.bannerShown = this.banner; }
    else if (lm) mid = lm;
    else if (pb.phase === 'bid' || this.evk === 'bids') {
      const n2 = pb.players.length, sealed = pb.players.filter(p => p.hasBid).length;
      let line = `Mises secrètes · ${sealed} joueur${sealed > 1 ? 's' : ''} sur ${n2} ${sealed > 1 ? 'ont' : 'a'} misé`, note = '';
      if (this.evk === 'bids' && pb.bidsRevealed) {
        const tot = pb.players.reduce((a, p) => a + (p.bid ?? 0), 0), d = pb.cards - tot;
        line = `Total misé : ${tot} pour ${pb.cards} pli${pb.cards > 1 ? 's' : ''}`;
        note = d > 0 ? `<div class="bidnote ok">${d} pli${d > 1 ? 's' : ''} que personne n'a réclamé${d > 1 ? 's' : ''}</div>`
          : d === 0 ? '<div class="bidnote gold">Autant de mises que de plis : chaque pli compte</div>'
          : '<div class="bidnote ko">Plus de mises que de plis : la bataille sera rude</div>';
      }
      mid = `<div class="bidcenter"><div class="bt">Manche ${pb.round}</div><div class="bs">${pb.cards} carte${pb.cards > 1 ? 's' : ''} · ${pb.cards} pli${pb.cards > 1 ? 's' : ''} à prendre</div><div class="bp ${this.evk === 'bids' ? 'pop' : ''}">${line}</div>${note}</div>`;
    }
    if (!this.centerEl) { this.centerEl = document.createElement('div'); this.centerEl.className = 'center'; layer.append(this.centerEl); }
    setHTML(this.centerEl, mid); this.centerEl.classList.toggle('front', !!this.banner || !!lm);
  }
  /** Élément unique posé sur le plateau (créé à la demande). */
  private pieces: Record<string, HTMLElement> = {};
  private piece(key: string, cls: string, text: string) {
    let el = this.pieces[key];
    if (!el || !el.isConnected) { el = document.createElement('div'); el.className = cls; el.textContent = text; el.hidden = true; $('#layer', this.root).append(el); this.pieces[key] = el; }
    return el;
  }
  private tick() {
    const el = this.root.querySelector('#tLeft'); if (!el) return;
    el.textContent = Math.ceil(Math.max(0, TURN_S - (Date.now() - this.turnStart) / 1000)) + ' s';
  }
  /** Ce qui se passerait si l'on jouait cette carte maintenant : texte et ton (vert = prend le pli, brun = perd, rouge = bloquée). */
  private preview(id: number): { text: string; tone: 'win' | 'lose' | 'no' } | null {
    const pb = this.pub, pv = this.priv, me = this.mySeat;
    if (!pb?.trick || !pv || me == null) return null;
    const c = pv.hand.find(x => x.id === id); if (!c) return null;
    const t = pb.trick;
    if (!pv.legal.includes(id)) {
      if (pv.forced != null) return { text: `Bloquée : ${PIRATES.mary.n} vous impose une autre carte`, tone: 'no' };
      const ls = leadSuitOf(t.entries);
      return { text: ls ? `Bloquée : vous devez fournir ${du(SUIT[ls].n)}` : 'Bloquée pour ce pli', tone: 'no' };
    }
    // cartes à choix : on essaie chaque possibilité et on annonce le meilleur cas
    const variants: Partial<Entry>[] = [];
    if (c.kind === 'tigress') variants.push({ as: 'pirate' }, { as: 'escape' });
    else if (c.zf) variants.push({ val: 14 }, { val: 0 });
    else if (c.wild) { const r = wildRule(t.entries); if (r.choose) WILD_SUITS.forEach(s => variants.push({ ws: s })); else variants.push({ ws: r.auto ?? null }); }
    else variants.push({});
    const removals = (t.removals || []).map(i => t.entries[i]);
    const outs = variants.flatMap(v => {
      const e = { p: me, card: c, ...v } as Entry;
      try { const R = resolve([...t.entries, e], removals); return [{ e, R, win: R.winner === e }]; } catch { return []; }
    });
    if (!outs.length) return null;
    const best = outs.find(o => o.win) ?? outs[0];
    const choice = outs.some(o => o.win) && outs.some(o => !o.win);
    const name = choice || variants.length > 1 ? cname(c) : cname(c, best.e), tail = choice ? ', selon votre choix' : '';
    const owner = (p: number) => p === me ? 'vous' : pb.players[p].name;
    if (best.R.discarded) return { text: `${name} : le pli serait défaussé`, tone: 'lose' };
    if (best.win) {
      if (!t.entries.length) return { text: `Vous entamez avec ${name}${c.kind === 'num' && !c.wild ? ' : la couleur demandée sera ' + SUIT[c.suit as string].n : ''}`, tone: 'win' };
      const li = this.leadIndex(), cur = li != null ? t.entries[li] : null;
      if (!cur || cur.p === me) return { text: `${name} prend le pli${tail}`, tone: 'win' };
      const curName = cur.card.kind === 'num' && !cur.card.wild ? `le ${cur.val ?? cur.card.rank}` : cname(cur.card, cur);
      return { text: `${name} bat ${curName} ${de(owner(cur.p))} : vous prenez le pli${tail}`, tone: 'win' };
    }
    const w = best.R.winner;
    return { text: `${name} est trop faible : ${!w ? 'personne ne prend le pli' : w.p === me ? 'vous gardez le pli' : `${owner(w.p)} garde le pli`}`, tone: 'lose' };
  }
  /** Pastille sous la carte agrandie (maquette Main) : verdict pendant votre tour, sinon invitation à lire la carte. */
  private zoomNote(card: HTMLElement): { text: string; ink: string } | null {
    if (!this.root.contains(card) || !card.closest('#hand')) return null;
    const id = Number(card.dataset.id), pv = this.priv, t = this.pub?.trick;
    if (this.myTurnToPlay() && pv && t && pv.hand.some(c => c.id === id)) {
      if (!pv.legal.includes(id)) {
        const ls = leadSuitOf(t.entries);
        return { text: pv.forced != null ? 'Bloquée : une autre carte vous est imposée' : ls ? `Bloquée : fournissez ${du(SUIT[ls].n)}` : 'Bloquée', ink: '#f0a08b' };
      }
      const p = this.preview(id);
      if (p) return p.tone === 'win' ? { text: 'Prendrait le pli', ink: '#9bd69f' } : { text: 'Ne prendrait pas le pli', ink: '#ead08a' };
      return { text: 'Jouable', ink: '#9bd69f' };
    }
    return { text: TOUCH() ? "Maintenez l'appui pour lire la carte" : 'Maintenez le survol pour lire la carte', ink: '#d9cdb6' };
  }
  /** Met à jour la deuxième ligne du bandeau pendant votre tour (survol, focus, premier appui sur téléphone). */
  private showHint(id: number | null) {
    const el = this.root.querySelector('#hint') as HTMLElement | null; if (!el) return;
    const p = id == null ? null : this.preview(id);
    el.className = 'hint ' + (p ? p.tone : '');
    el.textContent = p ? p.text : TOUCH() ? 'Touchez une carte pour voir si elle prend le pli, touchez-la encore pour la jouer' : 'Survolez une carte pour voir si elle prend le pli';
  }
  /** Carte qui gagne le pli pour l'instant (calculée avec les règles du moteur), ou le gagnant une fois le pli résolu. */
  private leadIndex(): number | null {
    const t = this.pub?.trick; if (!t || !t.entries.length) return null;
    if (t.res) return t.res.winner ?? null;
    try {
      const R = resolve(t.entries, (t.removals || []).map(i => t.entries[i]));
      return R.winner ? t.entries.indexOf(R.winner) : null;
    } catch { return null; }
  }
  /** Joue une animation CSS (classe + variables) puis nettoie ; la durée de secours couvre `prefers-reduced-motion` (aucun animationend). */
  private animate(el: HTMLElement, cls: string, vars: Record<string, string>, ms: number, done?: () => void) {
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
    const cl = cls.split(' '); el.classList.remove(...cl); void el.offsetWidth; el.classList.add(...cl);
    let over = false; const end = () => { if (over) return; over = true; el.classList.remove(...cl); done?.(); };
    el.addEventListener('animationend', ev => { if (ev.target === el) end(); }, { once: true });
    setTimeout(end, (reduceMotion() ? 0 : ms * this.animMs) + 120);
  }
  /** Carte qui arrive sur le pli : depuis la main en se redressant (550 ms) ou depuis la plaque de l'adversaire (450 ms). */
  private flyIn(c: HTMLElement, seat: number, id: number) {
    sfx.card(); if (!this.animMs) return;
    const to = c.getBoundingClientRect(); let from: DOMRect | null = null, mine = false;
    if (this.flyFrom && this.flyFrom.id === id) { from = this.flyFrom.rect; mine = true; this.flyFrom = null; }
    else { const pl = this.anchor(seat); if (pl) from = pl.getBoundingClientRect(); }
    const r0 = c.style.rotate || '0deg';
    if (!from) { this.animate(c, 'fly', { '--fx': '0px', '--fy': '-20px', '--fs': '.8', '--fr': r0, '--r0': r0, '--fo': '0' }, 450); return; }
    const [fx, fy] = center(from), [tx, ty] = center(to);
    this.animate(c, mine ? 'fly flyme' : 'fly', {
      '--fx': (fx - tx) / this.k + 'px', '--fy': (fy - ty) / this.k + 'px', '--fs': mine ? (from.width / Math.max(1, to.width)).toFixed(3) : '.45',
      '--fr': mine ? '-16deg' : r0, '--r0': r0, '--fo': mine ? '1' : '.2',
    }, mine ? 550 : 450);
  }
  /** Fin du pli : les cartes filent vers la plaque du gagnant en rétrécissant (600 ms), ou coulent vers le centre (Kraken, pli défaussé). */
  private flyOut(w: HTMLElement, seat: number | null, i: number) {
    const c = w.firstElementChild as HTMLElement;
    if (!this.animMs) { w.remove(); return; }
    w.classList.add('leaving'); w.style.zIndex = String(30 + i);
    const pl = seat != null && seat >= 0 ? this.anchor(seat) : null;
    const [fx, fy] = center(c.getBoundingClientRect());
    if (pl) {
      const [tx, ty] = center(pl.getBoundingClientRect());
      this.animate(c, 'collect', { '--dx': (tx - fx) / this.k + 'px', '--dy': (ty - fy) / this.k + 'px' }, 600, () => w.remove());
      if (i === 0) sfx.deal(1);
    } else {
      const [tx, ty] = center($('#bstage', this.root).getBoundingClientRect());
      this.animate(c, 'sink', { '--dx': (tx - fx) / this.k + 'px', '--dy': (ty - fy) / this.k + 'px' }, 700, () => w.remove());
    }
  }
  /** Effet sur tout le plateau quand le pli se résout : le Kraken fait trembler la table, Baleine et Raie lancent une onde. */
  private trickFx(mode: string | null) {
    if (!this.animMs || !mode) return;
    const st = $('#bstage', this.root);
    if (mode === 'kraken') this.animate(st, 'shake', {}, 700);
    if (mode === 'whale' || mode === 'stingray') {
      const wv = document.createElement('div'); wv.className = 'wave';
      wv.style.left = (this.mob ? MW : BW) / 2 + 'px'; wv.style.top = (this.mob ? MH : BH) / 2 + 'px'; $('#layer', this.root).append(wv);
      this.animate(wv, 'go', {}, 800, () => wv.remove());
    }
  }
  private myTurnToPlay() {
    const pb = this.pub!; return this.live && !this.busy && this.mySeat != null && pb.phase === 'play' && !pb.pending && pb.current === this.mySeat;
  }
  private renderHand() {
    const el = $('#hand', this.root); el.classList.toggle('lisewait', this.liseChoosing());
    const clear = (msg: string) => { this.handEls.clear(); el.innerHTML = `<span class="hidden-hand">${msg}</span>`; };
    if (this.mySeat == null || !this.priv) { $('#handTitle', this.root).innerHTML = '<b>Spectateur</b>'; $('#handMeta', this.root).innerHTML = ''; clear('Vous regardez la partie.'); return; }
    const pv = this.priv, pb = this.pub!;
    // pendant la relecture, la main connue date d'avant nos coups : on retire toutes les cartes déjà posées dans la manche
    const played = new Set([...this.playedMine, ...(pb.trick?.entries || []).filter(e => e.p === this.mySeat).map(e => e.card.id)]);
    const hand = this.live ? pv.hand : pv.hand.filter(c => !played.has(c.id));
    $('#handTitle', this.root).innerHTML = '<b>Votre main</b>';
    const bid = this.bidOf(this.mySeat), won = pb.players[this.mySeat].won, stake = pb.players[this.mySeat].rascal;
    const st = !bid.wait && pb.bidsRevealed ? (won === Number(bid.txt) ? 'ok' : won > Number(bid.txt) ? 'ko' : '') : '';
    // maquette Main : « 7 cartes » puis « Mise 2 · plis 0 » (l'enjeu de Rascal à part)
    // phase de mise (maquette Bid) : « 2 atouts · 1 pirate · 1 sirène » à la place de « Mise · plis »
    const tags = [`<span><b>${hand.length}</b> carte${hand.length > 1 ? 's' : ''}</span>`];
    if (pb.phase === 'bid') { const s = handSummary(hand); if (s) tags.push(`<span>${s}</span>`); }
    else tags.push(`<span class="${st}">${bid.wait ? '' : `Mise <b>${bid.txt}</b> · `}${bid.wait ? 'Plis' : 'plis'} <b>${won}</b></span>`);
    if (stake) tags.push(`<span>Enjeu <b>${stake}</b> pts</span>`);
    if (this.liseChoosing()) tags.push(`<span class="note">Masquée pendant le choix : on tire à l'aveugle, même dans sa propre main.</span>`);
    setHTML($('#handMeta', this.root), tags.join(''));
    if (this.sendingId != null && !hand.some(c => c.id === this.sendingId)) this.sendingId = null;
    if (!hand.length) { clear('Plus de cartes en main.'); return; }
    el.querySelector('.hidden-hand')?.remove();

    const before = new Map<number, number>(); for (const [id, c] of this.handEls) before.set(id, c.getBoundingClientRect().left);
    // taille : les cartes remplissent le bloc en hauteur ; l'écart se resserre avec le nombre de cartes
    const len = hand.length, { cardW, cardH, step } = handLayout(el.clientWidth, el.clientHeight, len);
    el.style.setProperty('--hs', (cardW / 252).toFixed(4)); el.style.setProperty('--hm', (step - cardW).toFixed(1) + 'px');
    el.style.setProperty('--lift', (cardH * .12).toFixed(1) + 'px');

    const ids = new Set(hand.map(c => c.id));
    for (const [id, c] of this.handEls) if (!ids.has(id)) { c.remove(); this.handEls.delete(id); }
    const playing = this.myTurnToPlay() && !this.choice; const legal = new Set(pv.legal);
    const m = (len - 1) / 2; const added: HTMLElement[] = [];
    let prev: HTMLElement | null = null;
    hand.forEach((c, j) => {
      let ce = this.handEls.get(c.id);
      if (!ce) { ce = elFrom(cardHTML(c)); this.handEls.set(c.id, ce); added.push(ce); }
      const spot: Element | null = prev ? prev.nextElementSibling : el.firstElementChild;
      if (spot !== ce) el.insertBefore(ce, spot);
      prev = ce;
      const pick = !!this.pick, ok = playing && legal.has(c.id), act = pick || ok;
      ce.classList.toggle('playable', act);
      ce.classList.toggle('dim', playing && !legal.has(c.id) && !pick);
      ce.classList.toggle('sel', (pick && this.pick!.sel.has(c.id)) || this.choice?.id === c.id || (playing && this.previewId === c.id));
      ce.classList.toggle('forced', pv.forced === c.id);
      const lfx = this.liseNow(), hit = !!lfx && lfx.seat === this.mySeat && this.liseCard() === c.id;
      ce.classList.toggle('lisepick', hit); el.classList.toggle('lisereveal', !!lfx && lfx.seat === this.mySeat); ce.classList.toggle('lisedim', !!lfx && lfx.seat === this.mySeat && !hit);
      if (hit && !ce.querySelector('.listag')) ce.insertAdjacentHTML('beforeend', `<span class="listag">Imposée par ${esc(lfx!.by === this.mySeat ? 'vous' : this.pub!.players[lfx!.by].name)}</span>`);
      if (!hit) ce.querySelector('.listag')?.remove();
      ce.classList.toggle('sending', this.sendingId === c.id);
      // pendant votre tour, toutes les cartes se survolent et se focalisent (l'aperçu explique pourquoi une carte est bloquée)
      if (act || playing) { ce.tabIndex = 0; ce.setAttribute('role', 'button'); } else { ce.removeAttribute('tabindex'); ce.setAttribute('role', 'img'); }
      if (playing && !legal.has(c.id) && !pick) ce.setAttribute('aria-disabled', 'true'); else ce.removeAttribute('aria-disabled');
      ce.setAttribute('aria-label', (playing && !pick ? (legal.has(c.id) ? 'Jouer ' : 'Bloquée : ') : '') + cname(c));
      // éventail plat : 1° par carte, 1 px × d² de décalage vertical
      const d = j - m; ce.style.setProperty('--r', d.toFixed(2) + 'deg'); ce.style.setProperty('--y', (d * d).toFixed(1) + 'px'); ce.style.zIndex = String(j + 1);
    });
    if (!this.animMs) return;
    // nouvelle donne : les cartes partent du centre de la table, une à une
    const dealing = added.length > 1 && this.handRound !== pb.round; this.handRound = pb.round;
    if (dealing) {
      const [cx, cy] = center($('#table', this.root).getBoundingClientRect());
      // distribution : les cartes arrivent une à une depuis le centre de la table (60 ms d'écart)
      added.forEach((ce, i) => {
        const [x, y] = center(ce.getBoundingClientRect());
        ce.style.animationDelay = `calc(${i * 60}ms * var(--spd,1))`;
        this.animate(ce, 'deal', { '--dx': `${cx - x}px`, '--dy': `${cy - y}px` }, 420 + i * 60, () => { ce.style.animationDelay = ''; });
      });
      sfx.deal(added.length); return;
    }
    // le reste de la main se resserre en douceur
    // (on part de l'ancienne position, puis la transition CSS ramène chaque carte à sa place)
    const moved: HTMLElement[] = [];
    for (const [id, x0] of before) {
      const ce = this.handEls.get(id); if (!ce) continue;
      const dx = x0 - ce.getBoundingClientRect().left;
      if (Math.abs(dx) > 1) { ce.classList.add('noanim'); ce.style.translate = `${dx}px 0`; moved.push(ce); }
    }
    if (moved.length) { void el.offsetWidth; moved.forEach(ce => { ce.classList.remove('noanim'); ce.style.translate = ''; }); }
    added.forEach(ce => this.animate(ce, 'drawn', {}, 280));
  }
  /** Classement : rang, score, variation de la dernière manche, et pastilles de mise (vides = plis manquants, vertes = pris, rouges = en trop). */
  private renderMini() {
    const pb = this.pub!;
    if (pb.players[0]?.hist) this.histCache = pb.players.map(p => p.hist || []);
    const rows = pb.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score);
    setHTML($('#mini', this.root), rows.map(({ p, i }, k) => {
      let pips = '', st = '', stc = '';
      if (pb.bidsRevealed && p.bid != null) {
        for (let j = 0; j < Math.max(p.bid, p.won); j++) pips += `<i class="${j >= p.bid ? 'over' : j < p.won ? 'on' : ''}"></i>`;
        if (p.won > p.bid) { st = `${p.won - p.bid} de trop`; stc = 'ko'; }
        else if (p.won === p.bid) { st = p.bid === 0 ? 'mise 0 tenue' : 'mise tenue'; stc = 'ok'; }
        else { st = `il manque ${p.bid - p.won}`; stc = 'gold'; }
      } else if (pb.phase === 'bid') { const mine = i === this.mySeat && this.priv; st = mine ? (this.priv!.bid == null ? 'à vous de miser' : `mise scellée : ${this.priv!.bid}`) : p.hasBid ? 'a misé' : 'réfléchit…'; if (mine && this.priv!.bid == null) stc = 'gold'; }
      const h = this.histCache[i]?.at(-1);
      const delta = h ? `<small class="${h.tot > 0 ? 'ok' : h.tot < 0 ? 'ko' : ''}">${h.tot > 0 ? '+' : ''}${h.tot} manche ${h.r}</small>` : '';
      return `<div class="lrow${i === this.mySeat ? ' me' : ''}"><span class="rk">${k + 1}</span><span class="dot" style="background:${this.colorOf(i)}"></span>
        <div class="who"><b>${esc(p.name)}</b><div class="lp">${pips}<span class="${stc}">${st}</span></div></div>
        <div class="sc"><b>${p.score}</b>${delta}</div></div>`;
    }).join(''));
  }
  /** Encadré « Ce que vaut votre mise » pendant la phase de mise : suit la pièce survolée (sinon votre mise, sinon 1). */
  private renderStakes(hover?: number) {
    const pb = this.pub!, box = $('#stakesP', this.root);
    const show = pb.phase === 'bid' && this.mySeat != null; box.hidden = !show; if (!show) return;
    const b = hover ?? this.priv?.bid ?? Math.min(1, pb.cards);
    setHTML($('#stakes', this.root), stakeLines(b, pb.cards, pb.opts?.score === 'rascal').map(([k, v]) =>
      `<div><span>${k}</span><b class="${v > 0 ? 'ok' : v < 0 ? 'ko' : ''}">${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}</b></div>`).join(''));
  }
  /** Journal réduit aux 5 dernières lignes ; « Tout voir » ouvre le journal complet. */
  private renderLog() {
    const el = $('#log', this.root), lines = this.logLines.slice(-5);
    const me = this.mySeat != null ? this.pub?.players[this.mySeat]?.name : undefined;
    setHTML(el, lines.map(l => logLine(l, me)).join(''));
  }
  private fullLog() {
    modal(`<h2>Journal de bord</h2><p class="sub">${this.logLines.length} événements, du plus ancien au plus récent.</p><div class="fulllog">${this.logLines.map(l => logLine(l, this.mySeat != null ? this.pub?.players[this.mySeat]?.name : undefined)).join('')}</div>`);
    const fl = document.querySelector('.fulllog'); if (fl) fl.scrollTop = fl.scrollHeight;
  }
  /** Réaction : bulle à côté de la plaque de l'expéditeur, 2,2 s ; au plus une toutes les 2 s par joueur. */
  showEmote(seat: number, text: string) {
    if (!EMOTES.includes(text) || !this.pub || !this.pub.players[seat]) return;
    const now = Date.now(); if (now - (this.lastEmote[seat] ?? 0) < 1900) return; this.lastEmote[seat] = now;
    if (this.mob) {
      const a = this.anchor(seat); if (!a) return;
      const el = document.createElement('div'); el.className = 'bubble anch'; el.textContent = text; a.append(el); sfx.coin(); setTimeout(() => el.remove(), 2200); return;
    }
    const n = this.pub.players.length, g = geometry(n)[(seat - this.bottom() + n) % n];
    const el = document.createElement('div'); el.className = 'bubble' + (g.py < 140 ? ' below' : ''); el.textContent = text;
    el.style.left = g.px + 'px'; el.style.top = (g.py < 140 ? g.py + 52 : g.py - 52) + 'px';
    $('#layer', this.root).append(el); sfx.coin(); setTimeout(() => el.remove(), 2200);
  }
  private sendEmote(text: string) {
    if (this.mySeat == null || Date.now() - (this.lastEmote[this.mySeat] ?? 0) < 2000) return;
    this.showEmote(this.mySeat, text);
    this.backend.emote?.(text);
    const btns = this.root.querySelectorAll<HTMLButtonElement>('[data-emo]'); btns.forEach(x => x.disabled = true);
    setTimeout(() => btns.forEach(x => x.disabled = false), 2000);
  }

  /* ---------- Actions ---------- */
  private setAction(text: string, btns: { label: string; on: () => void; cls?: string; disabled?: boolean; n?: number; aria?: string }[] = [], timer = false) {
    const a = $('#action', this.root); a.innerHTML = `${this.meRow('pre')}<div class="prompt">${text}</div>${this.meRow('post')}`;
    if (timer && !this.mob) {
      const left = Math.max(0, TURN_S - (Date.now() - this.turnStart) / 1000);
      a.insertAdjacentHTML('beforeend', `<div class="ttimer" aria-hidden="true"><span id="tLeft">${Math.ceil(left)} s</span><div><i style="animation-duration:${TURN_S}s;animation-delay:-${(TURN_S - left).toFixed(1)}s"></i></div></div>`);
    }
    if (btns.length) { const w = document.createElement('div'); w.className = 'btns'; btns.forEach(b => { const el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.label; if (b.n != null) { el.dataset.n = String(b.n); el.setAttribute('aria-label', 'Miser ' + b.n); } if (b.aria) el.setAttribute('aria-label', b.aria); el.disabled = !!b.disabled || this.busy; el.onclick = b.on; w.append(el); }); a.append(w); }
  }
  private renderAction() {
    const pb = this.pub!, me = this.mySeat, pv = this.priv;
    const name = (i: number) => esc(pb.players[i]?.name ?? '?');
    if (!this.live && this.evk === 'lise' && this.liseNow()) {
      const lf = this.liseNow()!;
      // maquettes LiseCible (la cible), Marie Thorne (celui qui choisit), LiseAutres (les autres joueurs)
      if (lf.seat === me) {
        const id = this.liseCard(), c = (this.latest?.priv ?? pv)?.hand.find(x => x.id === id);
        const carte = c ? 'votre ' + esc(cname(c)) : 'une carte';
        this.setAction(`${lf.by === me ? 'Vous vous imposez' : name(lf.by) + ' vous impose'} ${carte}<small>Vous devrez la jouer au prochain pli, même si elle ne suit pas la couleur demandée</small>`);
      } else if (lf.by === me) this.setAction(`${name(lf.seat)} devra jouer cette carte au prochain pli<small>Elle sera jouée même si elle ne suit pas la couleur demandée</small>`);
      else this.setAction(`${name(lf.seat)} a une carte imposée<small>Au prochain pli, sa carte arrivera sur la table avec l'étiquette « Imposée »</small>`);
      return;
    }
    if (!this.live && this.evk === 'bids') { this.setAction(`Les mises sont révélées<small>${pb.leader == null ? '' : pb.leader === me ? 'Vous entamez le premier pli' : `${name(pb.leader)} entame le premier pli`}</small>`); return; }
    if (!this.live && this.evk === 'trick' && this.banner) { this.setAction(this.trickPrompt()); return; }
    if (!this.live) { this.setAction(this.banner ? esc(vous(this.banner)) : this.evk === 'trickEnd' ? 'Pli ramassé' : this.evk === 'round' ? 'Fin de la manche' : pb.current == null ? (pb.phase === 'play' ? 'Le pli se décide…' : '…') : pb.current === me ? 'À vous dans un instant…' : `${name(pb.current)} ${pb.pending ? 'fait un choix' : 'joue'}…`); return; }
    if (pb.phase === 'end') { this.setAction('Partie terminée.', [{ label: 'Classement final', cls: 'gold', on: () => this.finalOverlay() }, { label: "Retour à l'accueil", cls: 'alt', on: () => this.onExit() }]); return; }
    if (me == null || !pv) { this.setAction(pb.phase === 'bid' ? 'Les joueurs misent…' : (pb.current != null ? `Au tour ${de(name(pb.current))}` : '…')); return; }
    if (this.busy) { this.setAction('Envoi…'); return; }
    if (pb.phase === 'bid') {
      const coins = (pick: number | null) => Array.from({ length: pb.cards + 1 }, (_, b) => ({ label: String(b), n: b, cls: 'coin' + (pick === b ? ' sel' : pick != null ? ' off' : ''), disabled: pick != null, on: () => this.send({ t: 'bid', n: b }) }));
      if (pv.bid == null) this.setAction("Combien de plis allez-vous remporter ?<small>Les autres ne verront votre mise qu'une fois tout le monde décidé</small>", coins(null));
      else {
        const w = pb.players.map((p, i) => p.hasBid ? null : name(i)).filter(Boolean);
        this.setAction(`Mise scellée : ${pv.bid}<small>${w.length ? `En attente ${de(w.join(', '))}…` : 'Révélation des mises…'}</small>`, coins(pv.bid));
      }
      return;
    }
    const pd = pb.pending;
    if (pd) {
      if (pd.seat !== me) { this.setAction(`${name(pd.seat)} ${PENDING_LABEL[pd.t] ?? 'fait un choix'}…`); return; }
      const opts = (pd.opts as any[]) || [];
      const btns = (list: any[]) => list.map(o => ({ label: o.label, disabled: o.disabled, on: () => this.send({ t: 'choose', v: o.v }) }));
      switch (pd.t) {
        case 'plank': return this.setAction('La Planche : quel pirate faites-vous marcher sur la planche ?', btns(opts));
        case 'rosie': return this.setAction(`${PIRATES.rosie.n} : qui entame le prochain pli ?`, btns(opts));
        case 'mary': {
          // maquette Marie Thorne : petite étiquette « Au hasard » puis un bouton par joueur
          this.setAction(`Cliquez une carte face cachée chez un joueur, vous compris<small>${PIRATES.mary.n} : les cartes sont mélangées, leur place ne dit rien de leur valeur</small>`,
            opts.map(o => ({ label: o.v === me ? 'Vous' : pb.players[o.v].name, aria: `Au hasard dans ${o.v === me ? 'votre main' : 'la main ' + de(pb.players[o.v].name)}`, cls: 'alt', on: () => this.send({ t: 'choose', v: o.v }) })));
          this.root.querySelector('#action .btns')?.insertAdjacentHTML('afterbegin', '<span class="rndlbl" aria-hidden="true">Au hasard</span>');
          return;
        }
        case 'rascal': return this.setAction(`${PIRATES.rascal.n} : combien de points engagez-vous sur votre mise ?<small>Gagnés si la mise est tenue, perdus sinon.</small>`, btns(opts));
        case 'harry': return this.setAction(`${PIRATES.harry.n} : votre mise est de ${pv.bid}. La modifier ?`, btns(opts));
        case 'juanita': return this.setAction(`${PIRATES.juanita.n} : vous pouvez consulter les cartes non distribuées.`, [{ label: 'Voir la pioche', cls: 'gold', on: () => this.showDeck() }]);
        case 'bahij': {
          const k = pv.pendingData?.k ?? 2; if (!this.pick || this.pick.k !== k) { this.pick = { k, sel: new Set() }; this.renderHand(); }
          return this.setAction(`${PIRATES.bahij.n} : vous avez pioché ${k} carte${k > 1 ? 's' : ''}. Défaussez-en ${k}.<small>${this.pick.sel.size} / ${k} sélectionnée(s)</small>`,
            [{ label: 'Défausser', cls: 'gold', disabled: this.pick.sel.size !== k, on: () => { const v = [...this.pick!.sel]; this.pick = null; this.send({ t: 'choose', v }); } }]);
        }
      }
      return this.setAction('Un choix est attendu.');
    }
    if (pb.current === me) {
      if (this.choice) return this.askChoice();
      this.setAction(pv.forced != null ? `${PIRATES.mary.n} vous impose cette carte` : (pb.trick && pb.trick.stage === 'volley' ? 'Dernière Bordée : jouez votre carte supplémentaire' : 'À vous de jouer<small id="hint" class="hint"></small>'), [], true);
      this.showHint(this.previewId);
      return;
    }
    this.setAction(pb.current != null ? `Au tour ${de(name(pb.current))}` : '…');
  }
  /** Bandeau d'action après un pli (maquette Main) : ce que le pli change pour votre mise, puis « Pli 3 sur 7 · vous entamez ». */
  private trickPrompt() {
    const pb = this.pub!, me = this.mySeat, t = pb.trick, res = t?.res;
    const we = res && res.winner != null ? t!.entries[res.winner] : null;
    let title = esc(vous(this.banner!));
    if (we && we.p === me && pb.bidsRevealed) {
      // l'instantané « trick » précède le décompte : le pli n'est pas encore dans won
      const p = pb.players[me], left = (p.bid ?? 0) - (p.won + 1);
      title = left > 0 ? `Pli remporté : encore ${left === 1 ? 'un' : left} pour tenir votre mise` : left === 0 ? (pb.trickNo >= pb.cards ? 'Pli remporté : mise tenue' : "Pli remporté : mise tenue pour l'instant")
        : `Pli remporté : ${left === -1 ? 'un pli' : -left + ' plis'} de trop`;
    }
    // Kraken, pli défaussé : le message dit déjà qui entame
    if (!res || res.discarded) return title;
    if (pb.trickNo >= pb.cards) return `${title}<small>Dernier pli de la manche</small>`;
    // Rosie la douce choisira qui entame : on ne l'annonce pas
    const rosie = we?.card.kind === 'pirate' && we.card.pid === 'rosie' && pb.opts?.powers, next = res.next as number | null;
    const lead = rosie || next == null ? '' : ` · ${next === me ? 'vous entamez' : esc(pb.players[next].name) + ' entame'}`;
    return `${title}<small>Pli ${pb.trickNo + 1} sur ${pb.cards}${lead}</small>`;
  }
  private handClick(id: number) {
    if (this.pick) { const s = this.pick.sel; if (s.has(id)) s.delete(id); else if (s.size < this.pick.k) s.add(id); this.renderHand(); this.renderAction(); return; }
    if (!this.myTurnToPlay()) return;
    if (TOUCH() && this.previewId !== id) { this.previewId = id; this.showHint(id); this.renderHand(); return; }
    if (!this.priv!.legal.includes(id)) { this.showHint(id); return; }
    this.previewId = null;
    const c = this.priv!.hand.find(x => x.id === id)!; const need: string[] = [];
    if (c.kind === 'tigress') need.push('as'); if (c.zf) need.push('val');
    if (c.wild && wildRule(this.pub!.trick!.entries).choose) need.push('ws');
    if (!need.length) { this.send({ t: 'play', id }); return; }
    this.choice = { id, need, move: { t: 'play', id } }; this.renderHand(); this.askChoice();
  }
  private askChoice() {
    const ch = this.choice!; const k = ch.need[0];
    const done = (field: string, v: any) => { ch.move[field] = v; ch.need.shift(); if (!ch.need.length) { this.choice = null; this.send(ch.move); } else this.askChoice(); };
    const cancel = { label: 'Annuler', cls: 'alt', on: () => { this.choice = null; this.render(); } };
    if (k === 'as') this.setAction('Morgane la Louve : la jouer comme…', [{ label: '☠ Pirate', cls: 'gold big', on: () => done('as', 'pirate') }, { label: '🏳 Fuite', cls: 'big', on: () => done('as', 'escape') }, cancel]);
    if (k === 'val') this.setAction('0/14 : quelle valeur ?', [{ label: '0', on: () => done('val', 0) }, { label: '14', on: () => done('val', 14) }, cancel]);
    if (k === 'ws') this.setAction('Le Grand Quinze : de quelle couleur est-il ?<small>Il fixe la couleur demandée du pli.</small>', [...WILD_SUITS.map(s => ({ label: SUIT[s].n, on: () => done('ws', s) })), cancel]);
  }
  private async send(move: Action) {
    if (this.busy) return; this.busy = true;
    if (move.t === 'play') {
      // la carte quitte la main tout de suite ; elle réapparaîtra en vol sur le pli
      const ce = this.handEls.get(move.id); if (ce) this.flyFrom = { id: move.id, rect: ce.getBoundingClientRect() };
      this.sendingId = move.id;
    }
    this.renderAction(); this.renderHand();
    try { await this.backend.send(move); }
    catch (e: any) { this.sendingId = null; this.flyFrom = null; sfx.bad(); toast(e.message || 'Action refusée.', 'err'); }
    finally { this.busy = false; this.render(); }
  }
  private lastTrickModal() {
    const lt = this.latest?.pub.lastTrick, pb = this.latest?.pub;
    if (!lt || !pb) { modal('<h2>Dernier pli</h2><p class="sub">Aucun pli n’a encore été joué dans cette manche.</p>'); return; }
    const cards = lt.entries.map((e: any, i: number) => `<figure class="${lt.res?.winner === i ? 'w' : ''}">${cardHTML(e.card, e, lt.res?.winner === i ? 'win' : (lt.res?.removed?.includes(i) || lt.res?.discarded ? 'gone' : ''))}<figcaption>${esc(pb.players[e.p]?.name ?? '?')}</figcaption></figure>`).join('');
    modal(`<h2>Pli ${lt.trickNo}</h2><p class="sub">${esc(lt.res?.msg ?? '')}</p><div class="lasttrick">${cards}</div>`);
  }
  private async showDeck() {
    const deck = this.priv?.pendingData?.deck || [];
    await modal(`<h2>Cartes non distribuées</h2><p class="sub">${deck.length} carte${deck.length > 1 ? 's' : ''} hors du jeu cette manche.</p><div class="deckview">${deck.map((c: any) => cardHTML(c)).join('')}</div>`, [{ label: 'Compris', value: 1 }]);
    this.send({ t: 'choose', v: 1 });
  }

  /* ---------- Récapitulatifs ---------- */
  /** Fin de manche : fenêtre parchemin. L'affichage attend que tout le monde soit prêt (ou READY_S secondes) ; le serveur, lui, n'attend pas. */
  private roundEnd(snap: PublicView): Promise<void> {
    const h = snap.players[0]?.hist; if (!h || !h.length) return Promise.resolve();
    const r = h.at(-1).r; if (r <= this.shownRound) return Promise.resolve(); this.shownRound = r;
    if (snap.phase === 'end' && r === roundsOf(snap.opts)) return Promise.resolve(); // la fenêtre finale prend le relais
    const ps = snap.players, cards = h.at(-1).cards;
    const rankOf = (scores: number[]) => scores.map(s => 1 + scores.filter(o => o > s).length);
    const now = rankOf(ps.map(p => p.score)), before = rankOf(ps.map(p => p.score - (p.hist!.at(-1).tot)));
    const order = ps.map((_, i) => i).sort((a, b) => ps[b].score - ps[a].score);
    const sg = (v: number) => `<span class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}</span>`;
    const rows = order.map((i, k) => {
      const p = ps[i], x = p.hist!.at(-1), ok = x.bid === x.won;
      const mv = before[i] > now[i] ? '<i class="up" title="Gagne des places">▲</i>' : before[i] < now[i] ? '<i class="down" title="Perd des places">▼</i>' : '';
      const chip = ok ? 'tenue' : x.won > x.bid ? `+${x.won - x.bid}` : `−${x.bid - x.won}`;
      const bonus = x.items.length ? x.items.map((it: any) => `<span class="bchip ${it[0] < 0 ? 'neg' : ''}">${it[0] > 0 ? '+' : '−'}${Math.abs(it[0])} ${esc(it[1])}</span>`).join('') : '<span class="none">—</span>';
      return `<div class="rrow${now[i] === 1 ? ' first' : ''}" style="animation-delay:calc(${120 + k * 120}ms * var(--spd,1))">
        <div class="rk"><b>${now[i]}</b>${mv}</div>
        <div class="rp">${this.avatar(i, p.name, 32)}<b>${esc(p.name)}</b></div>
        <div class="rb"><b>${x.bid} → ${x.won}</b><span class="ok ${ok ? '' : 'ko'}">${chip}</span></div>
        <div class="rn">${sg(x.base)}</div><div class="rx">${bonus}</div>
        <div class="rt" style="animation-delay:calc(${600 + k * 120}ms * var(--spd,1))">${sg(x.tot)}</div><div class="rs">${p.score}</div></div>`;
    }).join('');
    const coup = coupDeLaManche(ps);
    const ov = document.createElement('div'); ov.className = 'roverlay'; this.copySpd(ov);
    const back = document.activeElement as HTMLElement | null;
    ov.innerHTML = `<div class="rsheet" role="dialog" aria-modal="true" aria-labelledby="rTitle">
      <div class="rhead"><div><div class="rsub">Manche ${r} sur ${roundsOf((this.latest?.pub ?? this.pub)?.opts)} · ${cards} carte${cards > 1 ? 's' : ''}</div><h2 id="rTitle">Fin de la manche</h2></div>
        <div class="rready"><span id="rCount"></span><div class="rbar"><i style="animation-duration:${READY_S}s"></i></div></div></div>
      <div class="rcols"><span>#</span><span>Pirate</span><span>Mise → plis</span><span>Points</span><span>Bonus</span><span class="r">Manche</span><span class="r">Total</span></div>
      <div class="rrows">${rows}</div>
      ${coup ? `<div class="coup"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg><div><b>Coup de la manche</b><span>${esc(coup)}</span></div></div>` : ''}
      <div class="rfoot"><button class="btn alt" id="rSheet">Feuille complète</button>${this.mySeat != null ? '<button class="btn gold big" id="rReady">Je suis prêt</button>' : ''}</div></div>`;
    document.body.append(ov);
    // les bots sont toujours prêts ; les « prêt » reçus avant l'ouverture de la fenêtre sont repris
    const ready = new Set<number>([...ps.map((p, i) => p.bot ? i : -1).filter(i => i >= 0), ...(this.earlyReady[r] || [])]);
    const t0 = Date.now(), btn = ov.querySelector('#rReady') as HTMLButtonElement | null;
    return new Promise(res => {
      let done = false;
      const update = () => {
        const left = Math.max(0, Math.ceil(READY_S - (Date.now() - t0) / 1000));
        (ov.querySelector('#rCount') as HTMLElement).textContent = `Manche ${r + 1} dans ${left} s · ${ready.size} prêt${ready.size > 1 ? 's' : ''} sur ${ps.length}`;
        if (btn && this.mySeat != null && ready.has(this.mySeat)) { btn.disabled = true; btn.textContent = 'Prêt'; }
        if (ready.size >= ps.length) close();
      };
      const close = () => {
        if (done) return; done = true; clearInterval(iv); this.roundGate = null; this.roundOpen = null; document.removeEventListener('keydown', onKey);
        // le focus revient où il était (s'il était dans la fenêtre ou perdu, on ne le force pas ailleurs)
        if (ov.contains(document.activeElement)) { if (back?.isConnected && !ov.contains(back)) back.focus(); else (document.activeElement as HTMLElement).blur(); }
        ov.classList.add('out'); setTimeout(() => ov.remove(), 260); res();
      };
      // Échap : comme « Je suis prêt » (la fenêtre se ferme ; la feuille de scores ouverte par-dessus garde la main)
      const onKey = (ev: KeyboardEvent) => {
        const m = document.getElementById('modal'); if (ev.key !== 'Escape' || (m && !m.hidden)) return;
        ev.preventDefault(); if (btn && !btn.disabled) btn.click(); close();
      };
      document.addEventListener('keydown', onKey);
      const iv = setInterval(() => { if (Date.now() - t0 >= READY_S * 1000) close(); else update(); }, 250);
      this.roundOpen = { round: r, ready, update, close };
      btn?.addEventListener('click', () => { ready.add(this.mySeat!); this.backend.ready?.(r); update(); });
      (ov.querySelector('#rSheet') as HTMLElement).onclick = () => this.scoreSheet();
      update(); btn?.focus();
    });
  }
  /** « Je suis prêt » reçu d'un autre joueur (Realtime) pour la manche r. */
  markReady(seat: number, r: number) {
    if (this.roundOpen && this.roundOpen.round === r) { this.roundOpen.ready.add(seat); this.roundOpen.update(); }
    else (this.earlyReady[r] = this.earlyReady[r] || []).push(seat);
  }
  /* ---------- Fin de partie (maquette FinPartie) ---------- */
  private finEl: HTMLElement | null = null; private finTimer: any = 0;
  /** Les fenêtres posées sur body héritent de la vitesse d'animation de la table. */
  private copySpd(el: HTMLElement) { el.style.setProperty('--spd', this.root.style.getPropertyValue('--spd') || '1'); }
  /** Ferme la fin de partie : la table redevient accessible. */
  private closeFin() { clearTimeout(this.finTimer); this.finEl?.remove(); this.finEl = null; this.root.inert = false; }
  /** Superposition de fin : podium, XP (lignes puis barre), Élo, haut fait. Se complète quand le règlement du serveur arrive. */
  private finalOverlay() {
    const pb = this.latest?.pub ?? this.pub; if (!pb) return;
    this.closeFin();
    const ps = pb.players, order = ps.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score);
    const rank = (i: number) => 1 + ps.filter(p => p.score > ps[i].score).length;
    const me = this.mySeat, myRank = me != null ? rank(me) : 0;
    const TITLE = ['Victoire, capitaine !', 'Deuxième place, belle traversée', 'Troisième place', 'Fin de la traversée'];
    const H = [120, 92, 70, 52], ORD = [2, 1, 3, 4], DL = [1.05, .75, .6, .45], ORDN = ['1er', '2e', '3e'];
    const ov = document.createElement('div'); ov.className = 'finov'; this.copySpd(ov);
    const pod = order.slice(0, 4).map(({ p, i }, k) => `<div class="fpod" style="order:${ORD[k]}">${this.avatar(i, p.name, k ? 52 : 68)}<b>${esc(i === me ? 'Vous' : p.name)}</b>
      <div class="col c${Math.min(rank(i), 4)}" style="height:${H[k]}px;animation-delay:calc(${DL[k]}s * var(--spd,1))"><span class="t">${p.score}</span><span class="r" data-elo="${i}">${rank(i) <= 3 ? ORDN[rank(i) - 1] : rank(i) + 'e'}</span></div></div>`).join('');
    ov.innerHTML = `<div class="sparks" aria-hidden="true">${Array.from({ length: 8 }, (_, k) => `<span style="left:${18 + k * 9}%;top:${240 + (k % 3) * 30}px;animation-delay:${(k * .37).toFixed(2)}s"></span>`).join('')}</div>
      <div class="fcard" role="dialog" aria-modal="true" aria-labelledby="fp-t">
        <div class="fhead"><div class="ftag">Fin de la partie · ${pb.round} manche${pb.round > 1 ? 's' : ''}</div><h2 id="fp-t" tabindex="-1">${me == null ? 'Partie terminée' : TITLE[Math.min(myRank, 4) - 1]}</h2></div>
        <div class="fpodium">${pod}</div>
        <div class="fgrid" id="fgrid"><p class="fwait">${this.backend.gameId ? 'Calcul de l\'XP et de l\'Élo…' : 'Partie d\'entraînement : elle ne rapporte ni XP ni Élo.'}</p></div>
        <div class="fbtns"><button class="abtn ghost" id="fHome">Retour au port</button>
          ${this.backend.gameId ? '<button class="abtn ghost" id="fDetail">Détail de la partie</button><button class="abtn gold" id="fRematch">Revanche avec la même table</button>'
            : '<button class="abtn ghost" id="fSheet">Feuille de scores</button><button class="abtn gold" id="fAgain">Nouvelle partie</button>'}</div>
      </div>`;
    document.body.append(ov); this.finEl = ov; this.root.inert = true;
    const q = (s: string) => ov.querySelector(s) as HTMLElement | null;
    q('#fHome')!.onclick = () => { this.closeFin(); this.onExit(); };
    if (q('#fDetail')) q('#fDetail')!.onclick = () => { this.closeFin(); location.hash = '#/partie/' + this.backend.gameId; location.reload(); };
    if (q('#fSheet')) q('#fSheet')!.onclick = () => this.scoreSheet();
    if (q('#fAgain')) q('#fAgain')!.onclick = () => { this.closeFin(); location.hash = '#/entrainement'; location.reload(); };
    if (q('#fRematch')) q('#fRematch')!.onclick = async () => {
      const b = q('#fRematch') as HTMLButtonElement; b.disabled = true; b.textContent = 'Préparation du salon…';
      try { const id = await this.backend.rematch!(); this.closeFin(); location.hash = '#/partie/' + id; }
      catch (e: any) { toast(e.message || 'Revanche impossible.', 'err'); b.disabled = false; b.textContent = 'Revanche avec la même table'; }
    };
    // focus sur le titre, tabulation piégée dans la carte ; Échap ne ferme pas (la partie est finie)
    ov.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); return; }
      if (ev.key !== 'Tab') return;
      const f = [...ov.querySelectorAll<HTMLElement>('.fcard button:not(:disabled), .fcard [href], .fcard [tabindex]:not([tabindex="-1"])')];
      if (!f.length) { ev.preventDefault(); return; }
      const a = document.activeElement, i = f.indexOf(a as HTMLElement);
      if (ev.shiftKey && i <= 0) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && (i === -1 || i === f.length - 1)) { ev.preventDefault(); f[0].focus(); }
    });
    q('#fp-t')!.focus();
    this.fillSettled();
    // règlement en retard (partie en ligne) : on le relit au serveur après 8 s, sinon on renvoie vers l'historique
    if (this.backend.gameId && this.backend.uid) this.finTimer = setTimeout(async () => {
      const grid = () => (this.finEl === ov ? ov.querySelector('#fgrid') as HTMLElement : null);
      if (!grid() || grid()!.dataset.done) return;
      try {
        const s = await this.backend.settled?.(), pub = this.latest?.pub as any;
        if (s && pub) { pub.settled = { ...(pub.settled || {}), ...s }; this.fillSettled(); }
      } catch { /* on garde le message ci-dessous */ }
      const g = grid(); if (g && !g.dataset.done) g.innerHTML = '<p class="fwait">Le calcul prend plus de temps que prévu : retrouvez-le dans l\'historique.</p>';
    }, 8000);
  }
  /** Partie du règlement propre au joueur (XP, Élo, haut fait), dès qu'elle est disponible dans l'état de la partie. */
  private fillSettled() {
    const ov = this.finEl, uid = this.backend.uid; if (!ov || !uid) return;
    const s = (this.latest?.pub as any)?.settled?.[uid]; const grid = ov.querySelector('#fgrid') as HTMLElement;
    if (!s || grid.dataset.done) return; grid.dataset.done = '1';
    const before = levelFor(s.xpBefore), after = levelFor(s.xpAfter), up = s.levelAfter > s.levelBefore;
    const from = Math.round(100 * before.inLevel / before.need), to = up ? 100 : Math.round(100 * after.inLevel / after.need);
    const xpRows = (s.xp as any[]).map((x, k) => `<div class="fxl" style="animation-delay:calc(${(1.3 + k * .2).toFixed(1)}s * var(--spd,1))"><span>${esc(xpLabel(x.reason, x.amount))}</span><b>+${x.amount}</b></div>`).join('');
    const nextT = LEVEL_TITLES.find(([l]) => l > after.level);
    const elo = s.elo;
    const ach = (s.achievements as any[])[0], me = this.mySeat ?? 0;
    grid.innerHTML = `<div class="fbox">${xpRows}
        <div class="fxt"><b>Niveau ${before.level} · ${esc(before.title)}</b><b class="big">+${s.xpTotal} XP</b></div>
        <div class="fbar"><span style="--from:${from}%;--to:${to}%"></span></div>
        <span class="lbl">${up ? '' : `${fmt(after.inLevel)} / ${fmt(after.need)} XP${nextT ? ` · encore ${fmt(xpToReach(nextT[0]) - s.xpAfter)} avant ${esc(nextT[1])}` : ''}`}</span>
        ${up ? `<span class="lvup">Niveau ${after.level} · ${esc(after.title)} !</span>` : ''}
        ${s.coins ? `<span class="lbl fcoins"><span class="coin" aria-hidden="true"></span>+${s.coins} pièces pour la garde-robe</span>` : ''}</div>
      ${elo ? `<div class="fbox fxl" style="animation-delay:calc(2.3s * var(--spd,1))"><span class="ftag">Élo</span>
        <span class="felo"><span class="o">${Math.round(elo.before)}</span><span class="o">→</span><span class="n">${Math.round(elo.after)}</span><b class="${elo.delta >= 0 ? 'pos' : 'neg'}">${signed(Math.round(elo.delta))}</b></span>
        ${((elo.vs || []) as any[]).map(v => `<div class="fvs"><span>${vsLabel(v)}</span><b class="${v.delta >= 0 ? 'pos' : 'neg'}">${signedOne(v.delta)}</b></div>`).join('')}</div>`
        : `<div class="fbox"><span class="ftag">Élo</span><span class="lbl">Partie non classée : ${UNRANKED[s.unranked] ?? UNRANKED.solo}.</span></div>`}
      ${this.rewardsHTML(s, me) || (ach ? `<div class="fach"><span class="medal2">${ACH_STAR}</span><span><span class="ftag dark">Haut fait débloqué</span><b>${esc(ach.name)}</b><span>${esc(ach.description)}${s.achievements.length > 1 ? ` · et ${s.achievements.length - 1} autre${s.achievements.length > 2 ? 's' : ''}` : ''}</span></span></div>` : '')}`;
    this.wireChest(grid);
    // place et Élo de chacun sous le podium
    const res = (this.latest?.pub as any)?.settled || {};
    ov.querySelectorAll<HTMLElement>('[data-elo]').forEach(el => {
      const i = Number(el.dataset.elo), u = this.backend.seatUids?.[i]; const e = u ? res[u]?.elo : null;
      if (e) el.textContent += ` · Élo ${signed(Math.round(e.delta))}`;
    });
  }
  /** Récompenses de la garde-robe (maquette FinPartie) : objet du haut fait ou du titre, coffre de victoire. Vide s'il n'y en a pas. */
  private rewardsHTML(s: any, me: number) {
    const color = this.colorOf(me), cards: string[] = [];
    for (const it of (s.items || []) as any[]) {
      const x = BY_ID[it.id]; if (!x) continue;
      const ach = (s.achievements as any[]).find(a => a.item === it.id), r = RARITY[x.rarity];
      cards.push(`<div class="fach frw"><span class="fitem">${itemPreview(x, color, 64)}</span><span><span class="ftag dark">${ach ? `Haut fait · ${esc(ach.name)}` : 'Nouveau titre'}</span>
        <b>${esc(x.name)}</b><span>${ach ? `Objet ${r.name.toLowerCase()}, réservé à ce haut fait` : `Objet ${r.name.toLowerCase()}, obtenu avec votre nouveau titre`}</span></span></div>`);
    }
    if (s.chests && this.backend.chest) cards.push(`<div class="fchest" id="fChest"><button class="chestbtn" id="fChestBtn" aria-label="Ouvrir le coffre de victoire">${CHEST_SVG}</button>
      <span><span class="ftag blue">Coffre de victoire</span><span class="fct">Un objet pour votre pirate vous attend.</span><button class="abtn gold" id="fChestGo">Ouvrir le coffre</button></span></div>`);
    return cards.length ? `<div class="frews">${cards.join('')}</div>` : '';
  }
  private wireChest(grid: HTMLElement) {
    const ch = this.backend.chest, box = grid.querySelector<HTMLElement>('#fChest'); if (!ch || !box) return;
    const open = async () => {
      const w = await ch.wallet().catch(() => ({ coins: 0, chests: 1 }));
      let last: ChestResult | null = null;
      openChestOverlay({
        chests: w.chests, coins: w.coins, color: this.colorOf(this.mySeat ?? 0), sounds: soundOn(),
        open: async () => (last = await ch.open()), equip: r => ch.equip(r),
        onClose: () => {
          if (!last) return; const x = BY_ID[last.item.id], r = RARITY[last.item.rarity];
          // le coffre ouvert laisse place à l'objet obtenu
          box.innerHTML = `<span class="fitem pop" style="filter:drop-shadow(0 0 12px ${r.color})">${x ? itemPreview(x, this.colorOf(this.mySeat ?? 0), 64) : ''}</span>
            <span class="pop"><span class="ftag" style="color:${r.color}">${'★'.repeat(r.stars)} ${r.name}${last.duplicate ? ` · +${last.coinsGained} pièces` : ' · nouvel objet'}</span>
            <b class="fct2">${esc(last.item.name)}</b><span class="lbl">${last.duplicate ? 'Déjà dans votre garde-robe' : 'Visible à la table dès la prochaine partie'}</span></span>`;
        },
      });
    };
    box.querySelectorAll<HTMLElement>('#fChestBtn, #fChestGo').forEach(b => b.onclick = open);
  }
  private maybeFinal() { if (this.pub?.phase === 'end' && !this.shownEnd) { this.shownEnd = true; this.finalOverlay(); } }
  scoreSheet() {
    const ps = this.latest?.pub.players || this.pub?.players || []; if (!ps.length) return;
    let h = `<h2>Feuille de scores</h2><p class="sub">Mise / plis remportés, puis points de la manche.</p><div class="scroll"><table class="st"><tr><th>Manche</th>${ps.map(p => `<th>${esc(p.name)}</th>`).join('')}</tr>`;
    for (let r = 1; r <= roundsOf((this.latest?.pub ?? this.pub)?.opts); r++) h += `<tr><td>${r}</td>` + ps.map(p => { const x = p.hist?.[r - 1]; return `<td>${x ? `${x.bid}/${x.won} · ${sgn(x.tot)}` : '—'}</td>`; }).join('') + '</tr>';
    h += `<tr class="tot"><td>Total</td>${ps.map(p => `<td>${p.score}</td>`).join('')}</tr></table></div>`;
    modal(h);
  }
}
const CHEST_SVG = '<svg viewBox="0 0 72 64" aria-hidden="true"><rect x="8" y="28" width="56" height="30" rx="3" fill="#6b4226" stroke="#2a170b" stroke-width="2"/><path d="M8 28c0-12 10-18 28-18s28 6 28 18z" fill="#7d4f2c" stroke="#2a170b" stroke-width="2"/><path d="M8 28h56M20 12v46M52 12v46" stroke="#c9a14a" stroke-width="3"/><rect x="31" y="30" width="10" height="12" rx="2" fill="#e3c47a" stroke="#8a6620"/></svg>';
/** Raison d'une partie non classée (settle.ts). */
const UNRANKED: Record<string, string> = { solo: 'il faut au moins deux joueurs humains', bots: 'des bots étaient à la table', rounds: 'elle comptait moins de 10 manches' };
const sgn = (v: number) => `<span class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${v > 0 ? '+' : ''}${v}</span>`;
/** Points de base d'une mise selon le barème du moteur (même calcul que endRound dans engine.ts : classique ou Rascal). */
/** « Coup de la manche » : le plus beau cas simple (mise 0 tenue avec beaucoup de cartes, plus gros bonus, plus grosse mise tenue). */
function coupDeLaManche(ps: PublicView['players']): string | null {
  let best: { pts: number; text: string } | null = null;
  const consider = (pts: number, text: string) => { if (pts > 0 && (!best || pts > best.pts)) best = { pts, text }; };
  for (const p of ps) {
    const x = p.hist?.at(-1); if (!x) continue; const ok = x.bid === x.won;
    if (ok && x.bid === 0 && x.cards >= 3) consider(x.base + 1, `${p.name} tient une mise de 0 avec ${x.cards} cartes en main : +${x.base}`);
    if (ok && x.bid >= 2) consider(x.base, `${p.name} tient sa mise de ${x.bid} : +${x.base}`);
    for (const it of x.items) if (it[0] >= 20) consider(it[0] + .5, `${p.name} : ${it[1]} (+${it[0]})`);
  }
  return best ? (best as { text: string }).text : null;
}
/**
 * Cartes de la main proportionnelles au bloc (docs/table-v2/PROMPT-claude-code.md, prompt 1) :
 * hauteur = hauteur disponible, largeur = hauteur / 1,4, écart = min(0,96 × largeur, place restante / (n − 1)) ;
 * si l'écart passe sous 0,38 × largeur, on réduit les cartes. La partie visible d'une carte reste d'au moins 44 px.
 */
function handLayout(Wbox: number, Hbox: number, n: number) {
  // marges : 8 px en haut et en bas, plus la descente des cartes du bord de l'éventail (d² px) ; un peu de largeur pour la rotation
  const W = Math.max(60, Wbox - 10), H0 = Hbox - 22 - ((n - 1) / 2) ** 2;
  // la rotation des cartes du bord ((n − 1) / 2 degrés) agrandit leur encombrement vertical
  const H = Math.max(40, H0 / (1 + Math.sin((n - 1) / 2 * Math.PI / 180) / 1.4));
  let cardH = H, cardW = cardH / 1.4;
  if (cardW > W) { cardW = W; cardH = cardW * 1.4; }
  let step = n > 1 ? Math.min(cardW * .96, (W - cardW) / (n - 1)) : cardW;
  // trop de cartes : on les réduit jusqu'à ce que l'écart vaille 0,38 × largeur
  if (n > 1 && step < cardW * .38) { cardW = W / (1 + .38 * (n - 1)); cardH = cardW * 1.4; step = cardW * .38; }
  // la partie visible (cliquable) d'une carte fait au moins 44 px, quand la largeur le permet
  // en dernier recours on réduit les cartes (40 px de large au moins) ; sur un téléphone étroit à 9-10 cartes, 44 px restent hors d'atteinte
  if (n > 1 && step < 44) { cardW = Math.max(40, Math.min(cardW, W - 44 * (n - 1))); cardH = cardW * 1.4; step = Math.min(cardW * .96, (W - cardW) / (n - 1)); }
  return { cardW, cardH, step };
}
/** Résumé de la main pendant la mise (maquette Bid) : « 2 atouts · 1 pirate · 1 sirène ». */
function handSummary(hand: Card[]) {
  const n = (f: (c: Card) => boolean) => hand.filter(f).length;
  const parts: [number, string, string][] = [
    [n(c => c.kind === 'num' && c.suit === 'black'), 'atout', 'atouts'], [n(c => c.kind === 'sk'), 'Skull King', 'Skull King'],
    [n(c => c.kind === 'pirate'), 'pirate', 'pirates'], [n(c => c.kind === 'tigress'), 'Morgane', 'Morgane'], [n(c => c.kind === 'mermaid'), 'sirène', 'sirènes']];
  return parts.filter(p => p[0]).map(([k, s, p]) => `${k} ${k > 1 ? p : s}`).join(' · ');
}
/** Notification du navigateur quand c'est à vous et que l'onglet est caché (préférence « Me prévenir quand c'est mon tour »). */
function notifyTurn() {
  try {
    if (localStorage.getItem('pli-notify') === '0' || !('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification('À vous de jouer', { body: 'Le Pli des Pirates : la table vous attend.', icon: './icon.svg', tag: 'pli-tour' });
  } catch { /* notifications indisponibles */ }
}
const ACH_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z"/></svg>';
/** « +9,7 » avec une décimale et un vrai signe moins. */
const signedOne = (v: number) => signed(Math.round(v * 10) / 10, Math.abs(v) < 100 ? 1 : 0);
/** « Devant Maëlle (172) », « À égalité avec Maëlle (172) » ; anciennes parties sans s ni elo : signe de la variation, sans parenthèses. */
function vsLabel(v: { name: string; delta: number; s?: number; elo?: number }) {
  const nm = esc(v.name) + (v.elo != null ? ` (${Math.round(v.elo)})` : '');
  if (v.s === 1) return 'Devant ' + nm; if (v.s === 0.5) return 'À égalité avec ' + nm; if (v.s === 0) return 'Derrière ' + nm;
  return `${v.delta >= 0 ? 'Devant' : 'Derrière'} ${esc(v.name)}`;
}
function stakeLines(b: number, cards: number, rascal: boolean): [string, number][] {
  const tenue = `Mise ${b} tenue`;
  if (rascal) return [[tenue, 10 * cards], ["Un pli d'écart", 5 * cards], ["Deux plis d'écart ou plus", 0]];
  if (b === 0) return [['Mise 0 tenue', 10 * cards], ['Au moins un pli pris', -10 * cards]];
  return [[tenue, 20 * b], ["Un pli d'écart", -10], ["Deux plis d'écart", -20]];
}
const VERBS: Record<string, string> = { joue: 'jouez', remporte: 'remportez', entame: 'entamez', mise: 'misez', fait: 'faites', choisit: 'choisissez', pioche: 'piochez', consulte: 'consultez', décide: 'décidez', garde: 'gardez', prend: 'prenez', tire: 'tirez' };
/** « Vous remporte le pli » (texte du moteur) → « Vous remportez le pli ». */
const vous = (t: string) => t.replace(/^Paris : /, 'Mises : ').replace(/^Vous (change|garde) son pari\b/, 'Vous $1z votre mise').replace(/(change|garde) son pari\b/, '$1 sa mise').replace(/la main de Vous\b/g, 'votre main').replace(/\bVous (\p{L}+)/gu, (m, v) => VERBS[v] ? 'Vous ' + VERBS[v] : m);
/** Ligne du journal. Les bonus (« +30 pour Maëlle : Pirate capturé par Skull King ») ont leur propre mise en forme : pastille de points, « Joueur · raison ». */
function logLine(l: { s: LogSeg[]; cls?: string }, me?: string) {
  if (l.cls === 'bonus' || l.cls === 'malus') {
    const m = /^([+−-]\d+) pour (.+?) : (.+)$/.exec(l.s.map(x => typeof x === 'string' ? x : cname(x.c, x.e)).join(''));
    if (m) {
      const mine = m[2] === me || m[2] === 'Vous';
      return `<div class="lbonus ${l.cls}"><span class="pts">${esc(m[1])}</span><div><b>${esc(mine ? 'Vous' : m[2])} · ${esc(m[3])}</b><small>compte si ${mine ? 'votre' : 'sa'} mise est tenue</small></div></div>`;
    }
  }
  return `<div class="${l.cls || ''}">${l.s.map(seg => typeof seg === 'string' ? esc(vous(seg)) : lc(seg.c, seg.e)).join('')}</div>`;
}
function lc(c: any, e: any) { const cl = c.kind === 'num' && !c.wild ? ' s-' + c.suit : ''; return `<span class="lc${cl}">${esc(cname(c, e))}</span>`; }
function roseSVG(): string {
  const cx=500,cy=300;let s: string=`<svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g stroke="#ead08a" fill="none">`;
  for(let k=0;k<32;k++){const a=k*Math.PI/16;s+=`<line x1="${cx}" y1="${cy}" x2="${(cx+1100*Math.cos(a)).toFixed(1)}" y2="${(cy+1100*Math.sin(a)).toFixed(1)}" stroke-opacity="${k%4?0.06:0.12}" stroke-width="1"/>`;}
  for(const [x,y] of [[160,110],[850,480],[140,470],[860,120]])for(let k=0;k<16;k++){const a=k*Math.PI/8;s+=`<line x1="${x}" y1="${y}" x2="${(x+600*Math.cos(a)).toFixed(1)}" y2="${(y+600*Math.sin(a)).toFixed(1)}" stroke-opacity=".035"/>`;}
  s+=`<circle cx="${cx}" cy="${cy}" r="150" stroke-opacity=".22" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="138" stroke-opacity=".16"/><circle cx="${cx}" cy="${cy}" r="96" stroke-opacity=".14" stroke-dasharray="2 5"/>`;
  for(let k=0;k<72;k++){const a=k*Math.PI/36,r1=k%2?143:140;s+=`<line x1="${(cx+r1*Math.cos(a)).toFixed(1)}" y1="${(cy+r1*Math.sin(a)).toFixed(1)}" x2="${(cx+150*Math.cos(a)).toFixed(1)}" y2="${(cy+150*Math.sin(a)).toFixed(1)}" stroke-opacity=".22"/>`;}
  s+='</g>';
  const pt=(a: number, r: number)=>[(cx+r*Math.cos(a)).toFixed(1),(cy+r*Math.sin(a)).toFixed(1)];
  for(const [n,R,w,op] of ( [[8,64,10,.10],[4,98,16,.16],[4,132,22,.2]] as number[][])){
    for(let k=0;k<n;k++){const a=-Math.PI/2+k*2*Math.PI/n+(n===8?Math.PI/8:0)+(n===4&&R===98?Math.PI/4:0);
      const [tx,ty]=pt(a,R),[lx,ly]=pt(a-Math.PI/2,w),[rx,ry]=pt(a+Math.PI/2,w);
      s+=`<path d="M${cx} ${cy}L${lx} ${ly}L${tx} ${ty}z" fill="#ead08a" fill-opacity="${op}"/><path d="M${cx} ${cy}L${rx} ${ry}L${tx} ${ty}z" fill="#000" fill-opacity="${op*1.3}"/>`;}}
  s+=`<circle cx="${cx}" cy="${cy}" r="9" fill="#ead08a" fill-opacity=".22"/><path d="M${cx} ${cy-148}l-9 -20h18z" fill="#ead08a" fill-opacity=".25"/>`;
  s+=`<g fill="#ead08a" fill-opacity=".2" font-family="IM Fell English SC, Georgia, serif" font-size="22" text-anchor="middle"><text x="${cx}" y="${cy-172}">N</text><text x="${cx}" y="${cy+192}">S</text><text x="${cx+176}" y="${cy+8}">E</text><text x="${cx-176}" y="${cy+8}">O</text></g>`;
  s+=`<g stroke="#ead08a" stroke-opacity=".09" fill="none" stroke-width="1.2"><path d="M0 70c40 10 70-5 100 12s40 40 90 34 60-36 100-40"/><path d="M0 92c40 10 70-5 100 12s40 40 90 34"/><path d="M1000 520c-50-6-80 10-110-8s-40-34-90-30-60 30-100 34"/><path d="M1000 540c-50-6-80 10-110-8s-40-34-90-30"/></g>`;
  return s+'</svg>';
}

