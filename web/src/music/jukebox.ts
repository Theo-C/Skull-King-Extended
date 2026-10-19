// Juke-box partagé (A19, docs/jukebox/SPEC.md, maquette Jukebox) : file commune de liens YouTube / SoundCloud pendant la
// partie, lue en même temps chez tous les joueurs avec les lecteurs officiels. Le serveur ne connaît que la file, le morceau
// en cours et son heure de départ : chaque joueur calcule la position attendue (heure du serveur) et se recale au-delà de 1,5 s.
// Interface : onglet « Réactions · Juke-box » de la colonne de droite, sous les réactions (l'onglet Partie garde le classement,
// la mise et le journal) ; feuille depuis le bas sur téléphone, lecteur compact au-dessus
// de la table, annonce de 3 s à chaque ajout. Musique pour moi, volume (pdp.music.vol, pdp.music.muted, sur cet appareil) et
// interrupteur de l'hôte : dans les réglages du son de la table (barre du haut, menu du téléphone), voir soundExtra().
import { MUSIC, expectedPosition, needsResync, clockOffset, fmtDuration, type MusicStateRow, type Provider } from '@shared/music.ts';
import { youtubePlayer, soundcloudPlayer, type MusicPlayer } from './players';
import { esc } from '../util';
import type { SoundExtra } from '../table';

export interface QueueItem { id: string; added_by: string; provider: Provider; media_id: string; title: string; thumb_url: string | null; duration_s: number; position: number; created_at?: string }
export interface JukeboxBackend {
  uid: string;
  /** Hôte de la partie : passer sans vote, retirer tous les morceaux, couper le juke-box. */
  host: boolean;
  /** Votes nécessaires pour passer : moitié des joueurs humains assis (même calcul que le serveur). */
  need: number;
  /** File et état du juke-box de la partie (lecture Supabase, RLS). */
  fetch(): Promise<{ state: MusicStateRow | null; queue: QueueItem[] }>;
  /** Action music.* de la fonction « game » (identifiant de la partie ajouté). */
  call<T = any>(action: string, payload?: Record<string, unknown>): Promise<T>;
  /** Heure du serveur (ms), pour estimer le décalage de l'horloge. */
  serverNow(): Promise<number>;
  /** Nom et couleur d'un joueur. */
  who(uid: string): { name: string; color: string };
  /** Onglet de la colonne de droite qui accueille le juke-box (TableView.socialSide). */
  side: { slot: HTMLElement; show(): void; count(n: number): void };
}

/* ---------- Réglages personnels (cet appareil) ---------- */
const K_VOL = 'pdp.music.vol', K_MUTED = 'pdp.music.muted';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } };
const savedVol = () => { const v = Number(read(K_VOL)); return read(K_VOL) != null && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 60; };

/** Identifiants acceptés pour les lecteurs (le serveur les a vérifiés ; double contrôle avant de les passer à un lecteur). */
const mediaOk = (it: QueueItem) => it.provider === 'youtube' ? /^[\w-]{11}$/.test(it.media_id) : /^https:\/\/api\.soundcloud\.com\/tracks\/\d+(\?secret_token=s-[\w]+)?$/.test(it.media_id);

const ICO = {
  note: (s: number, w = 1.8) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  on: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
  off: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m23 9-6 6M17 9l6 6"/></svg>',
  skip: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 4 10 8-10 8V4zM19 5v14"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  play: '<svg viewBox="0 0 10 10" width="7" height="7" aria-hidden="true"><path d="M3 2l5 3-5 3z" fill="#fff"/></svg>',
};
const EQ = '<span class="jb-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';

