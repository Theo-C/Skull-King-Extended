// Profil (#/profil) : identité + XP, éditeur d'image (pirate illustré, photo recadrée, initiale), garde-robe, statistiques,
// Élo, titres, hauts faits, réglages du compte. Maquette Profil.
import { sb, callGame } from '../api';
import { $, esc, toast } from '../util';
import { myProfile, forgetProfile, shell, applyPrefs, chestBadge, type Profile } from '../account';
import { avatarHTML, avatarSVG, CATALOG, PALETTE, ART_NAMES, withItem, type AvatarData, type Look, type CosmeticItem } from '../avatar';
import { xpLine, LEVEL_TITLES, xpToReach, fmt } from '../xp';
import { getAmbiance, setAmbiance } from '../ambiance';
import { openChestOverlay, type ChestResult } from '../chest';
import { ART } from '../cards';
import { ANIM_MODES, KEY_OF_FILE, animAllowed, attachAnim, detachAnim, getAnimMode, setAnimMode, type AnimMode } from '../animatedCards';

const COLOR_NAMES = ['Or', 'Corail', 'Algue', 'Lagon', 'Améthyste', 'Ambre', 'Écume', 'Corail rose'];
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z"/></svg>';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const nth = (r: number) => r === 1 ? '1er' : r + 'e';

