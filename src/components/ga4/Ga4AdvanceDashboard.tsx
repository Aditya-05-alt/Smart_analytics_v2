"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  parse,
  startOfDay,
} from "date-fns";
import type { SmartMasterDbRow } from "@/types/smart-master-db";
import { Ga4DateRangePicker } from "./Ga4DateRangePicker";

const TABS = [
  "Page details",
  "VDP Daily",
  "VDPxChannel",
  "VDPxGoogle",
  "By make",
  "By model",
  "By RV type",
  "By condition",
] as const;

export type Ga4Metric = {
  id: string;
  label: string;
  value: string;
  sub?: string;
};

export type Ga4ChartPoint = { date: Date; value: number };

/** Card definitions — values are reset to 0 when there is no data. */
const TEMPLATE_BASIC_METRICS: Ga4Metric[] = [
  { id: "m1", label: "ALL PAGE-TYPE VIEWS", value: "0" },
  { id: "m2", label: "VDP NEW + USED (PAGE TYPES)", value: "0" },
  { id: "m3", label: "VDP NEW VIEWS", value: "0" },
  { id: "m4", label: "VDP USED VIEWS", value: "0" },
  { id: "m5", label: "SRP VIEWS", value: "0" },
  { id: "m6", label: "HOME VIEWS", value: "0" },
];

const TEMPLATE_ADVANCED_METRICS: Ga4Metric[] = [
  ...TEMPLATE_BASIC_METRICS,
  { id: "m7", label: "TOP MAKE (VDP REPORT)", value: "0", sub: "—" },
  { id: "m8", label: "TOP MODEL (VDP REPORT)", value: "0", sub: "—" },
  { id: "m9", label: "TOP CHANNEL (VDP)", value: "0", sub: "—" },
  {
    id: "m10",
    label: "TOP GOOGLE ADS CAMPAIGN (VDP)",
    value: "0",
    sub: "—",
  },
  { id: "m11", label: "TOP RV TYPE (VDP)", value: "0", sub: "—" },
  {
    id: "m12",
    label: "AVG DAILY VDP (NEW+USED PAGE TYPES)",
    value: "0",
  },
];

export type Ga4AdvanceDashboardProps = {
  /** Active GA4 configs: `ga4_property_id` joins to `smart_master_db`. */
  clientConfigs?: {
    account_name: string;
    client_id: string;
    ga4_property_id: string;
  }[];
};

function formatInt(n: number) {
  return n.toLocaleString("en-US");
}

/** `smart_master_db.vdp_page` (boolean or PostgREST string); falls back to legacy `vpd_page`. */
function readVdpPage(r: SmartMasterDbRow): boolean | null {
  const raw: unknown = r.vdp_page ?? r.vpd_page;
  if (raw === true || raw === "true" || raw === "t") return true;
  if (raw === false || raw === "false" || raw === "f") return false;
  return null;
}

type PageDetailVdpKey = "available" | "unavailable";

const PAGE_DETAIL_CHILD_PAGE_SIZE = 25;

