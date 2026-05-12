/** Row shape from `public.smart_master_db` (GA4-style export). */
export type SmartMasterDbRow = {
  id: number;
  idx?: number;
  client_id?: string | null;
  ga4_property_id?: string | null;
  account_name?: string | null;
  report_date?: string | null;
  page_location?: string | null;
  page_path?: string | null;
  page_title?: string | null;
  session_campaign?: string | null;
  channel?: string | null;
  source?: string | null;
  medium?: string | null;
  source_medium?: string | null;
  views?: number | null;
  total_users?: number | null;
  sessions?: number | null;
  new_users?: number | null;
  hoot_url?: string | null;
  make?: string | null;
  model?: string | null;
  location?: string | null;
  price?: string | null;
  msrp?: string | null;
  last_updated?: string | null;
  /** VDP (vehicle detail page) flag — `smart_master_db.vdp_page`. */
  vdp_page?: boolean | null;
  /** Legacy column name if present in older schemas. */
  vpd_page?: boolean | null;
  bounce_rate?: string | null;
  avg_session_duration?: string | null;
  type_?: string | null;
  trim?: string | null;
};
