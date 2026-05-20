"use client";

import { format, parseISO } from "date-fns";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { VdpLogicInput, VdpLogicRow, VdpLogicsListResponse } from "@/types/vdp-logic";

const PAGE_SIZE = 25;

type PaginatedSlice<T> = {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  start: number;
};

const EMPTY_FORM: VdpLogicInput = {
  dealer_name: "",
  dealer_id: "",
  website_url: "",
  cms: "",
  data_source: "",
  hoot_link: "",
  scrap_link: "",
  vdp_logic: "",
  srp_logic: "",
  home_page_logic: "",
  others: "",
};

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

const TABLE_SCROLL_CLASS =
  "overflow-x-auto overscroll-x-contain scroll-smooth rounded-lg border border-zinc-200 bg-zinc-50/50";

const TH_CLASS =
  "px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-normal";

const TD_CLASS =
  "align-top border-t border-r border-zinc-100 px-3 py-2.5 overflow-hidden last:border-r-0";

function CellText({
  value,
  mono = false,
  lines = 3,
}: {
  value: string | null;
  mono?: boolean;
  lines?: 2 | 3 | 4;
}) {
  if (!value) {
    return <span className="text-zinc-400">—</span>;
  }
  const clamp =
    lines === 2 ? "line-clamp-2" : lines === 4 ? "line-clamp-4" : "line-clamp-3";
  return (
    <div
      title={value}
      className={`min-w-0 break-words ${clamp} ${mono ? "font-mono text-[11px] leading-relaxed text-zinc-800" : "text-sm text-black"}`}
    >
      {value}
    </div>
  );
}

function paginateRows<T>(items: T[], pageIndex: number): PaginatedSlice<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const start = page * PAGE_SIZE;
  return {
    rows: items.slice(start, start + PAGE_SIZE),
    page,
    pageCount,
    total,
    start,
  };
}

function rowToForm(row: VdpLogicRow): VdpLogicInput {
  return {
    dealer_name: row.dealer_name,
    dealer_id: row.dealer_id ?? "",
    website_url: row.website_url ?? "",
    cms: row.cms ?? "",
    data_source: row.data_source ?? "",
    hoot_link: row.hoot_link ?? "",
    scrap_link: row.scrap_link ?? "",
    vdp_logic: row.vdp_logic ?? "",
    srp_logic: row.srp_logic ?? "",
    home_page_logic: row.home_page_logic ?? "",
    others: row.others ?? "",
  };
}

