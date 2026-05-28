"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import AIInsightCard, { type FinancialInsight } from "@/components/ui/AIInsightCard";
import { staggerContainer, staggerItem, spring } from "@/lib/motion";
import { useTranslation } from "@/lib/i18n";
import type { AIInsightRecord } from "@/lib/ai/aiTypes";

interface DebtData {
  net_debt_exposure: number;
  overdue_ratio: number;
  overdue_debts: number;
  active_debts: number;
  debt_recovery_rate?: number;
}

interface Props {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  dailyBurn: number;
  workIncome: number;
  debtTruth?: DebtData;
  hasTransactions: boolean;
  currency: (amount: number) => string;
}

function computeInsights(props: Props): FinancialInsight[] {
  const {
    totalBalance, monthlyIncome,
    savingsRate, dailyBurn, workIncome,
    debtTruth, hasTransactions, currency,
  } = props;

  if (!hasTransactions) return [];

  const insights: FinancialInsight[] = [];

  // ── Savings Rate ──────────────────────────────────────────────
  if (savingsRate >= 25) {
    insights.push({
      id: "savings-great",
      title: "Exceptional savings rate",
      body: `Your ${savingsRate}% savings rate puts you ahead of 85% of users. At this pace, you're building wealth fast.`,
      level: "positive",
      confidence: 0.95,
      actionLabel: "View analytics",
      actionHref: "/analytics",
    });
  } else if (savingsRate >= 10 && savingsRate < 25) {
    insights.push({
      id: "savings-good",
      title: "Good savings momentum",
      body: `${savingsRate}% savings rate is solid. Reducing variable expenses by 5% could push you into the top tier.`,
      level: "info",
      confidence: 0.88,
      actionLabel: "See spending",
      actionHref: "/transactions?filter=monthly_expenses",
    });
  } else if (savingsRate < 10 && monthlyIncome > 0) {
    insights.push({
      id: "savings-low",
      title: "Savings rate needs attention",
      body: `At ${savingsRate}%, your savings are lower than recommended. Try automating a fixed monthly transfer.`,
      level: "warning",
      confidence: 0.92,
      actionLabel: "Review expenses",
      actionHref: "/transactions?filter=monthly_expenses",
    });
  }

  // ── Daily Burn ────────────────────────────────────────────────
  const dailyBudget = monthlyIncome > 0 ? monthlyIncome / 30 : 0;
  if (dailyBudget > 0 && dailyBurn > dailyBudget * 0.95) {
    insights.push({
      id: "burn-high",
      title: "Daily spending near limit",
      body: `You're burning ${currency(dailyBurn)}/day against a ${currency(dailyBudget.toFixed(0) as unknown as number)}/day income budget. A few days of overspend and the balance tips.`,
      level: dailyBurn > dailyBudget ? "critical" : "warning",
      confidence: 0.9,
      actionLabel: "Open transactions",
      actionHref: "/transactions",
    });
  }

  // ── Debt Health ───────────────────────────────────────────────
  if (debtTruth) {
    if (debtTruth.overdue_debts > 0) {
      insights.push({
        id: "debt-overdue",
        title: `${debtTruth.overdue_debts} overdue debt${debtTruth.overdue_debts > 1 ? "s" : ""} detected`,
        body: "Overdue debts accumulate penalties and damage relationships. Prioritise the smallest ones first to build momentum.",
        level: "critical",
        confidence: 1.0,
        actionLabel: "Review debts",
        actionHref: "/debts",
      });
    } else if (debtTruth.net_debt_exposure > monthlyIncome * 2 && monthlyIncome > 0) {
      insights.push({
        id: "debt-exposure",
        title: "High debt-to-income exposure",
        body: `Your net debt exposure is ${currency(debtTruth.net_debt_exposure)}, which is ${Math.round(debtTruth.net_debt_exposure / monthlyIncome)}× your monthly income. Consider accelerated repayment.`,
        level: "warning",
        confidence: 0.85,
        actionLabel: "Manage debts",
        actionHref: "/debts",
      });
    } else if (debtTruth.active_debts > 0 && debtTruth.overdue_ratio === 0) {
      insights.push({
        id: "debt-healthy",
        title: "Debt health looks good",
        body: `${debtTruth.active_debts} active debt${debtTruth.active_debts > 1 ? "s" : ""} with no overdue payments. Keep maintaining the schedule.`,
        level: "positive",
        confidence: 0.9,
        actionLabel: "View debts",
        actionHref: "/debts",
      });
    }
  }

  // ── Work Income ───────────────────────────────────────────────
  if (workIncome > 0 && monthlyIncome > 0) {
    const pct = Math.round((workIncome / monthlyIncome) * 100);
    insights.push({
      id: "work-income",
      title: `Work contributes ${pct}% of income`,
      body: `${currency(workIncome)} from work sessions is ${pct >= 30 ? "a significant" : "a growing"} part of your cash flow. Track remaining sessions for consistent payouts.`,
      level: pct >= 30 ? "positive" : "info",
      confidence: 0.87,
      actionLabel: "Work dashboard",
      actionHref: "/work",
    });
  }

  // ── Balance ───────────────────────────────────────────────────
  if (totalBalance < 0) {
    insights.push({
      id: "balance-negative",
      title: "Negative balance alert",
      body: `Your balance is ${currency(Math.abs(totalBalance))} in the red. Prioritise reducing discretionary spending immediately.`,
      level: "critical",
      confidence: 1.0,
      actionLabel: "View spending",
      actionHref: "/transactions",
    });
  }

  // Return max 3 insights, prioritised by level
  const order: Record<string, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
  return insights.sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9)).slice(0, 3);
}

