// GIF en partie (A10, docs/gif/SPEC.md, maquette GifPartie) : sélecteur KLIPY, envoi par le serveur, affichage pour tous
// « comme une émote Twitch » au centre du tapis (rebond, montée qui ralentit, balancement tiré au hasard).
// Le serveur choisit l'URL (le site n'envoie qu'un identifiant) ; à la réception, on n'accepte que les médias KLIPY.
// Le réglage système « réduire les animations » est ignoré comme partout (choix produit) : « Masquer les GIF » le remplace.
import { esc } from './util';

export interface GifItem { id: string; preview: string; full: string; w: number; h: number }
export interface GifMsg { type?: string; userId: string; seat: number; gifUrl: string; w?: number; h?: number; at?: number }

/* ---------- Réglages (ce navigateur) ---------- */
const K_OFF = 'pli.gif.off', K_MUTED = 'pli.gif.muted', K_RECENT = 'pli.gif.recent';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } };
export const gifsHidden = () => read(K_OFF) === '1';
export function setGifsHidden(v: boolean) { write(K_OFF, v ? '1' : '0'); }
const muted = (): string[] => { try { return JSON.parse(read(K_MUTED) || '[]'); } catch { return []; } };
export const isGifMuted = (uid: string) => muted().includes(uid);
/** « Masquer les GIF de ce joueur » (aperçu au survol) : bascule, renvoie le nouvel état. */
export function toggleGifMute(uid: string): boolean {
  const m = muted(), on = !m.includes(uid);
  write(K_MUTED, JSON.stringify(on ? [...m, uid] : m.filter(x => x !== uid))); return on;
}
const recents = (): GifItem[] => { try { return JSON.parse(read(K_RECENT) || '[]'); } catch { return []; } };
function pushRecent(g: GifItem) { write(K_RECENT, JSON.stringify([g, ...recents().filter(x => x.id !== g.id)].slice(0, 12))); }

/** Média KLIPY uniquement (un autre navigateur pourrait diffuser n'importe quelle adresse sur le canal). */
export function gifUrlOk(u: unknown): u is string {
  try { const x = new URL(String(u)); return x.protocol === 'https:' && (x.hostname === 'klipy.com' || x.hostname.endsWith('.klipy.com')); } catch { return false; }
}
const isVideo = (u: string) => /\.mp4(\?|$)/i.test(u);
const media = (u: string, cls = '') => isVideo(u)
  ? `<video class="${cls}" src="${esc(u)}" muted autoplay loop playsinline preload="auto" aria-hidden="true"></video>`
  : `<img class="${cls}" src="${esc(u)}" alt="" decoding="async">`;

const CATS: [string, string][] = [['tendances', 'Tendances'], ['bravo', 'Bravo'], ['rire', 'Rire'], ['rage', 'Rage'], ['pirate', 'Pirate'], ['recents', 'Récents']];
export const GIF_COOLDOWN_S = 10;

export interface GifHost {
  /** Élément du tapis (le GIF surgit en son centre). */
  board(): HTMLElement | null;
  search(q: string, cat: string, cursor: string | null): Promise<{ items: GifItem[]; next: string | null }>;
  /** Envoi : en ligne, le serveur diffuse le GIF (seul l'identifiant compte) ; à l'entraînement, il s'affiche sur place. */
  send(id: string, item: GifItem): Promise<void>;
  /** Nom, couleur et côté de la table d'un siège (décalage de ~90 px vers l'envoyeur quand plusieurs GIF s'affichent). */
  seat(seat: number): { name: string; color: string; dx: number; dy: number } | null;
  /** Utilisateur assis à ce siège (contrôle de l'expéditeur). */
  uidOf(seat: number): string | null;
  mob(): boolean;
  /** Réaction texte écrite dans le champ du panneau (vrai si elle est partie). */
  sendText(text: string): boolean;
}
/** Catégories du panneau Réactions en mode GIF (Récents par défaut). */
const PANEL_CATS: [string, string][] = [['recents', 'Récents'], ['tendances', 'Tendances'], ['bravo', 'Bravo'], ['rire', 'Rire'], ['rage', 'Rage'], ['pirate', 'Pirate']];
const SEND_ICO = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6"/></svg>';
/** Panneau Réactions (docs/gif/SPEC.md, « Le panneau Réactions ») : 4 réactions rapides et un seul champ pour écrire une
 *  réaction ou chercher un GIF (bouton GIF dans le champ, flèche d'envoi, suggestions dès 2 lettres, raccourci « /gif »). */