export class Jukebox {
  private state: MusicStateRow | null = null;
  private queue: QueueItem[] = [];
  private loadedOnce = false;
  private offset = 0;
  private players: Partial<Record<Provider, MusicPlayer>> = {};
  private active: MusicPlayer | null = null;
  private loaded: string | null = null; private loadedAt = 0;
  private asked = new Set<string>(); private reported = new Set<string>();
  private failedHere: string | null = null;
  private vol = savedVol(); private muted = read(K_MUTED) === '1';
  private live = true; private stopped = false;
  private ticker: any = null; private poll: any = null; private ticks = 0;
  private err = '';
  private busy = false;
  /** Dernier déblocage par un geste : le même toucher n'ouvre pas aussi le juke-box. */
  private wokeAt = 0;
  private els!: { panel: HTMLElement; pill: HTMLElement; toast: HTMLElement; sheet: HTMLElement };
  private mq = matchMedia('(max-width:719px)');
  private refreshing = false; private again = false;

  constructor(private root: HTMLElement, private be: JukeboxBackend) {
    this.mount();
    this.mq.addEventListener('change', this.place);
    document.addEventListener('visibilitychange', this.onVis);
    addEventListener('pointerdown', this.onGesture, true); addEventListener('keydown', this.onGesture, true);
    this.start();
  }

  /** Partie terminée (ou de nouveau en cours) : la musique s'arrête quand la partie finit. */
  setLive(v: boolean) { if (this.live === v) return; this.live = v; this.apply(); this.render(); }
  destroy() {
    this.stopped = true; clearInterval(this.ticker); clearInterval(this.poll);
    this.mq.removeEventListener('change', this.place); document.removeEventListener('visibilitychange', this.onVis);
    removeEventListener('pointerdown', this.onGesture, true); removeEventListener('keydown', this.onGesture, true);
    Object.values(this.players).forEach(p => p?.destroy()); this.players = {}; this.active = null;
    this.els.sheet.remove(); this.els.pill.remove(); this.els.toast.remove(); this.els.panel.remove(); this.be.side.count(0);
  }

  /* ---------- Données ---------- */
  private async start() {
    // décalage de l'horloge : 3 allers-retours, on garde le plus court
    const samples: { t0: number; t1: number; server: number }[] = [];
    for (let i = 0; i < 3 && !this.stopped; i++) {
      try { const t0 = Date.now(), server = await this.be.serverNow(), t1 = Date.now(); samples.push({ t0, t1, server }); } catch { /* serveur injoignable : horloge locale */ }
    }
    this.offset = clockOffset(samples);
    if (this.stopped) return;
    await this.refresh();
    if (this.stopped) return;
    this.ticker = setInterval(() => this.tick(), 1000);
    this.poll = setInterval(() => this.refresh(), 15000); // filet si le temps réel décroche
  }
  private now = () => Date.now() + this.offset;
  /** Relit la file et l'état (signal du temps réel, action d'un joueur). */
  async refresh() {
    if (this.stopped) return; if (this.refreshing) { this.again = true; return; } this.refreshing = true;
    try {
      do {
        this.again = false;
        let d: { state: MusicStateRow | null; queue: QueueItem[] };
        try { d = await this.be.fetch(); } catch { return; }
        this.announce(this.state, this.queue, d.state, d.queue);
        this.state = d.state; this.queue = d.queue; this.loadedOnce = true;
        this.apply(); this.render();
      } while (this.again && !this.stopped);
    } finally { this.refreshing = false; }
  }
  private current(): QueueItem | null { const id = this.state?.current_id; return id ? this.queue.find(q => q.id === id) ?? null : null; }
  private waiting() { const id = this.state?.current_id; return this.queue.filter(q => q.id !== id); }
  private position(it: QueueItem) { return this.state ? expectedPosition(this.state, this.now(), it.duration_s) : 0; }
  private on() { return this.live && !!this.state?.enabled; }

