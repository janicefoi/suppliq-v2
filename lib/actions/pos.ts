"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CompleteSaleSchema, type CompleteSaleInput } from "@/lib/validations/pos";
import { VAT_EXTRACT } from "@/lib/constants/tax";

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

  try {
    const sale = await db.$transaction(async (tx) => {
      // 1. Verify stock availability (items must belong to this org)
      for (const line of parsed.data.items) {
        const item = await tx.item.findUnique({
          where: { id: line.itemId },
          select: { name: true, isActive: true, organizationId: true },
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
          branch: { select: { name: true, address: true, phone: true, paybill: true, pin: true } },
          customer: { select: { name: true, phone: true, creditBalance: true } },
          employee: { select: { name: true } },
        },
      });

      // 3. Decrement branch stock + write StockLog (AI demand signal)
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
      branch: { select: { name: true, address: true, phone: true, paybill: true, pin: true } },
      customer: { select: { name: true, phone: true, creditBalance: true } },
      employee: { select: { name: true } },
    },
  });

  if (!sale) return null;
  return JSON.parse(JSON.stringify(sale));
}
