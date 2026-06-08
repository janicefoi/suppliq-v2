"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  SupplierSchema,
  PurchaseOrderSchema,
  type SupplierInput,
  type PurchaseOrderInput,
} from "@/lib/validations/suppliers";

// ── Types ─────────────────────────────────────────────────────────────────

export type SupplierRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { items: number; purchaseOrders: number };
};

export type SupplierDetail = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    sku: string;
    name: string;
    category: string;
    stockQty: number;
    retailPrice: string;
    wholesalePrice: string;
    isActive: boolean;
  }>;
  purchaseOrders: Array<{
    id: string;
    quantity: number;
    costPrice: string;
    createdAt: string;
    item: { id: string; name: string; sku: string };
    recordedBy: { name: string };
  }>;
};

// ── Supplier stats ────────────────────────────────────────────────────────

export type SupplierStats = {
  total: number;
  totalItems: number;
  totalOrders: number;
  totalSpend: number;
};

export async function getSupplierStats(): Promise<SupplierStats> {
  const [total, totalItems, totalOrders, orders] = await Promise.all([
    db.supplier.count(),
    db.item.count({ where: { supplierId: { not: null } } }),
    db.purchaseOrder.count(),
    db.purchaseOrder.findMany({ select: { quantity: true, costPrice: true } }),
  ]);
  const totalSpend = orders.reduce((s, o) => s + o.quantity * Number(o.costPrice), 0);
  return { total, totalItems, totalOrders, totalSpend };
}

// ── Get suppliers list ────────────────────────────────────────────────────

export async function getSuppliers(): Promise<SupplierRow[]> {
  const rows = await db.supplier.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { items: true, purchaseOrders: true } },
    },
    orderBy: { name: "asc" },
  });

  return JSON.parse(JSON.stringify(rows));
}

// ── Create supplier ───────────────────────────────────────────────────────

export async function createSupplier(
  data: SupplierInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const parsed = SupplierSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const existing = await db.supplier.findFirst({
    where: { phone: parsed.data.phone },
  });
  if (existing) {
    return { success: false, error: "A supplier with this phone number already exists." };
  }

  await db.supplier.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/suppliers");
  return { success: true };
}

// ── Update supplier ───────────────────────────────────────────────────────

export async function updateSupplier(
  id: string,
  data: SupplierInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role === "CASHIER") return { success: false, error: "You don't have permission to edit suppliers." };

  const parsed = SupplierSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const existing = await db.supplier.findFirst({
    where: { phone: parsed.data.phone, NOT: { id } },
  });
  if (existing) {
    return { success: false, error: "Another supplier already uses this phone number." };
  }

  await db.supplier.update({
    where: { id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return { success: true };
}

// ── Record purchase order ─────────────────────────────────────────────────

export async function recordPurchaseOrder(
  data: PurchaseOrderInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role === "CASHIER") return { success: false, error: "You don't have permission to record purchase orders." };

  const parsed = PurchaseOrderSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Admin must explicitly provide a branchId; managers use their session branch
  const branchId = session.user.role === "ADMIN"
    ? (parsed.data.branchId ?? null)
    : session.user.branchId;

  if (!branchId) {
    return { success: false, error: "Please select a branch to stock into." };
  }

  try {
    await db.$transaction(async (tx) => {
      for (const line of parsed.data.items) {
        const item = await tx.item.findUnique({
          where: { id: line.itemId },
          select: { supplierId: true, name: true, isActive: true },
        });
        if (!item) throw new Error(`Item not found.`);
        if (!item.isActive) throw new Error(`"${item.name}" is inactive and cannot be restocked.`);
        if (item.supplierId !== parsed.data.supplierId) {
          throw new Error(`"${item.name}" does not belong to this supplier.`);
        }

        await tx.purchaseOrder.create({
          data: {
            supplierId: parsed.data.supplierId,
            itemId: line.itemId,
            quantity: line.quantity,
            costPrice: line.costPrice,
            recordedById: session.user.id,
            branchId,
          },
        });

        await tx.branchStock.upsert({
          where: { itemId_branchId: { itemId: line.itemId, branchId } },
          update: { stockQty: { increment: line.quantity } },
          create: { itemId: line.itemId, branchId, stockQty: line.quantity, lowStockThreshold: 5 },
        });
      }
    });

    revalidatePath(`/suppliers/${parsed.data.supplierId}`);
    revalidatePath("/suppliers");
    revalidatePath("/inventory");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record purchase order.",
    };
  }
}

// ── Get supplier detail ───────────────────────────────────────────────────

export async function getSupplierDetail(id: string): Promise<SupplierDetail | null> {
  const session = await auth();
  const branchId = session?.user?.branchId ?? null;

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      items: {
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
          retailPrice: true,
          wholesalePrice: true,
          isActive: true,
          branchStocks: branchId
            ? { where: { branchId }, select: { stockQty: true } }
            : { select: { stockQty: true } },
        },
        orderBy: { name: "asc" },
      },
      purchaseOrders: {
        select: {
          id: true,
          quantity: true,
          costPrice: true,
          createdAt: true,
          item: { select: { id: true, name: true, sku: true } },
          recordedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!supplier) return null;

  const result: SupplierDetail = {
    ...supplier,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
    items: supplier.items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      retailPrice: item.retailPrice.toString(),
      wholesalePrice: item.wholesalePrice.toString(),
      isActive: item.isActive,
      stockQty: item.branchStocks.reduce((sum, bs) => sum + bs.stockQty, 0),
    })),
    purchaseOrders: supplier.purchaseOrders.map((po) => ({
      ...po,
      costPrice: po.costPrice.toString(),
      createdAt: po.createdAt.toISOString(),
    })),
  };

  return JSON.parse(JSON.stringify(result));
}
