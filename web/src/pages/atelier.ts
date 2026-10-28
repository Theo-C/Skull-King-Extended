// Atelier (D15, docs/boosters/ATELIER.md, maquette Atelier) : recycler les doublons en éclats, fabriquer au hasard
// par rareté (prix de base, jamais une variante déjà possédée) ou au choix (×4). Les Numérotées ne se fabriquent pas.
import '../styles/atelier.css';
import { callGame } from '../api';
import { esc, toast } from '../util';
import { cardHTML } from '../cards';
import { sfx } from '../sfx';
import type { CallGame, CollState } from './collection';
import { CARDS, CARD_BY_ID, VARIANT_INFO, VARIANTS_OF, SHARDS, TIER_NAME, TIER_OF, recycleValue, pickCost, type Variant, type Family } from '@shared/collection.ts';

type T4 = 'c' | 'r' | 'e' | 'l';
const TIERS: T4[] = ['c', 'r', 'e', 'l'];
const TC: Record<T4, string> = { c: '#c9d3dc', r: '#6cb8ff', e: '#c79bff', l: '#ffc94a' };
const VL: Record<T4, string> = { c: 'Patinée, Étain', r: 'Holo', e: 'Nacre, Vivante', l: 'Signée' };
const PICKABLE: Variant[] = ['patine', 'etain', 'holo', 'nacre', 'vivante', 'signee'];
const FAMS: [string, string, (f: Family) => boolean][] = [['all', 'Toutes', () => true], ['pir', 'Pirates', f => f === 'pir'], ['cre', 'Créatures', f => f === 'cre'], ['suit', 'Couleurs', f => f !== 'pir' && f !== 'cre']];
const fmt = (n: number) => n.toLocaleString('fr-FR');
const card = (id: string, v: Variant, w: number, extra = '', still = false) => cardHTML({ id: 0, ...CARD_BY_ID[id].card }, null, extra, `style="--s:${(w / 252).toFixed(4)}"`, { variant: v, still });
const back = (w: number) => `<div class="card bo-dos" style="--s:${(w / 252).toFixed(4)}"><div class="face"><img src="cards/dos.webp" alt="" draggable="false"></div></div>`;

