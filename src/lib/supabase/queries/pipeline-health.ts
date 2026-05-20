import { format, startOfDay } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardQueryClient } from "@/lib/supabase/dashboard-query";
import {
  collectCmsPlatformOptions,
  dealerRowKey,
  formatCmsPlatform,
  withCanonicalCmsPlatform,
} from "@/lib/pipeline/cms-platform";
import type {
  PipelineDealerRow,
  PipelineHealthResponse,
  PipelineHealthSummary,
} from "@/types/pipeline-health";

/** RPC can return duplicate hoot_config rows for the same client + dealer. */
function dedupeDealers(rows: PipelineDealerRow[]): PipelineDealerRow[] {
  const map = new Map<string, PipelineDealerRow>();
  for (const row of rows) {
    const key = dealerRowKey(row);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      continue;
    }
    const score = (r: PipelineDealerRow) =>
      Number(r.bridge_ok) +
      Number(r.hoot_inventory_ok) +
      Number(r.ga4_traffic_ok) +
      Number(r.master_synced_today);
    if (score(row) > score(existing)) {
      map.set(key, row);
    }
  }
  return [...map.values()];
}

function buildSummary(dealers: PipelineDealerRow[]): PipelineHealthSummary {
  const total_active_dealers = dealers.length;
  const master_db_sync_today = dealers.filter((d) => d.master_synced_today).length;
  const pipeline_failures = dealers.filter((d) => !d.master_synced_today).length;
  return { total_active_dealers, master_db_sync_today, pipeline_failures };
}

function normalizeRpcRow(row: Record<string, unknown>): PipelineDealerRow {
  return {
    dealer_name: String(row.dealer_name ?? ""),
    website_platform: formatCmsPlatform(
      row.website_platform ? String(row.website_platform) : null,
    ),
    client_id: String(row.client_id ?? ""),
    bridge_ok: Boolean(row.bridge_ok),
    hoot_inventory_ok: Boolean(row.hoot_inventory_ok),
    hoot_inventory_count: Number(row.hoot_inventory_count ?? 0),
    ga4_traffic_ok: Boolean(row.ga4_traffic_ok),
    ga4_traffic_count: Number(row.ga4_traffic_count ?? 0),
    master_last_synced: row.master_last_synced
      ? String(row.master_last_synced)
      : null,
    master_synced_today: Boolean(row.master_synced_today),
    vdp_match_ok: Boolean(row.vdp_match_ok),
    vdp_match_count: Number(row.vdp_match_count ?? 0),
    fully_synced: Boolean(row.fully_synced),
  };
}

async function fetchViaRpc(
  db: SupabaseClient,
  asOfDate: string,
): Promise<PipelineDealerRow[] | { error: string }> {
  const { data, error } = await db.rpc("get_daily_pipeline_status", {
    p_as_of: asOfDate,
  });

  if (error) {
    return { error: error.message };
  }

  return (data ?? []).map((row: Record<string, unknown>) =>
    normalizeRpcRow(row),
  );
}

export async function getPipelineHealth(
  asOfDate?: string,
): Promise<PipelineHealthResponse | { error: string; status: number }> {
  const db = await getDashboardQueryClient();
  if (!db) {
    return { error: "Unauthorized", status: 401 };
  }

  const as_of_date = asOfDate ?? format(startOfDay(new Date()), "yyyy-MM-dd");
  const fetched_at = new Date().toISOString();

  const rpcResult = await fetchViaRpc(db, as_of_date);

  if (!("error" in rpcResult)) {
    const dealers = dedupeDealers(withCanonicalCmsPlatform(rpcResult));
    return {
      as_of_date,
      fetched_at,
      source: "rpc",
      summary: buildSummary(dealers),
      dealers,
      website_platforms: collectCmsPlatformOptions(dealers),
    };
  }

  return {
    error: `Pipeline RPC unavailable. Run supabase/migrations/20260516120000_pipeline_health_rpc.sql in Supabase. (${rpcResult.error})`,
    status: 503,
  };
}
