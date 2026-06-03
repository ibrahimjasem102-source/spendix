import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/api/request";
import type { Goal, GoalCategory, GoalFormData, GoalMilestone, GoalStatus, GoalTrackingType } from "@/types";

const GOAL_CATEGORIES: GoalCategory[] = ["emergency","home","travel","education","car","retirement","other"];
const TRACKING_TYPES: GoalTrackingType[] = ["manual","savings","income","investment","debt_payoff"];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function isOptionalCompletedAtError(message = "") {
  return message.includes("completed_at") ||
    message.includes("Could not find") ||
    message.includes("schema cache");
}

async function saveCompletedAt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  goalId: string,
  userId: string,
  completedAt: string,
) {
  const { error } = await supabase
    .from("goals")
    .update({ completed_at: completedAt })
    .eq("id", goalId)
    .eq("user_id", userId)
    .is("completed_at", null);

  if (error && !isOptionalCompletedAtError(error.message)) throw error;
}

function computeStatus(goal: { target_amount: number; due_date: string | null; completed_at?: string | null }, computedSaved: number): GoalStatus {
  if (goal.completed_at) return "completed";
  const remaining = Math.max(0, Number(goal.target_amount) - computedSaved);
  if (remaining <= 0) return "completed";
  if (!goal.due_date) return "on_track";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(goal.due_date + "T00:00:00");
  const days  = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 60) return "due_soon";
  return "on_track";
}

async function computeProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  goal: Record<string, unknown>,
  userId: string,
  opts?: { effectiveStart?: string; endDate?: string },
): Promise<number> {
  const type       = goal.tracking_type as GoalTrackingType;
  const savedAmt   = Number(goal.saved_amount) || 0;
  const startDate  = opts?.effectiveStart ?? (goal.start_date as string) ?? "2000-01-01";

  if (type === "manual") return savedAmt;

  if (type === "savings" || type === "income") {
    try {
      const q = supabase
        .from("transactions")
        .select("amount,type")
        .eq("user_id", userId)
        .gte("transaction_date", startDate);
      if (opts?.endDate) q.lte("transaction_date", opts.endDate);
      if (type === "income") q.eq("type", "income");
      const { data: txs } = await q;
      if (!txs) return savedAmt;
      if (type === "income") {
        return txs.reduce((s, t) => s + Number(t.amount), 0);
      }
      // savings = income - expenses (net, floored at 0)
      const net = txs.reduce((s, t) => t.type === "income" ? s + Number(t.amount) : s - Number(t.amount), 0);
      return Math.max(0, net);
    } catch { return savedAmt; }
  }

  if (type === "investment") {
    try {
      const { data: invs } = await supabase
        .from("investments")
        .select("current_value,amount_invested")
        .eq("user_id", userId);
      if (!invs) return savedAmt;
      return invs.reduce((s, i) => s + Number(i.current_value ?? i.amount_invested), 0);
    } catch { return savedAmt; }
  }

  if (type === "debt_payoff" && goal.linked_debt_id) {
    try {
      const { data: debt } = await supabase
        .from("debts")
        .select("paid_amount")
        .eq("id", goal.linked_debt_id as string)
        .single();
      return debt ? Number(debt.paid_amount) : savedAmt;
    } catch { return savedAmt; }
  }

  return savedAmt;
}

