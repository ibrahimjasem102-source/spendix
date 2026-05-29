"use client";

import { useMemo } from "react";
import { useFinancialEngine }                   from "./engine";
import { computeBalanceBreakdown, computeMonthlyBalances } from "./balanceEngine";
import { computeForecast }                      from "./forecastEngine";
import { computeAchievements, getTotalPoints, getMaxPoints, getLevel } from "./achievementEngine";
import { computeRisk }                          from "./riskEngine";
import type { BalanceBreakdown, MonthlyBalance } from "./balanceEngine";
import type { ForecastResult }                  from "./forecastEngine";
import type { Achievement, LevelInfo }          from "./achievementEngine";
import type { RiskMetrics }                     from "./riskEngine";

// ── Output type ───────────────────────────────────────────────

export interface FinancialHubSnapshot {
  // Net worth
  netWorth:       number;
  cashBalance:    number;
  portfolioValue: number;
  totalDebt:      number;

  // Engines
  breakdown:      BalanceBreakdown;
  monthlyHistory: MonthlyBalance[];
  forecast:       ForecastResult;
  risk:           RiskMetrics;

  // Achievements
  achievements:   Achievement[];
  totalPoints:    number;
  maxPoints:      number;
  level:          LevelInfo;

  isLoading: boolean;
  isError:   boolean;
}

// ── Hook ──────────────────────────────────────────────────────

export function useFinancialHub(): FinancialHubSnapshot {
  const engine = useFinancialEngine();

  const investmentCount = useMemo(
    () => engine.ledgerEntries.filter((e) => e.type === "investment").length,
    [engine.ledgerEntries],
  );

  const transactionCount = useMemo(
    () => engine.ledgerEntries.filter((e) => e.type === "transaction").length,
    [engine.ledgerEntries],
  );

  const breakdown = useMemo(
    () => computeBalanceBreakdown(engine.ledgerEntries, engine.portfolioValue, engine.debtPayable),
    [engine.ledgerEntries, engine.portfolioValue, engine.debtPayable],
  );

  const monthlyHistory = useMemo(
    () => computeMonthlyBalances(engine.ledgerEntries, 6),
    [engine.ledgerEntries],
  );

  const forecast = useMemo(
    () => computeForecast(monthlyHistory, engine.balance),
    [monthlyHistory, engine.balance],
  );

  const risk = useMemo(
    () =>
      computeRisk({
        monthlyIncome:     engine.monthlyIncome,
        monthlyExpenses:   engine.monthlyExpenses,
        debtPayable:       engine.debtPayable,
        overdueDebtsCount: engine.overdueDebtsCount,
        balance:           engine.balance,
        savingsRate:       engine.savingsRate,
        portfolioValue:    engine.portfolioValue,
        investedTotal:     engine.investedTotal,
        investmentCount,
        workIncome:        engine.workIncome,
      }),
    [engine, investmentCount],
  );

  const achievements = useMemo(
    () =>
      computeAchievements({
        transactionCount,
        savingsRate:        engine.savingsRate,
        monthlySavingsRate: engine.monthlySavingsRate,
        hasInvestments:     engine.investedTotal > 0,
        workIncome:         engine.workIncome,
        debtPayable:        engine.debtPayable,
        monthlyIncome:      engine.monthlyIncome,
        monthlyExpenses:    engine.monthlyExpenses,
        overdueDebtsCount:  engine.overdueDebtsCount,
        balance:            engine.balance,
        debtRecoveryRate:   engine.debtRecoveryRate,
        portfolioGain:      engine.portfolioGain,
      }),
    [engine, transactionCount],
  );

  const totalPoints = getTotalPoints(achievements);
  const maxPoints   = getMaxPoints(achievements);
  const level       = getLevel(totalPoints);
  const netWorth    = engine.balance + engine.portfolioValue - engine.debtPayable;

  return {
    netWorth,
    cashBalance:    engine.balance,
    portfolioValue: engine.portfolioValue,
    totalDebt:      engine.debtPayable,
    breakdown,
    monthlyHistory,
    forecast,
    risk,
    achievements,
    totalPoints,
    maxPoints,
    level,
    isLoading: engine.isLoading,
    isError:   engine.isError,
  };
}
