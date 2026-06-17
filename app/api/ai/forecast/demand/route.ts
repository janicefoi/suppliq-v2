import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ai } from "@/lib/ai/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CASHIER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgId = session.user.organizationId;

  // Accept optional horizon_days / item_id / branch_id from caller
  // but always override organization_id from the session
  const body = await req.json().catch(() => ({}));
  const payload = {
    organization_id: orgId,
    item_id: body.item_id ?? null,
    branch_id: body.branch_id ?? null,
    horizon_days: body.horizon_days ?? 30,
  };

  const result = await ai.post("/forecast/demand", payload);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, unavailable: result.unavailable, error: result.error },
      { status: result.unavailable ? 503 : 502 }
    );
  }
  return NextResponse.json({ ok: true, data: result.data });
}
