// Casier (D8, docs/casier-boutique/SPEC.md, maquettes Casier, CasierDos, CasierAnimees, CasierTitre, CasierReactions) :
// on s'y équipe, la Boutique sert à acheter. Trois onglets (Pirate, Cartes, Titre et réactions), trois colonnes (aperçu en
// direct, emplacements, choix). Un objet verrouillé s'essaie dans l'aperçu mais ne s'enregistre pas.
import '../styles/casier.css';
import { sb, callGame } from '../api';
import { $, esc, toast } from '../util';
import { avatarHTML, CATALOG, DEFAULT_REACTIONS, PALETTE, withItem, type Look, type CosmeticItem } from '../avatar';
import { myProfile, forgetProfile } from '../account';
import { objectSVG } from '../objects';
import { ART, backFace } from '../cards';
import { ANIM, KEY_OF_FILE, attachAnim, detachAnim } from '../animatedCards';
import { levelFor } from '../xp';
import { RC, PLQ, RAR_NAME, owns, howText, progressOf, itemsOf, impactSound, setImpactSound, othersAnimated, setOthersAnimated, type Progress } from '../locker';
import { setCleanup } from '../main';

const DEFAULT_LOOK: Look = { skin: 1, hair: 'court', hc: 0, beard: 'none', hat: null, face: null, neck: null, pet: null, bg: 'mer', frame: null };
const HAIR_OPTS: [string, string][] = [['Court', 'court'], ['Mèche', 'meche'], ['Long', 'long'], ['Bouclé', 'boucles'], ['Chignon', 'chignon'], ['Tresse', 'tresse'], ['Queue', 'queue'], ['Rasé', 'none']];
const BEARD_OPTS: [string, string][] = [['Aucune', 'none'], ['Moustache', 'mous'], ['Barbe courte', 'short'], ['Grande barbe', 'long']];
const SKIN_SW = ['#f3d2b3', '#e6b48f', '#c98e66', '#a56a45', '#7a4a2c', '#5a3420'];
const HAIRC_SW = ['#1d1510', '#4a2c1a', '#8a5a2b', '#c9a14a', '#a33a26', '#d8d2c4'];
const COAT_NAMES = ['Or', 'Corail', 'Algue', 'Lagon', 'Améthyste', 'Ambre', 'Écume', 'Corail rose'];
const LOCK = '<span class="ck-lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ead08a" stroke-width="2.4"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>';

type Tab = 'pirate' | 'cartes' | 'profil';
const SLOTS: Record<Tab, [string, string, string][]> = {
  pirate: [['base', 'Visage', 'V'], ['hat', 'Chapeau', 'C'], ['face', 'Yeux et visage', 'Y'], ['neck', 'Cou', 'N'], ['pet', 'Compagnon', 'P'], ['bg', 'Décor', 'D'], ['frame', 'Cadre', 'F']],
  cartes: [['card_back', 'Dos de cartes', 'D'], ['card_anim', 'Cartes animées', 'A']],
  profil: [['title', 'Titre', 'T'], ['reaction', 'Réactions rapides', 'R']],
};
const TAB_OF: Record<string, Tab> = Object.fromEntries((Object.keys(SLOTS) as Tab[]).flatMap(t => SLOTS[t].map(([k]) => [k, t])));
const HINT: Record<Tab, string> = {
  pirate: "L'apparence de base est entièrement gratuite et modifiable à tout moment. Les objets se gagnent dans les coffres, par les niveaux et les hauts faits, ou s'achètent à l'échoppe de la semaine.",
  cartes: 'Les dos se gagnent dans les coffres, par les niveaux ou à l’échoppe. Les cartes animées sont Mythiques (1 % par coffre) : chacune s’active ou se coupe à part, et un doublon rapporte 400 pièces.',
  profil: 'Le titre s’affiche sous votre nom, à la table et au survol. Les 4 réactions sont les boutons rapides au-dessus de votre main (touches 1 à 4) ; le bouton GIF reste toujours à côté.',
};
const PIRATE_SLOTS = ['hat', 'face', 'neck', 'pet', 'bg', 'frame'] as const;