export async function profilePage(root: HTMLElement, uid: string, email: string) {
  root.innerHTML = '<section class="apage"><p class="empty">Chargement du profil…</p></section>';
  const p = await myProfile(uid, true);
  if (!p) { root.innerHTML = '<section class="apage"><div class="apanel"><h2>Profil introuvable</h2></div></section>'; return; }
  const [stats, mine, all, created, elo, friends, global, ward] = await Promise.all([
    sb.from('player_stats').select('*').eq('user_id', uid).maybeSingle().then(r => r.data),
    sb.from('user_achievements').select('code, unlocked_at').eq('user_id', uid).then(r => r.data || []),
    sb.from('achievements').select('code, name, description, sort').order('sort').then(r => r.data || []),
    sb.from('profiles').select('created_at').eq('id', uid).maybeSingle().then(r => r.data?.created_at as string | undefined),
    sb.from('game_results').select('elo_before, elo_after, elo_delta, finished_at').eq('user_id', uid).not('elo_delta', 'is', null).order('finished_at', { ascending: false }).limit(15).then(r => (r.data || []).reverse()),
    sb.rpc('leaderboard_period', { scope: 'friends', period: 'ever' }).then(r => r.data || []),
    sb.rpc('leaderboard_period', { scope: 'all', period: 'ever' }).then(r => r.data || []),
    callGame('profile.wardrobe', {}).catch(() => ({ owned: [], coins: 0, chests: 0, shop: [] as { cosmetic_id: string; price: number }[] })),
  ]);
  const st: any = stats || { games: 0, wins: 0, bids_made: 0, bids_total: 0, best_score: null, sirens_captured: 0, elo: 100, elo_best: 100 };
  const x = xpLine(p.xp), next = LEVEL_TITLES.find(([l]) => l > x.level);
  // variation arrondie : entre −0,5 et +0,5, on n'affiche ni ▲ ni ▼
  const eloNow = Math.round(Number(st.elo)), lastDelta = elo.length ? Math.round(Number(elo[elo.length - 1].elo_delta)) : 0;
  const arrow = (d: number) => `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}`;
  const fr = (friends as any[]).find(r => r.user_id === uid), gl = (global as any[]).find(r => r.user_id === uid);
  const since = created ? new Date(created).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';
  const got = new Set((mine as any[]).map(a => a.code));

  root.innerHTML = `<section class="apage profile">
    <section class="phero">
      <div class="pav"><span id="heroAv"></span><button class="abtn gold round" id="bEdit" aria-label="Modifier la photo de profil" aria-controls="editor" aria-expanded="false">${PENCIL}</button></div>
      <div class="pid">
        <div class="pline"><h1 id="heroName">${esc(p.pseudo)}</h1><span class="chip1">${esc(x.title)} · niveau ${x.level}</span>
          <span class="chip2">Élo ${eloNow}${lastDelta ? ` <span class="${lastDelta > 0 ? 'up' : 'down'}">${arrow(lastDelta)}</span>` : ''}</span></div>
        <div class="psub">${since ? `Membre depuis ${esc(since)} · ` : ''}${st.games} partie${st.games > 1 ? 's' : ''} jouée${st.games > 1 ? 's' : ''}</div>
        <div class="pxp"><div class="xpbar"><span style="width:${x.pct}%"></span></div><b>${x.text} XP</b></div>
        ${next ? `<div class="pnext">Encore ${fmt(xpToReach(next[0]) - p.xp)} XP pour devenir <b>${esc(next[1])}</b> (niveau ${next[0]})</div>` : ''}
      </div>
    </section>
    <section class="apanel editor" id="editor" hidden tabindex="-1" aria-label="Modifier l'image de profil"></section>
    <section class="apanel wardrobe" id="wardrobe" aria-label="Garde-robe"></section>
    <div class="tiles">
      ${tile(String(st.games), `partie${st.games > 1 ? 's' : ''} jouée${st.games > 1 ? 's' : ''}`)}
      ${tile(String(st.wins), `victoire${st.wins > 1 ? 's' : ''}${st.games ? ` · ${Math.round(100 * st.wins / st.games)} %` : ''}`)}
      ${tile(st.bids_total ? Math.round(100 * st.bids_made / st.bids_total) + ' %' : '—', 'mises tenues')}
      ${tile(st.best_score != null ? String(st.best_score) : '—', 'record de points')}
      ${tile(String(eloNow), `Élo · record ${Math.round(Number(st.elo_best))}`)}
      ${tile(String(st.sirens_captured), `sirène${st.sirens_captured > 1 ? 's' : ''} capturée${st.sirens_captured > 1 ? 's' : ''}`)}
    </div>
    <div class="agrid">
      <section class="apanel span-all">
        <div class="hrow"><h2>Élo</h2><span>tout le monde part de 100 · minimum 0</span></div>
        <div class="elobox">
          <div class="eloval"><span class="big">${eloNow}</span>
            ${!elo.length ? '<span class="lbl">pas encore de partie classée</span>' : lastDelta ? `<span class="${lastDelta > 0 ? 'pos' : 'neg'}">${arrow(lastDelta)} à la dernière partie</span>` : '<span>= 0 à la dernière partie</span>'}
            <span class="lbl">record ${Math.round(Number(st.elo_best))}${fr ? ` · ${nth(fr.rank)} entre amis` : ''}${gl ? ` · #${fmt(gl.rank)} sur ${fmt((global as any[]).length)}` : ''}</span></div>
          ${eloChart(elo as any[])}
        </div>
        <p class="note">L'Élo mesure votre niveau, l'XP mesure votre assiduité. À chaque partie, vous êtes comparé à chaque adversaire : finir devant un joueur mieux classé rapporte beaucoup, finir derrière un joueur moins bien classé coûte cher. Les 10 premières parties classées comptent double, pour trouver vite votre niveau.</p>
      </section>
      <section class="apanel">
        <div class="hrow"><h2>Progression</h2><span>${fmt(p.xp)} XP au total</span></div>
        <div class="ranks">${LEVEL_TITLES.map(([lv, name], i) => {
          const nextLv = LEVEL_TITLES[i + 1]?.[0] ?? 999, cur = x.level >= lv && x.level < nextLv, past = x.level >= nextLv;
          return `<div class="rk ${cur ? 'cur' : past ? 'past' : ''}"><span class="lv">${lv}</span><span class="nm">${esc(name)}${cur ? ' · vous' : ''}</span><span class="lbl">${fmt(xpToReach(lv))} XP</span></div>`;
        }).join('')}</div>
        <p class="note"><b>Gagner de l'XP</b> · +50 par partie terminée · +10 par mise tenue · +100 pour une victoire · +25 par haut fait débloqué. Les parties d'entraînement ne comptent pas.</p>
      </section>
      <section class="apanel">
        <div class="hrow"><h2>Hauts faits</h2><span>${got.size} sur ${(all as any[]).length}</span></div>
        <div class="achs">${(all as any[]).map(a => `<div class="ach ${got.has(a.code) ? '' : 'off'}"><span class="amedal">${STAR}</span><span><b>${esc(a.name)}</b><span class="lbl">${esc(a.description)}</span><span class="sr">${got.has(a.code) ? 'obtenu' : 'à débloquer'}</span></span></div>`).join('')}</div>
      </section>
    </div>
    <section class="apanel account">
      <h2>Compte</h2>
      <div class="fields">
        <div class="field"><label for="pseudo">Pseudo affiché</label><input id="pseudo" class="inp" value="${esc(p.pseudo)}" maxlength="20" minlength="2"></div>
        <div class="field"><label for="mail">Adresse e-mail (connexion par lien magique)</label><input id="mail" class="inp" value="${esc(email)}" readonly></div>
      </div>
      <div class="prefs">
        ${pref('notify_turn', "Me prévenir quand c'est mon tour", "notification du navigateur ou de l'appli", p.notify_turn)}
        ${pref('sounds', 'Sons de la table', 'cartes, plis gagnés, fin de manche', p.sounds)}
        ${pref('ambiance', 'Ambiance pirate à la table', 'cabine, lanterne et carte marine ; sinon ambiance sobre (aussi réglable pendant la partie)', getAmbiance() !== 'sobre')}
        <div class="prow"><span><b>Cartes animées</b><span class="lbl">cartes Mythiques, les vôtres et celles des autres joueurs (aussi réglable pendant la partie)</span></span><select id="pAnim" class="inp" style="width:auto" aria-label="Cartes animées">${ANIM_MODES.map(([v, l]) => `<option value="${v}"${getAnimMode() === v ? ' selected' : ''}>${l.charAt(0).toUpperCase() + l.slice(1)}</option>`).join('')}</select></div>
        ${pref('public_rank', 'Apparaître dans le classement public', 'sinon, visible seulement par vos amis', p.public_rank)}
      </div>
      <div class="acc-foot"><button class="abtn gold" id="bPseudo">Enregistrer le pseudo</button><button class="abtn ghost" id="bOut">Se déconnecter</button></div>
    </section>
  </section>`;

  const paintHero = (pp: Profile) => { $('#heroAv', root).innerHTML = avatarHTML(av(pp), 120, `0 0 0 3px #1b140e,0 0 0 6px ${pp.color}`); $('#heroName', root).textContent = pp.pseudo; };
  paintHero(p);
  const achNames = new Map((all as any[]).map(a => [a.code as string, a.name as string]));
  openWardrobe(root, uid, p, ward as any, achNames, (saved) => { Object.assign(p, saved); paintHero(p); forgetProfile(); });
  $('#bEdit', root).onclick = () => openEditor(root, uid, p, saved => { Object.assign(p, saved); paintHero(p); forgetProfile(); shell({ id: uid }, 'profile'); });
  $('#bPseudo', root).onclick = async () => {
    const v = ($('#pseudo', root) as HTMLInputElement).value.trim();
    const b = $('#bPseudo', root) as HTMLButtonElement; b.disabled = true;
    try { await callGame('profile.update', { pseudo: v }); p.pseudo = v; paintHero(p); forgetProfile(); shell({ id: uid }, 'profile'); toast('Pseudo enregistré.'); }
    catch (e: any) { toast(e.message, 'err'); } finally { b.disabled = false; }
  };
  // cartes animées : réglage de ce navigateur (localStorage pli.cartesAnimees), comme l'ambiance
  ($('#pAnim', root) as HTMLSelectElement).onchange = ev => setAnimMode((ev.target as HTMLSelectElement).value as AnimMode);
  root.querySelectorAll<HTMLButtonElement>('.tg').forEach(t => t.onclick = async () => {
    const k = t.dataset.k as 'notify_turn' | 'sounds' | 'public_rank' | 'ambiance', on = t.getAttribute('aria-checked') !== 'true';
    const set = (v: boolean) => { t.setAttribute('aria-checked', String(v)); t.classList.toggle('on', v); };
    // ambiance : réglage de ce navigateur (localStorage pli.ambiance), pas du compte
    if (k === 'ambiance') { setAmbiance(on ? 'pirate' : 'sobre'); set(on); return; }
    if (k === 'notify_turn' && on && 'Notification' in window) {
      if (Notification.permission === 'default') await Notification.requestPermission().catch(() => { });
      if (Notification.permission === 'denied') { set(false); toast('Notifications bloquées par le navigateur : autorisez-les dans les réglages du site.', 'err'); return; }
    }
    set(on); t.disabled = true;
    try { await callGame('profile.update', { [k]: on }); (p as any)[k] = on; applyPrefs(p); forgetProfile(); }
    catch (e: any) { set(!on); toast(e.message, 'err'); } finally { t.disabled = false; }
  });
  // déconnexion : on vide le cache et on laisse l'événement SIGNED_OUT (main.ts) afficher la connexion, une seule fois
  $('#bOut', root).onclick = async () => {
    forgetProfile(); history.replaceState(null, '', location.pathname + location.search + '#/connexion');
    const { error } = await sb.auth.signOut();
    if (error) { history.replaceState(null, '', location.pathname + location.search + '#/profil'); toast('Déconnexion impossible : ' + error.message, 'err'); }
  };
}

