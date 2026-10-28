-- Réglages du site lus par tous les clients (B7 : cards_layered ; D14 : free_daily_booster).
-- Lecture publique, écriture réservée au service (aucune règle d'écriture).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select using (true);

-- cartes en couches (cadre d'origine sur l'illustration seule) ; false = retour aux images uniques cards/*.webp
insert into public.app_settings (key, value) values ('cards_layered', 'true') on conflict (key) do nothing;
