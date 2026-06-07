import "server-only";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripeInstance(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
    _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  }
  return _stripe;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripeInstance() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/** @deprecated use `stripe` directly */
export function getStripe(): Stripe {
  return getStripeInstance();
}
