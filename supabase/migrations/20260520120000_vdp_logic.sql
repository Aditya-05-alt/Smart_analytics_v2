-- public.smart_vdp_logic: VDP Logics dashboard data source (CRUD).
-- Table may already exist in Supabase; this migration is idempotent.

create table if not exists public.smart_vdp_logic (
  id serial not null,
  dealer_name text not null,
  dealer_id text null,
  website_url text null,
  cms text null,
  data_source text null,
  hoot_link text null,
  scrap_link text null,
  vdp_logic text null,
  srp_logic text null,
  home_page_logic text null,
  others text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint vdp_logic_config_pkey primary key (id),
  constraint vdp_logic_config_dealer_website_unique unique (dealer_name, website_url)
);

create index if not exists idx_vdp_logic_dealer_name
  on public.smart_vdp_logic using btree (dealer_name);

create index if not exists idx_vdp_logic_cms
  on public.smart_vdp_logic using btree (cms);

create index if not exists idx_vdp_logic_website_url
  on public.smart_vdp_logic using btree (website_url);

create index if not exists idx_vdp_logic_data_source
  on public.smart_vdp_logic using btree (data_source);

create or replace function public.set_smart_vdp_logic_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_smart_vdp_logic_updated_at on public.smart_vdp_logic;
create trigger trg_smart_vdp_logic_updated_at
  before update on public.smart_vdp_logic
  for each row
  execute function public.set_smart_vdp_logic_updated_at();

alter table public.smart_vdp_logic enable row level security;

drop policy if exists "smart_vdp_logic_select_authenticated" on public.smart_vdp_logic;
create policy "smart_vdp_logic_select_authenticated"
  on public.smart_vdp_logic for select to authenticated using (true);

drop policy if exists "smart_vdp_logic_insert_authenticated" on public.smart_vdp_logic;
create policy "smart_vdp_logic_insert_authenticated"
  on public.smart_vdp_logic for insert to authenticated with check (true);

drop policy if exists "smart_vdp_logic_update_authenticated" on public.smart_vdp_logic;
create policy "smart_vdp_logic_update_authenticated"
  on public.smart_vdp_logic for update to authenticated using (true) with check (true);

drop policy if exists "smart_vdp_logic_delete_authenticated" on public.smart_vdp_logic;
create policy "smart_vdp_logic_delete_authenticated"
  on public.smart_vdp_logic for delete to authenticated using (true);
