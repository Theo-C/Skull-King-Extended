// Salon d'une partie (avant le lancement) : code en grand, lien d'invitation (Copier / Partager / QR code), équipage, réglages,
// « Lever l'ancre » réservé à l'hôte. Maquette Salon. Affiché par la page de partie (#/partie/:id) tant que la partie est en salon ;
// #/salon/CODE y mène aussi.
import { sb, callGame, inviteLink } from '../api';
import { $, esc, toast, copyText, modal } from '../util';
import { optionsHTML, readOptions, wireOptions } from '../options';
import { avatarHTML, fromProfile } from '../avatar';
import { withLook } from '../account';
import { levelFor } from '../xp';
import { qrSVG } from '../qr';
import { go } from '../main';
import { de, BOT_COLOR } from './history';

/** #/salon/CODE : ouvre le salon si l'on en fait partie, sinon la page d'invitation. */
export async function salonByCode(root: HTMLElement, code: string) {
  root.innerHTML = `<section class="apage"><p class="empty">Recherche du salon ${esc(code)}…</p></section>`;
  try { const pv = await callGame<any>('preview', { code }); go(pv.member ? '#/partie/' + pv.id : '#/rejoindre/' + code); }
  catch (e: any) { root.innerHTML = `<section class="apage"><div class="apanel"><h2>Salon introuvable</h2><p class="empty">${esc(e.message)}</p><a class="more" href="#/">Retour à l'accueil</a></div></section>`; }
}

const profCache = new Map<string, any>();
/** Profils (avatar, XP) des joueurs assis, gardés en mémoire entre deux rafraîchissements du salon. */
async function profilesOf(ids: string[]) {
  const miss = ids.filter(i => !profCache.has(i));
  if (miss.length) {
    const { data } = await withLook<any>(l => sb.from('profiles').select('id, pseudo, color, avatar_kind, avatar_art, avatar_url, xp' + l).in('id', miss));
    (data || []).forEach((p: any) => profCache.set(p.id, p));
  }
  return (id: string | null) => id ? profCache.get(id) ?? null : null;
}

/** État courant d'un salon affiché : la page est construite une fois, puis seules les parties qui changent sont mises à jour. */
interface Live { g: any; seats: any[]; html: string[]; keys: string[]; opts: string }
const live = new WeakMap<HTMLElement, Live>();

