"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";

// ── Types ─────────────────────────────────────────────────────────────────

export type ReportSale = {
  id: string;
  receiptNumber: string;
  saleType: string;
  paymentStatus: string;
  isVoid: boolean;
  voidReason: string | null;
  voidedAt: string | null;
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
  voidedCount: number;
  canViewRevenue: boolean;
  totalRevenue?: number;
  revenueByType?: { RETAIL: number; WHOLESALE: number; SPECIAL: number };
};

// ── Action ────────────────────────────────────────────────────────────────

export async function getReportData(
  startDate: string,
  endDate: string,
  branchId?: string | null,
  includeVoided?: boolean
): Promise<ReportData> {
  const session = await auth();
  if (!session?.user?.id) return emptyReport();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return emptyReport();

  const effectiveBranchId = session.user.role === "ADMIN" ? (branchId ?? undefined) : session.user.branchId ?? undefined;
  const canViewRevenue = session.user.role === "ADMIN";

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const baseWhere = {
    createdAt: { gte: start, lte: end },
    organizationId: session.user.organizationId,
    ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
  };

  const where = includeVoided ? baseWhere : { ...baseWhere, isVoid: false };

  const selectBase = {
    id: true,
    receiptNumber: true,
    saleType: true,
    paymentStatus: true,
    isVoid: true,
    voidReason: true,
    voidedAt: true,
    createdAt: true,
    customer: { select: { name: true } },
    employee: { select: { name: true } },
  } as const;

  if (!canViewRevenue) {
    const sales = await db.sale.findMany({
      where,
      select: selectBase,
      orderBy: { createdAt: "desc" },
    });

    const voidedCount = sales.filter((s) => s.isVoid).length;

    return {
      sales: JSON.parse(JSON.stringify(sales)),
      salesCount: sales.filter((s) => !s.isVoid).length,
      voidedCount,
      canViewRevenue,
    };
  }

  const sales = await db.sale.findMany({
    where,
    select: {
      ...selectBase,
      totalAmount: true,
      taxAmount: true,
      discountAmount: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const revenueByType = { RETAIL: 0, WHOLESALE: 0, SPECIAL: 0 };
  let totalRevenue = 0;

  for (const sale of sales) {
    if (sale.isVoid) continue;
    const amount = Number(sale.totalAmount);
    totalRevenue += amount;
    const type = sale.saleType as keyof typeof revenueByType;
    if (type in revenueByType) revenueByType[type] += amount;
  }

  const voidedCount = sales.filter((s) => s.isVoid).length;

  return {
    sales: JSON.parse(JSON.stringify(sales)),
    salesCount: sales.filter((s) => !s.isVoid).length,
    voidedCount,
    canViewRevenue,
    totalRevenue,
    revenueByType,
  };
}

function emptyReport(): ReportData {
  return { sales: [], salesCount: 0, voidedCount: 0, canViewRevenue: false };
}
