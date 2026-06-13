import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { cache } from "react";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const { handlers, auth: uncachedAuth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = CredentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            role: true,
            isActive: true,
            branchId: true,
            organizationId: true,
            organization: { select: { currency: true, plan: true } },
          },
        });

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          branchId: user.branchId,
          organizationId: user.organizationId,
          currency: user.organization.currency,
          plan: user.organization.plan,
          isDemo: user.email === "demo@suppliq.com",
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // At sign-in: stamp all fields from the user object
      if (user) {
        token.id             = user.id;
        token.role           = (user as { role: string }).role;
        token.branchId       = (user as { branchId?: string | null }).branchId ?? null;
        token.organizationId = (user as unknown as { organizationId: string }).organizationId;
        token.currency       = (user as unknown as { currency: string }).currency ?? "EUR";
        token.plan           = (user as unknown as { plan?: string }).plan ?? "FREE";
        token.isDemo         = (user as unknown as { isDemo?: boolean }).isDemo ?? false;
        token.planCheckedAt  = Date.now();
        return token;
      }

      // On subsequent refreshes: re-read plan + currency from DB every 5 minutes
      // so Stripe-triggered plan changes propagate without requiring a re-login.
      const now = Date.now();
      const lastCheck = (token.planCheckedAt as number | undefined) ?? 0;
      if (now - lastCheck > 5 * 60 * 1000) {
        const org = await db.organization.findUnique({
          where: { id: token.organizationId as string },
          select: { plan: true, currency: true },
        });
        if (org) {
          token.plan          = org.plan;
          token.currency      = org.currency;
          token.planCheckedAt = now;
        }
      }

      return token;
    },
  },
});

// Deduplicate auth() calls within a single request using React cache
export const auth = cache(uncachedAuth);
export { handlers, signIn, signOut };
