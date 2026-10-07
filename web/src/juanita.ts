// Fenêtre « Cartes non distribuées » du pouvoir de Juanita Jade (A13, docs/juanita/SPEC.md, maquette Juanita.dc.html).
// Lisible sans défilement : une ligne par couleur en cases 32×44 alignées par valeur (1→14 puis 7−5, 8+5, 0/14),
// et les spéciales regroupées par famille en encadrés légers (Skull King · Pirates · Morgane · Sirènes sur une ligne,
// Monstres · Fuites · Actions sur l'autre). Chaque famille porte le nombre de cartes hors jeu dans son titre
// (« PIRATES 5 »), vignettes 48×68 avec nom court et pastille « ×n » si plusieurs exemplaires hors jeu.
// Aucune déduction faite à la place du joueur : cartes manquantes = simple espace vide, pas de « chez les autres »,
// pas de total par couleur, pas de marquage de sa main. La fenêtre ne se rouvre pas une fois fermée.
import { PIRATES, SPECIAL, SUIT, type Card } from '@engine';
import { ART } from './cards';
import { esc } from './util';

type SuitKey = 'black' | 'yellow' | 'purple' | 'green';
const SUITS: { k: SuitKey; short: string; c: string; numInk: string }[] = [
  { k: 'black',  short: 'Noir',      c: '#1f1d22', numInk: '#f0d078' },
  { k: 'yellow', short: 'Trésor',    c: '#a8791c', numInk: '#2b1d0c' },
  { k: 'purple', short: 'Méduse',    c: '#5b3a7a', numInk: '#2b1838' },
  { k: 'green',  short: 'Perroquet', c: '#2f6b3a', numInk: '#12301a' },
];

/** Carte spéciale affichable : clé canonique, nom court sous la vignette, nom complet pour l'aperçu. */
interface SpecEntry { key: string; short: string; name: string; art: string }
/** Familles de spéciales (SPEC §3) : chaque famille devient un encadré titré (« PIRATES 5 »). L'ordre interne est
 *  celui de la liste. Une famille sans aucune carte hors jeu est simplement omise. */
interface Family { title: string; entries: SpecEntry[] }
const FAMILIES: Family[] = [
  { title: 'SKULL KING', entries: [
    { key: 'sk', short: 'Skull King', name: SPECIAL.sk, art: 'sk' },
  ]},
  { title: 'PIRATES', entries: [
    { key: 'rosie',   short: 'Rosie',   name: PIRATES.rosie.n,   art: 'rosie' },
    { key: 'bahij',   short: 'Bendt',   name: PIRATES.bahij.n,   art: 'bahij' },
    { key: 'rascal',  short: 'Rascal',  name: PIRATES.rascal.n,  art: 'rascal' },
    { key: 'juanita', short: 'Juanita', name: PIRATES.juanita.n, art: 'juanita' },
    { key: 'harry',   short: 'Harry',   name: PIRATES.harry.n,   art: 'harry' },
    { key: 'mary',    short: 'Marie',   name: PIRATES.mary.n,    art: 'mary' },
    { key: 'con',     short: 'Con',     name: SPECIAL.con,       art: 'con' },
  ]},
  { title: 'MORGANE', entries: [
    { key: 'tigress', short: 'Morgane', name: SPECIAL.tigress, art: 'tigress' },
  ]},
  { title: 'SIRÈNES', entries: [
    { key: 'mermaid0', short: 'Alyra', name: 'Alyra', art: 'mermaid0' },
    { key: 'mermaid1', short: 'Circé', name: 'Circé', art: 'mermaid1' },
  ]},
  { title: 'MONSTRES', entries: [
    { key: 'kraken',   short: 'Kraken',  name: SPECIAL.kraken,   art: 'kraken' },
    { key: 'whale',    short: 'Baleine', name: SPECIAL.whale,    art: 'whale' },
    { key: 'stingray', short: 'Raie',    name: SPECIAL.stingray, art: 'stingray' },
    { key: 'davy',     short: 'Fosse',   name: SPECIAL.davy,     art: 'davy' },
  ]},
  { title: 'FUITES', entries: [
    { key: 'escape', short: 'Drapeau', name: SPECIAL.escape, art: 'escape' },
    { key: 'loot',   short: 'Butin',   name: SPECIAL.loot,   art: 'loot' },
  ]},
  { title: 'ACTIONS', entries: [
    { key: 'volley', short: 'Bordée',   name: SPECIAL.volley, art: 'volley' },
    { key: 'plank',  short: 'Planche',  name: SPECIAL.plank,  art: 'plank' },
    { key: 'wild',   short: 'Grand 15', name: 'Le Grand Quinze', art: 'wild' },
  ]},
];
const EXT_COLS = [{ key: 'm7', label: '7', sm: '−5' }, { key: 'm8', label: '8', sm: '+5' }, { key: 'zf', label: '0/14', sm: '' }];

