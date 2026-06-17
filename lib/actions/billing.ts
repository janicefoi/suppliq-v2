"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// ── Plan status ────────────────────────────────────────────────────────────

export type PlanStatus = {
  plan: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  isActive: boolean;
};

export async function getPlanStatus(): Promise<PlanStatus | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const org = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      plan: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
    },
  });
  if (!org) return null;

  return {
    plan: org.plan,
    stripeCustomerId: org.stripeCustomerId,
    stripeSubscriptionId: org.stripeSubscriptionId,
    subscriptionStatus: org.subscriptionStatus,
    currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
    isActive: org.plan !== "STARTER" && org.subscriptionStatus === "active",
  };
}

// ── Checkout session ───────────────────────────────────────────────────────

export async function createCheckoutSession(
  priceId: string
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Only admins can manage billing." };
  }

  const orgId = session.user.organizationId;

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true, stripeCustomerId: true },
  });
  if (!org) return { success: false, error: "Organization not found." };

  // Find or create a Stripe customer for this org
  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      email: session.user.email ?? undefined,
      metadata: { organizationId: orgId },
    });
    customerId = customer.id;
    await db.organization.update({
      where: { id: orgId },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { organizationId: orgId },
    success_url: `${appUrl}/settings/billing?success=1`,
    cancel_url:  `${appUrl}/settings/billing?canceled=1`,
    allow_promotion_codes: true,
    billing_address_collection: "required",
    customer_update: { address: "auto" },
  });

  if (!checkoutSession.url) {
    return { success: false, error: "Failed to create checkout session." };
  }
  return { success: true, url: checkoutSession.url };
}

// ── Customer portal ────────────────────────────────────────────────────────

export async function createPortalSession(): Promise<
  { success: true; url: string } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Only admins can manage billing." };
  }

  const org = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { stripeCustomerId: true },
  });
  if (!org?.stripeCustomerId) {
    return { success: false, error: "No billing account found. Please subscribe first." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const portal = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${appUrl}/settings/billing`,
  });

  return { success: true, url: portal.url };
}
