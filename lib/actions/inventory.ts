"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ItemSchema, type ItemFormValues } from "@/lib/validations/inventory";

// ── Auth guards - return the user on success, error object on failure ──────

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
  if (session.user.role !== "ADMIN") {
    return { success: false as const, error: "Only admins can modify item details." };
  }
  return session.user;
}

async function requireManager() {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
  if (session.user.role === "CASHIER") {
    return { success: false as const, error: "You don't have permission to modify inventory." };
  }
  return session.user;
}

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function categoryToPrefix(category: string): string {
  const alpha = category.replace(/[^a-zA-Z]/g, "");
  return (alpha.length < 3 ? alpha.padEnd(3, "X") : alpha.slice(0, 3)).toUpperCase();
}

// ── Items - read ───────────────────────────────────────────────────────────

export type ItemFilters = {
  search?: string;
  category?: string;
  isActive?: boolean;
  lowStock?: boolean;
};

export type ItemRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  retailPrice: string;
  wholesalePrice: string;
  specialPrice: string | null;
  isActive: boolean;
  supplierId: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: { id: string; name: string } | null;
  stockQty: number;
  lowStockThreshold: number;
};

// branchId: undefined = use session branch; null = combined (sum all); string = specific branch
export async function getItems(filters?: ItemFilters, branchId?: string | null): Promise<ItemRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const orgId = session.user.organizationId;
  const effectiveBranchId = branchId !== undefined ? branchId : (session.user.branchId ?? null);

  const rows = await db.item.findMany({
    where: {
      organizationId: orgId,
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { sku: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filters?.category ? { category: { name: filters.category } } : {}),
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
    },
    include: {
      supplier: { select: { id: true, name: true } },
      category: { select: { name: true } },
      branchStocks: effectiveBranchId
        ? { where: { branchId: effectiveBranchId } }
        : true,
    },
    orderBy: { name: "asc" },
  });

  const result: ItemRow[] = rows.map((item) => {
    const stockQty = effectiveBranchId
      ? (item.branchStocks.find((bs) => bs.branchId === effectiveBranchId)?.stockQty ?? 0)
      : item.branchStocks.reduce((sum, bs) => sum + bs.stockQty, 0);
    const threshold = item.branchStocks[0]?.lowStockThreshold ?? 5;
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category?.name ?? "",
      description: item.description,
      retailPrice: item.retailPrice.toString(),
      wholesalePrice: item.wholesalePrice.toString(),
      specialPrice: item.specialPrice?.toString() ?? null,
      isActive: item.isActive,
      supplierId: item.supplierId,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      supplier: item.supplier,
      stockQty,
      lowStockThreshold: threshold,
    };
  });

  if (filters?.lowStock) {
    return result.filter((i) => i.stockQty <= i.lowStockThreshold);
  }
  return result;
}

// ── Items - write ──────────────────────────────────────────────────────────

export async function createItem(data: ItemFormValues): Promise<ActionResult> {
  const adminResult = await requireAdmin();
  if ("error" in adminResult) return adminResult;
  const orgId = adminResult.organizationId;

  const parsed = ItemSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  // Resolve category name → id (scoped to this org)
  const cat = await db.category.findFirst({
    where: { name: { equals: parsed.data.category, mode: "insensitive" }, organizationId: orgId },
    select: { id: true },
  });
  if (!cat) {
    return { success: false, error: `Category "${parsed.data.category}" not found. Please create it first.` };
  }

  try {
    const item = await db.item.create({
      data: {
        sku: parsed.data.sku,
        name: parsed.data.name,
        categoryId: cat.id,
        description: parsed.data.description,
        retailPrice: parsed.data.retailPrice,
        wholesalePrice: parsed.data.wholesalePrice,
        specialPrice: parsed.data.specialPrice,
        supplierId: parsed.data.supplierId,
        organizationId: orgId,
      },
    });

    // Create BranchStock for all active branches in this org
    const branches = await db.branch.findMany({
      where: { isActive: true, organizationId: orgId },
      select: { id: true },
    });
    const userBranchId = adminResult.branchId;

    for (const branch of branches) {
      const isUserBranch = branch.id === userBranchId;
      await db.branchStock.create({
        data: {
          itemId: item.id,
          branchId: branch.id,
          stockQty: isUserBranch ? (parsed.data.stockQty ?? 0) : 0,
          lowStockThreshold: parsed.data.lowStockThreshold ?? 5,
        },
      });
    }

    revalidatePath("/inventory");
    return { success: true };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return { success: false, error: "An item with this SKU already exists." };
    }
    return { success: false, error: "Failed to create item. Please try again." };
  }
}

