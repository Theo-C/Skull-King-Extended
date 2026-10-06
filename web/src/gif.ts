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
}

export class GifCtl {
  private until = 0; private tick: any = null;
  private pick: HTMLElement | null = null; private anchor: HTMLElement | null = null;
  private shown = new Map<number, HTMLElement>();
  private onDoc = (ev: Event) => { const t = ev.target as Node; if (this.pick && !this.pick.contains(t) && !(t as HTMLElement).closest?.('[data-gifbtn]')) this.close(); };
  private onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && this.pick) { ev.preventDefault(); this.close(); } };
  constructor(private root: HTMLElement, private host: GifHost) {
    root.querySelectorAll<HTMLButtonElement>('[data-gifbtn]').forEach(b => { b.hidden = false; b.onclick = () => this.pick ? this.close() : this.open(b); });
    document.addEventListener('pointerdown', this.onDoc, true); document.addEventListener('keydown', this.onKey);
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
    try { await this.host.send(g.id, g); pushRecent(g); }
    catch (e: any) {
      const m = /encore (\d+) s/.exec(e?.message || ''); this.cooldown(m ? Number(m[1]) : 0);
      this.root.dispatchEvent(new CustomEvent('giferror', { detail: e?.message || "Le GIF n'est pas parti." }));
    }
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
