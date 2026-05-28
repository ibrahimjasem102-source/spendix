/**
 * Smart Notification Scheduler
 * Runs on app load for authenticated users.
 * Checks financial data and creates alerts if conditions are met.
 * Each check is idempotent — uses metadata to avoid duplicate alerts.
 */

import { createNotification } from "./service";
import type { SupabaseClient } from "@supabase/supabase-js";

const TODAY = new Date().toISOString().slice(0, 10);

/** Check if we already sent this notification today (by source + related_source_id or metadata key) */
async function alreadySentToday(
  supabase: SupabaseClient,
  userId: string,
  metaKey: string
): Promise<boolean> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .contains("metadata", { scheduler_key: metaKey })
    .limit(1)
    .maybeSingle();

  return !!data;
}

export async function runScheduler(supabase: SupabaseClient, userId: string): Promise<void> {
  try {
    // ── 1. Overdue debts ────────────────────────────────────────
    const { data: overdueDebts } = await supabase
      .from("debts")
      .select("id, person_or_entity, total_amount, paid_amount")
      .eq("user_id", userId)
      .eq("status", "overdue")
      .limit(5);

    for (const debt of overdueDebts ?? []) {
      const key = `overdue_debt_${debt.id}_${TODAY}`;
      if (await alreadySentToday(supabase, userId, key)) continue;

      const remaining = Number(debt.total_amount) - Number(debt.paid_amount);
      await createNotification(supabase, {
        user_id: userId,
        title: `دين متأخر: ${debt.person_or_entity}`,
        message: `لديك دين متأخر بمبلغ €${remaining.toFixed(2)} مع ${debt.person_or_entity}. تجنب الفائدة الإضافية بالسداد الآن.`,
        type: "debt",
        source: "system",
        priority: "high",
        related_source_id: debt.id,
        action_url: "/debts",
        metadata: { scheduler_key: key },
      });
    }

    // ── 2. Debts due within 3 days ──────────────────────────────
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);

    const { data: upcomingDebts } = await supabase
      .from("debts")
      .select("id, person_or_entity, total_amount, paid_amount, due_date")
      .eq("user_id", userId)
      .in("status", ["active", "partially_paid"])
      .lte("due_date", in3Days.toISOString().slice(0, 10))
      .gte("due_date", TODAY)
      .limit(5);

    for (const debt of upcomingDebts ?? []) {
      const key = `upcoming_debt_${debt.id}_${TODAY}`;
      if (await alreadySentToday(supabase, userId, key)) continue;

      const remaining = Number(debt.total_amount) - Number(debt.paid_amount);
      await createNotification(supabase, {
        user_id: userId,
        title: `تذكير: دين يستحق قريباً`,
        message: `دين ${debt.person_or_entity} (€${remaining.toFixed(2)}) يستحق في ${debt.due_date}. خطّط للسداد الآن.`,
        type: "reminder",
        source: "debt",
        priority: "high",
        related_source_id: debt.id,
        action_url: "/debts",
        metadata: { scheduler_key: key },
      });
    }

    // ── 3. Analytics-based alerts ───────────────────────────────
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);

    const { data: txData } = await supabase
      .from("transactions")
      .select("type, amount, source")
      .eq("user_id", userId)
      .gte("transaction_date", monthStart)
      .lt("transaction_date", nextMonth);

    if (txData && txData.length > 0) {
      const monthlyIncome   = txData.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const monthlyExpenses = txData.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      const savingsRate     = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

      // Low savings rate alert (< 5%)
      if (savingsRate < 5 && monthlyIncome > 0) {
        const key = `low_savings_${now.getFullYear()}_${now.getMonth()}`;
        if (!(await alreadySentToday(supabase, userId, key))) {
          await createNotification(supabase, {
            user_id: userId,
            title: "معدل الادخار منخفض جداً",
            message: `معدل ادخارك هذا الشهر ${savingsRate.toFixed(1)}% فقط. حاول تقليل المصروفات أو زيادة الدخل لتحسين وضعك المالي.`,
            type: "warning",
            source: "system",
            priority: "high",
            action_url: "/analytics",
            metadata: { scheduler_key: key },
          });
        }
      }

      // High burn rate (spending > 90% of income)
      if (monthlyIncome > 0 && monthlyExpenses / monthlyIncome > 0.9) {
        const key = `high_burn_${now.getFullYear()}_${now.getMonth()}`;
        if (!(await alreadySentToday(supabase, userId, key))) {
          await createNotification(supabase, {
            user_id: userId,
            title: "معدل الإنفاق مرتفع",
            message: `أنت تنفق ${((monthlyExpenses / monthlyIncome) * 100).toFixed(0)}% من دخلك هذا الشهر. راجع مصروفاتك لتجنب العجز.`,
            type: "warning",
            source: "system",
            priority: "normal",
            action_url: "/transactions?filter=monthly_expenses",
            metadata: { scheduler_key: key },
          });
        }
      }
    }

    // ── 4. Investment portfolio performance ────────────────────
    const { data: investments } = await supabase
      .from("investments")
      .select("amount_invested, current_value")
      .eq("user_id", userId)
      .not("current_value", "is", null);

    if (investments && investments.length > 0) {
      const totalInvested = investments.reduce((s, i) => s + Number(i.amount_invested), 0);
      const totalCurrent  = investments.reduce((s, i) => s + Number(i.current_value ?? i.amount_invested), 0);
      const gainPct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;
      const gainAbs = totalCurrent - totalInvested;

      if (gainPct >= 15) {
        const tier = Math.floor(gainPct / 10) * 10;
        const key  = `invest_gain_${tier}_${now.getFullYear()}_${now.getMonth()}`;
        if (!(await alreadySentToday(supabase, userId, key))) {
          await createNotification(supabase, {
            user_id:    userId,
            title:      "محفظتك تحقق مكاسب ممتازة 📈",
            message:    `محفظتك الاستثمارية ارتفعت ${gainPct.toFixed(1)}%. إجمالي الربح: €${gainAbs.toFixed(2)}.`,
            type:       "investment",
            source:     "investment",
            priority:   "normal",
            action_url: "/investments",
            metadata:   { scheduler_key: key },
          });
        }
      } else if (gainPct <= -10) {
        const tier = Math.floor(Math.abs(gainPct) / 5) * 5;
        const key  = `invest_loss_${tier}_${now.getFullYear()}_${now.getMonth()}`;
        if (!(await alreadySentToday(supabase, userId, key))) {
          await createNotification(supabase, {
            user_id:    userId,
            title:      "تراجع في محفظتك الاستثمارية ⚠️",
            message:    `محفظتك تراجعت ${Math.abs(gainPct).toFixed(1)}% (€${Math.abs(gainAbs).toFixed(2)}). راجع مراكزك وفكر في إعادة التوازن.`,
            type:       "warning",
            source:     "investment",
            priority:   "high",
            action_url: "/investments",
            metadata:   { scheduler_key: key },
          });
        }
      }
    }

    // ── 5. Unpaid work income ───────────────────────────────────
    const { data: unpaidWork } = await supabase
      .from("work_sessions")
      .select("id, expected_amount")
      .eq("user_id", userId)
      .neq("recurrence", "none")
      .limit(1)
      .maybeSingle();

    if (unpaidWork) {
      const { data: payments } = await supabase
        .from("work_payments")
        .select("amount")
        .eq("user_id", userId)
        .gte("payment_date", monthStart);

      const received = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
      if (received === 0) {
        const key = `unpaid_work_${now.getFullYear()}_${now.getMonth()}`;
        if (!(await alreadySentToday(supabase, userId, key))) {
          await createNotification(supabase, {
            user_id: userId,
            title: "دخل العمل غير محصّل هذا الشهر",
            message: "لم تسجّل أي دفعة عمل هذا الشهر. تأكد من متابعة دفعاتك المستحقة.",
            type: "work",
            source: "work",
            priority: "low",
            action_url: "/work",
            metadata: { scheduler_key: key },
          });
        }
      }
    }
    // ── 6. Positive income milestone ──────────────────────────
    if (txData && txData.length > 0) {
      const monthlyIncome = txData.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      if (monthlyIncome > 0) {
        // Check previous month to compare
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
        const { data: prevTx } = await supabase
          .from("transactions")
          .select("type, amount")
          .eq("user_id", userId)
          .gte("transaction_date", prevMonthStart)
          .lt("transaction_date", monthStart)
          .eq("type", "income");

        const prevIncome = (prevTx ?? []).reduce((s, t) => s + Number(t.amount), 0);
        if (prevIncome > 0 && monthlyIncome > prevIncome * 1.2) {
          const key = `income_up_${now.getFullYear()}_${now.getMonth()}`;
          if (!(await alreadySentToday(supabase, userId, key))) {
            const pct = ((monthlyIncome - prevIncome) / prevIncome) * 100;
            await createNotification(supabase, {
              user_id:    userId,
              title:      "دخلك الشهري ارتفع 🎉",
              message:    `دخل هذا الشهر €${monthlyIncome.toFixed(0)} — أعلى بـ ${pct.toFixed(0)}% عن الشهر الماضي. أداء رائع!`,
              type:       "success",
              source:     "system",
              priority:   "normal",
              action_url: "/analytics",
              metadata:   { scheduler_key: key },
            });
          }
        }
      }
    }

  } catch (err) {
    // Scheduler runs silently — never interrupt the user's session
    console.warn("[scheduler] error:", err);
  }
}
