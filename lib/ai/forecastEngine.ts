import type { Budget } from "@/types";

export interface ForecastInsight {
  budgetId: string;
  budgetName: string;
  severity: "critical" | "warning";
  /** 0 = already exceeded, >0 = days until depletion */
  daysToDepletion: number;
  projectedOverspend: number;
  remainingBudget: number;
  dailyBurn: number;
  spent: number;
  limit: number;
}

/**
 * Analyzes budgets and returns alerts for those on track to exceed their limit.
 * Uses the daily burn rate (spent / days elapsed) projected to month end.
 */
export function runForecastEngine(
  budgets: Budget[],
  now: Date = new Date(),
): ForecastInsight[] {
  const dayOfMonth   = now.getDate();
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft     = daysInMonth - dayOfMonth;

  const results: ForecastInsight[] = [];

  for (const b of budgets) {
    if (b.monthly_limit <= 0) continue;

    const dailyBurn        = dayOfMonth > 0 ? b.spent / dayOfMonth : 0;
    const projectedTotal   = dailyBurn * daysInMonth;
    const projectedOverspend = Math.max(0, projectedTotal - b.monthly_limit);
    const remaining        = b.remaining ?? b.monthly_limit - b.spent;

    // Already over
    if (b.status === "over" || remaining < 0) {
      results.push({
        budgetId:        b.id,
        budgetName:      b.category?.name ?? "Budget",
        severity:        "critical",
        daysToDepletion: 0,
        projectedOverspend,
        remainingBudget: remaining,
        dailyBurn,
        spent: b.spent,
        limit: b.monthly_limit,
      });
      continue;
    }

    // Will deplete before month end
    const daysToDepletion = dailyBurn > 0 ? Math.floor(remaining / dailyBurn) : Infinity;
    if (daysToDepletion < daysLeft) {
      results.push({
        budgetId:        b.id,
        budgetName:      b.category?.name ?? "Budget",
        severity:        daysToDepletion <= 3 ? "critical" : "warning",
        daysToDepletion: Math.max(0, daysToDepletion),
        projectedOverspend,
        remainingBudget: remaining,
        dailyBurn,
        spent: b.spent,
        limit: b.monthly_limit,
      });
      continue;
    }

    // Near limit (80–99%)
    if (b.status === "near_limit" && projectedTotal > b.monthly_limit * 0.9) {
      results.push({
        budgetId:        b.id,
        budgetName:      b.category?.name ?? "Budget",
        severity:        "warning",
        daysToDepletion,
        projectedOverspend,
        remainingBudget: remaining,
        dailyBurn,
        spent: b.spent,
        limit: b.monthly_limit,
      });
    }
  }

  // Sort: critical first, then fewest days remaining
  return results.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return a.daysToDepletion - b.daysToDepletion;
  });
}
