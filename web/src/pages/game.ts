// Page d'une partie : salon (avant le lancement) puis table en direct.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sb, callGame, inviteLink } from '../api';
import { $, esc, toast, copyText } from '../util';
import { optionsHTML, readOptions, wireOptions } from '../options';
import { TableView } from '../table';
import { Jukebox } from '../music/jukebox';
import { skipNeed } from '@shared/music.ts';
import { fromProfile, withItem, type Look } from '../avatar';
import { myProfile, forgetProfile, chestBadge } from '../account';
import { detailPage } from './detail';
import { renderSalon } from './salon';
import { go, setCleanup } from '../main';

export async function gamePage(root: HTMLElement, id: string, uid: string) {
  let channel: RealtimeChannel | null = null, table: TableView | null = null, mode: 'lobby' | 'table' | null = null, jukebox: Jukebox | null = null;
  let lastEventId = 0, syncing = false, again = false, timer: any = null, stopped = false;
  /** Version de la partie déjà affichée : un état plus ancien (lecture croisée avec un coup) est ignoré. */
  let shownVersion = -1, knownVersion = -1;
  let myLookCache: { color: string; look: Look | null } | null = null;
  const stop = () => { stopped = true; if (channel) sb.removeChannel(channel); clearInterval(timer); jukebox?.destroy(); table?.destroy(); };
  setCleanup(stop);

  // Chaque lecture a un délai de garde : une requête qui ne répond jamais (connexion morte après une mise en veille, un
  // changement de réseau) bloquait la synchronisation pour de bon, jusqu'au F5.
  const ttl = () => AbortSignal.timeout(8000);
  const loadGame = async () => {
    const [{ data: g, error }, { data: seats }] = await Promise.all([
      sb.from('games').select('id, code, host, status, options, state, version').eq('id', id).abortSignal(ttl()).maybeSingle(),
      sb.from('game_players').select('seat, user_id, bot, name').eq('game_id', id).order('seat').abortSignal(ttl()),
    ]);
    if (error) throw error;
    return { g, seats: seats || [] };
  };
  const first = await loadGame();
  if (!first.g) { root.innerHTML = `<section class="page narrow"><div class="box"><h1>Partie introuvable</h1><p class="lead">Elle n'existe pas ou vous n'en faites pas partie. Demandez un lien d'invitation à l'hôte.</p><a class="btn alt" href="#/">Retour à l'accueil</a></div></section>`; return; }
  // partie terminée : on affiche son détail (podium, courbe, manches) plutôt que la table
  if (first.g.status === 'finished') return detailPage(root, id, uid);

  // Synchronisation : le temps réel sert de signal, puis on relit événements, état et main.
  // Une synchronisation ne peut pas rester bloquée : au-delà de 15 s, la suivante repart sans l'attendre.
  let syncGen = 0;
  const sync = async (): Promise<void> => {
    if (stopped) return; if (syncing) { again = true; return; } syncing = true;
    const gen = ++syncGen;
    const guard = setTimeout(() => { if (syncGen === gen && syncing) { syncing = false; syncGen++; sync(); } }, 15000);
    let tries = 0;
    try {
      do {
        if (syncGen !== gen) return; // remplacée par une synchronisation plus récente (celle-ci était bloquée)
        again = false;
        // partie, sièges, événements et main lus en même temps (un aller-retour au lieu de quatre) ; en arrivant à la table,
        // openTable fixe d'abord le point de départ des événements, ils sont donc relus ensuite
        const since = lastEventId;
        const [{ g, seats }, ev, hd] = await Promise.all([
          loadGame(),
          mode === 'table' ? sb.from('game_events').select('id, payload').eq('game_id', id).gt('id', since).order('id').limit(400).abortSignal(ttl()) : null,
          mode === 'table' ? sb.from('hands').select('data, version').eq('game_id', id).abortSignal(ttl()).maybeSingle() : null,
        ]);
        if (syncGen !== gen || !g) return;
        knownVersion = Math.max(knownVersion, g.version);
        if (g.status === 'lobby') { await renderLobby(g, seats); continue; }
        if (mode !== 'table') { await openTable(g, seats); again = true; continue; }
        if (ev?.error || hd?.error) throw ev?.error || hd?.error;
        const evs = ev?.data, h = hd?.data;
        // lectures faites en parallèle : un coup enregistré entre deux d'entre elles donne une main d'une autre version que
        // l'état (main du coup d'avant, cartes jouables fausses) ; on relit, la base finit toujours par être cohérente
        if (h && h.version !== g.version && ++tries < 4) { again = true; continue; }
        if (evs && evs.length && since === lastEventId) { lastEventId = evs[evs.length - 1].id; table!.push(evs.map(e => e.payload)); }
        if (g.version < shownVersion) continue; // état plus ancien que celui déjà affiché
        shownVersion = g.version;
        table!.setLatest(g.state, h?.data ?? null);
        jukebox?.setLive(g.status === 'playing');
        // un joueur a lancé la revanche (code réservé dans state.rematch) : tout le monde rejoint le salon, sans cliquer
        if (g.status === 'finished' && g.state?.rematch && seats.some(s => s.user_id === uid)) followRematch();
      } while (again && !stopped);
    } catch (e) {
      // réseau coupé, délai dépassé : nouvel essai bientôt (le filet ci-dessous relance aussi)
      console.warn('synchronisation', e);
      if (syncGen === gen) setTimeout(() => sync(), 2000);
    } finally { clearTimeout(guard); if (syncGen === gen) syncing = false; }
  };
  let following = false;
  const followRematch = async () => {
    if (following) return; following = true;
    try {
      // l'action renvoie le salon déjà créé par celui qui a lancé la revanche (nous y sommes déjà assis)
      const r = await callGame<{ id: string }>('rematch', { id });
      // un coffre en cours d'ouverture n'est pas interrompu : on part quand il est refermé
      while (document.querySelector('.chov') && !stopped) await new Promise(res => setTimeout(res, 800));
      if (!stopped) { toast('Revanche lancée : direction le salon !'); go('#/partie/' + r.id); }
    } catch { following = false; /* salon pas encore prêt : nouvel essai à la prochaine synchronisation */ }
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
      rematch: async () => {
        following = true; // c'est nous qui lançons : pas de second départ par followRematch
        try { return (await callGame<{ id: string }>('rematch', { id })).id; } catch (e) { following = false; throw e; }
      },
      // seul humain à la table (les autres sont des bots) : la partie peut être supprimée en la quittant
      deleteGame: !mine || seats.some(s => s.user_id && s.user_id !== uid) ? undefined :async () => { await callGame('delete', { id }); },
      // règlement de fin de partie relu au serveur (il le refait s'il a été interrompu)
      settled: async () => (await callGame<any>('history.get', { id }))?.state?.settled ?? null,
      // coffre de victoire ouvert depuis la superposition de fin de partie
      openChest: async () => { const r = await callGame<any>('chest.open', {}); chestBadge(r.chests); return r; },
      // équiper l'objet reçu : met à jour profiles.look avec le nouvel emplacement
      equipItem: async (_slot, _value, cosmeticId) => {
        const base = await myProfile(uid); const nextLook = withItem(base?.look || {}, cosmeticId);
        await callGame('profile.update', { look: nextLook });
        forgetProfile();
      },
      // apparence actuelle du joueur pour le rendu de l'objet en repli (avatar)
      myLook: () => myLookCache || { color: '#d9b25a', look: null },
      // aperçu d'un joueur au survol de son pod
      playerCard: (u: string) => callGame<any>('player.card', { user_id: u }),
      gifSearch: (q, cat, cursor) => callGame('gif.search', { q, cat, cursor }),
      gifSend: async (gifId, g) => { await callGame('gif.send', { gameId: id, gifId, url: g.full, w: g.w, h: g.h }); },
      saveSound: on => { callGame('profile.update', { sounds: on }).then(() => forgetProfile(), () => { /* réglage gardé sur cet appareil */ }); },
    }, () => go('#/'));
    // avatars et couleurs des joueurs (les bots gardent l'initiale sur la couleur par défaut)
    const ids = seats.filter(s => s.user_id).map(s => s.user_id); let colors: any[] = [];
    if (ids.length) {
      const { data: profs } = await sb.from('profiles').select('id, pseudo, color, avatar_kind, avatar_art, avatar_url, look').in('id', ids); colors = profs ?? [];
      if (profs) {
        table.setAvatars(seats.map(s => { const p = profs.find((x: any) => x.id === s.user_id); return p ? fromProfile(p) : null; }));
        const me = profs.find((x: any) => x.id === uid); if (me) myLookCache = { color: me.color || '#d9b25a', look: me.look || null };
      }
      // cartes animées possédées par chaque joueur (posséder suffit : pas d'interrupteur)
      const { data: ca } = await sb.rpc('cartes_animees', { p_users: ids });
      if (ca) table.setAnimCards(seats.map(s => new Set((ca as any[]).filter(r => r.user_id === s.user_id).map(r => r.carte as string))));
    }
    // juke-box partagé (A19) : seulement pendant la partie, pour les joueurs assis
    if (mine && g.status === 'playing') {
      jukebox = new Jukebox(root.firstElementChild as HTMLElement, {
        uid, game: id, host: g.host === uid, need: skipNeed(new Set(ids).size),
        fetch: async () => {
          const [q, st] = await Promise.all([
            sb.from('music_queue').select('id, added_by, provider, media_id, title, thumb_url, duration_s, position, created_at').eq('game_id', id).order('position').order('created_at').abortSignal(ttl()),
            sb.from('music_state').select('enabled, current_id, started_at, paused_at, skip_votes, reports').eq('game_id', id).abortSignal(ttl()).maybeSingle(),
          ]);
          if (q.error || st.error) throw new Error('juke-box : lecture impossible');
          return { queue: (q.data ?? []) as any, state: (st.data ?? null) as any };
        },
        call: (action, p = {}) => callGame(action, { id, ...p }),
        side: table.socialSide('Juke-box'),
        serverNow: async () => (await callGame<{ now: number }>('time')).now,
        who: u => ({ name: seats.find(s => s.user_id === u)?.name ?? 'Un pirate', color: colors.find((c: any) => c.id === u)?.color || '#d9b25a' }),
      });
      // musique pour moi, volume et interrupteur de l'hôte : dans les réglages du son de la table
      table.setSoundExtra(jukebox.soundExtra());
    }
  };

  const renderLobby = (g: any, seats: any[]) => {
    mode = 'lobby'; document.body.classList.remove('at-table');
    return renderSalon(root, g, seats, uid, sync);
  };

  let debounce: any = null; const ping = () => { clearTimeout(debounce); debounce = setTimeout(sync, 120); };
  const seatOk = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 9;
  let rejoin: any = null;
  const subscribe = () => {
  // un canal resté ouvert pour cette partie (page reconstruite) serait réutilisé déjà abonné : on le ferme d'abord
  sb.getChannels().filter(c => c.topic === 'realtime:partie-' + id).forEach(c => sb.removeChannel(c));
  // présence : qui a la partie ouverte (aperçu « en ligne » / « hors ligne » au survol d'un joueur)
  const ch: RealtimeChannel = channel = sb.channel('partie-' + id, { config: { broadcast: { self: false }, presence: { key: uid } } })
    .on('presence', { event: 'sync' }, () => { if (channel) table?.setOnline(new Set(Object.keys(channel.presenceState()))); })
    .on('broadcast', { event: 'emote' }, ({ payload }) => { if (seatOk(payload?.seat) && typeof payload.text === 'string') table?.showEmote(payload.seat, payload.text); })
    .on('broadcast', { event: 'gif' }, ({ payload }) => { table?.receiveGif(payload as any); })
    .on('broadcast', { event: 'ready' }, ({ payload }) => { if (seatOk(payload?.seat) && Number.isInteger(payload?.round)) table?.markReady(payload.seat, payload.round); })
    // chaque écriture (coup, siège, main, événements) passe par game_commit, qui met toujours à jour la ligne de la partie :
    // ce seul signal suffit (s'abonner aussi aux événements et aux mains multipliait le travail du temps réel à chaque coup)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${id}` }, ping)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'music_queue', filter: `game_id=eq.${id}` }, () => jukebox?.refresh())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'music_state', filter: `game_id=eq.${id}` }, () => jukebox?.refresh())
    .subscribe(status => {
      if (stopped || channel !== ch) return;
      // (ré)abonné : les changements arrivés pendant la coupure n'ont pas été reçus, on relit tout
      if (status === 'SUBSCRIBED') { channel.track({ at: Date.now() }).catch(() => { /* présence indisponible */ }); sync(); jukebox?.refresh(); }
      // canal tombé (jeton expiré, serveur redémarré, réseau) : il ne revient pas toujours seul, on le recrée
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { clearTimeout(rejoin); rejoin = setTimeout(() => { if (!stopped && channel === ch) subscribe(); }, 3000); }
    });
  };
  subscribe();
  // filet de sécurité si le temps réel décroche sans le dire : toutes les 4 s, une lecture minuscule de la version de la
  // partie ; elle a changé → synchronisation complète (le retard maximal passe de 15 s à 4 s, pour presque rien)
  timer = setInterval(async () => {
    if (stopped || document.hidden || syncing) return;
    const { data } = await sb.from('games').select('version').eq('id', id).abortSignal(AbortSignal.timeout(4000)).maybeSingle();
    if (data && data.version !== knownVersion) sync();
  }, 4000);
  const onVis = () => { if (!document.hidden) sync(); };
  const onOnline = () => { sync(); jukebox?.refresh(); };
  document.addEventListener('visibilitychange', onVis);
  addEventListener('online', onOnline);
  setCleanup(() => { stop(); clearTimeout(rejoin); document.removeEventListener('visibilitychange', onVis); removeEventListener('online', onOnline); document.body.classList.remove('at-table'); });
  if (first.g.status === 'lobby') renderLobby(first.g, first.seats); else { await openTable(first.g, first.seats); }
  await sync();
}
