import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  TEMP_DEV_SESSION_COOKIE,
  isTempDevSessionActive,
} from "@/lib/temp-dev-auth";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const devAuthed = isTempDevSessionActive(
    request.cookies.get(TEMP_DEV_SESSION_COOKIE)?.value,
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let supabaseUser: boolean | null = null;
  let supabaseResponse = NextResponse.next({ request });

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    supabaseUser = !!user;
  }

  const authed = supabaseUser || devAuthed;

  if (!authed && path.startsWith("/dashboard")) {
    const next = request.nextUrl.clone();
    next.pathname = "/login";
    next.searchParams.set("next", path);
    return NextResponse.redirect(next);
  }

  if (authed && (path === "/login" || path === "/signup")) {
    const next = request.nextUrl.clone();
    next.pathname = "/dashboard";
    return NextResponse.redirect(next);
  }

  return supabaseResponse;
}
