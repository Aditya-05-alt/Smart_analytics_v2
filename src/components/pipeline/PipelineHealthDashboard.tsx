"use client";

import { format, parseISO, startOfDay } from "date-fns";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cmsPlatformsMatch, dealerRowKey } from "@/lib/pipeline/cms-platform";
import type {
  PipelineDealerRow,
  PipelineHealthResponse,
} from "@/types/pipeline-health";

const REFRESH_MS = 60_000;

type BadgeStatus = "ok" | "fail" | "warn";
type CmsRunFilter = "all" | "ran" | "not_ran";

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatTs(iso: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy · HH:mm");
  } catch {
    return iso.slice(0, 16);
  }
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
}

const BADGE_STYLES: Record<
  BadgeStatus,
  { wrap: string; icon: ReactNode; label: string }
> = {
  ok: {
    wrap: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    icon: <IconCheck className="h-3.5 w-3.5" />,
    label: "OK",
  },
  fail: {
    wrap: "bg-red-100 text-red-800 ring-1 ring-red-200",
    icon: <IconX className="h-3.5 w-3.5" />,
    label: "Fail",
  },
  warn: {
    wrap: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
    icon: <IconAlert className="h-3.5 w-3.5" />,
    label: "Warn",
  },
};

function StatusBadge({
  status,
  hint,
}: {
  status: BadgeStatus;
  hint?: string;
}) {
  const s = BADGE_STYLES[status];
  return (
    <span
      title={hint}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.wrap}`}
    >
      {s.icon}
      <span className="sr-only">{s.label}</span>
    </span>
  );
}

function bridgeStatus(row: PipelineDealerRow): BadgeStatus {
  return row.bridge_ok ? "ok" : "fail";
}

function hootStatus(row: PipelineDealerRow): BadgeStatus {
  if (row.hoot_inventory_ok) return "ok";
  if (!row.bridge_ok) return "fail";
  return "warn";
}

function ga4Status(row: PipelineDealerRow): BadgeStatus {
  if (row.ga4_traffic_ok) return "ok";
  if (!row.bridge_ok) return "fail";
  return "warn";
}

function masterSyncStatus(row: PipelineDealerRow): BadgeStatus {
  if (row.master_synced_today) return "ok";
  if (row.master_last_synced) return "warn";
  return "fail";
}

function MetricCard({
  label,
  value,
  total,
  sub,
  accent = "",
}: {
  label: string;
  value: number;
  total?: number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${accent}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-black">
        {formatInt(value)}
        {total != null ? (
          <span className="text-base font-medium text-zinc-500">
            {" "}
            / {formatInt(total)}
          </span>
        ) : null}
      </p>
      {sub ? <p className="mt-1 text-xs text-zinc-600">{sub}</p> : null}
    </div>
  );
}

export function PipelineHealthDashboard() {
  const [asOf, setAsOf] = useState(() =>
    format(startOfDay(new Date()), "yyyy-MM-dd"),
  );
  const [cmsPlatform, setCmsPlatform] = useState("");
  const [cmsRunFilter, setCmsRunFilter] = useState<CmsRunFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PipelineHealthResponse | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/pipeline-health?as_of=${encodeURIComponent(asOf)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as PipelineHealthResponse & {
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        return;
      }
      setData(json);
      setLastRefresh(new Date());
    } catch {
      setError("Could not load pipeline health.");
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [] as PipelineDealerRow[];
    const q = search.trim().toLowerCase();

    return data.dealers.filter((row) => {
      if (!cmsPlatformsMatch(row.website_platform, cmsPlatform)) {
        return false;
      }

      if (cmsRunFilter === "ran" && !row.master_synced_today) return false;
      if (cmsRunFilter === "not_ran" && row.master_synced_today) return false;

      if (q) {
        const hay = [
          row.dealer_name,
          row.client_id,
          row.website_platform ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [data, search, cmsPlatform, cmsRunFilter]);

  const summary = data?.summary;
  const platforms = data?.website_platforms ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 text-black">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-sm font-bold text-white">
            V2
          </div>
          <h2 className="text-xl font-semibold text-black">
            Data Pipeline Health
          </h2>
        </div>
        {/* Config → Hoot inventory → GA4 traffic → Master DB. Bridged on ga4_customer_id = client_id. */}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-black">
              As-of date
            </span>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-black">CMS</span>
            <select
              value={cmsPlatform}
              onChange={(e) => setCmsPlatform(e.target.value)}
              className="min-w-[12rem] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black"
            >
              <option value="">All CMS platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-black">
              Master DB sync
            </span>
            <select
              value={cmsRunFilter}
              onChange={(e) => setCmsRunFilter(e.target.value as CmsRunFilter)}
              className="min-w-[12rem] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black"
            >
              <option value="all">All dealers</option>
              <option value="ran">Ran today (synced)</option>
              <option value="not_ran">Has not run today</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-black">
              Search
            </span>
            <input
              type="search"
              placeholder="Dealer or client id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[14rem] rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Apply"}
          </button>
          {lastRefresh ? (
            <span className="pb-2 text-xs text-zinc-600">
              Updated {format(lastRefresh, "HH:mm:ss")}
            </span>
          ) : null}
        </div>
      </section>

      {summary ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Active dealers"
            value={summary.total_active_dealers}
            sub="smart_hoot_config · is_active"
          />
          <MetricCard
            label="Master DB sync"
            value={summary.master_db_sync_today}
            total={summary.total_active_dealers}
            sub="master_last_synced is today"
            accent="ring-1 ring-emerald-200"
          />
          <MetricCard
            label="Has not synced today"
            value={summary.pipeline_failures}
            total={summary.total_active_dealers}
            sub="Master DB sync not run today"
            accent="ring-1 ring-red-200"
          />
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-6 w-1 shrink-0 rounded bg-red-600"
              aria-hidden
            />
            <h3 className="text-sm font-semibold text-black">
              Dealer pipeline
              {data ? (
                <span className="ml-2 font-normal text-zinc-600">
                  · {formatInt(filtered.length)} shown
                  {filtered.length !== data.dealers.length
                    ? ` (${formatInt(data.dealers.length)} total)`
                    : ""}
                </span>
              ) : null}
            </h3>
          </div>
          {data ? (
            <span className="text-xs text-zinc-600">
              Checking {data.as_of_date}
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[1000px] border-collapse border border-zinc-900 text-left text-sm">
            <thead>
              <tr className="bg-zinc-900 text-white">
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide">
                  Dealer name
                </th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide">
                  CMS platform
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                  Bridge
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                  Hoot inventory
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                  GA4 traffic
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                  Master DB sync
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-600">
                    <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />{" "}
                    Loading pipeline status…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-600">
                    No dealers match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={dealerRowKey(row)}
                    className={`border-t border-zinc-200 odd:bg-white even:bg-zinc-50/50 ${
                      row.master_synced_today ? "" : "bg-red-50/40"
                    }`}
                  >
                    <td className="px-3 py-2.5 font-medium text-black">
                      {row.dealer_name}
                      <p className="mt-0.5 text-[11px] font-normal text-zinc-500">
                        {row.client_id}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-black">
                      {row.website_platform}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StatusBadge
                        status={bridgeStatus(row)}
                        hint={
                          row.bridge_ok
                            ? "In smart_hoot_config and smart_ga4_config"
                            : "Missing GA4 config bridge"
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <StatusBadge
                          status={hootStatus(row)}
                          hint={`${formatInt(row.hoot_inventory_count)} URLs`}
                        />
                        <span className="text-[11px] tabular-nums text-zinc-600">
                          {formatInt(row.hoot_inventory_count)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <StatusBadge
                          status={ga4Status(row)}
                          hint={`${formatInt(row.ga4_traffic_count)} rows`}
                        />
                        <span className="text-[11px] tabular-nums text-zinc-600">
                          {formatInt(row.ga4_traffic_count)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <StatusBadge
                          status={masterSyncStatus(row)}
                          hint={`master_last_synced: ${formatTs(row.master_last_synced)}`}
                        />
                        <span className="max-w-[8rem] truncate text-[10px] text-zinc-500">
                          {formatTs(row.master_last_synced)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-600">
          <span className="inline-flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <IconCheck className="h-3 w-3" />
              </span>
              OK
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-900">
                <IconAlert className="h-3 w-3" />
              </span>
              Warning
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-800">
                <IconX className="h-3 w-3" />
              </span>
              Failed
            </span>
          </span>
        </div>
      </section>
    </div>
  );
}
