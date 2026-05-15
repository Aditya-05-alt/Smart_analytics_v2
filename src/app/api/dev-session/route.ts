import { NextResponse } from "next/server";
import {
  TEMP_DEV_SESSION_COOKIE,
  TEMP_DEV_SESSION_TOKEN,
  tempDevLoginValid,
} from "@/lib/temp-dev-auth";

type Body = { email?: string; password?: string };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!tempDevLoginValid(email, password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEMP_DEV_SESSION_COOKIE, TEMP_DEV_SESSION_TOKEN, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEMP_DEV_SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
  return res;
}
