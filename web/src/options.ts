// Formulaire des options de partie (création et salon).
import { normalizeOpts, DEFAULT_OPTS, MAX_ROUNDS, roundsOf, type Opts } from '@engine';

const BASE: [keyof Opts, string, string][] = [
  ['kraken', 'Le Kraken', 'Détruit le pli.'],
  ['whale', 'La Baleine Fantôme', 'La plus haute carte numérotée gagne.'],
  ['loot', 'Pacte de Butin (×2)', 'Alliance avec le gagnant du pli.'],
  ['powers', 'Pouvoirs des pirates', 'Règle avancée.'],
];
const EXP: [keyof Opts, string, string][] = [
  ['con', 'Con le belliqueux', 'Bat les Pirates, perd contre Sirènes et Skull King.'],
  ['volley', 'Dernière Bordée', 'Rejouez une carte après tout le monde.'],
  ['ray', 'La Raie Étoilée', 'La plus petite carte numérotée gagne.'],
  ['davy', 'La Fosse des Noyés', 'Engloutit les monstres des abysses.'],
  ['plank', 'La Planche', 'Retire un Pirate du pli.'],
];
export function optionsHTML(o: Opts = DEFAULT_OPTS, editable = true, prefix = 'o') {
  const dis = editable ? '' : 'disabled';
  const box = ([k, t, s]: [keyof Opts, string, string], cls = '') => `<label class="${cls}"><input type="checkbox" id="${prefix}-${String(k)}" ${(o as any)[k] ? 'checked' : ''} ${dis}><span>${t}<small>${s}</small></span></label>`;
  const r = roundsOf(o);
  const rounds = Array.from({ length: MAX_ROUNDS }, (_, i) => MAX_ROUNDS - i)
    .map(n => `<option value="${n}" ${n === r ? 'selected' : ''}>${n === MAX_ROUNDS ? '10 manches (partie complète)' : `${n} manche${n > 1 ? 's' : ''}`}</option>`).join('');
  return `<fieldset><legend>Partie</legend>
      <label class="inline">Nombre de manches <select id="${prefix}-rounds" ${dis}>${rounds}</select></label>
      <p class="rnote" id="${prefix}-ranked" role="status" aria-live="polite"></p></fieldset>
    <fieldset><legend>Jeu de base</legend><div class="opts">${BASE.map(x => box(x)).join('')}
      <label style="grid-column:1/-1;align-items:center">Score <select id="${prefix}-score" style="width:auto;margin-left:6px" ${dis}><option value="sk" ${o.score === 'sk' ? 'selected' : ''}>Skull King (classique)</option><option value="rascal" ${o.score === 'rascal' ? 'selected' : ''}>Rascal (équilibré)</option></select></label></div></fieldset>
    <fieldset><legend>Extension</legend><div class="opts">${box(['exp', "Cartes de base de l'extension", '7 (−5), 8 (+5), 0/14, Grand Quinze, Marie Thorne.'])}${EXP.map(x => box(x, 'xo')).join('')}</div></fieldset>`;
}
export function readOptions(root: ParentNode, prefix = 'o'): Opts {
  const g = (k: string) => (root.querySelector(`#${prefix}-${k}`) as HTMLInputElement | null)?.checked ?? false;
  const o: any = {}; for (const [k] of [...BASE, ...EXP]) o[k] = g(k as string); o.exp = g('exp');
  o.score = (root.querySelector(`#${prefix}-score`) as HTMLSelectElement | null)?.value ?? 'sk';
  o.rounds = Number((root.querySelector(`#${prefix}-rounds`) as HTMLSelectElement | null)?.value ?? MAX_ROUNDS);
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
  const r = roundsOf(o);
  return `${r} manche${r > 1 ? 's' : ''} · ` + on.join(' · ') + ` · score ${o.score === 'rascal' ? 'Rascal' : 'classique'}`;
}

/** Places de la table au lancement : humains présents, bots, et sièges « Ami » encore libres (un bot les prend au lancement). */
export interface TableMix { humans: number; bots: number; free: number }
/** La partie comptera-t-elle pour l'Élo ? Même règle que le serveur (settle.ts) : au moins deux humains, aucun bot, 10 manches. */
export function rankedStatus(o: Opts, t: TableMix): { cls: 'ok' | 'maybe' | 'no'; text: string } {
  const r = roundsOf(o), why: string[] = [];
  if (r < MAX_ROUNDS) why.push(`elle dure ${r} manche${r > 1 ? 's' : ''} au lieu de 10`);
  if (t.bots) why.push(`${t.bots === 1 ? 'un bot est' : `${t.bots} bots sont`} à la table`);
  if (!t.bots && t.humans + t.free < 2) why.push('il faut au moins deux joueurs humains');
  if (why.length) {
    const list = why.length > 1 ? why.slice(0, -1).join(', ') + ' et ' + why[why.length - 1] : why[0];
    return { cls: 'no', text: `Partie non classée : elle ne comptera pas pour l'Élo, car ${list}. L'XP, les pièces et le coffre de victoire comptent quand même.` };
  }
  if (t.free) return { cls: 'maybe', text: t.free === 1
    ? "Partie classée seulement si la place libre est occupée au lancement : sinon un bot la prend et la partie ne comptera pas pour l'Élo."
    : `Partie classée seulement si les ${t.free} places libres sont occupées au lancement : sinon des bots les prennent et la partie ne comptera pas pour l'Élo.` };
  return { cls: 'ok', text: "Partie classée : elle comptera pour l'Élo (10 manches, uniquement des joueurs humains)." };
}
/** Met à jour l'encadré « classée / non classée » du formulaire d'options ; `practice` : entraînement, ni XP ni Élo. */
export function paintRanked(root: ParentNode, prefix: string, t: TableMix | 'practice') {
  const el = root.querySelector(`#${prefix}-ranked`) as HTMLElement | null; if (!el) return;
  const st = t === 'practice' ? { cls: 'no', text: "Partie d'entraînement : elle ne rapporte ni XP ni Élo." } : rankedStatus(readOptions(root, prefix), t);
  el.className = 'rnote ' + st.cls; el.textContent = st.text;
}
