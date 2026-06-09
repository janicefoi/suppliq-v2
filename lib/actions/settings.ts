"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  ProfileSchema,
  PasswordSchema,
  OrgSchema,
  type ProfileInput,
  type PasswordInput,
  type OrgInput,
} from "@/lib/validations/settings";

type ActionResult = { success: true } | { success: false; error: string };

// ── Org detail ─────────────────────────────────────────────────────────────

export type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  country: string;
  currency: string;
  timezone: string;
  plan: string;
  createdAt: string;
  _counts: { users: number; branches: number; items: number };
};

export async function getOrgDetail(): Promise<OrgDetail | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const orgId = session.user.organizationId;

  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      _count: { select: { users: true, branches: true, items: true } },
    },
  });
  if (!org) return null;

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    industry: org.industry,
    country: org.country,
    currency: org.currency,
    timezone: org.timezone,
    plan: org.plan,
    createdAt: org.createdAt.toISOString(),
    _counts: org._count,
  };
}

// ── Update org ─────────────────────────────────────────────────────────────

export async function updateOrganization(data: OrgInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Only admins can update organization settings." };
  }
  const orgId = session.user.organizationId;

  const parsed = OrgSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  await db.organization.update({
    where: { id: orgId },
    data: {
      name: parsed.data.name,
      industry: parsed.data.industry || null,
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
      country: parsed.data.country,
    },
  });

  revalidatePath("/settings/organization");
  return { success: true };
}

// ── User profile ───────────────────────────────────────────────────────────

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export async function getProfile(): Promise<UserProfile | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function updateProfile(data: ProfileInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const parsed = ProfileSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const newEmail = parsed.data.email.toLowerCase();

  if (newEmail !== session.user.email?.toLowerCase()) {
    const existing = await db.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      return { success: false, error: "This email is already in use by another account." };
    }
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name, email: newEmail },
  });

  revalidatePath("/settings/profile");
  return { success: true };
}

// ── Change password ────────────────────────────────────────────────────────

export async function changePassword(data: PasswordInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const parsed = PasswordSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) return { success: false, error: "User not found." };

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { success: false, error: "Current password is incorrect." };

  const hash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.user.update({
    where: { id: session.user.id },
    data: { passwordHash: hash },
  });

  return { success: true };
}