function pagePathHref(row: SmartMasterDbRow): string | null {
  const loc = row.page_location?.trim();
  if (loc && /^https?:\/\//i.test(loc)) return loc;
  const path = row.page_path?.trim();
  if (path && /^https?:\/\//i.test(path)) return path;
  if (path?.startsWith("/")) return path;
  return null;
}

type DashboardDateRange = { from?: Date; to?: Date };

/** One point per sampled day, all values 0 — swap for real series from your API. */
export function buildZeroVdpSeries(from: Date, to: Date): Ga4ChartPoint[] {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (end < start) return [];
  const days = eachDayOfInterval({ start, end });
  const maxPoints = 45;
  const step = Math.max(1, Math.ceil(days.length / maxPoints));
  return days
    .filter((_, i) => i % step === 0)
    .map((d) => ({ date: d, value: 0 }));
}

function VdpChart({ points }: { points: Ga4ChartPoint[] }) {
  const w = 640;
  const h = 220;
  const pad = { top: 16, right: 16, bottom: 40, left: 44 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const maxVal = Math.max(...points.map((p) => p.value), 0);
  const scaleMax = maxVal <= 0 ? 1 : maxVal;
  const roughStep = Math.max(1, Math.ceil(scaleMax / 5 / 50) * 50);
  const maxY = Math.max(roughStep * 5, Math.ceil(scaleMax / roughStep) * roughStep);
  const tickCount = 6;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxY * i) / tickCount),
  );

  const n = points.length;
  if (n === 0) {
    return (
      <p className="py-8 text-center text-sm text-black">
        No chart data for this range.
      </p>
    );
  }

  const mapped = points.map((p, i) => {
    const x = pad.left + (innerW * i) / Math.max(1, n - 1);
    const y = pad.top + innerH * (1 - (p.value - 0) / (maxY || 1));
    return { ...p, x, y, xLabel: format(p.date, "M/d") };
  });

  const d = mapped
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-auto w-full max-w-full text-black"
      role="img"
      aria-label="Daily VDP views"
    >
      {yTicks.map((tick) => {
        const y = pad.top + innerH * (1 - tick / (maxY || 1));
        return (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={y}
              y2={y}
              className="stroke-zinc-200"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-black text-[10px]"
            >
              {tick}
            </text>
          </g>
        );
      })}
      {mapped.map((p) => (
        <circle
          key={p.date.toISOString()}
          cx={p.x}
          cy={p.y}
          r={5}
          className="fill-white stroke-blue-600"
          strokeWidth={2}
        />
      ))}
      <path
        d={d}
        fill="none"
        className="stroke-blue-600"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {mapped.map((p) => (
        <text
          key={`x-${p.date.toISOString()}`}
          x={p.x}
          y={h - 10}
          textAnchor="middle"
          className="fill-black text-[11px]"
        >
          {p.xLabel}
        </text>
      ))}
    </svg>
  );
}

