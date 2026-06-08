"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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
  const rows = await db.branch.findMany({
    orderBy: { name: "asc" },
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
  await requireAdmin();
  const parsed = BranchSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const exists = await db.branch.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (exists) return { success: false, error: "A branch with this name already exists." };

  await db.branch.create({
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

export async function updateBranch(id: string, data: BranchInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = BranchSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const exists = await db.branch.findFirst({
    where: { name: { equals: parsed.data.name, mode: "insensitive" }, NOT: { id } },
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

export async function toggleBranchActive(id: string): Promise<ActionResult> {
  await requireAdmin();
  const branch = await db.branch.findUnique({ where: { id }, select: { isActive: true } });
  if (!branch) return { success: false, error: "Branch not found." };

  await db.branch.update({ where: { id }, data: { isActive: !branch.isActive } });
  revalidatePath("/admin/branches");
  return { success: true };
}
