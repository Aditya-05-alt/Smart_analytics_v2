import { addDays, format, parseISO } from "date-fns";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardQueryClient } from "@/lib/supabase/dashboard-query";
import type { SmartMasterDbRow } from "@/types/smart-master-db";

function coerceGa4PropertyIdFilter(raw: string): string | number {
  const t = raw.trim();
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    if (Number.isSafeInteger(n)) return n;
  }
  return t;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ga4PropertyId = searchParams.get("ga4_property_id");
  const clientId = searchParams.get("client_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  if (!ga4PropertyId?.trim() || !dateFrom?.trim() || !dateTo?.trim()) {
    return NextResponse.json(
      { error: "Missing ga4_property_id, date_from, or date_to" },
      { status: 400 },
    );
  }

  try {
    const supabase = await getDashboardQueryClient();
    if (!supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db: SupabaseClient = supabase;

    const from = dateFrom.trim();
    const to = dateTo.trim();
    /** Inclusive calendar range on `report_date`: [from, to] — rows use `report_date`, not a stored range. */
    let reportBefore: string | null = null;
    try {
      reportBefore = format(addDays(parseISO(to), 1), "yyyy-MM-dd");
    } catch {
      reportBefore = null;
    }

    const pid = coerceGa4PropertyIdFilter(ga4PropertyId);
    const cid = clientId?.trim() ?? "";

    function applyDateRange<
      T extends {
        gte: (c: string, v: string) => T;
        lt: (c: string, v: string) => T;
        lte: (c: string, v: string) => T;
      },
    >(qb: T) {
      let q = qb.gte("report_date", from);
      return reportBefore
        ? q.lt("report_date", reportBefore)
        : q.lte("report_date", to);
    }

    /**
     * Load every row in the date window (not a single `limit` page). A hard cap of
     * `report_date` descending meant the first 500 rows were often all one day, so
     * earlier days never reached the client for VDP Daily / aggregates.
     */
    const PAGE_SIZE = 1000;
    const MAX_ROWS = 200_000;

    async function fetchAllRows(
      eqColumn: "ga4_property_id" | "client_id",
      eqValue: string | number,
    ): Promise<{ rows: SmartMasterDbRow[]; error: { message: string } | null }> {
      const rows: SmartMasterDbRow[] = [];
      for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
        const { data, error } = await applyDateRange(
          db.from("smart_master_db").select("*").eq(eqColumn, eqValue),
        )
          .order("report_date", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) return { rows, error };
        if (!data?.length) break;
        rows.push(...(data as SmartMasterDbRow[]));
        if (data.length < PAGE_SIZE) break;
      }
      return { rows, error: null };
    }

    let { rows, error: err1 } = await fetchAllRows("ga4_property_id", pid);

    if (err1) {
      return NextResponse.json({ error: err1.message }, { status: 500 });
    }

    if (rows.length === 0 && cid) {
      const { rows: byClient, error: err2 } = await fetchAllRows(
        "client_id",
        cid,
      );

      if (err2) {
        return NextResponse.json({ error: err2.message }, { status: 500 });
      }

      rows = byClient;
    }

    return NextResponse.json({
      rows,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