const av = (p: Pick<Profile, 'avatar_kind' | 'avatar_art' | 'avatar_url' | 'pseudo' | 'color'> & { look?: Look | null }): AvatarData => ({ kind: p.avatar_kind, art: p.avatar_art, url: p.avatar_url, look: p.look ?? null, letter: p.pseudo, color: p.color });
const tile = (v: string, l: string) => `<div class="tile"><span class="big">${esc(v)}</span><span class="lbl">${esc(l)}</span></div>`;
const pref = (k: string, t: string, d: string, on: boolean) => `<div class="prow"><span><b>${esc(t)}</b><span class="lbl">${esc(d)}</span></span><button class="tg ${on ? 'on' : ''}" data-k="${k}" role="switch" aria-checked="${on}" aria-label="${esc(t)}"></button></div>`;

/** Courbe de l'Élo sur les dernières parties classées (SVG, ligne des 100 en pointillés).
 *  Point de départ : l'Élo avant la plus ancienne partie affichée (100 seulement pour un débutant). */
function eloChart(rows: { elo_before: number | null; elo_after: number; elo_delta: number }[]) {
  if (!rows.length) return '<div class="echart empty">La courbe apparaîtra après votre première partie classée.</div>';
  const r0 = rows[0], start = r0.elo_before != null ? Number(r0.elo_before) : Number(r0.elo_after) - Number(r0.elo_delta);
  const E = [start, ...rows.map(r => Number(r.elo_after))], lo = Math.min(80, ...E) - 5, hi = Math.max(110, ...E) + 10;
  const X = (i: number) => 30 + i * 600 / Math.max(1, E.length - 1), Y = (v: number) => 140 - (v - lo) * 130 / (hi - lo);
  const pts = E.map((v, i) => `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`);
  const n = rows.length, span = n > 1 ? `les ${n} dernières parties classées` : 'la dernière partie classée';
  return `<svg class="echart" viewBox="0 0 640 150" role="img" aria-label="Évolution de l'Élo sur ${span}, de ${Math.round(E[0])} à ${Math.round(E[E.length - 1])}">
    <line x1="30" x2="630" y1="${Y(100).toFixed(1)}" y2="${Y(100).toFixed(1)}" stroke="rgba(234,208,138,.3)" stroke-dasharray="4 6"/>
    <text x="24" y="${(Y(100) + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="#a8987f">100</text>
    <path d="M${pts.join(' L')} L${X(E.length - 1).toFixed(1)} 150 L30 150 Z" fill="rgba(201,161,74,.14)"/>
    <path d="M${pts.join(' L')}" fill="none" stroke="#ead08a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${E.map((v, i) => i ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4" fill="${v < E[i - 1] ? '#f0a08b' : '#9bd69f'}" stroke="#1f1813" stroke-width="1.5"><title>Partie ${i} : ${Math.round(v)}</title></circle>` : '').join('')}
  </svg>`;
}

/** Flèches, Début et Fin dans un groupe à focus itinérant (onglets, boutons radio) : choisit l'élément et lui donne le focus. */
function roving(group: HTMLElement, sel: string, pick: (el: HTMLElement) => void) {
  group.addEventListener('keydown', ev => {
    const items = [...group.querySelectorAll<HTMLElement>(sel)], i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[ev.key];
    if (j == null) return;
    ev.preventDefault(); const el = items[(j + items.length) % items.length]; pick(el); el.focus();
  });
}

/* ---------- Éditeur d'image de profil ---------- */
function openEditor(root: HTMLElement, uid: string, p: Profile, onSaved: (s: Partial<Profile>) => void) {
  const box = $('#editor', root), bEdit = $('#bEdit', root); box.hidden = false; bEdit.setAttribute('aria-expanded', 'true');
  const st = { tab: (p.avatar_kind === 'photo' ? 'photo' : p.avatar_kind === 'art' ? 'art' : 'init') as 'art' | 'photo' | 'init', art: p.avatar_art ?? 0, color: p.color, img: null as HTMLImageElement | null, zoom: 1.3, dx: 0, dy: 0, busy: false };
  const TABS: [string, string][] = [['art', 'Pirate illustré'], ['photo', 'Ma photo'], ['init', 'Initiale']];
  box.innerHTML = `<div class="ehead"><h2 id="eTitle">Image de profil</h2>
      <div role="tablist" class="etabs" aria-label="Type d'image">${TABS.map(([k, l]) => `<button role="tab" id="et-${k}" data-t="${k}" aria-controls="ep-${k}">${l}</button>`).join('')}</div></div>
    <div class="ebody">
      <div class="eleft">
        <div data-p="art" id="ep-art" role="tabpanel" aria-labelledby="et-art"><span class="lbl b" id="artLbl">Choisissez votre pirate</span>
          <div class="arts" role="radiogroup" aria-labelledby="artLbl">${ART_NAMES.map((n, i) => `<button class="avb" role="radio" data-a="${i}" aria-label="${esc(n)}"></button>`).join('')}</div></div>
        <div data-p="photo" id="ep-photo" role="tabpanel" aria-labelledby="et-photo">
          <label class="drop" id="drop"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" fill="none" stroke="#ead08a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <b>Déposez une image ou cliquez pour choisir</b><span class="lbl">JPG, PNG ou WebP · 5 Mo max · recadrée en cercle 256 × 256</span>
            <input type="file" id="file" accept="image/jpeg,image/png,image/webp" class="sr"></label>
          <div class="crop" id="cropWrap" hidden><canvas id="crop" width="240" height="240" tabindex="0" aria-label="Recadrage : faites glisser la photo, ou utilisez les flèches du clavier"></canvas></div>
          <div class="zoomrow" id="zoomRow" hidden><span class="lbl b">Zoom</span><input type="range" id="zoom" min="100" max="200" value="130" aria-label="Zoom de la photo"></div>
          <p class="err" id="perr" role="alert" hidden></p>
        </div>
        <div data-p="init" id="ep-init" role="tabpanel" aria-labelledby="et-init"><span class="lbl b">Votre initiale sur fond de couleur</span><p class="note2">C'est l'avatar par défaut à la création du compte. Il prend la première lettre de votre pseudo.</p></div>
        <div class="colors" id="colors"><span class="lbl b" id="swLbl">Couleur du médaillon (sert aussi de couleur à la table)</span>
          <div class="sws" role="radiogroup" aria-labelledby="swLbl">${PALETTE.map((c, i) => `<button class="sw" role="radio" data-c="${c}" style="background:${c}" aria-label="${COLOR_NAMES[i]}"></button>`).join('')}</div></div>
      </div>
      <div class="eprev"><span class="lbl b">Aperçu</span><div class="pv" id="pv"></div><div class="tablepv" id="tpv"></div>
        <div class="ebtns"><button class="abtn ghost" id="eCancel">Annuler</button><button class="abtn gold" id="eSave">Enregistrer</button></div></div>
    </div>`;
  const canvas = $('#crop', box) as HTMLCanvasElement;
  const photoURL = () => { if (!st.img) return p.avatar_kind === 'photo' ? p.avatar_url : null; const c = document.createElement('canvas'); c.width = c.height = 120; draw(c, 120); return c.toDataURL(); };
  /** Dessine la photo recadrée (couverture du carré, zoom, déplacement) dans un canevas de taille s. */
  const draw = (c: HTMLCanvasElement, s: number) => {
    const g = c.getContext('2d')!, img = st.img; g.clearRect(0, 0, s, s); if (!img) return;
    const k = Math.max(s / img.width, s / img.height) * st.zoom, w = img.width * k, h = img.height * k, f = s / 240;
    g.drawImage(img, (s - w) / 2 + st.dx * f, (s - h) / 2 + st.dy * f, w, h);
  };
  const clampPan = () => { if (!st.img) return; const k = Math.max(240 / st.img.width, 240 / st.img.height) * st.zoom, mx = (st.img.width * k - 240) / 2, my = (st.img.height * k - 240) / 2; st.dx = Math.max(-mx, Math.min(mx, st.dx)); st.dy = Math.max(-my, Math.min(my, st.dy)); };
  const current = (): AvatarData => st.tab === 'photo' ? { kind: 'photo', url: photoURL(), letter: p.pseudo, color: st.color } : st.tab === 'art' ? { kind: 'art', art: st.art, letter: p.pseudo, color: st.color } : { kind: 'initial', letter: p.pseudo, color: st.color };
  const radio = (b: HTMLElement, on: boolean) => { b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; };
  const paint = () => {
    box.querySelectorAll<HTMLElement>('[role=tab]').forEach(t => { const on = t.dataset.t === st.tab; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    box.querySelectorAll<HTMLElement>('[data-p]').forEach(d => d.hidden = d.dataset.p !== st.tab);
    $('#colors', box).hidden = st.tab === 'photo';
    box.querySelectorAll<HTMLElement>('.avb').forEach(b => { const i = Number(b.dataset.a); radio(b, i === st.art); b.innerHTML = avatarHTML({ kind: 'art', art: i, color: st.color }, 64); });
    box.querySelectorAll<HTMLElement>('.sw').forEach(b => radio(b, b.dataset.c === st.color));
    $('#cropWrap', box).hidden = $('#zoomRow', box).hidden = !st.img;
    if (st.img) draw(canvas, 240);
    const cur = current(), ring = `0 0 0 3px #1b140e,0 0 0 6px ${st.color}`;
    $('#pv', box).innerHTML = avatarHTML(cur, 104, ring) + avatarHTML(cur, 36);
    // aperçu de la plaque à la table : pseudo réel, sans score inventé
    $('#tpv', box).innerHTML = `${avatarHTML(cur, 40, `0 0 0 2px #1b140e,0 0 0 3px ${st.color}`)}<span><b>${esc(p.pseudo)}</b><span class="lbl">à la table</span></span>`;
  };
  // un seul rendu par image affichée pendant un glisser ou un zoom (toDataURL est coûteux)
  let raf = 0;
  const paintSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
  const err = (m: string | null) => { const e = $('#perr', box); e.hidden = !m; e.textContent = m ?? ''; };
  const load = (f: File | undefined | null) => {
    err(null); if (!f) return;
    if (!TYPES.includes(f.type)) return err('Format refusé : JPG, PNG ou WebP.');
    if (f.size > MAX_BYTES) return err(`Image trop lourde (${(f.size / 1048576).toFixed(1).replace('.', ',')} Mo) : 5 Mo maximum.`);
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); st.img = img; st.zoom = 1.3; st.dx = st.dy = 0; ($('#zoom', box) as HTMLInputElement).value = '130'; paint(); };
    img.onerror = () => { URL.revokeObjectURL(url); err('Impossible de lire cette image. Essayez un autre fichier.'); };
    img.src = url;
  };
  const pickTab = (t: HTMLElement) => { st.tab = t.dataset.t as any; paint(); };
  box.querySelectorAll<HTMLElement>('[role=tab]').forEach(t => t.onclick = () => pickTab(t));
  roving($('.etabs', box), '[role=tab]', pickTab);
  const pickArt = (b: HTMLElement) => { st.art = Number(b.dataset.a); paint(); };
  box.querySelectorAll<HTMLElement>('.avb').forEach(b => b.onclick = () => pickArt(b));
  roving($('.arts', box), '.avb', pickArt);
  const pickColor = (b: HTMLElement) => { st.color = b.dataset.c!; paint(); };
  box.querySelectorAll<HTMLElement>('.sw').forEach(b => b.onclick = () => pickColor(b));
  roving($('.sws', box), '.sw', pickColor);
  ($('#file', box) as HTMLInputElement).onchange = ev => load((ev.target as HTMLInputElement).files?.[0]);
  const drop = $('#drop', box);
  drop.addEventListener('dragover', ev => { ev.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', ev => { ev.preventDefault(); drop.classList.remove('over'); load(ev.dataTransfer?.files?.[0]); });
  ($('#zoom', box) as HTMLInputElement).oninput = ev => { st.zoom = Number((ev.target as HTMLInputElement).value) / 100; clampPan(); paintSoon(); };
  // déplacement de la photo au doigt, à la souris ou aux flèches
  let drag: { x: number; y: number; dx: number; dy: number } | null = null;
  const stop = () => { drag = null; };
  canvas.addEventListener('pointerdown', ev => { drag = { x: ev.clientX, y: ev.clientY, dx: st.dx, dy: st.dy }; canvas.setPointerCapture(ev.pointerId); });
  canvas.addEventListener('pointermove', ev => { if (!drag) return; st.dx = drag.dx + ev.clientX - drag.x; st.dy = drag.dy + ev.clientY - drag.y; clampPan(); paintSoon(); });
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop); canvas.addEventListener('lostpointercapture', stop);
  canvas.addEventListener('keydown', ev => {
    const m = ({ ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] } as Record<string, number[]>)[ev.key];
    if (!m) return; ev.preventDefault(); st.dx += m[0]; st.dy += m[1]; clampPan(); paintSoon();
  });
  const close = () => { cancelAnimationFrame(raf); box.hidden = true; box.innerHTML = ''; bEdit.setAttribute('aria-expanded', 'false'); bEdit.focus(); };
  box.onkeydown = ev => { if (ev.key === 'Escape' && !st.busy) { ev.preventDefault(); close(); } };
  $('#eCancel', box).onclick = close;
  $('#eSave', box).onclick = async () => {
    if (st.busy) return; const b = $('#eSave', box) as HTMLButtonElement; st.busy = true; b.disabled = true; b.textContent = 'Enregistrement…'; err(null);
    try {
      const body: any = { color: st.color, avatar_kind: st.tab === 'init' ? 'initial' : st.tab };
      if (st.tab === 'art') body.avatar_art = st.art;
      let stale: string | null = null;
      if (st.tab === 'photo') {
        if (!st.img && !(p.avatar_kind === 'photo' && p.avatar_url)) throw new Error('Choisissez d\'abord une photo.');
        if (st.img) {
          // recadrage carré 256 × 256 en WebP (JPEG si le navigateur ne sait pas l'encoder), envoyé dans avatars/<uid>/avatar.webp|jpg
          const c = document.createElement('canvas'); c.width = c.height = 256; draw(c, 256);
          const enc = (type: string) => new Promise<Blob | null>(r => c.toBlob(r, type, .9));
          let blob = await enc('image/webp'), ext = 'webp';
          if (blob?.type !== 'image/webp') { blob = await enc('image/jpeg'); ext = 'jpg'; }
          if (!blob) throw new Error('Conversion de l\'image impossible dans ce navigateur.');
          const path = `${uid}/avatar.${ext}`, contentType = ext === 'webp' ? 'image/webp' : 'image/jpeg';
          const { error } = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType, cacheControl: '3600' });
          if (error) throw new Error('Envoi de la photo impossible : ' + error.message);
          body.avatar_url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
          // l'ancienne photo dans l'autre format sera supprimée après l'enregistrement du profil
          const old = /\/avatar\.(webp|jpg)(\?|$)/.exec(p.avatar_url ?? '')?.[1];
          if (old && old !== ext) stale = `${uid}/avatar.${old}`;
        } else body.avatar_url = p.avatar_url;
      }
      await callGame('profile.update', body);
      if (stale) sb.storage.from('avatars').remove([stale]).then(() => { }, () => { });
      onSaved({ color: body.color, avatar_kind: body.avatar_kind, avatar_art: body.avatar_art ?? p.avatar_art, avatar_url: body.avatar_url ?? p.avatar_url });
      st.busy = false; close(); toast('Image de profil enregistrée.');
    } catch (e: any) { err(e.message); toast(e.message, 'err'); b.disabled = false; b.textContent = 'Enregistrer'; st.busy = false; }
  };
  paint(); box.scrollIntoView({ behavior: 'smooth', block: 'start' }); box.focus({ preventScroll: true });
}

