// Point d'entrée : routage par ancre (#/...), compatible hébergement statique et appli Capacitor.
import './game.css';
import './app.css';
import { sb, configured, currentUser } from './api';
import { $, esc, toast } from './util';
import { loginPage, verifyPage } from './pages/auth';
import { shell } from './account';
import { profilePage, playerPage } from './pages/profile';
import { historyPage } from './pages/history';
import { leaderboardPage } from './pages/leaderboard';
import { salonByCode } from './pages/salon';
import { rulesPage } from './pages/rules';
import { installArtFallback } from './cards';

// une illustration de carte qui ne se charge pas laisse place à l'ancienne face, sur toutes les pages
installArtFallback();
import { homePage } from './pages/home';
import { joinPage } from './pages/join';
import { gamePage } from './pages/game';
import { practicePage } from './pages/misc';

const AFTER = 'pli-apres-connexion';
let cleanup: (() => void)[] = [];
export function setCleanup(fn: () => void) { cleanup.push(fn); }
export function go(hash: string) { if (location.hash === hash) route(); else location.hash = hash; }
const remember = (h: string) => { try { localStorage.setItem(AFTER, h); } catch { /* ignoré */ } };
const recall = () => { try { const h = localStorage.getItem(AFTER); localStorage.removeItem(AFTER); return h; } catch { return null; } };


async function route() {
  cleanup.forEach(f => { try { f(); } catch { /* ignoré */ } }); cleanup = [];
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const view = $('#view'); const parts = path.split('/').filter(Boolean);
  const page = parts[0] || '';
  if (!configured && page !== 'entrainement') {
    shell(null, 'practice');
    view.innerHTML = `<section class="page narrow"><div class="box"><h1>Configuration manquante</h1><p class="lead">Renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans le fichier .env (voir le guide de déploiement).</p><a class="btn gold" href="#/entrainement">Jouer hors ligne en attendant</a></div></section>`;
    return;
  }
  const user = configured ? await currentUser() : null;
  const needAuth = (note?: string) => { remember(location.hash || '#/'); shell(null, 'login'); loginPage(view, note); };
  window.scrollTo(0, 0);
  switch (page) {
    case 'connexion': shell(user, 'login'); if (user) { go('#/'); return; } return loginPage(view);
    case 'verifier': {
      if (user) { go('#/'); return; }
      const q = new URLSearchParams(query); shell(null, 'login');
      return verifyPage(view, q.get('token_hash') ?? '', q.get('type') ?? 'email');
    }
    case 'entrainement': shell(user, 'practice'); return practicePage(view);
    case 'regles': shell(user, 'rules'); return rulesPage(view);
    case 'classement': if (!user) return needAuth(); shell(user, 'lb'); return leaderboardPage(view, user.id, new URLSearchParams(query));
    case 'historique': if (!user) return needAuth(); shell(user, 'hist'); return historyPage(view, user.id, new URLSearchParams(query));
    case 'salon': if (!user) return needAuth('Connectez-vous pour rejoindre la partie de votre ami.'); shell(user, 'home'); return salonByCode(view, (parts[1] || '').toUpperCase());
    case 'rejoindre': if (!user) return needAuth('Connectez-vous pour rejoindre la partie de votre ami.'); shell(user, 'home'); return joinPage(view, (parts[1] || '').toUpperCase());
    case 'partie': if (!user) return needAuth(); shell(user, 'home'); return gamePage(view, parts[1], user.id);
    case 'profil': if (!user) return needAuth(); shell(user, 'profile'); return profilePage(view, user.id, user.email ?? '');
    case 'joueur': if (!user) return needAuth(); if (parts[1] === user.id) { go('#/profil'); return; } shell(user, 'lb'); return playerPage(view, parts[1] || '');
    default: if (!user) return needAuth(); shell(user, 'home'); return homePage(view, user.id);
  }
}

addEventListener('hashchange', route);
// supabase-js réémet SIGNED_IN quand l'onglet reprend le focus (et TOKEN_REFRESHED régulièrement) :
// on ne relance route() que si l'utilisateur connecté a vraiment changé, sinon la page de partie serait reconstruite.
let authUid: string | null | undefined;
sb.auth.onAuthStateChange((ev, session) => {
  const uid = session?.user?.id ?? null;
  if (ev === 'INITIAL_SESSION') { authUid = uid; return; }
  if (ev === 'TOKEN_REFRESHED' || uid === authUid) return;
  // SIGNED_IN peut arriver avant INITIAL_SESSION au démarrage : le premier route() s'en charge déjà
  if (authUid === undefined) { authUid = uid; return; }
  authUid = uid;
  if (ev === 'SIGNED_IN') { const h = recall(); if (h && h !== location.hash) { location.hash = h; return; } route(); }
  if (ev === 'SIGNED_OUT') route();
});
$('#brandLink').addEventListener('click', () => go('#/'));
// Retour d'un lien de connexion refusé par Supabase (déjà utilisé, expiré…) : on prévient et on nettoie l'adresse.
if (new URLSearchParams(location.search).get('error_code')) {
  toast('Ce lien de connexion a expiré ou a déjà servi. Demandez-en un nouveau.', 'err');
  history.replaceState(null, '', location.pathname + '#/connexion');
}
route().catch(e => { console.error(e); $('#view').innerHTML = `<section class="page narrow"><div class="box"><h1>Oups</h1><p class="lead">${esc(e.message)}</p></div></section>`; });
