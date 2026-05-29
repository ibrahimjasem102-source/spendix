// ── Types ─────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskFlag {
  id:       string;
  severity: "info" | "warning" | "critical";
  msgKey:   string;   // i18n key
  value?:   number;
}

export interface RiskMetrics {
  riskLevel:           RiskLevel;
  riskScore:           number;   // 0 = no risk, 100 = extreme
  safetyScore:         number;   // 100 - riskScore (for display)
  debtToIncomeRatio:   number;   // outstanding debt ÷ monthly income
  emergencyFundMonths: number;   // balance ÷ monthly expenses
  savingsRunway:       number;   // same as emergencyFundMonths (months you can survive)
  portfolioRisk:       "low" | "medium" | "high";
  flags:               RiskFlag[];
}

export interface RiskInput {
  monthlyIncome:      number;
  monthlyExpenses:    number;
  debtPayable:        number;
  overdueDebtsCount:  number;
  balance:            number;
  savingsRate:        number;
  portfolioValue:     number;
  investedTotal:      number;
  investmentCount:    number;
  workIncome:         number;
}

// ── Pure function ──────────────────────────────────────────────

export function computeRisk(input: RiskInput): RiskMetrics {
  const {
    monthlyIncome, monthlyExpenses, debtPayable,
    overdueDebtsCount, balance, savingsRate,
    portfolioValue, investedTotal, investmentCount,
  } = input;

  const flags: RiskFlag[] = [];
  let riskScore = 0;

  // 1. Debt-to-income (max +30)
  const debtToIncomeRatio = monthlyIncome > 0 ? debtPayable / monthlyIncome : 0;
  if (debtToIncomeRatio > 3) {
    riskScore += 30;
    flags.push({ id: "high_debt", severity: "critical", msgKey: "hub.risk_high_debt", value: debtToIncomeRatio });
  } else if (debtToIncomeRatio > 1) {
    riskScore += 15;
    flags.push({ id: "med_debt", severity: "warning", msgKey: "hub.risk_med_debt", value: debtToIncomeRatio });
  }

  // 2. Overdue debts (max +20)
  if (overdueDebtsCount > 0) {
    const add = Math.min(20, overdueDebtsCount * 8);
    riskScore += add;
    flags.push({ id: "overdue", severity: "critical", msgKey: "hub.risk_overdue", value: overdueDebtsCount });
  }

  // 3. Emergency fund (max +20)
  const emergencyFundMonths = monthlyExpenses > 0 ? balance / monthlyExpenses : 0;
  if (emergencyFundMonths < 1) {
    riskScore += 20;
    flags.push({ id: "no_emergency", severity: "critical", msgKey: "hub.risk_no_emergency", value: emergencyFundMonths });
  } else if (emergencyFundMonths < 3) {
    riskScore += 10;
    flags.push({ id: "low_emergency", severity: "warning", msgKey: "hub.risk_low_emergency", value: emergencyFundMonths });
  }

  // 4. Savings rate (max +20)
  if (savingsRate < 0) {
    riskScore += 20;
    flags.push({ id: "negative_savings", severity: "critical", msgKey: "hub.risk_negative_savings", value: savingsRate });
  } else if (savingsRate < 10) {
    riskScore += 8;
    flags.push({ id: "low_savings", severity: "warning", msgKey: "hub.risk_low_savings", value: savingsRate });
  }

  // 5. Portfolio concentration (max +10)
  const portfolioRisk: RiskMetrics["portfolioRisk"] =
    investmentCount === 0               ? "low"  :
    investmentCount <= 2 || (investedTotal > 0 && portfolioValue / investedTotal < 0.9) ? "high" :
    investmentCount <= 4               ? "medium" : "low";

  if (investedTotal > 0 && investmentCount <= 1) {
    riskScore += 10;
    flags.push({ id: "concentrated", severity: "warning", msgKey: "hub.risk_concentrated" });
  }

  const clamped    = Math.min(100, riskScore);
  const riskLevel: RiskLevel =
    clamped >= 55 ? "critical" :
    clamped >= 30 ? "high"     :
    clamped >= 12 ? "medium"   : "low";

  return {
    riskLevel,
    riskScore:           clamped,
    safetyScore:         100 - clamped,
    debtToIncomeRatio:   Math.round(debtToIncomeRatio * 10) / 10,
    emergencyFundMonths: Math.round(emergencyFundMonths * 10) / 10,
    savingsRunway:       Math.round(emergencyFundMonths * 10) / 10,
    portfolioRisk,
    flags,
  };
}
