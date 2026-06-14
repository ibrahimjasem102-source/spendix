import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TriggerEvent, AutomationRule, ActionConfig,
  NotifyAction, AllocateToGoalAction, CreateTransactionAction,
} from "./types";

// ── Evaluate trigger matching ─────────────────────────────────

function matchesTrigger(rule: AutomationRule, event: TriggerEvent): boolean {
  if (rule.trigger_type !== event.type) return false;
  if (!rule.is_active) return false;

  const cfg = rule.trigger_config;

  if (event.type === "on_transaction" && "direction" in cfg && cfg.direction) {
    if (cfg.direction !== event.data.direction) return false;
  }
  if (event.type === "on_transaction" && "minAmount" in cfg && cfg.minAmount != null) {
    if ((event.data.amount as number) < cfg.minAmount) return false;
  }
  if (event.type === "on_balance_low" && "threshold" in cfg && cfg.threshold != null) {
    if ((event.data.balance as number) > cfg.threshold) return false;
  }
  if (event.type === "on_budget_exceeded" && "threshold" in cfg && cfg.threshold != null) {
    const used = (event.data.usedRatio as number) ?? 0;
    if (used < cfg.threshold) return false;
  }

  return true;
}

// ── Execute action ────────────────────────────────────────────

async function executeAction(
  supabase: SupabaseClient,
  userId: string,
  action: ActionConfig,
  event: TriggerEvent,
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {

  try {
    if (action.type === "notify") {
      const a = action as NotifyAction;
      await supabase.from("notifications").insert({
        user_id:  userId,
        type:     "ai_alert",
        title:    a.title,
        body:     a.message,
        severity: a.severity ?? "info",
        source:   "automation",
      });
      return { ok: true, result: { notified: true } };
    }

    if (action.type === "allocate_to_goal") {
      const a = action as AllocateToGoalAction;
      let amount = a.amount ?? 0;
      if (a.percentage && event.data.amount) {
        amount = (event.data.amount as number) * (a.percentage / 100);
      }
      if (amount <= 0) return { ok: false, error: "amount_zero" };

      await supabase.from("goal_contributions").insert({
        user_id: userId,
        goal_id: a.goalId,
        amount,
        note:    a.note ?? "تم التحويل تلقائياً بواسطة Automation",
        source:  "automation",
      });
      return { ok: true, result: { goalId: a.goalId, amount } };
    }

    if (action.type === "create_transaction") {
      const a = action as CreateTransactionAction;
      await supabase.from("transactions").insert({
        user_id:     userId,
        title:       a.title,
        amount:      a.amount,
        type:        a.direction === "inflow" ? "income" : "expense",
        category_id: a.categoryId ?? null,
        account_id:  a.accountId ?? null,
        date:        new Date().toISOString().split("T")[0],
        source:      "automation",
      });
      return { ok: true, result: { created: true } };
    }

    if (action.type === "send_webhook") {
      // Security: only allow HTTPS and validate URL format
      if (!action.url.startsWith("https://")) {
        return { ok: false, error: "webhook_must_be_https" };
      }
      const res = await fetch(action.url, {
        method:  action.method ?? "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Spendix-Automation/1.0" },
        body:    JSON.stringify({ event: event.type, data: event.data, userId }),
        signal:  AbortSignal.timeout(5000),
      });
      return { ok: res.ok, result: { status: res.status } };
    }

    return { ok: false, error: "unknown_action" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Main engine function ──────────────────────────────────────

export async function evaluateAutomations(
  supabase: SupabaseClient,
  event: TriggerEvent,
): Promise<{ evaluated: number; fired: number }> {
  // Fetch active rules for this user + trigger type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: rules } = await db
    .from("automation_rules")
    .select("*")
    .eq("user_id", event.userId)
    .eq("is_active", true)
    .eq("trigger_type", event.type);

  if (!rules?.length) return { evaluated: 0, fired: 0 };

  let fired = 0;

  for (const rule of rules as AutomationRule[]) {
    if (!matchesTrigger(rule, event)) continue;

    const result = await executeAction(supabase, event.userId, rule.action_config, event);
    fired++;

    // Log the execution
    await db.from("automation_logs").insert({
      rule_id:      rule.id,
      trigger_data: event.data,
      action_result: result.result ?? null,
      success:      result.ok,
      error_message: result.error ?? null,
    });

    // Update rule stats
    await db.from("automation_rules")
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count:     rule.trigger_count + 1,
      })
      .eq("id", rule.id);
  }

  return { evaluated: rules.length, fired };
}
