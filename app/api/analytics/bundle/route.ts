import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLedgerAnalytics } from "@/lib/analytics/ledger-engine";
import { getForecasts } from "@/lib/analytics/forecasting";
import { getDebtAnalytics, getInvestmentAnalytics, getWorkAnalytics } from "@/lib/analytics/analyticsService";

export const dynamic = "force-dynamic";

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  // Run all queries in parallel
  const [ledger, debts, investments, work, accountsRes, budgetsRes, goalsRes] = await Promise.all([
    getLedgerAnalytics(supabase, user.id),
    getDebtAnalytics(user.id, supabase),
    getInvestmentAnalytics(user.id, supabase),
    getWorkAnalytics(user.id, supabase),

    supabase
      .from("accounts")
      .select("id,name,balance,currency")
      .eq("user_id", user.id),

    supabase
      .from("budgets")
      .select("id,name,limit_amount,category_id,period")
      .eq("user_id", user.id),

    supabase
      .from("goals")
      .select("id,name,target_amount,current_amount,status")
      .eq("user_id", user.id),
  ]);

  // ── Net Worth ──────────────────────────────────────────────

  const totalCash        = (accountsRes.data ?? []).reduce((s, a) => s + num(a.balance), 0);
  const totalInvestments = investments.current_value ?? 0;
  const totalDebtOwed    = debts.total_payable_remaining ?? 0;
  const netWorth         = totalCash + totalInvestments - totalDebtOwed;

  // ── Budget utilization ─────────────────────────────────────

  const budgets = (budgetsRes.data ?? []).map(b => ({
    id:           b.id,
    name:         b.name,
    limitAmount:  num(b.limit_amount),
    categoryId:   b.category_id,
    period:       b.period,
    spent:        0,  // enriched below from ledger expense categories
    utilization:  0,
  }));

  // Match budget categories against ledger expense breakdown
  for (const budget of budgets) {
    const catEntry = ledger.expenseByCategory.find(c => c.categoryId === budget.categoryId);
    budget.spent = catEntry?.amount ?? 0;
    budget.utilization = budget.limitAmount > 0 ? Math.round((budget.spent / budget.limitAmount) * 100) : 0;
  }

  // ── Goals summary ──────────────────────────────────────────

  const goals = (goalsRes.data ?? []).map(g => ({
    id:           g.id,
    name:         g.name,
    targetAmount: num(g.target_amount),
    currentAmount: num(g.current_amount),
    status:       g.status,
    progress:     num(g.target_amount) > 0
      ? Math.round((num(g.current_amount) / num(g.target_amount)) * 100)
      : 0,
  }));

  // ── Health Score (0–100) ───────────────────────────────────

  // Factor 1: Savings rate (max 30 pts) — target ≥ 20%
  const sr = ledger.kpis.savingsRate;
  const savingsScore = sr <= 0 ? 0 : sr >= 20 ? 30 : Math.round((sr / 20) * 30);

  // Factor 2: Debt ratio (max 30 pts) — (payable remaining / monthly income); < 3× is excellent
  const monthlyInc = ledger.kpis.monthlyIncome || ledger.kpis.avgMonthlyIncome;
  const debtRatio  = monthlyInc > 0 ? totalDebtOwed / monthlyInc : 0;
  const debtScore  = debtRatio === 0 ? 30 : debtRatio >= 12 ? 0 : Math.round(((12 - debtRatio) / 12) * 30);

  // Factor 3: Budget adherence (max 20 pts) — avg utilization ≤ 100% is good
  const avgUtil  = budgets.length
    ? budgets.reduce((s, b) => s + b.utilization, 0) / budgets.length
    : 100;
  const budgetScore = avgUtil <= 100 ? Math.round(((100 - Math.min(avgUtil, 100)) / 100) * 20 + 20 * 0.5)
    : 0;

  // Factor 4: Emergency fund proxy (max 20 pts) — cash covers 3+ months expenses
  const monthlyExp   = ledger.kpis.monthlyExpenses || ledger.kpis.avgMonthlyExpenses;
  const emMonths     = monthlyExp > 0 ? totalCash / monthlyExp : 0;
  const emergScore   = emMonths >= 6 ? 20 : emMonths >= 3 ? 15 : emMonths >= 1 ? 8 : 0;

  const healthScore  = Math.min(100, Math.max(0, savingsScore + debtScore + budgetScore + emergScore));
  const healthFactors = {
    savingsScore,
    debtScore,
    budgetScore,
    emergencyScore: emergScore,
    savingsRate:    sr,
    debtRatio:      Math.round(debtRatio * 10) / 10,
    budgetAvgUtil:  Math.round(avgUtil),
    emergMonths:    Math.round(emMonths * 10) / 10,
  };

  // ── Forecast ───────────────────────────────────────────────

  const forecast = await getForecasts(supabase, user.id, ledger.monthly);

  // ── Response ───────────────────────────────────────────────

  return NextResponse.json({
    ledger,
    debts,
    investments,
    work,
    accounts: accountsRes.data ?? [],
    budgets,
    goals,
    netWorth: {
      total:       netWorth,
      cash:        totalCash,
      investments: totalInvestments,
      debtOwed:    totalDebtOwed,
    },
    health: {
      score:   healthScore,
      factors: healthFactors,
    },
    forecast,
  });
}
