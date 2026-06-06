import "server-only";
import type { PlanId } from "@/lib/plans";

// Support both new names (STRIPE_PLUS_PRICE_ID) and old names (STRIPE_PRICE_PLUS)
// New names take priority. Update Vercel env vars when convenient.
export const STRIPE_PRICE_IDS = {
  plus:  process.env.STRIPE_PLUS_PRICE_ID  ?? process.env.STRIPE_PRICE_PLUS  ?? "",
  pro:   process.env.STRIPE_PRO_PRICE_ID   ?? process.env.STRIPE_PRICE_PRO   ?? "",
  elite: process.env.STRIPE_ELITE_PRICE_ID ?? process.env.STRIPE_PRICE_ELITE ?? "",
} as const;

/**
 * Returns the validated Stripe Price ID for the given plan.
 * Throws clearly if the ID is missing or is a Product ID (prod_) instead of Price ID (price_).
 */
export function getStripePriceId(plan: Exclude<PlanId, "free">): string {
  const id = STRIPE_PRICE_IDS[plan];

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
