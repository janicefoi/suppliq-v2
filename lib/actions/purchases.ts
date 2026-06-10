"use server";

import { revalidatePath } from "next/cache";
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
  invoiceRef: string | null;
  invoiceAmount: number | null;
  invoiceDate: string | null;
  invoiceStatus: string;
  invoicePaidAt: string | null;
  invoicePaidBy: { name: string } | null;
};

export type PayableRow = {
  id: string;
  poNumber: string;
  supplier: { id: string; name: string };
  branch: { id: string; name: string } | null;
  invoiceRef: string;
  invoiceAmount: number;
  invoiceDate: string;
  invoiceStatus: string;
  invoicePaidAt: string | null;
  poTotalCost: number;
  createdAt: string;
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
      invoicePaidBy: { select: { name: true } },
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
    invoiceRef: po.invoiceRef,
    invoiceAmount: po.invoiceAmount ? Number(po.invoiceAmount) : null,
    invoiceDate: po.invoiceDate?.toISOString() ?? null,
    invoiceStatus: po.invoiceStatus,
    invoicePaidAt: po.invoicePaidAt?.toISOString() ?? null,
    invoicePaidBy: po.invoicePaidBy,
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

// ── Link supplier invoice to a PO ─────────────────────────────────────────

export type LinkInvoiceInput = {
  invoiceRef: string;
  invoiceAmount: number;
  invoiceDate: string; // ISO date string
};

export async function linkInvoice(
  poId: string,
  data: LinkInvoiceInput
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.isDemo) return { success: false, error: "Demo accounts are read-only. Sign up to save your own data." };
  if (session.user.role === "CASHIER") return { success: false, error: "Insufficient permissions." };

  const orgId = session.user.organizationId;
  const ref = data.invoiceRef.trim();
  if (!ref) return { success: false, error: "Invoice reference is required." };
  if (data.invoiceAmount <= 0) return { success: false, error: "Invoice amount must be greater than zero." };

  const po = await db.purchaseOrder.findFirst({
    where: { id: poId, organizationId: orgId },
    select: { id: true, status: true, invoiceStatus: true },
  });
  if (!po) return { success: false, error: "Purchase order not found." };
  if (po.status !== "RECEIVED" && po.status !== "PARTIAL") {
    return { success: false, error: "Invoice can only be linked to a received purchase order." };
  }

  await db.purchaseOrder.update({
    where: { id: poId },
    data: {
      invoiceRef: ref,
      invoiceAmount: data.invoiceAmount,
      invoiceDate: new Date(data.invoiceDate),
      invoiceStatus: "RECEIVED",
    },
  });

  revalidatePath("/purchases");
  return { success: true };
}

// ── Mark invoice as paid ──────────────────────────────────────────────────

export async function markInvoicePaid(
  poId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.isDemo) return { success: false, error: "Demo accounts are read-only. Sign up to save your own data." };
  if (session.user.role !== "ADMIN") return { success: false, error: "Only admins can record invoice payments." };

  const orgId = session.user.organizationId;

  const po = await db.purchaseOrder.findFirst({
    where: { id: poId, organizationId: orgId },
    select: { id: true, invoiceStatus: true },
  });
  if (!po) return { success: false, error: "Purchase order not found." };
  if (po.invoiceStatus !== "RECEIVED") {
    return { success: false, error: "Only a received (unpaid) invoice can be marked as paid." };
  }

  await db.purchaseOrder.update({
    where: { id: poId },
    data: {
      invoiceStatus: "PAID",
      invoicePaidAt: new Date(),
      invoicePaidById: session.user.id,
    },
  });

  revalidatePath("/purchases");
  return { success: true };
}

// ── Accounts Payable report ───────────────────────────────────────────────

export async function getPayables(): Promise<PayableRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  if (session.user.role === "CASHIER") return [];

  const orgId = session.user.organizationId;

  const rows = await db.purchaseOrder.findMany({
    where: {
      organizationId: orgId,
      invoiceStatus: { in: ["RECEIVED", "PAID", "DISPUTED"] },
    },
    include: {
      supplier: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      items: { select: { quantity: true, costPrice: true } },
    },
    orderBy: [{ invoiceStatus: "asc" }, { invoiceDate: "asc" }],
  });

  return rows.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    supplier: po.supplier,
    branch: po.branch,
    invoiceRef: po.invoiceRef!,
    invoiceAmount: Number(po.invoiceAmount),
    invoiceDate: po.invoiceDate!.toISOString(),
    invoiceStatus: po.invoiceStatus,
    invoicePaidAt: po.invoicePaidAt?.toISOString() ?? null,
    poTotalCost: po.items.reduce((s, i) => s + i.quantity * Number(i.costPrice), 0),
    createdAt: po.createdAt.toISOString(),
  }));
}
