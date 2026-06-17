"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getCountry } from "@/lib/constants/countries";
import { z } from "zod";

const RegisterSchema = z
  .object({
    orgName: z.string().min(2, "Company name must be at least 2 characters"),
    industry: z.string().optional(),
    country: z.string().default("GB"),
    branchName: z.string().min(2, "Branch name must be at least 2 characters"),
    adminName: z.string().min(2, "Your name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

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
    country: (formData.get("country") as string) || "GB",
    branchName: (formData.get("branchName") as string) || "Head Office",
    adminName: formData.get("adminName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { orgName, industry, country, branchName, adminName, email, password } =
    parsed.data;

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  const countryData = getCountry(country);
  const currency = countryData.currency;
  const timezone = countryData.timezone;

  const baseSlug = toSlug(orgName);
  let slug = baseSlug;
  let suffix = 1;
  while (await db.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: orgName,
        slug,
        industry,
        country,
        currency,
        timezone,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
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
