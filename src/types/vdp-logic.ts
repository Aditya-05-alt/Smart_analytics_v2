/**
 * Row shape for `public.smart_vdp_logic`.
 * @see supabase/migrations/20260520120000_vdp_logic.sql
 */
export type VdpLogicRow = {
  id: number;
  dealer_name: string;
  dealer_id: string | null;
  website_url: string | null;
  cms: string | null;
  data_source: string | null;
  hoot_link: string | null;
  scrap_link: string | null;
  vdp_logic: string | null;
  srp_logic: string | null;
  home_page_logic: string | null;
  others: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/** Writable columns on insert/update (id and timestamps are DB-managed). */
export type VdpLogicInput = {
  dealer_name: string;
  dealer_id?: string | null;
  website_url?: string | null;
  cms?: string | null;
  data_source?: string | null;
  hoot_link?: string | null;
  scrap_link?: string | null;
  vdp_logic?: string | null;
  srp_logic?: string | null;
  home_page_logic?: string | null;
  others?: string | null;
};

export type VdpLogicsListResponse = {
  source: "smart_vdp_logic";
  rows: VdpLogicRow[];
  fetched_at: string;
  total: number;
};
