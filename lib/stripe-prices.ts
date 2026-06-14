import "server-only";
import type { PlanId } from "@/lib/plans";

// Monthly price IDs — set in Vercel env vars
export const STRIPE_PRICE_IDS = {
  plus:  process.env.STRIPE_PLUS_PRICE_ID  ?? process.env.STRIPE_PRICE_PLUS  ?? "",
  pro:   process.env.STRIPE_PRO_PRICE_ID   ?? process.env.STRIPE_PRICE_PRO   ?? "",
  elite: process.env.STRIPE_ELITE_PRICE_ID ?? process.env.STRIPE_PRICE_ELITE ?? "",
} as const;

// Yearly price IDs — STRIPE_PLUS_YEARLY_PRICE_ID, STRIPE_PRO_YEARLY_PRICE_ID, STRIPE_ELITE_YEARLY_PRICE_ID
// Set these in Stripe dashboard and env vars. Yearly = ~20% off monthly × 12.
export const STRIPE_YEARLY_PRICE_IDS = {
  plus:  process.env.STRIPE_PLUS_YEARLY_PRICE_ID  ?? "",
  pro:   process.env.STRIPE_PRO_YEARLY_PRICE_ID   ?? "",
  elite: process.env.STRIPE_ELITE_YEARLY_PRICE_ID ?? "",
} as const;

export type BillingInterval = "monthly" | "yearly";

/**
 * Returns the validated Stripe Price ID for the given plan and interval.
 * Throws clearly if the ID is missing or is a Product ID (prod_) instead of Price ID (price_).
 */
export function getStripePriceId(plan: Exclude<PlanId, "free">, interval: BillingInterval = "monthly"): string {
  const id = interval === "yearly" ? STRIPE_YEARLY_PRICE_IDS[plan] : STRIPE_PRICE_IDS[plan];

  if (!id) {
    throw new Error(
      `Missing Stripe Price ID for plan "${plan}". ` +
      `Set STRIPE_${plan.toUpperCase()}_PRICE_ID in your environment variables.`
    );
  }

  if (id.startsWith("prod_")) {
    throw new Error(
      `Stripe Price ID for plan "${plan}" is a Product ID (${id}). ` +
      `Use a Price ID (price_...) instead — found in Stripe Dashboard → Product → Pricing.`
    );
  }

  if (!id.startsWith("price_")) {
    throw new Error(
      `Stripe Price ID for plan "${plan}" is invalid: "${id}". ` +
      `Must start with "price_".`
    );
  }

  return id;
}
