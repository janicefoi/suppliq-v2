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

// purchaseOrders are flattened: one row per PurchaseOrderItem so the UI table
// works unchanged (shows item name, qty, cost/unit, recorded-by per row).
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

// ── Helpers ────────────────────────────────────────────────────────────────

async function generatePoNumber(orgId: string): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PO-${dateStr}-`;
  const last = await db.purchaseOrder.findFirst({
    where: { organizationId: orgId, poNumber: { startsWith: prefix } },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  });
  const next = last ? parseInt(last.poNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ── Supplier stats ────────────────────────────────────────────────────────

export type SupplierStats = {
  total: number;
  totalItems: number;
  totalOrders: number;
  totalSpend: number;
};

export async function getSupplierStats(): Promise<SupplierStats> {
  const session = await auth();
  if (!session?.user?.id) return { total: 0, totalItems: 0, totalOrders: 0, totalSpend: 0 };
  const orgId = session.user.organizationId;

  const [total, totalItems, totalOrders, poItems] = await Promise.all([
    db.supplier.count({ where: { organizationId: orgId } }),
    db.item.count({ where: { supplierId: { not: null }, organizationId: orgId } }),
    db.purchaseOrder.count({ where: { organizationId: orgId } }),
    db.purchaseOrderItem.findMany({
      where: { purchaseOrder: { organizationId: orgId } },
      select: { quantity: true, costPrice: true },
    }),
  ]);

  const totalSpend = poItems.reduce((s, i) => s + i.quantity * Number(i.costPrice), 0);
  return { total, totalItems, totalOrders, totalSpend };
}

// ── Get suppliers list ────────────────────────────────────────────────────

export async function getSuppliers(): Promise<SupplierRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const orgId = session.user.organizationId;

  const rows = await db.supplier.findMany({
    where: { organizationId: orgId },
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
  const orgId = session.user.organizationId;

  const parsed = SupplierSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const existing = await db.supplier.findFirst({
    where: { phone: parsed.data.phone, organizationId: orgId },
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
      organizationId: orgId,
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
  const orgId = session.user.organizationId;

  const parsed = SupplierSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Verify supplier belongs to this org
  const supplier = await db.supplier.findUnique({ where: { id }, select: { organizationId: true } });
  if (!supplier || supplier.organizationId !== orgId) {
    return { success: false, error: "Supplier not found." };
  }

  const existing = await db.supplier.findFirst({
    where: { phone: parsed.data.phone, organizationId: orgId, NOT: { id } },
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
  const orgId = session.user.organizationId;

  const parsed = PurchaseOrderSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const branchId = session.user.role === "ADMIN"
    ? (parsed.data.branchId ?? null)
    : session.user.branchId;

  if (!branchId) {
    return { success: false, error: "Please select a branch to stock into." };
  }

  try {
    const poNumber = await generatePoNumber(orgId);

    await db.$transaction(async (tx) => {
      // Validate all items before creating the PO
      for (const line of parsed.data.items) {
        const item = await tx.item.findUnique({
          where: { id: line.itemId },
          select: { name: true, isActive: true, organizationId: true },
        });
        if (!item || item.organizationId !== orgId) throw new Error(`Item not found.`);
        if (!item.isActive) throw new Error(`"${item.name}" is inactive and cannot be restocked.`);
      }

      // Create the PO with all line items
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: parsed.data.supplierId,
          status: "RECEIVED",
          organizationId: orgId,
          branchId,
          createdById: session.user.id,
          deliveredAt: new Date(),
          items: {
            create: parsed.data.items.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              costPrice: line.costPrice,
              receivedQty: line.quantity,
            })),
          },
        },
      });

      // Update branch stock and write StockLog for each line
      for (const line of parsed.data.items) {
        await tx.branchStock.upsert({
          where: { itemId_branchId: { itemId: line.itemId, branchId } },
          update: { stockQty: { increment: line.quantity } },
          create: { itemId: line.itemId, branchId, stockQty: line.quantity, lowStockThreshold: 5 },
        });

        await tx.stockLog.create({
          data: {
            itemId: line.itemId,
            branchId,
            organizationId: orgId,
            quantity: line.quantity,
            reason: "PURCHASE_RECEIVED",
            referenceId: po.id,
            recordedById: session.user.id,
          },
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

// ── Import suppliers (CSV bulk) ───────────────────────────────────────────

export type CsvImportResult = {
  imported: number;
  skipped: Array<{ row: number; value: string; reason: string }>;
};

export async function importSuppliers(
  rows: Array<Record<string, string>>
): Promise<CsvImportResult> {
  const session = await auth();
  if (!session?.user?.id) return { imported: 0, skipped: [{ row: 0, value: "", reason: "Unauthorized" }] };
  const orgId = session.user.organizationId;

  const existingPhones = new Set(
    (await db.supplier.findMany({ where: { organizationId: orgId }, select: { phone: true } }))
      .map((s) => s.phone)
  );

  let imported = 0;
  const skipped: CsvImportResult["skipped"] = [];
  const seenPhones = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const name = row.name?.trim();
    const phone = row.phone?.trim();

    if (!name) { skipped.push({ row: rowNum, value: phone ?? "", reason: "name is required" }); continue; }
    if (!phone) { skipped.push({ row: rowNum, value: name, reason: "phone is required" }); continue; }
    if (existingPhones.has(phone) || seenPhones.has(phone)) {
      skipped.push({ row: rowNum, value: name, reason: `phone ${phone} already exists` }); continue;
    }

    await db.supplier.create({
      data: {
        name,
        phone,
        email: row.email?.trim() || null,
        address: row.address?.trim() || null,
        notes: row.notes?.trim() || null,
        organizationId: orgId,
      },
    });
    seenPhones.add(phone);
    imported++;
  }

  if (imported > 0) revalidatePath("/suppliers");
  return { imported, skipped };
}

// ── Get supplier detail ───────────────────────────────────────────────────

export async function getSupplierDetail(id: string): Promise<SupplierDetail | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const orgId = session.user.organizationId;
  const branchId = session.user.branchId ?? null;

  const supplier = await db.supplier.findFirst({
    where: { id, organizationId: orgId },
    include: {
      purchaseOrders: {
        include: {
          items: {
            include: {
              item: { select: { id: true, name: true, sku: true } },
            },
          },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!supplier) return null;

  // Derive "items supplied" from purchase order history (unique items ever ordered from this supplier)
  const poItemIds = await db.purchaseOrderItem.findMany({
    where: { purchaseOrder: { supplierId: id, organizationId: orgId } },
    select: { itemId: true },
    distinct: ["itemId"],
  });

  const suppliedItems = poItemIds.length > 0
    ? await db.item.findMany({
        where: { id: { in: poItemIds.map((r) => r.itemId) } },
        select: {
          id: true,
          sku: true,
          name: true,
          category: { select: { name: true } },
          retailPrice: true,
          wholesalePrice: true,
          isActive: true,
          branchStocks: branchId
            ? { where: { branchId }, select: { stockQty: true } }
            : { select: { stockQty: true } },
        },
        orderBy: { name: "asc" },
      })
    : [];

  // Flatten PO line items so each row has: item, qty, cost, createdAt, recordedBy
  const flatPOs: SupplierDetail["purchaseOrders"] = supplier.purchaseOrders.flatMap((po) =>
    po.items.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      costPrice: line.costPrice.toString(),
      createdAt: po.createdAt.toISOString(),
      item: line.item,
      recordedBy: { name: po.createdBy.name },
    }))
  );

  const result: SupplierDetail = {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    notes: supplier.notes,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
    items: suppliedItems.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category?.name ?? "",
      retailPrice: item.retailPrice.toString(),
      wholesalePrice: item.wholesalePrice.toString(),
      isActive: item.isActive,
      stockQty: item.branchStocks.reduce((sum, bs) => sum + bs.stockQty, 0),
    })),
    purchaseOrders: flatPOs,
  };

  return JSON.parse(JSON.stringify(result));
}
