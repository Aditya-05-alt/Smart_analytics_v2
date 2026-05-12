import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import {
  TEMP_DEV_EMAIL,
  TEMP_DEV_SESSION_COOKIE,
  tempDevSessionValid,
} from "@/lib/temp-dev-auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const devAuthed = tempDevSessionValid(
    cookieStore.get(TEMP_DEV_SESSION_COOKIE)?.value,
  );

  if (devAuthed) {
    return (
      <DashboardShell email={TEMP_DEV_EMAIL}>{children}</DashboardShell>
    );
  }

  const hasEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasEnv) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-100 p-6 text-center">
        <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-900">
            Configure Supabase
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Copy <code className="rounded bg-zinc-100 px-1">.env.example</code>{" "}
            to <code className="rounded bg-zinc-100 px-1">.env.local</code> and
            add your project URL and anon key, or use the temporary dev login
            on the sign-in page.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell email={user.email ?? null}>{children}</DashboardShell>
  );
}
