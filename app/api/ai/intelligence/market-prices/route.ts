import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ai } from "@/lib/ai/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CASHIER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgId = session.user.organizationId;

  // The AI service derives FX pairs from the org's currency automatically
  const result = await ai.get(`/intelligence/market-prices/${orgId}`);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, unavailable: result.unavailable, error: result.error },
      { status: result.unavailable ? 503 : 502 }
    );
  }
  return NextResponse.json({ ok: true, data: result.data });
}
