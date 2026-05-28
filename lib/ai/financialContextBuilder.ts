import "server-only";
import { getDashboardStats } from "@/lib/analytics/analyticsService";
import type { FinancialSummary } from "./aiTypes";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function buildFinancialContext(
  userId: string,
  supabase: Supabase
): Promise<FinancialSummary> {
  const dashboard = await getDashboardStats(userId, supabase);

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
