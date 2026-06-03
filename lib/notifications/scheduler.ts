/**
 * Smart Notification Scheduler
 * Runs on app load for authenticated users.
 * Checks financial data and creates alerts if conditions are met.
 * Each check is idempotent — uses metadata to avoid duplicate alerts.
 */

import { createNotification } from "./service";
import type { SupabaseClient } from "@supabase/supabase-js";

type Locale = "ar" | "en" | "de";

// ── Inline translations for server-side scheduler ────────────
const T = {
  overdue_debt_title:   { ar: (n: string) => `دين متأخر: ${n}`,              en: (n: string) => `Overdue debt: ${n}`,            de: (n: string) => `Überfällige Schuld: ${n}`        },
  overdue_debt_msg:     { ar: (n: string, a: string) => `لديك دين متأخر بمبلغ ${a} مع ${n}. تجنب الفائدة الإضافية بالسداد الآن.`,
                          en: (n: string, a: string) => `You have an overdue debt of ${a} with ${n}. Pay now to avoid extra charges.`,
                          de: (n: string, a: string) => `Sie haben eine überfällige Schuld von ${a} bei ${n}. Zahlen Sie jetzt.`   },

  debt_soon_title:      { ar: () => `تذكير: دين يستحق قريباً`,               en: () => `Reminder: Debt due soon`,                 de: () => `Erinnerung: Schuld bald fällig`           },
  debt_soon_msg:        { ar: (n: string, a: string, d: string) => `دين ${n} (${a}) يستحق في ${d}. خطّط للسداد الآن.`,
                          en: (n: string, a: string, d: string) => `Debt with ${n} (${a}) is due on ${d}. Plan your payment.`,
                          de: (n: string, a: string, d: string) => `Schuld bei ${n} (${a}) fällig am ${d}. Planen Sie die Zahlung.` },

  debt_7d_title:        { ar: () => `دين يستحق خلال أسبوع`,                  en: () => `Debt due within a week`,                  de: () => `Schuld in einer Woche fällig`             },
  debt_7d_msg:          { ar: (n: string, a: string, d: string) => `دين ${n} (${a}) يستحق في ${d}. ابدأ بالتحضير للسداد.`,
                          en: (n: string, a: string, d: string) => `Debt with ${n} (${a}) is due on ${d}. Start preparing.`,
                          de: (n: string, a: string, d: string) => `Schuld bei ${n} (${a}) fällig am ${d}. Beginnen Sie mit der Vorbereitung.` },

  low_savings_title:    { ar: () => `معدل الادخار منخفض جداً`,               en: () => `Savings rate is too low`,                 de: () => `Sparquote zu niedrig`                    },
  low_savings_msg:      { ar: (r: string) => `معدل ادخارك هذا الشهر ${r}% فقط. حاول تقليل المصروفات أو زيادة الدخل.`,
                          en: (r: string) => `Your savings rate this month is only ${r}%. Try reducing expenses or increasing income.`,
                          de: (r: string) => `Ihre Sparquote diesen Monat beträgt nur ${r}%. Versuchen Sie, Ausgaben zu reduzieren.` },

  high_burn_title:      { ar: () => `معدل الإنفاق مرتفع`,                    en: () => `High spending rate`,                      de: () => `Hohe Ausgabenquote`                       },
  high_burn_msg:        { ar: (p: string) => `أنت تنفق ${p}% من دخلك هذا الشهر. راجع مصروفاتك لتجنب العجز.`,
                          en: (p: string) => `You're spending ${p}% of your income this month. Review your expenses.`,
                          de: (p: string) => `Sie geben ${p}% Ihres Einkommens aus. Überprüfen Sie Ihre Ausgaben.`                  },

  portfolio_up_title:   { ar: () => `محفظتك تحقق مكاسب ممتازة 📈`,           en: () => `Portfolio is performing great 📈`,         de: () => `Portfolio macht ausgezeichnete Gewinne 📈` },
  portfolio_up_msg:     { ar: (p: string, g: string) => `محفظتك الاستثمارية ارتفعت ${p}%. إجمالي الربح: ${g}.`,
                          en: (p: string, g: string) => `Your portfolio is up ${p}%. Total gain: ${g}.`,
                          de: (p: string, g: string) => `Ihr Portfolio ist um ${p}% gestiegen. Gesamtgewinn: ${g}.`                 },

  portfolio_down_title: { ar: () => `تراجع في محفظتك الاستثمارية ⚠️`,        en: () => `Portfolio decline ⚠️`,                    de: () => `Portfolio-Rückgang ⚠️`                    },
  portfolio_down_msg:   { ar: (p: string, l: string) => `محفظتك تراجعت ${p}% (${l}). راجع مراكزك وفكر في إعادة التوازن.`,
                          en: (p: string, l: string) => `Your portfolio is down ${p}% (${l}). Review positions and consider rebalancing.`,
                          de: (p: string, l: string) => `Ihr Portfolio ist um ${p}% gesunken (${l}). Überprüfen Sie Ihre Positionen.` },

  unpaid_work_title:    { ar: () => `دخل العمل غير محصّل هذا الشهر`,         en: () => `Work income not collected this month`,    de: () => `Arbeitseinkommen diesen Monat nicht erhalten` },
  unpaid_work_msg:      { ar: () => `لم تسجّل أي دفعة عمل هذا الشهر. تأكد من متابعة دفعاتك المستحقة.`,
                          en: () => `No work payment recorded this month. Make sure to follow up on your pending payments.`,
                          de: () => `Keine Arbeitszahlung diesen Monat erfasst. Verfolgen Sie Ihre ausstehenden Zahlungen.` },

  income_up_title:      { ar: () => `دخلك الشهري ارتفع 🎉`,                  en: () => `Your monthly income increased 🎉`,        de: () => `Ihr monatliches Einkommen stieg 🎉`        },
  income_up_msg:        { ar: (a: string, p: string) => `دخل هذا الشهر ${a} — أعلى بـ ${p}% عن الشهر الماضي. أداء رائع!`,
                          en: (a: string, p: string) => `This month's income: ${a} — ${p}% higher than last month. Great performance!`,
                          de: (a: string, p: string) => `Einkommen diesen Monat: ${a} — ${p}% höher als letzten Monat. Tolle Leistung!` },

  budget_over_title:    { ar: (c: string) => `تجاوزت ميزانية "${c}"!`,        en: (c: string) => `Budget exceeded: "${c}"!`,       de: (c: string) => `Budget überschritten: "${c}"!`   },
  budget_near_title:    { ar: (c: string, p: string) => `تنبيه: ميزانية "${c}" وصلت ${p}%`,
                          en: (c: string, p: string) => `Alert: "${c}" budget at ${p}%`,
                          de: (c: string, p: string) => `Warnung: Budget "${c}" bei ${p}%`                                           },
  budget_over_msg:      { ar: (c: string, s: string, l: string) => `لقد تجاوزت حد ميزانية "${c}". أنفقت ${s} من ${l}.`,
                          en: (c: string, s: string, l: string) => `You exceeded the "${c}" budget. Spent ${s} of ${l}.`,
                          de: (c: string, s: string, l: string) => `Sie haben das "${c}"-Budget überschritten. Ausgegeben: ${s} von ${l}.` },
  budget_near_msg:      { ar: (c: string, p: string, r: string) => `أنفقت ${p}% من ميزانية "${c}". المتبقي: ${r}.`,
                          en: (c: string, p: string, r: string) => `Spent ${p}% of "${c}" budget. Remaining: ${r}.`,
                          de: (c: string, p: string, r: string) => `${p}% des "${c}"-Budgets ausgegeben. Verbleibend: ${r}.`        },

  bill_due_title:       { ar: (n: string) => `تذكير فاتورة: ${n}`,            en: (n: string) => `Bill reminder: ${n}`,            de: (n: string) => `Rechnungserinnerung: ${n}`        },
  bill_due_msg:         { ar: (n: string, a: string, d: string) => `فاتورة "${n}"${a ? ` (${a})` : ""} تستحق في ${d}. لا تنسَ الدفع.`,
                          en: (n: string, a: string, d: string) => `Bill "${n}"${a ? ` (${a})` : ""} is due on ${d}. Don't forget to pay.`,
                          de: (n: string, a: string, d: string) => `Rechnung "${n}"${a ? ` (${a})` : ""} fällig am ${d}. Vergessen Sie nicht zu zahlen.` },

  goal_progress_title:  { ar: (g: string) => `تقدم رائع في هدفك "${g}" 🎯`,  en: (g: string) => `Great progress on "${g}" goal 🎯`, de: (g: string) => `Toller Fortschritt bei Ziel "${g}" 🎯` },
  goal_progress_msg:    { ar: (p: string, s: string, t: string) => `لقد وصلت إلى ${p}% من هدفك المالي (${s} من ${t}). استمر في المدخرات!`,
                          en: (p: string, s: string, t: string) => `You've reached ${p}% of your goal (${s} of ${t}). Keep saving!`,
                          de: (p: string, s: string, t: string) => `Sie haben ${p}% Ihres Ziels erreicht (${s} von ${t}). Weiter sparen!` },

  asset_up_title:       { ar: (n: string) => `📈 ${n} تحقق مكاسب ممتازة`,   en: (n: string) => `📈 ${n} performing great`,       de: (n: string) => `📈 ${n} macht ausgezeichnete Gewinne` },
  asset_up_msg:         { ar: (n: string, p: string, g: string) => `استثمارك في "${n}" ارتفع ${p}% (+${g}).`,
                          en: (n: string, p: string, g: string) => `Your "${n}" investment is up ${p}% (+${g}).`,
                          de: (n: string, p: string, g: string) => `Ihr "${n}"-Investment ist um ${p}% gestiegen (+${g}).`          },
  asset_down_title:     { ar: (n: string) => `⚠️ ${n} يتراجع`,              en: (n: string) => `⚠️ ${n} declining`,              de: (n: string) => `⚠️ ${n} fällt`                    },
  asset_down_msg:       { ar: (n: string, p: string, l: string) => `استثمارك في "${n}" تراجع ${p}% (-${l}). راجع مركزك.`,
                          en: (n: string, p: string, l: string) => `Your "${n}" investment is down ${p}% (-${l}). Review your position.`,
                          de: (n: string, p: string, l: string) => `Ihr "${n}"-Investment ist um ${p}% gesunken (-${l}). Überprüfen Sie Ihre Position.` },

  no_category:          { ar: "فئة", en: "category", de: "Kategorie" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tr(locale: Locale, key: keyof typeof T, ...args: any[]): string {
  const dict = T[key] as Record<Locale, (...a: unknown[]) => string>;
  const fn   = dict[locale] ?? dict["ar"];
  return fn(...args);
}

const TODAY = new Date().toISOString().slice(0, 10);

/** Check if we already sent this notification today */
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

export async function runScheduler(
  supabase: SupabaseClient,
  userId: string,
  locale: Locale = "ar"
): Promise<void> {
  try {
    const now        = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const nextMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);

    // ── 1. Overdue debts ────────────────────────────────────────
    const { data: overdueDebts } = await supabase
      .from("debts")
      .select("id,person_or_entity,total_amount,paid_amount")
      .eq("user_id", userId).eq("status", "overdue").limit(5);

    for (const debt of overdueDebts ?? []) {
      const key = `overdue_debt_${debt.id}_${TODAY}`;
      if (await alreadySentToday(supabase, userId, key)) continue;
      const remaining = `${(Number(debt.total_amount) - Number(debt.paid_amount)).toFixed(2)}`;
      await createNotification(supabase, {
        user_id: userId,
        title:   tr(locale, "overdue_debt_title", debt.person_or_entity),
        message: tr(locale, "overdue_debt_msg",   debt.person_or_entity, remaining),
        type: "debt", source: "system", priority: "high",
        related_source_id: debt.id, action_url: "/debts",
        metadata: { scheduler_key: key },
      });
    }

    // ── 2. Debts due within 3 days ──────────────────────────────
    const in3Days = new Date(); in3Days.setDate(in3Days.getDate() + 3);
    const { data: upcomingDebts } = await supabase
      .from("debts")
      .select("id,person_or_entity,total_amount,paid_amount,due_date")
      .eq("user_id", userId).in("status", ["active", "partially_paid"])
      .lte("due_date", in3Days.toISOString().slice(0, 10)).gte("due_date", TODAY).limit(5);

    for (const debt of upcomingDebts ?? []) {
      const key = `upcoming_debt_${debt.id}_${TODAY}`;
      if (await alreadySentToday(supabase, userId, key)) continue;
      const remaining = `${(Number(debt.total_amount) - Number(debt.paid_amount)).toFixed(2)}`;
      await createNotification(supabase, {
        user_id: userId,
        title:   tr(locale, "debt_soon_title"),
        message: tr(locale, "debt_soon_msg", debt.person_or_entity, remaining, debt.due_date),
        type: "reminder", source: "debt", priority: "high",
        related_source_id: debt.id, action_url: "/debts",
        metadata: { scheduler_key: key },
      });
    }

    // ── 3. Analytics-based alerts ───────────────────────────────
    const { data: txData } = await supabase
      .from("transactions").select("type,amount,source")
      .eq("user_id", userId)
      .gte("transaction_date", monthStart).lt("transaction_date", nextMonth);

    if (txData && txData.length > 0) {
      const monthlyIncome   = txData.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const monthlyExpenses = txData.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      const savingsRate     = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

      if (savingsRate < 5 && monthlyIncome > 0) {
        const key = `low_savings_${now.getFullYear()}_${now.getMonth()}`;
        if (!(await alreadySentToday(supabase, userId, key))) {
          await createNotification(supabase, {
            user_id: userId,
            title:   tr(locale, "low_savings_title"),
            message: tr(locale, "low_savings_msg", savingsRate.toFixed(1)),
            type: "warning", source: "system", priority: "high",
            action_url: "/analytics", metadata: { scheduler_key: key },
          });
        }
      }

      if (monthlyIncome > 0 && monthlyExpenses / monthlyIncome > 0.9) {
        const key = `high_burn_${now.getFullYear()}_${now.getMonth()}`;
        if (!(await alreadySentToday(supabase, userId, key))) {
          await createNotification(supabase, {
            user_id: userId,
            title:   tr(locale, "high_burn_title"),
            message: tr(locale, "high_burn_msg", ((monthlyExpenses / monthlyIncome) * 100).toFixed(0)),
            type: "warning", source: "system", priority: "normal",
            action_url: "/transactions?filter=monthly_expenses",
            metadata: { scheduler_key: key },
          });
        }
      }

      // Income milestone (20%+ growth vs last month)
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const { data: prevTx } = await supabase
        .from("transactions").select("type,amount")
        .eq("user_id", userId)
        .gte("transaction_date", prevMonthStart).lt("transaction_date", monthStart).eq("type", "income");
      const prevIncome = (prevTx ?? []).reduce((s, t) => s + Number(t.amount), 0);
      if (prevIncome > 0 && monthlyIncome > prevIncome * 1.2) {
        const key = `income_up_${now.getFullYear()}_${now.getMonth()}`;
        if (!(await alreadySentToday(supabase, userId, key))) {
          const pct = ((monthlyIncome - prevIncome) / prevIncome) * 100;
          await createNotification(supabase, {
            user_id: userId,
            title:   tr(locale, "income_up_title"),
            message: tr(locale, "income_up_msg", monthlyIncome.toFixed(0), pct.toFixed(0)),
            type: "success", source: "system", priority: "normal",
            action_url: "/analytics", metadata: { scheduler_key: key },
          });
        }
      }
    }

    // ── 4. Portfolio performance ────────────────────────────────
    const { data: investments } = await supabase
      .from("investments").select("amount_invested,current_value")
      .eq("user_id", userId).not("current_value", "is", null);

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
            user_id: userId,
            title:   tr(locale, "portfolio_up_title"),
            message: tr(locale, "portfolio_up_msg", gainPct.toFixed(1), gainAbs.toFixed(2)),
            type: "investment", source: "investment", priority: "normal",
            action_url: "/investments", metadata: { scheduler_key: key },
          });
        }
      } else if (gainPct <= -10) {
        const tier = Math.floor(Math.abs(gainPct) / 5) * 5;
        const key  = `invest_loss_${tier}_${now.getFullYear()}_${now.getMonth()}`;
        if (!(await alreadySentToday(supabase, userId, key))) {
          await createNotification(supabase, {
            user_id: userId,
            title:   tr(locale, "portfolio_down_title"),
            message: tr(locale, "portfolio_down_msg", Math.abs(gainPct).toFixed(1), Math.abs(gainAbs).toFixed(2)),
            type: "warning", source: "investment", priority: "high",
            action_url: "/investments", metadata: { scheduler_key: key },
          });
        }
      }
    }

    // ── 5. Unpaid work income ───────────────────────────────────
    const { data: unpaidWork } = await supabase
      .from("work_sessions").select("id,expected_amount")
      .eq("user_id", userId).neq("recurrence", "none").limit(1).maybeSingle();

    if (unpaidWork) {
      const { data: payments } = await supabase
        .from("work_payments").select("amount")
        .eq("user_id", userId).gte("payment_date", monthStart);
      const received = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
      if (received === 0) {
        const key = `unpaid_work_${now.getFullYear()}_${now.getMonth()}`;
        if (!(await alreadySentToday(supabase, userId, key))) {
          await createNotification(supabase, {
            user_id: userId,
            title:   tr(locale, "unpaid_work_title"),
            message: tr(locale, "unpaid_work_msg"),
            type: "work", source: "work", priority: "low",
            action_url: "/work", metadata: { scheduler_key: key },
          });
        }
      }
    }

    // ── 6. Budget alerts (≥80% spent) ──────────────────────────
    const { data: budgets } = await supabase
      .from("budgets").select("id,category_id,monthly_limit")
      .eq("user_id", userId).eq("month", now.getMonth() + 1).eq("year", now.getFullYear());

    if (budgets && budgets.length > 0) {
      const { data: categorySpend } = await supabase
        .from("transactions").select("category_id,amount")
        .eq("user_id", userId).eq("type", "expense")
        .gte("transaction_date", monthStart).lt("transaction_date", nextMonth);

      const spendMap = new Map<string, number>();
      for (const tx of categorySpend ?? []) {
        if (tx.category_id) spendMap.set(tx.category_id, (spendMap.get(tx.category_id) ?? 0) + Number(tx.amount));
      }

      for (const budget of budgets) {
        const spent = spendMap.get(budget.category_id) ?? 0;
        const limit = Number(budget.monthly_limit);
        const pct   = limit > 0 ? (spent / limit) * 100 : 0;
        if (pct < 80) continue;

        const tier = pct >= 100 ? 100 : 80;
        const key  = `budget_alert_${budget.id}_${tier}_${now.getFullYear()}_${now.getMonth()}`;
        if (await alreadySentToday(supabase, userId, key)) continue;

        const { data: cat } = await supabase.from("categories").select("name").eq("id", budget.category_id).maybeSingle();
        const catName   = cat?.name ?? T.no_category[locale];
        const remaining = Math.max(0, limit - spent);

        await createNotification(supabase, {
          user_id: userId,
          title:   tier >= 100 ? tr(locale, "budget_over_title", catName) : tr(locale, "budget_near_title", catName, tier.toString()),
          message: tier >= 100
            ? tr(locale, "budget_over_msg", catName, spent.toFixed(0), limit.toFixed(0))
            : tr(locale, "budget_near_msg", catName, pct.toFixed(0), remaining.toFixed(0)),
          type: "budget", source: "budget",
          priority: tier >= 100 ? "high" : "normal",
          action_url: "/budgets", metadata: { scheduler_key: key },
        });
      }
    }

    // ── 7. Bill reminders (due within 3 days) ──────────────────
    const in3DaysBill = new Date(); in3DaysBill.setDate(in3DaysBill.getDate() + 3);
    const { data: upcomingBills } = await supabase
      .from("bills").select("id,name,amount,due_date")
      .eq("user_id", userId).in("status", ["unpaid"])
      .lte("due_date", in3DaysBill.toISOString().slice(0, 10)).gte("due_date", TODAY).limit(5);

    for (const bill of upcomingBills ?? []) {
      const key = `bill_due_${bill.id}_${TODAY}`;
      if (await alreadySentToday(supabase, userId, key)) continue;
      const amount = bill.amount ? bill.amount.toFixed(2) : "";
      await createNotification(supabase, {
        user_id: userId,
        title:   tr(locale, "bill_due_title", bill.name),
        message: tr(locale, "bill_due_msg", bill.name, amount, bill.due_date),
        type: "bill", source: "bill", priority: "high",
        related_source_id: bill.id, action_url: "/bills",
        metadata: { scheduler_key: key },
      });
    }

    // ── 8. Goal progress milestones ─────────────────────────────
    const { data: goals } = await supabase
      .from("goals").select("id,title,target_amount,saved_amount,status")
      .eq("user_id", userId).neq("status", "completed");

    for (const goal of goals ?? []) {
      const target = Number(goal.target_amount);
      const saved  = Number(goal.saved_amount);
      if (target <= 0) continue;
      const pct  = Math.min(100, (saved / target) * 100);
      const tier = pct >= 75 ? 75 : pct >= 50 ? 50 : pct >= 25 ? 25 : 0;
      if (tier === 0) continue;

      const key     = `goal_progress_${goal.id}_${tier}`;
      const { data: prior } = await supabase
        .from("notifications").select("id")
        .eq("user_id", userId).contains("metadata", { scheduler_key: key }).limit(1).maybeSingle();
      if (prior) continue;

      await createNotification(supabase, {
        user_id: userId,
        title:   tr(locale, "goal_progress_title", goal.title),
        message: tr(locale, "goal_progress_msg", tier.toString(), saved.toFixed(0), target.toFixed(0)),
        type: "goal", source: "goal", priority: "normal",
        related_source_id: goal.id, action_url: "/goals",
        metadata: { scheduler_key: key },
      });
    }

    // ── 9. Debts due within 7 days ──────────────────────────────
    const in7Days = new Date(); in7Days.setDate(in7Days.getDate() + 7);
    const in3DaysStr = new Date(); in3DaysStr.setDate(in3DaysStr.getDate() + 3);
    const { data: soonDebts } = await supabase
      .from("debts").select("id,person_or_entity,total_amount,paid_amount,due_date")
      .eq("user_id", userId).in("status", ["active", "partially_paid"])
      .lte("due_date", in7Days.toISOString().slice(0, 10))
      .gt("due_date", in3DaysStr.toISOString().slice(0, 10)).limit(5);

    for (const debt of soonDebts ?? []) {
      const key = `debt_7d_${debt.id}_${TODAY}`;
      if (await alreadySentToday(supabase, userId, key)) continue;
      const remaining = `${(Number(debt.total_amount) - Number(debt.paid_amount)).toFixed(2)}`;
      await createNotification(supabase, {
        user_id: userId,
        title:   tr(locale, "debt_7d_title"),
        message: tr(locale, "debt_7d_msg", debt.person_or_entity, remaining, debt.due_date),
        type: "debt", source: "debt", priority: "normal",
        related_source_id: debt.id, action_url: "/debts",
        metadata: { scheduler_key: key },
      });
    }

    // ── 10. Per-asset investment alerts ────────────────────────
    const { data: allInvestments } = await supabase
      .from("investments").select("id,asset_name,amount_invested,current_value")
      .eq("user_id", userId).not("current_value", "is", null);

    for (const inv of allInvestments ?? []) {
      const invested = Number(inv.amount_invested);
      const current  = Number(inv.current_value ?? inv.amount_invested);
      const gainPct  = invested > 0 ? ((current - invested) / invested) * 100 : 0;

      if (gainPct >= 20) {
        const tier = Math.floor(gainPct / 10) * 10;
        const key  = `inv_asset_gain_${inv.id}_${tier}_${now.getFullYear()}_${now.getMonth()}`;
        if (await alreadySentToday(supabase, userId, key)) continue;
        await createNotification(supabase, {
          user_id: userId,
          title:   tr(locale, "asset_up_title", inv.asset_name),
          message: tr(locale, "asset_up_msg",   inv.asset_name, gainPct.toFixed(1), (current - invested).toFixed(2)),
          type: "investment", source: "investment", priority: "normal",
          related_source_id: inv.id, action_url: "/investments",
          metadata: { scheduler_key: key },
        });
      } else if (gainPct <= -15) {
        const tier = Math.floor(Math.abs(gainPct) / 5) * 5;
        const key  = `inv_asset_loss_${inv.id}_${tier}_${now.getFullYear()}_${now.getMonth()}`;
        if (await alreadySentToday(supabase, userId, key)) continue;
        await createNotification(supabase, {
          user_id: userId,
          title:   tr(locale, "asset_down_title", inv.asset_name),
          message: tr(locale, "asset_down_msg",   inv.asset_name, Math.abs(gainPct).toFixed(1), Math.abs(current - invested).toFixed(2)),
          type: "investment", source: "investment", priority: "high",
          related_source_id: inv.id, action_url: "/investments",
          metadata: { scheduler_key: key },
        });
      }
    }

  } catch (err) {
    console.warn("[scheduler] error:", err);
  }
}