export const reactPanelHTML = (max: number) => `<section class="panel reactp" data-gifpanel>
  <div class="rp-text"><h3>Réactions <small>touches 1 à 4</small></h3><div class="emotes" data-reacts></div><div class="rp-sugg" hidden></div></div>
  <div class="rp-gif" hidden><div class="rp-gh"><button type="button" class="rp-back">← Réactions</button><b>GIF</b><span>via KLIPY</span></div>
    <div class="rp-cats">${PANEL_CATS.map(([k, l]) => `<button type="button" class="rp-chip" data-pcat="${k}">${l}</button>`).join('')}</div>
    <div class="rp-gridw"><div class="rp-grid" aria-live="polite"></div><div class="rp-cool" hidden></div></div></div>
  <div class="rp-field"><label class="sr" for="rq">Écrire une réaction ou chercher un GIF</label><input id="rq" maxlength="${max}" placeholder="Écrire une réaction ou /gif…" autocomplete="off">
    <button type="button" class="rp-gifb" aria-pressed="false" aria-label="Chercher un GIF">GIF</button><button type="button" class="rp-send" aria-label="Envoyer le message" aria-disabled="true">${SEND_ICO}</button></div>
  <div class="rp-help"></div></section>`;

export class GifCtl {
  private until = 0; private tick: any = null;
  private pick: HTMLElement | null = null; private anchor: HTMLElement | null = null;
  private shown = new Map<number, HTMLElement>();
  private onDoc = (ev: Event) => { const t = ev.target as Node; if (this.pick && !this.pick.contains(t) && !(t as HTMLElement).closest?.('[data-gifbtn]')) this.close(); };
  private onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && this.pick) { ev.preventDefault(); this.close(); } };
  constructor(private root: HTMLElement, private host: GifHost) {
    root.querySelectorAll<HTMLButtonElement>('[data-gifbtn]').forEach(b => { b.hidden = false; b.onclick = () => this.pick ? this.close() : this.open(b); });
    document.addEventListener('pointerdown', this.onDoc, true); document.addEventListener('keydown', this.onKey);
    this.panel = root.querySelector('[data-gifpanel]'); if (this.panel) this.wirePanel();
    this.refresh();
  }
  destroy() { this.close(); clearInterval(this.tick); document.removeEventListener('pointerdown', this.onDoc, true); document.removeEventListener('keydown', this.onKey); this.shown.forEach(e => e.remove()); }

  /** Bouton : désactivé pendant le délai de 10 s entre deux GIF (compte à rebours à côté) ; permis aussi pendant son tour. */
  refresh() {
    const left = Math.max(0, Math.ceil((this.until - Date.now()) / 1000));
    this.root.querySelectorAll<HTMLButtonElement>('[data-gifbtn]').forEach(b => {
      b.disabled = left > 0;
      b.title = left ? `Prochain GIF dans ${left} s` : 'Envoyer un GIF à la table';
    });
    this.root.querySelectorAll<HTMLElement>('.gifcool').forEach(s => s.textContent = left ? `Prochain GIF dans ${left} s` : '');
    this.paintPanel(left);
    if (!left && this.tick) { clearInterval(this.tick); this.tick = null; }
  }
  private cooldown(s: number) { this.until = Date.now() + s * 1000; clearInterval(this.tick); this.tick = setInterval(() => this.refresh(), 1000); this.refresh(); }

  /* ---------- Sélecteur ---------- */
  private open(btn: HTMLElement) {
    if (btn.hasAttribute('disabled')) return;
    this.close(); this.anchor = btn;
    const el = document.createElement('div'); el.className = 'gifpick' + (this.host.mob() ? ' sheet' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Choisir un GIF');
    el.innerHTML = `<div class="gp-top"><label class="sr" for="gifq">Rechercher un GIF</label><input id="gifq" placeholder="Rechercher un GIF… (pirate, bravo, rage)" autocomplete="off" maxlength="50"><button type="button" class="gp-close">Fermer</button></div>
      <div class="gp-cats">${CATS.map(([k, l]) => `<button type="button" class="gp-chip${k === 'tendances' ? ' on' : ''}" data-cat="${k}">${l}</button>`).join('')}</div>
      <div class="gp-grid" aria-live="polite"></div>
      <div class="gp-foot"><span>Cliquez un GIF pour l'envoyer à la table</span><span>GIF fournis par KLIPY</span></div>`;
    document.body.append(el); this.pick = el;
    btn.setAttribute('aria-expanded', 'true');
    if (!this.host.mob()) { const r = btn.getBoundingClientRect(), w = Math.min(520, innerWidth - 24); el.style.width = w + 'px'; el.style.left = Math.max(12, Math.min(r.left, innerWidth - w - 12)) + 'px'; el.style.bottom = (innerHeight - r.top + 8) + 'px'; }
    const q = el.querySelector('#gifq') as HTMLInputElement, grid = el.querySelector('.gp-grid') as HTMLElement;
    let cat = 'tendances', seq = 0, next: string | null = null, timer: any = null;
    const load = async (more = false) => {
      const my = ++seq, term = q.value.trim();
      if (!more) { grid.innerHTML = '<p class="gp-msg">Chargement…</p>'; next = null; }
      if (!term && cat === 'recents') { const r = recents(); paint(r, false); if (!r.length) grid.innerHTML = '<p class="gp-msg">Vos 12 derniers GIF envoyés apparaîtront ici.</p>'; return; }
      try {
        const res = await this.host.search(term, cat === 'recents' ? 'tendances' : cat, more ? next : null);
        if (my !== seq) return; next = res.next; paint(res.items, more);
        if (!res.items.length && !more) grid.innerHTML = `<p class="gp-msg">Aucun GIF pour « ${esc(term)} ».</p>`;
      } catch (e: any) { if (my === seq) grid.innerHTML = `<p class="gp-msg">${esc(e?.message || 'GIF indisponibles pour le moment.')}</p>`; }
    };
    const paint = (items: GifItem[], more: boolean) => {
      grid.querySelector('.gp-more')?.remove(); if (!more) grid.innerHTML = '';
      grid.insertAdjacentHTML('beforeend', items.map((g, i) => `<button type="button" class="gp-tile" data-i="${i}" aria-label="Envoyer ce GIF">${media(g.preview)}</button>`).join(''));
      const tiles = [...grid.querySelectorAll<HTMLButtonElement>('.gp-tile')].slice(-items.length);
      tiles.forEach((t, i) => t.onclick = () => this.choose(items[i]));
      if (next && cat !== 'recents') { const b = document.createElement('button'); b.type = 'button'; b.className = 'gp-close gp-more'; b.textContent = 'Plus de GIF'; b.onclick = () => load(true); grid.append(b); }
    };
    q.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { el.querySelectorAll('.gp-chip').forEach(c => c.classList.toggle('on', !q.value.trim() && (c as HTMLElement).dataset.cat === cat)); load(); }, 300); };
    el.querySelectorAll<HTMLButtonElement>('.gp-chip').forEach(c => c.onclick = () => { cat = c.dataset.cat!; q.value = ''; el.querySelectorAll('.gp-chip').forEach(x => x.classList.toggle('on', x === c)); load(); });
    (el.querySelector('.gp-close') as HTMLButtonElement).onclick = () => this.close();
    load(); q.focus();
  }
  private close() { this.pick?.remove(); this.pick = null; this.anchor?.setAttribute('aria-expanded', 'false'); this.anchor = null; }
  private async choose(g: GifItem) {
    if (Date.now() < this.until) return;
    this.close(); this.cooldown(GIF_COOLDOWN_S);
    if (this.mode === 'gif') this.setMode('text', ''); else this.hideSugg();
    try { await this.host.send(g.id, g); pushRecent(g); }
    catch (e: any) {
      const m = /encore (\d+) s/.exec(e?.message || ''); this.cooldown(m ? Number(m[1]) : 0);
      this.root.dispatchEvent(new CustomEvent('giferror', { detail: e?.message || "Le GIF n'est pas parti." }));
    }
  }

  /* ---------- Panneau Réactions : un seul champ pour écrire ou chercher un GIF ---------- */
  private panel: HTMLElement | null = null; private mode: 'text' | 'gif' = 'text'; private pcat = 'recents';
  private gridItems: GifItem[] = []; private pseq = 0; private ptimer: any = null;
  private q = <T extends HTMLElement>(sel: string) => this.panel!.querySelector(sel) as T;
  private wirePanel() {
    const input = this.q<HTMLInputElement>('#rq');
    input.oninput = () => {
      const v = input.value;
      // « /gif » suivi d'un espace : on passe en recherche de GIF avec la suite
      if (this.mode === 'text' && /^\/gif\s/i.test(v)) { this.setMode('gif', v.replace(/^\/gif\s*/i, '')); return; }
      clearTimeout(this.ptimer); this.ptimer = setTimeout(() => this.mode === 'gif' ? this.loadGrid() : this.suggest(), 300);
      this.paintPanel();
    };
    input.onkeydown = ev => {
      if (ev.key === 'Escape' && this.mode === 'gif') { ev.preventDefault(); ev.stopPropagation(); this.setMode('text', ''); }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (this.mode === 'gif') { if (this.gridItems[0]) this.choose(this.gridItems[0]); } else this.sendTextNow(); }
    };
    this.q<HTMLButtonElement>('.rp-gifb').onclick = () => this.setMode(this.mode === 'gif' ? 'text' : 'gif', this.mode === 'gif' ? '' : input.value.replace(/^\/gif\s*/i, ''));
    this.q<HTMLButtonElement>('.rp-send').onclick = () => this.sendTextNow();
    this.q<HTMLButtonElement>('.rp-back').onclick = () => this.setMode('text', '');
    this.panel!.querySelectorAll<HTMLButtonElement>('[data-pcat]').forEach(b => b.onclick = () => { this.pcat = b.dataset.pcat!; input.value = ''; this.loadGrid(); input.focus(); });
    this.paintPanel();
  }
  /** Mode texte ou mode GIF (le panneau grandit vers le haut, par-dessus le journal). */
  private setMode(m: 'text' | 'gif', value: string) {
    const input = this.q<HTMLInputElement>('#rq');
    this.mode = m; input.value = value; this.panel!.classList.toggle('gifmode', m === 'gif');
    this.q<HTMLElement>('.rp-text').hidden = m === 'gif'; this.q<HTMLElement>('.rp-gif').hidden = m !== 'gif';
    input.placeholder = m === 'gif' ? 'Chercher un GIF…' : 'Écrire une réaction ou /gif…';
    this.hideSugg(); if (m === 'gif') this.loadGrid();
    this.paintPanel(); input.focus();
  }
  private sendTextNow() {
    const input = this.q<HTMLInputElement>('#rq'), t = input.value.trim(); if (!t || this.mode !== 'text') return;
    if (this.host.sendText(t)) { input.value = ''; this.hideSugg(); this.paintPanel(); }
  }
  private hideSugg() { const s = this.panel?.querySelector('.rp-sugg') as HTMLElement | null; if (s) { s.hidden = true; s.innerHTML = ''; } }
  /** Suggestions en tapant : dès 2 lettres, 3 GIF au-dessus du champ ; un clic envoie le GIF, Entrée envoie toujours le texte. */
  private async suggest() {
    const input = this.q<HTMLInputElement>('#rq'), term = input.value.trim(), box = this.q<HTMLElement>('.rp-sugg');
    if (term.length < 2 || term.startsWith('/') || Date.now() < this.until) { this.hideSugg(); return; }
    const my = ++this.pseq;
    try {
      const items = (await this.host.search(term, 'tendances', null)).items.slice(0, 3);
      if (my !== this.pseq || this.mode !== 'text' || input.value.trim() !== term) return;
      if (!items.length) { this.hideSugg(); return; }
      box.innerHTML = `<div class="rp-sh"><span>GIF pour « ${esc(term)} »</span><span>clic = envoyer</span></div><div class="rp-minis">${items.map((g, i) => `<button type="button" class="rp-mini" data-i="${i}" aria-label="Envoyer ce GIF">${media(g.preview)}</button>`).join('')}</div>`;
      box.querySelectorAll<HTMLButtonElement>('.rp-mini').forEach(b => b.onclick = () => this.choose(items[Number(b.dataset.i)]));
      box.hidden = false;
    } catch { this.hideSugg(); }
  }
  /** Grille du mode GIF : Récents (sur cet appareil), une catégorie, ou la recherche tapée dans le champ. */
  private async loadGrid() {
    const term = this.q<HTMLInputElement>('#rq').value.trim(), grid = this.q<HTMLElement>('.rp-grid'), my = ++this.pseq;
    this.panel!.querySelectorAll<HTMLElement>('[data-pcat]').forEach(c => c.classList.toggle('on', !term && c.dataset.pcat === this.pcat));
    let items: GifItem[];
    if (!term && this.pcat === 'recents') {
      items = recents();
      if (!items.length) { this.gridItems = []; grid.innerHTML = '<p class="rp-msg">Vos derniers GIF envoyés apparaîtront ici. Essayez Tendances.</p>'; return; }
    } else {
      grid.innerHTML = '<p class="rp-msg">Chargement…</p>';
      try { items = (await this.host.search(term, this.pcat === 'recents' ? 'tendances' : this.pcat, null)).items; }
      catch (e: any) { if (my === this.pseq) grid.innerHTML = `<p class="rp-msg">${esc(e?.message || 'GIF indisponibles pour le moment.')}</p>`; return; }
      if (my !== this.pseq) return;
    }
    this.gridItems = items;
    grid.innerHTML = items.length ? items.map((g, i) => `<button type="button" class="rp-tile" data-i="${i}" aria-label="Envoyer ce GIF">${media(g.preview)}</button>`).join('') : `<p class="rp-msg">Aucun GIF pour « ${esc(term)} ».</p>`;
    grid.querySelectorAll<HTMLButtonElement>('.rp-tile').forEach(b => b.onclick = () => this.choose(items[Number(b.dataset.i)]));
    this.paintPanel();
  }
  /** Bouton GIF (plein en mode GIF, décompte après un envoi), flèche grisée si le champ est vide, ligne d'aide, attente. */
  private paintPanel(left = Math.max(0, Math.ceil((this.until - Date.now()) / 1000))) {
    if (!this.panel) return;
    const input = this.q<HTMLInputElement>('#rq'), gb = this.q<HTMLButtonElement>('.rp-gifb'), send = this.q<HTMLButtonElement>('.rp-send'), gif = this.mode === 'gif';
    this.q<HTMLElement>('.rp-field').classList.toggle('gif', gif);
    gb.classList.toggle('on', gif); gb.classList.toggle('cool', !gif && left > 0); gb.setAttribute('aria-pressed', String(gif));
    gb.textContent = !gif && left ? left + ' s' : 'GIF'; gb.setAttribute('aria-label', gif ? 'Fermer les GIF' : left ? `Prochain GIF dans ${left} s` : 'Chercher un GIF');
    send.hidden = gif; send.setAttribute('aria-disabled', String(!input.value.trim()));
    this.q<HTMLElement>('.rp-help').textContent = gif ? 'Entrée envoie le premier GIF · Échap pour revenir' : left ? `GIF de nouveau possible dans ${left} s` : 'Entrée pour envoyer · « /gif bravo » pour chercher';
    const cool = this.q<HTMLElement>('.rp-cool'); cool.hidden = !left; cool.textContent = left ? `Prochain GIF dans ${left} s` : '';
    this.panel.querySelectorAll<HTMLButtonElement>('.rp-tile, .rp-mini').forEach(b => b.setAttribute('aria-disabled', String(left > 0)));
  }

  /* ---------- Affichage pour tous ---------- */
  /** Message « gif » reçu du canal de la partie. */
  receive(m: GifMsg) {
    if (!m || !gifUrlOk(m.gifUrl) || !Number.isInteger(m.seat)) return;
    const uid = this.host.uidOf(m.seat); if (!uid || uid !== m.userId) return; // l'expéditeur doit être assis à ce siège
    if (gifsHidden() || isGifMuted(uid)) return;
    const who = this.host.seat(m.seat), board = this.host.board(); if (!who || !board) return;
    // préchargement : on n'affiche le GIF qu'une fois le média prêt (3 s au plus)
    const tmp = document.createElement('div'); tmp.innerHTML = media(m.gifUrl, 'gf-m');
    const el = tmp.firstElementChild as HTMLVideoElement | HTMLImageElement;
    let done = false; const go = () => { if (!done) { done = true; this.float(m.seat, el, who, board); } };
    if (el instanceof HTMLVideoElement) { el.addEventListener('canplay', go, { once: true }); el.load(); } else { el.addEventListener('load', go, { once: true }); }
    el.addEventListener('error', () => { done = true; }, { once: true });
    setTimeout(go, 3000);
  }
  private float(seat: number, mediaEl: HTMLElement, who: { name: string; color: string; dx: number; dy: number }, board: HTMLElement) {
    // un seul GIF à l'écran par joueur : le nouveau remplace l'ancien ; les suivants se décalent vers leur envoyeur
    this.shown.get(seat)?.remove(); this.shown.delete(seat);
    const others = [...this.shown.values()].filter(e => e.isConnected).length;
    let layer = board.querySelector(':scope>.gifs') as HTMLElement | null;
    if (!layer) { layer = document.createElement('div'); layer.className = 'gifs'; layer.setAttribute('aria-hidden', 'true'); board.append(layer); }
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    const f = document.createElement('div'); f.className = 'gf';
    f.style.setProperty('--x', `${Math.round((others ? who.dx : 0) + r(-50, 50))}px`); f.style.setProperty('--y', `${others ? who.dy : 0}px`);
    const sway = document.createElement('div'); sway.className = 'gf-sway';
    sway.style.setProperty('--sw', `${Math.round(r(10, 22))}px`); sway.style.setProperty('--rot', `${r(3, 8).toFixed(1)}deg`);
    sway.style.animationDuration = `${r(.8, 1.3).toFixed(2)}s`; sway.style.animationDelay = `${(-r(0, 1)).toFixed(2)}s`;
    sway.append(mediaEl);
    sway.insertAdjacentHTML('beforeend', `<div class="gf-who"><span style="background:${esc(who.color)}">${esc((who.name[0] || '?').toUpperCase())}</span>${esc(who.name)}</div>`);
    f.append(sway); layer.append(f); this.shown.set(seat, f);
    // vidéo préchargée hors de la page : la lecture automatique ne repart pas toute seule une fois ajoutée
    if (mediaEl instanceof HTMLVideoElement) { mediaEl.muted = true; mediaEl.loop = true; mediaEl.playsInline = true; mediaEl.play().catch(() => { /* image figée en repli */ }); }
    setTimeout(() => { f.remove(); if (this.shown.get(seat) === f) this.shown.delete(seat); }, 3300);
  }
}
