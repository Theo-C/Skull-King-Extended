Lis `docs/gif/SPEC.md` et la maquette `docs/maquettes/GifPartie.dc.html` (sa mise en page, son CSS et les keyframes `gifRise` et `gifSway` ; ne copie pas le format .dc.html).

1. **Clé KLIPY.** Crée un compte développeur KLIPY et vérifie les conditions actuelles : quotas, mention d'attribution, publicités. Ajoute la clé dans les secrets Supabase (`KLIPY_API_KEY`), jamais dans le client.
2. **Edge Function.**
   - Action `gif.search {q, cat, cursor}` : appelle KLIPY avec le filtre de contenu le plus strict, met en cache 10 min par requête, et renvoie `{id, preview, full, w, h}` en préférant mp4 ou webp.
   - Action `gif.send {gameId, gifId}` : vérifie que le joueur est à la table, le débit (1 GIF toutes les 10 s, compteur en base) et que ce n'est pas son tour. Récupère l'URL du GIF côté serveur, puis diffuse `{type: 'gif', userId, gifUrl, w, h, at}` sur le canal Realtime de la partie.
3. **Client, `web/src/gif.ts`.**
   - **Panneau Réactions conforme à la maquette** (section « Le panneau Réactions » de la SPEC) : réactions rapides 2 × 2 numérotées, **un seul champ** avec le bouton GIF à l'intérieur à droite et la flèche d'envoi ; supprime le bouton GIF isolé sous le champ.
   - Suggestions de 3 GIF au-dessus du champ dès 2 lettres (délai 300 ms) ; « /gif mot » ouvre le mode GIF.
   - Mode GIF : le panneau grandit vers le haut par-dessus le journal, catégories Récents (12 derniers, localStorage), Tendances, Bravo, Rire, Rage, Pirate, grille 2 colonnes, Entrée = premier résultat, Échap = retour, mention « via KLIPY ». Sur téléphone, panneau qui monte depuis le bas.
   - Compte à rebours de 10 s affiché dans le bouton GIF (et bande grisée sur la grille), envoi de GIF désactivé pendant son propre tour.
4. **Affichage.** À la réception d'un message `gif` : précharge le média, puis affiche-le **au centre du tapis, comme une émote Twitch** (160 × 120, 110 × 82 sur téléphone) avec le nom de l'envoyeur. Il apparaît avec un rebond, monte en ralentissant (`gifRise`, 3,2 s) et se balance de gauche à droite avec des paramètres tirés au hasard (`gifSway` sur un élément intérieur), entre 58 et 68 % d'opacité. Voir la SPEC. Un seul GIF par joueur. Les GIF simultanés se décalent d'environ 90 px vers le côté de leur envoyeur. Le GIF passe au-dessus du tapis et du pli, mais sous la main, le sélecteur et les boutons, avec `pointer-events: none`.
5. **Options.** Ajoute « Masquer les GIF » dans les réglages et « Masquer les GIF de ce joueur » dans l'aperçu au survol. Respecte `prefers-reduced-motion` (fondu seul).
6. **Contrôle.** Envoie un GIF avec 2 comptes, vérifie le débit et le blocage pendant son tour, puis fais le test sur téléphone (390 × 844). Lance `npm test` et `npm run build`, coche A10 dans `docs/ETAT.md`, puis fais un commit.
