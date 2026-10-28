// Collection (D14, docs/boosters/SPEC.md « Collection », maquette Collection) : chaque carte dans la variante qu'on joue,
// pastilles des variantes possédées, grande carte inclinable, liste des 8 variantes, « Utiliser en partie », aperçu à la
// table et récompenses de collection. Fabriquer (au choix, ×4) et Recycler les doublons, comme dans l'Atelier (D15).
import '../styles/collection.css';
import { callGame } from '../api';
import { esc, toast } from '../util';
import { cardHTML } from '../cards';
import { CARDS, CARD_BY_ID, VARIANTS, VARIANT_INFO, COLLECTIBLE, SERIES, pickCost, recycleValue, type Variant, type Family } from '@shared/collection.ts';

export interface CollState {
  owned: { card_id: string; variant: Variant; copies: number; serial: number | null }[];
  choices: Record<string, Variant>; total: number; coins: number; shards: number; boosters: number; free_today: boolean; free_daily: boolean;
}
const FILTERS: [string, string, (f: Family) => boolean][] = [
  ['all', 'Toutes', () => true], ['pir', 'Pirates', f => f === 'pir'], ['cre', 'Créatures et spéciales', f => f === 'cre'],
  ['yellow', 'Jaune', f => f === 'yellow'], ['green', 'Vert', f => f === 'green'], ['purple', 'Violet', f => f === 'purple'], ['black', 'Noir', f => f === 'black'],
];
const HOW: Record<Variant, string> = {
  std: 'Tout le monde l’a.',
  patine: 'Taches et craquelures de vieux parchemin sur l’illustration et toute la marge. Les couleurs ne changent pas.',
  etain: 'Marge en étain brossé, rivets aux quatre coins.',
  holo: 'Feuille holographique sur le fond de l’illustration, qui suit le mouvement ; personnage et cadre intacts, marge irisée.',
  vivante: 'L’illustration bouge doucement en deux plans sous le cadre immobile ; la mer ondule sur les cartes marines.',
  nacre: 'Marge en nacre irisée et reflets.',
  signee: 'Marge crème dorée et signature dorée à chaud sur l’illustration (le personnage, ou Barbe-Grise le cartographe).',
  numero: 'Signée, Vivante et Holo, avec un numéro gravé dans la marge : 100 exemplaires par carte et par saison. Ni fabricable ni recyclable.',
};
const RARITY: Record<string, string> = { c: 'Commune', r: 'Rare', e: 'Épique', l: 'Légendaire', m: 'Mythique' };
const sOf = (w: number) => `style="--s:${(w / 252).toFixed(4)}"`;
export const fmt = (n: number) => n.toLocaleString('fr-FR');