export async function renderSalon(root: HTMLElement, g: any, seats: any[], uid: string, sync: () => Promise<void>) {
  const host = g.host === uid;
  const prof = await profilesOf(seats.filter(s => s.user_id).map(s => s.user_id));
  let box = root.querySelector<HTMLElement>('#salon'), st = box && box.dataset.id === g.id ? live.get(box) : undefined;
  const first = !st;
  if (!box || !st) { box = build(root, g, host, sync); st = { g, seats, html: [], keys: [], opts: '' }; live.set(box, st); }
  st.g = g; st.seats = seats;

  const hostName = seats.find(s => s.user_id === g.host)?.name || '?';
  const filled = seats.filter(s => s.bot || s.user_id).length, free = seats.length - filled;
  $('#stitle', box).textContent = 'Salon ' + de(hostName);
  $('#scount', box).textContent = `${filled} / ${seats.length} joueurs · 3 minimum`;

  // places : on ne remplace que celles qui ont changé ; seules les nouvelles arrivées s'animent (.new)
  const seatRow = (s: any) => {
    if (!s.bot && !s.user_id) return `<div class="seatc empty"><span class="wait"></span><span class="sn">Place libre · en attente d'un pirate</span>
      ${host ? `<button class="abtn ghost sm" data-toggle="${s.seat}">Ajouter un bot</button>` : ''}</div>`;
    const p = prof(s.user_id), me = s.user_id === uid, isHost = s.user_id === g.host;
    const av = p ? fromProfile(p, s.name) : { letter: s.name, color: BOT_COLOR };
    const sub = s.bot ? 'Ordinateur · niveau moyen' : p ? `Niv. ${levelFor(p.xp ?? 0).level} · ${levelFor(p.xp ?? 0).title}` : '';
    const tag = isHost ? ['Hôte', 'host'] : s.bot ? ['Bot', 'bot'] : ['Prêt', 'ok'];
    const kick = !host ? '' : s.bot ? `<button class="kick" data-toggle="${s.seat}" aria-label="Retirer ${esc(s.name)}" title="La place redevient libre">×</button>`
      : !isHost ? `<button class="kick" data-kick="${esc(s.user_id)}" data-name="${esc(s.name)}" aria-label="Retirer ${esc(s.name)}" title="La place redevient libre">×</button>` : '';
    return `<div class="seatc">${avatarHTML(av, 54, `0 0 0 2px #1b140e,0 0 0 4px ${av.color || BOT_COLOR}`)}
      <span class="sn"><b>${esc(s.name)}${me ? ' (vous)' : ''}</b><span class="lbl">${esc(sub)}</span></span><span class="stag ${tag[1]}">${tag[0]}</span>${kick}</div>`;
  };
  const list = $('#seats', box), html = seats.map(seatRow), keys = seats.map(s => s.user_id ? 'u:' + s.user_id : s.bot ? 'b:' + s.name : 'free');
  html.forEach((h, i) => {
    if (st!.html[i] === h && list.children[i]) return;
    const t = document.createElement('template'); t.innerHTML = h.trim();
    const el = t.content.firstElementChild as HTMLElement;
    if (!first && keys[i] !== 'free' && !st!.keys.includes(keys[i])) el.classList.add('new');
    if (list.children[i]) list.children[i].replaceWith(el); else list.append(el);
  });
  while (list.children.length > seats.length) list.lastElementChild!.remove();
  st.html = html; st.keys = keys;

  // réglages : on ne touche pas au formulaire tant qu'il a le focus ; les invités voient les changements de l'hôte
  const optsBox = $('#optsBox', box), oj = JSON.stringify(g.options ?? null);
  if (oj !== st.opts && !optsBox.contains(document.activeElement)) {
    st.opts = oj; optsBox.innerHTML = optionsHTML(g.options, host, 'lo');
    if (host) wireOptions(box, 'lo', async () => { try { await callGame('lobby', { id: g.id, options: readOptions(box!, 'lo') }); } catch (e: any) { toast(e.message, 'err'); } });
  }
  if (host) {
    ($('#addSeat', box) as HTMLButtonElement).disabled = seats.length >= 9;
    ($('#rmSeat', box) as HTMLButtonElement).disabled = seats.length <= 3;
    $('#freeNote', box).textContent = free ? `${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''} : ${free > 1 ? 'elles seront prises' : 'elle sera prise'} par des bots. ` : '';
  }
}

/** Construit la page du salon (une fois par partie) et branche les boutons ; ils lisent l'état courant dans `live`. */
function build(root: HTMLElement, g: any, host: boolean, sync: () => Promise<void>) {
  const link = inviteLink(g.code);
  root.innerHTML = `<section class="apage salon" id="salon" data-id="${esc(g.id)}">
    <div class="hhead"><div><h1 id="stitle">Salon</h1><p>Invitez votre équipage, réglez la partie, puis levez l'ancre.</p></div>
      ${host ? '' : '<button class="abtn ghost" id="leave">Quitter le salon</button>'}</div>
    <section class="invite2">
      <div class="codebox"><span class="lbl b">Code de la partie</span><span class="cv">${esc(g.code)}</span></div>
      <div class="lnk"><span class="lbl b">Lien d'invitation</span>
        <div class="lrow2"><input id="link" readonly value="${esc(link)}" aria-label="Lien d'invitation"><button class="abtn gold" id="copy">Copier</button></div>
        <div class="lbtns">${'share' in navigator ? '<button class="abtn ghost" id="share">Partager…</button>' : ''}<button class="abtn ghost" id="qr">Afficher le QR code</button></div></div>
    </section>
    <div class="agrid">
      <section class="apanel"><div class="hrow"><h2>Équipage</h2><span id="scount"></span></div>
        <div class="seats2" id="seats"></div>
        ${host ? '<div class="row"><button class="abtn ghost" id="addSeat">Ajouter une place</button><button class="abtn ghost" id="rmSeat">Retirer la dernière place</button></div>' : ''}</section>
      <section class="apanel"><h2>Réglages</h2><div class="form" id="optsBox"></div>
        ${host ? `<div class="launch"><button class="abtn gold big2" id="start">Lever l'ancre · lancer la partie</button>
          <span class="lbl"><span id="freeNote"></span>Seul l'hôte peut lancer. Les places libres restent fermées une fois la partie commencée.</span></div>`
          : '<p class="lbl">L\'hôte lancera la partie quand tout le monde sera là.</p>'}</section>
    </div>
  </section>`;
  const box = $('#salon', root), cur = () => live.get(box)!;

  const copyBtn = $('#copy', box) as HTMLButtonElement;
  copyBtn.onclick = async () => {
    if (await copyText(link)) { copyBtn.textContent = 'Lien copié ✓'; setTimeout(() => { copyBtn.textContent = 'Copier'; }, 1800); }
    else { ($('#link', box) as HTMLInputElement).select(); toast('Sélectionnez le lien pour le copier.'); } // repli : sélection manuelle
  };
  const sh = box.querySelector('#share') as HTMLElement | null;
  if (sh) sh.onclick = () => (navigator as any).share({ title: 'Le Pli des Pirates', text: 'Rejoins ma table !', url: link }).catch(() => { });
  $('#qr', box).onclick = () => modal(`<h2>QR code d'invitation</h2><p class="sub">À scanner avec l'appareil photo d'un téléphone. Code : <b>${esc(g.code)}</b></p><div class="qrbox">${qrSVG(link, 260)}</div>`);
  if (!host) {
    $('#leave', box).onclick = async () => { try { await callGame('leave', { id: g.id }); go('#/'); } catch (e: any) { toast(e.message, 'err'); } };
    return box;
  }
  const types = () => cur().seats.map(s => !!s.bot);
  const push = async (t: boolean[]) => { try { await callGame('lobby', { id: g.id, seats: t.map(bot => ({ bot })) }); await sync(); } catch (e: any) { toast(e.message, 'err'); } };
  // places : délégation (les lignes sont remplacées au fil des synchronisations)
  $('#seats', box).onclick = async ev => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
    if (b.dataset.toggle != null) { const i = Number(b.dataset.toggle), t = types(); t[i] = !t[i]; push(t); return; }
    if (b.dataset.kick == null) return;
    // confirmation légère : un premier clic arme le bouton, un second (dans les 4 s) retire le joueur
    const name = b.dataset.name ?? '';
    if (!b.classList.contains('confirm')) {
      b.classList.add('confirm'); b.textContent = 'Retirer ?'; b.setAttribute('aria-label', `Confirmer : retirer ${name} du salon`);
      setTimeout(() => { if (b.isConnected && !b.disabled) { b.classList.remove('confirm'); b.textContent = '×'; b.setAttribute('aria-label', `Retirer ${name}`); } }, 4000);
      return;
    }
    b.disabled = true;
    try { await callGame('lobby', { id: g.id, kick: b.dataset.kick }); toast(`${name} a quitté le salon : sa place est libre.`); await sync(); }
    catch (e: any) { toast(e.message, 'err'); b.disabled = false; }
  };
  $('#addSeat', box).onclick = () => push([...types(), false]);
  $('#rmSeat', box).onclick = () => { const s = cur().seats, t = types(); if (s[s.length - 1].user_id) { toast('La dernière place est occupée.', 'err'); return; } t.pop(); push(t); };
  $('#start', box).onclick = async () => {
    const b = $('#start', box) as HTMLButtonElement; b.disabled = true; b.textContent = 'Distribution…';
    try { await callGame('start', { id: g.id }); await sync(); } catch (e: any) { toast(e.message, 'err'); b.disabled = false; b.textContent = "Lever l'ancre · lancer la partie"; }
  };
  return box;
}
