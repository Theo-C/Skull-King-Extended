// Page des règles (#/regles) : même contenu que la fenêtre de la table.
import { rulesHTML } from '../rules';

export function rulesPage(root: HTMLElement) {
  root.innerHTML = `<section class="page"><div class="box sheetlike rulespage">${rulesHTML()}</div></section>`;
}
