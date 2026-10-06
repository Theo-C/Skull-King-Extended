// Superposition d'ouverture de coffre (maquette docs/ecrans-compte/maquettes/Coffre.dc.html).
// 7 phases : idle → shake → glow → tint → open → item → done (ou convert pour un doublon avant done).
// L'animation du coffre tourne toujours en entier (le réglage système prefers-reduced-motion est ignoré par choix produit) ;
// sons via sfx (coupés si l'option est désactivée). Le bouton « Passer » reste là pour qui veut sauter l'anim.
import { esc } from './util';
import { objectSVG } from './objects';
import { sfx } from './sound';

export interface ChestResult {
  cosmetic_id: string; slot: string; value: string; name: string;
  rarity: 'c' | 'r' | 'e' | 'l' | 'm'; duplicate: boolean;
  coins_gained: number; coins: number; chests: number;
}
export interface ChestCallbacks {
  /** Equiper l'objet (profile.update { look }) ; appelle onDone pour fermer après succès. */
  onEquip?: (slot: string, value: string, cosmeticId: string) => Promise<void>;
  /** Ouvrir le coffre suivant ; renvoie le nouveau résultat ou null si plus de coffres. */
  onOpenNext?: () => Promise<ChestResult>;
  /** Échec du tirage côté serveur (la superposition se ferme d'elle-même). */
  onError?: (e: unknown) => void;
  /** Fermeture (après Équiper, Continuer, ou Échap). */
  onClose?: () => void;
  /** Couleur de manteau du joueur, pour les objets qui tombent sur un avatar en repli. */
  color?: string;
}

const RAR: Record<string, { label: string; color: string; soft: string; p: string; hold: number }> = {
  c: { label: 'Commun',      color: '#d6dde4', soft: 'rgba(214,221,228,.5)', p: '61 %', hold: 1500 },
  r: { label: 'Rare',        color: '#4fa8ff', soft: 'rgba(79,168,255,.55)', p: '26 %', hold: 1800 },
  e: { label: 'Épique',      color: '#c27dff', soft: 'rgba(194,125,255,.6)', p: '9 %',  hold: 2100 },
  l: { label: 'Légendaire',  color: '#ffc94a', soft: 'rgba(255,201,74,.7)',  p: '3 %',  hold: 2500 },
  m: { label: 'Mythique',    color: '#c39bff', soft: 'rgba(195,155,255,.7)', p: '1 %',  hold: 2800 },
};
const IRID = 'conic-gradient(#ff9ad5,#ffd36b,#8dffb0,#7fc8ff,#c39bff,#ff9ad5)';
const SLOT_LABEL: Record<string, string> = { card_anim: 'Carte animée', card_back: 'Dos de cartes', title: 'Titre', reaction: 'Réaction rapide', hat: 'Chapeau', face: 'Yeux et visage', neck: 'Cou', pet: 'Compagnon', bg: 'Décor', frame: 'Cadre' };

