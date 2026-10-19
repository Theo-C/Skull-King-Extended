// Entraînement hors ligne.
import { $, esc } from '../util';
import * as E from '@engine';
import { TableView } from '../table';
import { optionsHTML, readOptions, wireOptions, paintRanked } from '../options';
import { go, setCleanup } from '../main';
import { sb, callGame } from '../api';

/** TEST — à retirer : partie à 4 (5 cartes) où Bendt le Ripate est dans votre main et remporte forcément le premier pli
 *  (les adversaires n'ont que des cartes numérotées) : la table s'ouvre sur le choix des 2 cartes à défausser. */
function bendtScenario(): E.State {
  const S = E.newGame(['Vous', ...E.BOT_NAMES.slice(0, 3)].map((name, i) => ({ name, bot: i > 0 })), { ...E.DEFAULT_OPTS, rounds: 5, reverse: true });
  const pool = [...S.players.flatMap(p => p.hand), ...S.deck];
  const take = (ok: (c: E.Card) => boolean, n: number) => { const out: E.Card[] = []; for (let i = 0; i < pool.length && out.length < n;) { if (ok(pool[i])) out.push(...pool.splice(i, 1)); else i++; } return out; };
  const bendt = take(c => c.kind === 'pirate' && c.pid === 'bahij', 1);
  S.players[0].hand = E.sortHand([...bendt, ...take(() => true, S.cards - 1)]);
  for (const p of S.players.slice(1)) p.hand = E.sortHand(take(c => c.kind === 'num', S.cards));
  S.deck = pool; S.leader = 0;
  E.apply(S, 0, { t: 'bid', n: 2 });
  E.apply(S, 0, { t: 'play', id: bendt[0].id });
  return S;
}

export function practicePage(root: HTMLElement, query?: URLSearchParams) {
  if (query?.get('test') === 'bendt') { play(root, bendtScenario(), 4); return; }
  root.innerHTML = `<section class="page narrow"><div class="box">
    <h1>Entraînement</h1><p class="lead">Une partie hors ligne contre des bots, sans compte. Rien n'est enregistré.</p>
    <div class="form"><label class="inline">Nombre de joueurs <select id="n">${[3, 4, 5, 6, 7, 8, 9].map(n => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>${optionsHTML(E.DEFAULT_OPTS, true, 'pr')}</div>
    <div class="foot"><button class="btn gold big" id="go">Lever l'ancre</button></div></div></section>`;
  wireOptions(root, 'pr'); paintRanked(root, 'pr', 'practice');
  $('#go', root).onclick = () => {
    const n = Number(($('#n', root) as HTMLSelectElement).value);
    play(root, E.newGame(Array.from({ length: n }, (_, i) => ({ name: i === 0 ? 'Vous' : E.BOT_NAMES[i - 1], bot: i > 0 })), readOptions(root, 'pr')), n);
  };
}

/** Ouvre la table d'entraînement sur une partie déjà créée (vous au siège 0, des bots ailleurs). */
function play(root: HTMLElement, S: E.State, n: number) {
  E.runBots(S);
  root.innerHTML = '<div class="tablepage"></div>'; document.body.classList.add('at-table');
  const view = new TableView(root.firstElementChild as HTMLElement, 0, {
    send: async move => {
      try { E.apply(S, 0, move); } catch (e: any) { throw new Error(e.message); }
      E.runBots(S); view.push(E.takeEvents(S)); view.setLatest(E.publicView(S), E.privateView(S, 0));
    },
    // GIF pour essayer : recherche par le serveur (compte connecté), affichage sur place, sans diffusion
    seatUids: ['local', ...Array(n - 1).fill(null)],
    gifSearch: (q, cat, cursor) => callGame('gif.search', { q, cat, cursor }),
    gifSend: async (_id, g) => view.receiveGif({ userId: 'local', seat: 0, gifUrl: g.full, w: g.w, h: g.h }),
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
}
