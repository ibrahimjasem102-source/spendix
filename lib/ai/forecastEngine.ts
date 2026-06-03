import type { Budget } from "@/types";

export interface ForecastInsight {
  budgetId: string;
  budgetName: string;
  kind: "over" | "depleting" | "near_limit";
  severity: "critical" | "warning";
  /** 0 = already exceeded, >0 = days until depletion */
  daysToDepletion: number;
  projectedOverspend: number;
  remainingBudget: number;
  dailyBurn: number;
  spent: number;
  limit: number;
  percent: number;
}

/**
 * Analyzes budgets with the same status thresholds used by the budgets page:
 * safe < 85%, near_limit 85-100%, over > 100%.
 */
export function runForecastEngine(
  budgets: Budget[],
  now: Date = new Date(),
): ForecastInsight[] {
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - dayOfMonth;

  const results: ForecastInsight[] = [];

  for (const budget of budgets) {
    const limit = Number(budget.monthly_limit);
    const spent = Number(budget.spent ?? 0);
    if (!Number.isFinite(limit) || limit <= 0) continue;
    if (!Number.isFinite(spent) || spent <= 0) continue;

    const percent = Number.isFinite(Number(budget.percent))
      ? Number(budget.percent)
      : Math.round((spent / limit) * 100);
    const dailyBurn = dayOfMonth > 0 ? spent / dayOfMonth : 0;
    const projectedTotal = dailyBurn * daysInMonth;
    const projectedOverspend = Math.max(0, projectedTotal - limit);
    const realRemaining = limit - spent;
    const displayRemaining = Math.max(realRemaining, 0);
    const budgetName = budget.category?.name ?? "Budget";

    if (budget.status === "over" || realRemaining < 0 || percent > 100) {
      results.push({
        budgetId: budget.id,
        budgetName,
        kind: "over",
        severity: "critical",
        daysToDepletion: 0,
        projectedOverspend,
        remainingBudget: realRemaining,
        dailyBurn,
        spent,
        limit,
        percent,
      });
      continue;
    }

    const isNearLimit = budget.status === "near_limit" || percent >= 85;
    if (!isNearLimit) continue;

    const daysToDepletion = dailyBurn > 0
      ? Math.floor(displayRemaining / dailyBurn)
      : Infinity;

    if (daysToDepletion < daysLeft) {
      results.push({
        budgetId: budget.id,
        budgetName,
        kind: "depleting",
        severity: daysToDepletion <= 3 ? "critical" : "warning",
        daysToDepletion: Math.max(0, daysToDepletion),
        projectedOverspend,
        remainingBudget: displayRemaining,
        dailyBurn,
        spent,
        limit,
        percent,
      });
      continue;
    }

    results.push({
      budgetId: budget.id,
      budgetName,
      kind: "near_limit",
      severity: "warning",
      daysToDepletion: Number.isFinite(daysToDepletion) ? daysToDepletion : daysLeft,
      projectedOverspend,
      remainingBudget: displayRemaining,
      dailyBurn,
      spent,
      limit,
      percent,
    });
  }

  return results.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === "over" ? -1 : b.kind === "over" ? 1 : 0;
    return a.daysToDepletion - b.daysToDepletion;
  });
}
