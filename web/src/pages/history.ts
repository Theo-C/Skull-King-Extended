// Historique (#/historique?f=wins&p=30) : résumé de la période, filtres, parties regroupées par mois, pagination par curseur.
// Maquette Historique.
import { sb, callGame } from '../api';
import { $, esc, relDay, signed } from '../util';
import { avatarHTML, fromProfile } from '../avatar';
import { fmt } from '../xp';

const FILTERS: [string, string][] = [['all', 'Toutes'], ['wins', 'Victoires'], ['ext', 'Avec extension'], ['base', 'Règles de base']];
const PERIODS: [string, string][] = [['30', '30 derniers jours'], ['year', 'Cette année'], ['ever', 'Depuis toujours']];
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="#a8987f" stroke-width="2"/></svg>';

/** « Extension complète », « Extension · variante Lazare » ou « Règles de base ». */
export function modeLabel(o: any) {
  if (!o?.exp) return o?.score === 'rascal' ? 'Règles de base · variante Lazare' : 'Règles de base';
  return o.score === 'rascal' ? 'Extension · variante Lazare' : 'Extension complète';
}
const when = (iso: string) => `${relDay(iso)} · ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}`;

export async function historyPage(root: HTMLElement, uid: string, q: URLSearchParams) {
  const f = FILTERS.some(x => x[0] === q.get('f')) ? q.get('f')! : 'all';
  const per = PERIODS.some(x => x[0] === q.get('p')) ? q.get('p')! : '30';
  const setQ = (k: string, v: string) => { const n = new URLSearchParams({ f, p: per, [k]: v }); location.hash = '#/historique?' + n.toString(); };
  root.innerHTML = `<section class="apage hist">
    <div class="hhead"><div><h1>Journal de bord</h1><p>Toutes vos parties terminées, de la plus récente à la plus ancienne.</p></div>
      <label class="persel"><span class="lbl b">Période</span><select id="per" class="sel">${PERIODS.map(([k, l]) => `<option value="${k}" ${k === per ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <div class="sums" id="sums"><p class="empty">Chargement…</p></div>
    <div class="chips" role="group" aria-label="Filtrer">${FILTERS.map(([k, l]) => `<button class="chip ${k === f ? 'on' : ''}" data-f="${k}" aria-pressed="${k === f}">${l}</button>`).join('')}</div>
    <div id="list"></div>
    <div class="empty-box" id="none" hidden>Aucune partie pour ce filtre.</div>
    <button class="abtn ghost more" id="more" hidden>Voir les parties plus anciennes</button>
  </section>`;
  ($('#per', root) as HTMLSelectElement).onchange = ev => setQ('p', (ev.target as HTMLSelectElement).value);
  root.querySelectorAll<HTMLElement>('[data-f]').forEach(b => b.onclick = () => setQ('f', b.dataset.f!));
  summary(root, uid, per);

  // pages de 20 parties, regroupées par mois (un mois coupé entre deux pages continue dans la même section)
  const list = $('#list', root), more = $('#more', root) as HTMLButtonElement;
  let cursor: string | null = null, lastMonth = '', section: HTMLElement | null = null, total = 0;
  const load = async () => {
    more.disabled = true; more.textContent = 'Chargement…';
    try {
      const r = await callGame<{ items: any[]; next: string | null }>('history.list', { filter: f, before: cursor });
      for (const g of r.items) {
        const d = new Date(g.finished_at), m = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        if (m !== lastMonth) {
          lastMonth = m; section = document.createElement('section'); section.className = 'month';
          section.innerHTML = `<h2>${esc(m[0].toUpperCase() + m.slice(1))} <span class="lbl" data-n="0"></span></h2>`; list.append(section);
        }
        section!.insertAdjacentHTML('beforeend', row(g, uid));
        const n = section!.querySelector('[data-n]') as HTMLElement, c = Number(n.dataset.n) + 1; n.dataset.n = String(c); n.textContent = `· ${c} partie${c > 1 ? 's' : ''}`;
      }
      total += r.items.length; cursor = r.next;
      $('#none', root).hidden = total > 0; more.hidden = !cursor;
    } catch (e: any) { list.insertAdjacentHTML('beforeend', `<p class="empty">${esc(e.message || 'Historique indisponible.')}</p>`); more.hidden = true; }
    more.disabled = false; more.textContent = 'Voir les parties plus anciennes';
  };
  more.onclick = load;
  await load();
}

function row(g: any, uid: string) {
  const others = (g.seats || []).filter((s: any) => s.user_id !== uid);
  const names = others.map((s: any) => s.name);
  const vs = names.length ? 'avec ' + (names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1]) : '';
  const title = g.hosted ? 'Votre table' : g.host_name ? `Table de ${g.host_name}` : `Partie ${g.code}`;
  const e = g.elo_delta == null ? null : Number(g.elo_delta);
  return `<a class="hrow2" href="#/partie/${g.id}">
    <span class="hmed m${Math.min(g.place, 4)}">${g.place}</span>
    <span class="hmid"><span class="ht">${esc(title)}</span><span class="lbl">${esc(when(g.finished_at))} · ${esc(modeLabel(g.options ?? { exp: g.ext }))}</span></span>
    <span class="opp"><span class="stack-av">${others.slice(0, 4).map((s: any) => avatarHTML(s.user_id ? fromProfile({ ...s, pseudo: s.name }) : { letter: s.name }, 32)).join('')}</span><span class="lbl">${esc(vs)}</span></span>
    <span class="hend"><span class="hsc"><b class="${g.score < 0 ? 'neg' : ''}">${g.score}</b><span class="lbl">${g.bids_made}/${g.rounds} mises tenues</span></span>
      ${g.xp ? `<span class="xpchip">+${fmt(g.xp)} XP</span>` : ''}
      ${e == null ? '<span class="elochip">non classée</span>' : `<span class="elochip ${e >= 0 ? 'up' : 'down'}">Élo ${signed(e)}</span>`}${CHEVRON}</span>
  </a>`;
}

/** Résumé de la période : parties, victoires, mises tenues, XP gagnée, Élo et sa variation. */
async function summary(root: HTMLElement, uid: string, per: string) {
  const since = per === 'ever' ? null : per === 'year' ? new Date(new Date().getFullYear(), 0, 1).toISOString() : new Date(Date.now() - 30 * 86400000).toISOString();
  let qr = sb.from('game_results').select('place, bids_made, rounds, elo_delta').eq('user_id', uid);
  let qx = sb.from('xp_events').select('amount').eq('user_id', uid);
  if (since) { qr = qr.gte('finished_at', since); qx = qx.gte('created_at', since); }
  const [r, x, s] = await Promise.all([qr, qx, sb.from('player_stats').select('elo').eq('user_id', uid).maybeSingle()]);
  if (r.error) { $('#sums', root).innerHTML = '<p class="empty">Résumé indisponible.</p>'; return; }
  const rows = r.data || [], made = rows.reduce((a, g: any) => a + g.bids_made, 0), tot = rows.reduce((a, g: any) => a + g.rounds, 0);
  const xp = (x.data || []).reduce((a, e: any) => a + e.amount, 0), d = rows.reduce((a, g: any) => a + Number(g.elo_delta || 0), 0);
  const label = per === '30' ? 'ce mois-ci' : per === 'year' ? 'cette année' : 'au total';
  const elo = Math.round(Number(s.data?.elo ?? 100));
  $('#sums', root).innerHTML = [
    [String(rows.length), `partie${rows.length > 1 ? 's' : ''} ${label}`], [String(rows.filter((g: any) => g.place === 1).length), 'victoires'],
    [tot ? Math.round(100 * made / tot) + ' %' : '—', 'mises tenues'], [(xp ? '+' : '') + fmt(xp), 'XP gagnée'],
    [String(elo), `Élo${per === 'ever' ? '' : ` · ${signed(d)} ${label}`}`],
  ].map(([v, l]) => `<div class="sum"><span class="big">${esc(v)}</span><span class="lbl">${esc(l)}</span></div>`).join('');
}
