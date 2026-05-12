"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import "./ga4-date-range-picker.css";

const PRESETS = [
  { label: "All Data", key: "all" },
  { label: "2025", key: "2025" },
  { label: "Today", key: "today" },
  { label: "Yesterday", key: "yesterday" },
  { label: "Last 7 Days", key: "last7" },
  { label: "Last 14 Days", key: "last14" },
  { label: "Last 30 Days", key: "last30" },
  { label: "This Month", key: "this_month" },
  { label: "Last Month", key: "last_month" },
  { label: "Custom", key: "custom" },
] as const;

export type Ga4RangePresetKey = (typeof PRESETS)[number]["key"];

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function sameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function inRange(d: Date, start: Date, end: Date) {
  const t = d.getTime();
  const s = start.getTime();
  const e = end.getTime();
  return t >= Math.min(s, e) && t <= Math.max(s, e);
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatShort(d: Date | null) {
  if (!d) return "—";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function isoStr(d: Date | null) {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function previousPeriod(from: Date | null, to: Date | null) {
  if (!from || !to) return { from: null as Date | null, to: null as Date | null };
  const diff = Math.round((to.getTime() - from.getTime()) / 86400000);
  const pTo = addDays(from, -1);
  const pFrom = addDays(pTo, -diff);
  return { from: pFrom, to: pTo };
}

function startOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function resolvePreset(key: string): { from: Date; to: Date } | null {
  const today = startOfDayLocal(new Date());
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "last14":
      return { from: addDays(today, -13), to: today };
    case "last30":
      return { from: addDays(today, -29), to: today };
    case "this_month":
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: today,
      };
    case "last_month": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: first, to: last };
    }
    case "all":
      return { from: new Date(2020, 0, 1), to: today };
    case "2025":
      return { from: new Date(2025, 0, 1), to: new Date(2025, 11, 31) };
    default:
      return null;
  }
}

function presetLabel(key: string) {
  const p = PRESETS.find((pr) => pr.key === key);
  return p ? p.label : "Custom";
}

type SelectMode =
  | "primary-from"
  | "primary-to"
  | "compare-from"
  | "compare-to";

type Draft = {
  preset: string;
  from: Date | null;
  to: Date | null;
  compare: boolean;
  compFrom: Date | null;
  compTo: Date | null;
};

type PickerState = {
  draft: Draft;
  selectMode: SelectMode;
  leftMonth: Date;
  rightMonth: Date;
};

type PickerAction =
  | {
      type: "RESET";
      preset: string;
      dateFrom: string;
      dateTo: string;
      compareOn: boolean;
      compareFrom: string;
      compareTo: string;
    }
  | { type: "PRESET"; key: string }
  | { type: "DAY_CLICK"; day: Date }
  | { type: "COMPARE_TOGGLE"; checked: boolean }
  | { type: "NAV_LEFT"; dir: number }
  | { type: "NAV_RIGHT"; dir: number };

function buildInitialState(
  preset: string,
  dateFrom: string,
  dateTo: string,
  compareOn: boolean,
  compareFrom: string,
  compareTo: string,
): PickerState {
  const f = parseIsoDate(dateFrom);
  const t = parseIsoDate(dateTo);
  const base = f ?? new Date();
  return {
    draft: {
      preset: preset || "last30",
      from: f,
      to: t,
      compare: compareOn,
      compFrom: parseIsoDate(compareFrom),
      compTo: parseIsoDate(compareTo),
    },
    selectMode: "primary-from",
    leftMonth: new Date(base.getFullYear(), base.getMonth(), 1),
    rightMonth: new Date(base.getFullYear(), base.getMonth() + 1, 1),
  };
}

