import { NextResponse } from "next/server";
import {
  createVdpLogic,
  listVdpLogics,
} from "@/lib/supabase/queries/vdp-logic";
import type { VdpLogicInput } from "@/types/vdp-logic";

export async function GET() {
  try {
    const result = await listVdpLogics();
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VdpLogicInput;
    const result = await createVdpLogic(body);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
