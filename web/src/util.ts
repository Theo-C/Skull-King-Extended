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

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
