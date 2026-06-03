"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area, AreaChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";
import {
  Activity, Target, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Zap,
  BarChart3, PieChart as PieChartIcon, RefreshCw,
  ArrowUp, ArrowDown,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/lib/currency";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n";
import { useBudgets, useGoals } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { useGuest } from "@/contexts/GuestContext";
import { useFinancialEngine } from "@/lib/finance/engine";
import GoalMilestonesProgress from "@/components/goals/GoalMilestonesProgress";
import type { Debt, GoalMilestone, Transaction } from "@/types";

// ── Local types ────────────────────────────────────────────────────

type TFunc = (key: string, params?: Record<string, string | number>) => string;

interface CategoryPoint { name: string; value: number; color: string }
interface MonthPoint    { month: string; income: number; expenses: number; savings: number }

interface AnalyticsCharts {
  spendingByCategory: CategoryPoint[];
  incomeVsExpenses:   MonthPoint[];
  monthlyCashflow:    { day: number; date: string; amount: number }[];
}

interface DebtAnalytics {
  total_payable:            number;
  total_receivable:         number;
  total_paid:               number;
  total_remaining:          number;
  total_payable_remaining?: number;
  total_receivable_remaining?: number;
  active_debts:             number;
  paid_debts:               number;
  overdue_debts:            number;
}

interface InvestmentAnalytics {
  total_invested:         number;
  current_value:          number;
  profit_loss:            number;
  profit_loss_percentage: number;
  investments_count:      number;
}

interface BudgetItem {
  id:            string;
  category?:     { id: string; name: string; color?: string };
  monthly_limit: number;
  spent?:        number;
  percent?:      number;
  status?:       "safe" | "near_limit" | "over";
}

interface GoalItem {
  id:                   string;
  title:                string;
  category:             string;
  target_amount:        number;
  saved_amount:         number;
  computed_saved?:      number;
  monthly_contribution: number;
  progress?:            number;
  status?:              "on_track" | "due_soon" | "overdue" | "completed";
  remaining?:           number;
  color?:               string | null;
  milestones?:          GoalMilestone[];
}

// ── Empty fallbacks ────────────────────────────────────────────────

const EMPTY_CHARTS: AnalyticsCharts = {
  spendingByCategory: [],
  incomeVsExpenses:   [],
  monthlyCashflow:    [],
};
const EMPTY_DEBTS: DebtAnalytics = {
  total_payable: 0, total_receivable: 0, total_paid: 0,
  total_remaining: 0, active_debts: 0, paid_debts: 0, overdue_debts: 0,
};
const EMPTY_INV: InvestmentAnalytics = {
  total_invested: 0, current_value: 0, profit_loss: 0,
  profit_loss_percentage: 0, investments_count: 0,
};

type Tab = "overview" | "spending" | "wealth" | "goals" | "budget";
type ChartColors = { grid: string; tick: string; bgTip: string; borTip: string; txtTip: string };

const CATEGORY_COLORS = ["#06B6D4", "#10B981", "#F43F5E", "#8B5CF6", "#F59E0B", "#EC4899", "#3B82F6", "#22C55E"];

function numberValue(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildSpendingByCategory(transactions: Transaction[]): CategoryPoint[] {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const totals = new Map<string, CategoryPoint>();

  transactions
    .filter((tx) => tx.type === "expense" && tx.transaction_date?.startsWith(currentMonth))
    .forEach((tx) => {
      const name = tx.category?.name || "Uncategorized";
      const existing = totals.get(name);
      totals.set(name, {
        name,
        value: (existing?.value ?? 0) + numberValue(tx.amount),
        color: tx.category?.color || existing?.color || CATEGORY_COLORS[totals.size % CATEGORY_COLORS.length],
      });
    });

  return [...totals.values()].sort((a, b) => b.value - a.value);
}

function buildIncomeVsExpenses(transactions: Transaction[], months = 6): MonthPoint[] {
  const now = new Date();
  const points = Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    return { month: monthKey(date), income: 0, expenses: 0, savings: 0 };
  });
  const byMonth = new Map(points.map((point) => [point.month, point]));

  transactions.forEach((tx) => {
    if (!tx.transaction_date) return;
    const date = new Date(`${tx.transaction_date}T00:00:00`);
    const point = byMonth.get(monthKey(date));
    if (!point) return;
    if (tx.type === "income") point.income += numberValue(tx.amount);
    if (tx.type === "expense") point.expenses += numberValue(tx.amount);
    point.savings = point.income - point.expenses;
  });

  return points;
}