let stylesInstalled = false;
function installStyles() {
  if (stylesInstalled) return; stylesInstalled = true;
  const css = `
.chov{position:fixed;inset:0;z-index:70;overflow:hidden;background:radial-gradient(ellipse at 50% 60%,#2a1f17 0%,#120e0b 62%);color:#efe6d2;font-family:'Alegreya Sans',sans-serif;display:flex;flex-direction:column;animation:cfade .3s ease-out both}
.chov[hidden]{display:none}
@keyframes cfade{from{opacity:0}to{opacity:1}}
.chov .chead{display:flex;align-items:center;gap:16px;padding:14px 24px;z-index:30;flex:none}
.chov .chead h2{margin:0;font:400 24px 'IM Fell English SC',serif;color:#ead08a}
.chov .chead .count{font-size:14px;color:#a8987f}
.chov .chead .cwal{margin-left:auto;display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:0 14px;border-radius:999px;background:rgba(0,0,0,.4);border:1px solid rgba(234,208,138,.3)}
.chov .chead .cwal .coin{width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2c4 0 12%,#e2bd62 40%,#a77b22 100%)}
.chov .chead .cwal b{font:400 20px 'Pirata One',serif;color:#ead08a}
.chov .chead .cwal.bump b{animation:cbump .3s ease-out 3}
@keyframes cbump{0%,100%{transform:none}40%{transform:scale(1.3)}}
.chov .chead .chskip{min-height:36px;padding:0 14px;border-radius:9px;border:1px solid rgba(234,208,138,.45);background:rgba(0,0,0,.3);color:#f2e7cd;font-weight:800;font-size:13px;cursor:pointer}
.chov .cstage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
.chov .chalo{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);width:min(700px,80vw);aspect-ratio:1;border-radius:50%;transition:opacity .8s,transform .8s,background 1s}
.chov .crays{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);width:min(600px,70vw);aspect-ratio:1;opacity:0;transition:opacity .8s;pointer-events:none}
.chov .crays>span{display:block;width:100%;height:100%;border-radius:50%;animation:cspin 18s linear infinite;transition:background 1s}
@keyframes cspin{to{transform:rotate(360deg)}}
.chov .crays>span{-webkit-mask:radial-gradient(circle,#000 0%,rgba(0,0,0,.45) 30%,transparent 64%);mask:radial-gradient(circle,#000 0%,rgba(0,0,0,.45) 30%,transparent 64%)}
.chov .cchest{position:relative;z-index:5;width:320px;height:340px;transform-origin:50% 95%;transition:opacity .8s,filter .8s}
.chov .cchest.dim{filter:brightness(.45) saturate(.7)}
.chov .cchest.bob{animation:cbob 2.6s ease-in-out infinite}
@keyframes cbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.chov .cchest.shake{animation:cshake .45s ease-in-out 2}
@keyframes cshake{0%,100%{transform:rotate(0)}15%{transform:rotate(-2.5deg)}30%{transform:rotate(2.5deg)}45%{transform:rotate(-2deg)}60%{transform:rotate(2deg)}75%{transform:rotate(-1deg)}}
.chov .cchest.hum{animation:chum .35s ease-in-out infinite}
@keyframes chum{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.chov .cbase{position:absolute;left:0;top:155px;width:320px;height:185px}
.chov .cseam{position:absolute;left:18px;top:150px;width:284px;height:10px;border-radius:5px;transition:opacity .8s,box-shadow .9s,background 1s;opacity:0}
.chov .clid{position:absolute;left:0;top:15px;width:320px;height:143px;transform-origin:8% 100%;transition:transform .9s cubic-bezier(.3,.7,.3,1)}
.chov .clid.crack{transform:translateY(-14px) rotate(-5deg)}
.chov .clid.open{transform:translate(-36px,-120px) rotate(-34deg);transition:transform .5s cubic-bezier(.2,.9,.3,1.1)}
.chov .cburst{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);width:200px;height:200px;border-radius:50%;z-index:7;pointer-events:none;opacity:0}
.chov .cburst.go{animation:cburst .8s ease-out forwards}
@keyframes cburst{from{transform:translate(-50%,-50%) scale(.3);opacity:1}to{transform:translate(-50%,-50%) scale(3.2);opacity:0}}
.chov .csparks{position:absolute;left:50%;top:52%;width:0;height:0;z-index:7;pointer-events:none}
.chov .csparks span{position:absolute;border-radius:50%;animation:cspark var(--t) cubic-bezier(.1,.7,.3,1) var(--d) forwards}
@keyframes cspark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
.chov .citem{position:absolute;left:50%;top:16%;transform:translate(-50%,0);width:240px;height:240px;display:flex;align-items:center;justify-content:center;z-index:9;opacity:0}
.chov .citem.rise{animation:crise .8s cubic-bezier(.2,.9,.3,1.1) both}
@keyframes crise{0%{transform:translate(-50%,170px) scale(.4);opacity:0}100%{transform:translate(-50%,0) scale(1);opacity:1}}
.chov .citem .cfloat{animation:cfloat 3.4s ease-in-out infinite}
@keyframes cfloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10px) rotate(2deg)}}
.chov .citem.melt{animation:cmelt .5s ease-in forwards}
@keyframes cmelt{to{transform:translate(-50%,0) scale(.15);opacity:0}}
.chov .ctext{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);width:min(640px,86vw);text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:10;opacity:0;pointer-events:none}
.chov .ctext.on{opacity:1;pointer-events:auto;transition:opacity .4s ease-out}
.chov .ctext .crow1{display:flex;align-items:center;gap:10px;animation:cup .45s ease-out both}
.chov .ctext .crow1 .crlbl{font-size:13px;font-weight:800;letter-spacing:.22em;text-transform:uppercase}
.chov .ctext .crow1 .cstar{animation:cstar .35s cubic-bezier(.2,.8,.3,1.4) both}
@keyframes cstar{0%{transform:scale(0);opacity:0}70%{transform:scale(1.3);opacity:1}100%{transform:none;opacity:1}}
.chov .ctext .cname{font:400 36px/1.05 'IM Fell English SC',serif;color:#f2e7cd;animation:cup .45s .15s ease-out both}
.chov .ctext .csub{font-size:14px;font-weight:700;color:#d9cdb6;animation:cup .45s .3s ease-out both}
@keyframes cup{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.chov .cidle{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:12px;z-index:10}
.chov .cidle .ciopen{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 30px;border-radius:10px;border:0;background:linear-gradient(180deg,#e2bd62,#b78c33);color:#2b2117;font-weight:800;font-size:18px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(90,60,10,.5),0 2px 0 #6b4c14;font-family:inherit}
.chov .cidle .codds{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 14px;font-size:13px;color:#a8987f}
.chov .cidle .codds>span{display:inline-flex;align-items:center;gap:6px}
.chov .cidle .codds i{width:9px;height:9px;border-radius:50%;font-style:normal}
.chov .cact{position:absolute;right:24px;bottom:24px;display:flex;gap:10px;z-index:12;animation:cup .45s ease-out both}
.chov .cact button{min-height:50px;padding:0 20px;border-radius:10px;font-weight:800;font-size:16px;cursor:pointer;border:0;font-family:inherit}
.chov .cact .ghost{background:rgba(0,0,0,.3);border:1px solid rgba(234,208,138,.45);color:#f2e7cd}
.chov .cact .gold{background:linear-gradient(180deg,#e2bd62,#b78c33);color:#2b2117;box-shadow:inset 0 0 0 1px rgba(90,60,10,.5),0 2px 0 #6b4c14}
.chov .ccoins{position:absolute;left:50%;top:24%;transform:translate(-50%,0);width:0;height:0;z-index:26;pointer-events:none}
.chov .ccoins span{position:absolute;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2c4 0 12%,#e2bd62 40%,#a77b22 100%);box-shadow:inset 0 0 0 1.5px rgba(90,60,10,.6);animation:ccoin .9s cubic-bezier(.5,0,.6,1) var(--d) both}
@keyframes ccoin{0%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.5);opacity:.2}}
.chov .csock{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:min(500px,70vw);pointer-events:none;z-index:0}
/* Mythique : halo et rayons irisés (teinte qui tourne) */
.chov.myth .chalo,.chov.myth .crays>span{animation:cirid 3s linear infinite}
.chov.myth .crays>span{animation:cspin 18s linear infinite,cirid 3s linear infinite}
@keyframes cirid{to{filter:hue-rotate(360deg)}}
.chov .ctext .crlbl.irid{padding:2px 10px;border-radius:999px;color:#1b140e!important;background:${IRID}}
.chov .citem.shown{opacity:1}
@media (max-width:720px){.chov .chead{padding:12px 14px}.chov .chead h2{font-size:20px}.chov .ctext{bottom:90px}.chov .ctext .cname{font-size:28px}.chov .cact{right:12px;bottom:12px}.chov .cact button{min-height:46px;padding:0 14px;font-size:14px}.chov .cchest{width:260px;height:280px;transform:scale(.8)}}
`;
  const el = document.createElement('style'); el.setAttribute('data-chov', ''); el.textContent = css; document.head.append(el);
}

