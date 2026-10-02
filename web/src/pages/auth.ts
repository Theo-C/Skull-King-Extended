// Connexion par lien magique et profil.
import { sb, AUTH_REDIRECT } from '../api';
import { $, esc, toast } from '../util';
import { go } from '../main';

export function loginPage(root: HTMLElement, note?: string) {
  root.innerHTML = `<section class="page narrow">
    <div class="box">
      <h1>Montez à bord</h1>
      <p class="lead">${note ? esc(note) : 'Recevez un lien de connexion par e-mail : pas de mot de passe à retenir.'}</p>
      <form id="f" class="stack">
        <label for="email">Adresse e-mail</label>
        <input id="email" type="email" autocomplete="email" required placeholder="vous@exemple.fr">
        <button class="btn gold big" type="submit">Recevoir mon lien</button>
      </form>
      <p id="sent" class="sent" hidden></p>
    </div>
    <p class="aside">Envie d'essayer d'abord ? <a href="#/entrainement">Jouer hors ligne contre des bots</a>.</p>
  </section>`;
  $('#f', root).addEventListener('submit', async ev => {
    ev.preventDefault();
    const email = ($('#email', root) as HTMLInputElement).value.trim();
    const btn = $('button', root) as HTMLButtonElement; btn.disabled = true; btn.textContent = 'Envoi…';
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: AUTH_REDIRECT } });
    btn.disabled = false; btn.textContent = 'Recevoir mon lien';
    if (error) { toast(error.message.includes('rate') ? 'Trop de demandes : patientez une minute avant de réessayer.' : "Le lien n'a pas pu être envoyé. Vérifiez l'adresse.", 'err'); return; }
    const s = $('#sent', root); s.hidden = false;
    s.innerHTML = `E-mail envoyé à <b>${esc(email)}</b>. Cliquez sur le lien, ou saisissez ici le code qu'il contient.`;
    codeForm(root, email);
  });
}

/** Saisie du code reçu par e-mail : marche sur n'importe quel appareil et résiste aux antivirus qui « cliquent » les liens. */
function codeForm(root: HTMLElement, email: string) {
  $('#code', root)?.remove();
  const f = document.createElement('form');
  f.id = 'code'; f.className = 'stack';
  f.innerHTML = `<label for="otp">Code reçu par e-mail</label>
    <input id="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required placeholder="123456">
    <button class="btn gold" type="submit">Valider le code</button>`;
  $('#sent', root).after(f);
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const token = ($('#otp', f) as HTMLInputElement).value.replace(/\s/g, '');
    const btn = $('button', f) as HTMLButtonElement; btn.disabled = true;
    const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    btn.disabled = false;
    if (error) toast('Code invalide ou expiré. Vérifiez-le ou demandez un nouvel e-mail.', 'err');
    // en cas de succès, onAuthStateChange (main.ts) prend le relais
  });
}

/** Arrivée depuis le lien de l'e-mail : la connexion n'a lieu qu'au clic, pour que les antivirus qui ouvrent les liens ne la consomment pas. */
export function verifyPage(root: HTMLElement, tokenHash: string, type: string) {
  root.innerHTML = `<section class="page narrow"><div class="box">
    <h1>Retour à bord</h1>
    <p class="lead">Encore un clic pour vous connecter.</p>
    <button class="btn gold big" id="go">Monter à bord</button>
  </div></section>`;
  const btn = $('#go', root) as HTMLButtonElement;
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'Connexion…';
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: (type || 'email') as any });
    if (!error) return; // onAuthStateChange (main.ts) prend le relais
    root.innerHTML = `<section class="page narrow"><div class="box">
      <h1>Lien expiré</h1>
      <p class="lead">Ce lien n'est plus valable : il a déjà servi ou il a expiré. Demandez-en un nouveau.</p>
      <a class="btn gold" href="#/connexion">Recevoir un nouveau lien</a>
    </div></section>`;
  };
}

export async function profilePage(root: HTMLElement, uid: string, email: string) {
  const { data } = await sb.from('profiles').select('pseudo').eq('id', uid).maybeSingle();
  root.innerHTML = `<section class="page narrow"><div class="box">
    <h1>Votre profil</h1>
    <form id="f" class="stack">
      <label for="pseudo">Pseudo affiché à la table</label>
      <input id="pseudo" maxlength="20" minlength="2" required value="${esc(data?.pseudo ?? '')}">
      <button class="btn gold" type="submit">Enregistrer</button>
    </form>
    <p class="muted">Connecté avec ${esc(email)}.</p>
    <button class="btn alt" id="out">Se déconnecter</button>
  </div></section>`;
  $('#f', root).addEventListener('submit', async ev => {
    ev.preventDefault();
    const pseudo = ($('#pseudo', root) as HTMLInputElement).value.trim();
    const { error } = await sb.from('profiles').update({ pseudo }).eq('id', uid);
    if (error) toast('Pseudo refusé : entre 2 et 20 caractères.', 'err'); else toast('Pseudo enregistré.');
  });
  $('#out', root).onclick = async () => { await sb.auth.signOut(); go('#/connexion'); };
}
