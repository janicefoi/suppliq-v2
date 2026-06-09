"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { OnboardingSchema } from "@/lib/validations/onboarding";

function toSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "org";
}

export async function registerOrganization(formData: FormData) {
  const raw = {
    orgName: formData.get("orgName"),
    industry: (formData.get("industry") as string) || undefined,
    country: (formData.get("country") as string) || "KE",
    branchName: (formData.get("branchName") as string) || "Head Office",
    adminName: formData.get("adminName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = OnboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { orgName, industry, country, branchName, adminName, email, password } =
    parsed.data;

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  // Ensure slug is unique
  const baseSlug = toSlug(orgName);
  let slug = baseSlug;
  let suffix = 1;
  while (await db.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: orgName, slug, industry, country },
    });

    const branch = await tx.branch.create({
      data: { name: branchName, organizationId: org.id },
    });

    await tx.user.create({
      data: {
        name: adminName,
        email,
        passwordHash,
        role: "ADMIN",
        organizationId: org.id,
        branchId: branch.id,
      },
    });
  });

  return { success: true as const };
}