/* ---------- Garde-robe ---------- */
const DEFAULT_LOOK: Look = { skin: 1, hair: 'court', hc: 0, beard: 'none', hat: null, face: null, neck: null, pet: null, bg: 'mer', frame: null };
// 4 niveaux de rareté, couleurs alignées sur maquettes/Coffre.dc.html
const RARITY: Record<string, { name: string; color: string }> = {
  c: { name: 'Commun', color: '#d6dde4' },
  r: { name: 'Rare', color: '#4fa8ff' },
  e: { name: 'Épique', color: '#c27dff' },
  l: { name: 'Légendaire', color: '#ffc94a' },
  m: { name: 'Mythique', color: '#c39bff' },
};
const WT: [string, string][] = [['base', 'Visage'], ['hat', 'Chapeaux'], ['face', 'Yeux et visage'], ['neck', 'Cou'], ['pet', 'Compagnons'], ['bg', 'Décor'], ['frame', 'Cadre'], ['carte', 'Cartes']];
const HAIR_OPTS: [string, string][] = [['Court', 'court'], ['Mèche', 'meche'], ['Long', 'long'], ['Bouclé', 'boucles'], ['Chignon', 'chignon'], ['Tresse', 'tresse'], ['Queue', 'queue'], ['Rasé', 'none']];
const BEARD_OPTS: [string, string][] = [['Aucune', 'none'], ['Moustache', 'mous'], ['Barbe courte', 'short'], ['Grande barbe', 'long']];
const SKIN_SW = ['#f3d2b3', '#e6b48f', '#c98e66', '#a56a45', '#7a4a2c', '#5a3420'];
const HAIRC_SW = ['#1d1510', '#4a2c1a', '#8a5a2b', '#c9a14a', '#a33a26', '#d8d2c4'];
const COAT_NAMES = ['Or', 'Corail', 'Algue', 'Lagon', 'Améthyste', 'Ambre', 'Écume', 'Corail rose'];
const LOCK_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const CHEST_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18v9H3zM3 10c0-4 3-6 9-6s9 2 9 6M10 12h4v3h-4z" fill="none" stroke="#2b2117" stroke-width="1.8" stroke-linejoin="round"/></svg>';

