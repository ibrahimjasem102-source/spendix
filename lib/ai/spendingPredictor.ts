import type { Transaction } from "@/types";

export type SpendingTrendType = "increasing" | "decreasing" | "stable";

export interface SpendingTrend {
  type:               SpendingTrendType;
  /** Avg % change per month (positive = growing, negative = shrinking) */
  trendPctPerMonth:   number;
  last3MonthsAvg:     number;
  predictedNextMonth: number;
  monthsAnalyzed:     number;
}

/**
 * Calculates the month-over-month expense trend using the last 3–4 complete
 * calendar months and predicts the next month's total spending.
 */
export function runSpendingPredictor(
  transactions: Transaction[],
  now: Date = new Date(),
): SpendingTrend | null {
  const expenses = transactions.filter((t) => t.type === "expense");
  if (expenses.length < 5) return null;

  // Collect totals for up to 4 complete previous months
  const monthlies: { key: string; total: number }[] = [];
  for (let i = 1; i <= 4; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = expenses
      .filter((t) => t.transaction_date?.startsWith(key))
      .reduce((s, t) => s + Number(t.amount), 0);
    if (total > 0) monthlies.unshift({ key, total }); // oldest first
  }

  if (monthlies.length < 2) return null;

  // Month-over-month % changes
  const changes: number[] = [];
  for (let i = 1; i < monthlies.length; i++) {
    const prev = monthlies[i - 1].total;
    const curr = monthlies[i].total;
    if (prev > 0) changes.push(((curr - prev) / prev) * 100);
  }

  const avgChange = changes.reduce((s, c) => s + c, 0) / changes.length;
  const last3     = monthlies.slice(-3);
  const avg3      = last3.reduce((s, m) => s + m.total, 0) / last3.length;
  const lastTotal = monthlies[monthlies.length - 1].total;
  const predicted = Math.round(lastTotal * (1 + avgChange / 100));

  let type: SpendingTrendType = "stable";
  if (avgChange > 6)  type = "increasing";
  if (avgChange < -6) type = "decreasing";

  return {
    type,
    trendPctPerMonth:   Math.round(Math.abs(avgChange) * 10) / 10,
    last3MonthsAvg:     Math.round(avg3),
    predictedNextMonth: predicted,
    monthsAnalyzed:     monthlies.length,
  };
}
