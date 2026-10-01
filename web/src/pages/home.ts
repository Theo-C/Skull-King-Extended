// Accueil : mes parties, créer une partie, rejoindre avec un code.
import { sb, callGame } from '../api';
import { $, esc, toast } from '../util';
import { optionsHTML, readOptions, wireOptions } from '../options';
import { go } from '../main';

const STATUS: Record<string, string> = { lobby: 'Salon', playing: 'En cours', finished: 'Terminée' };

export async function homePage(root: HTMLElement, uid: string) {
  root.innerHTML = `<section class="page">
    <div class="hero">
      <div><h1>Vos parties</h1><p class="lead">Créez une table, envoyez le lien à vos amis, et que le meilleur pirate l'emporte.</p></div>
      <div class="hero-actions"><button class="btn gold big" id="bCreate">Créer une partie</button>
        <form id="fCode" class="codeform"><input id="code" maxlength="6" placeholder="CODE" aria-label="Code d'invitation" autocapitalize="characters"><button class="btn alt" type="submit">Rejoindre</button></form></div>
    </div>
    <div id="create" hidden></div>
    <div class="grid2">
      <div class="box"><h2>En cours</h2><div id="live" class="glist"><p class="muted">Chargement…</p></div></div>
      <div class="box"><h2>Terminées</h2><div id="done" class="glist"><p class="muted">Chargement…</p></div></div>
    </div>
  </section>`;
  $('#bCreate', root).onclick = () => openCreate(root);
  $('#fCode', root).addEventListener('submit', ev => { ev.preventDefault(); const c = ($('#code', root) as HTMLInputElement).value.trim().toUpperCase(); if (c) go('#/rejoindre/' + c); });

  const { data, error } = await sb.from('game_players')
    .select('seat, games!inner(id, code, status, updated_at, host, round:state->round, waiting:state->waiting, players:state->players)')
    .eq('user_id', uid);
  if (error) { $('#live', root).innerHTML = `<p class="muted">Impossible de charger vos parties.</p>`; return; }
  const rows = (data || []).map((r: any) => ({ seat: r.seat, ...r.games })).sort((a: any, b: any) => b.updated_at.localeCompare(a.updated_at));
  const item = (g: any) => {
    const mine = g.status === 'playing' && Array.isArray(g.waiting) && g.waiting.includes(g.seat);
    const names = Array.isArray(g.players) ? g.players.map((p: any) => esc(p.name)).join(', ') : '';
    let sub = g.status === 'lobby' ? `Code ${g.code} · en attente des joueurs` : g.status === 'playing' ? `Manche ${g.round ?? 1} / 10` : 'Partie terminée';
    if (g.status === 'finished' && Array.isArray(g.players)) { const me = g.players[g.seat]; const best = Math.max(...g.players.map((p: any) => p.score)); sub = `${me.score} pts${me.score === best ? ' · victoire' : ''}`; }
    return `<a class="gitem" href="#/partie/${g.id}"><span class="st-${g.status}">${STATUS[g.status]}</span><b>${names || 'Salon ' + g.code}</b><small>${sub}</small>${mine ? '<em>À vous de jouer</em>' : ''}</a>`;
  };
  const live = rows.filter((g: any) => g.status !== 'finished'), done = rows.filter((g: any) => g.status === 'finished').slice(0, 12);
  $('#live', root).innerHTML = live.length ? live.map(item).join('') : '<p class="muted">Aucune partie en cours. Créez-en une !</p>';
  $('#done', root).innerHTML = done.length ? done.map(item).join('') : '<p class="muted">Vos parties terminées apparaîtront ici.</p>';
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
