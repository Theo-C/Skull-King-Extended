// Accueil (#/) : héros (avatar, niveau, XP, créer / code / entraînement), « À vous de jouer », parties en cours,
// terminées récemment, mini classement entre amis, derniers hauts faits. Maquettes Accueil et AccueilMobile :
// sous 720 px, variantes « only-mb » / « only-dk » et réordonnancement en CSS (app.css, section Accueil).
import { sb, callGame } from '../api';
import { $, esc, toast, relDay, signed, de } from '../util';
import { optionsHTML, readOptions, wireOptions } from '../options';
import { go } from '../main';
import { myProfile, withLook } from '../account';
import { avatarHTML, fromProfile } from '../avatar';
import { xpLine, LEVEL_TITLES, xpToReach, fmt } from '../xp';

export const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>';
const PROFILE_COLS = 'pseudo, color, avatar_kind, avatar_art, avatar_url';
const nth = (r: number) => r === 1 ? '1er' : r + 'e';
const bidsTxt = (g: any) => `${g.bids_made} mise${g.bids_made > 1 ? 's' : ''} tenue${g.bids_made > 1 ? 's' : ''} sur ${g.rounds}`;

export async function homePage(root: HTMLElement, uid: string) {
  const me = await myProfile(uid);
  const x = xpLine(me?.xp ?? 0);
  const next = LEVEL_TITLES.find(([l]) => l > x.level);
  const toNext = next ? xpToReach(next[0]) - (me?.xp ?? 0) : 0;
  const col = me?.color || '#d9b25a', av = fromProfile(me, 'Pirate');
  root.innerHTML = `<section class="apage home">
    <section class="hero2">
      <svg class="rose" viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="150" fill="none" stroke="#ead08a" stroke-width="2"/><circle cx="200" cy="200" r="120" fill="none" stroke="#ead08a" stroke-dasharray="3 8"/><path d="M200 40l18 142 142 18-142 18-18 142-18-142-142-18 142-18z" fill="#ead08a"/></svg>
      <div class="who">
        <a href="#/profil" aria-label="Mon profil"><span class="only-dk">${avatarHTML(av, 88, `0 0 0 3px #1b140e,0 0 0 6px ${col}`)}</span><span class="only-mb">${avatarHTML(av, 58, `0 0 0 2px #1b140e,0 0 0 4px ${col}`)}</span></a>
        <div class="txt">
          <h1>Bonjour, ${esc(me?.pseudo ?? 'pirate')}</h1>
          <div class="lvl only-dk">Niveau ${x.level} · <b>${esc(x.title)}</b>${next ? ` · encore ${fmt(toNext)} XP avant <b>${esc(next[1])}</b>` : ''}</div>
          <div class="lvl only-mb">Niv. ${x.level} · ${esc(x.title)}${next ? ` · ${fmt(toNext)} XP avant ${esc(next[1])}` : ''}</div>
          <div class="xpbar" title="${x.text} XP"><span style="width:${x.pct}%"></span></div>
        </div>
      </div>
      <div class="acts" id="acts">
        <button class="abtn gold" id="bCreate">Créer une partie</button>
        <form id="fCode" class="codeform2" aria-label="Rejoindre avec un code"><label for="code" class="sr">Code d'invitation</label>
          <input id="code" maxlength="6" placeholder="CODE" autocapitalize="characters" autocomplete="off"><button class="abtn ghost" type="submit">Rejoindre</button></form>
        <a class="abtn ghost" href="#/entrainement"><span>Entraînement<span class="only-dk"> contre des bots</span></span></a>
      </div>
    </section>
    <div id="create" hidden></div>
    <div id="turn"></div>
    <div class="agrid">
      <section class="apanel span2">
        <div class="hrow"><h2>Vos parties</h2><span id="liveN"></span></div>
        <div id="live" class="glist2"><p class="empty">Chargement…</p></div>
        <h3 class="only-dk">Terminées récemment</h3>
        <div id="done" class="glist2 only-dk"><p class="empty">Chargement…</p></div>
        <a class="more only-dk" href="#/historique">Tout l'historique</a>
        <div class="lastg only-mb"><div class="hrow"><h2>Dernière partie</h2><a href="#/historique">Historique</a></div><div id="last" class="glist2"><p class="empty">Chargement…</p></div></div>
      </section>
      <div class="col only-dk">
        <section class="apanel"><div class="hrow"><h2>Entre amis</h2><span>Élo</span></div><div id="friends"><p class="empty">Chargement…</p></div><a class="more" href="#/classement">Voir le classement</a></section>
        <section class="apanel"><h2>Derniers hauts faits</h2><div id="feats"><p class="empty">Chargement…</p></div><a class="more" href="#/profil">Tous vos hauts faits</a></section>
      </div>
    </div>
  </section>`;
  $('#bCreate', root).onclick = () => openCreate(root);
  // sur téléphone, le champ du code est replié : « Rejoindre » l'ouvre d'abord
  $('#fCode', root).addEventListener('submit', ev => {
    ev.preventDefault(); const inp = $('#code', root) as HTMLInputElement, c = inp.value.trim().toUpperCase();
    if (c) { go('#/rejoindre/' + c); return; }
    $('#acts', root).classList.add('open'); inp.focus();
  });
  loadLive(root, uid); loadDone(root, uid); loadFriends(root, uid); loadFeats(root, uid);
}

/** Parties en cours et salons, avec le bandeau « À vous de jouer » pour la première où l'on est attendu. */
async function loadLive(root: HTMLElement, uid: string) {
  const { data, error } = await sb.from('game_players')
    .select('seat, games!inner(id, code, status, updated_at, host, round:state->round, trickNo:state->trickNo, cards:state->cards, waiting:state->waiting, current:state->current, players:state->players)')
    .eq('user_id', uid).in('games.status', ['lobby', 'playing']);
  if (error) { $('#live', root).innerHTML = '<p class="empty">Impossible de charger vos parties.</p>'; return; }
  const rows = (data || []).map((r: any) => ({ seat: r.seat, ...r.games })).sort((a: any, b: any) => b.updated_at.localeCompare(a.updated_at));
  // sièges et avatars de toutes ces parties en une requête
  const ids = rows.map((g: any) => g.id);
  let seats: any[] = [];
  if (ids.length) {
    const r = await withLook<any>(l => sb.from('game_players').select(`game_id, seat, user_id, bot, name, profiles(${PROFILE_COLS}${l})`).in('game_id', ids).order('seat'));
    seats = r.data || [];
  }
  const nameOf = (g: any, seat: number) => g.players?.[seat]?.name ?? seats.find(s => s.game_id === g.id && s.seat === seat)?.name ?? '?';
  let turn: any = null;
  const cards = rows.map((g: any) => {
    const gs = seats.filter(s => s.game_id === g.id);
    const who = gs.filter(s => s.user_id || s.bot).slice(0, 4).map(s => avatarHTML(s.profiles ? fromProfile(s.profiles, s.name) : { letter: s.name }, 38)).join('');
    const hostSeat = gs.find(s => s.user_id === g.host);
    const title = g.status === 'lobby' ? `Salon ${g.code}` : g.host === uid ? 'Votre table' : `Table ${de(hostSeat?.name ?? '?')}`;
    let sub: string, badge: string, cls = '', mbHide = '';
    if (g.status === 'lobby') {
      const free = gs.filter(s => !s.bot && !s.user_id).length;
      sub = `En attente · ${free ? `${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}` : 'complet'}`; badge = 'Salon'; cls = 'salon';
    } else {
      const ps = g.players || [], mine = ps[g.seat], rank = mine ? 1 + ps.filter((p: any) => p.score > mine.score).length : 0;
      sub = `Manche ${g.round ?? 1} · vous : ${mine?.score ?? 0} pts, ${nth(rank)}`;
      const myTurn = Array.isArray(g.waiting) && g.waiting.includes(g.seat);
      if (myTurn) {
        badge = 'À vous de jouer'; cls = 'turn';
        // sur téléphone, la partie du bandeau n'est pas répétée dans la liste
        if (!turn) { turn = { g, mine, rank, title }; mbHide = ' only-dk'; }
      } else badge = g.current != null ? esc(`Tour ${de(nameOf(g, g.current))}`) : 'En cours';
    }
    let dots = ''; for (let r = 1; r <= 10; r++) dots += `<i class="${g.status === 'lobby' ? '' : r < g.round ? 'd' : r === g.round ? 'n' : ''}"></i>`;
    return `<a class="gcard${mbHide}" href="#/partie/${g.id}"><span class="stack-av">${who}</span>
      <span class="gm"><span class="gt">${esc(title)}</span><span class="gs">${sub}</span><span class="rdots" aria-hidden="true">${dots}</span></span>
      <span class="badge ${cls}">${badge}</span></a>`;
  });
  const n = rows.length, nMb = n - (turn ? 1 : 0);
  $('#liveN', root).innerHTML = (n ? `<span class="only-dk">${n} en cours</span>` : '') + (nMb ? `<span class="only-mb">${nMb} en cours</span>` : '');
  $('#live', root).innerHTML = cards.join('') + (turn && !nMb ? '<p class="empty only-mb">Pas d\'autre partie en cours.</p>' : '')
    || '<p class="empty">Aucune partie en cours. Créez-en une ou rejoignez des amis avec un code.</p>';
  if (turn) {
    const t = turn.title === 'Votre table' ? 'à votre table' : turn.title.replace(/^Table /, 'à la table ');
    const pts = turn.mine?.score ?? 0, trick = turn.g.trickNo ? ` · pli ${turn.g.trickNo}` : '';
    $('#turn', root).innerHTML = `<a class="turnband" href="#/partie/${turn.g.id}"><span class="dot only-dk"></span>
      <span class="tx only-dk"><b>À vous de jouer ${esc(t)}</b><span>Manche ${turn.g.round} sur 10${trick} · vous êtes ${nth(turn.rank)} avec ${pts} point${Math.abs(pts) > 1 ? 's' : ''}</span></span>
      <span class="tx only-mb"><span class="tk"><span class="dot2"></span>À vous de jouer</span><b>${esc(turn.title)}</b><span>Manche ${turn.g.round}${trick} · vous êtes ${nth(turn.rank)} (${pts} pts)</span></span>
      <span class="go only-dk">Reprendre</span></a>`;
  }
}

/** Trois dernières parties terminées (historique du serveur : place, score, mises tenues, XP) ; la dernière seule sur téléphone. */
async function loadDone(root: HTMLElement, uid: string) {
  try {
    const { items } = await callGame<{ items: any[] }>('history.list', {});
    const none = '<p class="empty">Vos parties terminées apparaîtront ici.</p>';
    $('#done', root).innerHTML = items.slice(0, 3).map(g => doneCard(g, uid)).join('') || none;
    const g = items[0];
    $('#last', root).innerHTML = g ? `<a class="gcard last" href="#/partie/${g.id}"><span class="medal m${Math.min(g.place, 4)}">${g.place}</span>
      <span class="gm"><span class="gt">${g.place === 1 ? 'Victoire' : `${nth(g.place)} place`} · ${g.score} pts</span><span class="gs">${esc(relDay(g.finished_at))} · ${bidsTxt(g)}</span></span>
      ${g.xp ? `<b class="xpg">+${fmt(g.xp)} XP</b>` : ''}</a>` : none;
  } catch { $('#done', root).innerHTML = $('#last', root).innerHTML = '<p class="empty">Historique indisponible pour le moment.</p>'; }
}
export function doneCard(g: any, uid: string) {
  const mine = (g.seats || []).filter((s: any) => s.user_id !== uid).map((s: any) => s.name).filter(Boolean).slice(0, 3);
  const list = (a: string[]) => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1];
  const title = g.place === 1 ? `Victoire contre ${list(mine)}` : `Avec ${list(mine)}`;
  return `<a class="gcard" href="#/partie/${g.id}"><span class="medal m${Math.min(g.place, 4)}">${g.place}</span>
    <span class="gm"><span class="gt">${esc(title)}</span><span class="gs">${esc(relDay(g.finished_at))} · ${bidsTxt(g)}</span></span>
    <span class="sc"><b>${g.score}</b>${g.xp ? `<span>+${fmt(g.xp)} XP</span>` : ''}</span></a>`;
}

/** Mini classement entre amis : Élo et variation sur 7 jours. */
async function loadFriends(root: HTMLElement, uid: string) {
  const { data, error } = await sb.rpc('leaderboard_period', { scope: 'friends', period: 'week' });
  if (error) { $('#friends', root).innerHTML = '<p class="empty">Classement indisponible.</p>'; return; }
  const rows = (data || []) as any[];
  const top = rows.slice(0, 5); const meRow = rows.find(r => r.user_id === uid);
  if (meRow && !top.includes(meRow)) top.push(meRow);
  $('#friends', root).innerHTML = top.map(r => `<div class="frow${r.user_id === uid ? ' me' : ''}"><span class="rk">${r.rank}</span>${avatarHTML(fromProfile(r), 32)}
    <span class="nm">${esc(r.pseudo)}</span><span class="el"><b>${r.elo}</b> <span class="${r.delta > 0 ? 'pos' : r.delta < 0 ? 'neg' : ''}">${r.delta ? signed(Number(r.delta)) : ''}</span></span></div>`).join('')
    || '<p class="empty">Jouez une partie en ligne avec des amis pour les voir ici.</p>';
}

/** Trois derniers hauts faits débloqués. */
async function loadFeats(root: HTMLElement, uid: string) {
  const { data, error } = await sb.from('user_achievements').select('code, unlocked_at, achievements(name, description)').eq('user_id', uid).order('unlocked_at', { ascending: false }).limit(3);
  if (error) { $('#feats', root).innerHTML = '<p class="empty">Hauts faits indisponibles.</p>'; return; }
  $('#feats', root).innerHTML = (data || []).map((a: any) => `<div class="feat"><span class="fbadge">${STAR}</span><span><b>${esc(a.achievements?.name ?? a.code)}</b><span>${esc(a.achievements?.description ?? '')} · ${esc(relDay(a.unlocked_at).toLowerCase())}</span></span></div>`).join('')
    || '<p class="empty">Terminez une partie en ligne pour débloquer « Premier abordage ».</p>';
}

function openCreate(root: HTMLElement) {
  const box = $('#create', root); box.hidden = false;
  box.innerHTML = `<div class="box sheetlike">
    <h2>Nouvelle partie</h2>
    <div class="form">
      <label class="inline">Nombre de joueurs <select id="n">${[3, 4, 5, 6, 7, 8, 9].map(n => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <fieldset><legend>Sièges</legend><div id="seats" class="seatlist"></div>
        <p class="muted small">Les sièges « Ami » attendent un joueur invité par lien. S'ils restent libres au lancement, un bot les prend.</p></fieldset>
      ${optionsHTML()}
    </div>
    <div class="foot"><button class="btn alt" id="cancel">Annuler</button><button class="btn gold" id="go">Créer le salon</button></div>
  </div>`;
  const seatsEl = $('#seats', box);
  const types: boolean[] = [false, false, true, true];
  const draw = () => {
    const n = Number(($('#n', box) as HTMLSelectElement).value);
    while (types.length < n) types.push(true); types.length = n;
    seatsEl.innerHTML = types.map((bot, i) => i === 0 ? `<div class="seatrow"><span class="sn">1</span><b>Vous (hôte)</b></div>` :
      `<div class="seatrow"><span class="sn">${i + 1}</span><select data-i="${i}" aria-label="Siège ${i + 1}"><option value="h" ${!bot ? 'selected' : ''}>Ami</option><option value="b" ${bot ? 'selected' : ''}>Bot</option></select></div>`).join('');
    seatsEl.querySelectorAll('select').forEach(s => s.addEventListener('change', () => { types[Number((s as HTMLElement).dataset.i)] = (s as HTMLSelectElement).value === 'b'; }));
  };
  $('#n', box).addEventListener('change', draw); draw(); wireOptions(box);
  $('#cancel', box).onclick = () => { box.hidden = true; box.innerHTML = ''; };
  $('#go', box).onclick = async () => {
    const b = $('#go', box) as HTMLButtonElement; b.disabled = true; b.textContent = 'Création…';
    try { const r = await callGame<{ id: string }>('create', { seats: types.map(bot => ({ bot })), options: readOptions(box) }); go('#/partie/' + r.id); }
    catch (e: any) { toast(e.message, 'err'); b.disabled = false; b.textContent = 'Créer le salon'; }
  };
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
