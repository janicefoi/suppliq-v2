import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

function currentWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // days back to Monday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role === "CASHIER") {
    return NextResponse.json({ has_current_briefing: false });
  }

  const orgId     = session.user.organizationId;
  const weekStart = currentWeekStart();

  try {
    // Use raw query so we don't need the typed Prisma client to be regenerated
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM weekly_briefings
      WHERE "organizationId" = ${orgId}
        AND "weekStart" = ${weekStart}
      LIMIT 1
    `;

    return NextResponse.json(
      { has_current_briefing: rows.length > 0, week_start: weekStart.toISOString() },
      { headers: { "Cache-Control": "private, max-age=3600" } }
    );
  } catch {
    return NextResponse.json({ has_current_briefing: false });
  }
}
