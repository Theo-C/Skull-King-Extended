// Vue de la table, partagée par le mode en ligne et l'entraînement hors ligne.
// Elle affiche des instantanés publics (rejoués avec un délai pour animer) et la main privée du joueur.
import { cname, leadSuitOf, wildRule, SUIT, WILD_SUITS, PIRATES, type Action, type PublicView, type PrivateView, type LogSeg } from '@engine';
import { cardHTML, backFace } from './cards';
import { $, esc, modal, sleep, toast } from './util';
import { rulesHTML } from './rules';

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
            <button class="tbtn" id="bScores">Scores</button><button class="tbtn" id="bRules">Règles</button><button class="tbtn" id="bExit">Quitter la table</button>
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
    $('#bRules', root).onclick = () => modal(rulesHTML());
    $('#bExit', root).onclick = () => this.onExit();
    $('#hand', root).addEventListener('click', ev => { const el = (ev.target as HTMLElement).closest('.card') as HTMLElement | null; if (el) this.handClick(Number(el.dataset.id)); });
    $('#hand', root).addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { const el = (ev.target as HTMLElement).closest('.card') as HTMLElement | null; if (el) { ev.preventDefault(); this.handClick(Number(el.dataset.id)); } } });
    addEventListener('resize', this.onResize);
  }
  private onResize = () => this.renderTable();
  destroy() { removeEventListener('resize', this.onResize); this.queue = []; }

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
  render() { if (!this.pub) return; this.renderBar(); this.renderTable(); this.renderHand(); this.renderMini(); this.renderLog(); this.renderAction(); }
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
    const pb = this.pub; if (!pb) return; const n = pb.players.length, mob = innerWidth < 640, b = this.bottom();
    const turn = new Set(this.turnSeats()); let h = '';
    pb.players.forEach((p, i) => {
      const [x, y] = this.seatPos(i, n, mob ? 36 : 40, 42); const bid = this.bidOf(i);
      const k = Math.min(p.handCount, 10); let fan = '';
      if (i !== b && k) { fan = '<div class="fan">'; for (let j = 0; j < k; j++) fan += `<div class="bk" style="transform:rotate(${(j - (k - 1) / 2) * 7}deg)">${backFace()}</div>`; fan += '</div>'; }
      h += `<div class="seat ${turn.has(i) && pb.phase !== 'end' ? 'turn' : ''}" style="left:${x}%;top:${y}%;--pc:${PCOL[i % 9]}">${fan}
        <div class="plate" style="position:relative">${pb.leader === i && pb.phase === 'play' ? '<span class="leadtag">ENTAME</span>' : ''}
          <div class="medal">${esc((p.name.trim()[0] || '?').toUpperCase())}</div>
          <div class="pi"><div class="nm">${esc(p.name)}${i === this.mySeat && p.name !== 'Vous' ? ' <span class="you">vous</span>' : ''}</div><div class="sub"><b>${p.score}</b> pts<span class="bt">${p.bot ? ' · bot' : ''}</span></div></div>
          <div class="coin ${bid.wait ? 'wait' : ''}" title="Pari">${bid.txt}</div></div>
        <div class="pips">${this.pips(i)}</div></div>`;
    });
    const t = pb.trick;
    if (t) {
      const tk = pb.trickNo * 100 + pb.round;
      if (tk !== this.seenTrick) { this.seenTrick = tk; this.seenEntries = 0; }
      const by: Record<number, { e: any; idx: number }[]> = {};
      t.entries.forEach((e, idx) => { (by[e.p] = by[e.p] || []).push({ e, idx }); });
      for (const i in by) {
        const [x, y] = this.seatPos(+i, n, mob ? 18 : 21, mob ? 17 : 19);
        h += `<div class="slot" style="left:${x}%;top:${y}%">` + by[i].map(({ e, idx }) => {
          let cls = 'sm' + (idx >= this.seenEntries ? ' fresh' : '');
          if (t.res) { if (t.res.winner === idx) cls += ' win'; if (t.res.removed?.includes(idx) || t.res.discarded) cls += ' gone'; }
          else if (t.removals?.includes(idx)) cls += ' gone';
          return cardHTML(e.card, e, cls);
        }).join('') + '</div>';
      }
      this.seenEntries = t.entries.length;
    }
    let mid = '';
    if (this.banner) { mid = `<div class="banner ${this.bannerShown !== this.banner ? 'fresh' : ''}">${esc(this.banner)}</div>`; this.bannerShown = this.banner; }
    else if (pb.phase === 'play' && t) {
      const ls = leadSuitOf(t.entries);
      mid = `<div class="rd">Pli ${pb.trickNo}</div>` + (ls ? `<span class="chip s-${ls}"><i></i>${SUIT[ls].n}<span class="long"> demandé</span></span>` : (t.entries.length ? '<span class="chip none"><span class="long">Aucune couleur demandée</span><span class="short">Sans couleur</span></span>' : ''));
    } else if (pb.round) mid = `<div class="rd">Manche ${pb.round}</div>`;
    h += `<div class="center">${mid}</div>`;
    $('#layer', this.root).innerHTML = h;
  }
  private myTurnToPlay() {
    const pb = this.pub!; return this.live && !this.busy && this.mySeat != null && pb.phase === 'play' && !pb.pending && pb.current === this.mySeat;
  }
  private renderHand() {
    const el = $('#hand', this.root);
    if (this.mySeat == null || !this.priv) { $('#handTitle', this.root).innerHTML = '<b>Spectateur</b>'; $('#handMeta', this.root).innerHTML = ''; el.innerHTML = '<span class="hidden-hand">Vous regardez la partie.</span>'; return; }
    const pv = this.priv, pb = this.pub!;
    const played = new Set((pb.trick?.entries || []).filter(e => e.p === this.mySeat).map(e => e.card.id));
    const hand = this.live ? pv.hand : pv.hand.filter(c => !played.has(c.id));
    $('#handTitle', this.root).innerHTML = '<b>Votre main</b>';
    const tags: string[] = []; const bid = this.bidOf(this.mySeat); if (!bid.wait) tags.push(`Pari ${bid.txt}`); tags.push(`Plis ${pb.players[this.mySeat].won}`);
    if (pb.players[this.mySeat].rascal) tags.push(`Mise ${pb.players[this.mySeat].rascal}`);
    $('#handMeta', this.root).innerHTML = tags.map(x => `<span>${x}</span>`).join('');
    const playing = this.myTurnToPlay() && !this.choice; const legal = new Set(pv.legal);
    const len = hand.length, m = (len - 1) / 2, step = Math.min(3.2, 26 / Math.max(len, 1));
    el.innerHTML = hand.map((c, j) => {
      let cls = '', at = '';
      if (playing) { if (legal.has(c.id)) { cls = 'playable'; at = 'tabindex="0" role="button"'; } else cls = 'dim'; }
      if (this.pick) { cls = 'playable' + (this.pick.sel.has(c.id) ? ' sel' : ''); at = 'tabindex="0" role="button"'; }
      if (this.choice?.id === c.id) cls += ' sel';
      if (pv.forced === c.id) cls += ' forced';
      const d = j - m; at += ` style="--r:${(d * step).toFixed(2)}deg;--y:${(d * d * .55).toFixed(1)}px;z-index:${j + 1}"`;
      return cardHTML(c, null, cls, at);
    }).join('') || '<span class="hidden-hand">Plus de cartes en main.</span>';
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
    const el = $('#log', this.root);
    el.innerHTML = this.logLines.slice(-150).map(l => `<div class="${l.cls || ''}">${l.s.map(seg => typeof seg === 'string' ? esc(seg) : lc(seg.c, seg.e)).join('')}</div>`).join('');
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
      this.setAction(pv.forced != null ? `${PIRATES.mary.n} vous impose cette carte` : (pb.trick && pb.trick.stage === 'volley' ? 'Dernière Bordée : jouez votre carte supplémentaire' : 'À vous de jouer'));
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
    if (k === 'as') this.setAction('Morgane la Louve : la jouer comme…', [{ label: 'Pirate', on: () => done('as', 'pirate') }, { label: 'Fuite', on: () => done('as', 'escape') }, cancel]);
    if (k === 'val') this.setAction('0/14 : quelle valeur ?', [{ label: '0', on: () => done('val', 0) }, { label: '14', on: () => done('val', 14) }, cancel]);
    if (k === 'ws') this.setAction('Le Grand Quinze : de quelle couleur est-il ?<small>Il fixe la couleur demandée du pli.</small>', [...WILD_SUITS.map(s => ({ label: SUIT[s].n, on: () => done('ws', s) })), cancel]);
  }
  private async send(move: Action) {
    if (this.busy) return; this.busy = true; this.renderAction(); this.renderHand();
    try { await this.backend.send(move); }
    catch (e: any) { toast(e.message || 'Action refusée.', 'err'); }
    finally { this.busy = false; this.render(); }
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