export async function casierPage(root: HTMLElement, uid: string, query: URLSearchParams) {
  root.innerHTML = '<section class="ck"><p class="lbl">Ouverture du casier…</p></section>';
  const [p, ward, mine, all, stats] = await Promise.all([
    myProfile(uid, true),
    callGame<any>('profile.wardrobe', {}).catch(() => ({ owned: [], coins: 0, chests: 0, jokers: 0 })),
    sb.from('user_achievements').select('code').eq('user_id', uid).then(r => r.data || []),
    sb.from('achievements').select('code, name').then(r => r.data || []),
    sb.from('player_stats').select('games, wins, sirens_captured, zero_bids_made').eq('user_id', uid).maybeSingle().then(r => r.data),
  ]);
  if (!p) { root.innerHTML = '<section class="ck"><h1>Casier introuvable</h1></section>'; return; }
  const prog: Progress = { xp: p.xp, achievements: new Set((mine as any[]).map(a => a.code)), sirens: stats?.sirens_captured ?? 0, wins: stats?.wins ?? 0, zeroBids: stats?.zero_bids_made ?? 0, achNames: new Map((all as any[]).map(a => [a.code, a.name])) };
  const owned = new Set<string>(ward.owned ?? []);
  const has = (it: CosmeticItem) => owns(it, owned, prog);
  const animOwned = itemsOf('card_anim').filter(has).map(it => it.value!);
  // apparence de travail : on complète les clés du Casier avec leurs valeurs par défaut
  const base = (): Look => {
    const l: any = { ...DEFAULT_LOOK, ...(p.look || {}) };
    if (!Array.isArray(l.card_anims)) l.card_anims = animOwned.slice();
    if (!Array.isArray(l.reactions)) l.reactions = DEFAULT_REACTIONS.slice();
    l.card_back ??= 'classique'; l.title ??= null;
    return l;
  };
  const wanted = query.get('slot') || '';
  const st = {
    tab: (TAB_OF[wanted] ?? 'pirate') as Tab, slot: TAB_OF[wanted] ? wanted : 'hat', filter: 'all' as 'all' | 'own' | 'lock',
    look: base(), saved: base(), color: p.color, savedColor: p.color, animPrev: null as string | null, say: null as string | null, saving: false, savedMsg: false,
  };
  const L = () => st.look as any;
  const item = (slot: string, value: string | null) => itemsOf(slot).find(it => it.value === value);
  const levelTitle = () => levelFor(p.xp).title;
  const titleShown = () => (L().title && item('title', L().title)?.name) || levelTitle();
  const avatar = (size: number, ring?: string) => avatarHTML({ kind: 'art', letter: p.pseudo, color: st.color, look: st.look }, size, ring);
  /** Dos classique (illustration d'origine), réduit à l'échelle voulue. */
  const classic = (scale: number) => `<span class="card ck-mini" style="--s:${scale}">${backFace()}</span>`;
  const backStyle = (v: string | null) => { const bg = item('card_back', v)?.bg; return bg ? `background:${bg}` : ''; };

  /** Objets essayés mais pas possédés : on ne peut pas enregistrer. */
  const trying = () => {
    for (const s of PIRATE_SLOTS) { const v = L()[s]; if (v == null) continue; const it = item(s, v); if (it && !itemsOf(s).some(x => x.value === v && has(x))) return it; }
    for (const [k, slot] of [['card_back', 'card_back'], ['title', 'title']] as const) { const v = L()[k]; if (v) { const it = item(slot, v); if (it && !has(it)) return it; } }
    return null;
  };
  const dirty = () => JSON.stringify(st.look) !== JSON.stringify(st.saved) || st.color !== st.savedColor;

  /* ---------- colonne 1 : aperçu ---------- */
  const preview = () => {
    if (st.tab === 'pirate') return `<div class="ck-av">${avatar(220, `0 0 0 3px #1b140e,0 0 0 6px ${st.color}`)}</div>
      <div class="lbl">Comme à la table</div>
      <div class="ck-plate">${avatar(52)}<div><b>${esc(p.pseudo)}</b><span class="ck-ttl">${esc(titleShown())}</span></div><div class="ck-mp">Mise <b>2</b><br>Plis <b>1</b></div></div>`;
    if (st.tab === 'cartes') {
      const fan = [0, 1, 2, 3, 4, 5, 6].map(i => `<span class="ck-bk" style="--x:${(i - 3) * 22}px;--y:${Math.abs(i - 3) * 4}px;--r:${(i - 3) * 9}deg;${backStyle(L().card_back)}">${backStyle(L().card_back) ? '' : classic(.214)}</span>`).join('');
      const key = st.animPrev ?? (L().card_anims[0] || animOwned[0] || 'kraken'), it = item('card_anim', key)!, mine = animOwned.includes(key), on = mine && L().card_anims.includes(key);
      const cap = !mine ? `${it.name} · pas encore gagnée : aperçu` : on ? `${it.name} · animée quand vous la jouez` : `${it.name} · animation coupée, carte fixe à la table`;
      const glow = on ? ANIM[KEY_OF_FILE[key]]?.halo ?? 'transparent' : 'transparent';
      // animation coupée : la carte reste fixe dans l'aperçu, comme à la table (une carte pas encore gagnée joue pour donner envie)
      return `<div class="ck-felt ck-felt-cards"><div class="ck-felt-t">Ce que voient les autres</div><div class="ck-fan">${fan}</div>
          <div class="ck-played card" style="--glow:${glow}" data-anim-key="${on || !mine ? esc(KEY_OF_FILE[key] ?? '') : ''}"><div class="art"><img src="${ART[KEY_OF_FILE[key]]}" alt=""></div></div>
          <div class="ck-cap">${esc(cap)}</div></div>
        <p class="ck-note">Dos <b>${esc(item('card_back', L().card_back)?.name ?? 'Classique')}</b> sur vos cartes face cachée, vues par toute la table.</p>`;
    }
    const lvl = levelFor(p.xp), tit = L().title ? item('title', L().title) : null;
    return `<div class="ck-felt ck-felt-me"><div class="ck-felt-t">À la table</div>
        ${st.say || st.slot === 'reaction' ? `<div class="ck-say">${esc(st.say ?? reactNames()[0] ?? 'GG')}</div>` : ''}
        <div class="ck-plate">${avatar(56)}<div><b>${esc(p.pseudo)}</b><span class="ck-ttl">${esc(titleShown())}</span></div><div class="ck-mp">Mise <b>2</b><br>Plis <b>1</b></div></div></div>
      <div class="lbl">Au survol de votre nom</div>
      <div class="ck-hover">${avatar(64)}<div><b>${esc(p.pseudo)}</b> <span class="lbl">· niveau ${lvl.level}</span>
        <span class="ck-plq sm" style="background:${PLQ[tit?.rarity ?? 'c']}">${esc(titleShown())}</span>
        <span class="lbl">${stats?.games ?? 0} parties · ${stats?.wins ?? 0} victoires</span></div></div>
      <div class="lbl">Barre au-dessus de votre main</div>
      <div class="ck-rbar">${reactNames().map(r => `<span>${esc(r)}</span>`).join('')}<span class="gif">GIF</span></div>`;
  };
  const reactNames = () => (L().reactions as string[]).map(v => item('reaction', v)?.name).filter(Boolean) as string[];

  /* ---------- colonne 2 : emplacements ---------- */
  const countOf = (slot: string) => { const all = itemsOf(slot); return all.length ? `${all.filter(has).length}/${all.length}` : ''; };
  const curOf = (slot: string) => {
    if (slot === 'base') return 'Tout est gratuit';
    if (slot === 'card_anim') return `${(L().card_anims as string[]).filter(v => animOwned.includes(v)).length} activée(s)`;
    if (slot === 'reaction') return `${L().reactions.length} sur 4`;
    if (slot === 'title') return titleShown();
    const v = slot === 'card_back' ? L().card_back : L()[slot]; return item(slot, v)?.name ?? '—';
  };

  /* ---------- colonne 3 : choix ---------- */
  const keep = (mine: boolean) => st.filter === 'all' || (st.filter === 'own' ? mine : !mine);
  const tile = (it: CosmeticItem, on: boolean, mine: boolean, pic: string, cls = 'ck-it') =>
    `<button type="button" class="${cls}${on ? ' on' : ''}${mine ? '' : ' lock'}" data-item="${esc(it.id)}" aria-pressed="${on}" aria-label="${esc(it.name + (mine ? '' : ` (verrouillé, ${howText(it, prog)})`))}">
      <span class="pic">${pic}</span><span class="nm">${esc(it.name)}</span><span class="src">${mine ? (on ? 'Équipé' : '') : esc(howText(it, prog))}</span>
      <span class="bar" style="background:${RC[it.rarity]}"></span>${on ? '<span class="ck-check" aria-hidden="true">✓</span>' : ''}${mine ? '' : LOCK}</button>`;
  const choice = () => {
    const s = st.slot;
    if (s === 'base') {
      const sw = (c: string, label: string, on: boolean, key: string, v: unknown) => `<button type="button" class="ck-sw${on ? ' on' : ''}" style="background:${c}" data-base="${key}" data-v="${esc(String(v))}" aria-label="${esc(label)}" aria-pressed="${on}"></button>`;
      const tl = (label: string, on: boolean, key: string, v: string) => `<button type="button" class="ck-bt${on ? ' on' : ''}" data-base="${key}" data-v="${esc(v)}" aria-pressed="${on}">${avatarHTML({ kind: 'art', letter: p.pseudo, color: st.color, look: { ...st.look, [key]: v, hat: null, pet: null } }, 58)}<span>${esc(label)}</span></button>`;
      const rows: [string, string][] = [
        ['Teint', SKIN_SW.map((c, i) => sw(c, 'Teint ' + (i + 1), L().skin === i, 'skin', i)).join('')],
        ['Coiffure', HAIR_OPTS.map(([n, v]) => tl(n, L().hair === v, 'hair', v)).join('')],
        ['Couleur des cheveux', HAIRC_SW.map((c, i) => sw(c, 'Cheveux ' + (i + 1), L().hc === i, 'hc', i)).join('')],
        ['Pilosité', BEARD_OPTS.map(([n, v]) => tl(n, L().beard === v, 'beard', v)).join('')],
        ['Manteau · c’est aussi votre couleur à la table', PALETTE.map((c, i) => sw(c, COAT_NAMES[i], st.color === c, 'color', c)).join('')],
      ];
      return `<div class="ck-base">${rows.map(([l, h]) => `<div><div class="lbl">${esc(l)}</div><div class="ck-opts">${h}</div></div>`).join('')}</div>`;
    }
    if (s === 'card_back') {
      const list = itemsOf(s).filter(it => keep(has(it))).map(it => tile(it, L().card_back === it.value, has(it), `<span class="ck-back" style="${backStyle(it.value)}">${it.bg ? '' : classic(.413)}</span>`, 'ck-it big')).join('');
      return `<div class="ck-grid backs">${list}</div><p class="ck-note">Un seul dos à la fois. Il s'applique à toutes vos cartes face cachée ; les faces des cartes ne changent jamais, pour que tout le monde les lise pareil.</p>`;
    }
    if (s === 'card_anim') {
      const prevKey = st.animPrev ?? (L().card_anims[0] || animOwned[0]);
      const rows = itemsOf(s).filter(it => keep(has(it))).map(it => {
        const mine = has(it), on = mine && L().card_anims.includes(it.value);
        return `<div class="ck-an${prevKey === it.value ? ' on' : ''}${mine ? '' : ' lock'}" data-anim="${esc(it.value!)}" role="button" tabindex="0" aria-label="Aperçu : ${esc(it.name)}">
          <img src="${ART[KEY_OF_FILE[it.value!]]}" alt=""><div><span class="myth">Mythique</span><b>${esc(it.name)}</b><span class="lbl">${esc(it.sub ?? '')}${mine ? '' : ' · 1 % par coffre'}</span></div>
          <button type="button" class="ck-switch${on ? ' on' : ''}" role="switch" aria-checked="${on}" aria-disabled="${!mine}" data-toggle="${esc(it.value!)}" aria-label="Animer ${esc(it.name)} à la table"></button>${mine ? '' : LOCK}</div>`;
      }).join('');
      return `<div class="ck-anims">${rows}</div><div class="lbl">Réglages · sur cet appareil</div>
        <div class="ck-sets"><div class="ck-set"><div><b>Son à l'impact</b><span class="lbl">Quand votre carte animée tombe sur le tapis</span></div><button type="button" class="ck-switch${impactSound() ? ' on' : ''}" role="switch" aria-checked="${impactSound()}" data-set="son" aria-label="Son à l'impact"></button></div>
        <div class="ck-set"><div><b>Animations des autres</b><span class="lbl">Coupez-les si la partie rame sur votre appareil</span></div><button type="button" class="ck-switch${othersAnimated() ? ' on' : ''}" role="switch" aria-checked="${othersAnimated()}" data-set="oth" aria-label="Voir les animations des autres joueurs"></button></div></div>`;
    }
    if (s === 'title') {
      const list = itemsOf(s).filter(it => keep(has(it))).map(it => {
        const mine = has(it), on = (L().title ?? null) === it.value, pr = mine ? null : progressOf(it, prog);
        return `<button type="button" class="ck-pl${on ? ' on' : ''}${mine ? '' : ' lock'}" data-item="${esc(it.id)}" aria-pressed="${on}" aria-label="${esc('Titre ' + it.name + (mine ? '' : ` (verrouillé, ${howText(it, prog)})`))}">
          <span class="ck-plq" style="background:${PLQ[it.rarity]}">${esc(it.name)}</span><span class="lbl">${esc(it.how?.startsWith('title:') ? 'Niveau ' + it.how.slice(6) : howText(it, prog))}</span>
          ${pr ? `<span class="ck-prog"><i style="width:${Math.round(100 * pr[0] / pr[1])}%"></i></span><span class="ck-progt">${pr[0]} / ${pr[1]}</span>` : ''}
          ${on ? '<span class="ck-check" aria-hidden="true">✓</span>' : ''}${mine ? '' : LOCK}</button>`;
      }).join('');
      return `<div class="ck-grid titles">${list}</div><p class="ck-note">La couleur de la plaque suit la rareté. Un titre verrouillé s'essaie dans l'aperçu, mais ne s'enregistre pas.${L().title ? ' <button type="button" class="ck-link" data-notitle>Revenir au titre de niveau</button>' : ''}</p>`;
    }
    if (s === 'reaction') {
      const bar = (L().reactions as string[]);
      const slots = [0, 1, 2, 3].map(i => { const v = bar[i], it = v ? item('reaction', v) : null;
        return `<div class="ck-rs${it ? ' full' : ''}"><span class="k">${i + 1}</span>${it ? esc(it.name) + `<button type="button" class="x" data-unreact="${esc(v)}" aria-label="Retirer ${esc(it.name)}">×</button>` : 'Vide'}</div>`; }).join('');
      const list = itemsOf(s).filter(it => keep(has(it))).map(it => {
        const mine = has(it), i = bar.indexOf(it.value!), on = i >= 0;
        return `<button type="button" class="ck-rc${on ? ' on' : ''}${mine ? '' : ' lock'}" data-react="${esc(it.value!)}" aria-pressed="${on}" aria-label="${esc('Réaction ' + it.name + (mine ? '' : ` (verrouillée, ${howText(it, prog)})`))}">
          <span class="bub">${esc(it.name)}</span><span class="lbl"><i style="background:${RC[it.rarity]}"></i>${mine ? (on ? 'Dans la barre · touche ' + (i + 1) : 'Dans la réserve') : esc(howText(it, prog))}</span>
          ${on ? `<span class="ck-check" aria-hidden="true">${i + 1}</span>` : ''}${mine ? '' : LOCK}</button>`;
      }).join('');
      return `<div class="lbl">Votre barre · touches 1 à 4 pendant la partie</div><div class="ck-rbar2">${slots}<div class="ck-rs full gif">GIF</div></div>
        <div class="lbl">Réserve · cliquez pour ajouter ou retirer</div><div class="ck-grid reacts">${list}</div>`;
    }
    // objets de l'avatar (chapeau, yeux, cou, compagnon, décor, cadre)
    const list = itemsOf(s).filter(it => keep(has(it))).map(it => {
      const on = (L()[s] ?? null) === it.value && (!it.variantKey || !it.variants?.length || it.variants.includes(L()[it.variantKey]));
      const pic = it.value && ['hat', 'face', 'neck', 'pet'].includes(s) ? objectSVG(s, it.value, 76, it.variants?.[0] ?? '#2f5f8a', st.color)
        : avatarHTML({ kind: 'art', letter: p.pseudo, color: st.color, look: withItem(st.look, it.id) }, 80);
      return tile(it, on, has(it), pic);
    }).join('');
    return `<div class="ck-grid items">${list}</div>
      <div class="ck-legend">${(['c', 'r', 'e', 'l', 'm'] as const).map(r => `<span><i style="background:${RC[r]}"></i>${RAR_NAME[r]}</span>`).join('')}<span class="ck-legend-r">Un objet verrouillé s'essaie dans l'aperçu ; on ne peut pas l'enregistrer.</span></div>`;
  };

  /* ---------- rendu ---------- */
  const render = () => {
    root.querySelectorAll<HTMLElement>('.ck-played').forEach(detachAnim);
    const tr = trying(), d = dirty();
    const status = tr ? 'Vous essayez un objet que vous ne possédez pas encore.' : st.savedMsg ? 'Enregistré ✓ Les autres joueurs voient votre nouveau look.' : d ? 'Modifications non enregistrées' : 'Tout est enregistré';
    const title = SLOTS[st.tab].find(([k]) => k === st.slot)?.[1] ?? '';
    root.innerHTML = `<section class="ck">
      <header class="ck-head"><h1>Casier</h1>
        <div role="tablist" aria-label="Que personnaliser" class="ck-tabs">${([['pirate', 'Pirate'], ['cartes', 'Cartes'], ['profil', 'Titre et réactions']] as [Tab, string][]).map(([k, l]) => `<button type="button" role="tab" class="ck-tab${st.tab === k ? ' on' : ''}" aria-selected="${st.tab === k}" data-tab="${k}">${l}</button>`).join('')}</div>
        <div class="ck-wallet"><span class="pill"><span class="coin"></span><b>${ward.coins ?? 0}</b> pièces</span><span class="pill"><b>${ward.chests ?? 0}</b> coffre${(ward.chests ?? 0) > 1 ? 's' : ''}</span><span class="pill"><b>${ward.jokers ?? 0}</b> joker${(ward.jokers ?? 0) > 1 ? 's' : ''}</span><a class="ck-ghost" href="#/boutique">Boutique</a></div></header>
      <div class="ck-cols">
        <aside class="ck-prev"><div class="lbl">Aperçu</div>${preview()}<div class="ck-hint">${HINT[st.tab]}</div></aside>
        <nav class="ck-slots" role="tablist" aria-orientation="vertical" aria-label="Emplacements">${SLOTS[st.tab].map(([k, l, ic]) => `<button type="button" role="tab" class="ck-slot${st.slot === k ? ' on' : ''}" aria-selected="${st.slot === k}" data-slot="${k}"><span class="ic">${ic}</span><span><b>${esc(l)}</b><span class="lbl">${esc(curOf(k))}</span></span><span class="cnt">${k === 'base' ? '' : countOf(k)}</span></button>`).join('')}</nav>
        <div class="ck-choice"><div class="ck-ch"><h2>${esc(title)}</h2>${st.slot !== 'base' ? `<div class="ck-filters">${([['all', 'Tout'], ['own', 'Possédés'], ['lock', 'À débloquer']] as const).map(([k, l]) => `<button type="button" class="chip${st.filter === k ? ' on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>` : ''}</div>${choice()}</div>
      </div>
      <footer class="ck-foot"><span class="ck-status ${tr ? 'warn' : st.savedMsg ? 'ok' : ''}" role="status">${esc(status)}</span>${tr ? '<a class="ck-ghost" href="#/boutique">Voir dans la boutique</a>' : ''}
        <div class="ck-btns"><button type="button" class="ck-ghost" id="ckRand">Au hasard</button><button type="button" class="ck-ghost" id="ckUndo">Annuler</button><button type="button" class="ck-gold" id="ckSave" aria-disabled="${!!tr || st.saving}">${st.saving ? 'Enregistrement…' : 'Enregistrer'}</button></div></footer>
    </section>`;
    // carte animée de l'aperçu : elle joue en boucle
    const played = root.querySelector('.ck-played') as HTMLElement | null;
    if (played?.dataset.animKey) attachAnim(played, played.dataset.animKey);
    wire();
  };
  const change = () => { st.savedMsg = false; render(); };
  const wire = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab as Tab; st.slot = SLOTS[st.tab][st.tab === 'pirate' ? 1 : 0][0]; st.filter = 'all'; render(); });
    root.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach(b => b.onclick = () => { st.slot = b.dataset.slot!; st.filter = 'all'; render(); });
    root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b => b.onclick = () => { st.filter = b.dataset.filter as any; render(); });
    root.querySelectorAll<HTMLButtonElement>('[data-base]').forEach(b => b.onclick = () => {
      const k = b.dataset.base!, v = b.dataset.v!;
      if (k === 'color') st.color = v; else if (k === 'skin' || k === 'hc') L()[k] = Number(v); else L()[k] = v;
      change();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-item]').forEach(b => b.onclick = () => {
      const it = CATALOG.byId[b.dataset.item!]; if (!it) return;
      if (it.slot === 'card_back') L().card_back = it.value;
      else if (it.slot === 'title') L().title = it.value;
      else st.look = withItem(st.look, it.id);
      change();
    });
    root.querySelector<HTMLButtonElement>('[data-notitle]')?.addEventListener('click', () => { L().title = null; change(); });
    root.querySelectorAll<HTMLElement>('[data-anim]').forEach(r => {
      const show = () => { st.animPrev = r.dataset.anim!; render(); };
      r.onclick = ev => { if ((ev.target as HTMLElement).closest('[data-toggle]')) return; show(); };
      r.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); show(); } };
    });
    root.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach(b => b.onclick = () => {
      const v = b.dataset.toggle!; if (!animOwned.includes(v)) return;
      const list = L().card_anims as string[]; L().card_anims = list.includes(v) ? list.filter(x => x !== v) : [...list, v];
      st.animPrev = v; change();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-set]').forEach(b => b.onclick = () => {
      if (b.dataset.set === 'son') setImpactSound(!impactSound()); else setOthersAnimated(!othersAnimated());
      render();
    });
    const say = (t: string) => { st.say = t; render(); clearTimeout(sayTimer); sayTimer = setTimeout(() => { st.say = null; if (st.slot === 'reaction') render(); }, 2600); };
    root.querySelectorAll<HTMLButtonElement>('[data-react]').forEach(b => b.onclick = () => {
      const v = b.dataset.react!, it = item('reaction', v)!; if (!has(it)) { say(it.name); return; } // verrouillée : on l'entend, on ne l'ajoute pas
      let bar = (L().reactions as string[]).slice();
      if (bar.includes(v)) bar = bar.filter(x => x !== v); else { if (bar.length >= 4) bar.shift(); bar.push(v); }
      L().reactions = bar; st.savedMsg = false; bar.includes(v) ? say(it.name) : render();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-unreact]').forEach(b => b.onclick = () => { L().reactions = (L().reactions as string[]).filter(x => x !== b.dataset.unreact); change(); });
    $('#ckUndo', root).onclick = () => { st.look = JSON.parse(JSON.stringify(st.saved)); st.color = st.savedColor; change(); };
    $('#ckRand', root).onclick = () => {
      const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
      for (const s of PIRATE_SLOTS) { const mine = itemsOf(s).filter(has); if (mine.length) st.look = withItem(st.look, pick(mine).id); }
      Object.assign(L(), { skin: Math.floor(Math.random() * 6), hc: Math.floor(Math.random() * 6), hair: pick(HAIR_OPTS)[1], beard: pick(BEARD_OPTS)[1] });
      change();
    };
    $('#ckSave', root).onclick = async () => {
      if (trying() || st.saving) return;
      st.saving = true; render();
      try {
        await callGame('profile.update', { look: st.look, color: st.color });
        st.saved = JSON.parse(JSON.stringify(st.look)); st.savedColor = st.color; st.savedMsg = true; forgetProfile();
      } catch (e: any) { toast(e.message, 'err'); }
      finally { st.saving = false; render(); }
    };
  };
  let sayTimer: any = null;
  setCleanup(() => { clearTimeout(sayTimer); root.querySelectorAll<HTMLElement>('.ck-played').forEach(detachAnim); });
  render();
}
