"use server";

import { startOfDay, endOfDay, subDays, startOfMonth, format } from "date-fns";
import { db } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────

export type DashboardMetrics = {
  todayRevenue: number;
  todaySalesCount: number;
  yesterdayRevenue: number;
  yesterdaySalesCount: number;
  mtdRevenue: number;
  mtdSalesCount: number;
  lowStockCount: number;
  totalOutstandingCredit: number;
};

export type DailyRevenue = {
  label: string;
  revenue: number;
};

export type TopItem = {
  id: string;
  name: string;
  sku: string;
  totalQty: number;
  totalRevenue: number;
};

export type TopDebtor = {
  id: string;
  name: string;
  phone: string;
  creditBalance: number;
};

export type RecentSale = {
  id: string;
  receiptNumber: string;
  createdAt: string;
  paymentStatus: string;
  saleType: string;
  totalAmount: string;
  isVoid: boolean;
  customer: { name: string } | null;
  employee: { name: string };
};

export type LowStockAlert = {
  id: string;
  sku: string;
  name: string;
  stockQty: number;
  lowStockThreshold: number;
};

// ── Actions ────────────────────────────────────────────────────────────────

export async function getDashboardMetrics(branchId?: string | null): Promise<DashboardMetrics> {
  const now = new Date();
  const branchFilter = branchId ? { branchId } : {};

  const [todaySales, yesterdaySales, mtdSales, creditAgg, branchStocks] = await Promise.all([
    db.sale.findMany({
      where: { createdAt: { gte: startOfDay(now), lte: endOfDay(now) }, isVoid: false, ...branchFilter },
      select: { totalAmount: true },
    }),
    db.sale.findMany({
      where: { createdAt: { gte: startOfDay(subDays(now, 1)), lte: endOfDay(subDays(now, 1)) }, isVoid: false, ...branchFilter },
      select: { totalAmount: true },
    }),
    db.sale.findMany({
      where: { createdAt: { gte: startOfMonth(now), lte: endOfDay(now) }, isVoid: false, ...branchFilter },
      select: { totalAmount: true },
    }),
    db.customer.aggregate({
      _sum: { creditBalance: true },
      where: { creditBalance: { gt: 0 }, ...branchFilter },
    }),
    db.branchStock.findMany({
      where: branchId ? { branchId, item: { isActive: true } } : { item: { isActive: true } },
      select: { stockQty: true, lowStockThreshold: true },
    }),
  ]);

  return {
    todayRevenue: todaySales.reduce((s, x) => s + Number(x.totalAmount), 0),
    todaySalesCount: todaySales.length,
    yesterdayRevenue: yesterdaySales.reduce((s, x) => s + Number(x.totalAmount), 0),
    yesterdaySalesCount: yesterdaySales.length,
    mtdRevenue: mtdSales.reduce((s, x) => s + Number(x.totalAmount), 0),
    mtdSalesCount: mtdSales.length,
    lowStockCount: branchStocks.filter((bs) => bs.stockQty <= bs.lowStockThreshold).length,
    totalOutstandingCredit: Number(creditAgg._sum.creditBalance ?? 0),
  };
}

export async function getRevenueChart(branchId?: string | null): Promise<DailyRevenue[]> {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));
  const branchFilter = branchId ? { branchId } : {};

  const sales = await db.sale.findMany({
    where: {
      createdAt: { gte: startOfDay(days[0]), lte: endOfDay(now) },
      isVoid: false,
      ...branchFilter,
    },
    select: { totalAmount: true, createdAt: true },
  });

  return days.map((day) => {
    const s = startOfDay(day).getTime();
    const e = endOfDay(day).getTime();
    const dayRevenue = sales
      .filter((x) => { const t = new Date(x.createdAt).getTime(); return t >= s && t <= e; })
      .reduce((sum, x) => sum + Number(x.totalAmount), 0);
    return { label: format(day, "EEE dd"), revenue: dayRevenue };
  });
}

export async function getTopSellingItems(branchId?: string | null): Promise<TopItem[]> {
  const since = subDays(new Date(), 7);
  const branchFilter = branchId ? { branchId } : {};

  const rows = await db.saleItem.findMany({
    where: { sale: { createdAt: { gte: since }, isVoid: false, ...branchFilter } },
    select: {
      itemId: true,
      quantity: true,
      subtotal: true,
      item: { select: { name: true, sku: true } },
    },
  });

  const map = new Map<string, TopItem>();
  for (const r of rows) {
    const e = map.get(r.itemId);
    if (e) {
      e.totalQty += r.quantity;
      e.totalRevenue += Number(r.subtotal);
    } else {
      map.set(r.itemId, { id: r.itemId, name: r.item.name, sku: r.item.sku, totalQty: r.quantity, totalRevenue: Number(r.subtotal) });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty).slice(0, 5);
}

export async function getTopDebtors(branchId?: string | null): Promise<TopDebtor[]> {
  const rows = await db.customer.findMany({
    where: { creditBalance: { gt: 0 }, ...(branchId ? { branchId } : {}) },
    orderBy: { creditBalance: "desc" },
    take: 5,
    select: { id: true, name: true, phone: true, creditBalance: true },
  });
  return JSON.parse(JSON.stringify(rows));
}

export async function getRecentSales(branchId?: string | null): Promise<RecentSale[]> {
  const branchFilter = branchId ? { branchId } : {};
  const sales = await db.sale.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    where: { ...branchFilter },
    select: {
      id: true, receiptNumber: true, createdAt: true, paymentStatus: true,
      saleType: true, totalAmount: true, isVoid: true,
      customer: { select: { name: true } },
      employee: { select: { name: true } },
    },
  });
  return JSON.parse(JSON.stringify(sales));
}

export async function getLowStockAlerts(branchId?: string | null): Promise<LowStockAlert[]> {
  const stocks = await db.branchStock.findMany({
    where: branchId ? { branchId, item: { isActive: true } } : { item: { isActive: true } },
    select: { stockQty: true, lowStockThreshold: true, item: { select: { id: true, sku: true, name: true } } },
    orderBy: { stockQty: "asc" },
  });
  return stocks
    .filter((bs) => bs.stockQty <= bs.lowStockThreshold)
    .slice(0, 8)
    .map((bs) => ({ id: bs.item.id, sku: bs.item.sku, name: bs.item.name, stockQty: bs.stockQty, lowStockThreshold: bs.lowStockThreshold }));
}

export async function getBranches() {
  return db.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}
