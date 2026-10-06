// Boutique (D12, docs/casier-boutique/SPEC.md, maquette Boutique) : on y achète, le Casier sert à s'équiper.
// Coffres et bonus toujours disponibles, échoppe de la semaine (6 objets, renouvelée le lundi 00:00 heure de Paris),
// achat confirmé puis écran de réussite avec l'action suivante. Les coffres s'ouvrent ici.
import '../styles/boutique.css';
import { callGame } from '../api';
import { esc, toast } from '../util';
import { avatarHTML, CATALOG, withItem, type CosmeticItem, type Look } from '../avatar';
import { myProfile, chestBadge } from '../account';
import { objectSVG } from '../objects';
import { openChestOverlay, type ChestResult } from '../chest';
import { RC, RAR_NAME } from '../locker';
import { go, setCleanup } from '../main';

const SLOT_KIND: Record<string, string> = { hat: 'Chapeau', face: 'Yeux et visage', neck: 'Cou', pet: 'Compagnon', bg: 'Décor', frame: 'Cadre', card_back: 'Dos de cartes', title: 'Titre', reaction: 'Réaction rapide', card_anim: 'Carte animée' };
const CAT_OF = (slot: string) => ['card_back', 'card_anim'].includes(slot) ? 'cards' : ['title', 'reaction'].includes(slot) ? 'social' : 'look';
const CHEST_SVG = (w: number, tr = '') => `<svg viewBox="0 0 140 110" width="${w}" height="110" aria-hidden="true"><g transform="${tr}"><rect x="20" y="48" width="100" height="52" rx="6" fill="#7a4a24" stroke="#3a220f" stroke-width="3"/><path d="M20 52 Q70 8 120 52 Z" fill="#8c5a2c" stroke="#3a220f" stroke-width="3"/><rect x="20" y="58" width="100" height="8" fill="#c9a14a"/><rect x="62" y="56" width="16" height="22" rx="3" fill="#e2bd62" stroke="#6b4c14" stroke-width="2"/><rect x="30" y="48" width="8" height="52" fill="#c9a14a"/><rect x="102" y="48" width="8" height="52" fill="#c9a14a"/></g></svg>`;
const JOKER_SVG = '<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><rect x="28" y="10" width="64" height="96" rx="8" fill="#f3ead7" stroke="#c9a14a" stroke-width="4" transform="rotate(-8 60 58)"/><text x="60" y="72" text-anchor="middle" font-family="Pirata One" font-size="44" fill="#7a1f1a" transform="rotate(-8 60 58)">11</text><text x="60" y="96" text-anchor="middle" font-family="Alegreya Sans" font-weight="800" font-size="11" fill="#7a1f1a" transform="rotate(-8 60 58)">BONUS</text></svg>';

interface ShopData { coins: number; chests: number; jokers: number; prices: { chest: number; chest3: number; joker: number }; owned: string[]; week: { start: string | null; ends_at: string | null; items: { id: string; price: number | null }[] } }
type Buyable = { id: string; name: string; price: number; desc: string; kind: 'chest' | 'joker' | 'item'; item?: CosmeticItem };