function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case "RESET":
      return buildInitialState(
        action.preset,
        action.dateFrom,
        action.dateTo,
        action.compareOn,
        action.compareFrom,
        action.compareTo,
      );
    case "NAV_LEFT": {
      const next = new Date(state.leftMonth);
      next.setMonth(next.getMonth() + action.dir);
      const leftT = next.getTime();
      let right = state.rightMonth;
      if (right.getTime() <= leftT) {
        right = new Date(next.getFullYear(), next.getMonth() + 1, 1);
      }
      return { ...state, leftMonth: next, rightMonth: right };
    }
    case "NAV_RIGHT": {
      const next = new Date(state.rightMonth);
      next.setMonth(next.getMonth() + action.dir);
      const leftStart = new Date(
        state.leftMonth.getFullYear(),
        state.leftMonth.getMonth(),
        1,
      );
      if (next.getTime() <= leftStart.getTime()) return state;
      return { ...state, rightMonth: next };
    }
    case "COMPARE_TOGGLE": {
      const checked = action.checked;
      const prev = state.draft;
      if (checked && prev.from && prev.to) {
        const pp = previousPeriod(prev.from, prev.to);
        return {
          ...state,
          draft: {
            ...prev,
            compare: true,
            compFrom: pp.from,
            compTo: pp.to,
          },
          selectMode: "compare-from",
        };
      }
      return {
        ...state,
        draft: {
          ...prev,
          compare: false,
          compFrom: null,
          compTo: null,
        },
        selectMode: "primary-from",
      };
    }
    case "PRESET": {
      const range = resolvePreset(action.key);
      const prev = state.draft;
      if (range) {
        let nextDraft: Draft = {
          ...prev,
          preset: action.key,
          from: range.from,
          to: range.to,
        };
        if (prev.compare) {
          const pp = previousPeriod(range.from, range.to);
          nextDraft = {
            ...nextDraft,
            compFrom: pp.from,
            compTo: pp.to,
          };
        }
        return {
          ...state,
          draft: nextDraft,
          selectMode: "primary-from",
          leftMonth: new Date(range.from.getFullYear(), range.from.getMonth(), 1),
          rightMonth: new Date(
            range.from.getFullYear(),
            range.from.getMonth() + 1,
            1,
          ),
        };
      }
      return {
        ...state,
        draft: { ...prev, preset: action.key },
        selectMode: "primary-from",
      };
    }
    case "DAY_CLICK": {
      const day = action.day;
      const prev = state.draft;
      const mode = state.selectMode;
      const nextPreset = "custom";
      let nextDraft: Draft = { ...prev, preset: nextPreset };
      let nextMode: SelectMode = mode;

      if (mode === "primary-from") {
        nextDraft = { ...nextDraft, from: day, to: null };
        nextMode = "primary-to";
      } else if (mode === "primary-to") {
        if (prev.from && day < prev.from) {
          nextDraft = { ...nextDraft, from: day, to: prev.from };
        } else {
          nextDraft = { ...nextDraft, to: day };
        }
        if (prev.compare && nextDraft.from && nextDraft.to) {
          const pp = previousPeriod(nextDraft.from, nextDraft.to);
          nextDraft = {
            ...nextDraft,
            compFrom: pp.from,
            compTo: pp.to,
          };
          nextMode = "compare-from";
        } else {
          nextMode = "primary-from";
        }
      } else if (mode === "compare-from") {
        nextDraft = { ...nextDraft, compFrom: day, compTo: null };
        nextMode = "compare-to";
      } else if (mode === "compare-to") {
        if (prev.compFrom && day < prev.compFrom) {
          nextDraft = {
            ...nextDraft,
            compFrom: day,
            compTo: prev.compFrom,
          };
        } else {
          nextDraft = { ...nextDraft, compTo: day };
        }
        nextMode = "primary-from";
      }

      return { ...state, draft: nextDraft, selectMode: nextMode };
    }
    default:
      return state;
  }
}

export type Ga4DateRangeApplyPayload = {
  preset: string;
  dateFrom: string;
  dateTo: string;
  compareOn: boolean;
  compareFrom: string;
  compareTo: string;
};

export type Ga4DateRangePickerProps = {
  preset?: string;
  dateFrom: string;
  dateTo: string;
  compareOn?: boolean;
  compareFrom?: string;
  compareTo?: string;
  onApply: (payload: Ga4DateRangeApplyPayload) => void;
};

