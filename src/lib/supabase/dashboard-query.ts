import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TEMP_DEV_SESSION_COOKIE,
  isTempDevAuthEnabled,
  tempDevSessionValid,
} from "@/lib/temp-dev-auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase client for dashboard reads (`smart_ga4_config`, `smart_master_db`).
 * Uses the signed-in user session when present; otherwise, in **development**
 * only, may use the **service role** key when the temp dev cookie is set so
 * RLS does not block local testing (requires `SUPABASE_SERVICE_ROLE_KEY`).
 */
export async function getDashboardQueryClient(): Promise<
  SupabaseClient | null
> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (user) {
    return authClient as unknown as SupabaseClient;
  }

  if (!isTempDevAuthEnabled()) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return null;
  }

  const cookieStore = await cookies();
  const devCookie = cookieStore.get(TEMP_DEV_SESSION_COOKIE)?.value;
  if (!tempDevSessionValid(devCookie)) {
    return null;
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