export async function updateItem(id: string, data: ItemFormValues): Promise<ActionResult> {
  const adminResult = await requireAdmin();
  if ("error" in adminResult) return adminResult;
  const orgId = adminResult.organizationId;

  const parsed = ItemSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  // Verify item belongs to this org
  const existing = await db.item.findUnique({ where: { id }, select: { organizationId: true } });
  if (!existing || existing.organizationId !== orgId) {
    return { success: false, error: "Item not found." };
  }

  // Resolve category name → id
  const cat = await db.category.findFirst({
    where: { name: { equals: parsed.data.category, mode: "insensitive" }, organizationId: orgId },
    select: { id: true },
  });
  if (!cat) {
    return { success: false, error: `Category "${parsed.data.category}" not found.` };
  }

  try {
    await db.item.update({
      where: { id },
      data: {
        categoryId: cat.id,
        description: parsed.data.description,
        retailPrice: parsed.data.retailPrice,
        wholesalePrice: parsed.data.wholesalePrice,
        specialPrice: parsed.data.specialPrice,
        supplierId: parsed.data.supplierId,
      },
    });

    if (parsed.data.lowStockThreshold !== undefined) {
      await db.branchStock.updateMany({
        where: { itemId: id },
        data: { lowStockThreshold: parsed.data.lowStockThreshold },
      });
    }

    revalidatePath("/inventory");
    return { success: true };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return { success: false, error: "An item with this SKU already exists." };
    }
    return { success: false, error: "Failed to update item. Please try again." };
  }
}

export async function stockIn(itemId: string, quantity: number, targetBranchId?: string): Promise<ActionResult> {
  const managerResult = await requireManager();
  if ("error" in managerResult) return managerResult;
  const orgId = managerResult.organizationId;

  const branchId = managerResult.role === "ADMIN"
    ? (targetBranchId ?? null)
    : managerResult.branchId;
  if (!branchId) {
    return {
      success: false,
      error: managerResult.role === "ADMIN"
        ? "Please select a branch to stock into."
        : "No branch assigned to your account.",
    };
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, error: "Quantity must be a positive whole number." };
  }

  try {
    const item = await db.item.findUnique({
      where: { id: itemId },
      select: { name: true, isActive: true, organizationId: true },
    });
    if (!item || item.organizationId !== orgId) return { success: false, error: "Item not found." };
    if (!item.isActive) return { success: false, error: "Cannot stock an inactive item." };

    await db.$transaction([
      db.branchStock.upsert({
        where: { itemId_branchId: { itemId, branchId } },
        update: { stockQty: { increment: quantity } },
        create: { itemId, branchId, stockQty: quantity, lowStockThreshold: 5 },
      }),
      db.stockLog.create({
        data: {
          itemId,
          quantity,
          organizationId: orgId,
          recordedById: managerResult.id,
          branchId,
          reason: "MANUAL_ADJUSTMENT",
        },
      }),
    ]);

    revalidatePath("/inventory");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update stock." };
  }
}

export async function toggleItemActive(id: string): Promise<ActionResult> {
  const adminResult = await requireAdmin();
  if ("error" in adminResult) return adminResult;
  const orgId = adminResult.organizationId;

  try {
    const item = await db.item.findUnique({ where: { id }, select: { isActive: true, organizationId: true } });
    if (!item || item.organizationId !== orgId) return { success: false, error: "Item not found." };
    await db.item.update({ where: { id }, data: { isActive: !item.isActive } });
    revalidatePath("/inventory");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update item status." };
  }
}

// ── Inventory stats ────────────────────────────────────────────────────────

export type InventoryStats = {
  totalActive: number;
  outOfStock: number;
  lowStockItems: number;
  totalStockValue: number;
};

