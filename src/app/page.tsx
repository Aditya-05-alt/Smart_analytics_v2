import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  TEMP_DEV_SESSION_COOKIE,
  isTempDevSessionActive,
} from "@/lib/temp-dev-auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  if (isTempDevSessionActive(cookieStore.get(TEMP_DEV_SESSION_COOKIE)?.value)) {
    redirect("/dashboard");
  }

  const hasEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasEnv) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }
  redirect("/login");
}
