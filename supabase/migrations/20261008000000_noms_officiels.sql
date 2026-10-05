-- Noms officiels des cartes (B6) dans les descriptions des hauts faits : Marie Thorne (ex-Lise Fil-de-Soie), Skull King (ex-Barbe-Cendre).
-- Le nom du haut fait « Fil-de-Soie » est conservé : ce n'est pas un nom de carte. Même texte dans supabase/functions/_shared/settle.ts.
update public.achievements set description = 'Imposer avec Marie Thorne une carte qui remporte le pli' where code = 'silk_thread';
update public.achievements set description = 'Capturer Skull King avec une sirène' where code = 'mermaid_king';
