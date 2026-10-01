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
    s.innerHTML = `Lien envoyé à <b>${esc(email)}</b>. Ouvrez-le sur cet appareil pour vous connecter.`;
  });
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
