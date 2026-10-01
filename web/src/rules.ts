// Fenêtre des règles (texte repris du jeu autonome).
import { cardHTML, faceOf } from './cards';
import { PIRATES } from '@engine';

export function rulesHTML(): string {
  const ex = (arr: any[]) => `<div class="grid">${arr.map(c => cardHTML(c)).join('')}</div>`;
  return `<div class="rules"><h2>Règles</h2><p class="sub">Les règles officielles de Skull King et de son extension, avec les noms de cartes du design « Mers Sauvages ».</p>
  <div class="aides">${["aide1","aide2","aide3"].map(k=>`<div class="card"><div class="face">${faceOf(k)}</div></div>`).join("")}</div>
  <h3>Déroulement</h3><ul>
  <li>10 manches : 1 carte à la manche 1, jusqu'à 10 cartes à la manche 10. Le joueur à gauche du donneur entame.</li>
  <li>Avant de jouer, chacun mise en secret le nombre de plis qu'il remportera, puis les mises sont révélées ensemble.</li>
  <li>La première carte numérotée jouée fixe la couleur demandée. Il faut la fournir si possible ; les cartes spéciales et le Grand Quinze se jouent à tout moment. Si un personnage (Pirate, Barbe-Cendre, Sirène, Kraken, Baleine, Second) entame, il n'y a pas de couleur pour ce pli.</li>
  <li>Le gagnant du pli entame le suivant.</li></ul>
  ${ex([{kind:'num',suit:'black',rank:14},{kind:'num',suit:'yellow',rank:14},{kind:'num',suit:'purple',rank:9},{kind:'num',suit:'green',rank:3}])}
  <h3>Ordre des forces</h3><ul>
  <li>Le Pavillon noir est l'atout et bat les trois autres couleurs (Perroquet, Doublon, Carte marine). Sinon, la plus haute carte de la couleur demandée gagne.</li>
  <li>Sirène &gt; toutes les cartes numérotées. Pirate &gt; Sirène. Barbe-Cendre &gt; Pirates. Une Sirène capture Barbe-Cendre.</li>
  <li>Plusieurs cartes du même rang : la première jouée gagne. Si Pirate, Barbe-Cendre et Sirène sont réunis, la Sirène gagne.</li>
  <li>Drapeau blanc (Fuite) : perd toujours. Si le pli n'est fait que de Fuites, la première gagne.</li></ul>
  ${ex([{kind:'escape'},{kind:'mermaid',v:0},{kind:'mermaid',v:1},{kind:'tigress'},{kind:'sk'},{kind:'kraken'},{kind:'whale'},{kind:'loot'}])}
  <h3>Cartes spéciales du jeu de base</h3><ul>
  <li><b>Morgane la Louve</b> : choisissez de la jouer comme Pirate ou comme Fuite.</li>
  <li><b>Le Kraken</b> : personne ne remporte le pli ; le joueur qui l'aurait remporté entame.</li>
  <li><b>La Baleine Fantôme</b> : les cartes spéciales perdent leur effet, la plus haute carte numérotée gagne quelle que soit sa couleur. Sans carte numérotée, le pli est défaussé et le joueur de la Baleine entame. Si Kraken et Baleine sont dans le même pli, le dernier joué s'applique.</li>
  <li><b>Pacte de Butin</b> : se joue comme une Fuite et vous allie au gagnant du pli : +20 chacun si vous réussissez tous deux votre mise.</li></ul>
  <h3>Pouvoirs des Pirates (règle avancée)</h3>
  ${ex(['rosie','bahij','rascal','juanita','harry'].map(pid=>({kind:'pirate',pid})))}
  <ul>${Object.values(PIRATES).map((x: any)=>`<li><b>${x.n}</b> : ${x.pw}.</li>`).join('')}</ul>
  <p>Le pouvoir s'active quand le Pirate remporte le pli.</p>
  <h3>Extension</h3>
  ${ex([{kind:'num',suit:'green',rank:7,mod:-5,exp:1},{kind:'num',suit:'yellow',rank:8,mod:5,exp:1},{kind:'num',suit:'purple',rank:14,zf:1,exp:1},{kind:'num',suit:'wild',rank:15,wild:1,exp:1},{kind:'pirate',pid:'mary',exp:1},{kind:'con',exp:1},{kind:'volley',exp:1},{kind:'stingray',exp:1},{kind:'davy',exp:1},{kind:'plank',exp:1}])}
  <ul>
  <li><b>7 et 8</b> de l'extension : cartes normales. Capturer un 8 rapporte +5, un 7 coûte −5.</li>
  <li><b>0/14</b> : annoncez 0 ou 14 en la jouant. Aucun bonus de 14. À égalité de 14, le premier joué gagne.</li>
  <li><b>Le Grand Quinze</b> : se joue comme un 15 Doublon, Carte marine ou Perroquet. Si la couleur du pli n'est pas encore définie, vous choisissez sa couleur et il la fixe. Si une couleur (sauf le noir) est déjà demandée, il prend cette couleur. Si le noir est demandé, il ne prend aucune couleur. Il se joue à tout moment et perd contre le Pavillon noir comme toute carte de couleur.</li>
  <li><b>Lise Fil-de-Soie</b> : Pirate. Pouvoir : tirez à l'aveugle une carte dans la main de n'importe quel joueur (vous compris) ; il devra la jouer au pli suivant, sans tenir compte des règles de couleur.</li>
  <li><b>Corbin, le Second</b> : bat toutes les cartes sauf Barbe-Cendre et les Sirènes. Il ne gagne pas de bonus en capturant des Pirates mais utilise leurs pouvoirs. Barbe-Cendre ou une Sirène qui le capture gagne +30. Pirate + Sirène + Second : la Sirène gagne.</li>
  <li><b>Dernière Bordée</b> : ne gagne pas ; vous jouez une carte supplémentaire après tous les autres (si vous en avez encore). Vous serez sans carte un pli plus tôt.</li>
  <li><b>La Raie Étoilée</b> : monstre des abysses, comme la Baleine mais la plus petite carte numérotée gagne. Le dernier monstre joué s'applique.</li>
  <li><b>La Fosse des Noyés</b> : ne s'utilise qu'avec au moins un monstre des abysses dans le jeu (Kraken, Baleine ou Raie). Ne gagne pas. Engloutit tous les monstres du pli, quel que soit l'ordre ; le reste du pli se résout normalement. +20 par monstre englouti pour son joueur.</li>
  <li><b>La Planche</b> : ne gagne pas. En fin de pli, s'il y a un Pirate, vous devez en retirer un (vous choisissez s'il y en a plusieurs). Un Pirate retiré ne peut ni gagner le pli ni rapporter de points.</li>
  <li>Bordée, Raie, Fosse des Noyés et Planche ne sont pas des Fuites. En entame, la couleur est fixée par la carte suivante. Si un pli ne contient que ces cartes, il est défaussé et le même joueur entame.</li></ul>
  <h3>Décompte</h3><ul>
  <li>Mise de 1 ou plus réussie : +20 par pli. Ratée : −10 par pli d'écart.</li>
  <li>Mise de 0 réussie : +10 × nombre de cartes de la manche. Ratée : −10 × ce nombre.</li>
  <li>Variante Rascal : 10 points × cartes distribuées en jeu. Mise exacte : tous ; écart de 1 : la moitié ; écart de 2 ou plus : zéro.</li>
  <li>Bonus, seulement si la mise est réussie : 14 de couleur +10, 14 du Pavillon noir +20 ; Sirène prise par un Pirate +20 ; Pirate pris par Barbe-Cendre +30 ; Barbe-Cendre pris par une Sirène +40 ; Pacte de Butin tenu +20.</li></ul></div>`;
}
