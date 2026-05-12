-- RLS: allow any signed-in Supabase user to read GA4 config + master export rows.
-- Run in Supabase SQL Editor or via `supabase db push` if you use the CLI.
-- Tighten these policies later (e.g. join to a user_accounts table) for production.

alter table if exists public.smart_ga4_config enable row level security;
alter table if exists public.smart_master_db enable row level security;

drop policy if exists "smart_ga4_config_select_authenticated" on public.smart_ga4_config;
create policy "smart_ga4_config_select_authenticated"
  on public.smart_ga4_config
  for select
  to authenticated
  using (true);

drop policy if exists "smart_master_db_select_authenticated" on public.smart_master_db;
create policy "smart_master_db_select_authenticated"
  on public.smart_master_db
  for select
  to authenticated
  using (true);
