// <booster-opening> : écran complet d'ouverture de booster (carrousel, coupe au doigt, ouverture,
// cartes qui sortent du sachet, pile à faire glisser, 5e carte cachée, moment Signée / Numérotée, butin).
// Portage fidèle de la maquette docs/maquettes/Booster.dc.html (mêmes durées, courbes, distances).
// Web Component sans dépendance : marche dans React, Vue, Svelte ou du HTML simple.
//
// Utilisation :
//   import './booster/booster-opening.js';
//   const el = document.createElement('booster-opening');
//   el.packs = [{ id, name, desc, sachet, back, featured: [cardId…] }];
//   el.price = 50; el.coins = 1240; el.freeLabel = 'Après ta 1re partie du jour';
//   el.open = async (packId) => ({ cards: [{ id, name, variant, rarity, isNew, shards, serial }×5], divine, collection: { before, after, total } });
//   el.renderCard = (card, { width, still }) => HTMLElement   // facultatif : votre composant de carte (variantes) ; sinon image cards/<id>.webp
//   el.addEventListener('booster-close', …); el.addEventListener('booster-collection', …);
//   el.gyro = true;            // inclinaison des cartes avec le gyroscope du téléphone (iOS : demander DeviceOrientationEvent.requestPermission())
//   el.haptics = (kind) => {}   // 'light' | 'medium' | 'heavy' (Capacitor Haptics)
//   el.sfx = (name) => {}       // 'crinkle' | 'cut' | 'tear' | 'swipe' | 'chime' | 'chord' | 'fanfare'
//
// rarity : 'c' (Patinée, Étain) · 'r' (Holo) · 'e' (Nacre, Vivante) · 'l' (Signée) · 'm' (Numérotée)

