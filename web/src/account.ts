// Profil de l'utilisateur connecté (mis en cache), en-tête commun (AppBar) et barre d'onglets du téléphone.
import { sb } from './api';
import { $, esc } from './util';
import { avatarHTML, fromProfile } from './avatar';
import { xpLine } from './xp';
import { setSound } from './sound';

export interface Profile {
  id: string; pseudo: string; color: string; avatar_kind: string; avatar_art: number | null; avatar_url: string | null;
  xp: number; public_rank: boolean; notify_turn: boolean; sounds: boolean;
}
const COLS = 'id, pseudo, color, avatar_kind, avatar_art, avatar_url, xp, public_rank, notify_turn, sounds';
let cache: { uid: string; p: Profile | null } | null = null;

/** Profil de l'utilisateur ; tolère une base sans la migration « profiles_xp » (on garde alors le pseudo seul). */
export async function myProfile(uid: string, force = false): Promise<Profile | null> {
  if (!force && cache?.uid === uid) return cache.p;
  let { data, error } = await sb.from('profiles').select(COLS).eq('id', uid).maybeSingle();
  if (error) {
    const r = await sb.from('profiles').select('id, pseudo').eq('id', uid).maybeSingle();
    data = r.data ? { color: '#d9b25a', avatar_kind: 'initial', avatar_art: null, avatar_url: null, xp: 0, public_rank: true, notify_turn: true, sounds: true, ...r.data } as any : null;
  }
  cache = { uid, p: data as Profile | null };
  if (cache.p) applyPrefs(cache.p);
  return cache.p;
}
export const forgetProfile = () => { cache = null; };
/** Préférences appliquées à ce navigateur : sons de la table, notification quand c'est son tour. */
export function applyPrefs(p: Pick<Profile, 'sounds' | 'notify_turn'>) {
  setSound(p.sounds !== false);
  try { localStorage.setItem('pli-notify', p.notify_turn === false ? '0' : '1'); } catch { /* stockage indisponible */ }
}

const NAV: [string, string, string][] = [['home', 'Accueil', '#/'], ['lb', 'Classement', '#/classement'], ['hist', 'Historique', '#/historique'], ['rules', 'Règles', '#/regles']];
const TABS: [string, string, string, string][] = [
  ['home', 'Accueil', '#/', 'M4 11l8-7 8 7v9h-5v-6H9v6H4z'],
  ['lb', 'Classement', '#/classement', 'M5 20V12h4v8M10 20V6h4v14M15 20v-5h4v5'],
  ['hist', 'Historique', '#/historique', 'M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4'],
  ['profile', 'Profil', '#/profil', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6'],
];

/** En-tête (navigation + pastille de profil) et barre d'onglets du téléphone. */
export function shell(user: { id: string } | null, active: string) {
  const nav = $('#nav'), pill = $('#pill'), tabs = $('#tabbar');
  if (user) {
    nav.innerHTML = NAV.map(([k, l, h]) => `<a href="${h}" class="${active === k ? 'on' : ''}">${l}</a>`).join('');
    tabs.innerHTML = TABS.map(([k, l, h, d]) => `<a href="${h}" class="${active === k ? 'on' : ''}" ${active === k ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>${l}</a>`).join('');
    tabs.hidden = false;
    pill.hidden = false; pill.classList.toggle('on', active === 'profile');
    myProfile(user.id).then(p => {
      if (!p) return;
      const x = xpLine(p.xp);
      pill.innerHTML = `${avatarHTML(fromProfile(p), 36)}<span><b>${esc(p.pseudo)} <i>· Niv. ${x.level}</i></b><span class="mxp" title="${x.text} XP"><span style="width:${x.pct}%"></span></span></span>`;
    });
  } else {
    nav.innerHTML = `<a href="#/entrainement" class="${active === 'practice' ? 'on' : ''}">Entraînement</a><a href="#/regles" class="${active === 'rules' ? 'on' : ''}">Règles</a><a href="#/connexion" class="${active === 'login' ? 'on' : ''}">Connexion</a>`;
    pill.hidden = true; tabs.hidden = true; tabs.innerHTML = '';
  }
}
