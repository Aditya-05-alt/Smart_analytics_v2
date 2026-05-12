import { getDashboardQueryClient } from "@/lib/supabase/dashboard-query";

export type SmartGa4ClientOption = {
  account_name: string;
  client_id: string;
  ga4_property_id: string;
};

function isZoomersAccount(name: string) {
  return /zoomers/i.test(name.trim());
}

/**
 * Active GA4 configs for the Client dropdown (`smart_ga4_config`).
 * `ga4_property_id` matches `smart_master_db.ga4_property_id`.
 * **Zoomers** is listed first when present (local testing default).
 */
export async function getActiveSmartGa4Clients(): Promise<
  SmartGa4ClientOption[]
> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return [];
  }

  try {
    const supabase = await getDashboardQueryClient();
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from("smart_ga4_config")
      .select("account_name, client_id, ga4_property_id")
      .eq("is_active", true)
      .order("account_name", { ascending: true });

    if (error) {
      return [];
    }

    const rows = (data ?? []) as {
      account_name: string | null;
      client_id: string | null;
      ga4_property_id: string | null;
    }[];

    const out: SmartGa4ClientOption[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const name = r.account_name?.trim();
      const pid = r.ga4_property_id?.trim();
      if (!name || !pid || seen.has(pid)) continue;
      seen.add(pid);
      out.push({
        account_name: name,
        client_id: r.client_id?.trim() ?? "",
        ga4_property_id: pid,
      });
    }

    out.sort((a, b) => {
      const za = isZoomersAccount(a.account_name) ? 0 : 1;
      const zb = isZoomersAccount(b.account_name) ? 0 : 1;
      if (za !== zb) return za - zb;
      return a.account_name.localeCompare(b.account_name, undefined, {
        sensitivity: "base",
      });
    });

    return out;
  } catch {
    return [];
  }
}