function enrichGoal(raw: Record<string, unknown>, computedSaved: number): Goal {
  const targetAmount = Number(raw.target_amount) || 0;
  const completedAt  = (raw.completed_at as string | null) ?? (targetAmount > 0 && computedSaved >= targetAmount ? new Date().toISOString() : null);
  const effectiveSaved = completedAt ? Math.max(computedSaved, targetAmount) : computedSaved;
  const remaining    = Math.max(0, targetAmount - effectiveSaved);
  const progress     = targetAmount > 0 ? Math.min(100, Math.round((effectiveSaved / targetAmount) * 100)) : 0;
  const status       = computeStatus({ target_amount: targetAmount, due_date: raw.due_date as string | null, completed_at: completedAt }, effectiveSaved);

  let daysUntilDue: number | null = null;
  if (raw.due_date) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due   = new Date((raw.due_date as string) + "T00:00:00");
    daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  }

  // Compute milestone reached status
  const rawMilestones = (raw.milestones as GoalMilestone[] | null) ?? [];
  const milestones: GoalMilestone[] = rawMilestones
    .slice()
    .sort((a, b) => a.amount - b.amount)
    .map((m) => ({ ...m, reached: effectiveSaved >= m.amount }));

  return {
    id:                   raw.id as string,
    user_id:              raw.user_id as string,
    title:                raw.title as string,
    target_amount:        targetAmount,
    saved_amount:         Number(raw.saved_amount) || 0,
    monthly_contribution: Number(raw.monthly_contribution) || 0,
    due_date:             (raw.due_date as string | null) ?? null,
    category:             (raw.category as GoalCategory) ?? "other",
    tracking_type:        (raw.tracking_type as GoalTrackingType) ?? "manual",
    linked_debt_id:       (raw.linked_debt_id as string | null) ?? null,
    start_date:           (raw.start_date as string) ?? todayStr(),
    notes:                (raw.notes as string | null) ?? null,
    color:                (raw.color as string | null) ?? null,
    milestones,
    created_at:           raw.created_at as string,
    updated_at:           raw.updated_at as string,
    completed_at:         completedAt,
    computed_saved:       effectiveSaved,
    progress,
    status,
    remaining,
    days_until_due:       daysUntilDue,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  try {
    const { data: goals, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ goals: [] });

    const rawGoals = (goals ?? []) as Record<string, unknown>[];

    // Build savings-chain: completed savings goals cap at completed_at,
    // and the next active savings goal starts from the latest completed_at.
    const savingsChain = rawGoals.filter(g => g.tracking_type === "savings");
    let lastCompletedAt: string | null = null;

    // First pass: determine completed_at for each goal in chain order
    // (use stored completed_at or detect completion later)
    const savingsOpts = new Map<string, { effectiveStart?: string; endDate?: string }>();

    for (const g of savingsChain) {
      const id = g.id as string;
      const startDate = (g.start_date as string) ?? "2000-01-01";
      const completedAt = g.completed_at as string | null;

      const effectiveStart = lastCompletedAt && lastCompletedAt > startDate
        ? lastCompletedAt
        : undefined;

      if (completedAt) {
        // Completed goal: cap at completion date and pass effective start
        savingsOpts.set(id, { effectiveStart, endDate: completedAt.slice(0, 10) });
        lastCompletedAt = completedAt.slice(0, 10);
      } else {
        // Active goal: starts from effective start (after last completed goal)
        savingsOpts.set(id, { effectiveStart });
      }
    }

    // Compute live progress for each goal
    const enrichedList = await Promise.all(
      rawGoals.map(async (raw) => {
        const id = raw.id as string;
        const opts = savingsOpts.get(id);
        const computedSaved = await computeProgress(supabase, raw, user.id, opts);
        const enriched = enrichGoal(raw, computedSaved);

        // If a savings goal just completed now (not stored yet), update lastCompletedAt
        if (!raw.completed_at && enriched.completed_at) {
          await saveCompletedAt(supabase, enriched.id, user.id, enriched.completed_at).catch(() => {});
        }
        return enriched;
      })
    );

    return NextResponse.json({ goals: enrichedList.reverse() });
  } catch {
    return NextResponse.json({ goals: [] });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<GoalFormData>(request);
  if (!body?.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const insert = {
    user_id:              user.id,
    title:                body.title.trim(),
    target_amount:        Math.max(0, Number(body.target_amount) || 0),
    saved_amount:         Math.max(0, Number(body.saved_amount) || 0),
    monthly_contribution: Math.max(0, Number(body.monthly_contribution) || 0),
    due_date:             body.due_date ?? null,
    category:             GOAL_CATEGORIES.includes(body.category) ? body.category : "other",
    tracking_type:        TRACKING_TYPES.includes(body.tracking_type) ? body.tracking_type : "manual",
    linked_debt_id:       body.linked_debt_id ?? null,
    start_date:           body.start_date ?? todayStr(),
    notes:                body.notes ?? null,
    color:                body.color ?? null,
    milestones:           Array.isArray(body.milestones) ? body.milestones : [],
  };

  let { data: goal, error } = await supabase.from("goals").insert(insert).select().single();

  // If milestones column doesn't exist yet (migration not applied), retry without it
  if (error && (error.message.includes("milestones") || error.message.includes("Could not find") || error.message.includes("schema cache"))) {
    const { milestones: _m, ...insertWithoutMilestones } = insert;
    const retry = await supabase.from("goals").insert(insertWithoutMilestones).select().single();
    goal = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For savings-type goals, find the latest completed savings goal to chain from
  let opts: { effectiveStart?: string; endDate?: string } | undefined;
  if (insert.tracking_type === "savings") {
    const { data: prevGoals } = await supabase
      .from("goals")
      .select("completed_at")
      .eq("user_id", user.id)
      .eq("tracking_type", "savings")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1);
    const lastCompleted = prevGoals?.[0]?.completed_at as string | null;
    if (lastCompleted) {
      const startDate = insert.start_date ?? todayStr();
      const effectiveStart = lastCompleted.slice(0, 10) > startDate
        ? lastCompleted.slice(0, 10)
        : undefined;
      if (effectiveStart) opts = { effectiveStart };
    }
  }

  const computedSaved = await computeProgress(supabase, goal as Record<string, unknown>, user.id, opts);
  const enriched = enrichGoal(goal as Record<string, unknown>, computedSaved);
  if (enriched.completed_at) {
    await saveCompletedAt(supabase, enriched.id, user.id, enriched.completed_at).catch((err) => {
      console.warn("[goals/post] saveCompletedAt failed:", err);
    });
  }
  return NextResponse.json({ goal: enriched }, { status: 201 });
}
