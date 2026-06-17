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
  if (session.user.isDemo) return { success: false as const, error: "Demo accounts are read-only. Sign up to save your own data." };
  return session.user;
}

async function requireManager() {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
  if (session.user.role === "CASHIER") {
    return { success: false as const, error: "You don't have permission to modify inventory." };
  }
  if (session.user.isDemo) return { success: false as const, error: "Demo accounts are read-only. Sign up to save your own data." };
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

// ── Lean item list for purchase order dialog ───────────────────────────────

export type PurchasableItem = {
  id: string;
  sku: string;
  name: string;
  retailPrice: string;
  wholesalePrice: string;
  stockQty: number;
};

export async function getPurchasableItems(branchId?: string | null): Promise<PurchasableItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const orgId = session.user.organizationId;
  const effectiveBranchId = branchId !== undefined ? branchId : (session.user.branchId ?? null);

  const items = await db.item.findMany({
    where: { organizationId: orgId, isActive: true },
    select: {
      id: true,
      sku: true,
      name: true,
      retailPrice: true,
      wholesalePrice: true,
      branchStocks: effectiveBranchId
        ? { where: { branchId: effectiveBranchId }, select: { stockQty: true } }
        : { select: { stockQty: true } },
    },
    orderBy: { name: "asc" },
  });

  return items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    retailPrice: item.retailPrice.toString(),
    wholesalePrice: item.wholesalePrice.toString(),
    stockQty: item.branchStocks.reduce((sum, bs) => sum + bs.stockQty, 0),
  }));
}

// ── Stockout risk scores ───────────────────────────────────────────────────
// Derived from the AI-generated forecasts table + current branch stock.
// No AI service call needed at render time — pure Prisma reads.

export type StockoutRiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type StockoutRisk = {
  level: StockoutRiskLevel;
  daysOfStock: number | null;    // null when demand is 0 (safe) or data missing
  avgDailyDemand: number | null; // null when no forecast exists
  confidenceScore: number | null;
};

const LEAD_TIME_DAYS = 7;   // default assumed reorder lead time
const HORIZON_DAYS = 30;    // must match demand.py MODEL_HORIZON

export async function getStockoutRisks(
  branchId?: string | null
): Promise<Record<string, StockoutRisk>> {
  const session = await auth();
  if (!session?.user?.id) return {};

  const orgId = session.user.organizationId;
  const effectiveBranchId = branchId !== undefined ? branchId : (session.user.branchId ?? null);
  // Only use forecasts generated in the last 48 h — stale forecasts mislead more than no data
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Sum predicted demand per item across branches (or for one branch)
  const forecastGroups = await db.forecast.groupBy({
    by: ["itemId"],
    where: {
      organizationId: orgId,
      generatedAt: { gte: since },
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
    },
    _sum: { predictedDemand: true },
    _avg: { confidenceScore: true },
  });

  if (forecastGroups.length === 0) return {};

  const itemIds = forecastGroups.map((g) => g.itemId);

  // Sum current stock per item across branches (or for one branch)
  const stockGroups = await db.branchStock.groupBy({
    by: ["itemId"],
    where: {
      item: { organizationId: orgId },
      itemId: { in: itemIds },
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
    },
    _sum: { stockQty: true },
  });

  const stockByItem: Record<string, number> = Object.fromEntries(
    stockGroups.map((s) => [s.itemId, Number(s._sum.stockQty ?? 0)])
  );

  const risks: Record<string, StockoutRisk> = {};

  for (const g of forecastGroups) {
    const totalDemand = Number(g._sum.predictedDemand ?? 0);
    const confidence  = Number(g._avg.confidenceScore ?? 0);
    const stockQty    = stockByItem[g.itemId] ?? 0;

    if (totalDemand <= 0) {
      // Item has no recent sales → demand is zero → no risk from stockout
      risks[g.itemId] = { level: "LOW", daysOfStock: null, avgDailyDemand: 0, confidenceScore: confidence };
      continue;
    }

    const avgDailyDemand = totalDemand / HORIZON_DAYS;
    const daysOfStock    = stockQty > 0 ? stockQty / avgDailyDemand : 0;

    let level: StockoutRiskLevel;
    if (stockQty === 0)                         level = "CRITICAL";
    else if (daysOfStock <= LEAD_TIME_DAYS)     level = "CRITICAL";
    else if (daysOfStock <= LEAD_TIME_DAYS * 2) level = "HIGH";
    else if (daysOfStock <= LEAD_TIME_DAYS * 3) level = "MEDIUM";
    else                                         level = "LOW";

    risks[g.itemId] = {
      level,
      daysOfStock:     Math.round(daysOfStock),
      avgDailyDemand:  Math.round(avgDailyDemand * 10) / 10,
      confidenceScore: Math.round(confidence * 100) / 100,
    };
  }

  return risks;
}

// ── Per-item forecast data for the PO form ────────────────────────────────

