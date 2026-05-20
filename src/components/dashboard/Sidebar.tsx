"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/pipeline-health", label: "Pipeline health" },
  { href: "/dashboard/vdp-logics", label: "VDP Logics" },
  { href: "/dashboard/ga4-advance", label: "GA4 Advance" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 text-zinc-100">
      <div className="border-b border-zinc-800 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Analytics
        </p>
        <p className="mt-1 text-sm font-semibold text-white">
          Wheeler SmartAnalytics
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {nav.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
