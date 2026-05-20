import { format, parseISO, startOfDay } from "date-fns";
import { NextResponse } from "next/server";
import { getPipelineHealth } from "@/lib/supabase/queries/pipeline-health";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get("as_of")?.trim();

  let asOfDate: string | undefined;
  if (asOf && asOf.length >= 8) {
    try {
      asOfDate = format(startOfDay(parseISO(asOf)), "yyyy-MM-dd");
    } catch {
      return NextResponse.json(
        { error: "Invalid as_of date. Use yyyy-MM-dd." },
        { status: 400 },
      );
    }
  }

  try {
    const result = await getPipelineHealth(asOfDate);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
