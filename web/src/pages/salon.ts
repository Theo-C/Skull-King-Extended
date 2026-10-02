// Salon d'une partie (avant le lancement) : code en grand, lien d'invitation (Copier / Partager / QR code), équipage, réglages,
// « Lever l'ancre » réservé à l'hôte. Maquette Salon. Affiché par la page de partie (#/partie/:id) tant que la partie est en salon ;
// #/salon/CODE y mène aussi.
import { sb, callGame, inviteLink } from '../api';
import { $, esc, toast, copyText, modal } from '../util';
import { optionsHTML, readOptions, wireOptions } from '../options';
import { avatarHTML, fromProfile } from '../avatar';
import { levelFor } from '../xp';
import { qrSVG } from '../qr';
import { go } from '../main';

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
    const { data } = await sb.from('profiles').select('id, pseudo, color, avatar_kind, avatar_art, avatar_url, xp').in('id', miss);
    (data || []).forEach((p: any) => profCache.set(p.id, p));
  }
  return (id: string | null) => id ? profCache.get(id) ?? null : null;
}

export async function renderSalon(root: HTMLElement, g: any, seats: any[], uid: string, sync: () => Promise<void>) {
  const host = g.host === uid, link = inviteLink(g.code);
  // on garde le formulaire tel quel pendant que l'hôte modifie un réglage
  if (host && root.querySelector('#salon') && document.activeElement && root.contains(document.activeElement) && ['SELECT', 'INPUT'].includes((document.activeElement as HTMLElement).tagName)) return;
  const prof = await profilesOf(seats.filter(s => s.user_id).map(s => s.user_id));
  const hostName = seats.find(s => s.user_id === g.host)?.name ?? '?';
  const humans = seats.filter(s => s.user_id).length, free = seats.filter(s => !s.bot && !s.user_id).length;
  const seatRow = (s: any) => {
    if (!s.bot && !s.user_id) return `<div class="seatc empty"><span class="wait"></span><span class="sn">Place libre · en attente d'un pirate</span>
      ${host ? `<button class="abtn ghost sm" data-toggle="${s.seat}">Ajouter un bot</button>` : ''}</div>`;
    const p = prof(s.user_id), me = s.user_id === uid;
    const av = p ? fromProfile(p, s.name) : { letter: s.name, color: '#8d8576' };
    const sub = s.bot ? 'Ordinateur' : p ? `Niv. ${levelFor(p.xp ?? 0).level} · ${levelFor(p.xp ?? 0).title}` : '';
    const tag = s.user_id === g.host ? ['Hôte', 'host'] : s.bot ? ['Bot', 'bot'] : ['Joueur', 'ok'];
    return `<div class="seatc">${avatarHTML(av, 54, `0 0 0 2px #1b140e,0 0 0 4px ${av.color || '#8d8576'}`)}
      <span class="sn"><b>${esc(s.name)}${me ? ' (vous)' : ''}</b><span class="lbl">${esc(sub)}</span></span><span class="stag ${tag[1]}">${tag[0]}</span>
      ${host && s.bot ? `<button class="kick" data-toggle="${s.seat}" aria-label="Retirer ${esc(s.name)} (la place redevient libre)">×</button>` : ''}</div>`;
  };
  root.innerHTML = `<section class="apage salon" id="salon">
    <div class="hhead"><div><h1>Salon ${g.host === uid ? 'de votre table' : `de ${esc(hostName)}`}</h1><p>Invitez votre équipage, réglez la partie, puis levez l'ancre.</p></div>
      ${host ? '' : '<button class="abtn ghost" id="leave">Quitter le salon</button>'}</div>
    <section class="invite2">
      <div class="code"><span class="lbl b">Code de la partie</span><span class="cv">${esc(g.code)}</span></div>
      <div class="lnk"><span class="lbl b">Lien d'invitation</span>
        <div class="lrow2"><input id="link" readonly value="${esc(link)}" aria-label="Lien d'invitation"><button class="abtn gold" id="copy">Copier</button></div>
        <div class="lbtns">${'share' in navigator ? '<button class="abtn ghost" id="share">Partager…</button>' : ''}<button class="abtn ghost" id="qr">Afficher le QR code</button></div></div>
    </section>
    <div class="agrid">
      <section class="apanel"><div class="hrow"><h2>Équipage</h2><span>${humans} joueur${humans > 1 ? 's' : ''} · ${seats.length} places</span></div>
        <div class="seats2">${seats.map(seatRow).join('')}</div>
        ${host ? `<div class="row"><button class="abtn ghost" id="addSeat" ${seats.length >= 9 ? 'disabled' : ''}>Ajouter une place</button><button class="abtn ghost" id="rmSeat" ${seats.length <= 3 ? 'disabled' : ''}>Retirer la dernière place</button></div>` : ''}</section>
      <section class="apanel"><h2>Réglages</h2><div class="form" id="optsBox">${optionsHTML(g.options, host, 'lo')}</div>
        ${host ? `<div class="launch"><button class="abtn gold big2" id="start">Lever l'ancre · lancer la partie</button>
          <span class="lbl">${free ? `${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''} : ${free > 1 ? 'elles seront prises' : 'elle sera prise'} par des bots. ` : ''}Seul l'hôte peut lancer. Les places libres restent fermées une fois la partie commencée.</span></div>`
          : '<p class="lbl">L\'hôte lancera la partie quand tout le monde sera là.</p>'}</section>
    </div>
  </section>`;

  const copyBtn = $('#copy', root) as HTMLButtonElement;
  copyBtn.onclick = async () => {
    if (await copyText(link)) { copyBtn.textContent = 'Lien copié ✓'; setTimeout(() => { copyBtn.textContent = 'Copier'; }, 1800); }
    else { ($('#link', root) as HTMLInputElement).select(); toast('Sélectionnez le lien pour le copier.'); } // repli : sélection manuelle
  };
  const sh = root.querySelector('#share') as HTMLElement | null;
  if (sh) sh.onclick = () => (navigator as any).share({ title: 'Le Pli des Pirates', text: 'Rejoins ma table !', url: link }).catch(() => { });
  $('#qr', root).onclick = () => modal(`<h2>QR code d'invitation</h2><p class="sub">À scanner avec l'appareil photo d'un téléphone. Code : <b>${esc(g.code)}</b></p><div class="qrbox">${qrSVG(link, 260)}</div>`);
  if (host) {
    wireOptions(root, 'lo', async () => { try { await callGame('lobby', { id: g.id, options: readOptions(root, 'lo') }); } catch (e: any) { toast(e.message, 'err'); } });
    const types = seats.map(s => !!s.bot);
    const push = async (t: boolean[]) => { try { await callGame('lobby', { id: g.id, seats: t.map(bot => ({ bot })) }); await sync(); } catch (e: any) { toast(e.message, 'err'); } };
    root.querySelectorAll<HTMLElement>('[data-toggle]').forEach(b => b.onclick = () => { const i = Number(b.dataset.toggle); const t = types.slice(); t[i] = !t[i]; push(t); });
    $('#addSeat', root).onclick = () => push([...types, false]);
    $('#rmSeat', root).onclick = () => { const t = types.slice(); if (seats[seats.length - 1].user_id) { toast('La dernière place est occupée.', 'err'); return; } t.pop(); push(t); };
    $('#start', root).onclick = async () => {
      const b = $('#start', root) as HTMLButtonElement; b.disabled = true; b.textContent = 'Distribution…';
      try { await callGame('start', { id: g.id }); await sync(); } catch (e: any) { toast(e.message, 'err'); b.disabled = false; b.textContent = "Lever l'ancre · lancer la partie"; }
    };
  } else {
    $('#leave', root).onclick = async () => { try { await callGame('leave', { id: g.id }); go('#/'); } catch (e: any) { toast(e.message, 'err'); } };
  }
}
