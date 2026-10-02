export const $ = <T extends HTMLElement = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector(s) as T;
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Petite notification en bas de l'écran. */
export function toast(msg: string, kind: 'ok' | 'err' = 'ok') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  document.body.append(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
}

/** Fenêtre modale ; renvoie la valeur du bouton cliqué. */
export function modal(html: string, buttons: { label: string; value: any; cls?: string }[] = [{ label: 'Fermer', value: null }]): Promise<any> {
  const m = $('#modal'); const body = $('#modalBody');
  body.innerHTML = html + '<div class="foot"></div>';
  const foot = $('.foot', body);
  return new Promise(res => {
    buttons.forEach(b => {
      const el = document.createElement('button'); el.className = 'btn ' + (b.cls || 'gold'); el.textContent = b.label;
      el.onclick = () => { m.hidden = true; res(b.value); }; foot.append(el);
    });
    m.hidden = false; m.scrollTop = 0;
  });
}
export const closeModal = () => { $('#modal').hidden = true; };

/** Copie dans le presse-papiers ; repli sur l'ancienne méthode (zone de texte + execCommand) si l'API est refusée. */
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* repli ci-dessous */ }
  try {
    const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
  } catch { return false; }
}

const DAY = 86400000;
/** « Aujourd'hui », « Hier », « Mardi » (cette semaine), sinon « 26 sept. ». */
export function relDay(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / DAY);
  if (days <= 0) return "Aujourd'hui"; if (days === 1) return 'Hier';
  if (days < 7) { const w = d.toLocaleDateString('fr-FR', { weekday: 'long' }); return w[0].toUpperCase() + w.slice(1); }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}
/** « +12 » / « −3 » (vrai signe moins), arrondi à l'entier sauf précision demandée. */
export const signed = (v: number, digits = 0) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(digits).replace('.', ',');
/** « de Maëlle », « d'Aurore », « d'Élise » : élision devant une voyelle (accentuée ou non), pas devant un h. */
export const de = (nom: string) => { const n = String(nom ?? '').trim(); return (/^[aeiouyàâäéèêëîïôöûüùœæ]/i.test(n) ? "d'" : 'de ') + n; };