function TablePager({
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
  if (total <= PAGE_SIZE) return null;
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

function VdpLogicFormModal({
  title,
  form,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  title: string;
  form: VdpLogicInput;
  saving: boolean;
  error: string | null;
  onChange: (next: VdpLogicInput) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const field = (
    label: string,
    key: keyof VdpLogicInput,
    opts?: { required?: boolean; textarea?: boolean; rows?: number },
  ) => {
    const value = form[key] ?? "";
    const common =
      "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black";
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase text-black">
          {label}
          {opts?.required ? " *" : ""}
        </span>
        {opts?.textarea ? (
          <textarea
            rows={opts.rows ?? 3}
            value={value}
            onChange={(e) => onChange({ ...form, [key]: e.target.value })}
            className={`${common} resize-y font-mono text-xs leading-relaxed`}
          />
        ) : (
          <input
            type="text"
            required={opts?.required}
            value={value}
            onChange={(e) => onChange({ ...form, [key]: e.target.value })}
            className={common}
          />
        )}
      </label>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vdp-logic-modal-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
          <h3 id="vdp-logic-modal-title" className="text-lg font-semibold text-black">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-black"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("Dealer name", "dealer_name", { required: true })}
            {field("Dealer ID", "dealer_id")}
            {field("Website URL", "website_url")}
            {field("CMS", "cms")}
            {field("Data source", "data_source")}
          </div>

          {field("Hoot link", "hoot_link", { textarea: true, rows: 2 })}
          {field("Scrap link", "scrap_link", { textarea: true, rows: 2 })}
          {field("VDP logic", "vdp_logic", { textarea: true, rows: 4 })}
          {field("SRP logic", "srp_logic", { textarea: true, rows: 3 })}
          {field("Home page logic", "home_page_logic", { textarea: true, rows: 2 })}
          {field("Others", "others", { textarea: true, rows: 2 })}

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function VdpLogicsDashboard() {
  const [data, setData] = useState<VdpLogicsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VdpLogicInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/dashboard/vdp-logics");
      const json = (await res.json()) as VdpLogicsListResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load VDP logics");
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      const hay = [
        row.dealer_name,
        row.dealer_id ?? "",
        row.website_url ?? "",
        row.cms ?? "",
        row.data_source ?? "",
        row.hoot_link ?? "",
        row.scrap_link ?? "",
        row.vdp_logic ?? "",
        row.srp_logic ?? "",
        row.home_page_logic ?? "",
        row.others ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search]);

  const pagination = useMemo(
    () => paginateRows(filtered, pageIndex),
    [filtered, pageIndex],
  );

  useEffect(() => {
    setPageIndex(0);
  }, [search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(row: VdpLogicRow) {
    setEditingId(row.id);
    setForm(rowToForm(row));
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const isEdit = editingId != null;
    const url = isEdit
      ? `/api/dashboard/vdp-logics/${editingId}`
      : "/api/dashboard/vdp-logics";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Save failed");
      }
      setModalOpen(false);
      setEditingId(null);
      setLoading(true);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: VdpLogicRow) {
    const ok = window.confirm(
      `Delete VDP logic for "${row.dealer_name}"? This cannot be undone.`,
    );
    if (!ok) return;

    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/dashboard/vdp-logics/${row.id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Delete failed");
      }
      setLoading(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 text-black">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-sm font-bold text-white">
            V2
          </div>
          <div>
            <h2 className="text-xl font-semibold text-black">VDP Logics</h2>
            <p className="mt-0.5 text-sm text-zinc-600">
              Dealer VDP, SRP, and home page rules stored in{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
                public.smart_vdp_logic
              </code>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-black">
                Search
              </span>
              <input
                type="search"
                placeholder="Dealer, CMS, URL, logic…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-[16rem] rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black"
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
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add VDP logic
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-6 w-1 shrink-0 rounded bg-red-600"
              aria-hidden
            />
            <h3 className="text-sm font-semibold text-black">
              VDP logic configs
              {data ? (
                <span className="ml-2 font-normal text-zinc-600">
                  · {formatInt(filtered.length)} shown
                  {filtered.length !== data.total
                    ? ` (${formatInt(data.total)} total)`
                    : ""}
                </span>
              ) : null}
            </h3>
          </div>
          {data ? (
            <span className="text-xs text-zinc-600">
              Source: {data.source} · Updated {formatTs(data.fetched_at)}
            </span>
          ) : null}
        </div>

        <div className="p-4">
          <p className="mb-2 text-xs text-zinc-500">
            Scroll horizontally to view all columns →
          </p>
          <div className={TABLE_SCROLL_CLASS}>
            <table className="table-fixed w-[2180px] border-collapse border border-zinc-900 text-left text-sm">
              <colgroup>
                <col style={{ width: 140 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 260 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 135 }} />
                <col style={{ width: 120 }} />
              </colgroup>
              <thead>
                <tr className="bg-zinc-900 text-white">
                  <th className={TH_CLASS}>Dealer</th>
                  <th className={TH_CLASS}>Dealer ID</th>
                  <th className={TH_CLASS}>Website</th>
                  <th className={TH_CLASS}>CMS</th>
                  <th className={TH_CLASS}>Data source</th>
                  <th className={TH_CLASS}>Hoot link</th>
                  <th className={TH_CLASS}>Scrap link</th>
                  <th className={TH_CLASS}>VDP logic</th>
                  <th className={TH_CLASS}>SRP logic</th>
                  <th className={TH_CLASS}>Home page</th>
                  <th className={TH_CLASS}>Others</th>
                  <th className={TH_CLASS}>Updated</th>
                  <th className={`${TH_CLASS} text-center`}>Actions</th>
                </tr>
              </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-zinc-600">
                    <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />{" "}
                    Loading VDP logics…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : pagination.rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-zinc-600">
                    {search.trim()
                      ? "No records match your search."
                      : "No VDP logic configs yet. Add one to get started."}
                  </td>
                </tr>
              ) : (
                pagination.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="odd:bg-white even:bg-zinc-50/50"
                  >
                    <td className={`${TD_CLASS} font-medium text-black`}>
                      <CellText value={row.dealer_name} lines={2} />
                    </td>
                    <td className={TD_CLASS}>
                      <CellText value={row.dealer_id} mono lines={2} />
                    </td>
                    <td className={TD_CLASS}>
                      {row.website_url ? (
                        <a
                          href={row.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={row.website_url}
                          className="block min-w-0 break-all text-sm text-blue-700 line-clamp-2 hover:underline"
                        >
                          {row.website_url}
                        </a>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className={TD_CLASS}>
                      <CellText value={row.cms} lines={2} />
                    </td>
                    <td className={TD_CLASS}>
                      <CellText value={row.data_source} lines={2} />
                    </td>
                    <td className={TD_CLASS}>
                      <CellText value={row.hoot_link} mono lines={3} />
                    </td>
                    <td className={TD_CLASS}>
                      <CellText value={row.scrap_link} mono lines={3} />
                    </td>
                    <td className={TD_CLASS}>
                      <CellText value={row.vdp_logic} mono lines={4} />
                    </td>
                    <td className={TD_CLASS}>
                      <CellText value={row.srp_logic} mono lines={3} />
                    </td>
                    <td className={TD_CLASS}>
                      <CellText value={row.home_page_logic} mono lines={3} />
                    </td>
                    <td className={TD_CLASS}>
                      <CellText value={row.others} mono lines={3} />
                    </td>
                    <td className={`${TD_CLASS} text-[11px] text-zinc-600`}>
                      <span className="block whitespace-normal break-words">
                        {formatTs(row.updated_at)}
                      </span>
                    </td>
                    <td className={`${TD_CLASS} text-center`}>
                      <div className="flex flex-col items-stretch justify-center gap-1 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-black hover:bg-zinc-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          disabled={deletingId === row.id}
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingId === row.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>

          <TablePager
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            start={pagination.start}
            visibleCount={pagination.rows.length}
            onPageChange={setPageIndex}
          />
        </div>
      </section>

      {modalOpen ? (
        <VdpLogicFormModal
          title={editingId != null ? "Edit VDP logic" : "Add VDP logic"}
          form={form}
          saving={saving}
          error={formError}
          onChange={setForm}
          onClose={closeModal}
          onSubmit={(e) => void handleSubmit(e)}
        />
      ) : null}
    </div>
  );
}
