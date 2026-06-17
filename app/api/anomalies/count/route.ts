import { NextResponse } from "next/server";
import { auth } from "@/auth";

const AI_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export async function GET() {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ total: 0, critical: 0, warning: 0, preview: [] });

  try {
    const res = await fetch(`${AI_URL}/anomalies/${orgId}/count`, {
      next: { revalidate: 300 }, // cache 5 min — anomalies change slowly
    });
    if (!res.ok) throw new Error("AI service error");
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ total: 0, critical: 0, warning: 0, preview: [] });
  }
}