/** Clé canonique d'une carte spéciale (pirates par pid, sirènes par v, autres par kind). */
function specKey(c: Card): string {
  if (c.kind === 'pirate') return c.pid!;
  if (c.kind === 'mermaid') return 'mermaid' + (c.v || 0);
  if (c.kind === 'num' && c.wild) return 'wild';
  return c.kind as string;
}

/** HTML d'une case numérotée (32 × 44) : chiffre en Pirata One, fond à la couleur de la famille.
 *  `name` : libellé complet pour l'aria et l'aperçu (« 12 Pavillon noir »). `sm` : annotation extension (−5, +5…). */
function cellHTML(suit: typeof SUITS[number], label: string, name: string, sm: string, art: string): string {
  const data = `data-art="${esc(art)}" data-name="${esc(name)}" data-num="${esc(label)}" data-ink="${suit.numInk}"`;
  const extra = sm ? `<span class="jcsm">${esc(sm)}</span>` : '';
  return `<button class="jcell" style="background:${suit.c};color:${suit.numInk}" aria-label="${esc(name)}" ${data}>${extra}${esc(label)}</button>`;
}
function gapHTML(): string { return `<span class="jcell gap" aria-hidden="true"></span>`; }

/** HTML d'une vignette spéciale (48 × 68) : illustration, nom court en dessous, pastille « ×n » si plusieurs
 *  exemplaires hors jeu (ex. 2 Butin). */
function vignetteHTML(e: SpecEntry, count: number): string {
  const data = `data-art="${esc(e.art)}" data-name="${esc(e.name)}" data-num="" data-ink=""`;
  const aria = e.name + (count > 1 ? ` (${count} exemplaires hors jeu)` : '');
  const badge = count > 1 ? `<span class="jsx">×${count}</span>` : '';
  return `<button class="jsp" aria-label="${esc(aria)}" ${data}>
    <span class="jspw"><img src="${esc(ART[e.art] || '')}" alt="">${badge}</span>
    <span class="jspn">${esc(e.short)}</span>
  </button>`;
}

/** HTML d'un encadré de famille : titre « PIRATES 5 » (le nombre est le total hors jeu de cette famille, sommé par
 *  carte en comptant les doublons), puis les vignettes des cartes effectivement hors jeu dans l'ordre interne. */
function familyHTML(f: Family, counts: Record<string, number>): string {
  const items = f.entries.filter(e => (counts[e.key] || 0) > 0);
  if (!items.length) return '';
  const total = items.reduce((n, e) => n + (counts[e.key] || 0), 0);
  const list = items.map(e => vignetteHTML(e, counts[e.key])).join('');
  return `<div class="jfam"><div class="jfamh"><span class="jfamt">${esc(f.title)}</span><span class="jfamn">${total}</span></div><div class="jfamc">${list}</div></div>`;
}

