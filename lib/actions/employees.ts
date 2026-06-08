"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from "@/lib/validations/employees";

// ── Types ─────────────────────────────────────────────────────────────────

export type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  branchId: string | null;
  branch: { id: string; name: string } | null;
};

// ── Guard ─────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

// ── Get employees ─────────────────────────────────────────────────────────

export async function getEmployees(): Promise<EmployeeRow[]> {
  await requireAdmin();

  const employees = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      branchId: true,
      branch: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  return JSON.parse(JSON.stringify(employees));
}

// ── Create employee ───────────────────────────────────────────────────────

export async function createEmployee(
  data: CreateEmployeeInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin();

    const parsed = CreateEmployeeSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return { success: false, error: "An employee with this email already exists." };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role as "ADMIN" | "MANAGER" | "CASHIER",
        passwordHash,
        branchId: parsed.data.branchId ?? null,
      },
    });

    revalidatePath("/admin/employees");
    revalidatePath("/admin/branches");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create employee." };
  }
}

// ── Update employee ───────────────────────────────────────────────────────

export async function updateEmployee(
  id: string,
  data: UpdateEmployeeInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const admin = await requireAdmin();

    const parsed = UpdateEmployeeSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    // Prevent admin from changing their own role
    if (id === admin.id) {
      return { success: false, error: "You cannot edit your own account here." };
    }

    const duplicate = await db.user.findFirst({
      where: { email: parsed.data.email, NOT: { id } },
    });
    if (duplicate) {
      return { success: false, error: "Another employee already uses this email." };
    }

    await db.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role as "ADMIN" | "MANAGER" | "CASHIER",
        branchId: parsed.data.branchId ?? null,
      },
    });

    revalidatePath("/admin/employees");
    revalidatePath("/admin/branches");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update employee." };
  }
}

// ── Toggle active ─────────────────────────────────────────────────────────

export async function toggleEmployeeActive(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const admin = await requireAdmin();

    if (id === admin.id) {
      return { success: false, error: "You cannot deactivate your own account." };
    }

    const employee = await db.user.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!employee) return { success: false, error: "Employee not found." };

    await db.user.update({
      where: { id },
      data: { isActive: !employee.isActive },
    });

    revalidatePath("/admin/employees");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update status." };
  }
}

// ── Reset password ────────────────────────────────────────────────────────

export async function resetEmployeePassword(
  id: string,
  newPassword: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin();

    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters." };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.user.update({ where: { id }, data: { passwordHash } });

    revalidatePath("/admin/employees");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to reset password." };
  }
}
