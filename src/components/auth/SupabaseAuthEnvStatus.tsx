"use client";

import { useEffect, useState } from "react";
import { SupabaseEnvBanner } from "@/components/auth/SupabaseEnvBanner";

type StatusResponse = { configured: boolean; host: string | null };

/**
 * Uses the server to detect env (avoids client bundles where `NEXT_PUBLIC_*`
 * was not inlined for this module). Shows green when Supabase is configured.
 */
export function SupabaseAuthEnvStatus() {
  const [state, setState] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/supabase-configured", { cache: "no-store" })
      .then((r) => r.json() as Promise<StatusResponse>)
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState({ configured: false, host: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === null) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        Checking Supabase configuration…
      </div>
    );
  }

  if (!state.configured) {
    return <SupabaseEnvBanner />;
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
      <p className="font-semibold text-emerald-900">Supabase is configured</p>
      <p className="mt-1 text-emerald-900/90">
        The server has{" "}
        <code className="rounded bg-emerald-100 px-1 font-mono text-xs">
          NEXT_PUBLIC_SUPABASE_URL
        </code>{" "}
        and{" "}
        <code className="rounded bg-emerald-100 px-1 font-mono text-xs">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        (from <code className="rounded bg-emerald-100 px-1">.env.local</code> or
        your host env).
      </p>
      {state.host ? (
        <p className="mt-2 text-xs text-emerald-900/90">
          Project host:{" "}
          <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono">
            {state.host}
          </code>
        </p>
      ) : null}
      <p className="mt-2 text-xs text-emerald-800/80">
        If you just changed env vars, restart{" "}
        <code className="font-mono">npm run dev</code>.
      </p>
    </div>
  );
}