const CSS = `
:host{display:block;position:relative;width:100%;height:100%;min-height:560px;overflow:hidden;font-family:'Alegreya Sans',system-ui,sans-serif;color:#efe6d2;background:radial-gradient(ellipse at 50% 38%,#18303a,#0b1419 55%,#06090b);-webkit-tap-highlight-color:transparent;user-select:none}
.caus{position:absolute;inset:-20%;background:radial-gradient(ellipse 30% 12% at 30% 30%,rgba(120,220,255,.07),transparent 70%),radial-gradient(ellipse 25% 10% at 70% 55%,rgba(120,220,255,.06),transparent 70%),radial-gradient(ellipse 20% 9% at 45% 80%,rgba(120,220,255,.05),transparent 70%);animation:caus 14s ease-in-out infinite alternate;pointer-events:none}
@keyframes caus{to{transform:translate(4%,-3%) rotate(3deg)}}
.fit{position:absolute;left:50%;top:50%;width:680px;height:900px;transform-origin:50% 50%}
button{font-family:inherit}
.btn{min-height:46px;padding:0 20px;border-radius:12px;border:1px solid rgba(234,208,138,.45);background:rgba(0,0,0,.35);color:#f2e7cd;font-weight:800;font-size:15px;cursor:pointer}
.btn.gold{border:0;background:linear-gradient(180deg,#f0cf72,#b78c33);color:#2b2117;box-shadow:0 6px 18px rgba(183,140,51,.35)}
.btn.ghost{border-color:transparent;background:transparent;color:#a8b8bf}
.btn[disabled]{opacity:.45;cursor:default}
.car{position:absolute;left:0;top:0;width:680px;height:620px;perspective:1100px;z-index:5}
.pw{position:absolute;left:230px;top:70px;width:220px;height:360px;transition:transform .55s cubic-bezier(.3,1.1,.4,1),opacity .4s,filter .4s;transform-style:preserve-3d;cursor:pointer}
.pw.off{pointer-events:none}
.in{position:absolute;inset:0}
.pbody,.lid{position:absolute;left:0;right:0;top:0;background-size:100% 100%;background-repeat:no-repeat;border-radius:4px}
.pbody{bottom:0;filter:drop-shadow(0 18px 24px rgba(0,0,0,.6))}
.lid{height:34px;z-index:2}
.foil{position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.35) 45%,rgba(160,220,255,.25) 50%,transparent 65%);background-size:250% 100%;animation:foil 3.4s ease-in-out infinite;mix-blend-mode:screen;pointer-events:none}
@keyframes foil{0%{background-position:130% 0}70%,100%{background-position:-60% 0}}
.float{animation:fl 3.2s ease-in-out infinite}
@keyframes fl{0%,100%{translate:0 0;rotate:-1deg}50%{translate:0 -10px;rotate:1deg}}
.shadow{position:absolute;left:250px;top:452px;width:180px;height:22px;border-radius:50%;background:radial-gradient(rgba(0,0,0,.55),transparent 70%);transition:opacity .4s}
.cutzone{position:absolute;left:-30px;right:-30px;top:-22px;height:80px;cursor:crosshair;touch-action:none;z-index:4}
.dots{position:absolute;left:10px;right:10px;top:33px;border-top:2px dashed rgba(255,244,214,.85);filter:drop-shadow(0 0 3px rgba(0,0,0,.8));z-index:3}
.cutline{position:absolute;left:0;top:31px;width:220px;height:5px;border-radius:3px;background:linear-gradient(90deg,rgba(255,255,255,.2),#fff);box-shadow:0 0 12px 3px #fff6c9,0 0 30px 6px #ffd36e;transform-origin:0 50%;transform:scaleX(var(--cut,0));z-index:3}
.tip{position:absolute;top:22px;left:calc(var(--cut,0) * 220px);width:22px;height:22px;margin-left:-11px;border-radius:50%;background:radial-gradient(circle,#fff,rgba(255,240,190,.7) 40%,transparent 70%);animation:tw .25s linear infinite alternate;z-index:3;display:none}
.cutting .tip{display:block}
@keyframes tw{to{transform:scale(1.4)}}
.runner{position:absolute;top:24px;left:10px;width:46px;height:18px;margin-left:-23px;border-radius:50%;background:radial-gradient(ellipse,#fff 0,rgba(255,236,170,.9) 25%,rgba(255,210,110,.35) 55%,transparent 72%);mix-blend-mode:screen;pointer-events:none;animation:run 2s cubic-bezier(.5,0,.5,1) infinite;z-index:3}
@keyframes run{0%{left:10px;opacity:0}12%{opacity:1}80%{left:210px;opacity:1}100%{left:210px;opacity:0}}
.chev{position:absolute;right:-30px;top:16px;font:900 22px/1 system-ui;letter-spacing:-2px;color:#ffe9b0;text-shadow:0 0 8px rgba(255,210,110,.9);animation:chv 1s ease-in-out infinite alternate;pointer-events:none;z-index:3}
@keyframes chv{from{opacity:.35;transform:translateX(-4px)}to{opacity:1;transform:translateX(3px)}}
.touched .runner,.touched .chev{display:none}
.scis{position:absolute;left:-26px;top:20px;font-size:22px;color:#fff4d6;filter:drop-shadow(0 1px 2px #000);z-index:3}
.opening .lid{animation:lidoff .55s cubic-bezier(.4,0,.8,.6) forwards}
@keyframes lidoff{to{transform:translate(260px,-180px) rotate(38deg);opacity:0}}
.opening .pbody{clip-path:polygon(0% 9.4%,4.5% 9.1%,9.1% 9.8%,13.6% 9.2%,18.2% 9.7%,22.7% 9.0%,27.3% 9.6%,31.8% 9.3%,36.4% 9.9%,40.9% 9.1%,45.5% 9.6%,50% 9.2%,54.5% 9.8%,59.1% 9.0%,63.6% 9.5%,68.2% 9.3%,72.7% 9.9%,77.3% 9.1%,81.8% 9.7%,86.4% 9.2%,90.9% 9.6%,95.5% 9.0%,100% 9.4%,100% 100%,0% 100%)}
.opening.in{animation:pdrop .6s ease-in 1.05s forwards}
@keyframes pdrop{to{transform:translateY(560px);opacity:0}}
.leak{position:absolute;left:-60px;right:-60px;top:-160px;height:220px;pointer-events:none;opacity:0;background:radial-gradient(ellipse 50% 60% at 50% 100%,rgba(255,236,190,.95),transparent 70%);mix-blend-mode:screen;z-index:3}
.opening .leak{animation:leak 1.1s ease-out .2s forwards}
@keyframes leak{0%{opacity:0;transform:scaleY(.2)}35%{opacity:1;transform:scaleY(1.2)}100%{opacity:0;transform:scaleY(1.6)}}
.lrays{position:absolute;left:50%;top:34px;width:700px;height:700px;margin:-350px 0 0 -350px;border-radius:50%;opacity:0;pointer-events:none;background:repeating-conic-gradient(rgba(255,236,190,.95) 0 4deg,transparent 4deg 15deg);-webkit-mask:radial-gradient(circle,#000 5%,transparent 60%);mask:radial-gradient(circle,#000 5%,transparent 60%);mix-blend-mode:screen}
.opening .lrays{animation:lr 1.3s ease-out .25s forwards}
@keyframes lr{0%{opacity:0;transform:rotate(0) scale(.3)}30%{opacity:.9}100%{opacity:0;transform:rotate(40deg) scale(1.2)}}
.gsp{position:absolute;top:30px;width:5px;height:5px;border-radius:50%;background:#fff6d0;box-shadow:0 0 6px 2px rgba(255,214,120,.9);opacity:0;pointer-events:none;animation:gsp 1.6s ease-out both;z-index:3}
@keyframes gsp{0%{opacity:0;transform:translateY(0)}20%{opacity:1}100%{opacity:0;transform:translateY(-150px) translateX(12px)}}
.flash{position:absolute;inset:-200px;background:#fff;opacity:0;pointer-events:none;z-index:30}
.flash.go{animation:fla .5s ease-out}
@keyframes fla{0%{opacity:.75}100%{opacity:0}}
.stk{position:absolute;left:200px;top:90px;width:280px;height:398px;z-index:9}
.stk.rise{animation:rise 1.35s cubic-bezier(.35,.1,.25,1) .5s both}
@keyframes rise{0%{transform:translateY(0) scale(.82);z-index:1}45%{transform:translateY(-175px) scale(.82);z-index:1}58%{z-index:9}100%{transform:none;z-index:9}}
.slot{position:absolute;inset:0}
.peek{transform:translate(14px,12px) rotate(3deg) scale(.965);filter:brightness(.55)}
.peek2{transform:translate(26px,22px) rotate(6deg) scale(.93);filter:brightness(.35)}
.top{touch-action:none;cursor:grab;transition:transform .25s cubic-bezier(.3,1.3,.5,1)}
.top.drag{transition:none;cursor:grabbing}
.pop{animation:pop .45s cubic-bezier(.3,1.4,.5,1)}
@keyframes pop{from{scale:.9}to{scale:1}}
.flipw{position:absolute;inset:0;perspective:1200px}
.flip{position:absolute;inset:0;transform-style:preserve-3d;transition:transform 1.1s cubic-bezier(.3,1.25,.45,1)}
.flipw.up .flip{transform:rotateY(180deg)}
.face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.face.front{transform:rotateY(180deg)}
.hid:not(.up){cursor:pointer}
.hid:not(.up) .flip{animation:breath 2.4s ease-in-out infinite}
.hid:not(.up) .face.back{animation:bglow 2.4s ease-in-out infinite}
@keyframes breath{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes bglow{0%,100%{filter:drop-shadow(0 0 10px rgba(255,233,176,.35))}50%{filter:drop-shadow(0 0 22px rgba(255,233,176,.6))}}
.fly{pointer-events:none}
.fly.l{animation:flyl .45s cubic-bezier(.5,0,.9,.5) forwards}.fly.r{animation:flyr .45s cubic-bezier(.5,0,.9,.5) forwards}
@keyframes flyl{to{transform:translate(-620px,60px) rotate(-28deg);opacity:0}}
@keyframes flyr{to{transform:translate(620px,60px) rotate(28deg);opacity:0}}
.burst{position:absolute;left:50%;top:50%;width:620px;height:620px;margin:-310px 0 0 -310px;border-radius:50%;pointer-events:none;opacity:0}
.burst.go{animation:bst .9s ease-out}
@keyframes bst{0%{opacity:0;transform:scale(.3)}25%{opacity:1}100%{opacity:0;transform:scale(1.3)}}
.ring{position:absolute;left:50%;top:50%;width:300px;height:300px;margin:-150px 0 0 -150px;border-radius:50%;border:3px solid var(--rc);pointer-events:none;opacity:0}
.ring.go{animation:rg .8s ease-out}
@keyframes rg{0%{opacity:1;transform:scale(.6)}100%{opacity:0;transform:scale(2)}}
.spark{position:absolute;width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 8px 2px var(--rc);left:50%;top:50%;opacity:0;pointer-events:none;animation:sp 1s ease-out var(--d) both}
@keyframes sp{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--x),var(--y))}}
.dim{position:absolute;inset:-400px;background:rgba(2,3,4,.82);z-index:8;animation:fi .5s both;pointer-events:none}
.grays{position:absolute;left:50%;top:50%;width:900px;height:900px;margin:-450px 0 0 -450px;border-radius:50%;background:repeating-conic-gradient(rgba(255,215,120,.32) 0 6deg,transparent 6deg 18deg);animation:spin 14s linear infinite,fi .6s both;-webkit-mask:radial-gradient(circle,#000 12%,transparent 60%);mask:radial-gradient(circle,#000 12%,transparent 60%);pointer-events:none}
.grays.m{background:repeating-conic-gradient(rgba(231,198,255,.38) 0 6deg,rgba(155,231,255,.22) 6deg 11deg,transparent 11deg 20deg)}
@keyframes spin{to{transform:rotate(360deg)}}
.ban{position:absolute;left:-200px;right:-200px;top:-74px;white-space:nowrap;text-align:center;font-family:'Pirata One',cursive;font-size:46px;line-height:1;color:#ffd977;text-shadow:0 0 18px rgba(255,200,90,.8),0 3px 0 #5a3c0e;animation:banin .6s cubic-bezier(.3,1.5,.5,1) .5s both;pointer-events:none}
.ban.m{color:#f4e6ff;text-shadow:0 0 18px rgba(200,160,255,.9),0 3px 0 #3b2a5a}
@keyframes banin{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
@keyframes fi{from{opacity:0}to{opacity:1}}
.fi{animation:fi .4s ease-out both}
.info{position:absolute;left:-100px;right:-100px;top:420px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;z-index:10}
.tag{font-size:12.5px;font-weight:900;padding:3px 10px;border-radius:999px;white-space:nowrap}
.pdots{display:flex;gap:8px;margin-top:6px}
.pdots span{width:9px;height:9px;border-radius:50%;background:rgba(234,208,138,.22)}
.pdots span.on{background:#ead08a}.pdots span.cur{background:#fff;box-shadow:0 0 8px #ead08a}
.pdots.dv span{border-radius:0;width:12px;height:12px;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}
.pdots.dv span.on,.pdots.dv span.cur{background:#ffd977}
.ui{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;z-index:6}
.title{font-family:'Pirata One',cursive;font-size:34px;color:#ead08a}
.hint{font-family:'IM Fell English SC',serif;font-size:24px;color:#ead08a}
.muted{font-size:13.5px;color:#8fa3ab}
.grid{position:absolute;left:0;right:0;top:96px;display:flex;flex-wrap:wrap;justify-content:center;gap:22px 26px;padding:0 20px}
.gc{display:flex;flex-direction:column;align-items:center;gap:8px;width:170px;animation:gin .5s cubic-bezier(.3,1.4,.5,1) both}
@keyframes gin{from{transform:translateY(40px) scale(.7);opacity:0}to{transform:none;opacity:1}}
.bar{height:10px;border-radius:5px;background:rgba(234,208,138,.12);overflow:hidden;width:380px}
.bar>div{height:100%;width:var(--b);background:linear-gradient(90deg,#b78c33,#f0cf72);animation:barg 1.4s cubic-bezier(.3,1,.4,1) .9s both}
@keyframes barg{from{width:var(--a)}to{width:var(--b)}}
.divb{font-family:'IM Fell English SC',serif;font-size:20px;color:#ffd977;letter-spacing:.06em;text-shadow:0 0 12px rgba(255,200,90,.6)}
.skip{position:absolute;right:0;top:0;z-index:12}
.dcard{position:relative;width:100%;height:100%;border-radius:4%;overflow:hidden;background:#111 center/100% 100% no-repeat;box-shadow:0 8px 22px rgba(0,0,0,.55)}
.dcard .sh{position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.5) 45%,rgba(255,255,255,.1) 52%,transparent 62%);background-size:260% 260%;mix-blend-mode:soft-light;animation:dsh 4.5s ease-in-out infinite alternate}
.dcard.holo .sh{background:linear-gradient(115deg,#ff4d6d,#ffb347,#fff35c,#4dff88,#3ad1ff,#8a5cff,#ff4dd2);background-size:300% 300%;mix-blend-mode:color-dodge;opacity:.35}
@keyframes dsh{from{background-position:0 0}to{background-position:100% 100%}}
.tilt{transform:perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .12s ease-out;--mx:50%;--my:30%}
.tilt.on .dcard .sh{animation:none;background-position:var(--mx) var(--my)}
.tilt .glare{position:absolute;inset:0;border-radius:4%;pointer-events:none;background:radial-gradient(circle at var(--mx) var(--my),rgba(255,255,255,.28),transparent 45%);mix-blend-mode:overlay;opacity:0;transition:opacity .2s}
.tilt.on .glare{opacity:1}
.dcard .num{position:absolute;left:81%;top:13.2%;transform:translate(-50%,-50%);font-family:'Pirata One',cursive;font-size:calc(var(--w)*.13);color:#fff4d6;text-shadow:0 0 3px #000}
:host([reduce]) .float,:host([reduce]) .foil,:host([reduce]) .caus,:host([reduce]) .grays,:host([reduce]) .hid .flip,:host([reduce]) .hid .face.back,:host([reduce]) .runner,:host([reduce]) .chev,:host([reduce]) .dcard .sh{animation:none!important}:host([reduce]) .flash.go{animation:none}
/* mouvement réduit (ajout de l'intégration au jeu) : attribut reduce posé par le jeu (réglage du Casier), le réglage du système est ignoré ;
   l'ouverture devient un simple fondu de 300 ms (later() plafonne déjà les attentes à 300 ms) ;
   ni bande qui s'envole, ni lumière, ni rayons, ni pile qui monte, ni éclats : rien ne bouge ni ne tourne */
:host([reduce]) .opening .lid,:host([reduce]) .opening .leak,:host([reduce]) .opening .lrays,:host([reduce]) .opening.in,:host([reduce]) .gsp,:host([reduce]) .stk.rise,:host([reduce]) .pop,:host([reduce]) .burst.go,:host([reduce]) .ring.go,:host([reduce]) .spark,:host([reduce]) .ban,:host([reduce]) .gc,:host([reduce]) .bar>div{animation:none!important}:host([reduce]) .opening.in{opacity:0;transition:opacity .3s}:host([reduce]) .stk.rise{animation:fi .3s ease-out both!important}:host([reduce]) .tilt{transform:none!important}
`;

