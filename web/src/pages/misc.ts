// Entraînement hors ligne.
import { $, esc } from '../util';
import * as E from '@engine';
import { TableView } from '../table';
import { optionsHTML, readOptions, wireOptions, paintRanked } from '../options';
import { go, setCleanup } from '../main';
import { sb } from '../api';

export function practicePage(root: HTMLElement) {
  root.innerHTML = `<section class="page narrow"><div class="box">
    <h1>Entraînement</h1><p class="lead">Une partie hors ligne contre des bots, sans compte. Rien n'est enregistré.</p>
    <div class="form"><label class="inline">Nombre de joueurs <select id="n">${[3, 4, 5, 6, 7, 8, 9].map(n => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>${optionsHTML(E.DEFAULT_OPTS, true, 'pr')}</div>
    <div class="foot"><button class="btn gold big" id="go">Lever l'ancre</button></div></div></section>`;
  wireOptions(root, 'pr'); paintRanked(root, 'pr', 'practice');
  $('#go', root).onclick = () => {
    const n = Number(($('#n', root) as HTMLSelectElement).value);
    const S = E.newGame(Array.from({ length: n }, (_, i) => ({ name: i === 0 ? 'Vous' : E.BOT_NAMES[i - 1], bot: i > 0 })), readOptions(root, 'pr'));
    E.runBots(S);
    root.innerHTML = '<div class="tablepage"></div>'; document.body.classList.add('at-table');
    const view = new TableView(root.firstElementChild as HTMLElement, 0, {
      send: async move => {
        try { E.apply(S, 0, move); } catch (e: any) { throw new Error(e.message); }
        E.runBots(S); view.push(E.takeEvents(S)); view.setLatest(E.publicView(S), E.privateView(S, 0));
      },
    }, () => go('#/'));
    view.push(E.takeEvents(S)); view.setLatest(E.publicView(S), E.privateView(S, 0));
    // connecté : vos cartes animées s'animent aussi à l'entraînement (siège 0)
    sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user.id; if (!u) return;
      const { data: ca } = await sb.rpc('cartes_animees', { p_users: [u] });
      if (ca?.length) view.setAnimCards([new Set((ca as any[]).map(r => r.carte as string))]);
    }).catch(() => { /* hors ligne : images fixes */ });
    // accès de débogage (tests de bout en bout) : en développement, ou si localStorage « pli-debug » vaut « 1 »
    let dbg = import.meta.env.DEV; try { dbg ||= localStorage.getItem('pli-debug') === '1'; } catch { /* stockage indisponible */ }
    if (dbg) (window as any).__practice = { S, view, E };
    setCleanup(() => { view.destroy(); document.body.classList.remove('at-table'); });
  };
}
