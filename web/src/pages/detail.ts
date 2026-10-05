// Détail d'une partie terminée (#/partie/:id) : podium + Élo, courbe des scores cumulés, XP gagnée, temps forts,
// tableau manche par manche, revanche. Maquette DetailPartie. Données : action « history.get » (refusée à qui n'a pas joué).
import { callGame } from '../api';
import { $, esc, toast, signed, copyText } from '../util';
import { avatarHTML, fromProfile, PALETTE } from '../avatar';
import { xpLine, fmt, xpReason, levelFor } from '../xp';
import { myProfile } from '../account';
import { modeLabel, de, HIST_BACK } from './history';
import { go } from '../main';

/** Durée d'une partie : « 52 min », « 1 h 05 ». */
function duration(a?: string, b?: string) {
  const m = a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60000) : NaN;
  if (!(m > 0) || m > 24 * 60) return '';
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

export async function detailPage(root: HTMLElement, id: string, uid: string) {
  // retour vers l'historique avec ses filtres (mémorisés par la page Historique)
  let back = '#/historique';
  try { const h = sessionStorage.getItem(HIST_BACK); if (h && h.startsWith('#/historique')) back = h; } catch { /* stockage indisponible */ }
  root.innerHTML = '<section class="apage"><p class="empty">Chargement de la partie…</p></section>';
  let d: any;
  try { d = await callGame('history.get', { id }); }
  catch (e: any) { root.innerHTML = `<section class="apage"><div class="apanel"><h2>Partie inaccessible</h2><p class="empty">${esc(e.message)}</p><a class="more" href="${esc(back)}">Retour au journal de bord</a></div></section>`; return; }
  const st = d.state || {}, ps: any[] = st.players || [];
  const seats: any[] = (d.seats || []).slice().sort((a: any, b: any) => a.seat - b.seat);
  const color = (i: number) => seats[i]?.color || PALETTE[i % PALETTE.length];
  const meSeat = seats.findIndex(s => s.user_id === uid);
  const nameOf = (i: number) => (ps[i]?.name ?? seats[i]?.name ?? '?') + (i === meSeat ? ' (vous)' : '');
  const res = (i: number) => (d.results || []).find((r: any) => r.user_id && r.user_id === seats[i]?.user_id);
  const hostName = seats.find(s => s.user_id === d.host)?.name;
  const fin = d.finished_at ? new Date(d.finished_at) : null;
  const dateTxt = fin ? fin.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase()).replace(/ 1 /, ' 1er ') + ' · ' + fin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ') : '';
  const rounds = ps[0]?.hist?.length ?? 0;
  const title = hostName ? `Table ${de(hostName)}` : `Partie ${d.code}`;

  // podium : du 1er au dernier, ordre visuel 2-1-3-4
  const order = ps.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score);
  const H = [214, 170, 132, 104], ORD = [2, 1, 3, 4];
  const podium = order.map(({ p, i }, k) => {
    const r = res(i), rank = 1 + order.filter(o => o.p.score > p.score).length, made = (p.hist || []).filter((h: any) => h.bid === h.won).length;
    const av = seats[i]?.user_id ? fromProfile({ ...seats[i], pseudo: p.name }) : { letter: p.name, color: color(i) };
    return `<div class="pod2" style="order:${ORD[k] ?? k + 1}">${avatarHTML({ ...av, color: color(i) }, k === 0 ? 84 : 68, `0 0 0 3px #1b140e,0 0 0 5px ${color(i)}`)}
      <b>${esc(nameOf(i))}</b><span class="tot">${p.score}</span>
      <div class="step s${Math.min(rank, 4)}" style="height:${H[Math.min(k, 3)]}px"><span class="n">${rank}</span><span class="m">${made} mise${made > 1 ? 's' : ''} tenue${made > 1 ? 's' : ''}</span>
        ${r && r.elo_delta != null ? `<span class="e ${Number(r.elo_delta) >= 0 ? 'up' : 'down'}">Élo ${Math.round(Number(r.elo_after))} (${signed(Number(r.elo_delta))})</span>` : ''}</div></div>`;
  }).join('');

  root.innerHTML = `<section class="apage detail">
    <a class="back" href="${esc(back)}">‹ Journal de bord</a>
    <div class="dhead"><div><h1>${esc(title)}</h1><div class="dsub">${esc([dateTxt, `${ps.length} joueurs`, `${rounds} manches`, modeLabel(d.options).toLowerCase(), duration(d.created_at, d.finished_at)].filter(Boolean).join(' · '))}</div></div>
      <div class="dacts"><button class="abtn ghost" id="share">Partager le résultat</button><button class="abtn gold" id="rematch">Revanche avec la même table</button></div></div>
    <section class="podium">${podium}</section>
    <div class="agrid">
      <section class="apanel span2"><div class="hrow hwrap"><h2>Évolution des scores</h2><div class="legend" id="legend"></div></div><div id="chart"></div><span class="lbl" id="caption"></span></section>
      <section class="apanel"><h2>XP gagnée</h2><div id="xp"></div></section>
      <section class="apanel"><h2>Temps forts</h2><div id="moments"></div></section>
      <section class="apanel span2"><div class="hrow"><h2>Manche par manche</h2><span>mise / plis · points (bonus compris)</span></div><div class="tscroll" id="rtable"></div></section>
    </div>
  </section>`;

  // courbe : une ligne par joueur, la vôtre plus épaisse, ligne du zéro mise en valeur, légende cliquable
  const hidden = new Set<number>();
  const drawChart = () => {
    const cum = ps.map(p => { let s = 0; return [0, ...(p.hist || []).map((h: any) => (s += h.tot))]; });
    const all = cum.flat(), lo = Math.floor(Math.min(0, ...all) / 50) * 50, hi = Math.max(lo + 50, Math.ceil(Math.max(...all) / 50) * 50);
    const X = (r: number) => 48 + r * 696 / Math.max(1, rounds), Y = (v: number) => 270 - (v - lo) * 254 / (hi - lo);
    let g = ''; for (let v = lo; v <= hi; v += 50) g += `<line x1="48" x2="744" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 ? 'rgba(234,208,138,.45)' : 'rgba(234,208,138,.1)'}" stroke-width="${v === 0 ? 1.5 : 1}"/><text x="40" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`;
    for (let r = 1; r <= rounds; r++) g += `<text x="${X(r).toFixed(1)}" y="292" text-anchor="middle">${r}</text>`;
    const lines = cum.map((c, i) => hidden.has(i) ? '' : `<path d="M${c.map((v, r) => `${X(r).toFixed(1)} ${Y(v).toFixed(1)}`).join(' L')}" fill="none" stroke="${color(i)}" stroke-width="${i === meSeat ? 4 : 2.5}" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${X(rounds).toFixed(1)}" cy="${Y(c[c.length - 1]).toFixed(1)}" r="${i === meSeat ? 5 : 4}" fill="${color(i)}" stroke="#1f1813" stroke-width="1.5"><title>${esc(nameOf(i))} : ${c[c.length - 1]}</title></circle>`).join('');
    $('#chart', root).innerHTML = `<svg class="schart" viewBox="0 0 760 300" role="img" aria-label="Score cumulé de chaque joueur, manche par manche">${g}${lines}</svg>`;
  };
  drawChart();
  // légende : on bascule seulement la classe et aria-pressed (le bouton garde le focus), puis on redessine la courbe
  $('#legend', root).innerHTML = ps.map((p, i) => `<button class="lg" data-i="${i}" aria-pressed="true"><span style="background:${color(i)}"></span>${esc(nameOf(i))}</button>`).join('');
  root.querySelectorAll<HTMLElement>('.lg').forEach(b => b.onclick = () => {
    const i = Number(b.dataset.i), off = !hidden.has(i); if (off) hidden.add(i); else hidden.delete(i);
    b.classList.toggle('off', off); b.setAttribute('aria-pressed', String(!off)); drawChart();
  });
  // légende de la courbe : la manche qui a le plus compté pour vous
  if (meSeat >= 0 && ps[meSeat]?.hist?.length) {
    const h = ps[meSeat].hist.reduce((a: any, b: any) => Math.abs(b.tot) > Math.abs(a.tot) ? b : a);
    $('#caption', root).textContent = `Manche ${h.r} : votre mise de ${h.bid} ${h.bid === h.won ? 'tenue' : 'ratée'} vous rapporte ${signed(h.tot)} points, votre plus gros écart de la partie.`;
  }

  // XP gagnée et barre de niveau
  const lines = (d.xp || []) as { reason: string; amount: number }[], total = lines.reduce((a, x) => a + x.amount, 0);
  // barre : XP avant / après cette partie (state.settled), à défaut l'XP actuelle du profil
  const set = st.settled?.[uid];
  const after = set?.xpAfter != null ? Number(set.xpAfter) : (await myProfile(uid))?.xp ?? 0;
  const lv = xpLine(after), gained = Math.max(0, Math.min(set?.xpBefore != null ? after - Number(set.xpBefore) : total, lv.inLevel));
  const up = set?.xpBefore != null && levelFor(Number(set.xpBefore)).level < lv.level;
  $('#xp', root).innerHTML = lines.length ? `${lines.map(x => `<div class="xl"><span>${esc(xpReason(x.reason, x.amount))}</span><b>+${fmt(x.amount)}</b></div>`).join('')}
    <div class="xtot"><b>Total</b><b class="big">+${fmt(total)} XP</b></div>
    <div class="xpbar2"><span style="width:${Math.round(100 * (lv.inLevel - gained) / lv.need)}%"></span><span class="gain" style="width:${Math.round(100 * gained / lv.need)}%"></span></div>
    <span class="lbl">Niveau ${lv.level} · ${lv.text} XP${up ? ' · niveau gagné avec cette partie' : ''}</span>` : '<p class="empty">Pas d\'XP pour cette partie (vous n\'y étiez pas, ou elle n\'est pas encore réglée).</p>';

  // temps forts : les plus gros bonus de la partie, et les mises de 0 tenues avec beaucoup de cartes
  const moments: { r: number; t: string; d: string; v: number }[] = [];
  ps.forEach((p, i) => (p.hist || []).forEach((h: any) => {
    for (const [pts, label] of h.items || []) if (Math.abs(pts) >= 20) moments.push({ r: h.r, t: `${label}`, d: `${nameOf(i)} · ${pts < 0 ? 'malus' : 'bonus'} ${signed(pts)}`, v: Math.abs(pts) });
    if (h.bid === 0 && h.won === 0 && h.cards >= 5) moments.push({ r: h.r, t: `Mise de 0 tenue par ${nameOf(i)}`, d: `${h.cards} cartes en main · ${signed(h.base)}`, v: h.base });
  }));
  moments.sort((a, b) => b.v - a.v || b.r - a.r);
  $('#moments', root).innerHTML = moments.slice(0, 4).sort((a, b) => b.r - a.r).map(m => `<div class="mom"><span class="mr">M${m.r}</span><span><b>${esc(m.t)}</b><span class="lbl">${esc(m.d)}</span></span></div>`).join('')
    || '<p class="empty">Une partie sans éclat particulier.</p>';

  // tableau manche par manche
  $('#rtable', root).innerHTML = `<table class="rtab"><thead><tr><th scope="col" class="l">Manche</th>${ps.map((p, i) => `<th scope="col"><span class="dot" style="background:${color(i)}"></span>${esc(nameOf(i))}</th>`).join('')}</tr></thead><tbody>
    ${Array.from({ length: rounds }, (_, k) => `<tr><td class="l r">${k + 1}</td>${ps.map(p => { const h = p.hist[k]; return `<td><span class="bw">${h.bid}/${h.won}</span> · <b class="${h.bid === h.won ? 'ok' : 'ko'}">${signed(h.tot)}</b></td>`; }).join('')}</tr>`).join('')}
    <tr class="tt"><td class="l">Total</td>${ps.map(p => `<td>${p.score}</td>`).join('')}</tr></tbody></table>`;

  // partager / revanche
  $('#share', root).onclick = async () => {
    const txt = `${title} · ${order.map(({ p }, k) => `${k + 1}. ${p.name} ${p.score}`).join(' · ')}`;
    if ((navigator as any).share) { (navigator as any).share({ title: 'Skull King Extended', text: txt }).catch(() => { }); return; }
    if (await copyText(txt)) toast('Résultat copié.'); else toast(txt);
  };
  $('#rematch', root).onclick = async () => {
    const b = $('#rematch', root) as HTMLButtonElement; b.disabled = true; b.textContent = 'Préparation du salon…';
    try { const r = await callGame<{ id: string }>('rematch', { id }); go('#/partie/' + r.id); }
    catch (e: any) { toast(e.message, 'err'); b.disabled = false; b.textContent = 'Revanche avec la même table'; }
  };
}
