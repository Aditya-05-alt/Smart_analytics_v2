"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SupabaseAuthEnvStatus } from "@/components/auth/SupabaseAuthEnvStatus";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!supabase) {
      setError("Configure Supabase environment variables first.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setLoading(true);
    const { data, error: signError } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setInfo(
      "Check your email to confirm your account, then sign in — or disable email confirmation in Supabase Auth settings for development.",
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">Create account</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Wheeler SmartAnalytics V2 — sign up with your work email.
      </p>
      <div className="mt-4">
        <SupabaseAuthEnvStatus />
      </div>
      <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-700"
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
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-600/30 focus:ring-2"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-600/30 focus:ring-2"
          />
        </div>
        <div>
          <label
            htmlFor="confirm"
            className="block text-sm font-medium text-zinc-700"
          >
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-600/30 focus:ring-2"
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="text-sm text-blue-800" role="status">
            {info}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <a href="/login" className="font-medium text-blue-600 hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
