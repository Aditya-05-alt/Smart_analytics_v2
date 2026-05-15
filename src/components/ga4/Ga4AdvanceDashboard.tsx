"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  eachDayOfInterval,
  format,
  parse,
  startOfDay,
  startOfMonth,
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
  "By location",
] as const;

const VDP_DIMENSION_TABS = [
  "By make",
  "By model",
  "By RV type",
  "By condition",
  "By location",
] as const;

type VdpDimensionTab = (typeof VDP_DIMENSION_TABS)[number];

type VdpDimensionConfig = {
  tab: VdpDimensionTab;
  columnLabel: string;
  searchPlaceholder: string;
  emptyFieldName: string;
  getDimensionKey: (r: SmartMasterDbRow) => string;
};

const VDP_DIMENSION_CONFIGS: VdpDimensionConfig[] = [
  {
    tab: "By make",
    columnLabel: "Make",
    searchPlaceholder: "Search by make…",
    emptyFieldName: "make",
    getDimensionKey: (r) => (r.make ?? "").trim() || "(not set)",
  },
  {
    tab: "By model",
    columnLabel: "Model",
    searchPlaceholder: "Search by model…",
    emptyFieldName: "model",
    getDimensionKey: (r) => (r.model ?? "").trim() || "(not set)",
  },
  {
    tab: "By RV type",
    columnLabel: "RV type",
    searchPlaceholder: "Search by RV type…",
    emptyFieldName: "RV type",
    getDimensionKey: (r) => (r.type_ ?? "").trim() || "(not set)",
  },
  {
    tab: "By condition",
    columnLabel: "Condition",
    searchPlaceholder: "Search by condition…",
    emptyFieldName: "condition",
    getDimensionKey: rowConditionKey,
  },
  {
    tab: "By location",
    columnLabel: "Location",
    searchPlaceholder: "Search by location…",
    emptyFieldName: "location",
    getDimensionKey: (r) => (r.location ?? "").trim() || "(not set)",
  },
];

function isVdpDimensionTab(tab: string): tab is VdpDimensionTab {
  return (VDP_DIMENSION_TABS as readonly string[]).includes(tab);
}

export type Ga4Metric = {
  id: string;
  label: string;
  value: string;
  sub?: string;
};

export type Ga4ChartPoint = {
  date: Date;
  value: number;
  /** Category label when the x-axis is not calendar dates. */
  label?: string;
};

type ChartVariant = "line" | "bar";

type ChartSeries = {
  id: string;
  label: string;
  color: string;
  points: Ga4ChartPoint[];
};

type TabChartData = {
  points: Ga4ChartPoint[];
  title: string;
  legend: string;
  xAxisLabel: string;
  yAxisLabel: string;
};

const CHART_MAX_ROWS = 24;

type Ga4ClientConfig = NonNullable<Ga4AdvanceDashboardProps["clientConfigs"]>[number];

type SortDir = "asc" | "desc";
type TableSortState = { key: string; dir: SortDir } | null;

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

function formatChartAxisValue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${n % 1_000 === 0 ? n / 1_000 : (n / 1_000).toFixed(1)}K`;
  return String(n);
}

function compareSortValues(a: string | number, b: string | number, dir: SortDir): number {
  if (typeof a === "number" && typeof b === "number") {
    return dir === "asc" ? a - b : b - a;
  }
  const cmp = String(a).localeCompare(String(b), undefined, { numeric: true });
  return dir === "asc" ? cmp : -cmp;
}

function applyTableSort<T>(
  rows: T[],
  sort: TableSortState,
  accessors: Record<string, (row: T) => string | number>,
): T[] {
  if (!sort) return rows;
  const accessor = accessors[sort.key];
  if (!accessor) return rows;
  return [...rows].sort((a, b) =>
    compareSortValues(accessor(a), accessor(b), sort.dir),
  );
}

function rowsToChartPoints(
  rows: { label: string; views: number }[],
): Ga4ChartPoint[] {
  return rows.slice(0, CHART_MAX_ROWS).map((row, i) => ({
    date: new Date(2000, 0, i + 1),
    label: row.label,
    value: row.views,
  }));
}

function ClientSearchSelect({
  configs,
  value,
  onChange,
  disabled,
}: {
  configs: Ga4ClientConfig[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = configs.find((c) => c.ga4_property_id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return configs;
    return configs.filter(
      (c) =>
        c.account_name.toLowerCase().includes(q) ||
        c.ga4_property_id.toLowerCase().includes(q),
    );
  }, [configs, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-[14rem]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="flex w-full min-w-[14rem] items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-black hover:bg-zinc-50 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">
          {configs.length === 0
            ? "No clients loaded"
            : (selected?.account_name ?? "Select client")}
        </span>
        <span className="shrink-0 text-zinc-500" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && configs.length > 0 ? (
        <div className="absolute z-30 mt-1 w-full min-w-[16rem] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="border-b border-zinc-100 p-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients…"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              autoFocus
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-500">No matches</li>
            ) : (
              filtered.map((c) => {
                const isSelected = c.ga4_property_id === value;
                return (
                  <li key={c.ga4_property_id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(c.ga4_property_id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 ${
                        isSelected ? "bg-zinc-100 font-semibold text-black" : "text-black"
                      }`}
                    >
                      {c.account_name}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SortableTh({
  label,
  columnKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  columnKey: string;
  sort: TableSortState;
  onSort: (key: string) => void;
  align?: "left" | "right";
}) {
  const active = sort?.key === columnKey;
  return (
    <th
      className={`px-3 py-3 text-xs font-semibold uppercase tracking-wide text-white ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1.5 hover:opacity-90 ${
          align === "right" ? "ml-auto" : ""
        }`}
      >
        <span>{label}</span>
        <span className="inline-flex flex-col leading-none" aria-hidden>
          <span
            className={`text-[8px] ${
              active && sort?.dir === "asc" ? "text-white" : "text-zinc-400"
            }`}
          >
            ▲
          </span>
          <span
            className={`text-[8px] -mt-0.5 ${
              active && sort?.dir === "desc" ? "text-white" : "text-zinc-400"
            }`}
          >
            ▼
          </span>
        </span>
      </button>
    </th>
  );
}

