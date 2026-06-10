"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────

export type PurchaseOrderRow = {
  id: string;
  poNumber: string;
  supplier: { id: string; name: string };
  branch: { id: string; name: string } | null;
  status: string;
  totalCost: number;
  lineCount: number;
  createdAt: string;
  createdBy: { name: string };
};

export type POStats = {
  totalOrders: number;
  totalSpend: number;
  thisMonthOrders: number;
  thisMonthSpend: number;
};

export type SupplierForPO = {
  id: string;
  name: string;
  items: Array<{
    id: string;
    sku: string;
    name: string;
    category: string;
    retailPrice: string;
    wholesalePrice: string;
    isActive: boolean;
    stockQty: number;
  }>;
};

// ── List POs ───────────────────────────────────────────────────────────────

export async function getPurchaseOrders(): Promise<PurchaseOrderRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  if (session.user.role === "CASHIER") return [];
  const orgId = session.user.organizationId;

  const rows = await db.purchaseOrder.findMany({
    where: { organizationId: orgId },
    include: {
      supplier: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      items: { select: { quantity: true, costPrice: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    supplier: po.supplier,
    branch: po.branch,
    status: po.status,
    totalCost: po.items.reduce((s, i) => s + i.quantity * Number(i.costPrice), 0),
    lineCount: po.items.length,
    createdAt: po.createdAt.toISOString(),
    createdBy: po.createdBy,
  }));
}

// ── Stats ──────────────────────────────────────────────────────────────────

export async function getPOStats(): Promise<POStats> {
  const session = await auth();
  if (!session?.user?.id) {
    return { totalOrders: 0, totalSpend: 0, thisMonthOrders: 0, thisMonthSpend: 0 };
  }
  const orgId = session.user.organizationId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [allItems, monthItems, totalOrders, thisMonthOrders] = await Promise.all([
    db.purchaseOrderItem.findMany({
      where: { purchaseOrder: { organizationId: orgId } },
      select: { quantity: true, costPrice: true },
    }),
    db.purchaseOrderItem.findMany({
      where: { purchaseOrder: { organizationId: orgId, createdAt: { gte: monthStart } } },
      select: { quantity: true, costPrice: true },
    }),
    db.purchaseOrder.count({ where: { organizationId: orgId } }),
    db.purchaseOrder.count({ where: { organizationId: orgId, createdAt: { gte: monthStart } } }),
  ]);

  return {
    totalOrders,
    totalSpend: allItems.reduce((s, i) => s + i.quantity * Number(i.costPrice), 0),
    thisMonthOrders,
    thisMonthSpend: monthItems.reduce((s, i) => s + i.quantity * Number(i.costPrice), 0),
  };
}

// ── Supplier items for the PO form ─────────────────────────────────────────

export async function getSupplierItems(supplierId: string): Promise<SupplierForPO | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role === "CASHIER") return null;
  const orgId = session.user.organizationId;
  const branchId = session.user.branchId ?? null;

  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, organizationId: orgId },
    select: {
      id: true,
      name: true,
      items: {
        select: {
          id: true,
          sku: true,
          name: true,
          retailPrice: true,
          wholesalePrice: true,
          isActive: true,
          category: { select: { name: true } },
          branchStocks: branchId
            ? { where: { branchId }, select: { stockQty: true } }
            : { select: { stockQty: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!supplier) return null;

  return {
    id: supplier.id,
    name: supplier.name,
    items: supplier.items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category?.name ?? "",
      retailPrice: item.retailPrice.toString(),
      wholesalePrice: item.wholesalePrice.toString(),
      isActive: item.isActive,
      stockQty: item.branchStocks.reduce((sum, bs) => sum + bs.stockQty, 0),
    })),
  };
}
