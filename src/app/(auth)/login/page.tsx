"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SupabaseAuthEnvStatus } from "@/components/auth/SupabaseAuthEnvStatus";
import { createClient } from "@/lib/supabase/client";
import { TEMP_DEV_EMAIL, TEMP_DEV_PASSWORD } from "@/lib/temp-dev-auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  /** Runtime: matches whether the browser Supabase client was created (same as env on client). */
  const envReady = !!supabase;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const devRes = await fetch("/api/dev-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (devRes.ok) {
      setLoading(false);
      router.push("/dashboard");
      router.refresh();
      return;
    }

    if (!supabase) {
      setLoading(false);
      setError(
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, restart the dev server, or use temporary dev login.",
      );
      return;
    }

    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-black shadow-sm">
      <h1 className="text-xl font-semibold text-black">Sign in</h1>
      <p className="mt-1 text-sm text-black">
        Wheeler SmartAnalytics V2 — access your dashboard.
      </p>

      <div className="mt-4">
        <SupabaseAuthEnvStatus />
      </div>

      {!envReady ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <span className="font-semibold">Temporary dev login:</span>{" "}
          <span className="font-mono">{TEMP_DEV_EMAIL}</span> / password{" "}
          <span className="font-mono">{TEMP_DEV_PASSWORD}</span> — remove before
          production (see{" "}
          <span className="font-mono">src/lib/temp-dev-auth.ts</span>).
        </p>
      ) : (
        <details className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-black">
          <summary className="cursor-pointer font-medium text-black">
            Optional: temporary dev login (no Supabase user)
          </summary>
          <p className="mt-2 font-mono text-[11px] leading-relaxed">
            {TEMP_DEV_EMAIL} / {TEMP_DEV_PASSWORD}
          </p>
        </details>
      )}

      <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-black"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black outline-none ring-blue-600/30 focus:ring-2"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-black"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black outline-none ring-blue-600/30 focus:ring-2"
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-black">
        No account?{" "}
        <a href="/signup" className="font-medium text-blue-600 hover:underline">
          Create one
        </a>
      </p>
    </div>
  );
}
