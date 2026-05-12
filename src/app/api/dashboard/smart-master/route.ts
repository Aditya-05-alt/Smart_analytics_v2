import { addDays, format, parseISO } from "date-fns";
import { NextResponse } from "next/server";
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

    let q1 = applyDateRange(
      supabase
        .from("smart_master_db")
        .select("*")
        .eq("ga4_property_id", pid),
    )
      .order("report_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(500);

    const { data: byProperty, error: err1 } = await q1;

    if (err1) {
      return NextResponse.json({ error: err1.message }, { status: 500 });
    }

    let rows = (byProperty ?? []) as SmartMasterDbRow[];

    if (rows.length === 0 && cid) {
      let q2 = applyDateRange(
        supabase.from("smart_master_db").select("*").eq("client_id", cid),
      )
        .order("report_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(500);

      const { data: byClient, error: err2 } = await q2;

      if (err2) {
        return NextResponse.json({ error: err2.message }, { status: 500 });
      }

      rows = (byClient ?? []) as SmartMasterDbRow[];
    }

    return NextResponse.json({
      rows,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