interface WardrobeData { owned: string[]; coins: number; chests: number; shop: { cosmetic_id: string; price: number }[] }

function openWardrobe(root: HTMLElement, uid: string, p: Profile, data: WardrobeData, achNames: Map<string, string>, onSaved: (s: Partial<Profile>) => void) {
  const box = $('#wardrobe', root);
  const st = {
    tab: 'base',
    look: { ...DEFAULT_LOOK, ...(p.look || {}) } as Look,
    saved: { ...DEFAULT_LOOK, ...(p.look || {}) } as Look,
    color: p.color, savedColor: p.color,
    owned: new Set<string>(data.owned),
    coins: data.coins, chests: data.chests,
    shop: data.shop,
    busy: false,
  };
  const totalItems = CATALOG.all.length;
  const ownsItem = (it: CosmeticItem) => it.defaultOwned || st.owned.has(it.id);
  const ownsBySlotValue = (slot: string, value: string | null) =>
    CATALOG.all.some(c => c.slot === slot && c.value === value && ownsItem(c));

  const render = () => {
    const ownedCount = CATALOG.all.filter(ownsItem).length;
    const dirty = JSON.stringify(st.look) !== JSON.stringify(st.saved) || st.color !== st.savedColor;
    const ring = `0 0 0 3px #1b140e,0 0 0 6px ${st.color}`;
    const previewAv: AvatarData = { kind: 'art', letter: p.pseudo, color: st.color, look: st.look };
    const tabCount = (slot: string) => CATALOG.bySlot[slot]?.filter(c => !c.defaultOwned && st.owned.has(c.id)).length ?? 0;
    const tabs = WT.map(([k, lbl]) => `<button type="button" role="tab" aria-selected="${st.tab === k}" data-t="${k}" class="${st.tab === k ? 'on' : ''}">${esc(lbl)}${k !== 'base' && tabCount(k) ? `<span class="wct">${tabCount(k)}</span>` : ''}</button>`).join('');

    let main = '';
    if (st.tab === 'base') {
      const sw = (c: string, label: string, on: boolean, key: string, val: unknown) => `<button type="button" class="wsw${on ? ' on' : ''}" data-base="${key}" data-v="${esc(String(val))}" aria-label="${esc(label)}" aria-pressed="${on}" style="background:${esc(c)}"></button>`;
      const tile = (label: string, on: boolean, key: string, val: unknown, look: Look) => `<button type="button" class="wtl${on ? ' on' : ''}" data-base="${key}" data-v="${esc(String(val))}" aria-pressed="${on}">${avatarHTML({ kind: 'art', letter: p.pseudo, color: st.color, look }, 56)}<span>${esc(label)}</span></button>`;
      const rows = [
        { label: 'Teint', opts: SKIN_SW.map((c, i) => sw(c, 'Teint ' + (i + 1), st.look.skin === i, 'skin', i)) },
        { label: 'Coiffure', opts: HAIR_OPTS.map(([n, v]) => tile(n, st.look.hair === v, 'hair', v, { ...st.look, hair: v, hat: null })) },
        { label: 'Couleur des cheveux', opts: HAIRC_SW.map((c, i) => sw(c, 'Cheveux ' + (i + 1), st.look.hc === i, 'hc', i)) },
        { label: 'Pilosité', opts: BEARD_OPTS.map(([n, v]) => tile(n, st.look.beard === v, 'beard', v, { ...st.look, beard: v, hat: null })) },
        { label: 'Manteau (sert aussi de couleur à la table)', opts: PALETTE.map((c, i) => sw(c, COAT_NAMES[i], st.color === c, 'color', c)) },
      ];
      main = `<div class="wbase">${rows.map(r => `<div class="wbaserow"><span class="lbl">${esc(r.label)}</span><div class="wopts">${r.opts.join('')}</div></div>`).join('')}
        <span class="lbl">Teint, coiffure et pilosité sont gratuits et modifiables à tout moment. Aucun choix n'est réservé à un genre.</span></div>`;
    } else if (st.tab === 'carte') {
      // cartes animées (maquette CartesAnimees) : posséder suffit, pas d'interrupteur ; aperçu vidéo au survol
      const cards = (CATALOG.bySlot.carte || []).map(it => {
        const owned = ownsItem(it), key = KEY_OF_FILE[it.value!];
        return `<div class="witem wcarte${owned ? '' : ' lock'}" data-carte="${esc(key)}" tabindex="0" style="--rar:#c39bff" aria-label="${esc(it.name)}, carte Mythique, ${owned ? 'possédée' : 'à gagner au coffre'}">
          <span class="wcard"><span class="art"><img src="${ART[key]}" alt="" draggable="false"></span></span>
          ${!owned ? `<span class="wlock-ico">${LOCK_ICO}</span>` : ''}
          <span class="wname">${esc(it.name)}</span>
          <span class="wrar irid">Mythique</span>
          <span class="whow">${owned ? 'Animée quand vous la jouez' : esc(howLabel(it.how!, achNames)) + ' · 1\u00a0%'}</span>
        </div>`;
      }).join('');
      main = `<p class="lbl wcintro">Leur illustration prend vie à la table, en main et dans le pli. Il suffit de les posséder ; le réglage « Cartes animées » de vos préférences les coupe si besoin.</p><div class="wgrid">${cards}</div>`;
    } else {
      const items = (CATALOG.bySlot[st.tab] || []).map(it => {
        const owned = ownsItem(it), onSel = st.look[it.slot as keyof Look] === it.value;
        const previewLook: Look = { ...st.look, [it.slot]: it.value };
        if (it.variantKey && it.variants?.length) (previewLook as any)[it.variantKey] = it.variants[0];
        const rar = RARITY[it.rarity];
        const vars = it.variantKey && it.variants?.length
          ? `<div class="wvars">${it.variants.map(c => `<button type="button" class="wvar" data-item="${esc(it.id)}" data-key="${it.variantKey}" data-c="${esc(c)}" aria-label="Variante ${esc(c)}" style="background:${esc(c)}"${!owned ? ' disabled' : ''}></button>`).join('')}</div>` : '';
        return `<button type="button" class="witem${onSel ? ' on' : ''}${!owned ? ' lock' : ''}" data-item="${esc(it.id)}" aria-pressed="${onSel}" aria-disabled="${!owned}" style="--rar:${rar.color}">
          ${avatarHTML({ kind: 'art', letter: p.pseudo, color: st.color, look: previewLook }, 72)}
          ${!owned ? `<span class="wlock-ico">${LOCK_ICO}</span>` : ''}
          <span class="wname">${esc(it.name)}</span>
          <span class="wrar" style="color:${rar.color}">${esc(rar.name)}</span>
          ${!owned && it.how ? `<span class="whow">${esc(howLabel(it.how, achNames))}</span>` : ''}
          ${vars}
        </button>`;
      }).join('');
      main = `<div class="wgrid">${items}</div>`;
    }

    const shopHtml = `<div class="wshop">
      <span class="wshop-ttl"><b>Échoppe du port</b><span class="lbl">3 objets, renouvelés chaque jour</span></span>
      ${st.shop.map(s => {
        const it = CATALOG.byId[s.cosmetic_id]; if (!it) return '';
        const already = st.owned.has(it.id), notEnough = st.coins < s.price;
        const label = already ? it.name + ' ✓' : it.name, right = already ? 'acheté' : String(s.price);
        return `<button type="button" class="wshop-btn" data-buy="${esc(it.id)}" ${already || notEnough ? 'disabled' : ''}>${avatarHTML({ kind: 'art', letter: p.pseudo, color: st.color, look: { ...st.look, [it.slot]: it.value } }, 40)}<span><b>${esc(label)}</b><span class="lbl"><span class="coin"></span>${esc(right)}</span></span></button>`;
      }).join('')}
    </div>`;

    box.innerHTML = `<div class="whead">
        <div class="wlhs"><h2>Garde-robe</h2><span class="lbl">Votre visage est libre ; les accessoires se gagnent en jouant.</span></div>
        <div class="wrhs">
          <span class="wpill"><b>${ownedCount}</b>&nbsp;/ ${totalItems} objets</span>
          <span class="wpill"><span class="coin"></span><b>${fmt(st.coins)}</b>&nbsp;pièces</span>
          ${st.chests > 0 ? `<button type="button" class="abtn gold" id="wChest">${CHEST_ICO}Ouvrir ${st.chests > 1 ? st.chests + ' coffres' : '1 coffre'} de victoire</button>` : ''}
        </div>
      </div>
      <div class="wmain">
        <div class="wprev">
          ${avatarHTML(previewAv, 200, ring)}
          <div class="wtblp">${avatarHTML(previewAv, 44, `0 0 0 2px #1b140e, 0 0 0 3px ${st.color}`)}<span><b>${esc(p.pseudo)}</b><span class="lbl">à la table</span></span></div>
          <div class="wbtns"><button type="button" class="abtn ghost" id="wRand">Au hasard</button><button type="button" class="abtn ghost" id="wUndo" ${!dirty ? 'disabled' : ''}>Annuler</button><button type="button" class="abtn gold" id="wSave" ${!dirty ? 'disabled' : ''}>${dirty ? 'Enregistrer' : 'Enregistré ✓'}</button></div>
        </div>
        <div class="wright">
          <div role="tablist" aria-label="Catégories" class="wtabs">${tabs}</div>
          ${main}
          ${shopHtml}
        </div>
      </div>`;

    // interactions
    box.querySelectorAll<HTMLButtonElement>('.wtabs button').forEach(b => b.onclick = () => { st.tab = b.dataset.t!; render(); });
    box.querySelectorAll<HTMLButtonElement>('[data-base]').forEach(b => b.onclick = () => {
      const k = b.dataset.base!, raw = b.dataset.v!;
      if (k === 'color') st.color = raw;
      else if (k === 'skin' || k === 'hc') (st.look as any)[k] = Number(raw);
      else (st.look as any)[k] = raw;
      render();
    });
    box.querySelectorAll<HTMLButtonElement>('.witem').forEach(b => b.onclick = ev => {
      if ((ev.target as HTMLElement).closest('.wvar')) return;
      const id = b.dataset.item!, it = CATALOG.byId[id]; if (!it || !ownsItem(it)) return;
      (st.look as any)[it.slot] = it.value; render();
    });
    box.querySelectorAll<HTMLElement>('.wcarte').forEach(t => {
      const card = t.querySelector('.wcard') as HTMLElement;
      const on = () => { if (animAllowed() && getAnimMode() !== 'aucune') attachAnim(card, t.dataset.carte!); }, off = () => detachAnim(card);
      t.onmouseenter = on; t.onmouseleave = off; t.onfocus = on; t.onblur = off;
    });
    box.querySelectorAll<HTMLButtonElement>('.wvar').forEach(b => b.onclick = () => {
      const id = b.dataset.item!, it = CATALOG.byId[id]; if (!it || !ownsItem(it)) return;
      (st.look as any)[it.slot] = it.value; (st.look as any)[b.dataset.key!] = b.dataset.c; render();
    });
    const wChest = box.querySelector('#wChest') as HTMLButtonElement | null;
    if (wChest) wChest.onclick = () => openChestFlow(wChest);
    box.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b => b.onclick = () => doShopBuy(b));
    $('#wRand', box).onclick = () => {
      const rnd = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
      st.look = { ...st.look, skin: Math.floor(Math.random() * 6), hc: Math.floor(Math.random() * 6), hair: rnd(HAIR_OPTS.map(o => o[1])), beard: rnd(['none', 'none', 'mous', 'short', 'long']) };
      render();
    };
    $('#wUndo', box).onclick = () => { st.look = { ...st.saved }; st.color = st.savedColor; render(); };
    $('#wSave', box).onclick = () => doSave();
  };

  /** Couleurs cohérentes avec les objets portés : une couleur qui n'est pas une variante possédée de l'objet porté
   *  (ex. rouge du bandana gardé sur un tricorne équipé depuis le coffre) revient à la première variante possédée. */
  const fixColors = (look: Look): Look => {
    const out: any = { ...look };
    for (const [slot, key] of [['hat', 'htc'], ['neck', 'nkc'], ['pet', 'ptc']] as const) {
      const value = out[slot]; if (value == null) continue;
      const versions = CATALOG.all.filter(c => c.slot === slot && c.value === value && c.variants?.length);
      if (!versions.length) continue;
      const owned = versions.filter(c => c.defaultOwned || st.owned.has(c.id)).flatMap(c => c.variants!);
      if (owned.length && !owned.includes(out[key])) out[key] = owned[0];
    }
    return out;
  };

  async function openChestFlow(btn: HTMLButtonElement) {
    if (st.busy) return; st.busy = true; btn.disabled = true;
    try {
      const r = await callGame<ChestResult>('chest.open', {});
      // Après chaque ouverture, on met à jour le porte-monnaie et l'inventaire local, puis on continue l'anim
      const applyResult = (res: ChestResult) => {
        st.coins = res.coins; st.chests = res.chests; chestBadge(res.chests);
        if (!res.duplicate) st.owned.add(res.cosmetic_id);
      };
      applyResult(r);
      openChestOverlay(r, {
        color: st.color,
        onEquip: async (_slot, _value, cosmeticId) => {
          st.look = withItem(st.look, cosmeticId); st.saved = { ...st.look }; st.savedColor = st.color;
          await callGame('profile.update', { look: st.look });
          onSaved({ look: { ...st.look } });
        },
        onOpenNext: async () => { const n = await callGame<ChestResult>('chest.open', {}); applyResult(n); return n; },
        onClose: () => { st.busy = false; render(); },
      });
    } catch (e: any) { st.busy = false; btn.disabled = false; toast(e.message, 'err'); render(); }
  }
  async function doShopBuy(btn: HTMLButtonElement) {
    if (st.busy) return; const id = btn.dataset.buy!, s = st.shop.find(x => x.cosmetic_id === id); if (!s) return;
    st.busy = true; btn.disabled = true;
    try {
      await callGame('shop.buy', { cosmetic_id: id });
      st.owned.add(id); st.coins = Math.max(0, st.coins - s.price);
      toast('Objet ajouté à la garde-robe.');
    } catch (e: any) { toast(e.message, 'err'); }
    finally { st.busy = false; render(); }
  }
  async function doSave() {
    const b = $('#wSave', box) as HTMLButtonElement; if (st.busy) return; st.busy = true; b.disabled = true; b.textContent = 'Enregistrement…';
    try {
      // on nettoie look : garde seulement les champs connus
      const l: Record<string, unknown> = {}; st.look = fixColors(st.look);
      for (const k of ['skin', 'hair', 'hc', 'beard', 'hat', 'htc', 'face', 'neck', 'nkc', 'pet', 'ptc', 'bg', 'frame'] as const) if ((st.look as any)[k] !== undefined) l[k] = (st.look as any)[k];
      await callGame('profile.update', { look: l, color: st.color });
      st.saved = { ...st.look }; st.savedColor = st.color;
      onSaved({ look: { ...st.look }, color: st.color });
      toast('Apparence enregistrée.');
    } catch (e: any) { toast(e.message, 'err'); }
    finally { st.busy = false; render(); }
  }
  render();
}

/** Transforme un code de source d'obtention en texte lisible (nom du haut fait lu dans la table achievements). */
function howLabel(how: string, achNames: Map<string, string>): string {
  if (how === 'chest') return 'Coffre de victoire';
  if (how === 'shop') return 'Échoppe du port';
  if (how.startsWith('title:')) { const l = Number(how.slice(6)); const t = LEVEL_TITLES.find(([lv]) => lv === l); return t ? `Niveau ${l} · ${t[1]}` : `Niveau ${l}`; }
  if (how.startsWith('achievement:')) return 'Haut fait · ' + (achNames.get(how.slice(12)) ?? 'à débloquer');
  if (how === 'leaderboard:top3-month') return 'Top 3 du classement du mois';
  return how;
}
// évite l'avertissement de variables importées non utilisées
void avatarSVG;
