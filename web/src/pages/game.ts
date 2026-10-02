// Page d'une partie : salon (avant le lancement) puis table en direct.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sb, callGame, inviteLink } from '../api';
import { $, esc, toast, copyText } from '../util';
import { optionsHTML, readOptions, wireOptions } from '../options';
import { TableView } from '../table';
import { fromProfile } from '../avatar';
import { go, setCleanup } from '../main';

export async function gamePage(root: HTMLElement, id: string, uid: string) {
  let channel: RealtimeChannel | null = null, table: TableView | null = null, mode: 'lobby' | 'table' | null = null;
  let lastEventId = 0, syncing = false, again = false, timer: any = null, stopped = false;
  const stop = () => { stopped = true; if (channel) sb.removeChannel(channel); clearInterval(timer); table?.destroy(); };
  setCleanup(stop);

  const loadGame = async () => {
    const { data: g } = await sb.from('games').select('id, code, host, status, options, state, version').eq('id', id).maybeSingle();
    const { data: seats } = await sb.from('game_players').select('seat, user_id, bot, name').eq('game_id', id).order('seat');
    return { g, seats: seats || [] };
  };
  const first = await loadGame();
  if (!first.g) { root.innerHTML = `<section class="page narrow"><div class="box"><h1>Partie introuvable</h1><p class="lead">Elle n'existe pas ou vous n'en faites pas partie. Demandez un lien d'invitation à l'hôte.</p><a class="btn alt" href="#/">Retour à l'accueil</a></div></section>`; return; }

  // Synchronisation : le temps réel sert de signal, puis on relit événements, état et main.
  const sync = async () => {
    if (stopped) return; if (syncing) { again = true; return; } syncing = true;
    try {
      do {
        again = false;
        const { g, seats } = await loadGame(); if (!g) return;
        if (g.status === 'lobby') { renderLobby(g, seats); continue; }
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
    }, () => go('#/'));
    // avatars et couleurs des joueurs (les bots gardent l'initiale sur la couleur par défaut)
    const ids = seats.filter(s => s.user_id).map(s => s.user_id);
    if (ids.length) {
      const { data: profs } = await sb.from('profiles').select('id, pseudo, color, avatar_kind, avatar_art, avatar_url').in('id', ids);
      if (profs) table.setAvatars(seats.map(s => { const p = profs.find((x: any) => x.id === s.user_id); return p ? fromProfile(p) : null; }));
    }
  };

  const renderLobby = (g: any, seats: any[]) => {
    mode = 'lobby'; document.body.classList.remove('at-table');
    const host = g.host === uid; const link = inviteLink(g.code);
    const free = seats.filter(s => !s.bot && !s.user_id).length;
    // on garde le formulaire tel quel pendant que l'hôte le modifie
    const keep = host && root.querySelector('#lobby') && document.activeElement && root.contains(document.activeElement) && (document.activeElement as HTMLElement).tagName === 'SELECT';
    if (keep) return;
    root.innerHTML = `<section class="page" id="lobby">
      <div class="hero"><div><p class="eyebrow">Salon</p><h1>Partie ${esc(g.code)}</h1>
        <p class="lead">${free ? `${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''} : envoyez le lien à vos amis.` : 'Toutes les places sont prises.'}</p></div></div>
      <div class="grid2">
        <div class="box"><h2>Lien d'invitation</h2>
          <div class="invite"><input id="link" readonly value="${esc(link)}" aria-label="Lien d'invitation"><button class="btn gold" id="copy">Copier</button>${'share' in navigator ? '<button class="btn alt" id="share">Partager</button>' : ''}</div>
          <p class="muted small">Code à saisir sur l'accueil : <b class="code">${esc(g.code)}</b></p>
          <h2>Sièges</h2><ul class="seatview" id="seatList">${seats.map(s => `<li class="${s.user_id || s.bot ? '' : 'free'}"><span>${s.seat + 1}</span>${s.bot ? `${esc(s.name)} <small>bot</small>` : s.user_id ? `${esc(s.name)}${s.user_id === g.host ? ' <small>hôte</small>' : ''}${s.user_id === uid ? ' <small>vous</small>' : ''}` : '<i>en attente d’un ami</i>'}
            ${host && s.seat > 0 && !s.user_id ? `<button class="mini-btn" data-toggle="${s.seat}">${s.bot ? 'Ouvrir à un ami' : 'Mettre un bot'}</button>` : ''}</li>`).join('')}</ul>
          ${host ? `<div class="row"><button class="btn alt" id="addSeat" ${seats.length >= 9 ? 'disabled' : ''}>Ajouter un siège</button><button class="btn alt" id="rmSeat" ${seats.length <= 3 ? 'disabled' : ''}>Retirer le dernier siège</button></div>` : ''}
        </div>
        <div class="box"><h2>Options</h2><div class="form" id="optsBox">${optionsHTML(g.options, host, 'lo')}</div></div>
      </div>
      <div class="lobbyfoot">${host ? `<button class="btn gold big" id="start">Lancer la partie</button><span class="muted small">${free ? 'Les places libres seront prises par des bots.' : ''}</span>` : `<span class="muted">L'hôte lancera la partie quand tout le monde sera là.</span><button class="btn alt" id="leave">Quitter le salon</button>`}</div>
    </section>`;
    $('#copy', root).onclick = async () => { if (await copyText(link)) toast('Lien copié.'); else { ($('#link', root) as HTMLInputElement).select(); toast('Sélectionnez le lien pour le copier.'); } };
    const sh = root.querySelector('#share') as HTMLElement | null;
    if (sh) sh.onclick = () => (navigator as any).share({ title: 'Le Pli des Pirates', text: 'Rejoins ma table !', url: link }).catch(() => { });
    if (host) {
      wireOptions(root, 'lo', async () => { try { await callGame('lobby', { id, options: readOptions(root, 'lo') }); } catch (e: any) { toast(e.message, 'err'); } });
      const types = seats.map(s => !!s.bot);
      const push = async (t: boolean[]) => { try { await callGame('lobby', { id, seats: t.map(bot => ({ bot })) }); await sync(); } catch (e: any) { toast(e.message, 'err'); } };
      root.querySelectorAll('[data-toggle]').forEach(b => (b as HTMLElement).onclick = () => { const i = Number((b as HTMLElement).dataset.toggle); const t = types.slice(); t[i] = !t[i]; push(t); });
      $('#addSeat', root).onclick = () => push([...types, false]);
      $('#rmSeat', root).onclick = () => { const t = types.slice(); const last = seats[seats.length - 1]; if (last.user_id) { toast('Le dernier siège est occupé.', 'err'); return; } t.pop(); push(t); };
      $('#start', root).onclick = async () => { const b = $('#start', root) as HTMLButtonElement; b.disabled = true; b.textContent = 'Distribution…'; try { await callGame('start', { id }); await sync(); } catch (e: any) { toast(e.message, 'err'); b.disabled = false; b.textContent = 'Lancer la partie'; } };
    } else {
      $('#leave', root).onclick = async () => { try { await callGame('leave', { id }); go('#/'); } catch (e: any) { toast(e.message, 'err'); } };
    }
  };

  let debounce: any = null; const ping = () => { clearTimeout(debounce); debounce = setTimeout(sync, 120); };
  const seatOk = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 9;
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
