import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ai } from "@/lib/ai/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CASHIER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgId = session.user.organizationId;
  const result = await ai.get(`/optimize/reorder/${orgId}`);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, unavailable: result.unavailable, error: result.error },
      { status: result.unavailable ? 503 : 502 }
    );
  }
  return NextResponse.json({ ok: true, data: result.data });
}