export async function getInventoryStats(branchId?: string | null): Promise<InventoryStats> {
  const session = await auth();
  if (!session?.user?.id) return { totalActive: 0, outOfStock: 0, lowStockItems: 0, totalStockValue: 0 };
  const orgId = session.user.organizationId;
  const effectiveBranchId = branchId !== undefined ? branchId : (session.user.branchId ?? null);

  const items = await db.item.findMany({
    where: { isActive: true, organizationId: orgId },
    select: {
      wholesalePrice: true,
      branchStocks: effectiveBranchId
        ? { where: { branchId: effectiveBranchId }, select: { stockQty: true, lowStockThreshold: true } }
        : { select: { stockQty: true, lowStockThreshold: true } },
    },
  });

  let outOfStock = 0, lowStockItems = 0, totalStockValue = 0;
  for (const item of items) {
    const qty = item.branchStocks.reduce((s, bs) => s + bs.stockQty, 0);
    const threshold = item.branchStocks[0]?.lowStockThreshold ?? 5;
    if (qty === 0) outOfStock++;
    else if (qty <= threshold) lowStockItems++;
    totalStockValue += Number(item.wholesalePrice) * qty;
  }

  return { totalActive: items.length, outOfStock, lowStockItems, totalStockValue };
}

// ── Per-branch stock breakdown ─────────────────────────────────────────────

export type ItemBranchStock = {
  branchId: string;
  branchName: string;
  stockQty: number;
  lowStockThreshold: number;
};

export async function getItemBranchStocks(itemId: string): Promise<ItemBranchStock[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const orgId = session.user.organizationId;

  // Verify the item belongs to this org
  const item = await db.item.findUnique({ where: { id: itemId }, select: { organizationId: true } });
  if (!item || item.organizationId !== orgId) return [];

  const rows = await db.branchStock.findMany({
    where: { itemId },
    select: {
      branchId: true,
      stockQty: true,
      lowStockThreshold: true,
      branch: { select: { name: true } },
    },
    orderBy: { branch: { name: "asc" } },
  });
  return rows.map((r) => ({
    branchId: r.branchId,
    branchName: r.branch.name,
    stockQty: r.stockQty,
    lowStockThreshold: r.lowStockThreshold,
  }));
}

// ── SKU generation ─────────────────────────────────────────────────────────

export async function generateSku(category: string): Promise<string> {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  const prefix = categoryToPrefix(category);
  const existing = await db.item.findMany({
    where: {
      sku: { startsWith: `${prefix}-` },
      ...(orgId ? { organizationId: orgId } : {}),
    },
    select: { sku: true },
  });
  let maxNum = 0;
  for (const { sku } of existing) {
    const num = parseInt(sku.slice(prefix.length + 1), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }
  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
}

// ── Categories ─────────────────────────────────────────────────────────────

export async function getCategories() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return db.category.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { name: "asc" },
  });
}

const CategoryNameSchema = z.string().min(1, "Name is required").max(100);

export async function createCategory(name: string): Promise<ActionResult> {
  const managerResult = await requireManager();
  if ("error" in managerResult) return managerResult;
  const orgId = managerResult.organizationId;

  const parsed = CategoryNameSchema.safeParse(name.trim());
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }
  try {
    await db.category.create({ data: { name: parsed.data, organizationId: orgId } });
    revalidatePath("/inventory");
    return { success: true };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return { success: false, error: "A category with this name already exists." };
    }
    return { success: false, error: "Failed to create category." };
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const managerResult = await requireManager();
  if ("error" in managerResult) return managerResult;
  const orgId = managerResult.organizationId;

  try {
    const cat = await db.category.findUnique({ where: { id }, select: { organizationId: true } });
    if (!cat || cat.organizationId !== orgId) return { success: false, error: "Category not found." };

    const usedBy = await db.item.count({ where: { categoryId: id } });
    if (usedBy > 0) {
      return { success: false, error: `Cannot delete - ${usedBy} item${usedBy === 1 ? "" : "s"} use this category.` };
    }
    await db.category.delete({ where: { id } });
    revalidatePath("/inventory");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete category." };
  }
}
