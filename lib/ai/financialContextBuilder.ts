import "server-only";
import { getDashboardStats } from "@/lib/analytics/analyticsService";
import type { FinancialSummary, FinancialSummaryV2 } from "./aiTypes";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function currentMonthRange() {
  const now  = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const end   = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { month, year, start, end };
}

type BudgetCtx = FinancialSummary["budgets"][number];

async function getBudgetContext(userId: string, supabase: Supabase): Promise<BudgetCtx[]> {
  const { month, year, start, end } = currentMonthRange();

  const { data: budgets } = await supabase
    .from("budgets")
    .select("id,category_id,monthly_limit,category:categories(name)")
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year);

  if (!budgets?.length) return [];

  const { data: txns } = await supabase
    .from("transactions")
    .select("category_id,amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("transaction_date", start)
    .lt("transaction_date", end);

  const spending = new Map<string, number>();
  (txns ?? []).forEach(t => {
    if (!t.category_id) return;
    spending.set(t.category_id, (spending.get(t.category_id) ?? 0) + num(t.amount));
  });

  return budgets.map(b => {
    const limit = num(b.monthly_limit);
    const spent = spending.get(b.category_id) ?? 0;
    const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const status: BudgetCtx["status"] = spent > limit ? "over" : percent >= 85 ? "near_limit" : "safe";
    const category = Array.isArray(b.category) ? b.category[0] : b.category;
    return { name: category?.name ?? "Budget", limit, spent, remaining: Math.max(limit - spent, 0), percent, status };
  });
}

// ── Lean v1 context (backward compat) ─────────────────────────

export async function buildFinancialContext(userId: string, supabase: Supabase): Promise<FinancialSummary> {
  const [dashboard, budgets] = await Promise.all([
    getDashboardStats(userId, supabase),
    getBudgetContext(userId, supabase).catch(() => [] as BudgetCtx[]),
  ]);

  return {
    totalBalance:       dashboard.totalBalance,
    monthlyIncome:      dashboard.monthlyIncome,
    monthlyExpenses:    dashboard.monthlyExpenses,
    savingsRate:        dashboard.savingsRate,
    dailyBurn:          dashboard.dailyBurn,
    workIncome:         dashboard.workIncome,
    transactionCount:   dashboard.transactionCount,
    topCategories:      dashboard.spendingByCategory.slice(0, 5).map(c => ({ name: c.name, amount: c.value })),
    budgets,
    debtPayable:        dashboard.debtTruth.total_payable_remaining,
    debtReceivable:     dashboard.debtTruth.total_receivable_remaining,
    overdueDebts:       dashboard.debtTruth.overdue_debts,
    activeDebts:        dashboard.debtTruth.active_debts,
    monthlyTrend:       dashboard.incomeVsExpenses.slice(-3).map(m => ({ month: m.month, income: m.income, expenses: m.expenses })),
    recentTransactions: dashboard.recentTransactions.slice(0, 5).map(t => ({
      title: t.title, amount: num(t.amount), type: t.type, date: t.transaction_date,
    })),
  };
}

// ── Rich v2 context — used by Phase 10 advisors ────────────────

export async function buildRichFinancialContext(userId: string, supabase: Supabase): Promise<FinancialSummaryV2> {
  const [base, richData] = await Promise.all([
    buildFinancialContext(userId, supabase),
    fetchRichData(userId, supabase),
  ]);

  // Health score (mirrors Phase 9 bundle logic)
  const monthlyInc   = base.monthlyIncome || 1;
  const debtRatio    = base.debtPayable / monthlyInc;
  const sr           = base.savingsRate;
  const savingsScore = sr <= 0 ? 0 : sr >= 20 ? 30 : Math.round((sr / 20) * 30);
  const debtScore    = debtRatio === 0 ? 30 : debtRatio >= 12 ? 0 : Math.round(((12 - debtRatio) / 12) * 30);
  const avgUtil      = base.budgets.length ? base.budgets.reduce((s, b) => s + b.percent, 0) / base.budgets.length : 50;
  const budgetScore  = Math.round(Math.max(0, 20 - (avgUtil / 100) * 20) + 10);
  const emMonths     = base.monthlyExpenses > 0 ? richData.totalCash / base.monthlyExpenses : 0;
  const emergScore   = emMonths >= 6 ? 20 : emMonths >= 3 ? 15 : emMonths >= 1 ? 8 : 0;
  const healthScore  = Math.min(100, Math.max(0, savingsScore + debtScore + budgetScore + emergScore));

  const healthLabel = healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : healthScore >= 40 ? "Fair" : "Needs Attention";

  // Forecast: simple monthly projection from recurring
  const projectedIncome   = Math.max(base.monthlyIncome, richData.fixedMonthlyIncome);
  const projectedExpenses = Math.max(base.monthlyExpenses, richData.fixedMonthlyExpenses + richData.subMonthly);
  const projectedNet      = projectedIncome - projectedExpenses;

  return {
    ...base,
    netWorth:     richData.totalCash + richData.invCurrentValue - base.debtPayable,
    cashAccounts: richData.accounts,
    investments: {
      totalValue:    richData.invCurrentValue,
      totalInvested: richData.invTotalInvested,
      profitLoss:    richData.invProfitLoss,
      profitLossPct: richData.invPct,
      count:         richData.invCount,
      topAsset:      richData.topAsset,
    },
    subscriptions: {
      active:       richData.subs,
      totalMonthly: richData.subMonthly,
    },
    goals:        richData.goals,
    debtDetails:  richData.debtDetails,
    workDetails:  richData.workDetails,
    health: {
      score:       healthScore,
      savingsRate: sr,
      debtRatio:   Math.round(debtRatio * 10) / 10,
      label:       healthLabel,
    },
    forecastMonthly: {
      projectedIncome,
      projectedExpenses,
      projectedNet,
    },
  };
}