function buildMonthlyCashflow(transactions: Transaction[], days = 30): AnalyticsCharts["monthlyCashflow"] {
  const now = new Date();
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - 1 - index));
    return { day: date.getDate(), date: dateOnly(date), amount: 0 };
  });
  const byDate = new Map(points.map((point) => [point.date, point]));

  transactions
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      const point = byDate.get(tx.transaction_date);
      if (point) point.amount += numberValue(tx.amount);
    });

  return points;
}

function buildDebtAnalytics(debts: Debt[]): DebtAnalytics {
  return debts.reduce<DebtAnalytics>((stats, debt) => {
    const total = numberValue(debt.total_amount);
    const paid = numberValue(debt.paid_amount);
    const remaining = Math.max(total - paid, 0);
    const isPaid = debt.status === "paid" || remaining <= 0;
    const isOverdue = !isPaid && !!debt.due_date && debt.due_date < dateOnly(new Date());

    if (debt.debt_type === "payable") {
      stats.total_payable += total;
      stats.total_payable_remaining = (stats.total_payable_remaining ?? 0) + remaining;
    } else {
      stats.total_receivable += total;
      stats.total_receivable_remaining = (stats.total_receivable_remaining ?? 0) + remaining;
    }

    stats.total_paid += paid;
    stats.total_remaining += remaining;
    if (isPaid) stats.paid_debts += 1;
    else stats.active_debts += 1;
    if (isOverdue || debt.status === "overdue") stats.overdue_debts += 1;

    return stats;
  }, { ...EMPTY_DEBTS, total_payable_remaining: 0, total_receivable_remaining: 0 });
}

// ── Health Ring (SVG) ──────────────────────────────────────────────

