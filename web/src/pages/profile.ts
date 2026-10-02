// Profil (#/profil) : identité + XP, éditeur d'image (pirate illustré, photo recadrée, initiale), statistiques, Élo, titres,
// hauts faits, réglages du compte. Maquette Profil.
import { sb, callGame } from '../api';
import { $, esc, toast } from '../util';
import { myProfile, forgetProfile, shell, applyPrefs, type Profile } from '../account';
import { avatarHTML, PALETTE, ART_NAMES, type AvatarData } from '../avatar';
import { xpLine, LEVEL_TITLES, xpToReach, fmt } from '../xp';

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
  const [stats, mine, all, created, elo, friends, global] = await Promise.all([
    sb.from('player_stats').select('*').eq('user_id', uid).maybeSingle().then(r => r.data),
    sb.from('user_achievements').select('code, unlocked_at').eq('user_id', uid).then(r => r.data || []),
    sb.from('achievements').select('code, name, description, sort').order('sort').then(r => r.data || []),
    sb.from('profiles').select('created_at').eq('id', uid).maybeSingle().then(r => r.data?.created_at as string | undefined),
    sb.from('game_results').select('elo_before, elo_after, elo_delta, finished_at').eq('user_id', uid).not('elo_delta', 'is', null).order('finished_at', { ascending: false }).limit(15).then(r => (r.data || []).reverse()),
    sb.rpc('leaderboard_period', { scope: 'friends', period: 'ever' }).then(r => r.data || []),
    sb.rpc('leaderboard_period', { scope: 'all', period: 'ever' }).then(r => r.data || []),
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
        ${pref('public_rank', 'Apparaître dans le classement public', 'sinon, visible seulement par vos amis', p.public_rank)}
      </div>
      <div class="acc-foot"><button class="abtn gold" id="bPseudo">Enregistrer le pseudo</button><button class="abtn ghost" id="bOut">Se déconnecter</button></div>
    </section>
  </section>`;

  const paintHero = (pp: Profile) => { $('#heroAv', root).innerHTML = avatarHTML(av(pp), 120, `0 0 0 3px #1b140e,0 0 0 6px ${pp.color}`); $('#heroName', root).textContent = pp.pseudo; };
  paintHero(p);
  $('#bEdit', root).onclick = () => openEditor(root, uid, p, saved => { Object.assign(p, saved); paintHero(p); forgetProfile(); shell({ id: uid }, 'profile'); });
  $('#bPseudo', root).onclick = async () => {
    const v = ($('#pseudo', root) as HTMLInputElement).value.trim();
    const b = $('#bPseudo', root) as HTMLButtonElement; b.disabled = true;
    try { await callGame('profile.update', { pseudo: v }); p.pseudo = v; paintHero(p); forgetProfile(); shell({ id: uid }, 'profile'); toast('Pseudo enregistré.'); }
    catch (e: any) { toast(e.message, 'err'); } finally { b.disabled = false; }
  };
  root.querySelectorAll<HTMLButtonElement>('.tg').forEach(t => t.onclick = async () => {
    const k = t.dataset.k as 'notify_turn' | 'sounds' | 'public_rank', on = t.getAttribute('aria-checked') !== 'true';
    const set = (v: boolean) => { t.setAttribute('aria-checked', String(v)); t.classList.toggle('on', v); };
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

const av = (p: Pick<Profile, 'avatar_kind' | 'avatar_art' | 'avatar_url' | 'pseudo' | 'color'>): AvatarData => ({ kind: p.avatar_kind, art: p.avatar_art, url: p.avatar_url, letter: p.pseudo, color: p.color });
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