export function Ga4AdvanceDashboard({
  clientConfigs = [],
}: Ga4AdvanceDashboardProps) {
  const configs = useMemo(() => clientConfigs, [clientConfigs]);

  const [view, setView] = useState<"basic" | "advanced">("advanced");
  const [selectedGa4PropertyId, setSelectedGa4PropertyId] = useState("");
  const [appliedGa4PropertyId, setAppliedGa4PropertyId] = useState("");

  const [dateRange, setDateRange] = useState<DashboardDateRange | undefined>({
    from: new Date(2026, 2, 1),
    to: new Date(2026, 2, 31),
  });
  const [rangePreset, setRangePreset] = useState("custom");
  const [compareOn, setCompareOn] = useState(false);
  const [compareFrom, setCompareFrom] = useState("");
  const [compareTo, setCompareTo] = useState("");

  const [basicMetrics] = useState<Ga4Metric[]>(() => [
    ...TEMPLATE_BASIC_METRICS,
  ]);
  const [advancedMetrics] = useState<Ga4Metric[]>(() => [
    ...TEMPLATE_ADVANCED_METRICS,
  ]);

  const [chartSeries, setChartSeries] = useState<Ga4ChartPoint[]>([]);

  const [chartOpen, setChartOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>(
    "Page details",
  );
  const [query, setQuery] = useState("");

  const [masterRows, setMasterRows] = useState<SmartMasterDbRow[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);

  useEffect(() => {
    if (configs.length === 0) {
      setSelectedGa4PropertyId("");
      setAppliedGa4PropertyId("");
      return;
    }
    setSelectedGa4PropertyId((prev) =>
      prev && configs.some((c) => c.ga4_property_id === prev)
        ? prev
        : configs[0]!.ga4_property_id,
    );
    setAppliedGa4PropertyId((prev) =>
      prev && configs.some((c) => c.ga4_property_id === prev)
        ? prev
        : configs[0]!.ga4_property_id,
    );
  }, [configs]);

  useEffect(() => {
    if (!appliedGa4PropertyId || !dateRange?.from || !dateRange.to) {
      setMasterRows([]);
      setMasterLoading(false);
      setMasterError(null);
      return;
    }

    const dateFrom = format(startOfDay(dateRange.from), "yyyy-MM-dd");
    const dateTo = format(startOfDay(dateRange.to), "yyyy-MM-dd");
    let cancelled = false;
    setMasterLoading(true);
    setMasterError(null);

    const qs = new URLSearchParams({
      ga4_property_id: appliedGa4PropertyId,
      date_from: dateFrom,
      date_to: dateTo,
    });
    const appliedCfg = configs.find(
      (c) => c.ga4_property_id === appliedGa4PropertyId,
    );
    if (appliedCfg?.client_id) {
      qs.set("client_id", appliedCfg.client_id);
    }

    fetch(`/api/dashboard/smart-master?${qs.toString()}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const body = (await res.json()) as {
          rows?: SmartMasterDbRow[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error ?? res.statusText);
        }
        if (!cancelled) {
          setMasterRows(body.rows ?? []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMasterRows([]);
          setMasterError(
            err instanceof Error ? err.message : "Failed to load rows",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setMasterLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appliedGa4PropertyId, configs, dateRange?.from, dateRange?.to]);

  const refreshChart = useCallback((range: DashboardDateRange | undefined) => {
    if (range?.from && range.to) {
      setChartSeries(buildZeroVdpSeries(range.from, range.to));
    } else {
      setChartSeries([]);
    }
  }, []);

  useEffect(() => {
    refreshChart(dateRange);
  }, [dateRange, refreshChart]);

  const metricsToShow = view === "basic" ? basicMetrics : advancedMetrics;

  const appliedAccountLabel = useMemo(
    () =>
      configs.find((c) => c.ga4_property_id === appliedGa4PropertyId)
        ?.account_name ?? "",
    [configs, appliedGa4PropertyId],
  );

  const filteredMasterRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return masterRows;
    return masterRows.filter((r) => {
      const vdpLabel =
        readVdpPage(r) === true ? "vdp_available" : "vdp not available";
      const hay = [
        r.report_date,
        r.page_path,
        r.page_title,
        r.channel,
        r.type_,
        vdpLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [masterRows, query]);

  const groupedPageDetails = useMemo(() => {
    const map = new Map<PageDetailVdpKey, SmartMasterDbRow[]>();
    for (const r of filteredMasterRows) {
      const k: PageDetailVdpKey =
        readVdpPage(r) === true ? "available" : "unavailable";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    const order: PageDetailVdpKey[] = ["available", "unavailable"];
    return order
      .filter((k) => (map.get(k)?.length ?? 0) > 0)
      .map((k) => {
        const rows = map.get(k)!;
        const sorted = [...rows].sort(
          (a, b) => (b.views ?? 0) - (a.views ?? 0),
        );
        const totalViews = sorted.reduce((s, r) => s + (r.views ?? 0), 0);
        const label =
          k === "available" ? "VDP_available" : "VDP not available";
        return { key: k, label, rows: sorted, totalViews };
      });
  }, [filteredMasterRows]);

  const [expandedGroups, setExpandedGroups] = useState<Set<PageDetailVdpKey>>(
    () => new Set(),
  );

  const [vdpGroupChildPage, setVdpGroupChildPage] = useState<
    Record<PageDetailVdpKey, number>
  >({
    available: 0,
    unavailable: 0,
  });

  useEffect(() => {
    setExpandedGroups(new Set(groupedPageDetails.map((g) => g.key)));
  }, [groupedPageDetails]);

  useEffect(() => {
    setVdpGroupChildPage({ available: 0, unavailable: 0 });
  }, [filteredMasterRows]);

  function toggleVpdGroup(key: PageDetailVdpKey) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const chartDayCount =
    dateRange?.from && dateRange.to
      ? differenceInCalendarDays(
          startOfDay(dateRange.to),
          startOfDay(dateRange.from),
        ) + 1
      : chartSeries.length;

  function applyProperty() {
    setAppliedGa4PropertyId(selectedGa4PropertyId);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 text-black">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-sm font-bold text-white">
            GA4
          </div>
          <h2 className="text-xl font-semibold text-black">GA4 Analytics</h2>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-1 lg:mr-4">
            <span className="text-xs font-medium uppercase text-black">
              Client
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedGa4PropertyId}
                onChange={(e) => setSelectedGa4PropertyId(e.target.value)}
                disabled={configs.length === 0}
                className="min-w-[12rem] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                aria-label="Client"
              >
                {configs.length === 0 ? (
                  <option value="">No clients loaded</option>
                ) : (
                  configs.map((c) => (
                    <option key={c.ga4_property_id} value={c.ga4_property_id}>
                      {c.account_name}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={applyProperty}
                disabled={configs.length === 0 || !selectedGa4PropertyId}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:justify-end">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-medium uppercase text-black">
                Date range
              </span>
              <Ga4DateRangePicker
                preset={rangePreset}
                dateFrom={
                  dateRange?.from
                    ? format(startOfDay(dateRange.from), "yyyy-MM-dd")
                    : ""
                }
                dateTo={
                  dateRange?.to
                    ? format(startOfDay(dateRange.to), "yyyy-MM-dd")
                    : ""
                }
                compareOn={compareOn}
                compareFrom={compareFrom}
                compareTo={compareTo}
                onApply={(p) => {
                  setRangePreset(p.preset);
                  setCompareOn(p.compareOn);
                  setCompareFrom(p.compareFrom);
                  setCompareTo(p.compareTo);
                  if (p.dateFrom && p.dateTo) {
                    setDateRange({
                      from: parse(p.dateFrom, "yyyy-MM-dd", new Date()),
                      to: parse(p.dateTo, "yyyy-MM-dd", new Date()),
                    });
                  }
                }}
              />
            </div>
            <div className="flex rounded-lg border border-zinc-300 p-0.5">
              <button
                type="button"
                onClick={() => setView("basic")}
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  view === "basic"
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-black hover:bg-zinc-50"
                }`}
              >
                Basic
              </button>
              <button
                type="button"
                onClick={() => setView("advanced")}
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  view === "advanced"
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-black hover:bg-zinc-50"
                }`}
              >
                Advanced
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metricsToShow.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-[11px] font-semibold uppercase leading-snug text-black">
              {m.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-black">
              {m.value}
            </p>
            {m.sub ? (
              <p className="mt-1 text-sm text-black">{m.sub}</p>
            ) : null}
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block h-6 w-1 shrink-0 rounded bg-red-600"
              aria-hidden
            />
            <h3 className="text-sm font-semibold text-black">
              Daily VDP views · {chartSeries.length} days
              {appliedAccountLabel ? (
                <span className="ml-2 font-normal text-zinc-600">
                  · {appliedAccountLabel}
                </span>
              ) : null}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setChartOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-zinc-50"
          >
            {chartOpen ? "Hide chart" : "Show chart"}
            <span aria-hidden>{chartOpen ? "▲" : "▼"}</span>
          </button>
        </div>
        {chartOpen ? (
          <div className="p-4">
            <div className="rounded-lg border border-zinc-100 bg-white p-2">
              <VdpChart points={chartSeries} />
            </div>
            <p className="mt-3 text-center text-sm text-black">
              <span className="mr-2 inline-block h-2 w-4 border-2 border-blue-600 align-middle" />
              VDP views ({chartDayCount} calendar days in range)
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 pt-3">
          <div className="flex flex-wrap gap-x-1 gap-y-0">
            {TABS.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "font-bold text-red-600"
                      : "text-black hover:text-zinc-800"
                  }`}
                >
                  {tab}
                  {isActive ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 bg-red-600" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-b border-zinc-100 px-4 py-4 sm:flex-row sm:items-end sm:justify-end">
          <div className="w-full sm:max-w-xs">
            <label
              htmlFor="ga4-search"
              className="mb-1 block text-xs font-medium text-black"
            >
              Search
            </label>
            <input
              id="ga4-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search page type or path"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black outline-none ring-red-600/20 focus:ring-2"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-50"
            >
              <span aria-hidden>▦</span>
              Columns
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-50"
            >
              <span aria-hidden>↓</span>
              CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          {activeTab === "Page details" ? (
            <table className="w-full min-w-[720px] border-collapse border border-zinc-900 text-left text-sm">
              <thead>
                <tr className="bg-zinc-900 text-white">
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide">
                    Page path
                  </th>
                  <th className="w-[9.5rem] whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                    VDP
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                    <span className="inline-flex items-center gap-1">
                      Page views
                      <span aria-hidden>▼</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {masterLoading ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-zinc-600"
                    >
                      Loading smart_master_db…
                    </td>
                  </tr>
                ) : masterError ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-red-600"
                    >
                      {masterError}
                    </td>
                  </tr>
                ) : groupedPageDetails.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-black"
                    >
                      {masterRows.length === 0 ? (
                        <p className="text-sm text-zinc-700">
                          No rows in <span className="font-medium">smart_master_db</span>{" "}
                          for this account and <span className="font-medium">report_date</span>{" "}
                          range.
                        </p>
                      ) : (
                        "No rows match your search."
                      )}
                    </td>
                  </tr>
                ) : (
                  groupedPageDetails.map((group) => {
                    const open = expandedGroups.has(group.key);
                    const childPage = vdpGroupChildPage[group.key] ?? 0;
                    const totalChild = group.rows.length;
                    const pageSize = PAGE_DETAIL_CHILD_PAGE_SIZE;
                    const pageCount = Math.max(
                      1,
                      Math.ceil(totalChild / pageSize),
                    );
                    const safePage = Math.min(childPage, pageCount - 1);
                    const start = safePage * pageSize;
                    const pageRows = open
                      ? group.rows.slice(start, start + pageSize)
                      : [];
                    return (
                      <Fragment key={group.key}>
                        <tr className="border-b border-zinc-200 bg-zinc-100">
                          <td className="px-2 py-2.5 font-semibold text-black">
                            <button
                              type="button"
                              onClick={() => toggleVpdGroup(group.key)}
                              className="inline-flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-zinc-200/80"
                              aria-expanded={open}
                            >
                              <span className="w-4 shrink-0 text-center text-zinc-600">
                                {open ? "▼" : "▶"}
                              </span>
                              <span>{group.label}</span>
                            </button>
                          </td>
                          <td className="bg-zinc-100 text-center text-xs font-medium text-zinc-500">
                            —
                          </td>
                          <td className="whitespace-nowrap bg-zinc-100 px-3 py-2.5 text-right tabular-nums font-semibold text-black">
                            {formatInt(group.totalViews)}
                          </td>
                        </tr>
                        {open
                          ? pageRows.map((row, idx) => {
                              const href = pagePathHref(row);
                              const pathText = row.page_path ?? "—";
                              const globalIdx = start + idx;
                              const vdpAvail = readVdpPage(row) === true;
                              return (
                                <tr
                                  key={row.id}
                                  className={`border-b border-zinc-100 ${
                                    globalIdx % 2 === 0
                                      ? "bg-white"
                                      : "bg-zinc-50/80"
                                  } hover:bg-zinc-100/80`}
                                >
                                  <td className="px-3 py-2 align-top text-black">
                                    <div className="flex gap-2 pl-6">
                                      <span
                                        className="mt-0.5 shrink-0 text-zinc-400"
                                        aria-hidden
                                      >
                                        └
                                      </span>
                                      <span className="min-w-0 break-all text-[13px]">
                                        {href ? (
                                          <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-700 underline decoration-blue-600/40 underline-offset-2 hover:text-blue-900"
                                            title={pathText}
                                          >
                                            {pathText}
                                          </a>
                                        ) : (
                                          <span title={pathText}>{pathText}</span>
                                        )}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-center align-top">
                                    {vdpAvail ? (
                                      <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                                        VDP_available
                                      </span>
                                    ) : (
                                      <span className="inline-block rounded bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-800">
                                        Not available
                                      </span>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-black">
                                    {formatInt(row.views ?? 0)}
                                  </td>
                                </tr>
                              );
                            })
                          : null}
                        {open && totalChild > pageSize ? (
                          <tr
                            key={`${group.key}-pager`}
                            className="border-b border-zinc-100 bg-zinc-50/90"
                          >
                            <td colSpan={3} className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2 pl-6 text-xs text-zinc-700">
                                <span className="tabular-nums">
                                  Showing {totalChild === 0 ? 0 : start + 1}–
                                  {Math.min(start + pageRows.length, totalChild)}{" "}
                                  of {formatInt(totalChild)}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={safePage <= 0}
                                    onClick={() =>
                                      setVdpGroupChildPage((p) => ({
                                        ...p,
                                        [group.key]: Math.max(
                                          0,
                                          (p[group.key] ?? 0) - 1,
                                        ),
                                      }))
                                    }
                                    className="rounded border border-zinc-300 bg-white px-2.5 py-1 font-medium text-black hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Previous
                                  </button>
                                  <span className="tabular-nums text-zinc-600">
                                    Page {safePage + 1} of {pageCount}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={safePage >= pageCount - 1}
                                    onClick={() =>
                                      setVdpGroupChildPage((p) => ({
                                        ...p,
                                        [group.key]: Math.min(
                                          pageCount - 1,
                                          (p[group.key] ?? 0) + 1,
                                        ),
                                      }))
                                    }
                                    className="rounded border border-zinc-300 bg-white px-2.5 py-1 font-medium text-black hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <p className="py-12 text-center text-sm text-black">
              {activeTab} — wire this tab to Supabase when you are ready.
            </p>
          )}
        </div>
      </section>

    </div>
  );
}
