// Profil (#/profil) : identité + XP, garde-robe (personnage composé, objets, coffres, échoppe), statistiques, Élo, titres,
// hauts faits, réglages du compte. Maquette docs/maquettes/Profil.dc.html.
import { sb, callGame } from '../api';
import { $, esc, toast } from '../util';
import { myProfile, forgetProfile, shell, applyPrefs, type Profile } from '../account';
import { avatarHTML, PALETTE, SKINS, HAIR_COLORS, type AvatarData } from '../avatar';
import { xpLine, LEVEL_TITLES, xpToReach, fmt, titleFor } from '../xp';
import { CATALOG, BY_ID, FREE, DEFAULT_LOOK, RARITY, howTo, type Cosmetic, type Look, type Slot } from '@shared/cosmetics.ts';
import { itemPreview } from '../objects';
import { openChestOverlay, type ChestResult } from '../chest';

const COLOR_NAMES = ['Or', 'Corail', 'Algue', 'Lagon', 'Améthyste', 'Ambre', 'Écume', 'Corail rose'];
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z"/></svg>';
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
      <div class="pav"><span id="heroAv"></span><button class="abtn gold round" id="bEdit" aria-label="Ouvrir la garde-robe" aria-controls="wardrobe">${PENCIL}</button></div>
      <div class="pid">
        <div class="pline"><h1 id="heroName">${esc(p.pseudo)}</h1><span class="chip1">${esc(x.title)} · niveau ${x.level}</span>
          <span class="chip2">Élo ${eloNow}${lastDelta ? ` <span class="${lastDelta > 0 ? 'up' : 'down'}">${arrow(lastDelta)}</span>` : ''}</span></div>
        <div class="psub">${since ? `Membre depuis ${esc(since)} · ` : ''}${st.games} partie${st.games > 1 ? 's' : ''} jouée${st.games > 1 ? 's' : ''}</div>
        <div class="pxp"><div class="xpbar"><span style="width:${x.pct}%"></span></div><b>${x.text} XP</b></div>
        ${next ? `<div class="pnext">Encore ${fmt(xpToReach(next[0]) - p.xp)} XP pour devenir <b>${esc(next[1])}</b> (niveau ${next[0]})</div>` : ''}
      </div>
    </section>
    <section class="apanel wardrobe" id="wardrobe" tabindex="-1" aria-label="Garde-robe du pirate"><p class="empty">Chargement de la garde-robe…</p></section>
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
  const wr = $('#wardrobe', root);
  $('#bEdit', root).onclick = () => { wr.scrollIntoView({ behavior: 'smooth', block: 'start' }); wr.focus({ preventScroll: true }); };
  wardrobe(wr, uid, p, saved => { Object.assign(p, saved); paintHero(p); forgetProfile(); shell({ id: uid }, 'profile'); });
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

const av = (p: Pick<Profile, 'avatar_kind' | 'avatar_art' | 'look' | 'pseudo' | 'color'>): AvatarData => ({ look: p.look, kind: p.avatar_kind, art: p.avatar_art, letter: p.pseudo, color: p.color });
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


/* ---------- Garde-robe (maquette Profil, section Garde-robe) ---------- */
type Tab = 'base' | Slot;
const TABS: [Tab, string][] = [['base', 'Visage'], ['hat', 'Chapeaux'], ['face', 'Yeux et visage'], ['neck', 'Cou'], ['pet', 'Compagnons'], ['bg', 'Décor'], ['frame', 'Cadre']];
const NONE: Partial<Record<Slot, string>> = { hat: 'Tête nue', face: 'Rien', neck: 'Rien', pet: 'Personne', frame: 'Sans cadre' };
const HAIRS: [string, string][] = [['Court', 'court'], ['Mèche', 'meche'], ['Long', 'long'], ['Bouclé', 'boucles'], ['Chignon', 'chignon'], ['Tresse', 'tresse'], ['Queue', 'queue'], ['Rasé', 'none']];
const BEARDS: [string, string][] = [['Aucune', 'none'], ['Moustache', 'mous'], ['Barbe courte', 'short'], ['Grande barbe', 'long']];
const LOCK = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="#ead08a"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#ead08a" stroke-width="2"/></svg>';
const CHEST = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18v9H3zM3 10c0-4 3-6 9-6s9 2 9 6M10 12h4v3h-4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const COIN = '<span class="coin" aria-hidden="true"></span>';
const NEW_DAYS = 3;

