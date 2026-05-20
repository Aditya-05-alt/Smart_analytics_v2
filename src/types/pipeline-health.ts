export type PipelineDealerRow = {
  dealer_name: string;
  /** Canonical CMS label (trimmed; empty → "CMS Unknown"). */
  website_platform: string;
  client_id: string;
  bridge_ok: boolean;
  hoot_inventory_ok: boolean;
  hoot_inventory_count: number;
  ga4_traffic_ok: boolean;
  ga4_traffic_count: number;
  master_last_synced: string | null;
  master_synced_today: boolean;
  vdp_match_ok: boolean;
  vdp_match_count: number;
  fully_synced: boolean;
};

export type PipelineHealthSummary = {
  total_active_dealers: number;
  master_db_sync_today: number;
  pipeline_failures: number;
};

export type PipelineHealthResponse = {
  as_of_date: string;
  fetched_at: string;
  source: "rpc" | "fallback";
  summary: PipelineHealthSummary;
  dealers: PipelineDealerRow[];
  website_platforms: string[];
};
