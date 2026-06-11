"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CompleteSaleSchema, type CompleteSaleInput } from "@/lib/validations/pos";
import { VAT_EXTRACT } from "@/lib/constants/tax";
import { sendLowStockAlert, type LowStockEmailItem } from "@/lib/email";

// ── Receipt number: RCP-YYYYMMDD-XXXX (org-scoped) ────────────────────────

async function generateReceiptNumber(orgId: string): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `RCP-${dateStr}-`;

  const last = await db.sale.findFirst({
    where: { receiptNumber: { startsWith: prefix }, organizationId: orgId },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });

  const next = last ? parseInt(last.receiptNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ── Item search ───────────────────────────────────────────────────────────

export type SearchedItem = {
  id: string;
  name: string;
  sku: string;
  category: string;
  stockQty: number;
  retailPrice: string;
  wholesalePrice: string;
  specialPrice: string | null;
};

export async function searchItems(query: string): Promise<SearchedItem[]> {
  const q = query.trim();
  if (!q) return [];

  const session = await auth();
  if (!session?.user?.id) return [];
  const orgId = session.user.organizationId;
  const branchId = session.user.branchId ?? null;

  const rows = await db.item.findMany({
    where: {
      isActive: true,
      organizationId: orgId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      category: { select: { name: true } },
      retailPrice: true,
      wholesalePrice: true,
      specialPrice: true,
      branchStocks: branchId ? { where: { branchId } } : true,
    },
    take: 15,
    orderBy: { name: "asc" },
  });

  return JSON.parse(JSON.stringify(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      category: r.category?.name ?? "",
      retailPrice: r.retailPrice,
      wholesalePrice: r.wholesalePrice,
      specialPrice: r.specialPrice,
      stockQty: (branchId
        ? r.branchStocks.find((bs: { branchId: string; stockQty: number }) => bs.branchId === branchId)
        : r.branchStocks[0]
      )?.stockQty ?? 0,
    }))
  ));
}

// ── Customer search ───────────────────────────────────────────────────────

export type SearchedCustomer = {
  id: string;
  name: string;
  phone: string;
  creditBalance: string;
};