async function wardrobe(box: HTMLElement, uid: string, p: Profile, onSaved: (s: Partial<Profile>) => void) {
  const [rows, wallet] = await Promise.all([
    sb.from('user_cosmetics').select('cosmetic_id, obtained_at').eq('user_id', uid).then(r => r.error ? null : r.data || []),
    sb.from('user_wallet').select('coins, chests').eq('user_id', uid).maybeSingle().then(r => r.data),
  ]);
  // base sans la migration de la garde-robe
  if (rows === null) { box.innerHTML = '<div class="hrow"><h2>Garde-robe</h2></div><p class="lbl">La garde-robe ouvre bientôt ses portes.</p>'; return; }
  const owned = new Set<string>([...FREE, ...rows.map((r: any) => r.cosmetic_id)]);
  const fresh = new Set<string>(rows.filter((r: any) => Date.now() - Date.parse(r.obtained_at) < NEW_DAYS * 864e5).map((r: any) => r.cosmetic_id));
  const start: Look = { ...DEFAULT_LOOK, ...(p.look || {}) };
  const st = {
    tab: 'base' as Tab, look: { ...start }, saved: { ...start }, color: p.color, savedColor: p.color,
    coins: wallet?.coins ?? 0, chests: wallet?.chests ?? 0, shop: null as any[] | null, busy: false,
  };
  const dirty = () => JSON.stringify(st.look) !== JSON.stringify(st.saved) || st.color !== st.savedColor || !p.look;
  const ring = (c: string, w = 6) => `0 0 0 ${w / 2}px #1b140e,0 0 0 ${w}px ${c}`;
  const withItem = (it: Cosmetic | null, slot: Slot, variant?: string): Look => {
    const lk: any = { ...st.look, [slot]: it ? it.value : null };
    if (it?.variants) lk[it.variants.key] = variant ?? (st.look[slot] === it.value && (st.look as any)[it.variants.key]) ?? it.variants.colors[0];
    return lk;
  };
  const avatar = (look: Partial<Look>, size: number, r?: string, locked = false) => avatarHTML({ look: look as Look, letter: p.pseudo, color: st.color }, size, r, locked);

  const baseHTML = () => {
    const sw = (k: string, label: string, c: string, on: boolean, extra = '') =>
      `<button class="sw${on ? ' on' : ''}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-k="${k}" ${extra} aria-label="${esc(label)}" style="background:${c}"></button>`;
    const tile = (k: string, v: string, label: string, on: boolean) =>
      `<button class="bt${on ? ' on' : ''}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-k="${k}" data-v="${v}">${avatar({ ...st.look, [k]: v, hat: null, pet: null }, 56)}<span>${esc(label)}</span></button>`;
    const row = (id: string, label: string, opts: string) => `<div class="brow"><span class="lbl b" id="${id}">${label}</span><div class="opts" role="radiogroup" aria-labelledby="${id}">${opts}</div></div>`;
    return row('wSkin', 'Teint', SKINS.map(([c], i) => sw('skin', `Teint ${i + 1}`, c, st.look.skin === i, `data-v="${i}"`)).join(''))
      + row('wHair', 'Coiffure', HAIRS.map(([l, v]) => tile('hair', v, l, st.look.hair === v)).join(''))
      + row('wHc', 'Couleur des cheveux', HAIR_COLORS.map((c, i) => sw('hc', `Cheveux ${i + 1}`, c, st.look.hc === i, `data-v="${i}"`)).join(''))
      + row('wBeard', 'Pilosité', BEARDS.map(([l, v]) => tile('beard', v, l, st.look.beard === v)).join(''))
      + row('wCoat', 'Manteau (sert aussi de couleur à la table)', PALETTE.map((c, i) => sw('color', COLOR_NAMES[i], c, st.color === c, `data-v="${c}"`)).join(''))
      + '<span class="lbl">Teint, coiffure et pilosité sont gratuits et modifiables à tout moment. Aucun choix n\'est réservé à un genre.</span>';
  };
  const itemsHTML = (slot: Slot) => {
    const list: (Cosmetic | null)[] = [...(NONE[slot] ? [null] : []), ...CATALOG.filter(x => x.slot === slot)];
    return `<div class="items">${list.map(it => {
      const id = it ? it.id : `${slot}:`, has = !it || owned.has(it.id), on = (st.look[slot] ?? null) === (it ? it.value : null);
      const rc = it ? RARITY[it.rarity].color : RARITY.commun.color, name = it ? it.name : NONE[slot]!;
      const pv = it ? itemPreview(it, st.color, 64, { silhouette: !has, look: withItem(it, slot), variantColor: it.variants && on ? (st.look as any)[it.variants.key] : undefined })
        : avatar(withItem(null, slot), 64);
      const vars = it?.variants && has ? `<span class="vars">${it.variants.colors.map((c, j) => {
        const sel = on && (st.look as any)[it.variants!.key] === c;
        return `<button class="vsw${sel ? ' on' : ''}" data-id="${it.id}" data-c="${c}" aria-pressed="${sel}" aria-label="${esc(name)} : couleur ${j + 1}" style="background:${c}"></button>`;
      }).join('')}</span>` : '';
      return `<div class="it${on ? ' on' : ''}${has ? '' : ' lock'}" style="--rar:${rc}">
        <button class="itb" data-id="${id}" aria-pressed="${on}" ${has ? '' : 'aria-disabled="true"'} aria-label="${esc(name)}${has ? '' : ' (verrouillé)'}">
          <span class="ipw">${pv}${has ? '' : LOCK}${it && has && fresh.has(it.id) ? '<span class="new">Nouveau</span>' : ''}</span>
          <span class="inm">${esc(name)}</span>${it ? `<span class="rar" style="color:${rc}">${RARITY[it.rarity].name}</span>` : ''}
          ${it && !has ? `<span class="how">${esc(howTo(it, titleFor))}</span>` : ''}</button>${vars}</div>`;
    }).join('')}</div>`;
  };
  const shopHTML = () => `<div class="shoprow"><span class="sh"><b>Échoppe du port</b><span class="lbl">3 objets, renouvelés chaque jour</span></span>
    ${st.shop == null ? '<span class="lbl">Chargement…</span>' : st.shop.map(x => {
      const it = BY_ID[x.id], has = owned.has(x.id), dis = has || st.coins < x.price;
      return `<button class="shop" data-buy="${x.id}" aria-disabled="${dis}">${avatar(withItem(it, it.slot), 40)}<span><b>${esc(it.name)}${has ? ' ✓' : ''}</b>
        <span class="lbl">${has ? 'acheté' : `${COIN}${x.price} pièces`}</span></span></button>`;
    }).join('')}</div>`;

  const paint = () => {
    const keep = (document.activeElement as HTMLElement | null)?.closest?.('#wardrobe') ? focusKey(document.activeElement as HTMLElement) : null;
    const total = CATALOG.filter(x => x.source !== 'free').length, mine = CATALOG.filter(x => x.source !== 'free' && owned.has(x.id)).length;
    box.innerHTML = `<div class="whead"><span><h2>Garde-robe</h2><span class="lbl">Votre visage est libre ; les accessoires se gagnent en jouant.</span></span>
        <span class="wpills"><span class="pill"><b>${mine}</b>&nbsp;/ ${total} objets</span><span class="pill">${COIN}<b id="wCoins">${fmt(st.coins)}</b>&nbsp;pièces</span>
        ${st.chests ? `<button class="abtn gold" id="wChest">${CHEST}Ouvrir ${st.chests > 1 ? `${st.chests} coffres` : '1 coffre'} de victoire</button>` : ''}</span></div>
      <div class="wgrid">
        <div class="wprev">${avatar(st.look, 200, ring(st.color))}
          <div class="tableplate">${avatar(st.look, 44, `0 0 0 2px #1b140e,0 0 0 3px ${st.color}`)}<span><b>${esc(p.pseudo)}</b><span class="lbl">à la table</span></span></div>
          <div class="wbtns"><button class="abtn ghost" id="wRand">Au hasard</button><button class="abtn ghost" id="wUndo">Annuler</button>
            <button class="abtn gold" id="wSave" ${dirty() ? '' : 'disabled'}>${dirty() ? 'Enregistrer' : 'Enregistré ✓'}</button></div></div>
        <div class="wright">
          <div role="tablist" class="wtabs" aria-label="Catégories">${TABS.map(([k, l]) => {
            const n = k === 'base' ? 0 : CATALOG.filter(x => x.slot === k && fresh.has(x.id)).length, on = st.tab === k;
            return `<button role="tab" id="wt-${k}" data-t="${k}" aria-selected="${on}" aria-controls="wpanel" tabindex="${on ? 0 : -1}" class="${on ? 'on' : ''}">${l}${n ? `<span class="cnt" aria-label="${n} nouveau${n > 1 ? 'x' : ''}">${n}</span>` : ''}</button>`;
          }).join('')}</div>
          <div id="wpanel" role="tabpanel" aria-labelledby="wt-${st.tab}">${st.tab === 'base' ? baseHTML() : itemsHTML(st.tab)}</div>
          ${shopHTML()}
        </div>
      </div>`;
    bind();
    if (keep) (box.querySelector(keep) as HTMLElement | null)?.focus();
  };
  // après un nouveau rendu, le focus revient sur l'élément équivalent
  const focusKey = (el: HTMLElement) => el.id ? '#' + el.id : el.dataset.t ? `[data-t="${el.dataset.t}"]` : el.dataset.k ? `[data-k="${el.dataset.k}"][data-v="${el.dataset.v}"]`
    : el.dataset.c ? `[data-id="${el.dataset.id}"][data-c="${el.dataset.c}"]` : el.dataset.id ? `.itb[data-id="${el.dataset.id}"]` : el.dataset.buy ? `[data-buy="${el.dataset.buy}"]` : null;

  const save = async () => {
    if (st.busy) return; st.busy = true; const b = $('#wSave', box) as HTMLButtonElement; b.disabled = true; b.textContent = 'Enregistrement…';
    try {
      await callGame('profile.update', { look: st.look, color: st.color });
      st.saved = { ...st.look }; st.savedColor = st.color; onSaved({ look: { ...st.look }, color: st.color }); toast('Garde-robe enregistrée.');
    } catch (e: any) { toast(e.message, 'err'); } finally { st.busy = false; paint(); }
  };
  const bind = () => {
    box.querySelectorAll<HTMLElement>('[role=tab]').forEach(t => t.onclick = () => { st.tab = t.dataset.t as Tab; paint(); });
    roving($('.wtabs', box), '[role=tab]', t => { st.tab = t.dataset.t as Tab; paint(); });
    box.querySelectorAll<HTMLElement>('#wpanel [data-k]').forEach(b => b.onclick = () => {
      const k = b.dataset.k!, v = b.dataset.v!;
      if (k === 'color') st.color = v; else (st.look as any)[k] = k === 'skin' || k === 'hc' ? Number(v) : v;
      paint();
    });
    box.querySelectorAll<HTMLElement>('#wpanel .opts').forEach(g => roving(g, '[role=radio]', b => b.click()));
    box.querySelectorAll<HTMLElement>('.itb').forEach(b => b.onclick = () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      const [slot, value] = b.dataset.id!.split(':') as [Slot, string];
      st.look = withItem(value ? BY_ID[b.dataset.id!] : null, slot); paint();
    });
    box.querySelectorAll<HTMLElement>('.vsw').forEach(b => b.onclick = () => { const it = BY_ID[b.dataset.id!]; st.look = withItem(it, it.slot, b.dataset.c); paint(); });
    $('#wRand', box).onclick = () => {
      const r = (n: number) => Math.floor(Math.random() * n);
      st.look = { ...st.look, skin: r(6), hc: r(6), hair: HAIRS[r(HAIRS.length)][1], beard: ['none', 'none', 'mous', 'short', 'long'][r(5)] }; paint();
    };
    $('#wUndo', box).onclick = () => { st.look = { ...st.saved }; st.color = st.savedColor; paint(); };
    $('#wSave', box).onclick = save;
    box.querySelectorAll<HTMLElement>('[data-buy]').forEach(b => b.onclick = async () => {
      if (b.getAttribute('aria-disabled') === 'true') { if (!owned.has(b.dataset.buy!)) toast('Pas assez de pièces pour cet objet.', 'err'); return; }
      const it = BY_ID[b.dataset.buy!];
      try { const r = await callGame('shop.buy', { id: it.id }); owned.add(it.id); fresh.add(it.id); st.coins = r.coins; st.tab = it.slot; paint(); toast(`${it.name} ajouté à votre garde-robe.`); }
      catch (e: any) { toast(e.message, 'err'); }
    });
    const chest = box.querySelector<HTMLElement>('#wChest');
    if (chest) chest.onclick = () => openChestOverlay({
      chests: st.chests, coins: st.coins, color: st.color, sounds: p.sounds,
      open: async () => {
        const r: ChestResult = await callGame('chest.open', {});
        if (!r.duplicate) { owned.add(r.item.id); fresh.add(r.item.id); }
        st.coins = r.coins; st.chests = r.chests; return r;
      },
      // « Équiper » : porte l'objet et enregistre tout de suite
      equip: async r => { const it = BY_ID[r.item.id]; st.look = withItem(it, it.slot); st.tab = it.slot; await save(); },
      onClose: last => { st.coins = last.coins; st.chests = last.chests; paint(); shell({ id: uid }, 'profile'); },
    });
  };
  paint();
  callGame('shop.list', {}).then((s: any) => { st.shop = s.items; st.coins = s.coins; st.chests = s.chests; paint(); }, () => { st.shop = []; paint(); });
}
