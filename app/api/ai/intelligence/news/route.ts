import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ai } from "@/lib/ai/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CASHIER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgId = session.user.organizationId;
  const limit = req.nextUrl.searchParams.get("limit") ?? "10";

  const result = await ai.get("/intelligence/news", {
    organization_id: orgId,
    limit,
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, unavailable: result.unavailable, error: result.error },
      { status: result.unavailable ? 503 : 502 }
    );
  }
  return NextResponse.json({ ok: true, data: result.data });
}