export function Ga4DateRangePicker({
  preset,
  dateFrom,
  dateTo,
  compareOn = false,
  compareFrom = "",
  compareTo = "",
  onApply,
}: Ga4DateRangePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [picker, dispatch] = useReducer(
    pickerReducer,
    buildInitialState(
      preset ?? "last30",
      dateFrom,
      dateTo,
      compareOn,
      compareFrom,
      compareTo,
    ),
  );

  const resetDraftFromProps = useCallback(() => {
    dispatch({
      type: "RESET",
      preset: preset ?? "last30",
      dateFrom,
      dateTo,
      compareOn,
      compareFrom,
      compareTo,
    });
  }, [preset, dateFrom, dateTo, compareOn, compareFrom, compareTo]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) resetDraftFromProps();
      return !prev;
    });
  }, [resetDraftFromProps]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleApply = useCallback(() => {
    const d = picker.draft;
    onApply({
      preset: d.preset,
      dateFrom: isoStr(d.from),
      dateTo: isoStr(d.to),
      compareOn: d.compare,
      compareFrom: isoStr(d.compFrom),
      compareTo: isoStr(d.compTo),
    });
    setIsOpen(false);
  }, [picker.draft, onApply]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        isOpen &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen]);

  const handlePresetClick = useCallback((key: string) => {
    dispatch({ type: "PRESET", key });
  }, []);

  const handleDayClick = useCallback((day: Date) => {
    dispatch({ type: "DAY_CLICK", day });
  }, []);

  const handleCompareToggle = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: "COMPARE_TOGGLE", checked: e.target.checked });
    },
    [],
  );

  const navLeft = useCallback((dir: number) => {
    dispatch({ type: "NAV_LEFT", dir });
  }, []);

  const navRight = useCallback((dir: number) => {
    dispatch({ type: "NAV_RIGHT", dir });
  }, []);

  const draft = picker.draft;
  const selectMode = picker.selectMode;
  const leftMonth = picker.leftMonth;
  const rightMonth = picker.rightMonth;

  function renderCalendar(monthDate: Date, navHandlers: (dir: number) => void) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const dim = daysInMonth(year, month);
    const firstDow = new Date(year, month, 1).getDay();
    const today = startOfDayLocal(new Date());

    const cells: { day: number; date: Date; otherMonth: boolean }[] = [];
    const prevDim = daysInMonth(year, month - 1);
    for (let i = firstDow - 1; i >= 0; i--) {
      cells.push({
        day: prevDim - i,
        date: new Date(year, month - 1, prevDim - i),
        otherMonth: true,
      });
    }
    for (let d = 1; d <= dim; d++) {
      cells.push({ day: d, date: new Date(year, month, d), otherMonth: false });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day: d,
        date: new Date(year, month + 1, d),
        otherMonth: true,
      });
    }

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    return (
      <div className="ga4-dp-calendar">
        <div className="ga4-dp-cal-header">
          <button
            className="ga4-dp-cal-nav"
            onClick={() => navHandlers(-1)}
            type="button"
            aria-label="Previous month"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M7.5 9.5L4 6L7.5 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="ga4-dp-cal-title">
            {monthNames[month]} {year}
          </span>
          <button
            className="ga4-dp-cal-nav"
            onClick={() => navHandlers(1)}
            type="button"
            aria-label="Next month"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M4.5 2.5L8 6L4.5 9.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div className="ga4-dp-cal-grid">
          {DOW.map((d) => (
            <span key={d} className="ga4-dp-cal-dow">
              {d}
            </span>
          ))}
          {cells.map((c, i) => {
            const classes = ["ga4-dp-cal-day"];
            if (c.otherMonth) classes.push("other-month");
            if (sameDay(c.date, today)) classes.push("today");

            if (draft.from && sameDay(c.date, draft.from)) {
              classes.push("range-start");
            }
            if (draft.to && sameDay(c.date, draft.to)) {
              classes.push("range-end");
            }
            if (draft.from && draft.to && inRange(c.date, draft.from, draft.to)) {
              classes.push("in-range");
            }

            if (draft.compare) {
              if (draft.compFrom && sameDay(c.date, draft.compFrom)) {
                classes.push("compare-start");
              }
              if (draft.compTo && sameDay(c.date, draft.compTo)) {
                classes.push("compare-end");
              }
              if (
                draft.compFrom &&
                draft.compTo &&
                inRange(c.date, draft.compFrom, draft.compTo)
              ) {
                classes.push("compare-range");
              }
            }

            return (
              <button
                key={`${c.date.toISOString()}-${i}`}
                type="button"
                className={classes.join(" ")}
                onClick={() => handleDayClick(c.date)}
              >
                {c.day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const rangeDisplayText = (() => {
    let txt =
      draft.from && draft.to
        ? `${formatShort(draft.from)} → ${formatShort(draft.to)}`
        : "No range selected";
    if (draft.compare && draft.compFrom && draft.compTo) {
      txt += `  vs  ${formatShort(draft.compFrom)} → ${formatShort(draft.compTo)}`;
    }
    return txt;
  })();

  const hintText = (() => {
    switch (selectMode) {
      case "primary-from":
        return "Select start date";
      case "primary-to":
        return "Select end date";
      case "compare-from":
        return "Select compare start";
      case "compare-to":
        return "Select compare end";
      default:
        return "";
    }
  })();

  const triggerPresetLabel = presetLabel(preset ?? "last30");

  const triggerRangeText = (() => {
    const f = parseIsoDate(dateFrom);
    const t = parseIsoDate(dateTo);
    if (f && t) return `${formatShort(f)} – ${formatShort(t)}`;
    return "Select dates";
  })();

  const triggerCompareText = (() => {
    const f = parseIsoDate(compareFrom);
    const t = parseIsoDate(compareTo);
    if (f && t) return `${formatShort(f)} – ${formatShort(t)}`;
    return "—";
  })();

  return (
    <div
      ref={containerRef}
      className="ga4-dp-root relative inline-flex flex-col gap-1"
    >
      <button
        type="button"
        className={`ga4-dp-trigger ${isOpen ? "active" : ""}`}
        onClick={toggle}
        aria-expanded={isOpen}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="shrink-0 text-zinc-500"
          aria-hidden
        >
          <rect
            x="1.5"
            y="2.5"
            width="13"
            height="12"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M5 1v3M11 1v3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <span className="ga4-dp-label">View</span>
        <span className="ga4-dp-value">{triggerPresetLabel}</span>
        <span className="text-zinc-300" aria-hidden>
          |
        </span>
        <span
          className="ga4-dp-value font-mono text-[11.5px] font-medium tracking-tight"
        >
          {triggerRangeText}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className="ml-0.5 shrink-0 text-zinc-500"
          aria-hidden
        >
          <path
            d="M2.5 3.5L5 6.5L7.5 3.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {compareOn ? (
        <button
          type="button"
          className="ga4-dp-trigger text-xs"
          onClick={toggle}
        >
          <span className="ga4-dp-label text-red-600">vs</span>
          <span className="ga4-dp-value font-mono text-[11.5px] font-medium">
            {triggerCompareText}
          </span>
        </button>
      ) : null}

      <div className={`ga4-dp-dropdown ${isOpen ? "open" : ""}`}>
        <div className="ga4-dp-presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`ga4-dp-preset-btn ${draft.preset === p.key ? "active" : ""}`}
              onClick={() => handlePresetClick(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="ga4-dp-calendars">
            {renderCalendar(leftMonth, navLeft)}
            {renderCalendar(rightMonth, navRight)}
          </div>
          <div className="ga4-dp-footer">
            <div className="ga4-dp-footer-range">
              <span className="ga4-dp-range-display">{rangeDisplayText}</span>
            </div>
            <div className="ga4-dp-footer-controls">
              <div className="ga4-dp-footer-left">
                <span className="ga4-dp-tz">UTC</span>
                <label className="ga4-dp-compare-toggle">
                  <span className="ga4-dp-toggle-switch">
                    <input
                      type="checkbox"
                      checked={draft.compare}
                      onChange={handleCompareToggle}
                    />
                    <span className="ga4-dp-toggle-slider" />
                  </span>
                  Compare to
                </label>
                <span
                  className={`ga4-dp-selection-hint ${selectMode.startsWith("compare") ? "text-red-600" : "text-zinc-900"}`}
                >
                  {hintText}
                </span>
              </div>
              <div className="ga4-dp-footer-right">
                <button
                  className="ga4-dp-btn ga4-dp-btn-outline"
                  type="button"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  className="ga4-dp-btn ga4-dp-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  onClick={handleApply}
                  disabled={!draft.from || !draft.to}
                >
                  Apply Range
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
