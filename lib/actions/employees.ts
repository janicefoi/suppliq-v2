"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkUserLimit } from "@/lib/plan-limits";
import { getPlanLimits } from "@/lib/constants/plans";
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
  const admin = await requireAdmin();

  const employees = await db.user.findMany({
    where: { organizationId: admin.organizationId },
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
    const admin = await requireAdmin();

    const parsed = CreateEmployeeSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    // Plan limit check
    const org = await db.organization.findUnique({
      where: { id: admin.organizationId },
      select: { plan: true },
    });
    const limit = await checkUserLimit(admin.organizationId, org?.plan ?? "FREE");
    if (!limit.allowed) return { success: false, error: limit.error };

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
        organizationId: admin.organizationId,
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

    if (id === admin.id) {
      return { success: false, error: "You cannot edit your own account here." };
    }

    // Verify employee belongs to the same org
    const target = await db.user.findUnique({ where: { id }, select: { organizationId: true } });
    if (!target || target.organizationId !== admin.organizationId) {
      return { success: false, error: "Employee not found." };
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
      select: { isActive: true, organizationId: true },
    });
    if (!employee || employee.organizationId !== admin.organizationId) {
      return { success: false, error: "Employee not found." };
    }

    await db.user.update({ where: { id }, data: { isActive: !employee.isActive } });
    revalidatePath("/admin/employees");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update status." };
  }
}

// ── Import employees (CSV bulk) ───────────────────────────────────────────

export type CsvImportResult = {
  imported: number;
  skipped: Array<{ row: number; value: string; reason: string }>;
  passwords?: Array<{ name: string; email: string; password: string }>;
};

const VALID_ROLES = ["ADMIN", "MANAGER", "CASHIER"] as const;

function generateTempPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function importEmployees(
  rows: Array<Record<string, string>>
): Promise<CsvImportResult> {
  try {
    const admin = await requireAdmin();

    const org = await db.organization.findUnique({
      where: { id: admin.organizationId },
      select: { plan: true },
    });

    const allBranches = await db.branch.findMany({
      where: { organizationId: admin.organizationId },
      select: { id: true, name: true },
    });
    const branchByName = new Map(allBranches.map((b) => [b.name.toLowerCase(), b.id]));

    const existingEmails = new Set(
      (await db.user.findMany({ where: { organizationId: admin.organizationId }, select: { email: true } }))
        .map((u) => u.email)
    );

    let currentCount = await db.user.count({ where: { organizationId: admin.organizationId } });
    const { users: userLimit } = getPlanLimits(org?.plan ?? "FREE");

    let imported = 0;
    const skipped: CsvImportResult["skipped"] = [];
    const passwords: NonNullable<CsvImportResult["passwords"]> = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const name = row.name?.trim();
      const email = row.email?.trim().toLowerCase();
      const role = row.role?.trim().toUpperCase();

      if (!name) { skipped.push({ row: rowNum, value: email ?? "", reason: "name is required" }); continue; }
      if (!email) { skipped.push({ row: rowNum, value: name, reason: "email is required" }); continue; }
      if (!role || !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
        skipped.push({ row: rowNum, value: name, reason: `role must be ADMIN, MANAGER, or CASHIER (got "${row.role?.trim()}")` }); continue;
      }
      if (existingEmails.has(email) || seenEmails.has(email)) {
        skipped.push({ row: rowNum, value: name, reason: `email ${email} already exists` }); continue;
      }
      if (userLimit !== null && currentCount >= userLimit) {
        skipped.push({ row: rowNum, value: name, reason: "user limit reached for your plan" }); continue;
      }

      const branchName = row.branch_name?.trim();
      let branchId: string | null = null;
      if (branchName) {
        branchId = branchByName.get(branchName.toLowerCase()) ?? null;
        if (!branchId) {
          skipped.push({ row: rowNum, value: name, reason: `branch "${branchName}" not found` }); continue;
        }
      }

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      await db.user.create({
        data: {
          name,
          email,
          role: role as "ADMIN" | "MANAGER" | "CASHIER",
          passwordHash,
          branchId,
          organizationId: admin.organizationId,
        },
      });

      seenEmails.add(email);
      passwords.push({ name, email, password: tempPassword });
      currentCount++;
      imported++;
    }

    if (imported > 0) {
      revalidatePath("/admin/employees");
      revalidatePath("/admin/branches");
    }
    return { imported, skipped, passwords };
  } catch (err) {
    return { imported: 0, skipped: [{ row: 0, value: "", reason: err instanceof Error ? err.message : "Import failed" }] };
  }
}

// ── Reset password ────────────────────────────────────────────────────────

export async function resetEmployeePassword(
  id: string,
  newPassword: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const admin = await requireAdmin();

    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters." };
    }

    // Verify employee belongs to same org
    const target = await db.user.findUnique({ where: { id }, select: { organizationId: true } });
    if (!target || target.organizationId !== admin.organizationId) {
      return { success: false, error: "Employee not found." };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.user.update({ where: { id }, data: { passwordHash } });

    revalidatePath("/admin/employees");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to reset password." };
  }
}
