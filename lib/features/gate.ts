import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlanLimits, type PlanId, type PlanLimits } from "@/lib/plans";

// ── Plan hierarchy for comparison ─────────────────────────────

const PLAN_RANK: Record<PlanId, number> = {
  free:  0,
  plus:  1,
  pro:   2,
  elite: 3,
};

export function planMeetsRequirement(userPlan: PlanId, required: PlanId): boolean {
  return PLAN_RANK[userPlan] >= PLAN_RANK[required];
}

// ── Get user's current effective plan ─────────────────────────

export async function getUserPlan(supabase: SupabaseClient, userId: string): Promise<PlanId> {
  const { data } = await supabase
    .from("user_plans")
    .select("plan, status")
    .eq("user_id", userId)
    .single();

  if (!data) return "free";
  const isActive = data.status === "active" || data.status === "trialing";
  return isActive ? (data.plan as PlanId) : "free";
}

// ── Gate: return 403 if user's plan is below required ─────────

export async function assertPlan(
  supabase: SupabaseClient,
  userId: string,
  required: PlanId,
): Promise<{ ok: true; plan: PlanId; limits: PlanLimits } | { ok: false; response: NextResponse }> {
  const plan   = await getUserPlan(supabase, userId);
  const limits = getPlanLimits(plan);

  if (!planMeetsRequirement(plan, required)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "plan_required",
          required,
          current: plan,
          message: `This feature requires ${required} plan or higher.`,
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, plan, limits };
}

// ── Limit check helper ─────────────────────────────────────────

export async function checkLimit(
  supabase: SupabaseClient,
  userId: string,
  limitKey: keyof PlanLimits,
): Promise<{ allowed: boolean; plan: PlanId; limit: number | boolean | null }> {
  const plan   = await getUserPlan(supabase, userId);
  const limits = getPlanLimits(plan);
  const limit  = limits[limitKey];

  const allowed = limit === null || limit === true || (typeof limit === "number" && limit > 0);
  return { allowed, plan, limit };
}
