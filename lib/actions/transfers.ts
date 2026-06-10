"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ── Validation ────────────────────────────────────────────────────────────

const TransferSchema = z.object({
  fromBranchId: z.string().min(1, "Select a source branch"),
  toBranchId: z.string().min(1, "Select a destination branch"),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, "Select an item"),
        quantity: z.number().int().positive("Quantity must be at least 1"),
      })
    )
    .min(1, "Add at least one item"),
}).refine((d) => d.fromBranchId !== d.toBranchId, {
  message: "Source and destination branches must be different",
  path: ["toBranchId"],
});

export type TransferInput = z.infer<typeof TransferSchema>;

// ── Types ─────────────────────────────────────────────────────────────────

export type TransferRow = {
  id: string;
  fromBranch: { id: string; name: string };
  toBranch: { id: string; name: string };
  status: string;
  notes: string | null;
  lineCount: number;
  totalQty: number;
  createdAt: string;
  createdBy: { name: string };
  items: Array<{ item: { name: string; sku: string }; quantity: number }>;
};

export type TransferStats = {
  totalTransfers: number;
  totalItemsMoved: number;
  thisMonthTransfers: number;
  thisMonthItemsMoved: number;
};

export type BranchItem = {
  id: string;
  name: string;
  sku: string;
  category: string;
  stockQty: number;
};

// ── Guard ─────────────────────────────────────────────────────────────────

async function requireManager() {
  const session = await auth();
  if (!session?.user?.id || session.user.role === "CASHIER") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

// ── List transfers ─────────────────────────────────────────────────────────

export async function getTransfers(): Promise<TransferRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  if (session.user.role === "CASHIER") return [];
  const orgId = session.user.organizationId;

  const rows = await db.stockTransfer.findMany({
    where: { organizationId: orgId },
    include: {
      fromBranch: { select: { id: true, name: true } },
      toBranch: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      items: {
        include: { item: { select: { name: true, sku: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((t) => ({
    id: t.id,
    fromBranch: t.fromBranch,
    toBranch: t.toBranch,
    status: t.status,
    notes: t.notes,
    lineCount: t.items.length,
    totalQty: t.items.reduce((s, i) => s + i.quantity, 0),
    createdAt: t.createdAt.toISOString(),
    createdBy: t.createdBy,
    items: t.items.map((i) => ({ item: i.item, quantity: i.quantity })),
  }));
}

// ── Stats ──────────────────────────────────────────────────────────────────

export async function getTransferStats(): Promise<TransferStats> {
  const session = await auth();
  if (!session?.user?.id) {
    return { totalTransfers: 0, totalItemsMoved: 0, thisMonthTransfers: 0, thisMonthItemsMoved: 0 };
  }
  const orgId = session.user.organizationId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [allItems, monthItems, totalTransfers, thisMonthTransfers] = await Promise.all([
    db.stockTransferItem.findMany({
      where: { stockTransfer: { organizationId: orgId } },
      select: { quantity: true },
    }),
    db.stockTransferItem.findMany({
      where: { stockTransfer: { organizationId: orgId, createdAt: { gte: monthStart } } },
      select: { quantity: true },
    }),
    db.stockTransfer.count({ where: { organizationId: orgId } }),
    db.stockTransfer.count({ where: { organizationId: orgId, createdAt: { gte: monthStart } } }),
  ]);

  return {
    totalTransfers,
    totalItemsMoved: allItems.reduce((s, i) => s + i.quantity, 0),
    thisMonthTransfers,
    thisMonthItemsMoved: monthItems.reduce((s, i) => s + i.quantity, 0),
  };
}

// ── Items available at a branch ────────────────────────────────────────────

export async function getItemsForBranch(branchId: string): Promise<BranchItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  if (session.user.role === "CASHIER") return [];
  const orgId = session.user.organizationId;

  // Verify branch belongs to this org
  const branch = await db.branch.findFirst({
    where: { id: branchId, organizationId: orgId },
    select: { id: true },
  });
  if (!branch) return [];

  const stocks = await db.branchStock.findMany({
    where: { branchId, stockQty: { gt: 0 }, item: { organizationId: orgId, isActive: true } },
    include: {
      item: {
        select: { id: true, name: true, sku: true, category: { select: { name: true } } },
      },
    },
    orderBy: { item: { name: "asc" } },
  });

  return stocks.map((s) => ({
    id: s.item.id,
    name: s.item.name,
    sku: s.item.sku,
    category: s.item.category?.name ?? "",
    stockQty: s.stockQty,
  }));
}

// ── Create transfer ────────────────────────────────────────────────────────

export async function createTransfer(
  data: TransferInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireManager();
    const orgId = user.organizationId;

    const parsed = TransferSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { fromBranchId, toBranchId, notes, items } = parsed.data;

    // Verify both branches belong to this org
    const [fromBranch, toBranch] = await Promise.all([
      db.branch.findFirst({ where: { id: fromBranchId, organizationId: orgId }, select: { id: true, name: true } }),
      db.branch.findFirst({ where: { id: toBranchId, organizationId: orgId }, select: { id: true, name: true } }),
    ]);
    if (!fromBranch) return { success: false, error: "Source branch not found." };
    if (!toBranch) return { success: false, error: "Destination branch not found." };

    // Check for duplicate items in request
    const itemIds = items.map((i) => i.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      return { success: false, error: "Each item can only appear once per transfer." };
    }

    await db.$transaction(async (tx) => {
      // Validate stock availability for each line
      for (const line of items) {
        const stock = await tx.branchStock.findUnique({
          where: { itemId_branchId: { itemId: line.itemId, branchId: fromBranchId } },
          select: { stockQty: true, item: { select: { name: true, organizationId: true } } },
        });
        if (!stock || stock.item.organizationId !== orgId) {
          throw new Error(`Item not found.`);
        }
        if (stock.stockQty < line.quantity) {
          throw new Error(
            `"${stock.item.name}" only has ${stock.stockQty} unit${stock.stockQty !== 1 ? "s" : ""} at ${fromBranch.name}. Cannot transfer ${line.quantity}.`
          );
        }
      }

      // Create the transfer record
      const transfer = await tx.stockTransfer.create({
        data: {
          fromBranchId,
          toBranchId,
          status: "RECEIVED",
          notes: notes || null,
          organizationId: orgId,
          createdById: user.id,
          items: {
            create: items.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
            })),
          },
        },
      });

      // Move stock: deduct from source, add to destination
      for (const line of items) {
        await tx.branchStock.update({
          where: { itemId_branchId: { itemId: line.itemId, branchId: fromBranchId } },
          data: { stockQty: { decrement: line.quantity } },
        });

        await tx.branchStock.upsert({
          where: { itemId_branchId: { itemId: line.itemId, branchId: toBranchId } },
          update: { stockQty: { increment: line.quantity } },
          create: { itemId: line.itemId, branchId: toBranchId, stockQty: line.quantity, lowStockThreshold: 5 },
        });

        // Audit trail
        await tx.stockLog.create({
          data: {
            itemId: line.itemId,
            branchId: fromBranchId,
            organizationId: orgId,
            quantity: -line.quantity,
            reason: "TRANSFER_OUT",
            referenceId: transfer.id,
            recordedById: user.id,
          },
        });

        await tx.stockLog.create({
          data: {
            itemId: line.itemId,
            branchId: toBranchId,
            organizationId: orgId,
            quantity: line.quantity,
            reason: "TRANSFER_IN",
            referenceId: transfer.id,
            recordedById: user.id,
          },
        });
      }
    });

    revalidatePath("/transfers");
    revalidatePath("/inventory");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create transfer.",
    };
  }
}
