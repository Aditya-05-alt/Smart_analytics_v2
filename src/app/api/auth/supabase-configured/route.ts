import { NextResponse } from "next/server";

/**
 * Tells the browser whether Supabase public env is set on the server.
 * Does not expose keys.
 */
export function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = !!(rawUrl && key);
  let host: string | null = null;
  if (rawUrl) {
    try {
      host = new URL(rawUrl).hostname;
    } catch {
      host = null;
    }
  }
  return NextResponse.json({ configured, host });
}
