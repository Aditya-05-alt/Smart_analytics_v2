import Link from "next/link";

export default function DashboardHomePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 text-black">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-black">
          Welcome to Wheeler SmartAnalytics V2
        </h2>
        <p className="mt-2 text-sm text-black">
          Open GA4 Advance for tabbed analytics, metrics, and the daily VDP
          chart. Data will come from your Supabase project when you connect it
          on the server.
        </p>
        <div className="mt-5">
          <Link
            href="/dashboard/ga4-advance"
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
          >
            Go to GA4 tabs
          </Link>
        </div>
      </div>
    </div>
  );
}
