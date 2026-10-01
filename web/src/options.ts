// Formulaire des options de partie (création et salon).
import { normalizeOpts, DEFAULT_OPTS, type Opts } from '@engine';

const BASE: [keyof Opts, string, string][] = [
  ['kraken', 'Le Kraken', 'Détruit le pli.'],
  ['whale', 'La Baleine Fantôme', 'La plus haute carte numérotée gagne.'],
  ['loot', 'Pacte de Butin (×2)', 'Alliance avec le gagnant du pli.'],
  ['powers', 'Pouvoirs des pirates', 'Règle avancée.'],
];
const EXP: [keyof Opts, string, string][] = [
  ['con', 'Corbin, le Second', 'Bat les Pirates, perd contre Sirènes et Barbe-Cendre.'],
  ['volley', 'Dernière Bordée', 'Rejouez une carte après tout le monde.'],
  ['ray', 'La Raie Étoilée', 'La plus petite carte numérotée gagne.'],
  ['davy', 'La Fosse des Noyés', 'Engloutit les monstres des abysses.'],
  ['plank', 'La Planche', 'Retire un Pirate du pli.'],
];
export function optionsHTML(o: Opts = DEFAULT_OPTS, editable = true, prefix = 'o') {
  const dis = editable ? '' : 'disabled';
  const box = ([k, t, s]: [keyof Opts, string, string], cls = '') => `<label class="${cls}"><input type="checkbox" id="${prefix}-${String(k)}" ${(o as any)[k] ? 'checked' : ''} ${dis}><span>${t}<small>${s}</small></span></label>`;
  return `<fieldset><legend>Jeu de base</legend><div class="opts">${BASE.map(x => box(x)).join('')}
      <label style="grid-column:1/-1;align-items:center">Score <select id="${prefix}-score" style="width:auto;margin-left:6px" ${dis}><option value="sk" ${o.score === 'sk' ? 'selected' : ''}>Skull King (classique)</option><option value="rascal" ${o.score === 'rascal' ? 'selected' : ''}>Rascal (équilibré)</option></select></label></div></fieldset>
    <fieldset><legend>Extension</legend><div class="opts">${box(['exp', "Cartes de base de l'extension", '7 (−5), 8 (+5), 0/14, Grand Quinze, Lise Fil-de-Soie.'])}${EXP.map(x => box(x, 'xo')).join('')}</div></fieldset>`;
}
export function readOptions(root: ParentNode, prefix = 'o'): Opts {
  const g = (k: string) => (root.querySelector(`#${prefix}-${k}`) as HTMLInputElement | null)?.checked ?? false;
  const o: any = {}; for (const [k] of [...BASE, ...EXP]) o[k] = g(k as string); o.exp = g('exp');
  o.score = (root.querySelector(`#${prefix}-score`) as HTMLSelectElement | null)?.value ?? 'sk';
  return normalizeOpts(o);
}
/** Grise les options d'extension si l'extension est retirée, et la Fosse s'il n'y a aucun monstre. */
export function wireOptions(root: ParentNode, prefix = 'o', onChange?: () => void) {
  const q = (k: string) => root.querySelector(`#${prefix}-${k}`) as HTMLInputElement | null;
  const sync = () => {
    const on = !!q('exp')?.checked;
    for (const [k] of EXP) { const el = q(k as string); if (el && !el.hasAttribute('data-ro')) { el.disabled = !on || el.dataset.lock === '1'; (el.closest('label') as HTMLElement).style.opacity = on ? '1' : '.5'; } }
    const mon = !!q('kraken')?.checked || !!q('whale')?.checked || (on && !!q('ray')?.checked);
    const d = q('davy'); if (d && !mon) { d.checked = false; d.disabled = true; (d.closest('label') as HTMLElement).style.opacity = '.5'; }
  };
  root.querySelectorAll(`[id^="${prefix}-"]`).forEach(el => el.addEventListener('change', () => { sync(); onChange?.(); }));
  sync();
}
export function optionsSummary(o: Opts) {
  const on = [...BASE, ...(o.exp ? [['exp', 'Extension', ''] as any, ...EXP] : [])].filter(([k]) => (o as any)[k]).map(([, t]) => t);
  return on.join(' · ') + ` · score ${o.score === 'rascal' ? 'Rascal' : 'classique'}`;
}