function HealthRing({ score, color }: { score: number; color: string }) {
  const r = 58;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={148} height={148} viewBox="0 0 148 148" aria-hidden>
      <circle cx={74} cy={74} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={14} />
      <circle
        cx={74} cy={74} r={r}
        fill="none" stroke={color} strokeWidth={14}
        strokeLinecap="round"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={circ - (score / 100) * circ}
        transform="rotate(-90 74 74)"
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1), stroke 0.4s ease" }}
      />
    </svg>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex justify-between items-start gap-3">
        <div className="space-y-2">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-7 w-36 rounded-xl" />
        </div>
        <div className="skeleton h-8 w-20 rounded-xl" />
      </div>
      <div className="skeleton h-11 rounded-2xl" />
      <div className="skeleton h-56 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-xs t2">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${tone ?? "t1"}`}>{value}</span>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-44 flex items-center justify-center opacity-30">
      <BarChart3 className="w-8 h-8 t3" />
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────

function OverviewTab({
  score, scoreColor, scoreLabel, factors,
  monthlyIncome, monthlyExpenses, savingsRate, format, t,
}: {
  score: number; scoreColor: string; scoreLabel: string;
  factors: { label: string; pts: number; max: number; color: string }[];
  monthlyIncome: number; monthlyExpenses: number; savingsRate: number;
  format: (n: number) => string; t: TFunc;
}) {
  const net = monthlyIncome - monthlyExpenses;
  return (
    <div className="space-y-4">
      {/* Health Score */}
      <div className="card p-5">
        <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em] mb-4">
          {t("analytics.health_score")}
        </p>
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <HealthRing score={score} color={scoreColor} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black t1 number-display leading-none">{score}</span>
              <span className="text-[9px] t3 font-medium">/100</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold mb-3 leading-tight" style={{ color: scoreColor }}>
              {scoreLabel}
            </p>
            <div className="space-y-2.5">
              {factors.map((f) => (
                <div key={f.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] t2">{f.label}</span>
                    <span className="text-[10px] font-bold t1">{f.pts}/{f.max}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.07)" }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        backgroundColor: f.color,
                        width: `${(f.pts / f.max) * 100}%`,
                        transition: "width 1.2s ease-out",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Snapshot */}
      <div className="card p-5">
        <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em] mb-4">
          {t("analytics.monthly_snapshot")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: t("transactions.income"), value: format(monthlyIncome), color: "text-emerald-400", Icon: ArrowUp, bg: "bg-emerald-400/10" },
            { label: t("transactions.expense"), value: format(monthlyExpenses), color: "text-rose-400", Icon: ArrowDown, bg: "bg-rose-400/10" },
            {
              label: t("dashboard.savings_rate"),
              value: `${savingsRate}%`,
              color: savingsRate >= 20 ? "text-emerald-400" : savingsRate >= 0 ? "text-cyan-400" : "text-rose-400",
              Icon: Target,
              bg: "bg-cyan-400/10",
            },
            {
              label: t("analytics.net_change"),
              value: `${net >= 0 ? "+" : ""}${format(net)}`,
              color: net >= 0 ? "text-emerald-400" : "text-rose-400",
              Icon: Activity,
              bg: net >= 0 ? "bg-emerald-400/10" : "bg-rose-400/10",
            },
          ].map(({ label, value, color, Icon, bg }) => (
            <div key={label} className="rounded-2xl p-3.5" style={{ backgroundColor: "hsl(var(--bg-input))" }}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center mb-2.5 ${bg}`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
              <p className="text-[10px] t3 mb-1 leading-tight">{label}</p>
              <p className={`text-base font-bold number-display ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Spending Tab ───────────────────────────────────────────────────

function SpendingTab({
  charts, format, t, cc, formatMonth,
}: {
  charts: AnalyticsCharts;
  format: (n: number) => string; t: TFunc;
  cc: ChartColors; formatMonth: (v: string) => string;
}) {
  const [activePie, setActivePie] = useState<string | null>(null);
  const total = charts.spendingByCategory.reduce((s, c) => s + c.value, 0);

  return (
    <div className="space-y-4">
      {/* Cash Flow 6-month area chart */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold t1">{t("analytics.cash_flow")}</p>
            <p className="text-xs t3 mt-0.5">{t("dashboard.last_6_months")}</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] t2 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />{t("transactions.income")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />{t("transactions.expense")}
            </span>
          </div>
        </div>
        {charts.incomeVsExpenses.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={charts.incomeVsExpenses} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="anInc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="anExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: cc.tick }} tickLine={false} axisLine={false} tickFormatter={formatMonth} />
              <YAxis tick={{ fontSize: 10, fill: cc.tick }} tickLine={false} axisLine={false} tickFormatter={(v) => format(Number(v))} width={54} />
              <Tooltip
                formatter={(v: number) => format(v)}
                labelFormatter={(l) => formatMonth(String(l))}
                contentStyle={{ background: cc.bgTip, border: `1px solid ${cc.borTip}`, borderRadius: 12 }}
                labelStyle={{ color: cc.txtTip, fontSize: 11 }}
                itemStyle={{ color: cc.txtTip }}
              />
              <Area type="monotone" dataKey="income" name={t("transactions.income")} stroke="#10B981" strokeWidth={2} fill="url(#anInc)" dot={false} activeDot={{ r: 4, fill: "#10B981" }} />
              <Area type="monotone" dataKey="expenses" name={t("transactions.expense")} stroke="#F43F5E" strokeWidth={2} fill="url(#anExp)" dot={false} activeDot={{ r: 4, fill: "#F43F5E" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Savings rate history */}
      {charts.incomeVsExpenses.length >= 2 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold t1">{t("analytics.savings_rate_history")}</p>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-cyan-400/10 text-cyan-400">
              {t("analytics.monthly")}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart
              data={[...charts.incomeVsExpenses]
                .sort((a, b) => a.month.localeCompare(b.month))
                .map((m) => ({
                  month: m.month,
                  rate:  m.income > 0 ? Math.round(((m.income - m.expenses) / m.income) * 100) : 0,
                }))}
              margin={{ top: 0, right: 0, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="anSav" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: cc.tick }} tickLine={false} axisLine={false} tickFormatter={formatMonth} />
              <YAxis tick={{ fontSize: 10, fill: cc.tick }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={36} />
              <ReferenceLine y={0} stroke={cc.grid} strokeDasharray="4 2" />
              <Tooltip
                formatter={(v: number) => [`${v}%`, t("dashboard.savings_rate")]}
                labelFormatter={(l) => formatMonth(String(l))}
                contentStyle={{ background: cc.bgTip, border: `1px solid ${cc.borTip}`, borderRadius: 12 }}
                labelStyle={{ color: cc.txtTip, fontSize: 11 }}
              />
              <Area type="monotone" dataKey="rate" stroke="#06B6D4" strokeWidth={2} fill="url(#anSav)" dot={false} activeDot={{ r: 4, fill: "#06B6D4" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Spending distribution donut */}
      <div className="card p-5">
        <p className="text-sm font-semibold t1 mb-4">{t("analytics.spending_distribution")}</p>
        {charts.spendingByCategory.length === 0 ? <EmptyChart /> : (
          <div className="flex flex-col sm:flex-row gap-5 items-center">
            <div className="shrink-0">
              <ResponsiveContainer width={148} height={148}>
                <PieChart>
                  <Pie
                    data={charts.spendingByCategory}
                    cx="50%" cy="50%"
                    innerRadius={44} outerRadius={68}
                    dataKey="value" strokeWidth={0}
                    onClick={(d: CategoryPoint) => setActivePie(activePie === d.name ? null : d.name)}
                  >
                    {charts.spendingByCategory.map((entry) => (
                      <Cell
                        key={entry.name} fill={entry.color}
                        opacity={activePie && activePie !== entry.name ? 0.3 : 1}
                        style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, n: string) => [format(v), n]}
                    contentStyle={{ background: cc.bgTip, border: `1px solid ${cc.borTip}`, borderRadius: 12 }}
                    itemStyle={{ color: cc.txtTip }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full min-w-0 space-y-2">
              {charts.spendingByCategory.map((cat) => {
                const pct = total > 0 ? Math.round((cat.value / total) * 100) : 0;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setActivePie(activePie === cat.name ? null : cat.name)}
                    className="w-full text-start transition-opacity"
                    style={{ opacity: activePie && activePie !== cat.name ? 0.35 : 1 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs t1 font-medium">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="truncate max-w-[120px]">{cat.name}</span>
                      </span>
                      <span className="text-xs font-bold t1 shrink-0">{pct}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.07)" }}>
                      <div
                        className="h-1 rounded-full"
                        style={{ backgroundColor: cat.color, width: `${pct}%`, transition: "width 0.9s ease-out" }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Wealth Tab ─────────────────────────────────────────────────────

function WealthTab({
  totalBalance, investments, debts, charts, cc, formatMonth, format, t,
}: {
  totalBalance: number; investments: InvestmentAnalytics; debts: DebtAnalytics;
  charts: AnalyticsCharts; cc: ChartColors; formatMonth: (v: string) => string;
  format: (n: number) => string; t: TFunc;
}) {
  const payable  = debts.total_payable_remaining ?? debts.total_payable;
  const receivable = debts.total_receivable_remaining ?? debts.total_receivable;
  const netWorth = totalBalance + investments.current_value + receivable - payable;
  const pnlPos   = investments.profit_loss >= 0;

  const netWorthData = useMemo(() => {
    const sorted = [...charts.incomeVsExpenses].sort((a, b) => a.month.localeCompare(b.month));
    if (sorted.length < 2) return [];
    let running = netWorth;
    const result: { month: string; value: number }[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      result.unshift({ month: sorted[i].month, value: Math.round(running) });
      running -= (sorted[i].savings ?? 0);
    }
    return result;
  }, [charts.incomeVsExpenses, netWorth]);

  return (
    <div className="space-y-4">
      {/* Net Worth summary */}
      <div className="card p-5">
        <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em] mb-3">
          {t("analytics.net_worth")}
        </p>
        <p className={`text-3xl font-black number-display mb-4 leading-none ${netWorth >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {format(netWorth)}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: t("analytics.cash_position"), value: format(totalBalance), color: "text-cyan-400" },
            { label: t("analytics.portfolio"),     value: format(investments.current_value), color: "text-purple-400" },
            { label: t("debts.receivable"),         value: format(receivable), color: "text-emerald-400" },
            { label: t("debts.payable"),            value: format(payable),   color: "text-rose-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: "hsl(var(--bg-input))" }}>
              <p className="text-[9px] t3 mb-1 leading-tight">{label}</p>
              <p className={`text-xs font-bold number-display ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Net Worth trend */}
      {netWorthData.length >= 2 && (
        <div className="card p-5">
          <p className="text-sm font-semibold t1 mb-4">{t("analytics.net_worth")}</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={netWorthData} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="anNW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: cc.tick }} tickLine={false} axisLine={false} tickFormatter={formatMonth} />
              <YAxis tick={{ fontSize: 10, fill: cc.tick }} tickLine={false} axisLine={false} tickFormatter={(v) => format(Number(v))} width={54} />
              <Tooltip
                formatter={(v: number) => format(v)}
                labelFormatter={(l) => formatMonth(String(l))}
                contentStyle={{ background: cc.bgTip, border: `1px solid ${cc.borTip}`, borderRadius: 12 }}
                labelStyle={{ color: cc.txtTip, fontSize: 11 }}
                itemStyle={{ color: cc.txtTip }}
              />
              <Area type="monotone" dataKey="value" name={t("analytics.net_worth")} stroke="#06B6D4" strokeWidth={2} fill="url(#anNW)" dot={false} activeDot={{ r: 4, fill: "#06B6D4" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Investment analytics */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-5 rounded-full bg-purple-400" />
          <p className="text-sm font-semibold t1">{t("analytics.investment_portfolio")}</p>
        </div>
        {investments.investments_count === 0 ? (
          <p className="text-xs t3 text-center py-4">{t("analytics.no_investments")}</p>
        ) : (
          <div className="space-y-2">
            <Row label={t("analytics.invested")}     value={format(investments.total_invested)} />
            <Row label={t("analytics.current_value")} value={format(investments.current_value)} tone="text-purple-400" />
            <Row
              label={t("analytics.gain_loss")}
              value={`${pnlPos ? "+" : ""}${format(investments.profit_loss)} (${pnlPos ? "+" : ""}${investments.profit_loss_percentage.toFixed(1)}%)`}
              tone={pnlPos ? "text-emerald-400" : "text-rose-400"}
            />
          </div>
        )}
      </div>

      {/* Debt analysis */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-5 rounded-full bg-rose-400" />
          <p className="text-sm font-semibold t1">{t("analytics.debt_analysis")}</p>
        </div>
        {debts.active_debts === 0 ? (
          <div className="flex flex-col items-center gap-2 py-5">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-400">{t("analytics.debt_free")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Row label={t("debts.payable")}    value={format(payable)}    tone="text-rose-400" />
            <Row label={t("debts.receivable")} value={format(receivable)} tone="text-emerald-400" />
            <Row label={t("debts.total_paid")} value={format(debts.total_paid)}       tone="text-cyan-400" />
            {debts.overdue_debts > 0 && (
              <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl bg-rose-400/10 border border-rose-400/20">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <p className="text-xs text-rose-400 font-medium">
                  {debts.overdue_debts} {t("debts.status.overdue").toLowerCase()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Goals Tab ──────────────────────────────────────────────────────

function GoalsTab({ goals, format, t, isRtl }: {
  goals: GoalItem[]; format: (n: number) => string; t: TFunc; isRtl: boolean;
}) {
  if (goals.length === 0) {
    return (
      <div className="card p-8 flex flex-col items-center gap-3 text-center">
        <Target className="w-10 h-10 t3 opacity-30" />
        <p className="text-sm font-semibold t1">{t("analytics.no_goals_yet")}</p>
        <p className="text-xs t3 max-w-xs">{t("goals.empty_body")}</p>
      </div>
    );
  }

  const avgProgress = goals.length > 0
    ? Math.round(goals.reduce((s, g) => s + (g.progress ?? 0), 0) / goals.length)
    : 0;
  const circ = 2 * Math.PI * 26;

  return (
    <div className="space-y-4">
      {/* Overall progress summary */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] t3 uppercase tracking-wide font-bold">{t("goals.overall_progress")}</p>
            <p className="text-2xl font-black t1 number-display mt-0.5">{avgProgress}%</p>
            <p className="text-xs t3 mt-0.5">{goals.length} {t("analytics.tab_goals").toLowerCase()}</p>
          </div>
          <div className="relative w-16 h-16">
            <svg width={64} height={64} viewBox="0 0 64 64">
              <circle cx={32} cy={32} r={26} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
              <circle
                cx={32} cy={32} r={26} fill="none" stroke="#06B6D4" strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray={`${circ} ${circ}`}
                strokeDashoffset={circ * (1 - avgProgress / 100)}
                transform="rotate(-90 32 32)"
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Individual goal cards */}
      <div className="space-y-3">
        {goals.map((goal) => {
          const pct = goal.progress ?? 0;
          const statusColor =
            goal.status === "completed" ? "#10B981" :
            goal.status === "overdue"   ? "#F43F5E" :
            goal.status === "due_soon"  ? "#F59E0B" : "#06B6D4";
          const monthsLeft =
            goal.monthly_contribution > 0 && (goal.remaining ?? 0) > 0
              ? Math.ceil((goal.remaining ?? 0) / goal.monthly_contribution)
              : null;

          return (
            <div key={goal.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold t1 truncate">{goal.title}</p>
                  <p className="text-xs t3 mt-0.5">{t(`goals.categories.${goal.category}`)}</p>
                </div>
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
                  style={{ backgroundColor: `${statusColor}1A`, color: statusColor }}
                >
                  {pct}%
                </span>
              </div>
              <GoalMilestonesProgress
                milestones={goal.milestones}
                targetAmount={goal.target_amount}
                currentAmount={goal.computed_saved ?? goal.saved_amount}
                progress={pct}
                color={goal.color ?? statusColor}
                isRtl={isRtl}
                format={format}
                variant="regular"
                showAmounts
                className="mb-2"
              />
              <div className="flex items-center justify-end">
                {monthsLeft !== null && (
                  <span className="text-[10px] t3">{monthsLeft} {t("analytics.months_away")}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Budget Tab ─────────────────────────────────────────────────────

function BudgetTab({
  budgets, budgetSummary, format, t,
}: {
  budgets: BudgetItem[];
  budgetSummary: { totalBudget: number; totalSpent: number; overBudgetCount: number; nearLimitCount: number };
  format: (n: number) => string; t: TFunc;
}) {
  const overList  = budgets.filter((b) => b.status === "over")
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  const nearList  = budgets.filter((b) => b.status === "near_limit")
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  const safeList  = budgets.filter((b) => b.status === "safe" || !b.status)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  const sorted    = [...overList, ...nearList, ...safeList];

  const remaining = budgetSummary.totalBudget - budgetSummary.totalSpent;
  const overallPct = budgetSummary.totalBudget > 0
    ? Math.min(100, Math.round((budgetSummary.totalSpent / budgetSummary.totalBudget) * 100))
    : 0;
  const overallColor = budgetSummary.overBudgetCount > 0 ? "#F43F5E"
    : budgetSummary.nearLimitCount > 0 ? "#F59E0B" : "#10B981";

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-400/10 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold t1">{t("analytics.budget_performance")}</p>
            <p className="text-xs t3 mt-0.5">{t("analytics.tab_budget")}</p>
          </div>
          {budgetSummary.overBudgetCount > 0 && (
            <span className="shrink-0 text-[10px] font-bold text-rose-400 bg-rose-400/10 px-2.5 py-1 rounded-full">
              {budgetSummary.overBudgetCount} {t("budgets.over").toLowerCase()}
            </span>
          )}
        </div>

        {/* Overall progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs t2">{t("analytics.budget_total_spent")}</span>
            <span className="text-xs font-bold t1">{overallPct}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.07)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallPct}%` }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ backgroundColor: overallColor }}
            />
          </div>
        </div>

        {/* 3-col stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t("analytics.budget_total_budget"), value: format(budgetSummary.totalBudget), color: "text-cyan-400" },
            { label: t("analytics.budget_total_spent"),  value: format(budgetSummary.totalSpent),  color: budgetSummary.overBudgetCount > 0 ? "text-rose-400" : "text-amber-400" },
            { label: t("analytics.budget_remaining"),    value: format(Math.max(0, remaining)),    color: remaining >= 0 ? "text-emerald-400" : "text-rose-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: "hsl(var(--bg-input))" }}>
              <p className="text-[9px] t3 uppercase tracking-wide leading-tight mb-1">{label}</p>
              <p className={`text-xs font-bold number-display truncate ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Category list */}
      {budgets.length === 0 ? (
        <div className="card p-8 text-center">
          <BarChart3 className="w-10 h-10 t3 opacity-20 mx-auto mb-3" />
          <p className="text-sm t2">{t("budgets.empty_title")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Over-budget group */}
          {overList.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <p className="text-xs font-bold text-rose-400 uppercase tracking-wide">{t("analytics.budget_over_title")}</p>
              </div>
              <div className="space-y-3.5">
                {overList.map((b) => <BudgetRow key={b.id} b={b} format={format} barColor="#F43F5E" />)}
              </div>
            </div>
          )}

          {/* Near-limit group */}
          {nearList.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">{t("analytics.budget_near_title")}</p>
              </div>
              <div className="space-y-3.5">
                {nearList.map((b) => <BudgetRow key={b.id} b={b} format={format} barColor="#F59E0B" />)}
              </div>
            </div>
          )}

          {/* Safe group */}
          {safeList.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide">{t("analytics.budget_ok_title")}</p>
              </div>
              <div className="space-y-3.5">
                {safeList.map((b) => <BudgetRow key={b.id} b={b} format={format} barColor="#10B981" />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BudgetRow({ b, format, barColor }: { b: BudgetItem; format: (n: number) => string; barColor: string }) {
  const pct = Math.min(b.percent ?? 0, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium t1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.category?.color ?? barColor }} />
          <span className="truncate max-w-[130px]">{b.category?.name ?? "—"}</span>
        </span>
        <span className="text-[10px] t2 shrink-0 tabular-nums">{format(b.spent ?? 0)} / {format(b.monthly_limit)}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.07)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="h-2 rounded-full"
          style={{ backgroundColor: barColor }}
        />
      </div>
      {(b.percent ?? 0) > 100 && (
        <p className="text-[10px] text-rose-400 mt-0.5 text-end tabular-nums">
          +{format((b.spent ?? 0) - b.monthly_limit)} over
        </p>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

function AnalyticsPageInner() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    if (tab === "overview" || tab === "spending" || tab === "wealth" || tab === "goals" || tab === "budget") return tab;
    return "overview";
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "overview" || tab === "spending" || tab === "wealth" || tab === "goals" || tab === "budget") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const { theme } = useTheme();
  const { t, locale } = useTranslation();
  const { format } = useCurrency();
  const { isGuest, isLoading: guestLoading } = useGuest();
  const queryClient = useQueryClient();
  const engine = useFinancialEngine();

  const now = useMemo(() => new Date(), []);
  const ready = !guestLoading;
  const budgetsQuery   = useBudgets(now.getMonth() + 1, now.getFullYear(), isGuest, ready);
  const goalsQuery     = useGoals(!isGuest && ready);

  const charts = useMemo<AnalyticsCharts>(() => ({
    spendingByCategory: buildSpendingByCategory(engine.transactions),
    incomeVsExpenses: buildIncomeVsExpenses(engine.transactions),
    monthlyCashflow: buildMonthlyCashflow(engine.transactions),
  }), [engine.transactions]);

  const debts = useMemo<DebtAnalytics>(() => buildDebtAnalytics(engine.debts), [engine.debts]);

  const invs = useMemo<InvestmentAnalytics>(() => ({
    total_invested: engine.investedTotal,
    current_value: engine.portfolioValue,
    profit_loss: engine.portfolioGain,
    profit_loss_percentage: engine.portfolioGainPct,
    investments_count: engine.investments.length,
  }), [engine.investedTotal, engine.portfolioValue, engine.portfolioGain, engine.portfolioGainPct, engine.investments.length]);

  const totalBalance    = engine.balance;
  const monthlyIncome   = engine.monthlyIncome;
  const monthlyExpenses = engine.monthlyExpenses;
  const savingsRate     = engine.monthlySavingsRate;
  const payableRemaining = debts.total_payable_remaining ?? debts.total_payable;
  const receivableRemaining = debts.total_receivable_remaining ?? debts.total_receivable;
  const netWorth = totalBalance + invs.current_value + receivableRemaining - payableRemaining;
  const monthNet = monthlyIncome - monthlyExpenses;

  const budgets      = (budgetsQuery.data?.budgets ?? []) as BudgetItem[];
  const budgetSummary = budgetsQuery.data?.summary ?? { totalBudget: 0, totalSpent: 0, overBudgetCount: 0, nearLimitCount: 0 };
  const goals        = (goalsQuery.data ?? []) as GoalItem[];

  const localeTag = locale === "ar" ? "ar" : locale === "de" ? "de-DE" : "en-US";
  const formatMonth = useCallback((value: string) => {
    const [year, month] = value.split("-").map(Number);
    if (!year || !month) return value;
    return new Date(year, month - 1, 1).toLocaleDateString(localeTag, { month: "short" });
  }, [localeTag]);

  const cc = useMemo<ChartColors>(() => ({
    grid:   theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
    tick:   theme === "dark" ? "#4B5563" : "#94A3B8",
    bgTip:  theme === "dark" ? "#1a2235" : "#ffffff",
    borTip: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    txtTip: theme === "dark" ? "#ffffff" : "#0F172A",
  }), [theme]);

  const health = useMemo(() => {
    const payable      = debts.total_payable_remaining ?? debts.total_payable;
    const annualIncome = monthlyIncome * 12;
    const debtRatio    = annualIncome > 0 ? payable / annualIncome : (payable > 0 ? 1 : 0);

    const savPts    = savingsRate >= 20 ? 30 : savingsRate >= 10 ? 22 : savingsRate >= 5 ? 12 : savingsRate > 0 ? 5 : 0;
    const debtPts   = payable === 0 ? 30 : debtRatio < 0.2 ? 24 : debtRatio < 0.4 ? 15 : debtRatio < 0.7 ? 6 : 0;
    const budgetPts = budgetSummary.overBudgetCount === 0 ? 25 : budgetSummary.overBudgetCount === 1 ? 15 : budgetSummary.overBudgetCount <= 3 ? 7 : 2;
    const goalPts   = goals.length === 0 ? 0 : Math.round((goals.reduce((a, g) => a + (g.progress ?? 0), 0) / goals.length / 100) * 15);

    const score = Math.min(100, savPts + debtPts + budgetPts + goalPts);
    const color = score >= 80 ? "#10B981" : score >= 60 ? "#06B6D4" : score >= 40 ? "#F59E0B" : "#F43F5E";
    const label = score >= 80 ? t("analytics.health_excellent") : score >= 60 ? t("analytics.health_good") : score >= 40 ? t("analytics.health_fair") : t("analytics.health_poor");

    return {
      score, color, label,
      factors: [
        { label: t("analytics.factor_savings"), pts: savPts,    max: 30, color: "#10B981" },
        { label: t("analytics.factor_debt"),    pts: debtPts,   max: 30, color: "#06B6D4" },
        { label: t("analytics.factor_budget"),  pts: budgetPts, max: 25, color: "#F59E0B" },
        { label: t("analytics.factor_goals"),   pts: goalPts,   max: 15, color: "#A78BFA" },
      ],
    };
  }, [savingsRate, debts, monthlyIncome, budgetSummary, goals, t]);

  const tabs: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: "overview", label: t("analytics.tab_overview"), Icon: Activity },
    { id: "spending", label: t("analytics.tab_spending"), Icon: PieChartIcon },
    { id: "wealth",   label: t("analytics.tab_wealth"),   Icon: TrendingUp },
    { id: "goals",    label: t("analytics.tab_goals"),    Icon: Target },
    { id: "budget",   label: t("analytics.tab_budget"),   Icon: BarChart3 },
  ];

  const refreshData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all, refetchType: "all" });
    void queryClient.invalidateQueries({ queryKey: queryKeys.debts.all, refetchType: "all" });
    void queryClient.invalidateQueries({ queryKey: queryKeys.investments.all, refetchType: "all" });
    void queryClient.invalidateQueries({ queryKey: queryKeys.work.all, refetchType: "all" });
    void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all, refetchType: "all" });
    void queryClient.invalidateQueries({ queryKey: queryKeys.goals.all, refetchType: "all" });
  }, [queryClient]);

  if (engine.isLoading || budgetsQuery.isLoading || goalsQuery.isLoading) return <PageSkeleton />;

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold t3 uppercase tracking-[0.12em]">
              {t("analytics.cockpit")}
            </p>
            <h1 className="truncate text-xl font-black t1">{t("analytics.title")}</h1>
            <p className="text-xs font-medium t3">{t("analytics.subtitle")}</p>
          </div>
        </div>
        <button
          onClick={refreshData}
          className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/15 px-3 py-2 rounded-xl transition-all pressable shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("ai_insights.refresh")}
        </button>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em] mb-1">
              {t("analytics.net_worth")}
            </p>
            <p className={`text-3xl font-black number-display leading-none ${netWorth >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {format(netWorth)}
            </p>
          </div>
          <div className={`rounded-2xl px-3 py-2 text-end ${monthNet >= 0 ? "bg-emerald-400/10" : "bg-rose-400/10"}`}>
            <p className="text-[10px] t3">{t("dashboard.this_month_net")}</p>
            <p className={`text-sm font-black number-display ${monthNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {monthNet >= 0 ? "+" : ""}{format(monthNet)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t("dashboard.monthly_income"), value: `+${format(monthlyIncome)}`, tone: "text-emerald-400" },
            { label: t("dashboard.monthly_expenses"), value: `-${format(monthlyExpenses)}`, tone: "text-rose-400" },
            { label: t("dashboard.savings_rate"), value: `${savingsRate}%`, tone: savingsRate >= 20 ? "text-emerald-400" : savingsRate > 0 ? "text-cyan-400" : "text-amber-400" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-[hsl(var(--bg-input))] p-3">
              <p className="text-[9px] t3 uppercase tracking-wide leading-tight mb-1">{item.label}</p>
              <p className={`text-sm font-black number-display truncate ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky tab bar */}
      <div
        className="sticky top-0 z-20 -mx-3 sm:-mx-5 lg:-mx-7 xl:-mx-8 px-3 sm:px-5 lg:px-7 xl:px-8 py-2.5 mb-4 border-b border-[hsl(var(--border-2))]"
        style={{ backgroundColor: "hsl(var(--bg-card))" }}
      >
        <div className="tabs-row flex gap-1 overflow-x-auto">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                activeTab === id
                  ? "bg-cyan-400/15 text-cyan-400"
                  : "t2 hover:bg-[hsl(var(--bg-input))]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content with fade transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          {activeTab === "overview" && (
            <OverviewTab
              score={health.score} scoreColor={health.color} scoreLabel={health.label}
              factors={health.factors}
              monthlyIncome={monthlyIncome} monthlyExpenses={monthlyExpenses} savingsRate={savingsRate}
              format={format} t={t}
            />
          )}
          {activeTab === "spending" && (
            <SpendingTab
              charts={charts} format={format} t={t} cc={cc} formatMonth={formatMonth}
            />
          )}
          {activeTab === "wealth" && (
            <WealthTab
              totalBalance={totalBalance} investments={invs} debts={debts}
              charts={charts} cc={cc} formatMonth={formatMonth}
              format={format} t={t}
            />
          )}
          {activeTab === "goals" && (
            <GoalsTab goals={goals} format={format} t={t} isRtl={locale === "ar"} />
          )}
          {activeTab === "budget" && (
            <BudgetTab
              budgets={budgets} budgetSummary={budgetSummary}
              format={format} t={t}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

import { Suspense } from "react";

export default function AnalyticsPage() {
  return (
    <Suspense>
      <AnalyticsPageInner />
    </Suspense>
  );
}
