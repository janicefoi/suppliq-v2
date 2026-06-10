"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CustomerSchema, type CustomerInput } from "@/lib/validations/customers";

// ── Types ─────────────────────────────────────────────────────────────────

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  creditBalance: string;
  createdAt: string;
  branchId: string | null;
  branch: { name: string } | null;
  _count: { sales: number };
};

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  creditBalance: string;
  createdAt: string;
  updatedAt: string;
  branchId: string | null;
  branch: { name: string; address: string | null; phone: string | null; paybill: string | null } | null;
  sales: Array<{
    id: string;
    receiptNumber: string;
    saleType: string;
    paymentStatus: string;
    totalAmount: string;
    taxAmount: string;
    discountAmount: string;
    createdAt: string;
  }>;
  creditPayments: Array<{
    id: string;
    amount: string;
    notes: string | null;
    createdAt: string;
    recordedBy: { name: string };
  }>;
};

// ── Customer stats ────────────────────────────────────────────────────────

export type CustomerStats = {
  total: number;
  withCredit: number;
  totalOutstanding: number;
  newThisMonth: number;
};

export async function getCustomerStats(branchId?: string | null): Promise<CustomerStats> {
  const session = await auth();
  if (!session?.user?.id) return { total: 0, withCredit: 0, totalOutstanding: 0, newThisMonth: 0 };
  const orgId = session.user.organizationId;
  const effectiveBranchId = branchId !== undefined ? branchId : session.user.branchId ?? null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const baseWhere = {
    organizationId: orgId,
    ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
  };

  const [total, withCredit, creditAgg, newThisMonth] = await Promise.all([
    db.customer.count({ where: baseWhere }),
    db.customer.count({ where: { ...baseWhere, creditBalance: { gt: 0 } } }),
    db.customer.aggregate({ _sum: { creditBalance: true }, where: { ...baseWhere, creditBalance: { gt: 0 } } }),
    db.customer.count({ where: { ...baseWhere, createdAt: { gte: monthStart } } }),
  ]);

  return {
    total,
    withCredit,
    totalOutstanding: Number(creditAgg._sum.creditBalance ?? 0),
    newThisMonth,
  };
}

// ── Get customers list ────────────────────────────────────────────────────

export async function getCustomers(
  filter: "ALL" | "HAS_CREDIT" | "NO_CREDIT" = "ALL",
  branchId?: string | null
): Promise<CustomerRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const orgId = session.user.organizationId;
  const effectiveBranchId = branchId !== undefined ? branchId : session.user.branchId ?? null;

  const where = {
    organizationId: orgId,
    ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
    ...(filter === "HAS_CREDIT" ? { creditBalance: { gt: 0 } } : {}),
    ...(filter === "NO_CREDIT" ? { creditBalance: { lte: 0 } } : {}),
  };

  const rows = await db.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      creditBalance: true,
      createdAt: true,
      branchId: true,
      branch: { select: { name: true } },
      _count: { select: { sales: true } },
    },
    orderBy: { name: "asc" },
  });

  return JSON.parse(JSON.stringify(rows));
}

// ── Create customer ───────────────────────────────────────────────────────

export async function createCustomer(
  data: CustomerInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.isDemo) return { success: false, error: "Demo accounts are read-only. Sign up to save your own data." };
  const orgId = session.user.organizationId;

  const parsed = CustomerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Phone uniqueness is scoped per organisation
  const existing = await db.customer.findFirst({
    where: { phone: parsed.data.phone, organizationId: orgId },
  });
  if (existing) {
    return { success: false, error: "A customer with this phone number already exists." };
  }

  const branchId = parsed.data.branchId ?? session.user.branchId ?? null;

  await db.customer.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      address: parsed.data.address ?? null,
      branchId,
      organizationId: orgId,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/admin/branches");
  return { success: true };
}

// ── Update customer ───────────────────────────────────────────────────────

export async function updateCustomer(
  id: string,
  data: CustomerInput
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role === "CASHIER") return { success: false, error: "You don't have permission to edit customers." };
  if (session.user.isDemo) return { success: false, error: "Demo accounts are read-only. Sign up to save your own data." };
  const orgId = session.user.organizationId;

  const parsed = CustomerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Verify customer belongs to this org
  const customer = await db.customer.findUnique({ where: { id }, select: { organizationId: true } });
  if (!customer || customer.organizationId !== orgId) {
    return { success: false, error: "Customer not found." };
  }

  const existing = await db.customer.findFirst({
    where: { phone: parsed.data.phone, organizationId: orgId, NOT: { id } },
  });
  if (existing) {
    return { success: false, error: "Another customer already uses this phone number." };
  }

  await db.customer.update({
    where: { id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      address: parsed.data.address ?? null,
      ...(session.user.role === "ADMIN" && { branchId: parsed.data.branchId ?? null }),
    },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/admin/branches");
  return { success: true };
}

// ── Record credit payment ─────────────────────────────────────────────────

export async function recordCreditPayment(
  customerId: string,
  amount: number,
  notes: string | null
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const orgId = session.user.organizationId;

  if (amount <= 0) return { success: false, error: "Amount must be greater than zero." };

  try {
    await db.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { creditBalance: true, name: true, organizationId: true },
      });
      if (!customer || customer.organizationId !== orgId) throw new Error("Customer not found.");

      const balance = Number(customer.creditBalance);
      if (amount > balance) {
        throw new Error(
          `Payment amount (${amount.toFixed(2)}) exceeds credit balance (${balance.toFixed(2)}).`
        );
      }

      await tx.creditPayment.create({
        data: {
          customerId,
          amount,
          notes: notes || null,
          recordedById: session.user.id,
        },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: { creditBalance: { decrement: amount } },
      });
    });

    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record payment.",
    };
  }
}

// ── Get customer detail ───────────────────────────────────────────────────

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const orgId = session.user.organizationId;

  const customer = await db.customer.findFirst({
    where: { id, organizationId: orgId },
    include: {
      branch: { select: { name: true, address: true, phone: true, paybill: true } },
      sales: {
        select: {
          id: true,
          receiptNumber: true,
          saleType: true,
          paymentStatus: true,
          totalAmount: true,
          taxAmount: true,
          discountAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      creditPayments: {
        select: {
          id: true,
          amount: true,
          notes: true,
          createdAt: true,
          recordedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) return null;
  return JSON.parse(JSON.stringify(customer));
}