const RC = { c: 'rgba(255,244,214,.9)', r: '#4fa8ff', e: '#b77dff', l: '#ffc94a', m: '#e7c6ff' };
const VN = { patine: ['Patinée', '#c9d3dc', '◆'], etain: ['Bord d’étain', '#c9d3dc', '◆'], holo: ['Holographique', '#6cb8ff', '◆◆'], nacre: ['Nacre', '#c79bff', '◆◆◆'], vivante: ['Vivante', '#c79bff', '◆◆◆'], signee: ['Signée', '#ffc94a', '★'], numero: ['Numérotée', '#e7c6ff', '★★'] };
const BURST = {
  r: 'radial-gradient(circle,rgba(79,168,255,.55),transparent 55%)', e: 'radial-gradient(circle,rgba(183,125,255,.65),transparent 55%)',
  l: 'radial-gradient(circle,rgba(255,201,74,.8),transparent 58%)', m: 'radial-gradient(circle,rgba(231,198,255,.75),rgba(155,231,255,.4) 30%,transparent 58%)'
};
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
// mouvement réduit : attribut reduce, posé par l'application (le réglage du système n'est pas lu ici)

class BoosterOpening extends HTMLElement {
  constructor() {
    super();
    this._packs = []; this.price = 50; this.coins = 0; this.freeLabel = ''; this.cardsBase = '/cards/';
    this.open = null; this.renderCard = null; this.haptics = () => {}; this.sfx = () => {};
    this.sel = 0; this.phase = 'choose'; this.timers = [];
    this.root = this.attachShadow({ mode: 'open' });
  }
  get packs() { return this._packs; }
  set packs(v) { this._packs = v || []; this.sel = Math.min(this.sel || 0, Math.max(0, this._packs.length - 1)); if (this.fit && this.phase === 'choose') this.renderChoose(); }
  connectedCallback() {
    this.root.innerHTML = `<style>${CSS}</style><div class="caus"></div><div class="fit"></div>`;
    this.fit = this.root.querySelector('.fit');
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this); this.resize();
    this.renderChoose();
  }
  disconnectedCallback() { this.clear(); this.ro && this.ro.disconnect(); }
  // mise à l'échelle (intégration au jeu) : la scène de 680 × 900 remplit le conteneur, avec 100 px réservés au-dessus
  // (à l'ouverture, la pile monte de 175 px et dépassait le haut de la scène) ; la scène est donc décalée de 50 px vers le bas
  resize() { const r = this.getBoundingClientRect(), s = Math.min(1.25, r.width / 680, r.height / 1000); this.fit.style.transform = `translate(-50%,-50%) translateY(${(50 * s).toFixed(1)}px) scale(${s})`; }
  later(ms, f) { const k = this.k; this.timers.push(setTimeout(() => { if (this.k === k) f(); }, this.hasAttribute('reduce') ? Math.min(ms, 300) : ms)); }
  clear() { this.timers.forEach(clearTimeout); this.timers = []; this.k = (this.k || 0) + 1; }

  // ---------- rendu d'une carte ----------
  card(c, width, still, tilt) {
    const inner = this.cardRaw(c, width, still);
    if (!tilt) return inner;
    const t = h('div', 'tilt'); t.style.cssText = `position:relative;width:${width}px;height:${Math.round(width * 1.4222)}px`; t.appendChild(inner); t.appendChild(h('div', 'glare')); this.bindTilt(t); return t;
  }
  // inclinaison : souris au survol, doigt quand on maintient sans glisser, gyroscope du téléphone (this.gyro = true)
  bindTilt(t) {
    const set = (x, y) => { t.classList.add('on'); t.style.setProperty('--ry', ((x - .5) * 22).toFixed(1) + 'deg'); t.style.setProperty('--rx', ((.5 - y) * 18).toFixed(1) + 'deg'); t.style.setProperty('--mx', Math.round(x * 100) + '%'); t.style.setProperty('--my', Math.round(y * 100) + '%'); };
    const reset = () => { t.classList.remove('on'); ['--rx', '--ry'].forEach(v => t.style.setProperty(v, '0deg')); };
    t.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && e.buttons) return; if (e.pointerType !== 'mouse' && this.dragging) return; const r = t.getBoundingClientRect(); set(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))); });
    t.addEventListener('pointerleave', reset);
    this.tilts = (this.tilts || []).filter(x => x.isConnected); this.tilts.push(t);
    if (this.gyro && !this.gyroOn) { this.gyroOn = true; window.addEventListener('deviceorientation', e => { if (e.gamma == null) return; const x = .5 + Math.max(-1, Math.min(1, e.gamma / 30)) / 2, y = .5 + Math.max(-1, Math.min(1, (e.beta - 40) / 30)) / 2; (this.tilts || []).forEach(el => { if (el.isConnected && !this.dragging) { el.classList.add('on'); el.style.setProperty('--ry', ((x - .5) * 22).toFixed(1) + 'deg'); el.style.setProperty('--rx', ((.5 - y) * 18).toFixed(1) + 'deg'); el.style.setProperty('--mx', Math.round(x * 100) + '%'); el.style.setProperty('--my', Math.round(y * 100) + '%'); } }); }); }
  }
  cardRaw(c, width, still) {
    if (this.renderCard) { const el = this.renderCard(c, { width, still }); el.style.width = width + 'px'; el.style.height = Math.round(width * 1.4222) + 'px'; return el; }
    const m = /^([a-z]+?)(\d+)$/.exec(c.id || ''), SU = { y: 'suit-yellow', g: 'suit-green', p: 'suit-purple', b: 'suit-black' };
    const key = m && SU[m[1]] ? SU[m[1]] : ({ morgane: 'tigress', alyra: 'mermaid0' }[c.id] || c.id);
    const d = h('div', 'dcard' + (['holo', 'nacre', 'vivante', 'signee', 'numero'].includes(c.variant) ? ' holo' : ''));
    d.style.backgroundImage = `url(${this.cardsBase}${key}.webp)`; d.style.setProperty('--w', width + 'px');
    if (c.variant !== 'patine' && c.variant !== 'etain' && !still) d.appendChild(h('div', 'sh'));
    if (m && SU[m[1]]) d.appendChild(h('div', 'num', m[2]));
    const w = h('div'); w.style.cssText = `width:${width}px;height:${Math.round(width * 1.4222)}px`; w.appendChild(d); return w;
  }
  back(width) { const p = this.packs[this.sel] || {}; const d = h('div', 'dcard'); d.style.backgroundImage = `url(${p.back || this.cardsBase + 'dos.webp'})`; const w = h('div'); w.style.cssText = `width:${width}px;height:${Math.round(width * 1.4222)}px`; w.appendChild(d); return w; }

  // ---------- 1. choix ----------
  renderChoose() {
    this.phase = 'choose'; this.fit.innerHTML = '';
    const car = h('div', 'car'); this.car = car; this.pws = [];
    this.packs.forEach((p, i) => {
      const pw = h('div', 'pw'), inn = h('div', 'in');
      inn.innerHTML = `<div class="lrays"></div><div class="pbody" style="background-image:url(${p.sachet})"><div class="foil"></div></div><div class="lid" style="background-image:url(${p.sachet});background-size:100% 360px"></div><div class="leak"></div>`;
      pw.appendChild(inn); pw.addEventListener('click', () => this.pickPack(i)); car.appendChild(pw); this.pws.push(pw);
    });
    car.appendChild(h('div', 'shadow'));
    this.fit.appendChild(car);
    const ui = h('div', 'ui fi'); ui.style.top = '500px'; this.uiChoose = ui; this.fit.appendChild(ui);
    this.placePacks(); this.fillChooseUI();
    this.addSwipe(car);
  }
  placePacks() {
    const n = this.packs.length, focus = this.phase === 'focus' || this.phase === 'opening';
    this.pws.forEach((pw, i) => {
      let o = ((i - this.sel) % n + n) % n; if (o === n - 1 && n > 1) o = -1; if (o > 1) o = 2;
      const cur = o === 0, inn = pw.firstChild;
      pw.style.transform = focus ? (cur ? 'translateY(40px) scale(1.22)' : `translateX(${o * 420}px) scale(.6)`)
        : `translateX(${o * 240}px) translateZ(${cur ? 0 : -160}px) rotateY(${o * -32}deg) scale(${cur ? 1 : .82})`;
      pw.style.opacity = focus && !cur ? 0 : cur ? 1 : Math.abs(o) > 1 ? 0 : .55;
      pw.style.filter = cur ? 'none' : 'brightness(.6) saturate(.8)'; pw.style.zIndex = cur ? 3 : 1;
      pw.classList.toggle('off', focus && !cur);
      inn.classList.toggle('float', cur && this.phase === 'choose');
    });
    const sh = this.car.querySelector('.shadow'); if (sh) sh.style.opacity = this.phase === 'choose' ? 1 : 0;
  }
  fillChooseUI() {
    const p = this.packs[this.sel] || {}, ui = this.uiChoose;
    ui.innerHTML = `<div style="display:flex;align-items:center;gap:16px"><button class="btn ghost prev" aria-label="Booster précédent" style="font-size:24px">‹</button><div class="title" style="min-width:300px">${p.name || ''}</div><button class="btn ghost next" aria-label="Booster suivant" style="font-size:24px">›</button></div>
      <div style="font-size:14px;color:#c9d6db">${p.desc || ''}</div><div class="feat" style="display:flex;gap:10px;margin:6px 0 4px"></div>
      <div style="display:flex;gap:10px"><button class="btn gold go" style="min-height:50px;font-size:17px">Ouvrir · ${this.price} 🪙</button>${this.freeLabel ? `<button class="btn" disabled style="min-height:50px">Gratuit · ${this.freeLabel}</button>` : ''}</div>`;
    const feat = ui.querySelector('.feat');
    (p.featured || []).forEach(id => { const f = h('div'); f.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px'; f.appendChild(this.card({ id, variant: 'holo' }, 78, true)); f.appendChild(h('span', '', '<b style="font-size:11.5px;color:#9fe3ff">×3</b>')); feat.appendChild(f); });
    ui.querySelector('.prev').onclick = () => this.step(-1); ui.querySelector('.next').onclick = () => this.step(1);
    ui.querySelector('.go').onclick = () => this.focusPack();
  }
  step(d) { if (this.phase !== 'choose') return; this.sel = (this.sel + d + this.packs.length) % this.packs.length; this.placePacks(); this.fillChooseUI(); this.sfx('crinkle'); }
  pickPack(i) { if (this.phase !== 'choose') return; if (i === this.sel) return this.focusPack(); this.sel = i; this.placePacks(); this.fillChooseUI(); this.sfx('crinkle'); }
  addSwipe(el) { let x0 = null; el.addEventListener('pointerdown', e => { if (this.phase === 'choose') x0 = e.clientX; }); el.addEventListener('pointerup', e => { if (x0 == null) return; const d = e.clientX - x0; x0 = null; if (Math.abs(d) > 50) this.step(d < 0 ? 1 : -1); }); }

  // ---------- 2. focus + coupe ----------
  async focusPack() {
    if (this.phase !== 'choose' || !this.open) return;
    this.phase = 'focus'; this.clear(); this.placePacks(); this.uiChoose.remove();
    this.result = null; this.pending = this.open(this.packs[this.sel].id).then(r => (this.result = r)).catch(err => { this.dispatchEvent(new CustomEvent('booster-error', { detail: err })); this.renderChoose(); });
    const pw = this.pws[this.sel], inn = pw.firstChild;
    const cut = h('div'); cut.innerHTML = `<div class="dots"></div><div class="scis">✂</div><div class="cutline"></div><div class="tip"></div><div class="runner"></div><div class="chev">›››</div><div class="cutzone" aria-label="Glisser pour ouvrir"></div>`;
    cut.style.cssText = 'position:absolute;inset:0;z-index:4'; inn.appendChild(cut); this.cutEl = cut;
    const zone = cut.querySelector('.cutzone'); let prog = 0, active = false, step = 0, raf = 0;
    const setP = p => { prog = p; if (!raf) raf = requestAnimationFrame(() => { raf = 0; cut.style.setProperty('--cut', prog.toFixed(3)); }); const s = Math.floor(p * 10); if (s > step) { step = s; this.haptics('light'); } };
    const pos = e => { const r = zone.getBoundingClientRect(); return (e.clientX - r.left - 30 * r.width / 280) / (220 * r.width / 280); };
    zone.addEventListener('pointerdown', e => { if (this.phase !== 'focus') return; const p = pos(e); if (p > .35) return; zone.setPointerCapture(e.pointerId); active = true; cut.classList.add('cutting', 'touched'); setP(Math.max(0, p)); this.sfx('cut'); });
    zone.addEventListener('pointermove', e => { if (!active) return; const p = Math.max(prog, Math.min(1, pos(e))); setP(p); if (p >= .92) { active = false; this.doCut(); } });
    const up = () => { if (!active) return; active = false; cut.classList.remove('cutting'); cut.style.transition = 'none'; setP(0); step = 0; };
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
    const ui = h('div', 'ui fi'); ui.style.top = '560px';
    ui.innerHTML = `<div class="hint">Glissez le long des pointillés pour ouvrir</div><div class="muted">De gauche à droite, d’un seul geste. Au clavier : Entrée.</div><div style="display:flex;gap:10px;margin-top:6px"><button class="btn ghost back">Changer de booster</button><button class="btn auto">Ouvrir sans glisser</button></div>`;
    ui.querySelector('.back').onclick = () => { if (this.phase === 'focus') { this.clear(); this.renderChoose(); } };
    ui.querySelector('.auto').onclick = () => { if (this.phase !== 'focus') return; cut.classList.add('touched'); [.25, .5, .75, 1].forEach((p, j) => this.later(90 * (j + 1), () => p < 1 ? setP(p) : this.doCut())); };
    this.onkey = e => { if (e.key === 'Enter' && this.phase === 'focus') ui.querySelector('.auto').click(); }; window.addEventListener('keydown', this.onkey, { once: true });
    this.fit.appendChild(ui); this.uiFocus = ui;
  }

  // ---------- 3. ouverture ----------
  async doCut() {
    if (this.phase !== 'focus') return; this.phase = 'opening';
    this.cutEl.style.setProperty('--cut', 1); this.uiFocus.remove();
    const res = this.result || await this.pending; if (!res) return;
    const cards = res.cards.map((c, i) => Object.assign({ up: i < 4 }, c)); this.cards = cards; this.divine = !!res.divine; this.collection = res.collection;
    this.haptics('medium'); this.sfx('tear');
    const pw = this.pws[this.sel], inn = pw.firstChild; this.cutEl.remove();
    if (this.divine) [8, 22, 35, 47, 58, 70, 83, 93].forEach((x, i) => { const g = h('div', 'gsp'); g.style.left = x + '%'; g.style.animationDelay = (0.35 + (i * 0.37) % 1.1).toFixed(2) + 's'; inn.appendChild(g); });
    pw.style.willChange = 'transform';
    inn.classList.remove('float'); void inn.offsetWidth; inn.classList.add('opening');
    this.flash();
    // la pile monte de l'intérieur du sachet : derrière lui (z-index animé), puis devant
    this.top = 0; this.buildStack(true);
    this.later(1950, () => { this.car.remove(); this.stk.classList.remove('rise'); this.stk.style.zIndex = ''; this.phase = 'stack'; this.showTop(true); });
  }
  flash() { if (this.hasAttribute('reduce')) return; const f = h('div', 'flash'); this.fit.appendChild(f); void f.offsetWidth; f.classList.add('go'); setTimeout(() => f.remove(), 600); }

  // ---------- 4. pile ----------
  buildStack(rising) {
    const stk = h('div', 'stk' + (rising ? ' rise' : '')); this.stk = stk;
    stk.innerHTML = `<div class="burst"></div><div class="ring"></div>`;
    this.slots = { peek2: h('div', 'slot peek2'), peek: h('div', 'slot peek'), top: h('div', 'slot top'), fly: null };
    stk.appendChild(this.slots.peek2); stk.appendChild(this.slots.peek); stk.appendChild(this.slots.top);
    const info = h('div', 'info'); this.info = info; stk.appendChild(info);
    const skip = h('div', 'skip'); skip.innerHTML = '<button class="btn ghost">Tout voir ⏭</button>'; skip.onclick = () => this.finish(); this.fit.appendChild(skip); this.skipEl = skip;
    if (rising) stk.style.zIndex = 1;
    this.fit.appendChild(stk); this.fillSlots(); this.bindDrag();
  }
  fillSlots() {
    const n = this.cards.length, t = this.top, S = this.slots;
    S.peek2.innerHTML = ''; S.peek.innerHTML = ''; S.top.innerHTML = '';
    if (t + 2 < n) S.peek2.appendChild(this.back(280));
    if (t + 1 < n) S.peek.appendChild(this.cards[t + 1].up ? this.card(this.cards[t + 1], 280, true) : this.back(280));
    if (t < n) {
      const c = this.cards[t], fw = h('div', 'flipw' + (c.up ? ' up' : ' hid')), fl = h('div', 'flip'), b = h('div', 'face back'), f = h('div', 'face front');
      b.appendChild(this.back(280)); f.appendChild(this.card(c, 280, false, true)); fl.appendChild(b); fl.appendChild(f); fw.appendChild(fl); S.top.appendChild(fw); this.flipw = fw;
    }
    this.renderInfo();
  }
  renderInfo() {
    const c = this.cards[this.top], n = this.cards.length;
    if (!c) { this.info.innerHTML = ''; return; }
    const vn = VN[c.variant] || ['', '#fff', ''];
    const dots = this.cards.map((x, i) => `<span class="${i < this.top ? 'on' : i === this.top ? 'cur' : ''}"></span>`).join('');
    const tag = c.isNew ? `<span class="tag" style="background:#8fbf7a;color:#14240f">Nouveau</span>` : `<span class="tag" style="background:rgba(159,227,255,.15);color:#9fe3ff">Doublon · +${c.shards || 0} ◆</span>`;
    this.info.innerHTML = (c.up ? `<b style="font-size:17px">${c.name}</b>${c.variant === 'numero' ? `<span style="font-size:13px;font-weight:900;letter-spacing:.12em;color:#e7c6ff">EXEMPLAIRE N° ${c.serial || ''}</span>` : ''}<span style="font-size:14px;font-weight:900;color:${vn[1]}">${vn[2]} ${vn[0]}</span>${tag}`
      : `<b style="font-size:17px;color:#ead08a">Carte de chance</b><span class="muted">Touchez pour la retourner</span>`)
      + `<div class="pdots${this.divine ? ' dv' : ''}">${dots}</div><div class="muted" style="margin-top:4px">${!c.up ? '' : this.top === n - 1 ? 'Dernière carte : touchez pour voir le butin' : 'Glissez la carte sur le côté, ou touchez-la'}</div>`;
    if (this.phase === 'opening') this.info.style.visibility = 'hidden'; else this.info.style.visibility = '';
  }
  showTop(first) {
    const c = this.cards[this.top]; if (!c) return; this.info.style.visibility = '';
    if (!first) { this.slots.top.classList.remove('pop'); void this.slots.top.offsetWidth; this.slots.top.classList.add('pop'); }
    if (c.up) this.celebrate(c);
  }
  celebrate(c) {
    const rk = c.rarity; if (!rk || rk === 'c') return;
    const stk = this.stk, burst = stk.querySelector('.burst'), ring = stk.querySelector('.ring');
    burst.style.background = BURST[rk]; ring.style.setProperty('--rc', RC[rk]);
    [burst, ring].forEach(e => { e.classList.remove('go'); void e.offsetWidth; e.classList.add('go'); });
    stk.querySelectorAll('.spark').forEach(s => s.remove());
    const N = { r: 10, e: 16, l: 26, m: 32 }[rk];
    for (let i = 0; i < N; i++) { const a = i / 7.3 * Math.PI * 2 + i, d = 160 + (i * 37) % 140, s = h('div', 'spark'); s.style.setProperty('--rc', RC[rk]); s.style.setProperty('--x', Math.round(Math.cos(a) * d) + 'px'); s.style.setProperty('--y', Math.round(Math.sin(a) * d) + 'px'); s.style.setProperty('--d', ((i % 6) * .04).toFixed(2) + 's'); stk.appendChild(s); }
    this.later(1300, () => stk.querySelectorAll('.spark').forEach(s => s.remove()));
    this.sfx(rk === 'r' ? 'chime' : rk === 'e' ? 'chord' : 'fanfare');
    if (rk === 'l' || rk === 'm') this.bigMoment(rk);
  }
  bigMoment(rk) {
    this.haptics('heavy'); this.flash();
    const dim = h('div', 'dim'); this.fit.insertBefore(dim, this.stk); this.dimEl = dim;
    const g = h('div', 'grays' + (rk === 'm' ? ' m' : '')), b = h('div', 'ban' + (rk === 'm' ? ' m' : ''), rk === 'm' ? 'Numérotée !' : 'Signée !');
    this.stk.insertBefore(g, this.stk.firstChild); this.stk.appendChild(b); this.bigEls = [g, b];
  }
  clearBig() { if (this.dimEl) this.dimEl.remove(); (this.bigEls || []).forEach(e => e.remove()); this.dimEl = null; this.bigEls = null; }
  bindDrag() {
    const el = this.slots.top; let x0 = 0, dx = 0, drag = false, moved = false, raf = 0;
    const apply = () => { raf = 0; el.style.transform = `translateX(${dx}px) rotate(${(dx / 18).toFixed(1)}deg)`; };
    el.addEventListener('pointerdown', e => { if (this.phase !== 'stack') return; el.setPointerCapture(e.pointerId); drag = true; moved = false; x0 = e.clientX; dx = 0; el.classList.add('drag'); el.style.willChange = 'transform'; this.dragging = false; });
    el.addEventListener('pointermove', e => { if (!drag) return; const s = this.fitScale(); dx = (e.clientX - x0) / s; if (Math.abs(dx) > 6) { moved = true; this.dragging = true; } if (!raf) raf = requestAnimationFrame(apply); });
    const up = () => { if (!drag) return; drag = false; this.dragging = false; el.classList.remove('drag'); el.style.willChange = '';
      if (Math.abs(dx) > 90) this.advance(dx < 0 ? -1 : 1); else if (!moved) this.advance(-1); else { el.style.transform = ''; } dx = 0; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    this.keyStack = e => { if (this.phase !== 'stack') return; if (e.key === 'ArrowLeft' || e.key === ' ') this.advance(-1); if (e.key === 'ArrowRight') this.advance(1); if (e.key === 'Enter') this.advance(-1); };
    window.addEventListener('keydown', this.keyStack);
  }
  fitScale() { const m = /scale\(([\d.]+)\)/.exec(this.fit.style.transform); return m ? +m[1] : 1; }
  advance(dir) {
    if (this.phase !== 'stack' || this.busy) return; const c = this.cards[this.top]; if (!c) return;
    if (!c.up) return this.reveal();
    this.busy = true; this.clearBig(); this.sfx('swipe');
    const fly = h('div', 'slot fly ' + (dir < 0 ? 'l' : 'r')); fly.appendChild(this.card(c, 280, true));
    fly.style.transform = this.slots.top.style.transform; this.stk.appendChild(fly);
    this.slots.top.style.transform = ''; this.top++;
    setTimeout(() => fly.remove(), 470);
    if (this.top >= this.cards.length) { this.slots.top.innerHTML = ''; this.slots.peek.innerHTML = ''; this.info.innerHTML = ''; this.later(420, () => { this.busy = false; this.finish(); }); return; }
    this.fillSlots(); this.showTop(false); this.busy = false;
  }
  reveal() {
    const c = this.cards[this.top]; if (c.up) return; c.up = true; this.busy = true;
    this.flipw.classList.remove('hid'); this.flipw.classList.add('up'); this.sfx('tear');
    this.later(650, () => { this.busy = false; this.renderInfo(); this.celebrate(c); });
  }

  // ---------- 5. butin ----------
  finish() {
    this.clear(); this.clearBig(); this.phase = 'recap'; window.removeEventListener('keydown', this.keyStack);
    this.cards.forEach(c => (c.up = true)); this.fit.innerHTML = '';
    const newN = this.cards.filter(c => c.isNew).length, gain = this.cards.reduce((a, c) => a + (c.isNew ? 0 : c.shards || 0), 0), col = this.collection || { before: 0, after: 0, total: 1 };
    const t = h('div', 'fi'); t.style.cssText = 'position:absolute;left:0;right:0;top:10px;text-align:center'; t.innerHTML = `<div class="title" style="font-size:40px">Votre butin</div>${this.divine ? '<div class="divb fi" style="animation-delay:.8s">✦ Booster divin · 1 sur 2 000 ✦</div>' : ''}`;
    this.fit.appendChild(t);
    const grid = h('div', 'grid'); this.cards.forEach((c, i) => { const vn = VN[c.variant] || ['', '#fff', '']; const g = h('div', 'gc'); g.style.animationDelay = (0.08 + i * .1).toFixed(2) + 's'; g.appendChild(this.card(c, 150, false, true));
      g.appendChild(h('div', '', `<div style="text-align:center"><b style="font-size:13.5px">${c.name}</b><div style="font-size:12.5px;font-weight:900;color:${vn[1]}">${vn[2]} ${vn[0]}</div></div>`));
      g.appendChild(h('span', 'tag', c.isNew ? 'Nouveau' : `Doublon · +${c.shards || 0} ◆`)); g.lastChild.style.cssText = c.isNew ? 'background:#8fbf7a;color:#14240f' : 'background:rgba(159,227,255,.15);color:#9fe3ff'; grid.appendChild(g); });
    this.fit.appendChild(grid);
    const ui = h('div', 'ui fi'); ui.style.top = '730px'; ui.style.animationDelay = '.7s';
    ui.innerHTML = `<div style="display:flex;gap:22px;font-size:15px;font-weight:800"><span style="color:#8fbf7a">+${newN} nouvelles variantes</span><span style="color:#9fe3ff">+${gain} ◆ éclats</span></div>
      <div style="display:flex;justify-content:space-between;width:380px;font-size:13px;color:#c9d6db"><span>Collection</span><b>${col.after} / ${col.total} variantes</b></div>
      <div class="bar"><div style="--a:${(col.before / col.total * 100).toFixed(1)}%;--b:${(col.after / col.total * 100).toFixed(1)}%"></div></div>
      <div style="display:flex;gap:10px;margin-top:10px"><button class="btn gold again" style="min-height:50px;font-size:17px">Ouvrir un autre · ${this.price} 🪙</button><button class="btn coll" style="min-height:50px">Voir la collection</button><button class="btn ghost close">Changer de booster</button></div>`;
    ui.querySelector('.again').onclick = () => { this.renderChoose(); this.focusPack(); };
    ui.querySelector('.coll').onclick = () => this.dispatchEvent(new CustomEvent('booster-collection', { detail: { cards: this.cards } }));
    ui.querySelector('.close').onclick = () => { this.renderChoose(); this.dispatchEvent(new CustomEvent('booster-close')); };
    this.fit.appendChild(ui);
    this.dispatchEvent(new CustomEvent('booster-done', { detail: { cards: this.cards, divine: this.divine } }));
  }
}
if (!customElements.get('booster-opening')) customElements.define('booster-opening', BoosterOpening);
export default BoosterOpening;
