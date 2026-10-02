// Vue de la table, partagée par le mode en ligne et l'entraînement hors ligne.
// Elle affiche des instantanés publics (rejoués avec un délai pour animer) et la main privée du joueur.
import { cname, leadSuitOf, wildRule, SUIT, WILD_SUITS, PIRATES, type Action, type PublicView, type PrivateView, type LogSeg } from '@engine';
import { cardHTML, backFace } from './cards';
import { $, esc, modal, sleep, toast } from './util';
import { rulesHTML } from './rules';
import { sfx, soundOn, setSound } from './sound';
import { installCardZoom } from './zoom';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Remplace le contenu d'un élément seulement s'il a changé : évite de recréer le DOM (et de casser animations et survol). */
const htmlCache = new WeakMap<Element, string>();
function setHTML(el: Element, html: string) { if (htmlCache.get(el) !== html) { el.innerHTML = html; htmlCache.set(el, html); } }
function elFrom(html: string) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; }
const center = (r: DOMRect) => [r.left + r.width / 2, r.top + r.height / 2];

export interface TableBackend { send(move: Action): Promise<void> }
const PCOL = ['#d9b25a', '#c8644b', '#5c9db6', '#7ab874', '#a982c4', '#e0954a', '#cfc6b0', '#6f8fd0', '#d47fa6'];
const DELAY: Record<string, number> = { play: 650, trick: 1700, trickEnd: 150, bids: 1300, deal: 350, round: 300, end: 0 };
const PENDING_LABEL: Record<string, string> = {
  plank: 'choisit le pirate qui marche sur la planche', rosie: 'choisit qui entame le prochain pli', bahij: 'pioche et défausse deux cartes',
  rascal: 'choisit sa mise', juanita: 'consulte la pioche', harry: 'décide de modifier son pari', mary: 'choisit une main où tirer une carte',
};

export class TableView {
  pub: PublicView | null = null; priv: PrivateView | null = null;
  private latest: { pub: PublicView; priv: PrivateView | null } | null = null;
  private queue: any[] = []; private running = false; private busy = false;
  private banner: string | null = null; private bannerShown: string | null = null;
  private logLines: { s: LogSeg[]; cls?: string }[] = [];
  private seenEntries = 0; private seenTrick = -1;
  private pick: { k: number; sel: Set<number> } | null = null;
  private choice: { id: number; need: string[]; move: any } | null = null;
  private shownRound = 0; private shownEnd = false;
  // éléments conservés d'un rendu à l'autre
  private seatEls: HTMLElement[] = []; private centerEl: HTMLElement | null = null;
  private tcards = new Map<string, HTMLElement>(); private collectTo: number | null = null;
  private handEls = new Map<number, HTMLElement>(); private handRound = -1;
  private flyFrom: { id: number; rect: DOMRect } | null = null; private sendingId: number | null = null;
  private prevScores: (number | undefined)[] = []; private revealRound = -1;
  private wasMyTurn = false; private baseTitle = document.title; private resizeRaf = 0;
  speed = 1;

