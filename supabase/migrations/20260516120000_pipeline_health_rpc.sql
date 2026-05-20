-- Pipeline health dashboard: one RPC aggregates all 5 tables.
-- Run in Supabase SQL Editor or: supabase db push

alter table if exists public.smart_hoot_config enable row level security;
alter table if exists public.smart_ga4_config enable row level security;
alter table if exists public.smart_hoot_inventory enable row level security;
alter table if exists public.smart_ga4_data enable row level security;
alter table if exists public.smart_master_db enable row level security;

drop policy if exists "smart_hoot_config_select_authenticated" on public.smart_hoot_config;
create policy "smart_hoot_config_select_authenticated"
  on public.smart_hoot_config for select to authenticated using (true);

drop policy if exists "smart_ga4_config_select_authenticated" on public.smart_ga4_config;
create policy "smart_ga4_config_select_authenticated"
  on public.smart_ga4_config for select to authenticated using (true);

drop policy if exists "smart_hoot_inventory_select_authenticated" on public.smart_hoot_inventory;
create policy "smart_hoot_inventory_select_authenticated"
  on public.smart_hoot_inventory for select to authenticated using (true);

drop policy if exists "smart_ga4_data_select_authenticated" on public.smart_ga4_data;
create policy "smart_ga4_data_select_authenticated"
  on public.smart_ga4_data for select to authenticated using (true);

drop policy if exists "smart_master_db_select_authenticated" on public.smart_master_db;
create policy "smart_master_db_select_authenticated"
  on public.smart_master_db for select to authenticated using (true);

create or replace function public.get_daily_pipeline_status(p_as_of date default current_date)
returns table (
  dealer_name text,
  website_platform text,
  client_id text,
  bridge_ok boolean,
  hoot_inventory_ok boolean,
  hoot_inventory_count bigint,
  ga4_traffic_ok boolean,
  ga4_traffic_count bigint,
  master_last_synced timestamptz,
  master_synced_today boolean,
  vdp_match_ok boolean,
  vdp_match_count bigint,
  fully_synced boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with as_of as (
    select coalesce(p_as_of, current_date) as d
  ),
  active_hoot as (
    select
      trim(h.customer_name) as dealer_name,
      nullif(trim(h.website_platform), '') as website_platform,
      trim(h.ga4_customer_id::text) as client_id
    from public.smart_hoot_config h
    where coalesce(h.is_active, false) = true
      and h.ga4_customer_id is not null
      and trim(h.ga4_customer_id::text) <> ''
      and trim(coalesce(h.customer_name, '')) <> ''
  ),
  ga4_cfg as (
    select
      trim(g.client_id::text) as client_id,
      g.master_last_synced
    from public.smart_ga4_config g
    where g.client_id is not null
      and trim(g.client_id::text) <> ''
  ),
  bridged as (
    select
      h.dealer_name,
      h.website_platform,
      h.client_id,
      (g.client_id is not null) as bridge_ok,
      g.master_last_synced,
      (
        g.master_last_synced is not null
        and (g.master_last_synced at time zone 'utc')::date = (select d from as_of)
      ) as master_synced_today
    from active_hoot h
    left join ga4_cfg g on h.client_id = g.client_id
  ),
  inventory_counts as (
    select
      trim(lower(i.customer_name)) as match_name,
      count(distinct i.url)::bigint as cnt
    from public.smart_hoot_inventory i
    cross join as_of a
    where trim(coalesce(i.customer_name, '')) <> ''
      and (
        (i.last_seen is not null and (i.last_seen at time zone 'utc')::date = a.d)
        or (i.first_seen is not null and (i.first_seen at time zone 'utc')::date = a.d)
      )
    group by trim(lower(i.customer_name))
  ),
  ga4_counts as (
    select
      trim(d.client_id::text) as client_id,
      count(*)::bigint as cnt
    from public.smart_ga4_data d
    cross join as_of a
    where d.client_id is not null
      and trim(d.client_id::text) <> ''
      and d.report_date in (a.d, a.d - 1)
    group by trim(d.client_id::text)
  ),
  master_vdp_counts as (
    select
      trim(m.client_id::text) as client_id,
      count(*)::bigint as cnt
    from public.smart_master_db m
    cross join as_of a
    where m.client_id is not null
      and trim(m.client_id::text) <> ''
      and m.report_date = a.d
      and coalesce(m.vpd_page, false) = true
    group by trim(m.client_id::text)
  )
  select
    b.dealer_name,
    b.website_platform,
    b.client_id,
    b.bridge_ok,
    coalesce(ic.cnt, 0) > 0 as hoot_inventory_ok,
    coalesce(ic.cnt, 0) as hoot_inventory_count,
    coalesce(gc.cnt, 0) > 0 as ga4_traffic_ok,
    coalesce(gc.cnt, 0) as ga4_traffic_count,
    b.master_last_synced,
    b.master_synced_today,
    coalesce(mc.cnt, 0) > 0 as vdp_match_ok,
    coalesce(mc.cnt, 0) as vdp_match_count,
    (
      b.bridge_ok
      and coalesce(ic.cnt, 0) > 0
      and coalesce(gc.cnt, 0) > 0
      and b.master_synced_today
      and coalesce(mc.cnt, 0) > 0
    ) as fully_synced
  from bridged b
  left join inventory_counts ic
    on trim(lower(b.dealer_name)) = ic.match_name
  left join ga4_counts gc on b.client_id = gc.client_id
  left join master_vdp_counts mc on b.client_id = mc.client_id
  order by coalesce(ic.cnt, 0) desc, b.dealer_name asc;
$$;

revoke all on function public.get_daily_pipeline_status(date) from public;
grant execute on function public.get_daily_pipeline_status(date) to authenticated;
grant execute on function public.get_daily_pipeline_status(date) to service_role;