/** `smart_master_db.vdp_page` (boolean or PostgREST string); falls back to legacy `vpd_page`. */
function readVdpPage(r: SmartMasterDbRow): boolean | null {
  const raw: unknown = r.vdp_page ?? r.vpd_page;
  if (raw === true || raw === "true" || raw === "t") return true;
  if (raw === false || raw === "false" || raw === "f") return false;
  return null;
}

function isGoogleTraffic(r: SmartMasterDbRow): boolean {
  const sm = (r.source_medium ?? "").toLowerCase();
  const src = (r.source ?? "").toLowerCase();
  return sm.includes("google") || src === "google";
}

function formatSourceMediumLabel(r: SmartMasterDbRow): string {
  const sm = r.source_medium?.trim();
  if (sm) return sm;
  const src = (r.source ?? "").trim();
  const med = (r.medium ?? "").trim();
  if (src && med) return `${src} / ${med}`;
  if (src) return src;
  return "—";
}

/** Normalize `report_date` to `yyyy-MM-dd` for grouping and range checks. */
function reportDateKey(r: SmartMasterDbRow): string | null {
  const raw = r.report_date?.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return format(startOfDay(d), "yyyy-MM-dd");
}

/** Single source of truth for footer totals: VDP rows in the selected date range. */
function sumViewsInRange(
  rows: SmartMasterDbRow[],
  dateRange: DashboardDateRange | undefined,
  match: (r: SmartMasterDbRow) => boolean,
): number {
  const from = dateRange?.from != null ? startOfDay(dateRange.from) : null;
  const to = dateRange?.to != null ? startOfDay(dateRange.to) : null;
  const fromKey = from ? format(from, "yyyy-MM-dd") : null;
  const toKey = to ? format(to, "yyyy-MM-dd") : null;

  let sum = 0;
  for (const r of rows) {
    if (!match(r)) continue;
    const day = reportDateKey(r);
    if (!day) continue;
    if (fromKey && toKey && (day < fromKey || day > toKey)) continue;
    sum += r.views ?? 0;
  }
  return sum;
}

type PageDetailVdpKey = "available" | "unavailable";

const PAGE_DETAIL_CHILD_PAGE_SIZE = 25;
const VDP_TABLE_PAGE_SIZE = 10;

type PaginatedSlice<T> = {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  start: number;
};

function paginateRows<T>(items: T[], pageIndex: number): PaginatedSlice<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / VDP_TABLE_PAGE_SIZE));
  const page = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const start = page * VDP_TABLE_PAGE_SIZE;
  return {
    rows: items.slice(start, start + VDP_TABLE_PAGE_SIZE),
    page,
    pageCount,
    total,
    start,
  };
}

function DataTableLoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10">
        <div className="flex flex-col items-center justify-center gap-2 text-sm text-zinc-600">
          <span
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"
            aria-hidden
          />
          <span>Loading…</span>
        </div>
      </td>
    </tr>
  );
}

function DataTableTotalRow({
  labelColSpan,
  total,
}: {
  labelColSpan: number;
  total: number;
}) {
  return (
    <tr className="border-t border-zinc-900 bg-zinc-50/90 font-semibold text-black">
      <td colSpan={labelColSpan} className="px-3 py-2 text-left">
        Total
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
        {formatInt(total)}
      </td>
    </tr>
  );
}

