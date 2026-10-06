# Son « carte posée » (A12)

Fichiers : `web/public/sounds/cartes/carte-posee-a|b|c.ogg` (repli `.mp3`). Ce sont 3 variantes du même son (hauteur normale, −4,5 % et +5 %), déjà nettoyées : coupé à 0,125 s, un peu de corps vers 200 Hz, aigus adoucis, crête à −6 dBFS. Source d'origine et script : `docs/sons/source/Carte_2.wav`, `docs/sons/son_carte.py`.

## À faire

1. **Un gestionnaire de sons commun, `web/src/sfx.ts`** (s'il n'existe pas déjà ; sinon, branche-toi dessus) :
   - Web Audio API : un seul `AudioContext`, les sons décodés une fois en `AudioBuffer` au chargement de la table (pas de `new Audio()` à chaque carte, trop lent et trop de latence) ;
   - choix du format : `.ogg` si `canPlayType('audio/ogg; codecs=opus')`, sinon `.mp3` ;
   - déverrouillage au premier geste de l'utilisateur (`ctx.resume()`), indispensable sur iOS et Safari ;
   - une fonction `play(name, {volume, rate})` qui passe par un `GainNode` général, relié au réglage Son existant (coupé = rien ne joue) ;
   - ne joue rien si l'onglet est caché (`document.hidden`).
   - Fais passer par ce gestionnaire les autres sons déjà présents (impacts des cartes animées, cloche, mèche et baril du tour de jeu) pour qu'ils partagent le même réglage.
2. **Quand jouer le son :**
   - à chaque carte posée dans le pli, par n'importe quel joueur (bots compris), **au moment où la carte touche le tapis**, c'est-à-dire à la fin de l'animation de pose, pas au clic ;
   - variante tirée au hasard parmi a, b et c, jamais deux fois la même d'affilée, plus un `playbackRate` aléatoire entre 0,97 et 1,03 ;
   - volume 0,8 pour votre carte, 0,55 pour celles des autres ;
   - **pas de son « carte posée » pour une carte animée Mythique** : son propre son d'impact (D11) le remplace ;
   - si deux cartes arrivent à moins de 60 ms d'écart, décale la seconde de 60 ms ;
   - **seulement sur les événements en direct** : pas de rafale de sons à la reconnexion, au rechargement de l'état ou dans le replay d'une partie.
3. **Réglages :** dans les réglages de la partie, garde un seul interrupteur Son avec un curseur Volume (0 à 100 %, enregistré en localStorage). Pas besoin d'un réglage à part pour ce son.
4. **Tests :**
   - unitaire : le choix de variante ne répète jamais la précédente, et aucun son n'est joué quand Son est coupé ou que l'événement vient d'une resynchronisation ;
   - à la main : une manche complète à 4 joueurs sur ordinateur puis sur téléphone (iOS Safari si possible), en vérifiant que le son tombe bien sur l'arrivée de la carte.

Ensuite `npm test`, `npm run build`, coche A12 dans `docs/ETAT.md`, puis fais un commit.