export async function boutiquePage(root: HTMLElement, uid: string) {
  root.innerHTML = '<section class="bq"><p class="lbl">Ouverture de la boutique…</p></section>';
  let d: ShopData; let look: Look = {}; let color = '#d9b25a';
  const load = async () => {
    const [s, p] = await Promise.all([callGame<ShopData>('shop.list', {}), myProfile(uid)]);
    d = s; look = p?.look ?? {}; color = p?.color ?? color; chestBadge(d.chests);
  };
  try { await load(); } catch (e: any) { root.innerHTML = `<section class="bq"><h1>Boutique</h1><p class="lbl">${esc(e.message)}</p></section>`; return; }
  let cat = 'all', modal: { b: Buyable; done: boolean } | null = null, timer: any = null;
  const owned = () => new Set(d.owned);

  const left = () => {
    const ms = d.week.ends_at ? Date.parse(d.week.ends_at) - Date.now() : 0; if (ms <= 0) return 'bientôt';
    const h = Math.floor(ms / 3600_000), j = Math.floor(h / 24);
    return j ? `encore ${j} j ${h % 24} h` : h ? `encore ${h} h ${Math.floor(ms / 60_000) % 60} min` : `encore ${Math.max(1, Math.floor(ms / 60_000))} min`;
  };
  const pic = (it: CosmeticItem) => {
    if (['hat', 'face', 'neck', 'pet'].includes(it.slot) && it.value) return objectSVG(it.slot, it.value, 84, it.variants?.[0] ?? '#2f5f8a', color);
    if (['bg', 'frame'].includes(it.slot)) return avatarHTML({ kind: 'art', letter: '', color, look: withItem({ skin: 1, hair: 'meche', hc: 1, ...look, hat: null, pet: null }, it.id) }, 90);
    return objectSVG(it.slot, it.value, 96, '#2f5f8a', color);
  };
  const ess = (): Buyable[] => [
    { id: 'chest', name: 'Coffre', price: d.prices.chest, kind: 'chest', desc: 'Un objet au hasard : Commun 61 %, Rare 26 %, Épique 9 %, Légendaire 3 %, Mythique 1 %. Doublon converti en pièces.' },
    { id: 'chest3', name: '3 coffres', price: d.prices.chest3, kind: 'chest', desc: 'Trois coffres d’un coup, ouverts à la suite. Même tirage qu’un coffre seul.' },
    { id: 'joker', name: 'Joker', price: d.prices.joker, kind: 'joker', desc: 'À la fin de la dernière manche, posez-le pour jouer une manche bonus de 11 cartes avant les résultats.' },
  ];

  const render = () => {
    const showEss = cat === 'all' || cat === 'bonus';
    const items = d.week.items.map(x => ({ it: CATALOG.byId[x.id], price: x.price ?? CATALOG.byId[x.id]?.price ?? 0 })).filter(x => x.it && (showEss || CAT_OF(x.it.slot) === cat));
    const has = owned();
    root.innerHTML = `<section class="bq">
      <header class="bq-head"><h1>Boutique</h1>
        <div class="bq-cats">${([['all', 'À la une'], ['bonus', 'Coffres et bonus'], ['look', 'Apparence'], ['cards', 'Cartes'], ['social', 'Titres et réactions']] as const).map(([k, l]) => `<button type="button" class="chip${cat === k ? ' on' : ''}" data-cat="${k}">${l}</button>`).join('')}</div>
        <div class="bq-wallet"><span class="pill"><span class="coin"></span><b>${d.coins}</b> pièces</span>
          <span class="pill"><b>${d.chests}</b> coffre${d.chests > 1 ? 's' : ''}${d.chests ? ' <button type="button" class="bq-open" id="bqOpen">Ouvrir</button>' : ''}</span>
          <span class="pill"><b>${d.jokers}</b> joker${d.jokers > 1 ? 's' : ''}</span><a class="bq-ghost" href="#/casier">Casier</a></div></header>
      <div class="bq-cols"><div class="bq-main">
        ${showEss ? `<section><div class="bq-h"><h2>Coffres et bonus</h2><span class="lbl">Toujours disponibles</span></div>
          <div class="bq-ess">${ess().map(e => `<div class="bq-big">${e.id === 'chest3' ? '<span class="bq-ribbon">−10 %</span>' : ''}
            <div class="bq-pic">${e.kind === 'joker' ? JOKER_SVG : e.id === 'chest3' ? CHEST_SVG(170, 'translate(-6 4) scale(.9)') : CHEST_SVG(130)}</div>
            <div class="bq-name">${esc(e.name)}</div><div class="bq-desc">${esc(e.desc)}</div>
            <button type="button" class="bq-price" data-buy="${e.id}" aria-disabled="${d.coins < e.price}"><span class="coin"></span>${e.price}</button></div>`).join('')}</div></section>` : ''}
        <section><div class="bq-h"><h2>Échoppe de la semaine${showEss ? '' : ' · ' + ({ look: 'Apparence', cards: 'Cartes', social: 'Titres et réactions' } as any)[cat]}</h2><span class="lbl">Renouvelée chaque lundi · ${esc(left())}</span></div>
          <div class="bq-shop">${items.length ? items.map(({ it, price }) => { const mine = has.has(it.id), poor = d.coins < price;
            return `<div class="bq-tile"><span class="bq-tpic">${pic(it)}</span><b>${esc(it.name)}</b><span class="lbl">${esc(SLOT_KIND[it.slot] ?? '')} · ${RAR_NAME[it.rarity]}</span>
              <button type="button" class="bq-price" data-buy="${esc(it.id)}" aria-disabled="${mine || poor}">${mine ? 'Possédé' : `<span class="coin"></span>${price}`}</button><span class="bar" style="background:${RC[it.rarity]}"></span></div>`; }).join('')
            : '<p class="lbl">Rien dans cette catégorie cette semaine.</p>'}</div></section>
        ${cat === 'all' ? `<section><h2 class="bq-h2">Bientôt</h2><div class="bq-soon">
          <div><b>Tapis de table</b>Votre tapis, vu par vous seul.</div><div><b>Effets d'impact</b>Une signature quand vous remportez un pli.</div>
          <div><b>Packs de réactions</b>Phrases et sons rapides.</div><div><b>Passe de saison</b>Récompenses à débloquer en jouant.</div></div></section>` : ''}
      </div>
      <aside class="bq-aside">
        <div class="bq-box"><h2>Gagner des pièces</h2>${[['Partie terminée', '+10'], ['Victoire', '+30'], ['Toutes ses mises tenues', '+15'], ['Haut fait', '+50'], ['Doublon dans un coffre', '+30 à +400']].map(([l, v]) => `<div class="bq-earn"><span>${l}</span><b>${v}</b></div>`).join('')}
          <p class="lbl">Seul face à des bots, une partie ne rapporte rien. L’échoppe ne vend jamais de Légendaire ni de Mythique : ceux-là se gagnent.</p></div>
        <div class="bq-box"><h2>Le Joker</h2><p>À la fin de la dernière manche, avant les résultats, chaque joueur qui possède un Joker peut le poser : la partie gagne une <b>manche bonus</b> (11 cartes chacun après 10 manches) pour tout le monde.</p>
          <p class="lbl">Un seul Joker par partie · jusqu'à 6 joueurs (au-delà, le paquet ne suffit pas pour 11 cartes chacun) · 20 s pour se décider · le Joker n'est retiré que s'il est posé.</p></div>
      </aside></div>
      ${modal ? modalHTML() : ''}
    </section>`;
    wire();
  };
  const modalHTML = () => {
    const { b, done } = modal!;
    const after = d.coins - (done ? 0 : b.price);
    const next = b.kind === 'chest' ? ['Ouvrir maintenant', 'open'] : b.kind === 'joker' ? ['Aller au salon', 'salon'] : ['Équiper', 'equip'];
    const doneTxt = b.kind === 'chest' ? `Vous avez maintenant ${d.chests} coffre${d.chests > 1 ? 's' : ''} à ouvrir.` : b.kind === 'joker' ? `Vous avez ${d.jokers} joker${d.jokers > 1 ? 's' : ''}. Posez-le à la fin de la dernière manche d'une partie en ligne.` : `${b.name} est rangé dans votre casier.`;
    return `<div class="bq-ov"><div class="bq-modal" role="dialog" aria-modal="true" aria-label="${done ? 'Achat réussi' : "Confirmer l'achat"}">
      ${done ? `<div class="bq-mt ok">C'est à vous !</div><p>${esc(doneTxt)}</p><div class="bq-mb"><button type="button" class="bq-ghost" data-m="close">Continuer</button><button type="button" class="bq-gold" data-m="${next[1]}">${next[0]}</button></div>`
        : `<div class="bq-mt">${esc(b.name)}</div><p>${esc(b.desc)}</p><div class="bq-mp"><span>Prix</span><b><span class="coin"></span> ${b.price}</b></div><div class="bq-ma"><span>Solde après l'achat</span><span>${after} pièces</span></div>
          <div class="bq-mb"><button type="button" class="bq-ghost" data-m="close">Annuler</button><button type="button" class="bq-gold" data-m="confirm">Acheter</button></div>`}</div></div>`;
  };
  const openChests = () => {
    const opening = () => callGame<ChestResult>('chest.open', {}).then(r => { d.chests = r.chests; d.coins = r.coins; chestBadge(r.chests); if (!r.duplicate) d.owned.push(r.cosmetic_id); return r; });
    openChestOverlay(opening(), { color, onOpenNext: opening, onError: (e: any) => toast(e?.message || "Coffre impossible à ouvrir pour l'instant.", 'err'), onClose: () => render(),
      onEquip: async (_s, _v, id) => { go('#/casier?slot=' + (CATALOG.byId[id]?.slot ?? 'hat')); } });
  };
  const wire = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat!; render(); });
    root.querySelector<HTMLButtonElement>('#bqOpen')?.addEventListener('click', openChests);
    root.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b => b.onclick = () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      const id = b.dataset.buy!, e = ess().find(x => x.id === id);
      if (e) modal = { b: e, done: false };
      else { const it = CATALOG.byId[id], price = d.week.items.find(x => x.id === id)?.price ?? it?.price ?? 0; if (!it) return;
        modal = { b: { id, name: it.name, price, kind: 'item', item: it, desc: `${SLOT_KIND[it.slot] ?? ''} · ${RAR_NAME[it.rarity]}. Se range dans votre casier, à équiper quand vous voulez.` }, done: false }; }
      render(); (root.querySelector('.bq-modal [data-m="confirm"]') as HTMLElement | null)?.focus();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-m]').forEach(b => b.onclick = async () => {
      const m = b.dataset.m!, cur = modal; if (!cur) return;
      if (m === 'close') { modal = null; render(); return; }
      if (m === 'confirm') {
        b.disabled = true;
        try { const r = await callGame<any>('shop.buy', { itemId: cur.b.id }); d.coins = r.coins; d.chests = r.chests; d.jokers = r.jokers; if (cur.b.kind === 'item') d.owned.push(cur.b.id); chestBadge(d.chests); modal = { b: cur.b, done: true }; }
        catch (e: any) { toast(e.message, 'err'); modal = null; }
        render(); return;
      }
      modal = null;
      if (m === 'open') { render(); openChests(); }
      else if (m === 'salon') go('#/');
      else if (m === 'equip') go('#/casier?slot=' + (cur.b.item?.slot ?? 'hat'));
    });
    const ov = root.querySelector('.bq-ov') as HTMLElement | null;
    if (ov) ov.onkeydown = ev => { if (ev.key === 'Escape') { modal = null; render(); } };
  };
  // compte à rebours de l'échoppe (une fois par minute)
  timer = setInterval(() => { const el = root.querySelector('.bq-h .lbl'); if (el && !modal) render(); }, 60_000);
  setCleanup(() => clearInterval(timer));
  render();
}
