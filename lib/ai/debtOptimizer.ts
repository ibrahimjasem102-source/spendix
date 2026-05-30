import type { Debt } from "@/types";

export interface DebtOptimizationResult {
  totalRemaining:  number;
  /** Most urgent upcoming due date */
  urgentDebt?: {
    name:         string;
    remaining:    number;
    daysUntilDue: number;
  };
  /** Payoff acceleration if extra monthly surplus applied */
  acceleration?: {
    extraPerMonth: number;
    monthsSaved:   number;
    currentMonths: number;
    newMonths:     number;
  };
}

/**
 * Analyses active payable debts and returns:
 *  - The most urgent upcoming due-date warning (within 30 days)
 *  - A payoff-acceleration estimate based on available monthly surplus
 */
export function runDebtOptimizer(
  debts:           Debt[],
  monthlyExpenses: number,
  monthlyIncome:   number,
  now:             Date = new Date(),
): DebtOptimizationResult | null {
  const active = debts.filter(
    (d) => d.debt_type === "payable" && d.status !== "paid",
  );
  if (active.length === 0) return null;

  const totalRemaining = active.reduce(
    (s, d) => s + Math.max(0, d.total_amount - d.paid_amount),
    0,
  );

  // Urgent debt: due within 30 days
  const nowMs     = now.getTime();
  const MS_PER_DAY = 86_400_000;
  const urgent = active
    .filter((d) => d.due_date)
    .map((d) => ({
      name:         d.person_or_entity,
      remaining:    Math.max(0, d.total_amount - d.paid_amount),
      daysUntilDue: Math.ceil((new Date(d.due_date!).getTime() - nowMs) / MS_PER_DAY),
    }))
    .filter((d) => d.daysUntilDue >= 0 && d.daysUntilDue <= 30)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)[0];

  // Estimate current average monthly payment
  let totalMonthlyPay = 0;
  let payingCount     = 0;
  for (const d of active) {
    if (d.paid_amount > 0) {
      const monthsElapsed = Math.max(
        1,
        (nowMs - new Date(d.created_at).getTime()) / (30.44 * MS_PER_DAY),
      );
      totalMonthlyPay += d.paid_amount / monthsElapsed;
      payingCount++;
    }
  }

  const avgMonthlyPay = payingCount > 0 ? totalMonthlyPay : 0;
  const currentMonths = avgMonthlyPay > 0 ? Math.ceil(totalRemaining / avgMonthlyPay) : null;

  // Payoff acceleration: 20 % of monthly surplus
  const surplus     = Math.max(0, monthlyIncome - monthlyExpenses);
  const extraPerMonth = Math.round(surplus * 0.2);
  let acceleration: DebtOptimizationResult["acceleration"];

  if (
    extraPerMonth >= 50 &&
    avgMonthlyPay > 0 &&
    currentMonths !== null &&
    currentMonths >= 2
  ) {
    const newMonths  = Math.ceil(totalRemaining / (avgMonthlyPay + extraPerMonth));
    const monthsSaved = currentMonths - newMonths;
    if (monthsSaved >= 1) {
      acceleration = { extraPerMonth, monthsSaved, currentMonths, newMonths };
    }
  }

  return { totalRemaining, urgentDebt: urgent, acceleration };
}