/** Accès au serveur (remplaçable par le banc d'essai web/banc/). */
export type CallGame = <T = any>(action: string, payload?: Record<string, unknown>) => Promise<T>;
export async function collectionPage(root: HTMLElement, query = new URLSearchParams(), api: CallGame = callGame) {
  root.innerHTML = '<section class="coll"><p class="lbl">Ouverture de la collection…</p></section>';
  let st: CollState;
  try { st = await api<CollState>('collection.list', {}); }
  catch (e: any) { root.innerHTML = `<section class="coll"><h1>Collection</h1><p class="lbl">${esc(e.message)}</p></section>`; return; }
  let filter = 'all', sel = CARD_BY_ID[query.get('carte') ?? ''] ? query.get('carte')! : 'rosie', view: Variant | null = null, busy = false;

  const own = () => { const m = new Map<string, { copies: number; serial: number | null }>(); for (const o of st.owned) m.set(o.card_id + ':' + o.variant, o); return m; };
  const played = (id: string): Variant => st.choices[id] ?? 'std';
  const card = (id: string, v: Variant, w: number, extra = '', still = false, attrs = '') => {
    const o = own().get(id + ':' + v);
    return cardHTML({ id: 0, ...CARD_BY_ID[id].card }, null, extra, `${sOf(w)} ${attrs}`, { variant: v, serial: o?.serial ?? 42, still });
  };

  const paint = () => {
    const O = own(), c = CARD_BY_ID[sel], eq = played(sel), v = view ?? eq, vi = VARIANT_INFO[v];
    const cnt = v === 'std' ? 1 : O.get(sel + ':' + v)?.copies ?? 0, pctDone = st.owned.length / st.total * 100;
    const pips = (id: string) => VARIANTS.map(x => `<i style="background:${x === 'std' || O.has(id + ':' + x) ? VARIANT_INFO[x].color : 'rgba(234,208,138,.14)'}"></i>`).join('');
    const f = FILTERS.find(x => x[0] === filter)!;
    root.innerHTML = `<section class="coll">
      <header class="coll-head">
        <h1>Collection</h1><span class="coll-ser">Série 1 · <b>${esc(SERIES.name)}</b></span>
        <span class="coll-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${st.total}" aria-valuenow="${st.owned.length}"><i style="width:${pctDone.toFixed(1)}%"></i></span>
        <span class="lbl">${fmt(st.owned.length)} / ${fmt(st.total)} variantes</span>
        <span class="coll-wallet"><span class="pill"><span class="coin"></span><b>${fmt(st.coins)}</b></span><span class="pill shard"><b>◆ ${fmt(st.shards)}</b> éclats</span>
          <a class="pill" href="#/boosters"><b>${st.boosters}</b> booster${st.boosters > 1 ? 's' : ''} · Ouvrir</a><a class="pill" href="#/atelier">Atelier</a></span>
      </header>
      <div class="coll-cols">
        <div class="coll-grid-w">
          <div class="coll-chips">${FILTERS.map(([k, l]) => `<button type="button" class="chip${filter === k ? ' on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
          <div class="coll-grid">${CARDS.filter(x => f[2](x.family)).map(x => `<button type="button" class="ct${x.id === sel ? ' on' : ''}" data-c="${x.id}" aria-label="${esc(x.name)} · ${esc(VARIANT_INFO[played(x.id)].name)}">
            ${card(x.id, played(x.id), 74, '', true)}<span class="pips" aria-hidden="true">${pips(x.id)}</span></button>`).join('')}</div>
        </div>
        <div class="coll-big">
          <span class="lbl">Survolez la carte pour la faire bouger</span>
          <div class="coll-tilt" id="tilt">${card(sel, v, 250, cnt ? '' : 'lockd')}</div>
          <b class="coll-name">${esc(c.name)}</b>
          <span class="coll-vn"><span class="vpill${v === 'numero' ? ' myth' : ''}" style="--vc:${vi.color}">${vi.tier ? RARITY[vi.tier] : 'Base'}</span><b>${esc(vi.name)}</b><i>${esc(vi.official)}</i></span>
          <span class="coll-sm-t">Lisibilité à la taille de la main mobile</span>
          <div class="coll-sm">${VARIANTS.map(x => card(sel, x, 32, '', true)).join('')}</div>
        </div>
        <div class="coll-vars box">
          <div class="h">Variantes</div>
          ${VARIANTS.map(x => { const n = x === 'std' ? 1 : O.get(sel + ':' + x)?.copies ?? 0, xi = VARIANT_INFO[x];
            return `<button type="button" class="vr${x === v ? ' on' : ''}${n ? '' : ' lock'}" data-v="${x}"><span class="mini">${card(sel, x, 38, '', true)}</span>
              <span class="vr-t"><b>${esc(xi.name)}</b>${eq === x ? '<span class="eq">EN JEU</span>' : ''}<small><span style="color:${xi.color}">${xi.stars || 'Base'}</span> · ${esc(xi.official)}</small></span>
              <span class="vr-n">${n ? (x === 'std' ? '' : '×' + n) : '🔒'}</span></button>`; }).join('')}
          <div class="vr-how">
            <p>${esc(HOW[v])}${cnt ? '' : ' Pas encore obtenue.'}</p>
            <div class="vr-btns">
              <button type="button" class="gold" id="equip"${!cnt || eq === v || busy ? ' disabled' : ''}>${eq === v ? 'Utilisée en partie ✓' : cnt ? 'Utiliser en partie' : 'Pas encore obtenue'}</button>
              ${!cnt && v !== 'std' && v !== 'numero' ? `<button type="button" id="craft"${st.shards < pickCost(v) || busy ? ' disabled' : ''}>Fabriquer · ${fmt(pickCost(v))} ◆</button>` : ''}
              ${cnt > 1 && v !== 'numero' ? `<button type="button" id="recycle"${busy ? ' disabled' : ''}>Recycler ${cnt - 1} doublon${cnt > 2 ? 's' : ''} · +${fmt((cnt - 1) * recycleValue(v))} ◆</button>` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="coll-table">
        <div class="h">À la table : chacun voit la variante que vous avez choisie</div>
        <div class="coll-trick">
          ${[['kraken', 'nacre', 'Maëlle'], ['g12', 'etain', 'Corentin'], [sel, eq, 'Vous'], ['b14', 'std', 'Ysolde']].map(([id, x, who]) =>
            `<figure>${card(id, x as Variant, 112, '', false, `data-owner="${esc(who)}"`)}<figcaption>${esc(who)} · ${esc(VARIANT_INFO[x as Variant].name)}</figcaption></figure>`).join('')}
          <p>Au survol long d’une carte posée : « Holographique · Théo ». La variante ne change jamais la valeur de la carte, seulement son apparence. Le réglage « Cartes des autres : Standard » de la table les affiche toutes en Standard.</p>
        </div>
      </div>
      ${rewardsHTML(O)}
    </section>`;
    wire();
  };

  const wire = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f!; paint(); });
    root.querySelectorAll<HTMLButtonElement>('.ct').forEach(b => b.onclick = () => { sel = b.dataset.c!; view = null; paint(); });
    root.querySelectorAll<HTMLButtonElement>('.vr').forEach(b => b.onclick = () => { view = b.dataset.v as Variant; paint(); });
    const eqb = root.querySelector<HTMLButtonElement>('#equip');
    if (eqb) eqb.onclick = async () => {
      const v = view ?? played(sel); busy = true; eqb.disabled = true;
      try {
        await api('collection.choose', { cardId: sel, variant: v });
        if (v === 'std') delete st.choices[sel]; else st.choices[sel] = v;
        toast(`${CARD_BY_ID[sel].name} : ${VARIANT_INFO[v].name} en partie`);
      } catch (e: any) { toast(e.message, 'err'); }
      busy = false; paint();
    };
    root.querySelector<HTMLButtonElement>('#craft')?.addEventListener('click', async () => {
      const v = view ?? played(sel); busy = true; paint();
      try { const r = await api<any>('collection.craft', { mode: 'pick', cardId: sel, variant: v }); st.shards = r.shards; st.owned.push({ card_id: sel, variant: v, copies: 1, serial: null }); toast(`${CARD_BY_ID[sel].name} ${VARIANT_INFO[v].name} fabriquée · −${fmt(r.cost)} ◆`); }
      catch (e: any) { toast(e.message, 'err'); }
      busy = false; paint();
    });
    root.querySelector<HTMLButtonElement>('#recycle')?.addEventListener('click', async () => {
      const v = view ?? played(sel); busy = true; paint();
      try { const r = await api<any>('collection.recycle', { cardId: sel, variant: v }); st.shards = r.shards; const o = st.owned.find(x => x.card_id === sel && x.variant === v); if (o) o.copies = 1; toast(`+${r.shards_gained} ◆ éclats`); }
      catch (e: any) { toast(e.message, 'err'); }
      busy = false; paint();
    });
    // grande carte inclinable (les reflets suivent déjà la souris : variantFx.ts)
    const t = root.querySelector<HTMLElement>('#tilt');
    if (t) {
      t.onpointermove = ev => { const r = t.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height; t.style.setProperty('--ry', ((x - .5) * 22).toFixed(1) + 'deg'); t.style.setProperty('--rx', ((.5 - y) * 18).toFixed(1) + 'deg'); };
      t.onpointerleave = () => { t.style.setProperty('--ry', '0deg'); t.style.setProperty('--rx', '0deg'); };
    }
  };
  paint();
}

/** Récompenses de collection (SPEC) : une famille complète en Holographique → un dos de carte ; les 7 variantes d'une
 *  carte → le titre « Collectionneur de … ». Progression affichée ici. */
function rewardsHTML(O: Map<string, unknown>) {
  const fam: [Family, string][] = [['green', 'cartes vertes'], ['yellow', 'cartes jaunes'], ['purple', 'cartes violettes'], ['black', 'cartes noires'], ['pir', 'pirates'], ['cre', 'créatures et spéciales']];
  const famRows = fam.map(([f, l]) => { const cs = CARDS.filter(c => c.family === f), n = cs.filter(c => O.has(c.id + ':holo')).length;
    return `<li><span>Toutes les ${l} en Holographique</span><span class="coll-bar sm"><i style="width:${(n / cs.length * 100).toFixed(0)}%"></i></span><b>${n} / ${cs.length}</b><em>Dos de carte</em></li>`; });
  const best = CARDS.map(c => ({ c, n: COLLECTIBLE.filter(v => O.has(c.id + ':' + v)).length })).sort((a, b) => b.n - a.n).slice(0, 3);
  const cardRows = best.map(({ c, n }) => `<li><span>Les 7 variantes de ${esc(c.name)}</span><span class="coll-bar sm"><i style="width:${(n / 7 * 100).toFixed(0)}%"></i></span><b>${n} / 7</b><em>Titre « Collectionneur de ${esc(c.family === 'pir' || c.family === 'cre' ? c.name.replace(/^(Le|La) /, '').split(/[ ,]/)[0] : c.name)} »</em></li>`);
  return `<div class="coll-rew box"><div class="h">Récompenses de collection</div><ul>${famRows.join('')}${cardRows.join('')}</ul></div>`;
}
