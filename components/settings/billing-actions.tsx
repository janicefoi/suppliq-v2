"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createCheckoutSession, createPortalSession } from "@/lib/actions/billing";

type Props = {
  plan: string;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
};

export function BillingActions({ plan, subscriptionStatus, stripeCustomerId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(priceId: string) {
    setLoading(true);
    setError(null);
    const result = await createCheckoutSession(priceId);
    if (result.success) {
      window.location.href = result.url;
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  async function handlePortal() {
    setLoading(true);
    setError(null);
    const result = await createPortalSession();
    if (result.success) {
      window.location.href = result.url;
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  const isSubscribed = plan !== "FREE" && stripeCustomerId;
  const isPastDue = subscriptionStatus === "past_due";

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
      )}

      {isPastDue && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          <p className="text-sm font-medium text-amber-800">Payment overdue</p>
          <p className="text-sm text-amber-700 mt-1">
            Your last payment failed. Update your payment method to keep your subscription active.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 border-amber-400 text-amber-800 hover:bg-amber-100"
            onClick={handlePortal}
            disabled={loading}
          >
            {loading ? "Loading..." : "Update payment method"}
          </Button>
        </div>
      )}

      {isSubscribed && !isPastDue && (
        <Button
          variant="outline"
          onClick={handlePortal}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? "Loading..." : "Manage billing"}
        </Button>
      )}

      {plan === "FREE" && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_GROWTH_MONTHLY_PRICE_ID ?? "")}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? "Loading..." : "Upgrade to Growth — Monthly"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleCheckout(process.env.NEXT_PUBLIC_STRIPE_GROWTH_YEARLY_PRICE_ID ?? "")}
            disabled={loading}
          >
            {loading ? "Loading..." : "Upgrade to Growth — Yearly (save 20%)"}
          </Button>
        </div>
      )}
    </div>
  );
}
