// Annonces des belles prises (D14) : une Signée, une Numérotée ou un booster divin ouvert par un autre joueur s'affiche
// partout dans l'appli (salon et table compris), le temps d'un toast. Le fil de l'accueil garde les 14 derniers jours.
import { sb } from './api';
import { toast } from './util';

let listening = false;
export function listenAnnouncements(uid: string) {
  if (listening) return; listening = true;
  sb.channel('annonces').on('broadcast', { event: 'carte' }, ({ payload }) => {
    const p = payload as { userId: string; pseudo: string; divine: boolean; cards: { name: string; variant: string; serial: number | null }[] };
    if (!p || p.userId === uid) return;
    const what = p.divine ? 'un booster divin (1 sur 2 000)' : p.cards.map(c => `${c.name} ${c.variant === 'numero' ? `Numérotée N° ${String(c.serial).padStart(3, '0')}` : 'Signée'}`).join(', ');
    toast(`✦ ${p.pseudo} vient d’ouvrir ${what} !`);
  }).subscribe();
}
