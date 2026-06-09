"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function getAuditLogs() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const orgId = session.user.organizationId;

  const [creditPayments, stockLogs] = await Promise.all([
    db.creditPayment.findMany({
      where: { customer: { organizationId: orgId } },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, branchId: true } },
        recordedBy: { select: { name: true } },
      },
    }),
    db.stockLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        item: { select: { name: true, sku: true } },
        recordedBy: { select: { name: true } },
        branch: { select: { name: true } },
      },
    }),
  ]);

  return { creditPayments, stockLogs };
}