export async function atelierPage(root: HTMLElement, query = new URLSearchParams(), api: CallGame = callGame) {
  root.innerHTML = '<section class="at"><p class="lbl">Ouverture de l’atelier…</p></section>';
  let st: CollState;
  try { st = await api<CollState>('collection.list', {}); }
  catch (e: any) { root.innerHTML = `<section class="at"><h1>Atelier</h1><p class="lbl">${esc(e.message)}</p></section>`; return; }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode: 'rand' | 'pick' = query.get('carte') ? 'pick' : 'rand', tier: T4 = 'r', fam = 'all';
  let sel = CARD_BY_ID[query.get('carte') ?? ''] ? query.get('carte')! : 'rosie', pv: Variant = (PICKABLE as string[]).includes(query.get('variante') ?? '') ? query.get('variante') as Variant : 'vivante';
  let phase: 'idle' | 'forging' | 'shown' | 'reveal' | 'made' = 'idle', res: { card_id: string; variant: Variant } | null = null, busy = false;

  const owned = () => new Set(st.owned.map(o => o.card_id + ':' + o.variant));
  const missing = (t: T4) => { const O = owned(); return CARDS.flatMap(c => VARIANTS_OF[t].filter(v => !O.has(c.id + ':' + v)).map(v => ({ card_id: c.id, variant: v }))); };
  const dups = () => st.owned.filter(o => o.copies > 1 && o.variant !== 'numero');

  const paint = () => {
    const O = owned(), d = dups(), dupTotal = d.reduce((a, o) => a + (o.copies - 1) * recycleValue(o.variant), 0);
    const byTier = TIERS.map(t => ({ t, n: d.filter(o => TIER_OF[o.variant as Exclude<Variant, 'std'>] === t).reduce((a, o) => a + o.copies - 1, 0) })).filter(x => x.n);
    const forging = phase === 'forging', tc = mode === 'rand' ? TC[tier] : TC[TIER_OF[pv as Exclude<Variant, 'std'>] as T4];
    const motes = forging ? Array.from({ length: 26 }, (_, i) => { const a = i * 2.4, r = 170 + (i * 53) % 120; return `<i class="mote" style="--x:${Math.round(Math.cos(a) * r)}px;--y:${Math.round(Math.sin(a) * r)}px;--d:${((i % 9) * .05).toFixed(2)}s"></i>`; }).join('') : '';
    root.innerHTML = `<section class="at">
      <header class="at-head"><h1>Atelier</h1><span class="sub">Fabriquer des cartes avec les éclats</span>
        <span class="at-w"><span><span class="coin"></span> ${fmt(st.coins)}</span><b class="sh">◆ ${fmt(st.shards)} éclats</b><a href="#/collection">Collection</a><a href="#/boosters">Boosters</a></span></header>
      <div class="at-cols">
        <aside class="at-panel">
          <h2 class="h">Recycler les doublons</h2>
          <p class="txt">On garde toujours 1 exemplaire de chaque variante. Les doublons des boosters sont déjà recyclés à l’ouverture ; ici, ceux gagnés autrement (récompenses, défis).</p>
          ${byTier.length ? byTier.map(x => `<div class="dl"><span><b>${x.n} ×</b> ${esc(TIER_NAME[x.t])}</span><span class="g">+${fmt(x.n * SHARDS.recycle[x.t])} ◆</span></div>`).join('') : '<p class="txt dim">Aucun doublon à recycler.</p>'}
          <div class="tot"><b>Total</b><span class="g">+${fmt(dupTotal)} ◆</span></div>
          <button type="button" class="at-btn blue wide" id="recAll"${dupTotal && !busy ? '' : ' disabled'}>${dupTotal ? `Tout recycler · +${fmt(dupTotal)} ◆` : 'Plus aucun doublon'}</button>
          <div class="lbl">Valeur d’un doublon</div>
          ${TIERS.map(t => `<div class="dl"><span style="color:${TC[t]};font-weight:800">${TIER_NAME[t]}</span><span>${SHARDS.recycle[t]} ◆</span></div>`).join('')}
          <p class="txt dim">Numérotée : jamais en doublon, ni recyclable ni fabricable.</p>
        </aside>
        <div class="at-mid">
          <div class="at-tabs" role="tablist">${([['rand', 'Au hasard'], ['pick', 'Au choix (×4)']] as const).map(([k, l]) => `<button type="button" role="tab" class="tab${mode === k ? ' on' : ''}" data-mode="${k}" aria-selected="${mode === k}">${l}</button>`).join('')}</div>
          ${mode === 'rand' ? randHTML(O, forging, tc, motes) : pickHTML(O, forging, tc, motes)}
        </div>
        <aside class="at-panel at-prices">
          <h2 class="h">Prix</h2>
          <table><tr class="hd"><td>Rareté</td><td>Recyclé</td><td>Au hasard</td><td>Au choix</td></tr>
          ${TIERS.map(t => `<tr><td style="color:${TC[t]}">${TIER_NAME[t]}</td><td>${SHARDS.recycle[t]}</td><td>${fmt(SHARDS.random[t])}</td><td>${fmt(SHARDS.random[t] * SHARDS.pickFactor)}</td></tr>`).join('')}
          <tr><td style="color:#e7c6ff">Numérotée</td><td>—</td><td>—</td><td>—</td></tr></table>
          <div class="note"><b>Hasard ou choix</b><p>Au hasard : prix de base, une variante que vous n’avez pas encore dans la rareté choisie. Au choix : la carte et la variante exactes, 4 fois plus cher.</p></div>
          <div class="note"><b>Jamais de doublon fabriqué</b><p>Le tirage au hasard ne pioche que dans ce qui vous manque. Quand tout est complété dans une rareté, le bouton se désactive.</p></div>
          <div class="note"><b>Rapport 1 pour 4</b><p>Un doublon rapporte un quart du prix au hasard, comme la poussière arcanique de Hearthstone.</p></div>
        </aside>
      </div></section>`;
    wire();
  };
  const randHTML = (O: Set<string>, forging: boolean, tc: string, motes: string) => {
    const miss = missing(tier), cost = SHARDS.random[tier], can = miss.length > 0 && st.shards >= cost && !forging && !busy;
    const lbl = !miss.length ? `Toutes les variantes ${TIER_NAME[tier]} sont à vous` : st.shards < cost ? `Il manque ${fmt(cost - st.shards)} ◆` : `${phase === 'reveal' ? 'Encore une' : `Forger une ${TIER_NAME[tier]}`} · ${fmt(cost)} ◆`;
    return `<div class="at-rand fi">
      <div class="at-tiers"><p class="txt">Choisissez une rareté : vous recevez <b>une variante que vous n’avez pas encore</b>, carte au hasard. Le prix de base.</p>
        ${TIERS.map(t => { const m = missing(t).length; return `<button type="button" class="tier${t === tier ? ' on' : ''}${m ? '' : ' off'}" data-tier="${t}" style="--c:${TC[t]}"${forging ? ' disabled' : ''}><span class="gem"></span>
          <span class="tt"><b style="color:${TC[t]}">${TIER_NAME[t]}</b><small>${VL[t]} · ${m ? m + ' à découvrir' : 'tout est à vous'}</small></span><span class="price">${fmt(SHARDS.random[t])}</span></button>`; }).join('')}</div>
      <div class="at-forge-w">
        <div class="forge${forging ? ' forging' : ''}" style="--c:${tc}"><div class="anvil"></div>${motes}<div class="core"></div><div class="ring${forging ? ' go' : ''}"></div>
          ${res && (phase === 'shown' || phase === 'reveal') ? `<div class="flipw${phase === 'shown' ? ' appear' : ' up'}"><div class="flip"><div class="fside back">${back(240)}</div><div class="fside front">${card(res.card_id, res.variant, 240)}</div></div></div>`
            : forging ? '' : '<span class="idle">Les éclats se rassemblent ici</span>'}</div>
        <div class="at-res">${phase === 'reveal' && res ? `<div class="fi"><b>${esc(CARD_BY_ID[res.card_id].name)}</b> · <span style="color:${VARIANT_INFO[res.variant].color};font-weight:900">${esc(VARIANT_INFO[res.variant].name)}</span> <span class="new">Nouveau</span></div>` : ''}
          <button type="button" class="at-btn blue big" id="forgeR"${can ? '' : ' disabled'}>${lbl}</button></div>
      </div></div>`;
  };
  const pickHTML = (O: Set<string>, forging: boolean, tc: string, motes: string) => {
    const f = FAMS.find(x => x[0] === fam)!, own = O.has(sel + ':' + pv), cost = pickCost(pv), base = cost / SHARDS.pickFactor;
    const can = !own && st.shards >= cost && !forging && !busy;
    const lbl = phase === 'made' ? 'Fabriquée ✓ · utilisable en partie' : own ? 'Déjà dans votre collection' : st.shards < cost ? `Il manque ${fmt(cost - st.shards)} ◆` : `Fabriquer · ${fmt(cost)} ◆`;
    return `<div class="at-pick fi">
      <div class="at-pl"><div class="at-chips">${FAMS.map(([k, l]) => `<button type="button" class="chip${fam === k ? ' on' : ''}" data-fam="${k}">${l}</button>`).join('')}</div>
        <div class="at-grid">${CARDS.filter(c => f[2](c.family)).map(c => `<button type="button" class="ct${c.id === sel ? ' on' : ''}" data-c="${c.id}" aria-label="${esc(c.name)}">${card(c.id, 'std', 56, '', true)}</button>`).join('')}</div></div>
      <div class="at-pr">
        <div class="forge small${forging ? ' forging' : ''}" style="--c:${tc}">${motes}<div class="core"></div><div class="ring${forging ? ' go' : ''}"></div>
          <div class="${own || phase === 'made' ? '' : 'grey'}${phase === 'made' ? ' appear' : ''}">${card(sel, pv, 240)}</div></div>
        <b class="nm">${esc(CARD_BY_ID[sel].name)}</b>
        <div class="vchips">${PICKABLE.map(v => { const o = O.has(sel + ':' + v); return `<button type="button" class="vchip${v === pv ? ' on' : ''}${o ? ' own' : ''}" data-v="${v}"><span style="color:${VARIANT_INFO[v].color}">${esc(VARIANT_INFO[v].name)}</span><small>${o ? 'possédée' : fmt(pickCost(v)) + ' ◆'}</small></button>`; }).join('')}</div>
        <div class="pc"><span class="price">${fmt(cost)} ◆</span><span class="x4">×4 · au hasard : ${fmt(base)} ◆</span></div>
        <button type="button" class="at-btn gold big" id="forgeP"${can ? '' : ' disabled'}>${lbl}</button>
      </div></div>`;
  };

  const forgeDelay = reduced ? 200 : 1500;
  const wire = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.onclick = () => { if (phase === 'forging') return; mode = b.dataset.mode as any; phase = 'idle'; res = null; paint(); });
    root.querySelectorAll<HTMLButtonElement>('[data-tier]').forEach(b => b.onclick = () => { tier = b.dataset.tier as T4; phase = 'idle'; res = null; paint(); });
    root.querySelectorAll<HTMLButtonElement>('[data-fam]').forEach(b => b.onclick = () => { fam = b.dataset.fam!; paint(); });
    root.querySelectorAll<HTMLButtonElement>('.at-grid .ct').forEach(b => b.onclick = () => { if (phase === 'forging') return; sel = b.dataset.c!; phase = 'idle'; paint(); });
    root.querySelectorAll<HTMLButtonElement>('[data-v]').forEach(b => b.onclick = () => { if (phase === 'forging') return; pv = b.dataset.v as Variant; phase = 'idle'; paint(); });
    root.querySelector('#recAll')?.addEventListener('click', async () => {
      busy = true; paint();
      try { const r = await api<any>('collection.recycle', { all: true }); st.shards = r.shards; st.owned.forEach(o => { if (o.variant !== 'numero') o.copies = 1; }); toast(`${r.recycled} doublon${r.recycled > 1 ? 's' : ''} recyclé${r.recycled > 1 ? 's' : ''} · +${r.shards_gained} ◆`); sfx.coin(); }
      catch (e: any) { toast(e.message, 'err'); }
      busy = false; paint();
    });
    root.querySelector('#forgeR')?.addEventListener('click', () => forge({ mode: 'random', tier }));
    root.querySelector('#forgeP')?.addEventListener('click', () => forge({ mode: 'pick', cardId: sel, variant: pv }));
  };
  /** Forge : les éclats convergent (1,1 s), éclat de la couleur de la rareté, puis la carte apparaît et se retourne. */
  const forge = async (body: Record<string, unknown>) => {
    if (phase === 'forging' || busy) return;
    busy = true; phase = 'forging'; res = null; paint(); sfx.breath(1.4);
    const t0 = performance.now();
    try {
      const r = await api<any>('collection.craft', body);
      st.shards = r.shards; st.owned.push({ card_id: r.card_id, variant: r.variant, copies: 1, serial: null }); res = { card_id: r.card_id, variant: r.variant };
      setTimeout(() => {
        busy = false;
        const t = TIER_OF[r.variant as Exclude<Variant, 'std'>];
        if (body.mode === 'pick') { phase = 'made'; paint(); sfx.reveal(t); return; }
        // au hasard : la carte apparaît face cachée, puis se retourne (1 s), anneau, « Nouveau »
        phase = 'shown'; paint();
        setTimeout(() => { root.querySelector('.at-forge-w .flipw')?.classList.add('up'); sfx.reveal(t); setTimeout(() => { phase = 'reveal'; paint(); }, reduced ? 0 : 1050); }, reduced ? 0 : 700);
      }, Math.max(0, forgeDelay - (performance.now() - t0)));
    } catch (e: any) { toast(e.message, 'err'); busy = false; phase = 'idle'; paint(); }
  };
  paint();
}
