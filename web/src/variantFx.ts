// Variantes des cartes (B8) : reflets qui suivent la souris (ou l'inclinaison du téléphone), sinon mouvement lent
// automatique (classe .auto) ; et plafond de cartes animées à l'écran pour ménager les petits appareils.

/** Au-delà de ce nombre de cartes à effets visibles (main + pli), seules la carte survolée et celles du pli bougent. */
export const MAX_ANIMATED = 8;

let installed = false;
export function installVariantFx() {
  if (installed || typeof document === 'undefined') return; installed = true;

  // souris : la carte survolée suit le pointeur (--mx, --my), les autres gardent leur mouvement lent
  let live: HTMLElement | null = null;
  const release = () => { if (!live) return; live.classList.remove('live'); if (!live.classList.contains('still')) live.classList.add('auto'); live = null; schedule(); };
  document.addEventListener('pointermove', ev => {
    if (ev.pointerType !== 'mouse') return;
    const card = (ev.target as Element | null)?.closest?.('.card') as HTMLElement | null, art = card?.querySelector<HTMLElement>('.art.fx') ?? null;
    if (art !== live) { release(); if (art) { live = art; art.classList.add('live'); art.classList.remove('auto', 'capped'); } }
    if (!art || !card) return;
    const r = card.getBoundingClientRect();
    art.style.setProperty('--mx', Math.round((ev.clientX - r.left) / r.width * 100) + '%');
    art.style.setProperty('--my', Math.round((ev.clientY - r.top) / r.height * 100) + '%');
  }, { passive: true });
  document.addEventListener('pointerleave', release);

  // téléphone : l'inclinaison pilote les reflets de toutes les cartes
  if (matchMedia('(pointer: coarse)').matches && 'DeviceOrientationEvent' in window) {
    addEventListener('deviceorientation', (ev: DeviceOrientationEvent) => {
      if (ev.gamma == null || ev.beta == null) return;
      const h = document.documentElement, clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
      h.classList.add('tilt');
      h.style.setProperty('--tmx', clamp(50 + ev.gamma * 1.6) + '%');
      h.style.setProperty('--tmy', clamp(30 + (ev.beta - 45) * 1.2) + '%');
    }, { passive: true });
  }

  // plafond : recalculé après chaque changement de la page (au plus une fois par image)
  let pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; limit(); }); }
  function limit() {
    const arts = [...document.querySelectorAll<HTMLElement>('.art.fx')].filter(a => a.getClientRects().length > 0 && !a.classList.contains('still'));
    const over = arts.length > MAX_ANIMATED;
    for (const a of arts) a.classList.toggle('capped', over && a !== live && !a.closest('.tslot'));
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}
