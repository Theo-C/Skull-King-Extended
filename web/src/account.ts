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
let cache: { uid: string; p: Profile } | null = null;
let pending: { uid: string; p: Promise<Profile | null> } | null = null;

/** Profil de l'utilisateur ; tolère une base sans la migration « profiles_xp » (on garde alors le pseudo seul).
 *  Une seule requête à la fois (l'en-tête et la page le demandent ensemble) ; un profil introuvable n'est pas mis en cache. */
export function myProfile(uid: string, force = false): Promise<Profile | null> {
  if (!force && cache?.uid === uid) return Promise.resolve(cache.p);
  if (pending?.uid === uid) return pending.p;
  const p: Promise<Profile | null> = (async () => {
    let { data, error } = await sb.from('profiles').select(COLS).eq('id', uid).maybeSingle();
    if (error) {
      const r = await sb.from('profiles').select('id, pseudo').eq('id', uid).maybeSingle();
      data = r.data ? { color: '#d9b25a', avatar_kind: 'initial', avatar_art: null, avatar_url: null, xp: 0, public_rank: true, notify_turn: true, sounds: true, ...r.data } as any : null;
    }
    const prof = data as Profile | null;
    if (prof) { cache = { uid, p: prof }; applyPrefs(prof); }
    return prof;
  })().finally(() => { if (pending?.p === p) pending = null; });
  pending = { uid, p };
  return p;
}
export const forgetProfile = () => { cache = null; pending = null; };
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

/** En-tête (navigation + pastille de profil) et barre d'onglets du téléphone.
 *  body.authed : sur téléphone, la barre d'onglets remplace la navigation (seul le lien Règles reste en haut). */
export function shell(user: { id: string } | null, active: string) {
  const nav = $('#nav'), pill = $('#pill'), tabs = $('#tabbar');
  const link = (k: string, l: string, h: string, inner = l) => `<a href="${h}" class="${active === k ? 'on' : ''}"${active === k ? ' aria-current="page"' : ''}>${inner}</a>`;
  document.body.classList.toggle('authed', !!user);
  if (user) {
    nav.innerHTML = NAV.map(([k, l, h]) => link(k, l, h)).join('');
    tabs.innerHTML = TABS.map(([k, l, h, d]) => link(k, l, h, `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>${l}`)).join('');
    tabs.hidden = false;
    pill.hidden = false; pill.classList.toggle('on', active === 'profile');
    if (active === 'profile') pill.setAttribute('aria-current', 'page'); else pill.removeAttribute('aria-current');
    myProfile(user.id).then(p => {
      if (!p) return;
      const x = xpLine(p.xp);
      pill.setAttribute('aria-label', `Mon profil : ${p.pseudo} · Niv. ${x.level}`);
      pill.innerHTML = `${avatarHTML(fromProfile(p), 36)}<span><b>${esc(p.pseudo)} <i>· Niv. ${x.level}</i></b><span class="mxp" title="${x.text} XP"><span style="width:${x.pct}%"></span></span></span>`;
    });
  } else {
    nav.innerHTML = link('practice', 'Entraînement', '#/entrainement') + link('rules', 'Règles', '#/regles') + link('login', 'Connexion', '#/connexion');
    pill.hidden = true; pill.removeAttribute('aria-current'); tabs.hidden = true; tabs.innerHTML = '';
  }
}
