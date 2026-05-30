"use client";

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import {
  useTransactions, useBudgets, useDebts, useInvestments,
} from "@/lib/query/hooks";
import type { InsightCategory, InsightSeverity } from "@/lib/ai/aiTypes";

import { runForecastEngine }    from "./forecastEngine";
import { runAnomalyDetector }   from "./anomalyDetector";
import { runSpendingPredictor } from "./spendingPredictor";
import { runDebtOptimizer }     from "./debtOptimizer";
import { runInvestmentAnalyzer } from "./investmentAnalyzer";

// ── Local insight shape ───────────────────────────────────────────────────────

export interface LocalInsight {
  id:           string;
  source:       "forecast" | "anomaly" | "prediction" | "debt" | "investment";
  category:     InsightCategory;
  severity:     InsightSeverity;
  title:        string;
  body:         string;
  action?:      string;
  actionUrl?:   string;
  confidence:   number;
  metric?:      number;
  metricLabel?: string;
}

const SEV_ORDER: Record<InsightSeverity, number> = {
  critical: 0, warning: 1, positive: 2, info: 3,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLocalInsights(): { insights: LocalInsight[]; isLoading: boolean } {
  const { t }    = useTranslation();
  const { format } = useCurrency();

  const now   = useMemo(() => new Date(), []);
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const { data: transactions = [], isLoading: l1 } = useTransactions();
  const { data: budgetsData,        isLoading: l2 } = useBudgets(month, year);
  const { data: debtsData,          isLoading: l3 } = useDebts();
  const { data: investments = [],   isLoading: l4 } = useInvestments();

  const budgets = budgetsData?.budgets ?? [];
  const debts   = debtsData?.debts    ?? [];
  const isLoading = l1 || l2 || l3 || l4;

  const insights = useMemo((): LocalInsight[] => {
    if (isLoading) return [];

    const currentMonthStr = `${year}-${String(month).padStart(2, "0")}`;
    const monthlyIncome   = transactions
      .filter((tx) => tx.type === "income" && tx.transaction_date?.startsWith(currentMonthStr))
      .reduce((s, tx) => s + Number(tx.amount), 0);
    const monthlyExpenses = transactions
      .filter((tx) => tx.type === "expense" && tx.transaction_date?.startsWith(currentMonthStr))
      .reduce((s, tx) => s + Number(tx.amount), 0);

    const out: LocalInsight[] = [];
    let seq = 0;
    const id = () => `local-${++seq}`;

    // ── 1. Budget forecasts ───────────────────────────────────────────────
    const forecasts = runForecastEngine(budgets, now);
    for (const f of forecasts.slice(0, 3)) {
      if (f.daysToDepletion === 0) {
        out.push({
          id: id(), source: "forecast", category: "spending", severity: "critical",
          title: t("ai_local.forecast_over_title", { budget: f.budgetName }),
          body:  t("ai_local.forecast_over_body",  { budget: f.budgetName, over: format(Math.abs(f.remainingBudget)) }),
          action: t("ai_local.cta_budgets"), actionUrl: "/budgets",
          confidence: 1,
        });
      } else {
        out.push({
          id: id(), source: "forecast", category: "spending",
          severity:  f.severity as InsightSeverity,
          title: t("ai_local.forecast_burnout_title", { budget: f.budgetName, days: f.daysToDepletion }),
          body:  t("ai_local.forecast_burnout_body",  { remaining: format(f.remainingBudget), days: f.daysToDepletion }),
          action: t("ai_local.cta_budgets"), actionUrl: "/budgets",
          metric: f.daysToDepletion, metricLabel: t("ai_local.unit_days"),
          confidence: 0.92,
        });
      }
    }

    // ── 2. Anomaly detection ──────────────────────────────────────────────
    const anomalies = runAnomalyDetector(transactions, now);
    for (const a of anomalies.slice(0, 3)) {
      if (a.type === "category_spike") {
        out.push({
          id: id(), source: "anomaly", category: "spending",
          severity: a.pctIncrease >= 80 ? "warning" : "info",
          title: t("ai_local.anomaly_spike_title", { category: a.categoryName, pct: a.pctIncrease }),
          body:  t("ai_local.anomaly_spike_body",  { category: a.categoryName, current: format(a.currentMonthAmount), avg: format(a.avgPreviousMonths), months: a.monthsAnalyzed }),
          action: t("ai_local.cta_transactions"), actionUrl: "/transactions",
          metric: a.pctIncrease, metricLabel: "%",
          confidence: 0.85,
        });
      } else {
        out.push({
          id: id(), source: "anomaly", category: "spending", severity: "info",
          title: t("ai_local.anomaly_large_title", { title: a.transactionTitle ?? a.categoryName }),
          body:  t("ai_local.anomaly_large_body",  { amount: format(a.currentMonthAmount), avg: format(a.avgPreviousMonths) }),
          action: t("ai_local.cta_transactions"), actionUrl: "/transactions",
          metric: a.pctIncrease, metricLabel: "%",
          confidence: 0.8,
        });
      }
    }

    // ── 3. Spending trend ─────────────────────────────────────────────────
    const trend = runSpendingPredictor(transactions, now);
    if (trend) {
      if (trend.type === "increasing") {
        out.push({
          id: id(), source: "prediction", category: "cashflow", severity: "warning",
          title: t("ai_local.trend_rising_title", { pct: trend.trendPctPerMonth }),
          body:  t("ai_local.trend_rising_body",  { predicted: format(trend.predictedNextMonth), avg: format(trend.last3MonthsAvg) }),
          action: t("ai_local.cta_analytics"), actionUrl: "/analytics",
          metric: trend.trendPctPerMonth, metricLabel: "%/mo",
          confidence: 0.75,
        });
      } else if (trend.type === "decreasing") {
        out.push({
          id: id(), source: "prediction", category: "savings", severity: "positive",
          title: t("ai_local.trend_falling_title", { pct: trend.trendPctPerMonth }),
          body:  t("ai_local.trend_falling_body",  { pct: trend.trendPctPerMonth }),
          action: t("ai_local.cta_analytics"), actionUrl: "/analytics",
          metric: trend.trendPctPerMonth, metricLabel: "%/mo",
          confidence: 0.75,
        });
      }
    }

    // ── 4. Debt optimizer ─────────────────────────────────────────────────
    const debtResult = runDebtOptimizer(debts, monthlyExpenses, monthlyIncome, now);
    if (debtResult) {
      if (debtResult.urgentDebt) {
        const { name, remaining, daysUntilDue } = debtResult.urgentDebt;
        out.push({
          id: id(), source: "debt", category: "debt",
          severity: daysUntilDue <= 7 ? "critical" : "warning",
          title: t("ai_local.debt_due_title", { name, days: daysUntilDue }),
          body:  t("ai_local.debt_due_body",  { amount: format(remaining), days: daysUntilDue }),
          action: t("ai_local.cta_debts"), actionUrl: "/debts",
          metric: daysUntilDue, metricLabel: t("ai_local.unit_days"),
          confidence: 1,
        });
      }
      if (debtResult.acceleration) {
        const { extraPerMonth, monthsSaved } = debtResult.acceleration;
        out.push({
          id: id(), source: "debt", category: "debt", severity: "positive",
          title: t("ai_local.debt_accelerate_title", { months: monthsSaved }),
          body:  t("ai_local.debt_accelerate_body",  { extra: format(extraPerMonth), months: monthsSaved }),
          action: t("ai_local.cta_debts"), actionUrl: "/debts",
          metric: monthsSaved, metricLabel: t("ai_local.unit_months"),
          confidence: 0.7,
        });
      }
    }

    // ── 5. Investment analysis ────────────────────────────────────────────
    const inv = runInvestmentAnalyzer(investments);
    if (inv) {
      if (inv.type === "concentrated" && inv.topAssetType && inv.topAssetPct !== undefined) {
        out.push({
          id: id(), source: "investment", category: "investment", severity: "warning",
          title: t("ai_local.inv_concentrated_title", { pct: inv.topAssetPct, type: inv.topAssetType }),
          body:  t("ai_local.inv_concentrated_body",  { pct: inv.topAssetPct }),
          action: t("ai_local.cta_investments"), actionUrl: "/investments",
          metric: inv.topAssetPct, metricLabel: "%",
          confidence: 0.9,
        });
      } else if (inv.type === "strong_performer" && inv.bestPerformer) {
        out.push({
          id: id(), source: "investment", category: "investment", severity: "positive",
          title: t("ai_local.inv_performer_title", { name: inv.bestPerformer.name, pct: inv.bestPerformer.gainPct }),
          body:  t("ai_local.inv_performer_body",   { total: format(Math.abs(inv.totalGain)), pct: Math.abs(Math.round(inv.gainPct)) }),
          action: t("ai_local.cta_investments"), actionUrl: "/investments",
          metric: inv.gainPct, metricLabel: "%",
          confidence: 0.95,
        });
      } else if (inv.type === "underperformer" && inv.worstPerformer) {
        out.push({
          id: id(), source: "investment", category: "investment", severity: "warning",
          title: t("ai_local.inv_underperform_title", { name: inv.worstPerformer.name, pct: Math.abs(inv.worstPerformer.gainPct) }),
          body:  t("ai_local.inv_underperform_body",  { loss: format(Math.abs(inv.worstPerformer.gainAbs)) }),
          action: t("ai_local.cta_investments"), actionUrl: "/investments",
          metric: Math.abs(inv.worstPerformer.gainPct), metricLabel: "%",
          confidence: 0.9,
        });
      } else if (inv.type === "stale_data" && inv.staleCount) {
        out.push({
          id: id(), source: "investment", category: "investment", severity: "info",
          title: t("ai_local.inv_stale_title", { count: inv.staleCount }),
          body:  t("ai_local.inv_stale_body"),
          action: t("ai_local.cta_investments"), actionUrl: "/investments",
          confidence: 1,
        });
      }
    }

    return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, budgets, debts, investments, isLoading, month, year]);

  return { insights, isLoading };
}