function VdpTablePager({
  page,
  pageCount,
  total,
  start,
  visibleCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  start: number;
  visibleCount: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= VDP_TABLE_PAGE_SIZE) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-700">
      <span className="tabular-nums">
        Showing {total === 0 ? 0 : start + 1}–{start + visibleCount} of{" "}
        {formatInt(total)}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          className="rounded border border-zinc-300 bg-white px-2.5 py-1 font-medium text-black hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="tabular-nums text-zinc-600">
          Page {page + 1} of {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          className="rounded border border-zinc-300 bg-white px-2.5 py-1 font-medium text-black hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function pagePathHref(row: SmartMasterDbRow): string | null {
  const loc = row.page_location?.trim();
  if (loc && /^https?:\/\//i.test(loc)) return loc;
  const path = row.page_path?.trim();
  if (path && /^https?:\/\//i.test(path)) return path;
  if (path?.startsWith("/")) return path;
  return null;
}

function rowUrlLabel(row: SmartMasterDbRow): string {
  const path = row.page_path?.trim();
  if (path) return path;
  const loc = row.page_location?.trim();
  if (loc) return loc;
  const hoot = row.hoot_url?.trim();
  if (hoot) return hoot;
  return "—";
}

/** Metric cards from screenshot — disabled for now. */
const SHOW_SUMMARY_METRIC_CARDS = false;

type DimensionGroup = {
  label: string;
  totalViews: number;
};

type DashboardDateRange = { from?: Date; to?: Date };

/** New / used style condition from path or title when no dedicated column exists. */
function rowConditionKey(r: SmartMasterDbRow): string {
  const path = `${r.page_path ?? ""} ${r.page_location ?? ""}`.toLowerCase();
  if (
    /(^|\/)(new)(-|\/|$|\?)/.test(path) ||
    path.includes("new-inventory") ||
    path.includes("/new-")
  ) {
    return "New";
  }
  if (
    /(^|\/)(used|pre-owned|preowned)(-|\/|$|\?)/.test(path) ||
    path.includes("used-inventory") ||
    path.includes("/used-")
  ) {
    return "Used";
  }
  if (path.includes("certified") || path.includes("cpo")) return "Certified";
  const title = (r.page_title ?? "").toLowerCase();
  if (/\bnew\b/.test(title)) return "New";
  if (/\bused\b/.test(title)) return "Used";
  return "(not set)";
}

function groupVdpByDimension(
  masterRows: SmartMasterDbRow[],
  dateRange: DashboardDateRange | undefined,
  getDimensionKey: (r: SmartMasterDbRow) => string,
): DimensionGroup[] {
  const from = dateRange?.from != null ? startOfDay(dateRange.from) : null;
  const to = dateRange?.to != null ? startOfDay(dateRange.to) : null;
  const fromKey = from ? format(from, "yyyy-MM-dd") : null;
  const toKey = to ? format(to, "yyyy-MM-dd") : null;

  const byDimension = new Map<string, number>();

  for (const r of masterRows) {
    if (readVdpPage(r) !== true) continue;
    const day = reportDateKey(r);
    if (!day) continue;
    if (fromKey && toKey && (day < fromKey || day > toKey)) continue;

    const label = getDimensionKey(r);
    const v = r.views ?? 0;
    byDimension.set(label, (byDimension.get(label) ?? 0) + v);
  }

  return [...byDimension.entries()]
    .map(([label, totalViews]) => ({ label, totalViews }))
    .sort((a, b) => b.totalViews - a.totalViews);
}

function VdpDimensionTable({
  config,
  groups,
  allGroups,
  pagination,
  masterLoading,
  masterError,
  onPageChange,
  totalViews,
  tableSort,
  onSort,
}: {
  config: VdpDimensionConfig;
  groups: DimensionGroup[];
  allGroups: DimensionGroup[];
  pagination: PaginatedSlice<DimensionGroup>;
  masterLoading: boolean;
  masterError: string | null;
  onPageChange: (page: number) => void;
  totalViews: number;
  tableSort: TableSortState;
  onSort: (key: string) => void;
}) {
  return (
    <div>
      <table className="w-full min-w-[520px] border-collapse border border-zinc-900 text-left text-sm">
        <thead>
          <tr className="bg-zinc-900 text-white">
            <SortableTh
              label={config.columnLabel}
              columnKey="label"
              sort={tableSort}
              onSort={onSort}
            />
            <SortableTh
              label="Page views"
              columnKey="views"
              sort={tableSort}
              onSort={onSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {masterLoading ? (
            <DataTableLoadingRow colSpan={2} />
          ) : masterError ? (
            <tr>
              <td colSpan={2} className="px-4 py-10 text-center text-red-600">
                {masterError}
              </td>
            </tr>
          ) : groups.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-4 py-10 text-center text-black">
                {allGroups.length === 0 ? (
                  <p className="text-sm text-zinc-700">
                    No VDP rows with a{" "}
                    <span className="font-medium">{config.emptyFieldName}</span> in
                    this <span className="font-medium">report_date</span> range.
                  </p>
                ) : (
                  `No ${config.columnLabel.toLowerCase()} values match your search.`
                )}
              </td>
            </tr>
          ) : (
            pagination.rows.map((group, idx) => (
              <tr
                key={group.label}
                className={`border-b border-zinc-100 ${
                  idx % 2 === 0 ? "bg-white" : "bg-zinc-50/80"
                } hover:bg-zinc-100/80`}
              >
                <td className="px-3 py-2 font-medium text-black">{group.label}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-black">
                  {formatInt(group.totalViews)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {!masterLoading && !masterError && allGroups.length > 0 ? (
          <tfoot>
            <DataTableTotalRow labelColSpan={1} total={totalViews} />
          </tfoot>
        ) : null}
      </table>
      <VdpTablePager
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        start={pagination.start}
        visibleCount={pagination.rows.length}
        onPageChange={onPageChange}
      />
    </div>
  );
}


function getThisMonthRange(): Required<DashboardDateRange> {
  const today = startOfDay(new Date());
  return { from: startOfMonth(today), to: today };
}

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

function chartXLabel(p: Ga4ChartPoint): string {
  if (p.label) {
    return p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label;
  }
  return format(p.date, "M/d");
}

/** Smooth cubic curve through chart points (reference-style line). */
function smoothLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0]!.x} ${pts[0]!.y}`;
  if (pts.length === 2) {
    return `M ${pts[0]!.x} ${pts[0]!.y} L ${pts[1]!.x} ${pts[1]!.y}`;
  }

  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function VdpChart({
  series,
  variant = "line",
  xAxisLabel = "",
  yAxisLabel = "Views",
}: {
  series: ChartSeries[];
  variant?: ChartVariant;
  xAxisLabel?: string;
  yAxisLabel?: string;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const w = 960;
  const h = 380;
  const pad = { top: 28, right: 28, bottom: 72, left: 56 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const legendH = 26;

  const pointCount = Math.max(...series.map((s) => s.points.length), 0);
  if (pointCount === 0) {
    return (
      <p className="py-16 text-center text-sm text-zinc-600">
        No chart data for this tab. Apply filters or pick a tab with table rows.
      </p>
    );
  }

  const maxVal = Math.max(
    ...series.flatMap((s) => s.points.map((p) => p.value)),
    0,
  );
  const scaleMax = maxVal <= 0 ? 1 : maxVal;
  const roughStep = Math.max(1, Math.ceil(scaleMax / 7 / 500) * 500);
  const maxY = Math.max(roughStep * 7, Math.ceil(scaleMax / roughStep) * roughStep);
  const tickCount = 7;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxY * i) / tickCount),
  );

  const n = pointCount;
  const xAt = (i: number) =>
    n <= 1 ? pad.left + innerW / 2 : pad.left + (innerW * i) / (n - 1);
  const yAt = (value: number) => pad.top + innerH * (1 - value / (maxY || 1));

  const mappedSeries = series.map((s) => ({
    ...s,
    mapped: s.points.map((p, i) => {
      const slotW = innerW / n;
      const cx = pad.left + slotW * (i + 0.5);
      const xLine = xAt(i);
      const y = yAt(p.value);
      const barW = Math.min((slotW / Math.max(series.length, 1)) * 0.72, 36);
      const displayLabel = p.label ?? chartXLabel(p);
      return {
        ...p,
        cx,
        xLine,
        y,
        yBase: pad.top + innerH,
        barW,
        displayLabel,
        xLabel: chartXLabel(p),
        key: `${s.id}-${p.label ?? p.date.toISOString()}`,
      };
    }),
  }));

  const xLabelsFrom = mappedSeries[0]?.mapped ?? [];
  const flatMapped = mappedSeries.flatMap((s) =>
    s.mapped.map((p) => ({ ...p, seriesColor: s.color, seriesLabel: s.label })),
  );
  const activePoint =
    flatMapped.find((p) => p.key === activeKey) ?? flatMapped[0] ?? null;

  const tooltipW = 168;
  const tooltipH = 52;
  const tooltipX = activePoint
    ? Math.min(Math.max(activePoint.xLine - tooltipW / 2, pad.left), w - pad.right - tooltipW)
    : 0;
  const tooltipY = activePoint
    ? Math.max(activePoint.y - tooltipH - 14, pad.top)
    : 0;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mx-auto h-[min(420px,55vh)] w-full max-w-6xl text-black"
      role="img"
      aria-label="Analytics chart"
      onClick={() => setActiveKey(null)}
    >
      {yTicks.map((tick) => {
        const y = yAt(tick);
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
              className="fill-zinc-600 text-[11px]"
            >
              {formatChartAxisValue(tick)}
            </text>
          </g>
        );
      })}

      {variant === "bar"
        ? mappedSeries.map((s, seriesIdx) =>
            s.mapped.map((p) => {
              const offset =
                (seriesIdx - (mappedSeries.length - 1) / 2) * (p.barW + 2);
              const isActive = activeKey === p.key;
              const bx = p.cx + offset - p.barW / 2;
              return (
                <g key={p.key}>
                  <rect
                    x={bx - 4}
                    y={p.y - 4}
                    width={p.barW + 8}
                    height={Math.max(0, p.yBase - p.y) + 8}
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveKey(p.key);
                    }}
                  />
                  <rect
                    x={bx}
                    y={p.y}
                    width={p.barW}
                    height={Math.max(0, p.yBase - p.y)}
                    fill={s.color}
                    stroke={isActive ? "#1f2937" : "none"}
                    strokeWidth={isActive ? 2 : 0}
                    rx={3}
                    className="pointer-events-none"
                  />
                </g>
              );
            }),
          )
        : mappedSeries.map((s) => {
            const linePts = s.mapped.map((p) => ({ x: p.xLine, y: p.y }));
            return (
              <g key={s.id}>
                <path
                  d={smoothLinePath(linePts)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {s.mapped.map((p) => {
                  const isActive = activeKey === p.key;
                  return (
                    <g key={p.key}>
                      <circle
                        cx={p.xLine}
                        cy={p.y}
                        r={14}
                        fill="transparent"
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveKey(p.key);
                        }}
                      />
                      <circle
                        cx={p.xLine}
                        cy={p.y}
                        r={isActive ? 8 : 6}
                        fill={s.color}
                        stroke="#fff"
                        strokeWidth={2}
                        className="pointer-events-none"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}

      {activePoint ? (
        <g
          pointerEvents="none"
          transform={`translate(${tooltipX}, ${tooltipY})`}
        >
          <rect
            width={tooltipW}
            height={tooltipH}
            rx={8}
            fill="#1f2937"
            opacity={0.95}
          />
          <text x={12} y={20} className="fill-white text-[11px] font-medium">
            {activePoint.displayLabel.length > 22
              ? `${activePoint.displayLabel.slice(0, 21)}…`
              : activePoint.displayLabel}
          </text>
          <text x={12} y={38} className="fill-white text-[13px] font-semibold">
            {formatInt(activePoint.value)} views
          </text>
        </g>
      ) : null}

      {xLabelsFrom.map((p, i) =>
        n > 20 && i % 2 !== 0 ? null : (
          <text
            key={`x-${p.key}`}
            x={variant === "bar" ? p.cx : p.xLine}
            y={h - legendH - 8}
            textAnchor="middle"
            className="fill-zinc-700 text-[11px]"
          >
            {p.xLabel}
          </text>
        ),
      )}

      {xAxisLabel ? (
        <text
          x={pad.left + innerW / 2}
          y={h - 6}
          textAnchor="middle"
          className="fill-zinc-500 text-[11px] font-medium"
        >
          {xAxisLabel}
        </text>
      ) : null}

      <text
        x={14}
        y={pad.top + innerH / 2}
        textAnchor="middle"
        transform={`rotate(-90, 14, ${pad.top + innerH / 2})`}
        className="fill-zinc-500 text-[11px] font-medium"
      >
        {yAxisLabel}
      </text>

      <g transform={`translate(${w / 2 - (series.length * 88) / 2}, ${h - legendH + 10})`}>
        {series.map((s, i) => (
          <g key={s.id} transform={`translate(${i * 88}, 0)`}>
            <circle cx={6} cy={0} r={5} fill={s.color} />
            <text x={16} y={4} className="fill-zinc-800 text-[12px]">
              {s.label}
            </text>
          </g>
        ))}
      </g>
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

  const [dateRange, setDateRange] = useState<DashboardDateRange | undefined>(
    getThisMonthRange,
  );
  const [rangePreset, setRangePreset] = useState("this_month");
  const [compareOn, setCompareOn] = useState(false);
  const [compareFrom, setCompareFrom] = useState("");
  const [compareTo, setCompareTo] = useState("");

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>(
    "Page details",
  );
  const [query, setQuery] = useState("");
  const [vdpDailySearch, setVdpDailySearch] = useState("");
  const [vdpGoogleChannelFilter, setVdpGoogleChannelFilter] = useState("");
  const [vdpTablePage, setVdpTablePage] = useState(0);
  const [dimensionSearch, setDimensionSearch] = useState("");
  const [chartVariant, setChartVariant] = useState<ChartVariant>("line");
  const [tableSort, setTableSort] = useState<TableSortState>(null);

  const [masterRows, setMasterRows] = useState<SmartMasterDbRow[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [applyStatus, setApplyStatus] = useState<
    "idle" | "processing" | "updated"
  >("idle");

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
  }, [appliedGa4PropertyId, configs, dateRange?.from, dateRange?.to, dataRefreshKey]);

  useEffect(() => {
    if (applyStatus !== "processing") return;
    if (masterLoading) return;
    if (masterError) {
      setApplyStatus("idle");
      return;
    }
    setApplyStatus("updated");
  }, [applyStatus, masterLoading, masterError]);

  useEffect(() => {
    if (applyStatus !== "updated") return;
    const timeoutId = window.setTimeout(() => setApplyStatus("idle"), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [applyStatus]);

  useEffect(() => {
    if (rangePreset !== "this_month") return;

    const syncThisMonth = () => {
      const next = getThisMonthRange();
      setDateRange((prev) => {
        if (!prev?.from || !prev.to) return next;
        const prevFrom = format(startOfDay(prev.from), "yyyy-MM-dd");
        const prevTo = format(startOfDay(prev.to), "yyyy-MM-dd");
        const nextFrom = format(next.from, "yyyy-MM-dd");
        const nextTo = format(next.to, "yyyy-MM-dd");
        if (prevFrom === nextFrom && prevTo === nextTo) return prev;
        return next;
      });
    };

    syncThisMonth();
    const intervalId = window.setInterval(syncThisMonth, 60 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncThisMonth();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [rangePreset]);

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

  const vdpByChannel = useMemo(() => {
    const from = dateRange?.from != null ? startOfDay(dateRange.from) : null;
    const to = dateRange?.to != null ? startOfDay(dateRange.to) : null;

    const fromKey = from ? format(from, "yyyy-MM-dd") : null;
    const toKey = to ? format(to, "yyyy-MM-dd") : null;

    const byChannel = new Map<string, number>();

    for (const r of masterRows) {
      if (readVdpPage(r) !== true) continue;
      const day = reportDateKey(r);
      if (!day) continue;
      if (fromKey && toKey && (day < fromKey || day > toKey)) continue;

      const channelRaw = (r.channel ?? "").trim();
      const channel = channelRaw || "Unassigned";
      const v = r.views ?? 0;
      byChannel.set(channel, (byChannel.get(channel) ?? 0) + v);
    }

    const rows = [...byChannel.entries()].map(([channel, views]) => ({
      channel,
      views,
    }));

    rows.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    return rows;
  }, [masterRows, dateRange?.from, dateRange?.to]);

  const overallVdpTotalViews = useMemo(
    () => sumViewsInRange(masterRows, dateRange, (r) => readVdpPage(r) === true),
    [masterRows, dateRange?.from, dateRange?.to],
  );

  const vdpByGoogle = useMemo(() => {
    const from = dateRange?.from != null ? startOfDay(dateRange.from) : null;
    const to = dateRange?.to != null ? startOfDay(dateRange.to) : null;
    const fromKey = from ? format(from, "yyyy-MM-dd") : null;
    const toKey = to ? format(to, "yyyy-MM-dd") : null;

    const byKey = new Map<
      string,
      { campaign: string; channel: string; source_medium: string; views: number }
    >();

    for (const r of masterRows) {
      if (readVdpPage(r) !== true) continue;
      if (!isGoogleTraffic(r)) continue;
      const day = reportDateKey(r);
      if (!day) continue;
      if (fromKey && toKey && (day < fromKey || day > toKey)) continue;

      const campaign = (r.session_campaign ?? "").trim() || "(not set)";
      const channel = (r.channel ?? "").trim() || "Unassigned";
      const source_medium = formatSourceMediumLabel(r);
      const key = `${campaign}\0${channel}\0${source_medium}`;
      const v = r.views ?? 0;
      const prev = byKey.get(key);
      if (prev) {
        prev.views += v;
      } else {
        byKey.set(key, { campaign, channel, source_medium, views: v });
      }
    }

    const rows = [...byKey.values()];
    rows.sort((a, b) => b.views - a.views);
    return rows;
  }, [masterRows, dateRange?.from, dateRange?.to]);

  const vdpGoogleChannelOptions = useMemo(() => {
    const channels = new Set(vdpByGoogle.map((r) => r.channel));
    return [...channels].sort((a, b) => a.localeCompare(b));
  }, [vdpByGoogle]);

  const vdpGoogleFiltered = useMemo(() => {
    if (!vdpGoogleChannelFilter) return vdpByGoogle;
    return vdpByGoogle.filter((r) => r.channel === vdpGoogleChannelFilter);
  }, [vdpByGoogle, vdpGoogleChannelFilter]);

  useEffect(() => {
    setVdpGoogleChannelFilter("");
  }, [appliedGa4PropertyId, dateRange?.from, dateRange?.to]);

  useEffect(() => {
    setVdpTablePage(0);
  }, [
    activeTab,
    vdpDailySearch,
    dimensionSearch,
    vdpGoogleChannelFilter,
    appliedGa4PropertyId,
    dateRange?.from,
    dateRange?.to,
    masterRows,
  ]);

  const vdpDailyByDate = useMemo(() => {
    const from = dateRange?.from != null ? startOfDay(dateRange.from) : null;
    const to = dateRange?.to != null ? startOfDay(dateRange.to) : null;

    const byDay = new Map<string, number>();
    for (const r of masterRows) {
      if (readVdpPage(r) !== true) continue;
      const day = reportDateKey(r);
      if (!day) continue;
      if (from && to) {
        const fromKey = format(from, "yyyy-MM-dd");
        const toKey = format(to, "yyyy-MM-dd");
        if (day < fromKey || day > toKey) continue;
      }
      const v = r.views ?? 0;
      byDay.set(day, (byDay.get(day) ?? 0) + v);
    }

    if (from && to) {
      if (from.getTime() > to.getTime()) return [];
      const days = eachDayOfInterval({ start: from, end: to });
      return days
        .map((d) => {
          const report_date = format(d, "yyyy-MM-dd");
          return { report_date, views: byDay.get(report_date) ?? 0 };
        })
        .sort((a, b) => b.report_date.localeCompare(a.report_date));
    }

    return [...byDay.entries()]
      .map(([report_date, views]) => ({ report_date, views }))
      .sort((a, b) => b.report_date.localeCompare(a.report_date));
  }, [masterRows, dateRange?.from, dateRange?.to]);

  const vdpDailyFiltered = useMemo(() => {
    const q = vdpDailySearch.trim().toLowerCase();
    if (!q) return vdpDailyByDate;
    return vdpDailyByDate.filter((row) => row.report_date.toLowerCase().includes(q));
  }, [vdpDailyByDate, vdpDailySearch]);

  const handleTableSort = (key: string) => {
    setTableSort((prev) => {
      if (prev?.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
    setVdpTablePage(0);
  };

  useEffect(() => {
    setTableSort(null);
  }, [activeTab, appliedGa4PropertyId, dateRange?.from, dateRange?.to]);

  const vdpDailySorted = useMemo(
    () =>
      applyTableSort(vdpDailyFiltered, tableSort, {
        date: (r) => r.report_date,
        views: (r) => r.views,
      }),
    [vdpDailyFiltered, tableSort],
  );

  const vdpChannelSorted = useMemo(
    () =>
      applyTableSort(vdpByChannel, tableSort, {
        channel: (r) => r.channel,
        views: (r) => r.views ?? 0,
      }),
    [vdpByChannel, tableSort],
  );

  const vdpGoogleSorted = useMemo(
    () =>
      applyTableSort(vdpGoogleFiltered, tableSort, {
        campaign: (r) => r.campaign,
        channel: (r) => r.channel,
        source_medium: (r) => r.source_medium,
        views: (r) => r.views,
      }),
    [vdpGoogleFiltered, tableSort],
  );

  const vdpDailyPagination = useMemo(
    () => paginateRows(vdpDailySorted, vdpTablePage),
    [vdpDailySorted, vdpTablePage],
  );

  const vdpChannelPagination = useMemo(
    () => paginateRows(vdpChannelSorted, vdpTablePage),
    [vdpChannelSorted, vdpTablePage],
  );

  const vdpGooglePagination = useMemo(
    () => paginateRows(vdpGoogleSorted, vdpTablePage),
    [vdpGoogleSorted, vdpTablePage],
  );

  const activeDimensionConfig = useMemo(
    () => VDP_DIMENSION_CONFIGS.find((c) => c.tab === activeTab),
    [activeTab],
  );

  const groupedByActiveDimension = useMemo(() => {
    if (!activeDimensionConfig) return [];
    return groupVdpByDimension(
      masterRows,
      dateRange,
      activeDimensionConfig.getDimensionKey,
    );
  }, [masterRows, dateRange, activeDimensionConfig]);

  const groupedByActiveDimensionFiltered = useMemo(() => {
    const q = dimensionSearch.trim().toLowerCase();
    if (!q) return groupedByActiveDimension;
    return groupedByActiveDimension.filter((g) =>
      g.label.toLowerCase().includes(q),
    );
  }, [groupedByActiveDimension, dimensionSearch]);

  const dimensionGroupsSorted = useMemo(
    () =>
      applyTableSort(groupedByActiveDimensionFiltered, tableSort, {
        label: (g) => g.label,
        views: (g) => g.totalViews,
      }),
    [groupedByActiveDimensionFiltered, tableSort],
  );

  const dimensionPagination = useMemo(
    () => paginateRows(dimensionGroupsSorted, vdpTablePage),
    [dimensionGroupsSorted, vdpTablePage],
  );

  useEffect(() => {
    if (isVdpDimensionTab(activeTab)) setDimensionSearch("");
  }, [activeTab]);

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

  const groupedPageDetailsSorted = useMemo(() => {
    const groups = applyTableSort(groupedPageDetails, tableSort, {
      path: (g) => g.label,
      views: (g) => g.totalViews,
    });
    if (!tableSort || (tableSort.key !== "path" && tableSort.key !== "views")) {
      return groups;
    }
    return groups.map((g) => ({
      ...g,
      rows: applyTableSort(g.rows, tableSort, {
        path: (r) => r.page_path ?? "",
        views: (r) => r.views ?? 0,
      }),
    }));
  }, [groupedPageDetails, tableSort]);

  /** Chart mirrors the active tab table (same rows, filters, and sort). */
  const tabChartData = useMemo((): TabChartData => {
    switch (activeTab) {
      case "Page details":
        return {
          points: rowsToChartPoints(
            groupedPageDetailsSorted.map((g) => ({
              label: g.label,
              views: g.totalViews,
            })),
          ),
          title: "Page views — table chart",
          legend: "Page views",
          xAxisLabel: "Page group",
          yAxisLabel: "Views",
        };
      case "VDP Daily":
        return {
          points: rowsToChartPoints(
            vdpDailySorted.map((r) => ({
              label: r.report_date,
              views: r.views,
            })),
          ),
          title: "VDP Daily — table chart",
          legend: "VDP views",
          xAxisLabel: "Date",
          yAxisLabel: "Views",
        };
      case "VDPxChannel":
        return {
          points: rowsToChartPoints(
            vdpChannelSorted.map((r) => ({
              label: r.channel,
              views: r.views ?? 0,
            })),
          ),
          title: "VDPxChannel — table chart",
          legend: "VDP views",
          xAxisLabel: "Channel",
          yAxisLabel: "Views",
        };
      case "VDPxGoogle":
        return {
          points: rowsToChartPoints(
            vdpGoogleSorted.map((r) => ({
              label:
                r.campaign && r.campaign !== "(not set)"
                  ? r.campaign
                  : `${r.channel} · ${r.source_medium}`,
              views: r.views,
            })),
          ),
          title: "VDPxGoogle — table chart",
          legend: "VDP views",
          xAxisLabel: "Campaign",
          yAxisLabel: "Views",
        };
      default:
        if (isVdpDimensionTab(activeTab) && activeDimensionConfig) {
          return {
            points: rowsToChartPoints(
              dimensionGroupsSorted.map((g) => ({
                label: g.label,
                views: g.totalViews,
              })),
            ),
            title: `${activeDimensionConfig.columnLabel} — table chart`,
            legend: "Page views",
            xAxisLabel: activeDimensionConfig.columnLabel,
            yAxisLabel: "Views",
          };
        }
        return {
          points: [],
          title: "Chart",
          legend: "Views",
          xAxisLabel: "",
          yAxisLabel: "Views",
        };
    }
  }, [
    activeTab,
    groupedPageDetailsSorted,
    vdpDailySorted,
    vdpChannelSorted,
    vdpGoogleSorted,
    dimensionGroupsSorted,
    activeDimensionConfig,
  ]);

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

  function applyProperty() {
    if (!selectedGa4PropertyId) return;
    setApplyStatus("processing");
    if (selectedGa4PropertyId === appliedGa4PropertyId) {
      setDataRefreshKey((k) => k + 1);
    } else {
      setAppliedGa4PropertyId(selectedGa4PropertyId);
    }
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
              <ClientSearchSelect
                configs={configs}
                value={selectedGa4PropertyId}
                onChange={setSelectedGa4PropertyId}
                disabled={configs.length === 0}
              />
              <button
                type="button"
                onClick={applyProperty}
                disabled={
                  configs.length === 0 ||
                  !selectedGa4PropertyId ||
                  applyStatus === "processing"
                }
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>
              {applyStatus === "processing" ? (
                <span
                  className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800"
                    aria-hidden
                  />
                  Live data processing
                </span>
              ) : applyStatus === "updated" ? (
                <span
                  className="text-sm font-semibold text-emerald-600"
                  role="status"
                  aria-live="polite"
                >
                  Updated
                </span>
              ) : null}
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
                disabled
                aria-disabled="true"
                tabIndex={-1}
                className="cursor-not-allowed rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-400 opacity-60"
                title="Basic view is not available yet"
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

      {SHOW_SUMMARY_METRIC_CARDS ? (
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[...TEMPLATE_ADVANCED_METRICS].map((m) => (
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
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block h-6 w-1 shrink-0 rounded bg-red-600"
              aria-hidden
            />
            <h3 className="text-sm font-semibold text-black">
              {tabChartData.title}
              {` · ${tabChartData.points.length} rows`}
              {appliedAccountLabel ? (
                <span className="ml-2 font-normal text-zinc-600">
                  · {appliedAccountLabel}
                </span>
              ) : null}
            </h3>
          </div>
          <div
            className="inline-flex rounded-lg border border-zinc-300 bg-zinc-50 p-0.5 text-sm"
            role="group"
            aria-label="Chart type"
          >
            <button
              type="button"
              onClick={() => setChartVariant("line")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                chartVariant === "line"
                  ? "bg-white text-black shadow-sm"
                  : "text-zinc-600 hover:text-black"
              }`}
            >
              Line
            </button>
            <button
              type="button"
              onClick={() => setChartVariant("bar")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                chartVariant === "bar"
                  ? "bg-white text-black shadow-sm"
                  : "text-zinc-600 hover:text-black"
              }`}
            >
              Bar
            </button>
          </div>
        </div>
        <div className="p-4">
          <div className="mx-auto w-full max-w-6xl rounded-xl border border-zinc-100 bg-gradient-to-b from-white to-zinc-50/80 p-4 shadow-inner">
            {masterLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-zinc-600">
                <span
                  className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"
                  aria-hidden
                />
                Loading chart…
              </div>
            ) : (
              <VdpChart
                series={[
                  {
                    id: "primary",
                    label: tabChartData.legend,
                    color: "#E53935",
                    points: tabChartData.points,
                  },
                ]}
                variant={chartVariant}
                xAxisLabel={tabChartData.xAxisLabel}
                yAxisLabel={tabChartData.yAxisLabel}
              />
            )}
          </div>
        </div>
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
            {activeTab === "Page details" ? (
              <>
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
              </>
            ) : activeTab === "VDP Daily" ? (
              <>
                <label
                  htmlFor="ga4-vdp-daily-search"
                  className="mb-1 block text-xs font-medium text-black"
                >
                  Search
                </label>
                <input
                  id="ga4-vdp-daily-search"
                  type="search"
                  value={vdpDailySearch}
                  onChange={(e) => setVdpDailySearch(e.target.value)}
                  placeholder="Search by date…"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black outline-none ring-red-600/20 focus:ring-2"
                />
              </>
            ) : isVdpDimensionTab(activeTab) && activeDimensionConfig ? (
              <>
                <label
                  htmlFor="ga4-dimension-search"
                  className="mb-1 block text-xs font-medium text-black"
                >
                  Search
                </label>
                <input
                  id="ga4-dimension-search"
                  type="search"
                  value={dimensionSearch}
                  onChange={(e) => setDimensionSearch(e.target.value)}
                  placeholder={activeDimensionConfig.searchPlaceholder}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black outline-none ring-red-600/20 focus:ring-2"
                />
              </>
            ) : activeTab === "VDPxGoogle" ? (
              <>
                <label
                  htmlFor="ga4-vdp-google-channel"
                  className="mb-1 block text-xs font-medium text-black"
                >
                  Filter by channel
                </label>
                <select
                  id="ga4-vdp-google-channel"
                  value={vdpGoogleChannelFilter}
                  onChange={(e) => setVdpGoogleChannelFilter(e.target.value)}
                  disabled={masterLoading || vdpGoogleChannelOptions.length === 0}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                >
                  <option value="">All channels</option>
                  {vdpGoogleChannelOptions.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-xs text-zinc-500">
                Search is available on Page details, VDP Daily, and dimension tabs.
              </p>
            )}
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
          {activeTab === "VDP Daily" ? (
            <div>
            <table className="w-full min-w-[360px] border-collapse border border-zinc-900 text-left text-sm">
              <thead>
                <tr className="bg-zinc-900 text-white">
                  <SortableTh
                    label="Date"
                    columnKey="date"
                    sort={tableSort}
                    onSort={handleTableSort}
                  />
                  <SortableTh
                    label="Page views"
                    columnKey="views"
                    sort={tableSort}
                    onSort={handleTableSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {masterLoading ? (
                  <DataTableLoadingRow colSpan={2} />
                ) : masterError ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-10 text-center text-red-600"
                    >
                      {masterError}
                    </td>
                  </tr>
                ) : vdpDailyFiltered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-10 text-center text-black"
                    >
                      {vdpDailyByDate.length === 0 ? (
                        <p className="text-sm text-zinc-700">
                          {dateRange?.from && dateRange.to ? (
                            <>
                              No days in this <span className="font-medium">report_date</span>{" "}
                              range (check that the start date is not after the end date).
                            </>
                          ) : (
                            <>
                              Pick a <span className="font-medium">report_date</span> range to
                              see daily rows.
                            </>
                          )}
                        </p>
                      ) : (
                        "No dates match your search."
                      )}
                    </td>
                  </tr>
                ) : (
                  <>
                    {vdpDailyPagination.rows.map((row, idx) => (
                      <tr
                        key={row.report_date}
                        className={`border-b border-zinc-100 ${
                          idx % 2 === 0 ? "bg-white" : "bg-zinc-50/80"
                        } hover:bg-zinc-100/80`}
                      >
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-black">
                          {row.report_date}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-black">
                          {formatInt(row.views)}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
              {!masterLoading && !masterError && vdpDailySorted.length > 0 ? (
                <tfoot>
                  <DataTableTotalRow
                    labelColSpan={1}
                    total={overallVdpTotalViews}
                  />
                </tfoot>
              ) : null}
            </table>
            <VdpTablePager
              page={vdpDailyPagination.page}
              pageCount={vdpDailyPagination.pageCount}
              total={vdpDailyPagination.total}
              start={vdpDailyPagination.start}
              visibleCount={vdpDailyPagination.rows.length}
              onPageChange={setVdpTablePage}
            />
            </div>
          ) : activeTab === "VDPxChannel" ? (
            <div>
            <table className="w-full min-w-[360px] border-collapse border border-zinc-900 text-left text-sm">
              <thead>
                <tr className="bg-zinc-900 text-white">
                  <SortableTh
                    label="Channel"
                    columnKey="channel"
                    sort={tableSort}
                    onSort={handleTableSort}
                  />
                  <SortableTh
                    label="VDP views"
                    columnKey="views"
                    sort={tableSort}
                    onSort={handleTableSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {masterLoading ? (
                  <DataTableLoadingRow colSpan={2} />
                ) : masterError ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-10 text-center text-red-600"
                    >
                      {masterError}
                    </td>
                  </tr>
                ) : vdpByChannel.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-10 text-center text-black"
                    >
                      {dateRange?.from && dateRange.to ? (
                        <p className="text-sm text-zinc-700">
                          No VDP rows (
                          <span className="font-medium">vdp_page</span> /
                          <span className="font-medium">vpd_page</span> = true)
                          for this{" "}
                          <span className="font-medium">report_date</span>{" "}
                          range.
                        </p>
                      ) : (
                        "Pick a report_date range to see channel rows."
                      )}
                    </td>
                  </tr>
                ) : (
                  <>
                    {vdpChannelPagination.rows.map((row, idx) => (
                      <tr
                        key={row.channel}
                        className={`border-b border-zinc-100 ${
                          idx % 2 === 0 ? "bg-white" : "bg-zinc-50/80"
                        } hover:bg-zinc-100/80`}
                      >
                        <td className="px-3 py-2 text-black">
                          {row.channel}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-black">
                          {formatInt(row.views ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
              {!masterLoading && !masterError && vdpByChannel.length > 0 ? (
                <tfoot>
                  <DataTableTotalRow
                    labelColSpan={1}
                    total={overallVdpTotalViews}
                  />
                </tfoot>
              ) : null}
            </table>
            <VdpTablePager
              page={vdpChannelPagination.page}
              pageCount={vdpChannelPagination.pageCount}
              total={vdpChannelPagination.total}
              start={vdpChannelPagination.start}
              visibleCount={vdpChannelPagination.rows.length}
              onPageChange={setVdpTablePage}
            />
            </div>
          ) : activeTab === "VDPxGoogle" ? (
            <div>
              <table className="w-full min-w-[640px] border-collapse border border-zinc-900 text-left text-sm">
              <thead>
                <tr className="bg-zinc-900 text-white">
                  <SortableTh
                    label="Campaign"
                    columnKey="campaign"
                    sort={tableSort}
                    onSort={handleTableSort}
                  />
                  <SortableTh
                    label="Channel"
                    columnKey="channel"
                    sort={tableSort}
                    onSort={handleTableSort}
                  />
                  <SortableTh
                    label="Source / medium"
                    columnKey="source_medium"
                    sort={tableSort}
                    onSort={handleTableSort}
                  />
                  <SortableTh
                    label="VDP views"
                    columnKey="views"
                    sort={tableSort}
                    onSort={handleTableSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {masterLoading ? (
                  <DataTableLoadingRow colSpan={4} />
                ) : masterError ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-red-600"
                    >
                      {masterError}
                    </td>
                  </tr>
                ) : vdpByGoogle.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-black"
                    >
                      {dateRange?.from && dateRange.to ? (
                        <p className="text-sm text-zinc-700">
                          No Google VDP rows (
                          <span className="font-medium">vdp_page</span> = true,
                          Google source/medium) for this{" "}
                          <span className="font-medium">report_date</span> range.
                        </p>
                      ) : (
                        "Pick a report_date range to see Google campaign rows."
                      )}
                    </td>
                  </tr>
                ) : vdpGoogleFiltered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-black"
                    >
                      No rows for this channel.
                    </td>
                  </tr>
                ) : (
                  <>
                    {vdpGooglePagination.rows.map((row, idx) => (
                      <tr
                        key={`${row.campaign}-${row.channel}-${row.source_medium}`}
                        className={`border-b border-zinc-100 ${
                          idx % 2 === 0 ? "bg-white" : "bg-zinc-50/80"
                        } hover:bg-zinc-100/80`}
                      >
                        <td className="px-3 py-2 text-black">{row.campaign}</td>
                        <td className="px-3 py-2 text-black">{row.channel}</td>
                        <td className="px-3 py-2 text-black">
                          {row.source_medium}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-black">
                          {formatInt(row.views)}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
              {!masterLoading && !masterError && vdpByGoogle.length > 0 ? (
                <tfoot>
                  <DataTableTotalRow
                    labelColSpan={3}
                    total={overallVdpTotalViews}
                  />
                </tfoot>
              ) : null}
              </table>
              <VdpTablePager
                page={vdpGooglePagination.page}
                pageCount={vdpGooglePagination.pageCount}
                total={vdpGooglePagination.total}
                start={vdpGooglePagination.start}
                visibleCount={vdpGooglePagination.rows.length}
                onPageChange={setVdpTablePage}
              />
            </div>
          ) : isVdpDimensionTab(activeTab) && activeDimensionConfig ? (
            <VdpDimensionTable
              config={activeDimensionConfig}
              groups={groupedByActiveDimensionFiltered}
              allGroups={groupedByActiveDimension}
              pagination={dimensionPagination}
              masterLoading={masterLoading}
              masterError={masterError}
              onPageChange={setVdpTablePage}
              totalViews={overallVdpTotalViews}
              tableSort={tableSort}
              onSort={handleTableSort}
            />
          ) : activeTab === "Page details" ? (
            <table className="w-full min-w-[480px] border-collapse border border-zinc-900 text-left text-sm">
              <thead>
                <tr className="bg-zinc-900 text-white">
                  <SortableTh
                    label="Page path"
                    columnKey="path"
                    sort={tableSort}
                    onSort={handleTableSort}
                  />
                  <SortableTh
                    label="Page views"
                    columnKey="views"
                    sort={tableSort}
                    onSort={handleTableSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {masterLoading ? (
                  <DataTableLoadingRow colSpan={2} />
                ) : masterError ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-10 text-center text-red-600"
                    >
                      {masterError}
                    </td>
                  </tr>
                ) : groupedPageDetailsSorted.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-10 text-center text-black"
                    >
                      {masterRows.length === 0 ? (
                        <p className="text-sm text-zinc-700">
                          No data for this account and{" "}
                          <span className="font-medium">report_date</span> range.
                        </p>
                      ) : (
                        "No rows match your search."
                      )}
                    </td>
                  </tr>
                ) : (
                  groupedPageDetailsSorted.map((group) => {
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
                          <td className="whitespace-nowrap bg-zinc-100 px-3 py-2.5 text-right tabular-nums font-semibold text-black">
                            {formatInt(group.totalViews)}
                          </td>
                        </tr>
                        {open
                          ? pageRows.map((row, idx) => {
                              const href = pagePathHref(row);
                              const pathText = row.page_path ?? "—";
                              const globalIdx = start + idx;
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
                            <td colSpan={2} className="px-3 py-2.5">
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
          ) : null}
        </div>
      </section>

    </div>
  );
}
