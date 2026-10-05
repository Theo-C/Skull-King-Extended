# Cartes animées : rareté Mythique (D11)

Maquette : `docs/maquettes/CartesAnimees.dc.html`.

## Le principe
Les éléments de l'illustration bougent eux-mêmes : les tentacules du Kraken, les cheveux d'Alyra, les ailes de la Raie, les navires, la mer. Chaque animation est une **courte vidéo en boucle** (5 s, 24 images/s, 720 × 1024) qui reprend la carte pixel pour pixel. Seule l'illustration bouge : le cadre, les médaillons et le nom restent fixes dans la vidéo.

Fichiers : `web/public/cards/anim/<clé>.webm` (VP9, de 280 à 910 Ko), `<clé>.mp4` (H.264, solution de repli pour Safari et iOS) et `<clé>-cadre.webp` (le cadre seul, environ 120 Ko).
Scripts de génération (Python, OpenCV) : `docs/cartes-animees/source/`. Ils servent à retoucher une animation ou à en créer une nouvelle : `python3 kraken.py test` sort des images de contrôle, `python3 kraken.py` produit la vidéo. Les chemins des images sont à adapter.

Une vidéo coûte beaucoup moins cher qu'un filtre SVG ou canvas : le décodage est fait par le matériel, même sur téléphone.

## Les 6 cartes
| Fichier | Carte | Ce qui bouge |
|---|---|---|
| `kraken` | Kraken | tentacules qui ondulent et s'enroulent, tête qui respire, œil qui rougeoie, navires qui tanguent, feu qui vacille, naufragés qui flottent, éclair qui s'allume, pluie |
| `sk` | Skull King | la barre tourne d'un bloc avec ses mains, tresses et barbe dans le vent, mer déchaînée, navires au loin, éclairs, éclat de la couronne, rubis du médaillon |
| `raie` | Raie (`stingray`) | battement des ailes, queue, vol plané, navire qui tangue, surface, algues, lumière sur le sable, bulles |
| `baleine` | Baleine (`whale`) | la baleine surgit et ouvre la gueule, gerbes d'eau et ruissellement, brume d'écume, rayons du soleil qui tournent, mouettes, navires et chaloupe qui tanguent, marin qui fait signe, houle, scintillements |
| `sirene` | Alyra (`mermaid0`) | cheveux qui flottent, perles qui scintillent, méduses, poissons, algues, bulles |
| `fosse` | Fosse des Noyés (`davy`) | le noyé flotte dans un halo spectral, yeux qui s'allument, cheveux et manteau qui ondulent (mains fixes), lumière qui balaie le fond, particules en suspension, poissons, algues, pièces qui brillent, bulles |

## Affichage : trois couches superposées
1. L'image normale de la carte (`cards/<carte>.webp`), toujours présente. Elle sert aussi de repli.
2. La vidéo, posée exactement dessus.
3. **Le cadre seul** (`cards/anim/<clé>-cadre.webp`, fenêtre transparente) par-dessus la vidéo. Il contient la bordure blanche, le cadre, les médaillons, le bandeau du nom et les volutes. Ainsi, la compression vidéo ne touche jamais le cadre : il reste net et parfaitement fixe, et l'animation passe dessous.

```html
<div class="card-anim">
  <img src="cards/kraken.webp" alt="">
  <video class="anim" poster="cards/kraken.webp" muted loop playsinline preload="none">
    <source src="cards/anim/kraken.webm" type="video/webm">
    <source src="cards/anim/kraken.mp4" type="video/mp4">
  </video>
  <img class="cadre" src="cards/anim/kraken-cadre.webp" alt="">
</div>
```
- Les trois couches sont en `position: absolute; inset: 0; width: 100%; height: 100%`, avec `object-fit: fill` pour la vidéo. Le cadre a `pointer-events: none`.
- La vidéo est masquée par l'image de la carte (`mask-image: url(cards/<carte>.webp); mask-size: 100% 100%`) pour garder les coins arrondis.
- `preload="none"` : la vidéo n'est chargée qu'au premier `play()`.
- **En main, au repos** : seulement l'image (pas de balise vidéo).
- **En main, au survol** : la vidéo est créée et lancée ; elle s'arrête quand le pointeur sort.
- **Posée dans le pli** : un halo de la couleur de la carte (1,2 s) et un léger grossissement à l'arrivée, puis la vidéo tourne jusqu'au ramassage du pli. **Une seule vidéo à la fois sur la table** : la dernière carte animée posée.
- **Zoom** : la vidéo en grand, plus la pastille irisée « Mythique » sur la fiche parchemin.
- **Journal, miniatures, fin de manche** : toujours l'image fixe.
- Couleurs du halo : kraken `#ff5a3a`, sk `#ffd36b`, raie `#6fe6ff`, baleine `#ff9a3a`, sirene `#bff6ff`, fosse `#5dff8a`.

## Garde-fous
- Réglage « Cartes animées : toutes / les miennes / aucune » (localStorage `pli.cartesAnimees`).
- Avec `prefers-reduced-motion` ou l'économiseur de données (`navigator.connection.saveData`), on affiche l'image fixe.
- Si la vidéo ne peut pas être lue, le `poster` (l'image normale) reste affiché : il n'y a jamais de trou.

## Rareté et coffre
- Nouvelle rareté **Mythique** : 1 % par coffre. Commun passe de 62 % à 61 %.
- Couleur irisée (dégradé conique qui tourne : `#ff9ad5 → #ffd36b → #8dffb0 → #7fc8ff → #c39bff`).
- Dans l'animation du coffre, la lueur passe par l'or pendant 1 s, puis devient irisée. La phase de lueur blanche dure 2,8 s.
- Un doublon rapporte 400 pièces. Une fois les 6 cartes possédées, une Mythique tirée devient une Légendaire.
