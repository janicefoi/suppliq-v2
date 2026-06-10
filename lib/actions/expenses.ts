"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
export type { ExpenseCategoryValue } from "@/lib/constants/expenses";

// ── Validation ─────────────────────────────────────────────────────────────

const ExpenseSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(300),
  amount: z.number().positive("Amount must be greater than 0"),
  category: z.enum(["RENT", "SALARIES", "UTILITIES", "TRANSPORT", "MAINTENANCE", "MARKETING", "OTHER"]),
  date: z.string().min(1, "Date is required"),
  branchId: z.string().nullable().optional(),
});

export type ExpenseInput = z.infer<typeof ExpenseSchema>;

// ── Types ──────────────────────────────────────────────────────────────────

export type ExpenseRow = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  branchId: string | null;
  branch: { id: string; name: string } | null;
  recordedBy: { name: string };
  createdAt: string;
};

export type ExpenseStats = {
  totalExpenses: number;
  totalAmount: number;
  thisMonthExpenses: number;
  thisMonthAmount: number;
  byCategory: Array<{ category: string; total: number; count: number }>;
};

// ── Guard ──────────────────────────────────────────────────────────────────

async function requireManager() {
  const session = await auth();
  if (!session?.user?.id || session.user.role === "CASHIER") {
    throw new Error("Unauthorized");
  }
  if (session.user.isDemo) throw new Error("Demo accounts are read-only. Sign up to save your own data.");
  return session.user;
}

// ── List expenses ──────────────────────────────────────────────────────────

export async function getExpenses(): Promise<ExpenseRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  if (session.user.role === "CASHIER") return [];
  const orgId = session.user.organizationId;

  const rows = await db.expense.findMany({
    where: { organizationId: orgId },
    include: {
      branch: { select: { id: true, name: true } },
      recordedBy: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  return rows.map((e) => ({
    id: e.id,
    description: e.description,
    amount: Number(e.amount),
    category: e.category,
    date: e.date.toISOString(),
    branchId: e.branchId,
    branch: e.branch,
    recordedBy: e.recordedBy,
    createdAt: e.createdAt.toISOString(),
  }));
}

// ── Stats ──────────────────────────────────────────────────────────────────

export async function getExpenseStats(): Promise<ExpenseStats> {
  const session = await auth();
  if (!session?.user?.id) {
    return { totalExpenses: 0, totalAmount: 0, thisMonthExpenses: 0, thisMonthAmount: 0, byCategory: [] };
  }
  const orgId = session.user.organizationId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [all, thisMonth] = await Promise.all([
    db.expense.findMany({ where: { organizationId: orgId }, select: { amount: true, category: true } }),
    db.expense.findMany({ where: { organizationId: orgId, date: { gte: monthStart } }, select: { amount: true } }),
  ]);

  // Group by category
  const catMap = new Map<string, { total: number; count: number }>();
  for (const e of all) {
    const entry = catMap.get(e.category) ?? { total: 0, count: 0 };
    entry.total += Number(e.amount);
    entry.count += 1;
    catMap.set(e.category, entry);
  }
  const byCategory = [...catMap.entries()]
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total);

  return {
    totalExpenses: all.length,
    totalAmount: all.reduce((s, e) => s + Number(e.amount), 0),
    thisMonthExpenses: thisMonth.length,
    thisMonthAmount: thisMonth.reduce((s, e) => s + Number(e.amount), 0),
    byCategory,
  };
}

// ── Create expense ─────────────────────────────────────────────────────────

export async function createExpense(
  data: ExpenseInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireManager();
    const orgId = user.organizationId;

    const parsed = ExpenseSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const branchId = parsed.data.branchId || null;
    if (branchId) {
      const branch = await db.branch.findFirst({ where: { id: branchId, organizationId: orgId } });
      if (!branch) return { success: false, error: "Branch not found." };
    }

    await db.expense.create({
      data: {
        description: parsed.data.description,
        amount: parsed.data.amount,
        category: parsed.data.category,
        date: new Date(parsed.data.date),
        branchId,
        organizationId: orgId,
        recordedById: user.id,
      },
    });

    revalidatePath("/expenses");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to record expense." };
  }
}

// ── Update expense ─────────────────────────────────────────────────────────

export async function updateExpense(
  id: string,
  data: ExpenseInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireManager();
    const orgId = user.organizationId;

    const parsed = ExpenseSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const existing = await db.expense.findUnique({ where: { id }, select: { organizationId: true } });
    if (!existing || existing.organizationId !== orgId) {
      return { success: false, error: "Expense not found." };
    }

    const branchId = parsed.data.branchId || null;
    if (branchId) {
      const branch = await db.branch.findFirst({ where: { id: branchId, organizationId: orgId } });
      if (!branch) return { success: false, error: "Branch not found." };
    }

    await db.expense.update({
      where: { id },
      data: {
        description: parsed.data.description,
        amount: parsed.data.amount,
        category: parsed.data.category,
        date: new Date(parsed.data.date),
        branchId,
      },
    });

    revalidatePath("/expenses");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update expense." };
  }
}

// ── Delete expense ─────────────────────────────────────────────────────────

export async function deleteExpense(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireManager();
    // Only admins can delete
    if (user.role !== "ADMIN") return { success: false, error: "Only admins can delete expenses." };
    const orgId = user.organizationId;

    const existing = await db.expense.findUnique({ where: { id }, select: { organizationId: true } });
    if (!existing || existing.organizationId !== orgId) {
      return { success: false, error: "Expense not found." };
    }

    await db.expense.delete({ where: { id } });
    revalidatePath("/expenses");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete expense." };
  }
}
