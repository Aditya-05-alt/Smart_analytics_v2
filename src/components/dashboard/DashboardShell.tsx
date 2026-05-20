"use client";

import { usePathname } from "next/navigation";
import { AppFooter } from "@/components/dashboard/AppFooter";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { Sidebar } from "@/components/dashboard/Sidebar";

type Props = {
  email: string | null;
  children: React.ReactNode;
};

function headerTitle(pathname: string) {
  if (pathname.startsWith("/dashboard/ga4-advance")) {
    return "GA4 • Advanced analytics";
  }
  if (pathname.startsWith("/dashboard/pipeline-health")) {
    return "Pipeline health";
  }
  if (pathname.startsWith("/dashboard/vdp-logics")) {
    return "VDP Logics";
  }
  return "Dashboard";
}

export function DashboardShell({ email, children }: Props) {
  const pathname = usePathname();
  const title = headerTitle(pathname);
  const showBack = pathname !== "/dashboard";

  return (
    <div className="flex min-h-screen flex-1">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <AppHeader
          title={title}
          email={email}
          showBack={showBack}
          backHref="/dashboard"
        />
        <main className="flex-1 overflow-auto bg-zinc-100 p-6">{children}</main>
        <AppFooter />
      </div>
    </div>
  );
}
