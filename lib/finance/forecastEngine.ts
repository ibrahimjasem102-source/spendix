import type { MonthlyBalance } from "./balanceEngine";

// ── Types ─────────────────────────────────────────────────────

export interface ForecastMonth {
  month:             string;
  projectedInflow:   number;
  projectedOutflow:  number;
  projectedNet:      number;
  cumulativeBalance: number;
}

export interface ForecastResult {
  months:              ForecastMonth[];
  avgMonthlyInflow:    number;
  avgMonthlyOutflow:   number;
  avgMonthlySavings:   number;
  projectedYearSaving: number;
  monthsToGoal:        (target: number, currentSavings: number) => number;
}

// ── Pure function ──────────────────────────────────────────────

export function computeForecast(
  history:        MonthlyBalance[],
  currentBalance: number,
  monthsAhead = 6,
): ForecastResult {
  // Use months that have at least some activity
  const active = history.filter((m) => m.inflow > 0 || m.outflow > 0);
  const count  = active.length || 1;

  const avgMonthlyInflow  = active.reduce((s, m) => s + m.inflow,  0) / count;
  const avgMonthlyOutflow = active.reduce((s, m) => s + m.outflow, 0) / count;
  const avgMonthlySavings = avgMonthlyInflow - avgMonthlyOutflow;

  const now    = new Date();
  const months: ForecastMonth[] = [];
  let running  = currentBalance;

  for (let i = 1; i <= monthsAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    running += avgMonthlySavings;
    months.push({
      month:             d.toLocaleString("default", { month: "short", year: "2-digit" }),
      projectedInflow:   Math.round(avgMonthlyInflow),
      projectedOutflow:  Math.round(avgMonthlyOutflow),
      projectedNet:      Math.round(avgMonthlySavings),
      cumulativeBalance: Math.max(0, Math.round(running)),
    });
  }

  return {
    months,
    avgMonthlyInflow:  Math.round(avgMonthlyInflow),
    avgMonthlyOutflow: Math.round(avgMonthlyOutflow),
    avgMonthlySavings: Math.round(avgMonthlySavings),
    projectedYearSaving: Math.round(avgMonthlySavings * 12),
    monthsToGoal: (target, currentSavings) => {
      const remaining = target - currentSavings;
      if (avgMonthlySavings <= 0 || remaining <= 0) return 0;
      return Math.ceil(remaining / avgMonthlySavings);
    },
  };
}