const CHEST_BASE_SVG = `<svg viewBox="0 0 260 150" style="width:320px;height:185px;display:block" aria-hidden="true">
<defs><linearGradient id="ccg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8a5833"/><stop offset="1" stop-color="#4a2b16"/></linearGradient></defs>
<rect x="10" y="0" width="240" height="142" rx="8" fill="url(#ccg)" stroke="#2a170b" stroke-width="3"/>
<path d="M14 48h232M14 96h232" stroke="#3a2214" stroke-width="2" opacity=".7"/>
<rect x="36" y="0" width="18" height="142" fill="#c9a14a" stroke="#6b4c14" stroke-width="1.5"/>
<rect x="206" y="0" width="18" height="142" fill="#c9a14a" stroke="#6b4c14" stroke-width="1.5"/>
<circle cx="45" cy="24" r="3" fill="#6b4c14"/><circle cx="45" cy="118" r="3" fill="#6b4c14"/>
<circle cx="215" cy="24" r="3" fill="#6b4c14"/><circle cx="215" cy="118" r="3" fill="#6b4c14"/>
<rect x="10" y="130" width="240" height="12" rx="4" fill="#c9a14a" stroke="#6b4c14" stroke-width="1.5"/>
<path d="M108 0h44v44c0 10-10 16-22 16s-22-6-22-16z" fill="#e3c47a" stroke="#6b4c14" stroke-width="2"/>
<circle cx="130" cy="22" r="6" fill="#2a170b"/><path d="M127 26h6l2 16h-10z" fill="#2a170b"/>
</svg>`;
const CHEST_LID_SVG = `<svg viewBox="0 0 260 116" style="width:320px;height:143px;display:block" aria-hidden="true">
<defs><linearGradient id="ccl" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#9a6439"/><stop offset="1" stop-color="#6b4226"/></linearGradient></defs>
<path d="M10 112V64C10 22 62 4 130 4s120 18 120 60v48z" fill="url(#ccl)" stroke="#2a170b" stroke-width="3"/>
<path d="M40 112V30M220 112V30" stroke="#c9a14a" stroke-width="18"/>
<path d="M14 64C30 34 80 22 130 22s100 12 116 42" fill="none" stroke="#3a2214" stroke-width="2" opacity=".6"/>
<rect x="10" y="100" width="240" height="12" rx="4" fill="#c9a14a" stroke="#6b4c14" stroke-width="1.5"/>
<circle cx="40" cy="50" r="3" fill="#6b4c14"/><circle cx="220" cy="50" r="3" fill="#6b4c14"/>
<path d="M112 100h36v12h-36z" fill="#e3c47a" stroke="#6b4c14" stroke-width="1.5"/>
</svg>`;
const SOCKET_SVG = `<svg viewBox="0 0 1440 100" style="width:100%;display:block" aria-hidden="true">
<ellipse cx="720" cy="60" rx="250" ry="38" fill="#000" opacity=".45"/>
<path d="M500 50c0-24 98-38 220-38s220 14 220 38v24c0 24-98 38-220 38s-220-14-220-38z" fill="#3a2416"/>
<ellipse cx="720" cy="50" rx="220" ry="36" fill="#5a3720"/>
<ellipse cx="720" cy="50" rx="220" ry="36" fill="none" stroke="#c9a14a" stroke-width="2" opacity=".6"/>
</svg>`;