export type ItemForecastData = {
  itemId: string;
  demand30d: number;
  demand60d: number;
  demand90d: number;
  avgDailyDemand: number;
  confidenceScore: number; // 0–100 integer
  generatedAt: string;
  stockQty: number;
  daysOfStock: number | null;   // null when avg demand is 0
  suggestedOrderQty: number | null;
};

export async function getItemForecastData(
  itemId: string,
  branchId?: string | null
): Promise<ItemForecastData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const orgId = session.user.organizationId;
  const effectiveBranchId = branchId !== undefined ? branchId : (session.user.branchId ?? null);
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const groups = await db.forecast.groupBy({
    by: ["itemId"],
    where: {
      organizationId: orgId,
      itemId,
      generatedAt: { gte: since },
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
    },
    _sum: { predictedDemand: true },
    _avg: { confidenceScore: true },
    _max: { generatedAt: true },
  });

  if (groups.length === 0) return null;

  const g = groups[0];
  const demand30d = Math.round(Number(g._sum.predictedDemand ?? 0));
  const confidence = Math.round(Number(g._avg.confidenceScore ?? 0) * 100);
  const avgDaily   = demand30d / 30;

  const stockGroups = await db.branchStock.groupBy({
    by: ["itemId"],
    where: {
      item: { organizationId: orgId },
      itemId,
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
    },
    _sum: { stockQty: true },
  });

  const stockQty   = Number(stockGroups[0]?._sum?.stockQty ?? 0);
  const daysOfStock   = avgDaily > 0 ? Math.round(stockQty / avgDaily) : null;
  // How many more units to cover the next 30d horizon beyond current stock
  const suggestedOrderQty = avgDaily > 0 ? Math.max(0, Math.round(demand30d - stockQty)) : null;

  return {
    itemId,
    demand30d,
    demand60d: Math.round(avgDaily * 60),
    demand90d: Math.round(avgDaily * 90),
    avgDailyDemand: Math.round(avgDaily * 10) / 10,
    confidenceScore: confidence,
    generatedAt: g._max.generatedAt?.toISOString() ?? new Date().toISOString(),
    stockQty,
    daysOfStock,
    suggestedOrderQty,
  };
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