  /** Annonces : ajout (3 s), morceau passé avant la fin, juke-box coupé ou rallumé. */
  private announce(ps: MusicStateRow | null, pq: QueueItem[], ns: MusicStateRow | null, nq: QueueItem[]) {
    if (!this.loadedOnce) return;
    for (const it of nq) if (!pq.some(x => x.id === it.id)) {
      this.say(it.added_by === this.be.uid ? `Vous avez ajouté « ${it.title} »` : `${this.be.who(it.added_by).name} a ajouté « ${it.title} »`); return;
    }
    if (ps && ns && ps.enabled !== ns.enabled) { this.say(ns.enabled ? 'Juke-box réactivé par l’hôte' : 'Juke-box coupé par l’hôte'); return; }
    const was = ps?.current_id ? pq.find(x => x.id === ps.current_id) : null;
    if (ps && was && ns?.current_id !== was.id && expectedPosition(ps, this.now(), was.duration_s) < was.duration_s - 3) {
      this.say((ps.reports?.length ?? 0) > 0 ? 'Morceau illisible, passé' : 'Morceau passé');
    }
  }

  /* ---------- Lecture ---------- */
  private player(p: Provider) {
    let pl = this.players[p];
    if (!pl) {
      pl = this.players[p] = p === 'youtube' ? youtubePlayer() : soundcloudPlayer();
      pl.onEnded = () => { const c = this.current(); if (c && this.loaded === c.id) this.askNext(c); };
      pl.onError = () => this.failed();
    }
    return pl;
  }
  private apply() {
    const cur = this.current();
    if (!this.on() || !cur || !mediaOk(cur)) { this.active?.stop(); this.active = null; this.loaded = null; return; }
    const pos = this.position(cur);
    if (pos >= cur.duration_s - .5) { this.askNext(cur); if (this.loaded === cur.id) { this.active?.stop(); this.loaded = null; } return; }
    const pl = this.player(cur.provider);
    if (this.active && this.active !== pl) this.active.stop();
    this.active = pl; pl.setVolume(this.vol); pl.mute(this.muted);
    if (this.loaded !== cur.id) { this.loaded = cur.id; this.loadedAt = Date.now(); this.failedHere = null; pl.load(cur.media_id, pos); return; }
    this.resync();
  }
  /** Recalage : au-delà de 1,5 s d'écart avec la position attendue. */
  private resync() {
    const cur = this.current(), pl = this.active; if (!cur || !pl || this.loaded !== cur.id) return;
    const t = pl.time(), pos = this.position(cur);
    if (pl.playing() && t != null && needsResync(t, pos)) pl.seek(pos);
  }
  /** Le lecteur ne démarre pas (pas encore de geste du joueur, ou lecture bloquée par le navigateur). */
  private blocked() { return !!this.loaded && !!this.active && !this.active.playing() && Date.now() - this.loadedAt > 2500 && this.failedHere !== this.loaded; }
  private unblock() {
    const cur = this.current(), pl = this.active; if (!cur || !pl) return;
    pl.play(); pl.seek(this.position(cur)); this.loadedAt = this.wokeAt = Date.now();
    setTimeout(() => this.render(), 800);
  }
  /** Fin constatée ici : le serveur passe au suivant (une seule fois, quel que soit le nombre de joueurs qui l'appellent). */
  private askNext(it: QueueItem) {
    if (this.asked.has(it.id)) return; this.asked.add(it.id);
    setTimeout(() => {
      this.be.call<{ result: string }>('music.next', { item: it.id })
        .then(r => { if (r?.result === 'early' || r?.result === 'off') setTimeout(() => this.asked.delete(it.id), 3000); this.refresh(); })
        .catch(() => setTimeout(() => this.asked.delete(it.id), 5000));
    }, Math.random() * 600);
  }
  /** Morceau illisible ici (erreurs 101 / 150 de YouTube, erreur du lecteur SoundCloud) : signalé une fois au serveur. */
  private failed() {
    const cur = this.current(); if (!cur || this.loaded !== cur.id) return;
    this.failedHere = cur.id; this.render();
    if (this.reported.has(cur.id)) return; this.reported.add(cur.id);
    this.be.call('music.report', { item: cur.id }).then(() => this.refresh(), () => { /* réessayé au prochain morceau */ });
  }
  private tick() {
    if (this.stopped) return;
    const cur = this.current();
    if (cur && this.on()) {
      if (this.position(cur) >= cur.duration_s - .5) this.apply();
      else if (++this.ticks % Math.round(MUSIC.checkMs / 1000) === 0) this.resync();
    }
    this.paintProgress(); this.paintPill();
  }
  private onVis = () => { if (!document.hidden) { this.refresh(); this.resync(); } };
  private onGesture = () => { if (this.blocked()) this.unblock(); };