  constructor(private root: HTMLElement, private mySeat: number | null, private backend: TableBackend, private onExit: () => void) {
    try { this.speed = Number(localStorage.getItem('pli-speed')) || 1; } catch { /* stockage indisponible */ }
    const allowed = [1.7, 1, 0.45]; const sel = allowed.includes(this.speed) ? this.speed : 1;
    root.innerHTML = `
    <div class="main">
      <div class="stage">
        <div class="gamebar">
          <div id="pRound" class="track" aria-label="Progression des manches"></div>
          <div class="tools">
            <select id="speed" class="tbtn" aria-label="Vitesse des animations"><option value="1.7">Lente</option><option value="1">Normale</option><option value="0.45">Rapide</option></select>
            <button class="tbtn" id="bSound" aria-pressed="${soundOn()}" title="Activer / couper le son">${soundOn() ? '🔊' : '🔇'}<span> Son</span></button>
            <button class="tbtn" id="bLast">Dernier pli</button><button class="tbtn" id="bScores">Scores</button><button class="tbtn" id="bRules">Règles</button><button class="tbtn" id="bExit">Quitter</button>
          </div>
        </div>
        <section id="table" aria-label="Table de jeu"><div class="rim"></div><div class="mat">${roseSVG()}</div><div id="layer"></div></section>
        <div id="action" aria-live="polite"><div class="prompt">Chargement de la partie…</div></div>
        <section class="rail"><div class="handhead"><span id="handTitle"><b>Votre main</b></span><span id="handMeta" class="tags"></span></div><div id="hand"></div></section>
      </div>
      <aside class="side">
        <div class="panel"><h3>Équipage <small id="miniSub"></small></h3><table class="mini" id="mini"></table></div>
        <div class="panel"><h3>Journal de bord</h3><div id="log"></div></div>
      </aside>
    </div>`;
    const sp = $('#speed', root) as HTMLSelectElement; sp.value = String(sel);
    sp.onchange = () => { this.speed = Number(sp.value); try { localStorage.setItem('pli-speed', sp.value); } catch { /* ignoré */ } };
    $('#bScores', root).onclick = () => this.scoreSheet();
    $('#bLast', root).onclick = () => this.lastTrickModal();
    const bs = $('#bSound', root); bs.onclick = () => { setSound(!soundOn()); bs.setAttribute('aria-pressed', String(soundOn())); bs.innerHTML = `${soundOn() ? '🔊' : '🔇'}<span> Son</span>`; if (soundOn()) sfx.coin(); };
    installCardZoom();
    $('#bRules', root).onclick = () => modal(rulesHTML());
    $('#bExit', root).onclick = () => this.onExit();
    $('#hand', root).addEventListener('click', ev => { const el = (ev.target as HTMLElement).closest('.card') as HTMLElement | null; if (el) this.handClick(Number(el.dataset.id)); });
    $('#hand', root).addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { const el = (ev.target as HTMLElement).closest('.card') as HTMLElement | null; if (el) { ev.preventDefault(); this.handClick(Number(el.dataset.id)); } } });
    addEventListener('resize', this.onResize); document.addEventListener('visibilitychange', this.onVis);
  }
  private onResize = () => { cancelAnimationFrame(this.resizeRaf); this.resizeRaf = requestAnimationFrame(() => { this.renderTable(); this.renderHand(); }); };
  private onVis = () => { if (!document.hidden) document.title = this.baseTitle; };
  destroy() { removeEventListener('resize', this.onResize); document.removeEventListener('visibilitychange', this.onVis); this.queue = []; document.title = this.baseTitle; }

  /** État de référence (dernier état du serveur), appliqué quand les animations sont terminées. */
  setLatest(pub: PublicView, priv: PrivateView | null) {
    this.latest = { pub, priv };
    if (!this.running && !this.queue.length) this.applyLatest();
  }
  push(events: any[]) { if (!events.length) return; this.queue.push(...events); this.run(); }

  private applyLatest() {
    if (!this.latest) return;
    this.pub = this.latest.pub; this.priv = this.latest.priv; this.logLines = this.pub.log.slice();
    this.banner = null; this.render();
    this.maybeRoundSummary(this.pub); this.maybeFinal();
  }
  private async run() {
    if (this.running) return; this.running = true;
    try {
      while (this.queue.length) {
        const ev = this.queue.shift();
        this.pub = ev.snap; const last = ev.snap.log?.at(-1);
        if (last && JSON.stringify(this.logLines.at(-1)) !== JSON.stringify(last)) this.logLines.push(last);
        if (ev.k === 'bids' || ev.k === 'trick') this.banner = ev.msg; else if (ev.k !== 'play') this.banner = null;
        this.render();
        if (ev.k === 'trick') sfx.win(); else if (ev.k === 'bids') sfx.coin();
        if (ev.k === 'round') this.maybeRoundSummary(ev.snap);
        await sleep((DELAY[ev.k] ?? 300) * this.speed * (this.queue.length > 40 ? .2 : 1));
        if (ev.k === 'bids' || ev.k === 'trick') this.banner = null;
      }
    } finally { this.running = false; }
    this.applyLatest();
  }
  private get live() { return !this.running && !this.queue.length && !!this.latest && this.pub === this.latest.pub; }

  /* ---------- Rendu ---------- */
  private bottom() { return this.mySeat ?? 0; }
  private seatPos(i: number, n: number, rx: number, ry: number) { const rel = (i - this.bottom() + n) % n; const a = (90 + rel * 360 / n) * Math.PI / 180; return [50 + rx * Math.cos(a), 50 + ry * Math.sin(a)]; }
  render() { if (!this.pub) return; this.renderBar(); this.renderTable(); this.renderHand(); this.renderMini(); this.renderLog(); this.renderAction(); this.turnCue(); }
  /** Signale le début de son tour : son, barre d'action qui s'illumine, titre de l'onglet. */
  private turnCue() {
    const pb = this.pub!, pv = this.priv;
    const mine = this.live && !this.busy && this.mySeat != null && !!pv && pb.phase !== 'end' &&
      ((pb.phase === 'bid' && pv.bid == null) || (pb.pending ? pb.pending.seat === this.mySeat : pb.current === this.mySeat));
    $('#action', this.root).classList.toggle('mine', mine);
    if (mine && !this.wasMyTurn) { sfx.turn(); const a = $('#action', this.root); a.classList.remove('nudge'); void a.offsetWidth; a.classList.add('nudge'); }
    this.wasMyTurn = mine;
    document.title = mine && document.hidden ? '⚓ À vous de jouer ! · ' + this.baseTitle : this.baseTitle;
  }
  private get animMs() { return reduceMotion() ? 0 : Math.max(.5, Math.min(this.speed, 1.4)); }
  private renderBar() {
    let h = '<span class="lbl">Manche</span>';
    for (let r = 1; r <= 10; r++) h += `<i class="${r < this.pub!.round ? 'done' : r === this.pub!.round ? 'now' : ''}">${r}</i>`;
    $('#pRound', this.root).innerHTML = h;
  }
  private bidOf(i: number) {
    const p = this.pub!.players[i];
    if (this.pub!.bidsRevealed) return { txt: String(p.bid), wait: false };
    if (i === this.mySeat && this.priv?.bid != null) return { txt: String(this.priv.bid), wait: false };
    return { txt: p.hasBid ? '✓' : '…', wait: true };
  }
  private pips(i: number) {
    const p = this.pub!.players[i]; if (!this.pub!.bidsRevealed || p.bid == null) return '';
    if (p.bid === 0) return `<span class="zero ${p.won === 0 ? 'ok' : 'ko'}">${p.won === 0 ? 'Pari 0 tenu' : p.won + ' pli' + (p.won > 1 ? 's' : '') + ' de trop'}</span>`;
    let h = ''; for (let k = 0; k < Math.max(p.bid, p.won); k++) h += `<i class="${k < p.won ? (k < p.bid ? 'on' : 'over') : ''}"></i>`; return h;
  }
  private turnSeats(): number[] { const pb = this.pub!; if (pb.phase === 'bid') return pb.players.map((p, i) => p.hasBid ? -1 : i).filter(i => i >= 0); return pb.current == null ? [] : [pb.current]; }
  renderTable() {
    const pb = this.pub; if (!pb) return;
    const tbl = $('#table', this.root), layer = $('#layer', this.root);
    const n = pb.players.length, W = tbl.clientWidth, H = tbl.clientHeight, mob = W < 600, b = this.bottom();
    // taille des cartes du pli : proportionnelle au plateau, réduite quand la table est pleine
    const ts = mob ? Math.min(.26, Math.max(.19, H * .17 / 352)) * (n >= 6 ? .85 : 1) : Math.min(.44, Math.max(.2, H * .25 / 352)) * (n >= 8 ? .82 : n >= 6 ? .9 : 1);
    tbl.style.setProperty('--ts', ts.toFixed(3));
    const turn = new Set(this.turnSeats());
    if (this.seatEls.length && !this.seatEls[0].isConnected) { this.seatEls = []; this.centerEl = null; this.tcards.clear(); }

    pb.players.forEach((p, i) => {
      let el = this.seatEls[i];
      if (!el) { el = document.createElement('div'); el.className = 'seat'; el.innerHTML = '<div class="fan"></div><div class="plate"></div><div class="pips"></div>'; layer.append(el); this.seatEls[i] = el; }
      const [x, y] = this.seatPos(i, n, mob ? 37 : 40, mob ? 41 : 42); const bid = this.bidOf(i);
      el.style.left = x + '%'; el.style.top = y + '%'; el.style.setProperty('--pc', PCOL[i % 9]);
      el.classList.toggle('turn', turn.has(i) && pb.phase !== 'end'); el.classList.toggle('me', i === this.mySeat);
      const k = i === b ? 0 : Math.min(p.handCount, 10); let fan = '';
      for (let j = 0; j < k; j++) fan += `<div class="bk" style="transform:rotate(${(j - (k - 1) / 2) * 7}deg)">${backFace()}</div>`;
      setHTML(el.children[0], fan);
      const reveal = pb.bidsRevealed && this.revealRound !== pb.round;
      setHTML(el.children[1], `${pb.leader === i && pb.phase === 'play' ? '<span class="leadtag">ENTAME</span>' : ''}
        <div class="medal">${esc((p.name.trim()[0] || '?').toUpperCase())}</div>
        <div class="pi"><div class="nm">${esc(p.name)}${i === this.mySeat && p.name !== 'Vous' ? ' <span class="you">vous</span>' : ''}</div><div class="sub"><b>${p.score}</b> pts<span class="bt">${p.bot ? ' · bot' : ''}</span></div></div>
        <div class="coin ${bid.wait ? 'wait' : ''} ${reveal ? 'reveal' : ''}" title="Pari">${bid.txt}</div>`);
      setHTML(el.children[2], this.pips(i));
      // variation de score : petite bulle +/- au-dessus du siège
      const prev = this.prevScores[i];
      if (prev != null && prev !== p.score && !reduceMotion()) {
        const d = p.score - prev, f = document.createElement('div');
        f.className = 'float ' + (d < 0 ? 'neg' : ''); f.textContent = (d > 0 ? '+' : '') + d; el.append(f); setTimeout(() => f.remove(), 2000);
      }
      this.prevScores[i] = p.score;
    });
    if (pb.bidsRevealed) this.revealRound = pb.round;

    // pli en cours : une carte = un élément conservé, qui arrive en volant et repart vers le gagnant
    const t = pb.trick, want = new Set<string>();
    if (t) {
      const base = `${pb.round}-${pb.trickNo}`, cnt: Record<number, number> = {}, seen: Record<number, number> = {};
      t.entries.forEach(e => { cnt[e.p] = (cnt[e.p] || 0) + 1; });
      t.entries.forEach((e, idx) => {
        const key = `${base}-${idx}`; want.add(key);
        const j = seen[e.p] = (seen[e.p] ?? -1) + 1;
        const [x, y] = this.seatPos(e.p, n, mob ? 19 : 21, mob ? 19 : 20);
        let w = this.tcards.get(key); const fresh = !w;
        if (!w) {
          w = elFrom(`<div class="tslot">${cardHTML(e.card, e)}<span class="who" style="--pc:${PCOL[e.p % 9]}">${esc(pb.players[e.p].name)}</span></div>`);
          (w.firstElementChild as HTMLElement).style.rotate = `${((idx * 37 + pb.trickNo * 11) % 9) - 4}deg`;
          layer.append(w); this.tcards.set(key, w);
        }
        w.style.left = x + '%'; w.style.top = y + '%'; w.style.zIndex = String(10 + idx);
        w.style.setProperty('--off', String(j - (cnt[e.p] - 1) / 2));
        const c = w.firstElementChild as HTMLElement, res = t.res;
        c.classList.toggle('win', !!res && res.winner === idx);
        c.classList.toggle('gone', res ? (!!res.removed?.includes(idx) || !!res.discarded) : !!t.removals?.includes(idx));
        if (fresh) this.flyIn(c, e.p, e.card.id);
      });
      this.collectTo = t.res ? (t.res.winner != null ? t.entries[t.res.winner].p : -1) : null;
    }
    let out = 0;
    for (const [key, w] of this.tcards) if (!want.has(key)) { this.tcards.delete(key); this.flyOut(w, this.collectTo, out++); }
    if (!t) this.collectTo = null;

    let mid = '';
    if (this.banner) { mid = `<div class="banner ${this.bannerShown !== this.banner ? 'fresh' : ''}">${esc(this.banner)}</div>`; this.bannerShown = this.banner; }
    else if (pb.phase === 'play' && t) {
      const ls = leadSuitOf(t.entries);
      mid = `<div class="rd">Pli ${pb.trickNo} / ${pb.cards}</div>` + (ls ? `<span class="chip s-${ls}"><i></i>${SUIT[ls].n}<span class="long"> demandé</span></span>` : (t.entries.length ? '<span class="chip none"><span class="long">Aucune couleur demandée</span><span class="short">Sans couleur</span></span>' : ''));
    } else if (pb.phase === 'bid') mid = `<div class="rd big">Manche ${pb.round}</div><div class="rd">Les pirates parient…</div>`;
    else if (pb.round) mid = `<div class="rd">Manche ${pb.round}</div>`;
    if (!this.centerEl) { this.centerEl = document.createElement('div'); this.centerEl.className = 'center'; layer.append(this.centerEl); }
    setHTML(this.centerEl, mid); this.centerEl.classList.toggle('front', !!this.banner);
  }
  /** Carte qui arrive sur le pli : depuis la main (si c'est la nôtre) ou depuis le siège de l'adversaire. */
  private flyIn(c: HTMLElement, seat: number, id: number) {
    sfx.card(); const k = this.animMs; if (!k) return;
    const to = c.getBoundingClientRect(); let from: DOMRect | null = null, s0 = .45, op = .2;
    if (this.flyFrom && this.flyFrom.id === id) { from = this.flyFrom.rect; s0 = from.width / Math.max(1, to.width); op = 1; this.flyFrom = null; }
    else { const pl = this.seatEls[seat]?.querySelector('.plate'); if (pl) from = pl.getBoundingClientRect(); }
    if (!from) { c.animate([{ opacity: 0, scale: '.8' }, { opacity: 1, scale: '1' }], { duration: 220 * k, easing: 'ease-out' }); return; }
    const [fx, fy] = center(from), [tx, ty] = center(to);
    c.animate([
      { translate: `${fx - tx}px ${fy - ty}px`, scale: String(s0), opacity: op, offset: 0 },
      { translate: '0 0', scale: '1.07', opacity: 1, offset: .82 },
      { translate: '0 0', scale: '1', opacity: 1 },
    ], { duration: 420 * k, easing: 'cubic-bezier(.2,.8,.25,1)' });
  }
  /** Fin du pli : les cartes glissent vers le gagnant (ou coulent si le pli est défaussé). */
  private flyOut(w: HTMLElement, seat: number | null, i: number) {
    const k = this.animMs, c = w.firstElementChild as HTMLElement;
    if (!k) { w.remove(); return; }
    w.classList.add('leaving'); let kf: Keyframe[];
    const pl = seat != null && seat >= 0 ? this.seatEls[seat]?.querySelector('.plate') : null;
    if (pl) { const [fx, fy] = center(c.getBoundingClientRect()), [tx, ty] = center(pl.getBoundingClientRect()); kf = [{ translate: '0 0', scale: '1' }, { translate: `${tx - fx}px ${ty - fy}px`, scale: '.3', opacity: .1 }]; }
    else kf = [{ translate: '0 0', scale: '1', opacity: 1 }, { translate: '0 40px', scale: '.7', opacity: 0 }];
    const a = c.animate(kf, { duration: 480 * k, delay: i * 40 * k, easing: 'cubic-bezier(.55,0,.7,.4)', fill: 'forwards' });
    a.onfinish = () => w.remove(); a.oncancel = () => w.remove();
  }
  private myTurnToPlay() {
    const pb = this.pub!; return this.live && !this.busy && this.mySeat != null && pb.phase === 'play' && !pb.pending && pb.current === this.mySeat;
  }
  private renderHand() {
    const el = $('#hand', this.root);
    const clear = (msg: string) => { this.handEls.clear(); el.innerHTML = `<span class="hidden-hand">${msg}</span>`; };
    if (this.mySeat == null || !this.priv) { $('#handTitle', this.root).innerHTML = '<b>Spectateur</b>'; $('#handMeta', this.root).innerHTML = ''; clear('Vous regardez la partie.'); return; }
    const pv = this.priv, pb = this.pub!;
    const played = new Set((pb.trick?.entries || []).filter(e => e.p === this.mySeat).map(e => e.card.id));
    const hand = this.live ? pv.hand : pv.hand.filter(c => !played.has(c.id));
    $('#handTitle', this.root).innerHTML = '<b>Votre main</b>';
    const tags: string[] = []; const bid = this.bidOf(this.mySeat); if (!bid.wait) tags.push(`Pari ${bid.txt}`);
    const won = pb.players[this.mySeat].won; tags.push(`Plis ${won}`);
    if (pb.players[this.mySeat].rascal) tags.push(`Mise ${pb.players[this.mySeat].rascal}`);
    const st = !bid.wait && pb.bidsRevealed ? (won === Number(bid.txt) ? 'ok' : won > Number(bid.txt) ? 'ko' : '') : '';
    setHTML($('#handMeta', this.root), tags.map((x, i) => `<span class="${i === 1 ? st : ''}">${x}</span>`).join(''));
    if (this.sendingId != null && !hand.some(c => c.id === this.sendingId)) this.sendingId = null;
    if (!hand.length) { clear('Plus de cartes en main.'); return; }
    el.querySelector('.hidden-hand')?.remove();

    const before = new Map<number, number>(); for (const [id, c] of this.handEls) before.set(id, c.getBoundingClientRect().left);
    // taille : la plus grande qui tient dans la largeur, en resserrant l'éventail si besoin
    const len = hand.length, mob = innerWidth < 640, Wd = Math.max(220, el.clientWidth - 20);
    const sMax = Math.min(mob ? .4 : .56, (innerHeight * (mob ? .19 : .2)) / 352), sMin = mob ? .27 : .34;
    let v = .78, s = Math.min(sMax, Wd / (252 * (1 + (len - 1) * v)));
    if (s < sMin) { s = sMin; if (len > 1) v = Math.max(.28, (Wd / (252 * s) - 1) / (len - 1)); }
    el.style.setProperty('--hs', s.toFixed(3)); el.style.setProperty('--hv', v.toFixed(3));

    const ids = new Set(hand.map(c => c.id));
    for (const [id, c] of this.handEls) if (!ids.has(id)) { c.remove(); this.handEls.delete(id); }
    const playing = this.myTurnToPlay() && !this.choice; const legal = new Set(pv.legal);
    const m = (len - 1) / 2, step = Math.min(3, 24 / Math.max(len, 1)); const added: HTMLElement[] = [];
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
      ce.classList.toggle('sel', (pick && this.pick!.sel.has(c.id)) || this.choice?.id === c.id);
      ce.classList.toggle('forced', pv.forced === c.id);
      ce.classList.toggle('sending', this.sendingId === c.id);
      if (act) { ce.tabIndex = 0; ce.setAttribute('role', 'button'); } else { ce.removeAttribute('tabindex'); ce.removeAttribute('role'); }
      const d = j - m; ce.style.setProperty('--r', (d * step).toFixed(2) + 'deg'); ce.style.setProperty('--y', (d * d * .6).toFixed(1) + 'px'); ce.style.zIndex = String(j + 1);
    });
    const k = this.animMs; if (!k) return;
    // nouvelle donne : les cartes partent du centre de la table, une à une
    const dealing = added.length > 1 && this.handRound !== pb.round; this.handRound = pb.round;
    if (dealing) {
      const [cx, cy] = center($('#table', this.root).getBoundingClientRect());
      added.forEach((ce, i) => {
        const [x, y] = center(ce.getBoundingClientRect());
        ce.animate([{ translate: `${cx - x}px ${cy - y}px`, scale: '.35', rotate: '-160deg', opacity: 0 }, { translate: '0 0', scale: '1', rotate: '0deg', opacity: 1 }],
          { duration: 420 * k, delay: i * 75 * k, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'backwards' });
      });
      sfx.deal(added.length); return;
    }
    // le reste de la main se resserre en douceur
    for (const [id, x0] of before) {
      const ce = this.handEls.get(id); if (!ce) continue;
      const dx = x0 - ce.getBoundingClientRect().left;
      if (Math.abs(dx) > 1) ce.animate([{ translate: `${dx}px 0` }, { translate: '0 0' }], { duration: 300 * k, easing: 'cubic-bezier(.25,.8,.3,1)' });
    }
    added.forEach(ce => ce.animate([{ opacity: 0, translate: '0 -30px' }, { opacity: 1, translate: '0 0' }], { duration: 280 * k, easing: 'ease-out' }));
  }
  private renderMini() {
    const pb = this.pub!; const rows = pb.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score);
    $('#miniSub', this.root).textContent = pb.round ? `Manche ${pb.round}` : '';
    $('#mini', this.root).innerHTML = rows.map(({ p, i }, k) => {
      let bw = '', cl = ''; if (pb.bidsRevealed && p.bid != null) { bw = `${p.won} / ${p.bid}`; cl = p.won === p.bid ? 'ok' : (p.won > p.bid ? 'ko' : ''); }
      return `<tr><td class="rk">${k + 1}</td><td><span class="dot" style="background:${PCOL[i % 9]}"></span>${esc(p.name)}</td><td class="bw ${cl}" title="Plis / pari">${bw}</td><td class="tt">${p.score}</td></tr>`;
    }).join('');
  }
  private renderLog() {
    const el = $('#log', this.root), lines = this.logLines.slice(-150);
    const key = lines.length + '|' + JSON.stringify(lines.at(-1) ?? null);
    if (htmlCache.get(el) === key) return; htmlCache.set(el, key);
    el.innerHTML = lines.map(l => `<div class="${l.cls || ''}">${l.s.map(seg => typeof seg === 'string' ? esc(seg) : lc(seg.c, seg.e)).join('')}</div>`).join('');
    el.scrollTop = el.scrollHeight;
  }

  /* ---------- Actions ---------- */
  private setAction(text: string, btns: { label: string; on: () => void; cls?: string; disabled?: boolean }[] = []) {
    const a = $('#action', this.root); a.innerHTML = `<div class="prompt">${text}</div>`;
    if (btns.length) { const w = document.createElement('div'); w.className = 'btns'; btns.forEach(b => { const el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.label; el.disabled = !!b.disabled || this.busy; el.onclick = b.on; w.append(el); }); a.append(w); }
  }
  private renderAction() {
    const pb = this.pub!, me = this.mySeat, pv = this.priv;
    const name = (i: number) => esc(pb.players[i]?.name ?? '?');
    if (!this.live) { this.setAction(this.banner ? esc(this.banner) : (pb.current != null ? `${name(pb.current)} joue…` : '…')); return; }
    if (pb.phase === 'end') { this.setAction('Partie terminée.', [{ label: 'Classement final', cls: 'gold', on: () => this.finalModal() }, { label: "Retour à l'accueil", cls: 'alt', on: () => this.onExit() }]); return; }
    if (me == null || !pv) { this.setAction(pb.phase === 'bid' ? 'Les joueurs parient…' : (pb.current != null ? `Au tour de ${name(pb.current)}` : '…')); return; }
    if (this.busy) { this.setAction('Envoi…'); return; }
    if (pb.phase === 'bid') {
      if (pv.bid == null) {
        const opts: { label: string; cls: string; on: () => void }[] = []; for (let b = 0; b <= pb.cards; b++) opts.push({ label: String(b), cls: 'coin', on: () => this.send({ t: 'bid', n: b }) });
        this.setAction(`Combien de plis allez-vous remporter ?<small>Manche ${pb.round} · ${pb.cards} carte${pb.cards > 1 ? 's' : ''} en main</small>`, opts);
      } else {
        const w = pb.players.map((p, i) => p.hasBid ? null : name(i)).filter(Boolean);
        this.setAction(`Pari enregistré : ${pv.bid}.<small>En attente de ${w.join(', ')}</small>`);
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
        case 'mary': return this.setAction(`${PIRATES.mary.n} : dans quelle main tirez-vous une carte au hasard ?`, btns(opts));
        case 'rascal': return this.setAction(`${PIRATES.rascal.n} : combien misez-vous sur votre pari ?<small>Gagnés si le pari est réussi, perdus sinon.</small>`, btns(opts));
        case 'harry': return this.setAction(`${PIRATES.harry.n} : votre pari est de ${pv.bid}. Le modifier ?`, btns(opts));
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
      this.setAction(pv.forced != null ? `${PIRATES.mary.n} vous impose cette carte` : (pb.trick && pb.trick.stage === 'volley' ? 'Dernière Bordée : jouez votre carte supplémentaire' : 'À vous de jouer !<small>Cliquez sur une carte en surbrillance · survol prolongé ou appui long pour la lire en grand</small>'));
      return;
    }
    this.setAction(pb.current != null ? `Au tour de ${name(pb.current)}` : '…');
  }
  private handClick(id: number) {
    if (this.pick) { const s = this.pick.sel; if (s.has(id)) s.delete(id); else if (s.size < this.pick.k) s.add(id); this.renderHand(); this.renderAction(); return; }
    if (!this.myTurnToPlay() || !this.priv!.legal.includes(id)) return;
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
  private maybeRoundSummary(snap: PublicView) {
    const p0 = snap.players[0]; const h = p0?.hist; if (!h || !h.length) return;
    const r = h.at(-1).r; if (r <= this.shownRound) return; this.shownRound = r;
    if (snap.phase === 'end' && r === 10) return; // la fenêtre finale prend le relais
    const rows = snap.players.map(p => {
      const x = p.hist!.at(-1); const bx = x.items.length ? x.items.map((it: any) => `${it[0] > 0 ? '+' : ''}${it[0]} ${esc(it[1])}`).join('<br>') : '—';
      return `<tr><td class="l">${esc(p.name)}</td><td>${x.bid}</td><td>${x.won}</td><td>${sgn(x.base)}</td><td class="bx">${bx}</td><td>${sgn(x.tot)}</td><td><b>${p.score}</b></td></tr>`;
    }).join('');
    modal(`<h2>Fin de la manche ${r}</h2><p class="sub">${h.at(-1).cards} carte${h.at(-1).cards > 1 ? 's' : ''} par joueur.</p>
      <div class="scroll"><table class="st"><tr><th class="l">Pirate</th><th>Pari</th><th>Plis</th><th>Points</th><th class="l">Bonus</th><th>Manche</th><th>Total</th></tr>${rows}</table></div>`, [{ label: 'Continuer', value: 1 }]);
  }
  private maybeFinal() { if (this.pub?.phase === 'end' && !this.shownEnd) { this.shownEnd = true; this.finalModal(); } }
  private finalModal() {
    const pb = this.pub!; const rk = pb.players.slice().sort((a, b) => b.score - a.score); const best = rk[0].score;
    const winners = rk.filter(p => p.score === best).map(p => esc(p.name)).join(' et ');
    let rank = 0, prev: number | null = null;
    modal(`<h2>${winners} remporte${rk.filter(p => p.score === best).length > 1 ? 'nt' : ''} la partie</h2><p class="sub">Capitaine des Sept Mers.</p>
      <div class="scroll"><table class="st"><tr><th>#</th><th class="l">Pirate</th><th>Score</th></tr>${rk.map((p, k) => { if (p.score !== prev) { rank = k + 1; prev = p.score; } return `<tr><td>${rank}</td><td class="l">${esc(p.name)}</td><td><b>${p.score}</b></td></tr>`; }).join('')}</table></div>`,
      [{ label: 'Feuille de scores', value: 's', cls: 'alt' }, { label: 'Fermer', value: null }]).then(v => { if (v === 's') this.scoreSheet(); });
  }
  scoreSheet() {
    const ps = this.latest?.pub.players || this.pub?.players || []; if (!ps.length) return;
    let h = `<h2>Feuille de scores</h2><p class="sub">Pari / plis remportés, puis points de la manche.</p><div class="scroll"><table class="st"><tr><th>Manche</th>${ps.map(p => `<th>${esc(p.name)}</th>`).join('')}</tr>`;
    for (let r = 1; r <= 10; r++) h += `<tr><td>${r}</td>` + ps.map(p => { const x = p.hist?.[r - 1]; return `<td>${x ? `${x.bid}/${x.won} · ${sgn(x.tot)}` : '—'}</td>`; }).join('') + '</tr>';
    h += `<tr class="tot"><td>Total</td>${ps.map(p => `<td>${p.score}</td>`).join('')}</tr></table></div>`;
    modal(h);
  }
}
const sgn = (v: number) => `<span class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${v > 0 ? '+' : ''}${v}</span>`;
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

