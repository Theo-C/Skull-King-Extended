// Page d'invitation : #/rejoindre/CODE. S'il reste une place, on la prend tout de suite et l'on arrive dans le salon ;
// la page (avec « Prendre place ») ne s'affiche que si la partie a commencé, est complète, ou si la prise de place a échoué.
import { callGame } from '../api';
import { $, esc, toast, de } from '../util';
import { optionsSummary } from '../options';
import { go } from '../main';

export async function joinPage(root: HTMLElement, code: string) {
  root.innerHTML = `<section class="page narrow"><div class="box"><p class="muted">Recherche de la partie ${esc(code)}…</p></div></section>`;
  let pv: any;
  try { pv = await callGame('preview', { code }); }
  catch (e: any) { root.innerHTML = `<section class="page narrow"><div class="box"><h1>Invitation introuvable</h1><p class="lead">${esc(e.message)}</p><a class="btn alt" href="#/">Retour à l'accueil</a></div></section>`; return; }
  if (pv.member) { go('#/partie/' + pv.id); return; }
  const free = pv.seats.filter((s: any) => !s.bot && !s.taken).length;
  const canJoin = pv.status === 'lobby' && free > 0;
  if (canJoin) {
    root.innerHTML = `<section class="page narrow"><div class="box"><p class="muted">Vous prenez place à la table ${esc(de(pv.host))}…</p></div></section>`;
    try { const r = await callGame<{ id: string }>('join', { code }); go('#/partie/' + r.id); return; }
    catch (e: any) { toast(e.message, 'err'); } // repli : la page d'invitation avec son bouton
  }
  root.innerHTML = `<section class="page narrow"><div class="box">
    <p class="eyebrow">Invitation · ${esc(pv.code)}</p>
    <h1>${esc(pv.host)} vous invite à sa table</h1>
    <ul class="seatview">${pv.seats.map((s: any) => `<li class="${s.taken || s.bot ? '' : 'free'}"><span>${s.seat + 1}</span>${s.bot ? `${esc(s.name)} <small>bot</small>` : s.taken ? esc(s.name) : '<i>place libre</i>'}</li>`).join('')}</ul>
    <p class="muted small">${esc(optionsSummary(pv.options))}</p>
    ${canJoin ? '<button class="btn gold big" id="join">Prendre place</button>' : `<p class="lead">${pv.status !== 'lobby' ? 'Cette partie a déjà commencé.' : 'Toutes les places sont prises.'}</p><a class="btn alt" href="#/">Retour à l'accueil</a>`}
  </div></section>`;
  if (canJoin) $('#join', root).onclick = async () => {
    const b = $('#join', root) as HTMLButtonElement; b.disabled = true;
    try { const r = await callGame<{ id: string }>('join', { code }); go('#/partie/' + r.id); }
    catch (e: any) { toast(e.message, 'err'); b.disabled = false; }
  };
}