  /* ---------- Actions ---------- */
  private async act(action: string, payload: Record<string, unknown>, onErr?: (m: string) => void) {
    try { await this.be.call(action, payload); await this.refresh(); return true; }
    catch (e: any) { if (onErr) onErr(e?.message || 'Action impossible.'); else this.say(e?.message || 'Action impossible.'); return false; }
  }
  private async add() {
    const inp = this.els.panel.querySelector<HTMLInputElement>('#jbUrl')!, url = inp.value.trim();
    if (!url || this.busy) return;
    if (this.waiting().filter(q => q.added_by === this.be.uid).length >= MUSIC.perUser) { this.setErr('Vous avez déjà 3 morceaux en attente. Attendez qu’un des vôtres passe.'); return; }
    this.busy = true; this.paintAdd();
    const done = await this.act('music.add', { url }, m => this.setErr(m));
    this.busy = false;
    if (done) { inp.value = ''; this.setErr(''); } else this.paintAdd();
  }
  private setErr(m: string) { this.err = m; this.paintAdd(); }
  private setMuted(m: boolean) { this.muted = m; write(K_MUTED, m ? '1' : '0'); this.active?.mute(m); this.render(); }
  private setVol(v: number) { this.vol = v; write(K_VOL, String(v)); this.active?.setVolume(v); if (v > 0 && this.muted) this.setMuted(false); else if (v === 0 && !this.muted) this.setMuted(true); else this.paintSound(); }
  private say(t: string) {
    const el = this.els.toast; el.textContent = t; el.hidden = false; el.classList.remove('jb-in'); void el.offsetWidth; el.classList.add('jb-in');
    clearTimeout((el as any)._t); (el as any)._t = setTimeout(() => { el.hidden = true; }, 3200);
  }

