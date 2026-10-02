// Agrandissement d'une carte : survol prolongé à la souris, appui long au doigt, focus au clavier (cartes de la main).
// Les faces font 252 × 352 px : en grand, le texte des cartes spéciales devient lisible.
let installed = false;
/** Pastille sous la carte agrandie (maquette Main : « Prendrait le pli »…), fournie par la table. */
type Note = { text: string; ink: string } | null;
let noteFor: ((card: HTMLElement) => Note) | null = null;
export function setZoomNote(fn: ((card: HTMLElement) => Note) | null) { noteFor = fn; }

export function installCardZoom() {
  if (installed) return; installed = true;
  const pv = document.createElement('div'); pv.className = 'zoom'; pv.hidden = true; pv.setAttribute('aria-hidden', 'true');
  document.body.append(pv);
  let timer: any = null, shownFor: HTMLElement | null = null, pending: HTMLElement | null = null, suppressClick = false;

  const show = (card: HTMLElement) => {
    const face = card.querySelector('.face'); if (!face || !card.isConnected) return;
    const tag = card.querySelector('.tag'), note = noteFor?.(card) ?? null;
    pv.innerHTML = `<div class="card zc">${face.outerHTML}${tag ? tag.outerHTML : ''}</div>`;
    if (note) { const s = document.createElement('span'); s.className = 'znote'; s.style.color = note.ink; s.textContent = note.text; pv.append(s); }
    pv.hidden = false; shownFor = card;
    const r = card.getBoundingClientRect(), w = pv.offsetWidth, h = pv.offsetHeight, m = 10;
    // au-dessus de la carte si possible, sinon à côté
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - 14;
    if (y < m) { y = Math.min(Math.max(m, r.top + r.height / 2 - h / 2), innerHeight - h - m); x = r.right + 14 + w < innerWidth - m ? r.right + 14 : r.left - 14 - w; }
    pv.style.left = Math.min(Math.max(m, x), innerWidth - w - m) + 'px'; pv.style.top = Math.max(m, y) + 'px';
  };
  const hide = () => { clearTimeout(timer); timer = null; pv.hidden = true; shownFor = null; pending = null; };
  const cardAt = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.('.card:not(.zc)') as HTMLElement | null;

  document.addEventListener('pointerover', ev => {
    if (ev.pointerType !== 'mouse') return;
    const c = cardAt(ev.target); if (c === shownFor || (c && c === pending)) return;
    hide(); pending = c; if (c) timer = setTimeout(() => show(c), 420);
  });
  document.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse') { hide(); return; }
    const c = cardAt(ev.target); hide(); if (!c) return;
    timer = setTimeout(() => { show(c); suppressClick = true; }, 380);
  });
  const end = () => { if (timer && !shownFor) { clearTimeout(timer); timer = null; } else if (shownFor) hide(); };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  // au clavier : une carte de la main qui reçoit le focus s'agrandit, et se referme quand elle le perd
  document.addEventListener('focusin', ev => {
    const c = (ev.target as HTMLElement | null)?.closest?.('#hand .card') as HTMLElement | null;
    if (c && c.matches(':focus-visible')) { hide(); show(c); }
  });
  document.addEventListener('focusout', ev => { if (shownFor && ev.target === shownFor) hide(); });
  document.addEventListener('keydown', ev => { if (shownFor && (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ')) hide(); });
  // après un appui long, on n'enchaîne pas sur un « clic » qui jouerait la carte
  document.addEventListener('click', ev => { if (suppressClick) { suppressClick = false; ev.stopPropagation(); ev.preventDefault(); } }, true);
  document.addEventListener('contextmenu', ev => { if (cardAt(ev.target)) ev.preventDefault(); });
  addEventListener('scroll', hide, true); addEventListener('blur', hide);
}
