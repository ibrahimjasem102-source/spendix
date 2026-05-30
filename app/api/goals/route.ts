import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/api/request";
import type { Goal, GoalCategory, GoalFormData, GoalStatus, GoalTrackingType } from "@/types";

const GOAL_CATEGORIES: GoalCategory[] = ["emergency","home","travel","education","car","retirement","other"];
const TRACKING_TYPES: GoalTrackingType[] = ["manual","savings","income","investment","debt_payoff"];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function computeStatus(goal: { target_amount: number; due_date: string | null }, computedSaved: number): GoalStatus {
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
): Promise<number> {
  const type       = goal.tracking_type as GoalTrackingType;
  const savedAmt   = Number(goal.saved_amount) || 0;
  const startDate  = (goal.start_date as string) ?? "2000-01-01";

  if (type === "manual") return savedAmt;

  if (type === "savings" || type === "income") {
    try {
      const q = supabase
        .from("transactions")
        .select("amount,type")
        .eq("user_id", userId)
        .gte("transaction_date", startDate);
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
  const remaining    = Math.max(0, targetAmount - computedSaved);
  const progress     = targetAmount > 0 ? Math.min(100, Math.round((computedSaved / targetAmount) * 100)) : 0;
  const status       = computeStatus({ target_amount: targetAmount, due_date: raw.due_date as string | null }, computedSaved);

  let daysUntilDue: number | null = null;
  if (raw.due_date) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due   = new Date((raw.due_date as string) + "T00:00:00");
    daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  }

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
    created_at:           raw.created_at as string,
    updated_at:           raw.updated_at as string,
    computed_saved:       computedSaved,
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
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ goals: [] });

    // Compute live progress for each goal
    const enriched = await Promise.all(
      (goals ?? []).map(async (g) => {
        const computedSaved = await computeProgress(supabase, g as Record<string, unknown>, user.id);
        return enrichGoal(g as Record<string, unknown>, computedSaved);
      })
    );

    return NextResponse.json({ goals: enriched });
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
  };

  const { data: goal, error } = await supabase.from("goals").insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const computedSaved = await computeProgress(supabase, goal as Record<string, unknown>, user.id);
  return NextResponse.json({ goal: enrichGoal(goal as Record<string, unknown>, computedSaved) }, { status: 201 });
}
