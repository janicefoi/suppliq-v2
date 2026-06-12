"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkBranchLimit } from "@/lib/plan-limits";
import { getPlanLimits } from "@/lib/constants/plans";

const BranchSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(100).optional(),
  paybill: z.string().trim().max(20).optional(),
  pin: z.string().trim().max(20).optional(),
});

type BranchInput = z.infer<typeof BranchSchema>;
type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  paybill: string | null;
  pin: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { users: number; customers: number; sales: number };
};

export async function getBranches(): Promise<BranchRow[]> {
  const admin = await requireAdmin();

  const rows = await db.branch.findMany({
    where: { organizationId: admin.organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      paybill: true,
      pin: true,
      isActive: true,
      createdAt: true,
      _count: { select: { users: true, customers: true, sales: true } },
    },
  });
  return JSON.parse(JSON.stringify(rows));
}

export async function createBranch(data: BranchInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const orgId = admin.organizationId;

  const parsed = BranchSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Plan limit check
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
  const limit = await checkBranchLimit(orgId, org?.plan ?? "FREE");
  if (!limit.allowed) return { success: false, error: limit.error };

  const exists = await db.branch.findFirst({
    where: { name: { equals: parsed.data.name, mode: "insensitive" }, organizationId: orgId },
  });
  if (exists) return { success: false, error: "A branch with this name already exists." };

  await db.branch.create({
    data: {
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      paybill: parsed.data.paybill || null,
      pin: parsed.data.pin || null,
      organizationId: orgId,
    },
  });

  revalidatePath("/admin/branches");
  return { success: true };
}

export async function updateBranch(id: string, data: BranchInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const orgId = admin.organizationId;

  const parsed = BranchSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Verify branch belongs to this org
  const branch = await db.branch.findUnique({ where: { id }, select: { organizationId: true } });
  if (!branch || branch.organizationId !== orgId) {
    return { success: false, error: "Branch not found." };
  }

  const exists = await db.branch.findFirst({
    where: { name: { equals: parsed.data.name, mode: "insensitive" }, organizationId: orgId, NOT: { id } },
  });
  if (exists) return { success: false, error: "Another branch already uses this name." };

  await db.branch.update({
    where: { id },
    data: {
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      paybill: parsed.data.paybill || null,
      pin: parsed.data.pin || null,
    },
  });

  revalidatePath("/admin/branches");
  return { success: true };
}

// ── Import branches (CSV bulk) ────────────────────────────────────────────

export type CsvImportResult = {
  imported: number;
  skipped: Array<{ row: number; value: string; reason: string }>;
};

export async function importBranches(
  rows: Array<Record<string, string>>
): Promise<CsvImportResult> {
  try {
    const admin = await requireAdmin();
    const orgId = admin.organizationId;

    const org = await db.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
    const { branches: branchLimit } = getPlanLimits(org?.plan ?? "FREE");

    let currentCount = await db.branch.count({ where: { organizationId: orgId } });

    const existingNames = new Set(
      (await db.branch.findMany({ where: { organizationId: orgId }, select: { name: true } }))
        .map((b) => b.name.toLowerCase())
    );

    let imported = 0;
    const skipped: CsvImportResult["skipped"] = [];
    const seenNames = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const name = row.name?.trim();

      if (!name || name.length < 2) {
        skipped.push({ row: rowNum, value: name ?? "", reason: "name is required (min 2 characters)" });
        continue;
      }
      if (existingNames.has(name.toLowerCase()) || seenNames.has(name.toLowerCase())) {
        skipped.push({ row: rowNum, value: name, reason: `branch "${name}" already exists` });
        continue;
      }
      if (branchLimit !== null && currentCount >= branchLimit) {
        skipped.push({ row: rowNum, value: name, reason: "branch limit reached for your plan" });
        continue;
      }

      await db.branch.create({
        data: {
          name,
          address: row.address?.trim() || null,
          phone: row.phone?.trim() || null,
          paybill: row.paybill?.trim() || null,
          pin: row.pin?.trim() || null,
          organizationId: orgId,
        },
      });

      seenNames.add(name.toLowerCase());
      currentCount++;
      imported++;
    }

    if (imported > 0) revalidatePath("/admin/branches");
    return { imported, skipped };
  } catch (err) {
    return { imported: 0, skipped: [{ row: 0, value: "", reason: err instanceof Error ? err.message : "Import failed" }] };
  }
}

export async function toggleBranchActive(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const orgId = admin.organizationId;

  const branch = await db.branch.findUnique({ where: { id }, select: { isActive: true, organizationId: true } });
  if (!branch || branch.organizationId !== orgId) return { success: false, error: "Branch not found." };

  await db.branch.update({ where: { id }, data: { isActive: !branch.isActive } });
  revalidatePath("/admin/branches");
  return { success: true };
}
