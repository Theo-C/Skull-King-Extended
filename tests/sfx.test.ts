// Son « carte posée » (A12, docs/sons/PROMPT-son-carte.md) : choix de variante et conditions de lecture.
import { CARD_VARIANTS, LIVE_BATCH_MAX, nextVariant, shouldPlayCard, cardPlaced, setSound } from '../web/src/sfx';

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error('ÉCHEC :', msg); } };

// la variante ne se répète jamais deux fois d'affilée, et toutes finissent par sortir
let prev = -1; const seen = new Set<number>();
for (let i = 0; i < 5000; i++) {
  const v = nextVariant(prev);
  check(v >= 0 && v < CARD_VARIANTS.length, `variante hors bornes : ${v}`);
  check(v !== prev, `variante répétée : ${v} après ${prev}`);
  seen.add(v); prev = v;
}
check(seen.size === CARD_VARIANTS.length, 'toutes les variantes sortent');
// cas limites du tirage (0 et presque 1)
for (let p = 0; p < CARD_VARIANTS.length; p++) for (const r of [0, .5, .999999]) check(nextVariant(p, () => r) !== p, `répétition avec rnd=${r} après ${p}`);

// conditions : son coupé, resynchronisation, carte animée → rien
check(shouldPlayCard({ soundOn: true, live: true, animated: false }), 'joue en direct, son activé');
check(!shouldPlayCard({ soundOn: false, live: true, animated: false }), 'son coupé : rien');
check(!shouldPlayCard({ soundOn: true, live: false, animated: false }), 'resynchronisation : rien');
check(!shouldPlayCard({ soundOn: true, live: true, animated: true }), 'carte animée : rien (son impact)');
check(LIVE_BATCH_MAX > 22, "un coup ordinaire (jusqu'à 22 événements, robots compris) reste du direct");

// sans navigateur ni son : cardPlaced ne joue pas et ne plante pas
setSound(false);
check(cardPlaced({ mine: true, animated: false, live: true }) === false, 'son coupé : cardPlaced ne joue pas');
setSound(true);
check(cardPlaced({ mine: false, animated: false, live: false }) === false, 'resynchronisation : cardPlaced ne joue pas');

if (fails) { console.error(`Sons : ${fails} échec(s)`); process.exit(1); }
console.log('Sons OK');
