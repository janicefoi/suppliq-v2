import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * Lazily-initialised Stripe client. The underlying client is created on first
 * use, not at import time, so a missing STRIPE_SECRET_KEY only fails an actual
 * request — never the build's page-data collection step.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