export default function AICopilot(props: Props) {
  const { t, locale } = useTranslation();

  const localInsights = useMemo(() => computeInsights(props), [
    props.totalBalance, props.monthlyIncome,
    props.savingsRate, props.dailyBurn, props.workIncome,
    props.debtTruth, props.hasTransactions,
  ]);

  // Attempt to load DB insights — show alongside local ones if available
  const [dbInsights, setDbInsights] = useState<AIInsightRecord[]>([]);

  useEffect(() => {
    if (!props.hasTransactions) return;
    fetch("/api/ai/insights")
      .then((r) => r.ok ? r.json() : { insights: [] })
      .then((d) => { if (d.insights?.length) setDbInsights(d.insights.slice(0, 3)); })
      .catch(() => {/* silent */});
  }, [props.hasTransactions]);

  // Map DB insights to FinancialInsight shape for the card component
  const mappedDb: FinancialInsight[] = dbInsights.map((ins) => ({
    id: ins.id,
    title: ins.title,
    body: ins.body,
    level: ins.severity === "critical" ? "critical"
      : ins.severity === "warning" ? "warning"
      : ins.severity === "positive" ? "positive"
      : "info",
    confidence: ins.confidence,
    actionLabel: ins.action ?? undefined,
    actionHref: ins.action_url ?? undefined,
  }));

  const displayInsights = mappedDb.length > 0 ? mappedDb : localInsights;
  const isFromDb = mappedDb.length > 0;

  if (!props.hasTransactions) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-1.5 rounded-xl"
            style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(124,58,237,0.2))" }}>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <h3 className="text-sm font-bold t1">AI Financial Copilot</h3>
        </div>
        <div className="text-center py-4">
          <Sparkles className="w-8 h-8 t3 opacity-25 mx-auto mb-2" />
          <p className="text-xs t3">{t("ai_insights.no_data_body")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.1 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl"
            style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(124,58,237,0.2))" }}>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold t1">AI Financial Copilot</h3>
            <p className="text-[10px] t3">
              {displayInsights.length} insight{displayInsights.length !== 1 ? "s" : ""}
              {isFromDb ? " · " + t("ai_insights.from_db") : ""}
            </p>
          </div>
        </div>
        <Link href="/ai-insights"
          className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
          {t("common.view_all")} <ArrowRight className="w-3 h-3" />
        </Link>
      </motion.div>

      {/* Insights */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-2.5"
      >
        {displayInsights.map((insight, i) => (
          <motion.div key={insight.id} variants={staggerItem} transition={{ ...spring }}>
            <AIInsightCard insight={insight} delay={i * 0.06} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
