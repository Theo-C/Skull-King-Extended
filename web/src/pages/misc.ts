// Classement et entraînement hors ligne.
import { sb } from '../api';
import { $, esc } from '../util';
import * as E from '@engine';
import { TableView } from '../table';
import { optionsHTML, readOptions, wireOptions } from '../options';
import { go, setCleanup } from '../main';

export async function leaderboardPage(root: HTMLElement, uid: string | null) {
  root.innerHTML = `<section class="page"><div class="hero"><div><h1>Classement</h1><p class="lead">Toutes les parties terminées entre joueurs inscrits.</p></div></div><div class="box"><div class="scroll" id="lb"><p class="muted">Chargement…</p></div></div></section>`;
  const { data, error } = await sb.from('leaderboard').select('*').order('wins', { ascending: false }).order('avg_score', { ascending: false }).limit(100);
  if (error) { $('#lb', root).innerHTML = '<p class="muted">Impossible de charger le classement.</p>'; return; }
  if (!data?.length) { $('#lb', root).innerHTML = '<p class="muted">Aucune partie terminée pour l’instant. Le classement se remplira à la fin de vos premières parties.</p>'; return; }
  $('#lb', root).innerHTML = `<table class="lbt"><thead><tr><th>#</th><th class="l">Pirate</th><th>Parties</th><th>Victoires</th><th>% victoires</th><th>Score moyen</th><th>Meilleur score</th></tr></thead><tbody>${data.map((r: any, i: number) => `<tr class="${r.user_id === uid ? 'me' : ''}"><td>${i + 1}</td><td class="l">${esc(r.pseudo)}</td><td>${r.games}</td><td><b>${r.wins}</b></td><td>${Math.round(100 * r.wins / Math.max(1, r.games))} %</td><td>${r.avg_score}</td><td>${r.best_score}</td></tr>`).join('')}</tbody></table>`;
}

export function practicePage(root: HTMLElement) {
  root.innerHTML = `<section class="page narrow"><div class="box">
    <h1>Entraînement</h1><p class="lead">Une partie hors ligne contre des bots, sans compte. Rien n'est enregistré.</p>
    <div class="form"><label class="inline">Nombre de joueurs <select id="n">${[3, 4, 5, 6, 7, 8, 9].map(n => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>${optionsHTML(E.DEFAULT_OPTS, true, 'pr')}</div>
    <div class="foot"><button class="btn gold big" id="go">Lever l'ancre</button></div></div></section>`;
  wireOptions(root, 'pr');
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
    (window as any).__practice = { S, view, E }; // accès de débogage (tests de bout en bout)
    setCleanup(() => { view.destroy(); document.body.classList.remove('at-table'); });
  };
}