export async function searchCustomers(query: string): Promise<SearchedCustomer[]> {
  const q = query.trim();
  if (!q) return [];

  const session = await auth();
  if (!session?.user?.id) return [];
  const orgId = session.user.organizationId;

  const rows = await db.customer.findMany({
    where: {
      organizationId: orgId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    select: { id: true, name: true, phone: true, creditBalance: true },
    take: 8,
    orderBy: { name: "asc" },
  });

  return JSON.parse(JSON.stringify(rows));
}

// ── Sale result type ──────────────────────────────────────────────────────

export type SaleResult = {
  id: string;
  receiptNumber: string;
  saleType: string;
  paymentStatus: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  createdAt: string;
  organization: { name: string; phone: string | null; address: string | null; email: string | null; website: string | null; taxId: string | null; vatRate: string; currency: string } | null;
  branch: { name: string; address: string | null; phone: string | null; paybill: string | null; pin: string | null } | null;
  customer: { name: string; phone: string; creditBalance: string } | null;
  employee: { name: string };
  items: Array<{
    quantity: number;
    unitPrice: string;
    subtotal: string;
    item: { name: string; sku: string };
  }>;
};

// ── Complete sale ─────────────────────────────────────────────────────────

export async function completeSale(
  data: CompleteSaleInput
): Promise<{ success: true; sale: SaleResult } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.isDemo) return { success: false, error: "Demo accounts are read-only. Sign up to save your own data." };
  const orgId = session.user.organizationId;

  const parsed = CompleteSaleSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  if (parsed.data.paymentStatus === "CREDIT" && !parsed.data.customerId) {
    return { success: false, error: "Credit payment requires a customer to be selected." };
  }

  const itemsTotal = parsed.data.items.reduce((sum, i) => sum + i.subtotal, 0);
  if (parsed.data.discountAmount > itemsTotal) {
    return { success: false, error: "Discount cannot exceed the total item value." };
  }
  const expectedTotal = +(itemsTotal - parsed.data.discountAmount).toFixed(2);
  if (expectedTotal <= 0) {
    return { success: false, error: "Sale total must be greater than zero after discount." };
  }
  if (Math.abs(expectedTotal - parsed.data.totalAmount) > 0.02) {
    return { success: false, error: "Total amount mismatch - please try again." };
  }

  const computedTax = Math.round(parsed.data.totalAmount * VAT_EXTRACT * 100) / 100;

  const branchId = session.user.branchId;
  if (!branchId) return { success: false, error: "Your account has no branch assigned. Please contact the admin." };

  const receiptNumber = await generateReceiptNumber(orgId);

  // Track items that cross the low-stock threshold during this sale
  const newlyLowItems: LowStockEmailItem[] = [];

  try {
    const sale = await db.$transaction(async (tx) => {
      // 1. Verify stock availability and collect pre-sale stock levels
      const lineStocks: Array<{
        itemId: string; itemName: string; itemSku: string;
        prevQty: number; threshold: number;
      }> = [];

      for (const line of parsed.data.items) {
        const item = await tx.item.findUnique({
          where: { id: line.itemId },
          select: { name: true, sku: true, isActive: true, organizationId: true },
        });
        if (!item || !item.isActive || item.organizationId !== orgId) {
          throw new Error(`Item not found or has been deactivated.`);
        }

        const branchStock = await tx.branchStock.findUnique({
          where: { itemId_branchId: { itemId: line.itemId, branchId } },
        });
        const available = branchStock?.stockQty ?? 0;
        if (available < line.quantity) {
          throw new Error(
            `Insufficient stock for "${item.name}" at this branch. Available: ${available}, requested: ${line.quantity}.`
          );
        }
        lineStocks.push({
          itemId: line.itemId,
          itemName: item.name,
          itemSku: item.sku,
          prevQty: available,
          threshold: branchStock?.lowStockThreshold ?? 5,
        });
      }

      // 2. Create Sale + SaleItems
      const created = await tx.sale.create({
        data: {
          receiptNumber,
          saleType: parsed.data.saleType,
          paymentStatus: parsed.data.paymentStatus,
          discountAmount: parsed.data.discountAmount,
          taxAmount: computedTax,
          totalAmount: parsed.data.totalAmount,
          isVoid: false,
          customerId: parsed.data.customerId,
          employeeId: session.user.id,
          branchId,
          organizationId: orgId,
          items: {
            create: parsed.data.items.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              subtotal: i.subtotal,
            })),
          },
        },
        include: {
          items: { include: { item: { select: { name: true, sku: true } } } },
          organization: { select: { name: true, phone: true, address: true, email: true, website: true, taxId: true, vatRate: true, currency: true } },
          branch: { select: { name: true, address: true, phone: true, paybill: true, pin: true } },
          customer: { select: { name: true, phone: true, creditBalance: true } },
          employee: { select: { name: true } },
        },
      });

      // 3. Decrement branch stock + write StockLog, detect threshold crossings
      for (const line of parsed.data.items) {
        await tx.branchStock.update({
          where: { itemId_branchId: { itemId: line.itemId, branchId } },
          data: { stockQty: { decrement: line.quantity } },
        });

        await tx.stockLog.create({
          data: {
            itemId: line.itemId,
            branchId,
            organizationId: orgId,
            quantity: -line.quantity,
            reason: "SALE",
            referenceId: created.id,
            recordedById: session.user.id,
          },
        });

        // Check if this sale just pushed the item below its threshold
        const ls = lineStocks.find((s) => s.itemId === line.itemId);
        if (ls) {
          const newQty = ls.prevQty - line.quantity;
          if (ls.prevQty > ls.threshold && newQty <= ls.threshold) {
            newlyLowItems.push({
              name: ls.itemName,
              sku: ls.itemSku,
              stockQty: newQty,
              lowStockThreshold: ls.threshold,
              branchName: created.branch?.name ?? "Unknown branch",
            });
          }
        }
      }

      // 4. Update customer credit balance
      if (parsed.data.paymentStatus === "CREDIT" && parsed.data.customerId) {
        await tx.customer.update({
          where: { id: parsed.data.customerId },
          data: { creditBalance: { increment: parsed.data.totalAmount } },
        });
        const freshCustomer = await tx.customer.findUnique({
          where: { id: parsed.data.customerId },
          select: { name: true, phone: true, creditBalance: true },
        });
        return { ...created, customer: freshCustomer };
      }

      return created;
    });

    revalidatePath("/inventory");

    // Fire low-stock email in background after sale commits (never blocks the response)
    if (newlyLowItems.length > 0) {
      db.user.findMany({
        where: { organizationId: orgId, role: "ADMIN", isActive: true },
        select: { email: true },
      }).then(async (admins) => {
        const org = await db.organization.findUnique({
          where: { id: orgId },
          select: { name: true },
        });
        const emails = admins.map((u) => u.email);
        await sendLowStockAlert(emails, org?.name ?? "Your organisation", newlyLowItems);
      }).catch(() => {});
    }

    return { success: true, sale: JSON.parse(JSON.stringify(sale)) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to complete sale. Please try again.";
    return { success: false, error: msg };
  }
}

// ── Fetch sale by ID (for receipt modal) ─────────────────────────────────

export async function getSaleById(id: string): Promise<SaleResult | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const orgId = session.user.organizationId;

  const sale = await db.sale.findFirst({
    where: { id, organizationId: orgId },
    include: {
      items: { include: { item: { select: { name: true, sku: true } } } },
      organization: { select: { name: true, phone: true, address: true, email: true, website: true, taxId: true, vatRate: true, currency: true } },
      branch: { select: { name: true, address: true, phone: true, paybill: true, pin: true } },
      customer: { select: { name: true, phone: true, creditBalance: true } },
      employee: { select: { name: true } },
    },
  });

  if (!sale) return null;
  return JSON.parse(JSON.stringify(sale));
}
