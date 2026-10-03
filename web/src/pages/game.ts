// Page d'une partie : salon (avant le lancement) puis table en direct.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sb, callGame, inviteLink } from '../api';
import { $, esc, toast, copyText } from '../util';
import { optionsHTML, readOptions, wireOptions } from '../options';
import { TableView } from '../table';
import { fromProfile, type Look } from '../avatar';
import { myProfile, forgetProfile } from '../account';
import { detailPage } from './detail';
import { renderSalon } from './salon';
import { go, setCleanup } from '../main';

export async function gamePage(root: HTMLElement, id: string, uid: string) {
  let channel: RealtimeChannel | null = null, table: TableView | null = null, mode: 'lobby' | 'table' | null = null;
  let lastEventId = 0, syncing = false, again = false, timer: any = null, stopped = false;
  let myLookCache: { color: string; look: Look | null } | null = null;
  const stop = () => { stopped = true; if (channel) sb.removeChannel(channel); clearInterval(timer); table?.destroy(); };
  setCleanup(stop);

  const loadGame = async () => {
    const { data: g } = await sb.from('games').select('id, code, host, status, options, state, version').eq('id', id).maybeSingle();
    const { data: seats } = await sb.from('game_players').select('seat, user_id, bot, name').eq('game_id', id).order('seat');
    return { g, seats: seats || [] };
  };
  const first = await loadGame();
  if (!first.g) { root.innerHTML = `<section class="page narrow"><div class="box"><h1>Partie introuvable</h1><p class="lead">Elle n'existe pas ou vous n'en faites pas partie. Demandez un lien d'invitation à l'hôte.</p><a class="btn alt" href="#/">Retour à l'accueil</a></div></section>`; return; }
  // partie terminée : on affiche son détail (podium, courbe, manches) plutôt que la table
  if (first.g.status === 'finished') return detailPage(root, id, uid);

  // Synchronisation : le temps réel sert de signal, puis on relit événements, état et main.
  const sync = async () => {
    if (stopped) return; if (syncing) { again = true; return; } syncing = true;
    try {
      do {
        again = false;
        const { g, seats } = await loadGame(); if (!g) return;
        if (g.status === 'lobby') { await renderLobby(g, seats); continue; }
        if (mode !== 'table') await openTable(g, seats);
        const { data: evs } = await sb.from('game_events').select('id, payload').eq('game_id', id).gt('id', lastEventId).order('id').limit(400);
        if (evs && evs.length) { lastEventId = evs[evs.length - 1].id; table!.push(evs.map(e => e.payload)); }
        const { data: h } = await sb.from('hands').select('data').eq('game_id', id).maybeSingle();
        table!.setLatest(g.state, h?.data ?? null);
      } while (again && !stopped);
    } finally { syncing = false; }
  };
  const openTable = async (g: any, seats: any[]) => {
    mode = 'table'; document.body.classList.add('at-table');
    const mine = seats.find(s => s.user_id === uid);
    const { data: last } = await sb.from('game_events').select('id').eq('game_id', id).order('id', { ascending: false }).limit(1);
    lastEventId = last?.[0]?.id ?? 0; // on ne rejoue pas l'historique en arrivant
    root.innerHTML = '<div class="tablepage"></div>';
    // réactions et « Je suis prêt » : messages Realtime éphémères sur le canal de la partie (rien n'est enregistré en base)
    const cast = (event: string, payload: Record<string, unknown>) => { if (mine) channel?.send({ type: 'broadcast', event, payload: { seat: mine.seat, ...payload } }); };
    table = new TableView(root.firstElementChild as HTMLElement, mine ? mine.seat : null, {
      send: async move => { await callGame('act', { id, move }); await sync(); },
      emote: text => cast('emote', { text }),
      ready: round => cast('ready', { round }),
      gameId: id, uid, seatUids: seats.map(s => s.user_id ?? null),
      rematch: async () => (await callGame<{ id: string }>('rematch', { id })).id,
      // règlement de fin de partie relu au serveur (il le refait s'il a été interrompu)
      settled: async () => (await callGame<any>('history.get', { id }))?.state?.settled ?? null,
      // coffre de victoire ouvert depuis la superposition de fin de partie
      openChest: () => callGame<any>('chest.open', {}),
      // équiper l'objet reçu : met à jour profiles.look avec le nouvel emplacement
      equipItem: async (slot, value) => {
        const base = await myProfile(uid); const nextLook = { ...(base?.look || {}), [slot]: value };
        await callGame('profile.update', { look: nextLook });
        forgetProfile();
      },
      // apparence actuelle du joueur pour le rendu de l'objet en repli (avatar)
      myLook: () => myLookCache || { color: '#d9b25a', look: null },
      // aperçu d'un joueur au survol de son pod
      playerCard: (u: string) => callGame<any>('player.card', { user_id: u }),
    }, () => go('#/'));
    // avatars et couleurs des joueurs (les bots gardent l'initiale sur la couleur par défaut)
    const ids = seats.filter(s => s.user_id).map(s => s.user_id);
    if (ids.length) {
      const { data: profs } = await sb.from('profiles').select('id, pseudo, color, avatar_kind, avatar_art, avatar_url, look').in('id', ids);
      if (profs) {
        table.setAvatars(seats.map(s => { const p = profs.find((x: any) => x.id === s.user_id); return p ? fromProfile(p) : null; }));
        const me = profs.find((x: any) => x.id === uid); if (me) myLookCache = { color: me.color || '#d9b25a', look: me.look || null };
      }
    }
  };

  const renderLobby = (g: any, seats: any[]) => {
    mode = 'lobby'; document.body.classList.remove('at-table');
    return renderSalon(root, g, seats, uid, sync);
  };

  let debounce: any = null; const ping = () => { clearTimeout(debounce); debounce = setTimeout(sync, 120); };
  const seatOk = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 9;
  // un canal resté ouvert pour cette partie (page reconstruite) serait réutilisé déjà abonné : on le ferme d'abord
  sb.getChannels().filter(c => c.topic === 'realtime:partie-' + id).forEach(c => sb.removeChannel(c));
  channel = sb.channel('partie-' + id, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'emote' }, ({ payload }) => { if (seatOk(payload?.seat) && typeof payload.text === 'string') table?.showEmote(payload.seat, payload.text); })
    .on('broadcast', { event: 'ready' }, ({ payload }) => { if (seatOk(payload?.seat) && Number.isInteger(payload?.round)) table?.markReady(payload.seat, payload.round); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${id}` }, ping)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${id}` }, ping)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_events', filter: `game_id=eq.${id}` }, ping)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hands', filter: `game_id=eq.${id}` }, ping)
    .subscribe();
  timer = setInterval(sync, 15000); // filet de sécurité si le temps réel décroche
  const onVis = () => { if (!document.hidden) sync(); };
  document.addEventListener('visibilitychange', onVis);
  setCleanup(() => { stop(); document.removeEventListener('visibilitychange', onVis); document.body.classList.remove('at-table'); });
  if (first.g.status === 'lobby') renderLobby(first.g, first.seats); else { await openTable(first.g, first.seats); }
  await sync();
}
