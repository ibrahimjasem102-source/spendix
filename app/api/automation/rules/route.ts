import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";
import type { TriggerType, ActionType, TriggerConfig, ActionConfig } from "@/lib/automation/types";

export const dynamic = "force-dynamic";

const VALID_TRIGGERS: TriggerType[] = [
  "on_transaction","on_salary","on_budget_exceeded",
  "on_balance_low","on_debt_paid","on_goal_reached","schedule",
];
const VALID_ACTIONS: ActionType[] = [
  "notify","allocate_to_goal","create_transaction","send_webhook",
];

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("automation_rules")
    .select("*, logs:automation_logs(id, triggered_at, success)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const limited = rateLimit(req, { key: "automation_create", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  let body: {
    name: string; description?: string;
    trigger_type: TriggerType; trigger_config: TriggerConfig;
    action_type: ActionType;   action_config: ActionConfig;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  if (!VALID_TRIGGERS.includes(body.trigger_type)) return NextResponse.json({ ok: false, error: "invalid trigger" }, { status: 400 });
  if (!VALID_ACTIONS.includes(body.action_type)) return NextResponse.json({ ok: false, error: "invalid action" }, { status: 400 });

  // Cap at 20 rules per user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { count } = await db.from("automation_rules").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= 20) return NextResponse.json({ ok: false, error: "max_rules_reached" }, { status: 400 });

  const { data, error } = await db.from("automation_rules").insert({
    user_id:        user.id,
    name:           body.name.trim(),
    description:    body.description?.slice(0, 500) ?? null,
    trigger_type:   body.trigger_type,
    trigger_config: body.trigger_config,
    action_type:    body.action_type,
    action_config:  body.action_config,
  }).select("id, name").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
