export function SupabaseEnvBanner() {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      Copy <code className="rounded bg-amber-100 px-1">.env.example</code> to{" "}
      <code className="rounded bg-amber-100 px-1">.env.local</code> and set your
      Supabase project URL and anon key.
    </div>
  );
}
