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
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  taxId: string | null;
  country: string;
  currency: string;
  timezone: string;
  vatRate: number;
  plan: string;
  createdAt: string;
  _counts: { users: number; branches: number; items: number };
  // Stripe billing (may be null on free plan)
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
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
    phone: org.phone ?? null,
    email: org.email ?? null,
    address: org.address ?? null,
    website: org.website ?? null,
    taxId: org.taxId ?? null,
    country: org.country,
    currency: org.currency,
    timezone: org.timezone,
    vatRate: Number(org.vatRate),
    plan: org.plan,
    createdAt: org.createdAt.toISOString(),
    _counts: org._count,
    stripeCustomerId: org.stripeCustomerId ?? null,
    stripeSubscriptionId: org.stripeSubscriptionId ?? null,
    subscriptionStatus: org.subscriptionStatus ?? null,
    currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
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
      name:     parsed.data.name,
      industry: parsed.data.industry || null,
      phone:    parsed.data.phone    || null,
      email:    parsed.data.email    || null,
      address:  parsed.data.address  || null,
      website:  parsed.data.website  || null,
      taxId:    parsed.data.taxId    || null,
      country:  parsed.data.country,
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
      vatRate:  parsed.data.vatRate,
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
