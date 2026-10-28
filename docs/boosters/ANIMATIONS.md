# Animations de l'écran Booster : valeurs exactes et règles de fluidité

Référence : maquette `docs/maquettes/Booster.dc.html` et son CSS extrait dans `docs/boosters/booster-animations.css`. Reprendre **les mêmes durées, courbes et distances** ; c'est ce qui donne la sensation « Pocket ».

## 1. Choix du booster (carrousel)

- Les 3 sachets sont positionnés en 3D dans un conteneur `perspective: 1100px`, `transform-style: preserve-3d`.
- Transition unique sur chaque sachet : `transform .55s cubic-bezier(.3,1.1,.4,1), opacity .4s, filter .4s` (léger dépassement, puis retour).
- Positions (o = -1, 0, +1 par rapport au sachet choisi) :
  - centre : `translateX(0) translateZ(0) rotateY(0) scale(1)`, opacité 1, z-index 3 ;
  - côtés : `translateX(o × 240px) translateZ(-160px) rotateY(o × -32deg) scale(.82)`, opacité .55, `filter: brightness(.6) saturate(.8)`.
- Le sachet du centre flotte : `@keyframes fl` 3,2 s ease-in-out infinite, `translate: 0 -10px` et `rotate: ±1deg` (propriétés individuelles `translate`/`rotate` pour ne pas écraser le `transform` du carrousel).
- Reflet qui balaie le sachet : `.foil` 3,4 s, `background-position 130% → -60%`, `mix-blend-mode: screen`.
- Ombre au sol sous le sachet (ellipse floue), qui s'efface quand on passe à la coupe.
- Au clic sur un voisin : il devient le centre (seules les classes changent, la transition fait le reste). Flèches ‹ › et glisser horizontal sur mobile.

## 2. Focus et coupe

- Passage au focus : le sachet choisi `translateY(40px) scale(1.22)`, les deux autres `translateX(±420px) scale(.6)` + opacité 0 (même transition .55 s).
- Indice de geste : lueur `.runner` qui court le long des pointillés (2 s, `cubic-bezier(.5,0,.5,1)`, infinite) et chevrons « ››› » qui pulsent (1 s alternate). Disparaissent au premier contact.
- Geste : `pointerdown` dans le premier tiers, `setPointerCapture`, progression qui ne fait qu'augmenter ; la ligne de lumière (`width = progression`) a une étincelle à la pointe (`scale 1 → 1,4`, .25 s alternate). Ouverture à 92 %. Lâcher avant : retour à 0.
- **Pendant le glisser : aucun état React par pixel.** Mettre à jour une variable CSS (`--cut`) ou le style directement via une ref dans `requestAnimationFrame` ; ne passer par l'état qu'au début et à la fin du geste.

## 3. Ouverture (séquence fixe de 1,95 s, le sachet ne change jamais de forme)

| t (s) | élément | animation |
|---|---|---|
| 0 → 0,55 | bande du haut | `translate(260px,-180px) rotate(38deg)`, opacité 0, `cubic-bezier(.4,0,.8,.6)` ; le corps prend un bord déchiré (`clip-path` polygone) |
| 0 → 0,5 | écran | flash blanc 0,75 → 0 |
| 0,2 → 1,3 | ouverture | lumière dorée qui jaillit (`scaleY .2 → 1,2 → 1,6`, opacité 0 → 1 → 0) + rayons (`rotate 0 → 40deg`, `scale .3 → 1,2`) |
| 0,5 → 1,85 | pile de cartes | `rise` 1,35 s `cubic-bezier(.35,.1,.25,1)` : sort par le haut à 82 % (`translateY(-175px)`), **derrière** le sachet (`z-index` animé 1 → 9 à 58 %), puis redescend au centre à 100 % |
| 1,05 → 1,65 | sachet | glisse vers le bas `translateY(560px)` + opacité 0, `ease-in` |

