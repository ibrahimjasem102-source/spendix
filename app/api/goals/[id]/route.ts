import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/api/request";
import type { GoalCategory, GoalFormData, GoalTrackingType } from "@/types";

const GOAL_CATEGORIES: GoalCategory[]     = ["emergency","home","travel","education","car","retirement","other"];
const TRACKING_TYPES: GoalTrackingType[]  = ["manual","savings","income","investment","debt_payoff"];

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await readJson<Partial<GoalFormData>>(request);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined)               update.title               = body.title.trim();
  if (body.target_amount !== undefined)       update.target_amount       = Math.max(0, Number(body.target_amount));
  if (body.saved_amount !== undefined)        update.saved_amount        = Math.max(0, Number(body.saved_amount));
  if (body.monthly_contribution !== undefined) update.monthly_contribution = Math.max(0, Number(body.monthly_contribution));
  if (body.due_date !== undefined)            update.due_date            = body.due_date ?? null;
  if (body.category !== undefined)            update.category            = GOAL_CATEGORIES.includes(body.category) ? body.category : "other";
  if (body.tracking_type !== undefined)       update.tracking_type       = TRACKING_TYPES.includes(body.tracking_type) ? body.tracking_type : "manual";
  if (body.linked_debt_id !== undefined)      update.linked_debt_id      = body.linked_debt_id ?? null;
  if (body.start_date !== undefined)          update.start_date          = body.start_date;
  if (body.notes !== undefined)              update.notes               = body.notes ?? null;
  if (body.color !== undefined)              update.color               = body.color ?? null;

  const { data: goal, error } = await supabase
    .from("goals")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
