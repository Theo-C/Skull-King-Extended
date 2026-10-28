// Boosters de cartes (D14, docs/boosters/SPEC.md) : visuels des sachets et des dos, et écran d'ouverture.
import { callGame } from './api';
import type { CallGame } from './pages/collection';
import { esc, toast } from './util';
import { cardHTML } from './cards';
import { PACKS, PACK_BY_ID, CARD_BY_ID, VARIANT_INFO, BOOSTER_PRICE, type Variant } from '@shared/collection.ts';

/** Sachet de chaque booster (web/public/boosters/, docs/boosters/README.md) : le fichier le plus léger des deux formats. */
const SACHET: Record<string, string> = { profondeurs: 'sachet_profondeurs.png', sirenes: 'sachet_sirenes.png', couronne: 'sachet_couronne.webp' };
export const packArt = (id: string) => `boosters/${SACHET[id] ?? SACHET.profondeurs}`;
/** Dos des cartes du booster ouvert (la 5e carte arrive face cachée avec ce dos) ; dos neutre par défaut. */
export const packBack = (id: string) => PACK_BY_ID[id] ? `cards/dos_${id}.webp` : 'cards/dos.webp';

export interface OpenedCard { card_id: string; variant: Variant; serial: number | null; duplicate: boolean; shards: number }
export interface OpenResult {
  ok: true; pack: string; divine: boolean; cards: OpenedCard[]; paid: 'booster' | 'coins';
  shards_gained: number; new: number; owned: number; owned_before: number; total: number; coins: number; boosters: number; shards: number;
}

/** Carte d'un booster, dans sa variante (numéro des Numérotées compris). */
export function boosterCard(c: Pick<OpenedCard, 'card_id' | 'variant' | 'serial'>, w: number, extra = '', still = false) {
  return cardHTML({ id: 0, ...CARD_BY_ID[c.card_id].card }, null, extra, `style="--s:${(w / 252).toFixed(4)}"`, { variant: c.variant, serial: c.serial, still });
}

/** Écran d'ouverture, première version : choix du booster, ouverture, butin. */
export async function boosterPage(root: HTMLElement, query = new URLSearchParams(), api: CallGame = callGame) {
  let pack = PACK_BY_ID[query.get('pack') ?? ''] ? query.get('pack')! : PACKS[0].id, res: OpenResult | null = null, busy = false;
  let st: { coins: number; boosters: number } = { coins: 0, boosters: 0 };
  try { st = await api('collection.list', {}); } catch { /* affiché sans solde */ }
  const paint = () => {
    root.innerHTML = `<section class="coll bst">
      <header class="coll-head"><h1>Boosters</h1><span class="coll-wallet"><span class="pill"><span class="coin"></span><b>${st.coins}</b></span><span class="pill"><b>${st.boosters}</b> offert${st.boosters > 1 ? 's' : ''}</span><a class="pill" href="#/collection">Collection</a></span></header>
      ${res ? recapHTML(res) : `<div class="bst-packs">${PACKS.map(p => `<button type="button" class="bst-pack${p.id === pack ? ' on' : ''}" data-p="${p.id}"><img src="${packArt(p.id)}" alt=""><b>${esc(p.name)}</b><span class="lbl">${esc(p.desc)}</span></button>`).join('')}</div>
        <div class="bst-go"><button type="button" class="gold" id="bOpen"${busy ? ' disabled' : ''}>Ouvrir · ${st.boosters ? 'booster offert' : BOOSTER_PRICE + ' pièces'}</button></div>`}
    </section>`;
    root.querySelectorAll<HTMLButtonElement>('[data-p]').forEach(b => b.onclick = () => { pack = b.dataset.p!; paint(); });
    root.querySelector<HTMLButtonElement>('#bOpen')?.addEventListener('click', async () => {
      busy = true; paint();
      try { res = await api<OpenResult>('booster.open', { pack }); st = { coins: res.coins, boosters: res.boosters }; } catch (e: any) { toast(e.message, 'err'); }
      busy = false; paint();
    });
    root.querySelector<HTMLButtonElement>('#bAgain')?.addEventListener('click', () => { res = null; paint(); });
  };
  paint();
}

/** Butin : les 5 cartes, nouveautés et doublons convertis en éclats, barre de collection. */
export function recapHTML(r: OpenResult) {
  return `<div class="bst-recap">
    ${r.divine ? '<div class="bst-divine">✦ Booster divin · 1 sur 2 000 ✦</div>' : ''}
    <div class="bst-grid">${r.cards.map((c, i) => { const vi = VARIANT_INFO[c.variant];
      return `<figure style="--dl:${(.08 + i * .1).toFixed(2)}s">${boosterCard(c, 150)}<figcaption><b>${esc(CARD_BY_ID[c.card_id].name)}</b>
        <span style="color:${vi.color}">${vi.stars} ${esc(vi.name)}${c.serial ? ` · N° ${String(c.serial).padStart(3, '0')} / 100` : ''}</span>
        <span class="tag${c.duplicate ? ' dup' : ''}">${c.duplicate ? `Doublon · +${c.shards} ◆` : 'Nouveau'}</span></figcaption></figure>`; }).join('')}</div>
    <p class="bst-sum">+${r.new} nouvelle${r.new > 1 ? 's' : ''} variante${r.new > 1 ? 's' : ''}${r.shards_gained ? ` · +${r.shards_gained} ◆ éclats` : ''}</p>
    <div class="bst-coll"><span class="coll-bar"><i style="width:${(r.owned / r.total * 100).toFixed(1)}%"></i></span><span class="lbl">${r.owned} / ${r.total} variantes</span></div>
    <div class="bst-go"><button type="button" class="gold" id="bAgain">Ouvrir un autre</button><a class="coll-btn" href="#/collection">Voir la collection</a></div>
  </div>`;
}