Booster divin : 8 paillettes d'or qui montent (1,6 s, décalées de 0,35 à 1,45 s).

## 4. Pile

- Carte du dessus 280 px de large ; derrière : `translate(14px,12px) rotate(3deg) scale(.965)` assombrie à 55 %, puis `translate(26px,22px) rotate(6deg) scale(.93)` à 35 %.
- Glisser : la carte suit le doigt (`translateX(dx) rotate(dx/18 deg)`), **sans transition pendant le geste** ; au relâcher sous 90 px, retour avec `transform .25s cubic-bezier(.3,1.3,.5,1)` (petit rebond).
- Au-delà de 90 px (ou un toucher) : la carte s'envole `translate(±620px,60px) rotate(±28deg)` + opacité 0 en .45 s `cubic-bezier(.5,0,.9,.5)` ; la suivante fait un « pop » `scale .9 → 1` en .45 s `cubic-bezier(.3,1.4,.5,1)`.
- Holo et mieux : onde (`scale .3 → 1,3`, .9 s), anneau (`scale .6 → 2`, .8 s) et 10 à 32 étincelles qui partent en étoile (1 s, décalées de 0 à 0,2 s).
- 5e carte cachée : flottement `translateY(0 → -6px)` 2,4 s et lueur dorée qui respire (même pour toutes les raretés). Retournement : `rotateY(180deg)` en 1,1 s `cubic-bezier(.3,1.25,.45,1)`, `backface-visibility: hidden` sur les deux faces, **pas de `filter` sur l'élément qui porte `preserve-3d`** (sinon les deux faces s'affichent).
- Signée / Numérotée : voile 82 % en .5 s, rayons qui tournent (14 s par tour), bannière `scale .4 → 1` en .6 s `cubic-bezier(.3,1.5,.5,1)` après .5 s.

## 5. Butin

- Cartes en cascade : `translateY(40px) scale(.7) → none` en .5 s `cubic-bezier(.3,1.4,.5,1)`, décalage .1 s par carte.
- Barre de collection : largeur `--a → --b` en 1,4 s `cubic-bezier(.3,1,.4,1)` après .9 s.

## 6. Règles de fluidité (60 images/s sur téléphone)

1. N'animer **que `transform` et `opacity`** (et `filter` sur de petits éléments). Jamais `width`, `top`, `left`, `margin` (sauf la ligne de coupe, qui peut passer en `transform: scaleX(var(--cut))`).
2. **Ne jamais remonter un élément animé** : clés React stables (`key` = id de carte), pas de `key` qui change à chaque rendu. Pour relancer une animation sur le même élément, alterner deux classes aux keyframes identiques (`.ba` / `.bb`, comme la maquette) ou utiliser l'API Web Animations (`el.animate`).
3. Séquences pilotées par **un seul minuteur par étape** (ou `animationend`), annulées si l'utilisateur saute (« Tout voir ») ou quitte l'écran.
4. `will-change: transform` seulement sur la carte du dessus, la carte qui s'envole et le sachet pendant l'ouverture ; à retirer après.
5. Une seule carte animée et inclinable à la fois (celle du dessus) ; les autres `CarteVar` en `still`.
6. Précharger pendant le focus : les 5 cartes (calques + masques), le dos, l'illustration du sachet.
7. `prefers-reduced-motion` et « Animations des autres » : pas de flottement, de rayons ni de flash ; ouverture en fondu de 300 ms ; le geste de coupe reste.
8. Vibrations (Capacitor Haptics) : `light` tous les 10 % de coupe, `medium` à l'ouverture, `heavy` au retournement d'une Signée ou d'une Numérotée.

## 7. Test

Playwright avec trace de performance sur un téléphone émulé (CPU ×4 plus lent) : ouverture complète d'un booster sans image perdue au-delà de 5 %, et aucune tâche longue (> 50 ms) pendant le glisser de la coupe et de la pile.