// ── Fetch rich data from all 9 sources ────────────────────────

async function fetchRichData(userId: string, supabase: Supabase) {
  const [accountsRes, invRes, subsRes, goalsRes, debtsRes, workRes, recurringRes] = await Promise.all([
    supabase.from("accounts").select("name,balance").eq("user_id", userId),

    supabase.from("investments").select("name,asset_type,purchase_price,current_price,quantity,purchase_date")
      .eq("user_id", userId),

    supabase.from("subscriptions").select("name,amount,billing_cycle,status,next_billing_date")
      .eq("user_id", userId).eq("status", "active"),

    supabase.from("goals").select("name,target_amount,current_amount,monthly_contribution,status,target_date")
      .eq("user_id", userId).neq("status", "completed"),

    supabase.from("debts").select("name,original_amount,amount_paid,direction,due_date,status")
      .eq("user_id", userId).neq("status", "paid"),

    supabase.from("work_sessions").select("hours_worked,expected_amount,payment_status")
      .eq("user_id", userId)
      .gte("session_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),

    supabase.from("recurring_transactions").select("amount,type,frequency").eq("user_id", userId).eq("is_active", true),
  ]);

  // Accounts
  const accounts  = (accountsRes.data ?? []).map(a => ({ name: a.name, balance: num(a.balance) }));
  const totalCash = accounts.reduce((s, a) => s + a.balance, 0);

  // Investments
  const invData          = invRes.data ?? [];
  const invTotalInvested = invData.reduce((s, i) => s + num(i.purchase_price) * num(i.quantity), 0);
  const invCurrentValue  = invData.reduce((s, i) => s + num(i.current_price)  * num(i.quantity), 0);
  const invProfitLoss    = invCurrentValue - invTotalInvested;
  const invPct           = invTotalInvested > 0 ? Math.round((invProfitLoss / invTotalInvested) * 100) : 0;
  const invCount         = invData.length;

  // Top asset by value
  const assetValueMap = new Map<string, number>();
  invData.forEach(i => {
    const val = num(i.current_price) * num(i.quantity);
    assetValueMap.set(i.asset_type ?? "other", (assetValueMap.get(i.asset_type ?? "other") ?? 0) + val);
  });
  const topAsset = invCount > 0 ? ([...assetValueMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) : null;

  // Subscriptions
  function toMonthly(amount: number, cycle: string): number {
    switch (cycle) {
      case "monthly":   return amount;
      case "yearly":    return amount / 12;
      case "weekly":    return amount * 4.33;
      case "quarterly": return amount / 3;
      default:          return amount;
    }
  }
  const subs = (subsRes.data ?? []).map(s => ({
    name:     s.name,
    amount:   num(s.amount),
    cycle:    s.billing_cycle ?? "monthly",
    lastUsed: s.next_billing_date ?? undefined,
  }));
  const subMonthly = subs.reduce((s, sub) => s + toMonthly(sub.amount, sub.cycle), 0);

  // Goals
  const goalsData = (goalsRes.data ?? []);
  const goals = goalsData.map(g => {
    const target  = num(g.target_amount);
    const current = num(g.current_amount);
    const progress = target > 0 ? Math.round((current / target) * 100) : 0;
    const remaining = Math.max(target - current, 0);
    const monthly = num(g.monthly_contribution);
    const monthsNeeded = monthly > 0 ? Math.ceil(remaining / monthly) : null;
    return {
      name:          g.name,
      target,
      current,
      progress,
      status:        g.status ?? "active",
      monthlyNeeded: monthsNeeded !== null ? monthsNeeded : undefined,
    };
  });

  // Debts detail
  const debtDetails = (debtsRes.data ?? []).map(d => {
    const original  = num(d.original_amount);
    const paid      = num(d.amount_paid);
    const remaining = Math.max(original - paid, 0);
    const isOverdue = d.due_date ? new Date(d.due_date) < new Date() : false;
    return {
      name:      d.name,
      remaining,
      direction: (d.direction ?? "payable") as "payable" | "receivable",
      dueDate:   d.due_date ?? null,
      isOverdue,
    };
  }).sort((a, b) => b.remaining - a.remaining);

  // Work sessions this month
  const workSessions = workRes.data ?? [];
  const hoursThisMonth = workSessions.reduce((s, w) => s + num(w.hours_worked), 0);
  const expected       = workSessions.reduce((s, w) => s + num(w.expected_amount), 0);
  const received       = workSessions.filter(w => w.payment_status === "paid").reduce((s, w) => s + num(w.expected_amount), 0);
  const workDetails = { hoursThisMonth, expected, received, unpaid: Math.max(expected - received, 0) };

  // Recurring → fixed monthly income/expense estimate
  let fixedMonthlyIncome = 0, fixedMonthlyExpenses = 0;
  (recurringRes.data ?? []).forEach(r => {
    const monthly = toMonthly(num(r.amount), r.frequency ?? "monthly");
    if (r.type === "income") fixedMonthlyIncome   += monthly;
    else                     fixedMonthlyExpenses += monthly;
  });

  return {
    accounts, totalCash,
    invTotalInvested, invCurrentValue, invProfitLoss, invPct, invCount, topAsset,
    subs, subMonthly,
    goals,
    debtDetails,
    workDetails,
    fixedMonthlyIncome, fixedMonthlyExpenses,
  };
}