  /* ---------- Interface ---------- */
  private mount() {
    const r = this.root;
    const panel = document.createElement('section'); panel.className = 'jb-panel'; panel.setAttribute('aria-label', 'Juke-box');
    panel.innerHTML = `
      <div class="jb-card jb-now" data-now></div>
      <div class="jb-card jb-add"><div class="jb-hr"><span class="jb-h">Ajouter un morceau</span><span class="jb-quota" data-quota></span></div>
        <div class="jb-field" data-field><label for="jbUrl" class="sr">Lien YouTube ou SoundCloud</label>
          <input id="jbUrl" type="url" placeholder="Coller un lien YouTube ou SoundCloud" autocomplete="off" enterkeyhint="send">
          <button type="button" class="jb-btn gold" data-add>Ajouter</button></div>
        <div class="jb-msg" data-msg aria-live="polite"></div></div>
      <div class="jb-card jb-queue"><div class="jb-hr"><span class="jb-h">À suivre</span><span class="jb-sub" data-wait></span></div><div class="jb-list" data-list></div></div>
      <p class="jb-hint">Musique pour vous, volume et interrupteur du juke-box : réglages du son, en haut de la table.</p>`;
    const pill = document.createElement('div'); pill.className = 'jb-pill';
    const toast = document.createElement('div'); toast.className = 'jb-toast'; toast.hidden = true; toast.setAttribute('role', 'status');
    const sheet = document.createElement('div'); sheet.className = 'jb-sheet'; sheet.hidden = true;
    sheet.innerHTML = `<div class="jb-scrim" data-close></div><div class="jb-sheetbox" role="dialog" aria-modal="true" aria-label="Juke-box"><div class="jb-sheethead"><b>${ICO.note(16, 2)} Juke-box</b><button type="button" class="jb-x" data-close aria-label="Fermer">${ICO.x}</button></div><div data-slot></div></div>`;
    const stage = r.querySelector<HTMLElement>('.tstage') ?? r;
    stage.prepend(pill); stage.append(toast); document.body.append(sheet);
    this.els = { panel, pill, toast, sheet };
    this.place();

    sheet.addEventListener('click', ev => { if ((ev.target as HTMLElement).closest('[data-close]')) this.openSheet(false); });
    sheet.addEventListener('keydown', ev => { if (ev.key === 'Escape') this.openSheet(false); });
    pill.onclick = ev => {
      if ((ev.target as HTMLElement).closest('[data-pmute]')) { this.setMuted(!this.muted); return; }
      if (this.blocked()) { this.unblock(); return; }
      if (Date.now() - this.wokeAt < 700) return;
      if (this.mq.matches) this.openSheet(true); else this.be.side.show();
    };
    const inp = panel.querySelector<HTMLInputElement>('#jbUrl')!;
    inp.addEventListener('input', () => { if (this.err) this.setErr(''); else this.paintAdd(); });
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); this.add(); } ev.stopPropagation(); });
    panel.addEventListener('click', ev => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return;
      const cur = this.current();
      if (b.hasAttribute('data-add')) this.add();
      else if (b.hasAttribute('data-vote') && cur) this.act('music.vote', { item: cur.id });
      else if (b.hasAttribute('data-hskip') && cur) this.act('music.skip', { item: cur.id });
      else if (b.dataset.rm) { b.setAttribute('disabled', ''); this.act('music.remove', { item: b.dataset.rm }); }
    });
    this.render();
  }
  /** Ordinateur : panneau dans la colonne de droite ; téléphone : dans la feuille qui monte depuis le bas. */
  private place = () => {
    const { panel, sheet } = this.els;
    if (this.mq.matches) sheet.querySelector('[data-slot]')!.append(panel);
    else { this.be.side.slot.append(panel); this.openSheet(false); }
  };
  private openSheet(open: boolean) {
    const s = this.els.sheet; if (s.hidden === !open) return;
    s.hidden = !open; if (open) { this.render(); s.querySelector<HTMLElement>('.jb-x')?.focus(); }
  }

  private render() { this.paintNow(); this.paintAdd(); this.paintQueue(); this.paintSound(); this.paintPill(); this.paintCount(); }
  private avatar(uid: string, size = 18) { const w = this.be.who(uid); return `<span class="jb-av" style="background:${esc(w.color)};width:${size}px;height:${size}px">${esc((w.name || '?').slice(0, 1).toUpperCase())}</span>`; }
  private byName(uid: string) { return uid === this.be.uid ? 'vous' : this.be.who(uid).name; }
  private thumb(it: QueueItem, size: number) {
    const img = it.thumb_url && /^https:\/\//.test(it.thumb_url) ? `<img src="${esc(it.thumb_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ICO.note(size > 40 ? 28 : 16);
    return `<span class="jb-thumb ${it.provider}" style="width:${size}px;height:${size}px">${img}${size > 40 ? `<span class="jb-src">${ICO.play}</span>` : ''}</span>`;
  }
  private paintNow() {
    const el = this.els.panel.querySelector<HTMLElement>('[data-now]')!, cur = this.current(), st = this.state;
    if (!cur) { el.innerHTML = `<div class="jb-live off">${EQ}Juke-box</div><p class="jb-empty">${!this.live ? 'La partie est terminée.' : st && !st.enabled ? 'Juke-box coupé par l’hôte.' : 'Rien ne joue pour l’instant. Collez un lien YouTube ou SoundCloud : la musique démarrera pour toute la table.'}</p>`; return; }
    const votes = st?.skip_votes ?? [], voted = votes.includes(this.be.uid);
    el.innerHTML = `<div class="jb-live">${this.on() ? '<span class="jb-dot"></span>En cours pour toute la table' : 'En pause · juke-box coupé par l’hôte'}<span class="jb-time" data-time></span></div>
      <div class="jb-nowrow">${this.thumb(cur, 64)}<div class="jb-meta"><div class="jb-title" title="${esc(cur.title)}">${esc(cur.title)}</div>
        <div class="jb-by">${this.avatar(cur.added_by)}ajouté par ${esc(this.byName(cur.added_by))}</div></div></div>
      <div class="jb-bar"><i data-bar></i></div>
      ${this.failedHere === cur.id ? '<p class="jb-note">Ce morceau ne peut pas être lu sur votre appareil : il a été signalé.</p>' : ''}
      <div class="jb-acts"><button type="button" class="jb-btn${voted ? ' on' : ''}" data-vote aria-pressed="${voted}" title="Le morceau est passé quand la moitié de la table le demande">${ICO.skip}Passer ${votes.length}/${this.be.need}</button>
        ${this.be.host ? '<button type="button" class="jb-btn" data-hskip title="Réservé à l’hôte de la partie">Passer (hôte)</button>' : ''}</div>`;
    this.paintProgress();
  }
  private paintProgress() {
    const cur = this.current(); if (!cur) return;
    const pos = this.position(cur), p = this.els.panel;
    const t = p.querySelector<HTMLElement>('[data-time]'); if (t) t.textContent = `${fmtDuration(pos)} / ${fmtDuration(cur.duration_s)}`;
    const b = p.querySelector<HTMLElement>('[data-bar]'); if (b) b.style.width = Math.min(100, pos / cur.duration_s * 100).toFixed(1) + '%';
  }
  private paintAdd() {
    const p = this.els.panel, mine = this.waiting().filter(q => q.added_by === this.be.uid).length, full = mine >= MUSIC.perUser;
    const inp = p.querySelector<HTMLInputElement>('#jbUrl')!, off = !this.on();
    const q = p.querySelector<HTMLElement>('[data-quota]')!; q.textContent = `${mine}/${MUSIC.perUser} en attente`; q.classList.toggle('full', full);
    p.querySelector('[data-field]')!.classList.toggle('err', !!this.err);
    inp.disabled = off;
    const btn = p.querySelector<HTMLButtonElement>('[data-add]')!; btn.setAttribute('aria-disabled', String(!inp.value.trim() || full || off || this.busy)); btn.textContent = this.busy ? '…' : 'Ajouter';
    const m = p.querySelector<HTMLElement>('[data-msg]')!; m.classList.toggle('bad', !!this.err);
    m.textContent = this.err || (off && this.live ? 'Le juke-box est coupé par l’hôte : la file est gardée, l’ajout reprendra avec lui.' : '10 min max par morceau · Spotify et Deezer non pris en charge');
  }
  private paintQueue() {
    const p = this.els.panel, w = this.waiting(), cur = this.current();
    const total = w.reduce((a, x) => a + x.duration_s, 0) + (cur ? Math.max(0, cur.duration_s - this.position(cur)) : 0);
    p.querySelector<HTMLElement>('[data-wait]')!.textContent = w.length ? `${w.length} morceau${w.length > 1 ? 'x' : ''} · ${Math.max(1, Math.round(total / 60))} min` : '';
    p.querySelector<HTMLElement>('[data-list]')!.innerHTML = w.map((it, i) => {
      const own = it.added_by === this.be.uid, can = own || this.be.host;
      return `<div class="jb-row"><span class="jb-i">${i + 1}</span>${this.thumb(it, 36)}<div class="jb-meta"><div class="jb-t" title="${esc(it.title)}">${esc(it.title)}</div>
        <div class="jb-by">${this.avatar(it.added_by, 15)}${esc(this.byName(it.added_by))} · ${fmtDuration(it.duration_s)}</div></div>
        ${can ? `<button type="button" class="jb-x" data-rm="${esc(it.id)}" aria-label="Retirer ${esc(it.title)}" title="${own ? 'Retirer mon morceau' : 'Retirer (hôte)'}">${ICO.x}</button>` : ''}</div>`;
    }).join('') || `<p class="jb-empty">${cur ? 'La file est vide. Le juke-box s’arrêtera après ce morceau.' : 'La file est vide.'}</p>`;
  }
  /** Section « Juke-box » du panneau Son de la table : musique pour moi, volume, et interrupteur de la partie pour l'hôte. */
  soundExtra(): SoundExtra {
    return {
      html: () => `<div class="sndh">${ICO.note(14, 2.2)}Juke-box</div>
        <div class="sndrow"><b>Musique</b><button type="button" class="sndsw" role="switch" data-jbs="music" aria-label="Musique du juke-box, pour moi"></button></div>
        <div class="volrow"><input type="range" data-jbs="vol" min="0" max="100" step="5" value="${this.vol}" aria-label="Volume de la musique, pour moi"><output data-jbs="out"></output></div>
        <p class="sndfine">Pour vous seul : les autres joueurs ne sont pas concernés.</p>
        ${this.be.host ? `<div class="sndrow"><b>Juke-box de la partie</b><button type="button" class="sndsw" role="switch" data-jbs="room" aria-label="Juke-box de la partie (hôte)"></button></div>
        <p class="sndfine">Hôte : coupé, la file est gardée et rien ne joue pour personne.</p>` : ''}`,
      wire: el => {
        this.soundEl = el; this.paintSound();
        el.querySelector<HTMLButtonElement>('[data-jbs="music"]')!.onclick = () => this.setMuted(!this.muted);
        el.querySelector<HTMLInputElement>('[data-jbs="vol"]')!.oninput = ev => this.setVol(Number((ev.target as HTMLInputElement).value));
        const room = el.querySelector<HTMLButtonElement>('[data-jbs="room"]');
        if (room) room.onclick = () => { room.disabled = true; this.act('music.toggle', { on: !this.state?.enabled }).finally(() => { room.disabled = false; this.paintSound(); }); };
      },
    };
  }
  private soundEl: HTMLElement | null = null;
  private paintSound() {
    const el = this.soundEl; if (!el?.isConnected) return;
    const sw = (k: string, on: boolean) => { const b = el.querySelector<HTMLElement>(`[data-jbs="${k}"]`); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); } };
    sw('music', !this.muted); sw('room', !!this.state?.enabled);
    const r = el.querySelector<HTMLInputElement>('[data-jbs="vol"]')!; if (document.activeElement !== r) r.value = String(this.vol);
    el.querySelector<HTMLElement>('[data-jbs="out"]')!.textContent = this.muted ? 'coupé' : this.vol + ' %';
    el.classList.toggle('mmuted', this.muted);
  }
  private paintPill() {
    const el = this.els.pill, cur = this.current(), playing = !!cur && this.on() && !!this.active?.playing() && !this.muted;
    let title: string, by = '', cls = '';
    if (!this.live) { title = 'Juke-box · partie terminée'; cls = ' idle'; }
    else if (this.state && !this.state.enabled) { title = 'Juke-box coupé par l’hôte'; cls = ' idle'; }
    else if (!cur) { title = 'Juke-box · collez un lien'; cls = ' idle'; }
    else if (this.blocked()) { title = 'Cliquez pour écouter'; by = `· ${cur.title}`; cls = ' wake'; }
    else { title = cur.title; by = '· ' + (cur.added_by === this.be.uid ? 'vous' : this.be.who(cur.added_by).name); }
    const key = [title, by, cls, playing, this.muted].join('|'); if ((el as any)._k === key) return; (el as any)._k = key;
    el.className = 'jb-pill' + cls;
    el.innerHTML = `<button type="button" class="jb-pmain" aria-label="${esc(cls === ' wake' ? 'Cliquez pour écouter la musique de la table' : 'Ouvrir le juke-box')}">${EQ.replace('jb-eq', 'jb-eq' + (playing ? '' : ' off'))}<span class="jb-pt">${esc(title)}</span>${by ? `<span class="jb-pb">${esc(by)}</span>` : ''}</button>
      <button type="button" class="jb-x gold" data-pmute aria-label="${this.muted ? 'Réactiver la musique pour moi' : 'Couper la musique pour moi'}" title="${this.muted ? 'Réactiver la musique pour moi' : 'Couper la musique pour moi'}">${this.muted ? ICO.off : ICO.on}</button>`;
  }
  private paintCount() { this.be.side.count(this.waiting().length); }
}
