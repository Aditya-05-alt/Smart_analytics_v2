import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardQueryClient } from "@/lib/supabase/dashboard-query";
import {
  SMART_VDP_LOGIC_SELECT,
  SMART_VDP_LOGIC_TABLE,
} from "@/lib/vdp-logics/smart-vdp-logic";
import type {
  VdpLogicInput,
  VdpLogicRow,
  VdpLogicsListResponse,
} from "@/types/vdp-logic";

function normalizeRow(row: Record<string, unknown>): VdpLogicRow {
  return {
    id: Number(row.id),
    dealer_name: String(row.dealer_name ?? ""),
    dealer_id: row.dealer_id != null ? String(row.dealer_id) : null,
    website_url: row.website_url != null ? String(row.website_url) : null,
    cms: row.cms != null ? String(row.cms) : null,
    data_source: row.data_source != null ? String(row.data_source) : null,
    hoot_link: row.hoot_link != null ? String(row.hoot_link) : null,
    scrap_link: row.scrap_link != null ? String(row.scrap_link) : null,
    vdp_logic: row.vdp_logic != null ? String(row.vdp_logic) : null,
    srp_logic: row.srp_logic != null ? String(row.srp_logic) : null,
    home_page_logic:
      row.home_page_logic != null ? String(row.home_page_logic) : null,
    others: row.others != null ? String(row.others) : null,
    created_at: row.created_at != null ? String(row.created_at) : null,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
  };
}

function normalizeInput(input: VdpLogicInput) {
  const trimOrNull = (v: string | null | undefined) => {
    const t = v?.trim();
    return t ? t : null;
  };

  return {
    dealer_name: input.dealer_name.trim(),
    dealer_id: trimOrNull(input.dealer_id),
    website_url: trimOrNull(input.website_url),
    cms: trimOrNull(input.cms),
    data_source: trimOrNull(input.data_source),
    hoot_link: trimOrNull(input.hoot_link),
    scrap_link: trimOrNull(input.scrap_link),
    vdp_logic: trimOrNull(input.vdp_logic),
    srp_logic: trimOrNull(input.srp_logic),
    home_page_logic: trimOrNull(input.home_page_logic),
    others: trimOrNull(input.others),
  };
}

async function getClient(): Promise<
  SupabaseClient | { error: string; status: number }
> {
  const db = await getDashboardQueryClient();
  if (!db) {
    return { error: "Unauthorized", status: 401 };
  }
  return db;
}

export async function listVdpLogics(): Promise<
  VdpLogicsListResponse | { error: string; status: number }
> {
  const db = await getClient();
  if ("error" in db) return db;

  const { data, error } = await db
    .from(SMART_VDP_LOGIC_TABLE)
    .select(SMART_VDP_LOGIC_SELECT)
    .order("dealer_name", { ascending: true });

  if (error) {
    return { error: error.message, status: 500 };
  }

  const rows = (data ?? []).map((row) =>
    normalizeRow(row as unknown as Record<string, unknown>),
  );

  return {
    source: "smart_vdp_logic",
    rows,
    total: rows.length,
    fetched_at: new Date().toISOString(),
  };
}

export async function createVdpLogic(
  input: VdpLogicInput,
): Promise<VdpLogicRow | { error: string; status: number }> {
  const db = await getClient();
  if ("error" in db) return db;

  if (!input.dealer_name.trim()) {
    return { error: "Dealer name is required.", status: 400 };
  }

  const payload = normalizeInput(input);
  const { data, error } = await db
    .from(SMART_VDP_LOGIC_TABLE)
    .insert(payload)
    .select(SMART_VDP_LOGIC_SELECT)
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return { error: error.message, status };
  }

  return normalizeRow(data as unknown as Record<string, unknown>);
}

export async function updateVdpLogic(
  id: number,
  input: VdpLogicInput,
): Promise<VdpLogicRow | { error: string; status: number }> {
  const db = await getClient();
  if ("error" in db) return db;

  if (!input.dealer_name.trim()) {
    return { error: "Dealer name is required.", status: 400 };
  }

  const payload = normalizeInput(input);
  const { data, error } = await db
    .from(SMART_VDP_LOGIC_TABLE)
    .update(payload)
    .eq("id", id)
    .select(SMART_VDP_LOGIC_SELECT)
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return { error: error.message, status };
  }

  if (!data) {
    return { error: "Record not found.", status: 404 };
  }

  return normalizeRow(data as unknown as Record<string, unknown>);
}

export async function deleteVdpLogic(
  id: number,
): Promise<{ ok: true } | { error: string; status: number }> {
  const db = await getClient();
  if ("error" in db) return db;

  const { error, count } = await db
    .from(SMART_VDP_LOGIC_TABLE)
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return { error: error.message, status: 500 };
  }

  if (!count) {
    return { error: "Record not found.", status: 404 };
  }

  return { ok: true };
}
