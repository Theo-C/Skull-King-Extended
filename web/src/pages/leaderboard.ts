// Classement (#/classement?s=friends&p=month) : trié par Élo. Entre amis / Tous, Semaine / Mois / Toujours (change la dernière colonne).
// Podium, tableau accessible, ligne du joueur surlignée et ajoutée en bas s'il est hors du top 50. Maquette Classement.
import { sb } from '../api';
import { $, esc, signed } from '../util';
import { avatarHTML, fromProfile } from '../avatar';
import { levelFor, fmt } from '../xp';

const SCOPES: [string, string][] = [['friends', 'Entre amis'], ['all', 'Tous']];
const PERIODS: [string, string][] = [['week', 'Semaine'], ['month', 'Mois'], ['ever', 'Toujours']];
const LAST: Record<string, string> = { week: 'Élo sur 7 jours', month: 'Élo sur 30 jours', ever: 'Record' };
const TOP = 50;

export async function leaderboardPage(root: HTMLElement, uid: string, q: URLSearchParams) {
  const scope = SCOPES.some(x => x[0] === q.get('s')) ? q.get('s')! : 'friends';
  const period = PERIODS.some(x => x[0] === q.get('p')) ? q.get('p')! : 'month';
  const setQ = (k: string, v: string) => { location.hash = '#/classement?' + new URLSearchParams({ s: scope, p: period, [k]: v }).toString(); };
  const seg = (key: string, list: [string, string][], cur: string, label: string) =>
    `<div class="seg" role="group" aria-label="${label}">${list.map(([k, l]) => `<button class="sb ${k === cur ? 'on' : ''}" data-k="${key}" data-v="${k}" aria-pressed="${k === cur}">${l}</button>`).join('')}</div>`;
  root.innerHTML = `<section class="apage board">
    <div class="hhead"><div><h1>Classement</h1><p>Classé à l'Élo : tout le monde part de 100, on gagne en finissant devant des joueurs mieux classés.</p></div>
      <div class="segs">${seg('s', SCOPES, scope, 'Qui')}${seg('p', PERIODS, period, 'Période')}</div></div>
    <section class="podium lb" id="podium"></section>
    <section class="apanel ltab"><div class="tscroll" id="lb"><p class="empty">Chargement…</p></div><div class="lbl gapnote" id="gap"></div></section>
  </section>`;
  root.querySelectorAll<HTMLElement>('.sb').forEach(b => b.onclick = () => setQ(b.dataset.k!, b.dataset.v!));

  const { data, error } = await sb.rpc('leaderboard_period', { scope, period });
  if (error) { $('#lb', root).innerHTML = '<p class="empty">Classement indisponible pour le moment.</p>'; $('#podium', root).hidden = true; return; }
  const all = (data || []) as any[];
  const meIdx = all.findIndex(r => r.user_id === uid);
  const rows = all.slice(0, TOP);
  let extra: any = null;
  if (meIdx >= TOP) extra = all[meIdx];
  else if (meIdx < 0 && scope === 'all') {
    // pas encore classé chez « Tous » (moins de 5 parties classées, ou profil masqué) : on montre quand même sa ligne
    const [{ data: st }, { data: pr }] = await Promise.all([
      sb.from('player_stats').select('*').eq('user_id', uid).maybeSingle(),
      sb.from('profiles').select('pseudo, color, avatar_kind, avatar_art, avatar_url, xp, public_rank').eq('id', uid).maybeSingle(),
    ]);
    if (pr) extra = { rank: null, user_id: uid, ...pr, elo: Math.round(Number(st?.elo ?? 100)), games: st?.games ?? 0, wins: st?.wins ?? 0,
      bids_pct: st?.bids_total ? Math.round(100 * st.bids_made / st.bids_total) : null, best_score: st?.best_score ?? null, delta: period === 'ever' ? st?.elo_best ?? 100 : null,
      why: pr.public_rank === false ? 'profil masqué du classement public' : `${Math.max(0, 5 - (st?.ranked_games ?? 0))} partie(s) classée(s) avant d'apparaître` };
  }

  const MB = ['s1', 's2', 's3'], H = [170, 125, 95], ORD = [2, 1, 3];
  $('#podium', root).innerHTML = rows.slice(0, 3).map((r, i) => {
    const lv = levelFor(r.xp ?? 0);
    return `<div class="pod2 lbp" style="order:${ORD[i]}">${avatarHTML(fromProfile(r), i ? 68 : 84, `0 0 0 3px #1b140e,0 0 0 5px ${r.color}`)}
      <b>${esc(r.pseudo)}${r.user_id === uid ? ' (vous)' : ''}</b><span class="lbl">${esc(lv.title)}</span>
      <div class="step ${MB[i]}" style="height:${H[i]}px"><span class="n">${r.rank}</span><span class="m">Élo ${fmt(r.elo)} · ${r.wins} victoire${r.wins > 1 ? 's' : ''}</span></div></div>`;
  }).join('');
  $('#podium', root).hidden = rows.length === 0;

  const line = (r: any) => {
    const me = r.user_id === uid, lv = levelFor(r.xp ?? 0), d = r.delta == null ? null : Number(r.delta);
    const last = period === 'ever' ? (d == null ? '—' : fmt(d)) : d == null ? '—' : signed(d);
    return `<tr class="${me ? 'me' : ''}"${me ? ' aria-current="true"' : ''}><td class="l rk">${r.rank ?? '—'}</td>
      <td class="l"><span class="who">${avatarHTML(fromProfile(r), 34)}<span><b>${esc(r.pseudo)}${me ? ' (vous)' : ''}</b><span class="lbl">${r.why ? esc(r.why) : `Niv. ${lv.level} · ${esc(lv.title)}`}</span></span></span></td>
      <td class="elo">${fmt(r.elo)}</td><td>${r.games}</td><td>${r.wins}</td><td>${r.bids_pct == null ? '—' : r.bids_pct + ' %'}</td><td>${r.best_score ?? '—'}</td>
      <td class="last ${period !== 'ever' && d ? (d > 0 ? 'pos' : 'neg') : ''}">${last}</td></tr>`;
  };
  $('#lb', root).innerHTML = rows.length || extra ? `<table class="lbtab"><caption class="sr">Classement ${scope === 'friends' ? 'entre amis' : 'de tous les joueurs'}, trié par Élo</caption>
    <thead><tr><th class="l" scope="col">#</th><th class="l" scope="col">Pirate</th><th scope="col">Élo</th><th scope="col">Parties</th><th scope="col">Victoires</th><th scope="col">Mises tenues</th><th scope="col">Meilleur score</th><th scope="col">${LAST[period]}</th></tr></thead>
    <tbody>${rows.map(line).join('')}${extra ? `<tr class="sep" aria-hidden="true"><td colspan="8">…</td></tr>${line(extra)}` : ''}</tbody></table>`
    : `<p class="empty">${scope === 'friends' ? 'Jouez une partie en ligne avec des amis pour les retrouver ici.' : 'Personne n\'a encore 5 parties classées.'}</p>`;
  if (all.length > TOP) {
    const place = meIdx >= 0 ? all[meIdx].rank : null;
    $('#gap', root).innerHTML = `… ${fmt(all.length - TOP)} autres pirates classés.${place ? ` Votre place : <b>#${place}</b> (top ${Math.max(1, Math.round(100 * place / all.length))} %).` : ''}`;
  }
}
