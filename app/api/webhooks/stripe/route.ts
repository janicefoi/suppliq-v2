import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In Stripe API 2026-05-27.dahlia, current_period_end moved from Subscription
// to SubscriptionItem. subscription moved from Invoice to Invoice.parent.
function getSubPeriodEnd(sub: Stripe.Subscription): Date | null {
  const ts = sub.items.data[0]?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

function getInvoiceSubId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.organizationId;
  if (!orgId || !session.subscription) return;

  const sub = await stripe.subscriptions.retrieve(session.subscription as string);

  await db.organization.update({
    where: { id: orgId },
    data: {
      plan: resolvePlan(sub),
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      currentPeriodEnd: getSubPeriodEnd(sub),
    },
  });
}

async function handleSubscriptionUpdate(sub: Stripe.Subscription) {
  const org = await db.organization.findFirst({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true },
  });
  if (!org) return;

  await db.organization.update({
    where: { id: org.id },
    data: {
      plan: sub.status === "canceled" ? "STARTER" : resolvePlan(sub),
      subscriptionStatus: sub.status,
      currentPeriodEnd: getSubPeriodEnd(sub),
    },
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const org = await db.organization.findFirst({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true },
  });
  if (!org) return;

  await db.organization.update({
    where: { id: org.id },
    data: {
      plan: "STARTER",
      subscriptionStatus: "canceled",
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
    },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subId = getInvoiceSubId(invoice);
  if (!subId) return;

  const org = await db.organization.findFirst({
    where: { stripeSubscriptionId: subId },
    select: { id: true },
  });
  if (!org) return;

  await db.organization.update({
    where: { id: org.id },
    data: { subscriptionStatus: "past_due" },
  });
}

function resolvePlan(sub: Stripe.Subscription): "STARTER" | "GROWTH" | "ENTERPRISE" {
  const priceId = sub.items.data[0]?.price.id;
  if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) return "ENTERPRISE";
  return "GROWTH";
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] ${event.type} error:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
