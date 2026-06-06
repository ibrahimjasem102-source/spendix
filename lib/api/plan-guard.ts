import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlanLimits, type PlanId, type PlanLimits } from "@/lib/plans";

interface PlanRow {
  plan: PlanId;
  status: string;
}

export async function getUserPlan(supabase: SupabaseClient, userId: string): Promise<PlanId> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .single<PlanRow>();

  if (!data) return "free";
  if (data.status === "active" || data.status === "trialing") return data.plan;
  return "free";
}

export function planError(featureName: string, requiredPlan: PlanId) {
  return NextResponse.json(
    {
      error: `${featureName} requires the ${requiredPlan} plan`,
      upgrade_required: true,
      required_plan: requiredPlan,
    },
    { status: 402 },
  );
}

export async function checkFeatureAccess(
  supabase: SupabaseClient,
  userId: string,
  feature: keyof PlanLimits,
  featureName: string,
): Promise<NextResponse | null> {
  const plan   = await getUserPlan(supabase, userId);
  const limits = getPlanLimits(plan);
  const allowed = limits[feature];

  if (allowed === false) {
    // Determine minimum plan that grants this feature
    const plans: PlanId[] = ["plus", "pro", "elite"];
    const minPlan = plans.find((p) => {
      const l = getPlanLimits(p);
      return l[feature] === true || (l[feature] !== false && l[feature] !== null);
    }) ?? "plus";
    return planError(featureName, minPlan);
  }

  return null;
}

export async function checkCountLimit(
  supabase: SupabaseClient,
  userId: string,
  table: string,
  limitField: keyof PlanLimits,
  extraFilter?: { column: string; value: unknown },
): Promise<NextResponse | null> {
  const plan   = await getUserPlan(supabase, userId);
  const limits = getPlanLimits(plan);
  const limit  = limits[limitField] as number | null;

  if (limit === null) return null; // unlimited

  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (extraFilter) {
    query = query.eq(extraFilter.column, extraFilter.value);
  }

  const { count } = await query;

  if (count !== null && count >= limit) {
    const plans: PlanId[] = ["plus", "pro", "elite"];
    const minPlan = plans.find((p) => {
      const l = getPlanLimits(p);
      return l[limitField] === null;
    }) ?? "plus";
    return planError(`${table} limit (${limit})`, minPlan);
  }

  return null;
}

/** Count transactions for the current calendar month */
export async function checkMonthlyTransactionLimit(
  supabase: SupabaseClient,
  userId: string,
): Promise<NextResponse | null> {
  const plan   = await getUserPlan(supabase, userId);
  const limits = getPlanLimits(plan);
  const limit  = limits.transactionsPerMonth;

  if (limit === null) return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("date", startOfMonth.toISOString().slice(0, 10));

  if (count !== null && count >= limit) {
    return planError(`Monthly transactions (${limit})`, "plus");
  }

  return null;
}