/** Ouvre la superposition tout de suite. Le résultat du serveur (chest.open) peut encore être en route : le coffre flotte,
 *  tremble et luit en attendant ; il ne prend la couleur de la rareté qu'une fois le tirage connu. */
export function openChestOverlay(initial: ChestResult | Promise<ChestResult>, cb: ChestCallbacks = {}): void {
  installStyles();
  const prev = document.querySelector<HTMLElement>('.chov'); if (prev) prev.remove();
  const ov = document.createElement('div'); ov.className = 'chov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Ouverture de coffre');
  document.body.append(ov);
  // piège du focus et Échap
  const prevActive = document.activeElement as HTMLElement | null;
  const close = () => { timers.forEach(clearTimeout); ov.remove(); prevActive?.focus?.(); cb.onClose?.(); };

  const timers: any[] = [];
  const later = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
  let busy = false;

  /** Étincelles, objet, texte et en-tête : tout ce qui dépend du tirage. */
  const sparksHTML = (r: ChestResult) => { const R = RAR[r.rarity]; return Array.from({ length: 26 }, (_, k) => {
      const a = k / 26 * Math.PI * 2, d = 140 + ((k * 53) % 160);
      const dx = Math.round(Math.cos(a) * d), dy = Math.round(Math.sin(a) * d * .7 - 40);
      const sz = 4 + (k % 4) * 2, t = (.7 + (k % 4) * .15).toFixed(2), delay = ((k % 5) * .02).toFixed(2);
      const c = k % 3 ? R.color : '#ffffff';
      const cc = r.rarity === 'm' && c !== '#ffffff' ? ['#ff9ad5', '#ffd36b', '#8dffb0', '#7fc8ff', '#c39bff'][k % 5] : c;
      return `<span style="--dx:${dx}px;--dy:${dy}px;--t:${t}s;--d:${delay}s;left:-4px;top:-4px;width:${sz}px;height:${sz}px;background:${cc};box-shadow:0 0 10px ${cc}"></span>`;
    }).join(''); };
  const textHTML = (r: ChestResult) => {
    const R = RAR[r.rarity];
    const stars = Array.from({ length: ['c','r','e','l','m'].indexOf(r.rarity) + 1 },
      (_, i) => `<svg class="cstar" viewBox="0 0 24 24" style="width:16px;height:16px;animation-delay:${(.2 + i * .15).toFixed(2)}s" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z" fill="${R.color}"/></svg>`).join('');
    return `<div class="crow1"><span class="crlbl${r.rarity === 'm' ? ' irid' : ''}" style="color:${R.color}">${esc(R.label)}</span><span style="display:flex;gap:3px">${stars}</span></div>
          <div class="cname">${esc(r.name)}</div>
          <div class="csub">${esc(SLOT_LABEL[r.slot] || r.slot)} · ${r.duplicate ? (r.slot === 'card_anim' ? 'déjà possédée' : 'déjà possédé') + ' · +' + r.coins_gained + ' pièces' : r.slot === 'card_anim' ? 'nouvelle carte : elle s\'anime quand vous la jouez' : 'nouvel objet'}</div>`;
  };
  const fill = (r: ChestResult) => {
    (ov.querySelector('.count') as HTMLElement).textContent = r.chests > 0 ? r.chests + ' coffre' + (r.chests > 1 ? 's' : '') + ' après celui-ci' : 'dernier coffre';
    // le compteur garde l'ancien solde tant que le doublon n'a pas fondu en pièces
    (ov.querySelector('.cwal b') as HTMLElement).textContent = String(r.duplicate ? r.coins - r.coins_gained : r.coins);
    (ov.querySelector('.csparks') as HTMLElement).innerHTML = sparksHTML(r);
    (ov.querySelector('.citem .cfloat') as HTMLElement).innerHTML = objectSVG(r.slot, r.value, 210, '#2f5f8a', cb.color || '#d9b25a');
    (ov.querySelector('.ctext') as HTMLElement).innerHTML = textHTML(r);
  };
  const fail = (e: unknown) => { close(); if (cb.onError) cb.onError(e); else alert((e as any)?.message || 'Coffre impossible à ouvrir pour l\'instant.'); };

  const render = (pr: ChestResult | Promise<ChestResult>) => {
    timers.forEach(clearTimeout); timers.length = 0; ov.classList.remove('myth');
    const coinsFly = Array.from({ length: 12 }, (_, j) => {
      const dx = 530 + (j % 3) * 6, dy = -164 - (j % 2) * 4, delay = (j * .06).toFixed(2);
      const l = ((j * 29) % 60) - 30, t = ((j * 17) % 40) - 20;
      return `<span style="--dx:${dx}px;--dy:${dy}px;--d:${delay}s;left:${l}px;top:${t}px"></span>`;
    }).join('');
    ov.innerHTML = `<div class="chead">
        <h2>Coffre de victoire</h2>
        <span class="count">…</span>
        <span class="cwal"><span class="coin"></span><b>…</b><span>pièces</span></span>
        <button type="button" class="chskip" hidden>Passer</button>
      </div>
      <div class="cstage">
        <div class="chalo"></div>
        <div class="crays"><span></span></div>
        <div class="csock">${SOCKET_SVG}</div>
        <div class="cchest">
          <div class="cbase">${CHEST_BASE_SVG}</div>
          <div class="cseam"></div>
          <div class="clid">${CHEST_LID_SVG}</div>
        </div>
        <div class="cburst"></div>
        <div class="csparks" hidden></div>
        <div class="citem" hidden><div class="cfloat"></div></div>
        <div class="ccoins" hidden>${coinsFly}</div>
        <div class="ctext" aria-live="polite"></div>
        <div class="cidle"></div>
        <div class="cact" hidden></div>
      </div>`;
    // le tirage arrive (ou est déjà là) : on complète l'affichage ; en cas d'échec, installPhases ferme et prévient
    const result = Promise.resolve(pr); result.then(fill, () => { /* voir installPhases */ });
    installPhases(result);
  };

  const installPhases = (result: Promise<ChestResult>) => {
    // tirage connu plus tard : r et R sont fixés au plus tard avant le changement de teinte
    let r!: ChestResult, R!: typeof RAR[string];
    const known = result.then(x => { r = x; R = RAR[x.rarity]; return x; });
    known.catch(fail);
    const chest = ov.querySelector('.cchest') as HTMLElement;
    const halo = ov.querySelector('.chalo') as HTMLElement;
    const raysWrap = ov.querySelector('.crays') as HTMLElement;
    const raysEl = ov.querySelector('.crays>span') as HTMLElement;
    const seam = ov.querySelector('.cseam') as HTMLElement;
    const lid = ov.querySelector('.clid') as HTMLElement;
    const burst = ov.querySelector('.cburst') as HTMLElement;
    const sparksEl = ov.querySelector('.csparks') as HTMLElement;
    const itemEl = ov.querySelector('.citem') as HTMLElement;
    const text = ov.querySelector('.ctext') as HTMLElement;
    const coinsEl = ov.querySelector('.ccoins') as HTMLElement;
    const cwal = ov.querySelector('.cwal') as HTMLElement;
    const skipBtn = ov.querySelector('.chskip') as HTMLButtonElement;
    const actEl = ov.querySelector('.cact') as HTMLElement;

    const WHITE = '#ffffff', WHITE_SOFT = 'rgba(255,255,255,.45)';
    const setGlow = (color: string, soft: string, pct: number, scale: number) => {
      halo.style.background = `radial-gradient(circle,${soft} 0%,transparent 62%)`;
      halo.style.opacity = String(pct); halo.style.transform = `translate(-50%,-50%) scale(${scale})`;
      raysEl.style.background = `repeating-conic-gradient(from 0deg,${color} 0deg 5deg,transparent 5deg 20deg)`;
      seam.style.background = color;
    };

    const done = () => {
      text.classList.add('on');
      actEl.hidden = false;
      // une carte animée ne se porte pas : posséder suffit, on ferme simplement
      actEl.innerHTML = r.duplicate || r.slot === 'card_anim'
        ? `<button type="button" class="ghost" data-act="again"${r.chests > 0 ? '' : ' hidden'}>Ouvrir le suivant</button><button type="button" class="gold" data-act="close">Continuer</button>`
        : `<button type="button" class="ghost" data-act="again"${r.chests > 0 ? '' : ' hidden'}>Ouvrir le suivant</button><button type="button" class="gold" data-act="equip">Équiper</button>`;
      skipBtn.hidden = true;
      (actEl.querySelector('.gold') as HTMLElement)?.focus();
      actEl.onclick = (ev) => {
        const b = (ev.target as HTMLElement).closest('[data-act]') as HTMLButtonElement | null; if (!b || busy) return;
        const a = b.dataset.act;
        if (a === 'close') close();
        else if (a === 'equip') { busy = true; b.disabled = true; cb.onEquip!(r.slot, r.value, r.cosmetic_id).then(close, (e) => { busy = false; b.disabled = false; alert((e as any)?.message || 'Erreur à l\'équipement.'); }); }
        else if (a === 'again') render(cb.onOpenNext!());
      };
    };
    /** Objet sorti, sans animation de montée (bouton Passer) : couvercle ouvert, teinte de rareté. */
    const reveal = () => {
      timers.forEach(clearTimeout); timers.length = 0; ov.classList.toggle('myth', r.rarity === 'm');
      chest.classList.remove('bob', 'shake', 'hum'); chest.classList.add('dim');
      lid.classList.remove('crack'); lid.classList.add('open');
      setGlow(R.color, R.soft, 1, 1); seam.style.opacity = '1'; raysWrap.style.opacity = '.35';
      itemEl.hidden = false; itemEl.classList.add('shown'); itemEl.style.filter = `drop-shadow(0 0 24px ${R.color})`;
    };
    const convert = () => {
      itemEl.classList.add('melt');
      coinsEl.hidden = false;
      cwal.classList.add('bump'); (cwal.querySelector('b') as HTMLElement).textContent = String(r.coins);
      try { sfx.coin(); } catch { /* son indisponible */ }
      later(1200, done);
    };
    const open = () => {
      lid.classList.remove('crack'); lid.classList.add('open');
      burst.style.background = `radial-gradient(circle,#fff 0%,${R.color} 40%,transparent 70%)`;
      burst.classList.add('go');
      sparksEl.hidden = false;
      chest.classList.remove('hum');
      try { sfx.open(); } catch { /* son indisponible */ }
      later(350, () => {
        itemEl.hidden = false; itemEl.classList.add('rise'); chest.classList.add('dim');
        itemEl.style.filter = `drop-shadow(0 0 24px ${R.color})`;
        if (r.duplicate) later(1000, convert); else later(900, done);
      });
    };
    const tint = () => {
      raysEl.style.transition = 'background 1s';
      try { sfx.chord(r.rarity); } catch { /* son indisponible */ }
      if (r.rarity !== 'm') { setGlow(R.color, R.soft, 1, 1); later(1000, open); return; }
      // Mythique : la lueur passe par l'or pendant 1 s, puis devient irisée
      setGlow(RAR.l.color, RAR.l.soft, 1, 1);
      later(1000, () => { setGlow(R.color, R.soft, 1, 1.05); raysEl.style.background = `repeating-conic-gradient(from 0deg,#ff9ad5 0deg 5deg,transparent 5deg 20deg,#8dffb0 20deg 25deg,transparent 25deg 40deg,#7fc8ff 40deg 45deg,transparent 45deg 60deg)`; ov.classList.add('myth'); later(1000, open); });
    };
    const glow = () => {
      chest.classList.remove('shake'); chest.classList.add('hum');
      lid.classList.add('crack');
      setGlow(WHITE, WHITE_SOFT, .55, 1);
      seam.style.opacity = '1'; seam.style.boxShadow = `0 0 30px 8px ${WHITE}`;
      raysWrap.style.opacity = '.35';
      try { sfx.breath(RAR.c.hold / 1000); } catch { /* son indisponible */ }
      // la lueur blanche dure selon la rareté ; si le serveur tarde, elle continue jusqu'à sa réponse
      const t0 = Date.now();
      known.then(() => later(Math.max(0, R.hold - (Date.now() - t0)), tint), () => { /* fail() a fermé */ });
    };
    const shake = () => {
      chest.classList.remove('bob'); chest.classList.add('shake');
      try { sfx.creak(); } catch { /* son indisponible */ }
      setGlow(WHITE, WHITE_SOFT, .2, .8); seam.style.opacity = '.5';
      later(900, glow);
    };

    chest.classList.add('bob');
    setGlow(WHITE, WHITE_SOFT, .08, .8); seam.style.opacity = '.1';

    const start = () => {
      skipBtn.hidden = false;
      (ov.querySelector('.cidle') as HTMLElement).innerHTML = '';
      shake();
    };
    const idle = ov.querySelector('.cidle') as HTMLElement;
    idle.innerHTML = `<button type="button" class="ciopen">Ouvrir le coffre</button>
      <div class="codds">${Object.entries(RAR).map(([, R]) => `<span><i style="background:${R === RAR.m ? IRID : R.color}"></i>${esc(R.label)} ${R.p}</span>`).join('')}</div>`;
    (idle.querySelector('.ciopen') as HTMLButtonElement).onclick = start;
    (idle.querySelector('.ciopen') as HTMLButtonElement).focus();
    skipBtn.onclick = () => { skipBtn.disabled = true; known.then(() => { reveal(); if (r.duplicate) convert(); else done(); }, () => { /* fail() a fermé */ }); };
  };

  render(initial);
  ov.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); close(); } });
}
