import { NextResponse } from "next/server";
import { ai } from "@/lib/ai/client";

// Public endpoint — no auth required (used by frontend to show/hide AI features)
export async function GET() {
  const result = await ai.get("/health");
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, unavailable: result.unavailable, error: result.error },
      { status: result.unavailable ? 503 : 502 }
    );
  }
  return NextResponse.json({ ok: true, data: result.data });
}
