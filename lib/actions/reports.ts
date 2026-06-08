"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";

// ── Types ─────────────────────────────────────────────────────────────────

export type ReportSale = {
  id: string;
  receiptNumber: string;
  saleType: string;
  paymentStatus: string;
  totalAmount?: string;
  taxAmount?: string;
  discountAmount?: string;
  createdAt: string;
  customer: { name: string } | null;
  employee: { name: string };
};

export type ReportData = {
  sales: ReportSale[];
  salesCount: number;
  canViewRevenue: boolean;
  totalRevenue?: number;
  revenueByType?: { RETAIL: number; WHOLESALE: number; SPECIAL: number };
};

// ── Action ────────────────────────────────────────────────────────────────

export async function getReportData(
  startDate: string,
  endDate: string,
  branchId?: string | null
): Promise<ReportData> {
  const session = await auth();
  if (!session?.user?.id) return emptyReport();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return emptyReport();

  // Non-admins are always scoped to their own branch
  const effectiveBranchId = session.user.role === "ADMIN" ? (branchId ?? undefined) : session.user.branchId ?? undefined;
  const canViewRevenue = session.user.role === "ADMIN";

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const where = {
    createdAt: { gte: start, lte: end },
    isVoid: false,
    ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
  };

  if (!canViewRevenue) {
    const sales = await db.sale.findMany({
      where,
      select: {
        id: true,
        receiptNumber: true,
        saleType: true,
        paymentStatus: true,
        createdAt: true,
        customer: { select: { name: true } },
        employee: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      sales: JSON.parse(JSON.stringify(sales)),
      salesCount: sales.length,
      canViewRevenue,
    };
  }

  const sales = await db.sale.findMany({
    where,
    select: {
      id: true,
      receiptNumber: true,
      saleType: true,
      paymentStatus: true,
      totalAmount: true,
      taxAmount: true,
      discountAmount: true,
      createdAt: true,
      customer: { select: { name: true } },
      employee: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const revenueByType = { RETAIL: 0, WHOLESALE: 0, SPECIAL: 0 };
  let totalRevenue = 0;

  for (const sale of sales) {
    const amount = Number(sale.totalAmount);
    totalRevenue += amount;
    const type = sale.saleType as keyof typeof revenueByType;
    if (type in revenueByType) revenueByType[type] += amount;
  }

  return {
    sales: JSON.parse(JSON.stringify(sales)),
    salesCount: sales.length,
    canViewRevenue,
    totalRevenue,
    revenueByType,
  };
}

function emptyReport(): ReportData {
  return { sales: [], salesCount: 0, canViewRevenue: false };
}