export async function markdownItem(
  itemId: string,
  newRetailPrice: number
): Promise<ActionResult> {
  const adminResult = await requireAdmin();
  if ("error" in adminResult) return adminResult;
  const orgId = adminResult.organizationId;

  if (newRetailPrice <= 0) return { success: false, error: "Price must be greater than zero." };

  const existing = await db.item.findUnique({
    where: { id: itemId },
    select: { organizationId: true },
  });
  if (!existing || existing.organizationId !== orgId) {
    return { success: false, error: "Item not found." };
  }

  await db.item.update({
    where: { id: itemId },
    data: { retailPrice: newRetailPrice },
  });

  revalidatePath("/inventory");
  revalidatePath("/insights/overstock");
  return { success: true };
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

// ── CSV import ─────────────────────────────────────────────────────────────

export type ImportItemRow = {
  name: string;
  sku?: string;
  category?: string;
  retailPrice: number;
  wholesalePrice?: number;
  costPrice?: number;
  unit?: string;
  reorderPoint?: number;
  initialStock?: number;
  description?: string;
};

export type ImportSummary = {
  imported: number;
  skipped: number;
  errors: { row: number; name: string; message: string }[];
};

export async function importItems(
  rows: ImportItemRow[]
): Promise<{ success: true; summary: ImportSummary } | { success: false; error: string }> {
  const adminResult = await requireAdmin();
  if ("error" in adminResult) return { success: false, error: adminResult.error };
  const orgId = adminResult.organizationId;
  const userBranchId = adminResult.branchId;

  const branches = await db.branch.findMany({
    where: { isActive: true, organizationId: orgId },
    select: { id: true },
  });

  const existingSkuRows = await db.item.findMany({
    where: { organizationId: orgId },
    select: { sku: true },
  });
  const existingSkus = new Set(existingSkuRows.map((r) => r.sku.toLowerCase()));

  // Category name -> id cache; creates category if missing
  const categoryCache: Record<string, string> = {};
  async function resolveCategory(name: string): Promise<string> {
    const key = name.trim().toLowerCase();
    if (categoryCache[key]) return categoryCache[key];
    const found = await db.category.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" }, organizationId: orgId },
      select: { id: true },
    });
    if (found) { categoryCache[key] = found.id; return found.id; }
    const created = await db.category.create({
      data: { name: name.trim(), organizationId: orgId },
    });
    categoryCache[key] = created.id;
    return created.id;
  }

  // Per-prefix SKU counter so batch imports get sequential numbers
  const skuCounters: Record<string, number> = {};
  async function autoSku(category?: string): Promise<string> {
    const prefix = category?.trim() ? categoryToPrefix(category) : "ITM";
    if (skuCounters[prefix] === undefined) {
      const existing = await db.item.findMany({
        where: { sku: { startsWith: `${prefix}-` }, organizationId: orgId },
        select: { sku: true },
      });
      let max = 0;
      for (const { sku } of existing) {
        const n = parseInt(sku.slice(prefix.length + 1), 10);
        if (!isNaN(n) && n > max) max = n;
      }
      skuCounters[prefix] = max;
    }
    skuCounters[prefix]++;
    return `${prefix}-${String(skuCounters[prefix]).padStart(3, "0")}`;
  }

  const summary: ImportSummary = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    if (!row.name?.trim()) {
      summary.skipped++;
      summary.errors.push({ row: rowNum, name: row.name ?? "(empty)", message: "Name is required" });
      continue;
    }
    if (!row.retailPrice || row.retailPrice <= 0) {
      summary.skipped++;
      summary.errors.push({ row: rowNum, name: row.name, message: "Retail price must be greater than 0" });
      continue;
    }

    const sku = row.sku?.trim() || (await autoSku(row.category));
    if (existingSkus.has(sku.toLowerCase())) {
      summary.skipped++;
      summary.errors.push({ row: rowNum, name: row.name, message: `SKU "${sku}" already exists` });
      continue;
    }
    existingSkus.add(sku.toLowerCase());

    let categoryId: string | null = null;
    if (row.category?.trim()) {
      try { categoryId = await resolveCategory(row.category); }
      catch {
        summary.skipped++;
        summary.errors.push({ row: rowNum, name: row.name, message: "Failed to create category" });
        continue;
      }
    }

    const retailPrice = row.retailPrice;
    const wholesalePrice =
      row.wholesalePrice && row.wholesalePrice > 0 && row.wholesalePrice <= retailPrice
        ? row.wholesalePrice
        : retailPrice;
    const unit = row.unit?.trim() || "pcs";
    const reorderPoint =
      typeof row.reorderPoint === "number" && row.reorderPoint >= 0 ? Math.floor(row.reorderPoint) : 10;
    const initialStock =
      typeof row.initialStock === "number" && row.initialStock >= 0 ? Math.floor(row.initialStock) : 0;

    try {
      const item = await db.item.create({
        data: {
          sku,
          name: row.name.trim(),
          categoryId,
          description: row.description?.trim() || null,
          retailPrice,
          wholesalePrice,
          costPrice: row.costPrice && row.costPrice > 0 ? row.costPrice : null,
          unit,
          reorderPoint,
          organizationId: orgId,
        },
      });

      for (const branch of branches) {
        await db.branchStock.create({
          data: {
            itemId: item.id,
            branchId: branch.id,
            stockQty: branch.id === userBranchId ? initialStock : 0,
            lowStockThreshold: reorderPoint,
          },
        });
      }

      summary.imported++;
    } catch {
      summary.skipped++;
      summary.errors.push({ row: rowNum, name: row.name, message: "Failed to save item" });
    }
  }

  revalidatePath("/inventory");
  return { success: true, summary };
}

// ── Stock adjustment ───────────────────────────────────────────────────────

export type AdjustStockResult =
  | { success: true; delta: number }
  | { success: false; error: string };

export async function adjustStock(
  itemId: string,
  branchId: string,
  newQty: number,
  reason: string
): Promise<AdjustStockResult> {
  const adminResult = await requireAdmin();
  if ("error" in adminResult) return { success: false, error: adminResult.error };
  const orgId = adminResult.organizationId;

  if (!Number.isInteger(newQty) || newQty < 0) {
    return { success: false, error: "Physical count must be a non-negative whole number." };
  }
  if (!reason.trim()) {
    return { success: false, error: "Please select a reason for the adjustment." };
  }

  try {
    const item = await db.item.findUnique({
      where: { id: itemId },
      select: { organizationId: true, isActive: true },
    });
    if (!item || item.organizationId !== orgId) return { success: false, error: "Item not found." };

    const branch = await db.branch.findFirst({ where: { id: branchId, organizationId: orgId } });
    if (!branch) return { success: false, error: "Branch not found." };

    const current = await db.branchStock.findUnique({
      where: { itemId_branchId: { itemId, branchId } },
      select: { stockQty: true },
    });
    const currentQty = current?.stockQty ?? 0;
    const delta = newQty - currentQty;

    await db.$transaction([
      db.branchStock.upsert({
        where: { itemId_branchId: { itemId, branchId } },
        update: { stockQty: newQty },
        create: { itemId, branchId, stockQty: newQty, lowStockThreshold: 5 },
      }),
      ...(delta !== 0
        ? [
            db.stockLog.create({
              data: {
                itemId,
                branchId,
                organizationId: orgId,
                quantity: delta,
                reason: "MANUAL_ADJUSTMENT",
                referenceId: reason.trim(),
                recordedById: adminResult.id,
              },
            }),
          ]
        : []),
    ]);

    revalidatePath("/inventory");
    return { success: true, delta };
  } catch {
    return { success: false, error: "Failed to adjust stock." };
  }
}