/** Construit la fenêtre entière, prête à être injectée dans un conteneur. */
export function juanitaHTML(deck: Card[], round: number): string {
  const outBySuit: Record<SuitKey, Record<string, boolean>> = { black: {}, yellow: {}, purple: {}, green: {} };
  const specCount: Record<string, number> = {};
  for (const c of deck) {
    if (c.kind === 'num' && !c.wild && c.suit) {
      const key = c.zf ? 'zf' : c.mod ? ('m' + c.rank) : String(c.rank);
      outBySuit[c.suit as SuitKey][key] = true;
    } else {
      const k = specKey(c); specCount[k] = (specCount[k] || 0) + 1;
    }
  }
  const total = deck.length;
  const numName = (suit: typeof SUITS[number], label: string, sm: string) =>
    (sm ? `${label} (${sm}) ` : `${label} `) + SUIT[suit.k].n;
  const rows = SUITS.map(suit => {
    const base = outBySuit[suit.k];
    const cells: string[] = [];
    for (let r = 1; r <= 14; r++) {
      const k = String(r);
      cells.push(base[k] ? cellHTML(suit, k, numName(suit, k, ''), '', 'suit-' + suit.k) : gapHTML());
    }
    const ext = EXT_COLS.map(e => base[e.key]
      ? cellHTML(suit, e.label, numName(suit, e.label, e.sm), e.sm, 'suit-' + suit.k)
      : gapHTML()).join('');
    return `<div class="jrow"><span class="jname" title="${esc(SUIT[suit.k].n)}"><i style="background:${suit.c}"></i>${esc(suit.short)}</span>${cells.join('')}<span class="jsep" aria-hidden="true"></span>${ext}</div>`;
  }).join('');
  const families = FAMILIES.map(f => familyHTML(f, specCount)).filter(Boolean).join('');
  // aperçu initial : la 1re carte trouvée (ou le portrait de Juanita si vide)
  const first = deck[0];
  const firstKey = first
    ? (first.kind === 'num' && !first.wild && first.suit ? 'suit-' + first.suit : specKey(first))
    : 'juanita';
  const firstName = first ? (first.kind === 'num' && !first.wild && first.suit
    ? (first.zf ? '0/14' : first.mod ? `${first.rank} (${first.mod > 0 ? '+' : '−'}${Math.abs(first.mod)})` : String(first.rank)) + ' ' + SUIT[first.suit].n
    : (first.kind === 'pirate' ? PIRATES[first.pid!].n
       : first.kind === 'mermaid' ? (first.v ? 'Circé' : 'Alyra')
       : first.kind === 'num' && first.wild ? 'Le Grand Quinze'
       : SPECIAL[first.kind as string] || '')) : 'Juanita Jade';
  const firstNum = first && first.kind === 'num' && !first.wild
    ? (first.zf ? '0/14' : String(first.rank)) : '';
  const firstInk = first && first.kind === 'num' && !first.wild && first.suit
    ? (SUITS.find(s => s.k === first.suit)?.numInk || '#2b2117') : '';
  return `<div class="juanita" role="dialog" aria-modal="true" aria-labelledby="jTitle">
    <div class="jhead">
      <img src="${esc(ART.juanita || '')}" alt="" class="jport">
      <div class="jhtxt">
        <div class="jtitle" id="jTitle">Cartes non distribuées</div>
        <div class="jsub">Juanita Jade · manche ${round} · <b>visible par vous seul</b></div>
      </div>
      <span class="jtotal"><b>${total}</b> hors jeu</span>
    </div>
    <div class="jbody">
      <div class="jleft">
        <div class="jsuits">${rows}</div>
        <div class="jfams">${families || '<span class="jempty">Aucune carte spéciale hors jeu.</span>'}</div>
      </div>
      <div class="jright">
        <div class="jprev" id="jPrev">
          <img id="jPrevImg" src="${esc(ART[firstKey] || '')}" alt="">
          <span id="jPrevNum" class="jpnum" style="color:${firstInk}">${esc(firstNum)}</span>
        </div>
        <b id="jPrevName" class="jpname">${esc(firstName)}</b>
      </div>
    </div>
    <div class="jfoot">
      <span class="jhint">Survolez une carte pour l'agrandir. Une fois fermée, cette fenêtre ne se rouvre pas.</span>
      <button class="btn gold" id="jClose">Fermer</button>
    </div>
  </div>`;
}

/** Ouvre la fenêtre en overlay sur document.body. Résout quand elle est fermée. */
export function openJuanita(deck: Card[], round: number): Promise<void> {
  return new Promise(res => {
    const prev = document.querySelector('.juov'); if (prev) prev.remove();
    const ov = document.createElement('div'); ov.className = 'juov';
    ov.innerHTML = juanitaHTML(deck, round);
    document.body.append(ov);
    const back = document.activeElement as HTMLElement | null;
    const img = ov.querySelector('#jPrevImg') as HTMLImageElement;
    const num = ov.querySelector('#jPrevNum') as HTMLElement;
    const name = ov.querySelector('#jPrevName') as HTMLElement;
    const show = (el: HTMLElement) => {
      const art = el.dataset.art || '', nm = el.dataset.name || '', n = el.dataset.num || '', ink = el.dataset.ink || '';
      img.src = ART[art] || ''; num.textContent = n; num.style.color = ink; name.textContent = nm;
      ov.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
      el.classList.add('sel');
    };
    ov.addEventListener('mouseover', ev => { const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('.jcell:not(.gap),.jsp'); if (b) show(b); });
    ov.addEventListener('focusin',  ev => { const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('.jcell:not(.gap),.jsp'); if (b) show(b); });
    ov.addEventListener('click',    ev => { const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('.jcell:not(.gap),.jsp'); if (b) show(b); });
    let done = false;
    const close = () => {
      if (done) return; done = true;
      ov.classList.add('out'); setTimeout(() => ov.remove(), 220);
      document.removeEventListener('keydown', onKey);
      back?.focus?.();
      res();
    };
    (ov.querySelector('#jClose') as HTMLButtonElement).onclick = close;
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey);
    const first = ov.querySelector<HTMLButtonElement>('.jcell:not(.gap),.jsp'); first?.focus();
  });
}
