import "server-only";
import { getDashboardStats } from "@/lib/analytics/analyticsService";
import type { FinancialSummary } from "./aiTypes";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type BudgetContext = FinancialSummary["budgets"][number];

function numberValue(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function currentMonthRange() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { month, year, start: dateOnly(start), end: dateOnly(end) };
}

async function getBudgetContext(userId: string, supabase: Supabase): Promise<BudgetContext[]> {
  const { month, year, start, end } = currentMonthRange();

  const { data: budgets, error } = await supabase
    .from("budgets")
    .select("id,category_id,monthly_limit,category:categories(name)")
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year);

  if (error || !budgets?.length) return [];

  const { data: transactions } = await supabase
    .from("transactions")
    .select("category_id,amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("transaction_date", start)
    .lt("transaction_date", end);

  const spending = new Map<string, number>();
  (transactions ?? []).forEach((transaction) => {
    if (!transaction.category_id) return;
    spending.set(
      transaction.category_id,
      (spending.get(transaction.category_id) ?? 0) + numberValue(transaction.amount),
    );
  });

  return budgets.map((budget) => {
    const limit = numberValue(budget.monthly_limit);
    const spent = spending.get(budget.category_id) ?? 0;
    const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const status: BudgetContext["status"] = spent > limit ? "over" : percent >= 85 ? "near_limit" : "safe";
    const category = Array.isArray(budget.category) ? budget.category[0] : budget.category;

    return {
      name: category?.name ?? "Budget",
      limit,
      spent,
      remaining: Math.max(limit - spent, 0),
      percent,
      status,
    };
  });
}

export async function buildFinancialContext(
  userId: string,
  supabase: Supabase
): Promise<FinancialSummary> {
  const dashboard = await getDashboardStats(userId, supabase);
  const budgets = await getBudgetContext(userId, supabase).catch(() => []);

  return {
    totalBalance: dashboard.totalBalance,
    monthlyIncome: dashboard.monthlyIncome,
    monthlyExpenses: dashboard.monthlyExpenses,
    savingsRate: dashboard.savingsRate,
    dailyBurn: dashboard.dailyBurn,
    workIncome: dashboard.workIncome,
    transactionCount: dashboard.transactionCount,
    topCategories: dashboard.spendingByCategory
      .slice(0, 5)
      .map((c) => ({ name: c.name, amount: c.value })),
    budgets,
    debtPayable: dashboard.debtTruth.total_payable_remaining,
    debtReceivable: dashboard.debtTruth.total_receivable_remaining,
    overdueDebts: dashboard.debtTruth.overdue_debts,
    activeDebts: dashboard.debtTruth.active_debts,
    monthlyTrend: dashboard.incomeVsExpenses.slice(-3).map((m) => ({
      month: m.month,
      income: m.income,
      expenses: m.expenses,
    })),
    recentTransactions: dashboard.recentTransactions.slice(0, 5).map((t) => ({
      title: t.title,
      amount: Number(t.amount),
      type: t.type,
      date: t.transaction_date,
    })),
  };
}
