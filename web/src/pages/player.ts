// Profil public d'un autre joueur (lien « Profil › » de l'aperçu à la table, maquette ApercuJoueur) : lecture seule.
// Mêmes données que l'aperçu (player.card) plus les hauts faits obtenus ; rien de privé (e-mail, réglages, porte-monnaie).
import { sb, callGame } from '../api';
import { $, esc } from '../util';
import { avatarHTML, CATALOG } from '../avatar';
import { objectSVG } from '../objects';
import { xpLine, fmt } from '../xp';
import type { PlayerCardData } from '../playercard';

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z"/></svg>';
const RAR: Record<string, [string, string]> = { r: ['Rare', '#4fa8ff'], e: ['Épique', '#c27dff'], l: ['Légendaire', '#ffc94a'], m: ['Mythique', '#c39bff'] };
const tile = (v: string, l: string) => `<div class="tile"><span class="big">${esc(v)}</span><span class="lbl">${esc(l)}</span></div>`;

export async function playerPage(root: HTMLElement, uid: string) {
  root.innerHTML = '<section class="apage profile"><div class="apanel"><p class="lbl">Chargement du profil…</p></div></section>';
  let d: PlayerCardData | null = null;
  try { d = await callGame<PlayerCardData>('player.card', { user_id: uid }); } catch { /* affiché plus bas */ }
  if (!d) { root.innerHTML = '<section class="apage"><div class="apanel"><h2>Profil introuvable</h2><p class="lbl">Ce joueur n\'existe pas ou n\'est plus disponible.</p></div></section>'; return; }
  const [mine, all] = await Promise.all([
    sb.from('user_achievements').select('code').eq('user_id', uid).then(r => r.data || []),
    sb.from('achievements').select('code, name, description, sort').order('sort').then(r => r.data || []),
  ]);
  const got = new Set((mine as any[]).map(a => a.code)), achs = (all as any[]).filter(a => got.has(a.code));
  const x = xpLine(d.xp), elo = Math.round(Number(d.elo)), delta = d.last_delta != null ? Math.round(Number(d.last_delta)) : 0;
  const items = (d.cosmetics || []).map(id => CATALOG.byId[id]).filter(it => it && RAR[it.rarity]);
  const look = d.look || {};
  root.innerHTML = `<section class="apage profile">
    <section class="phero">
      <div class="pav">${avatarHTML({ kind: d.avatar_kind as any, art: d.avatar_art, url: d.avatar_url, look: d.look, letter: d.pseudo, color: d.color }, 120, `0 0 0 3px #1b140e,0 0 0 6px ${d.color}`)}</div>
      <div class="pid">
        <div class="pline"><h1>${esc(d.pseudo)}</h1><span class="chip1">${esc(x.title)} · niveau ${x.level}</span>
          <span class="chip2">Élo ${elo}${delta ? ` <span class="${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}</span>` : ''}</span></div>
        <div class="psub">${d.games} partie${d.games > 1 ? 's' : ''} jouée${d.games > 1 ? 's' : ''} · ${fmt(d.xp)} XP</div>
      </div>
    </section>
    <div class="tiles">
      ${tile(String(d.games), `partie${d.games > 1 ? 's' : ''} jouée${d.games > 1 ? 's' : ''}`)}
      ${tile(String(d.wins), `victoire${d.wins > 1 ? 's' : ''}${d.games ? ` · ${Math.round(100 * d.wins / d.games)} %` : ''}`)}
      ${tile(d.bids_total ? Math.round(100 * d.bids_made / d.bids_total) + ' %' : '—', 'mises tenues')}
      ${tile(String(elo), `Élo · record ${Math.round(Number(d.elo_best))}`)}
    </div>
    <div class="agrid">
      <section class="apanel">
        <div class="hrow"><h2>Hauts faits</h2><span>${achs.length} sur ${(all as any[]).length}</span></div>
        ${achs.length ? `<div class="achs">${achs.map(a => `<div class="ach"><span class="amedal">${STAR}</span><span><b>${esc(a.name)}</b><span class="lbl">${esc(a.description)}</span></span></div>`).join('')}</div>` : '<p class="lbl">Aucun haut fait pour l\'instant.</p>'}
      </section>
      <section class="apanel">
        <div class="hrow"><h2>Objets rares</h2><span>${items.length}</span></div>
        ${items.length ? `<div class="pobjs">${items.map(it => {
          const [lbl, ink] = RAR[it.rarity], vk = it.variantKey ? (look as any)[it.variantKey] : null;
          return `<div class="pobj" style="--rar:${ink}"><span class="pobj-v">${objectSVG(it.slot, it.value, 56, vk || it.variants?.[0] || '#2f5f8a', d!.color)}</span><span><b>${esc(it.name)}</b><span class="${it.rarity === 'm' ? 'irid' : 'lbl'}" style="${it.rarity === 'm' ? '' : `color:${ink}`}">${esc(lbl)}</span></span></div>`;
        }).join('')}</div>` : '<p class="lbl">Pas encore d\'objet rare.</p>'}
      </section>
    </div>
    <p><a class="abtn ghost" href="#/" id="pBack">‹ Retour</a></p>
  </section>`;
  $('#pBack', root).onclick = ev => { ev.preventDefault(); history.back(); };
}
