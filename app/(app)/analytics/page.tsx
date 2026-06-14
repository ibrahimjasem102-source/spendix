"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Activity, BarChart3,
  PieChart as PieChartIcon, Briefcase, FileText, RefreshCw,
  ArrowUp, ArrowDown, Target, AlertTriangle, CheckCircle2,
  Download, Wallet, CreditCard, Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/lib/currency";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n";
import { queryKeys } from "@/lib/query/keys";
import { safeFetch } from "@/lib/fetch-safe";
import type { LedgerAnalyticsBundle, MonthPoint, CategoryBreakdown } from "@/lib/analytics/ledger-engine";
import type { ForecastBundle } from "@/lib/analytics/forecasting";
import type { DebtAnalytics, InvestmentAnalytics, WorkAnalytics } from "@/lib/analytics/analyticsService";

// ── Bundle type ────────────────────────────────────────────────

interface BudgetRow {
  id: string; name: string; limitAmount: number; categoryId: string | null;
  period: string; spent: number; utilization: number;
}

interface GoalRow {
  id: string; name: string; targetAmount: number; currentAmount: number;
  status: string; progress: number;
}

interface NetWorth { total: number; cash: number; investments: number; debtOwed: number }

interface HealthFactors {
  savingsScore: number; debtScore: number; budgetScore: number; emergencyScore: number;
  savingsRate: number; debtRatio: number; budgetAvgUtil: number; emergMonths: number;
}

interface BundleData {
  ledger:      LedgerAnalyticsBundle;
  debts:       DebtAnalytics;
  investments: InvestmentAnalytics;
  work:        WorkAnalytics;
  accounts:    { id: string; name: string; balance: number; currency: string }[];
  budgets:     BudgetRow[];
  goals:       GoalRow[];
  netWorth:    NetWorth;
  health:      { score: number; factors: HealthFactors };
  forecast:    ForecastBundle;
}

// ── Tabs ───────────────────────────────────────────────────────

type Tab = "overview" | "income" | "expenses" | "wealth" | "work" | "reports";

const TABS: { id: Tab; icon: React.ElementType; labelKey: string }[] = [
  { id: "overview",  icon: Activity,       labelKey: "analytics.tab_overview"  },
  { id: "income",    icon: TrendingUp,      labelKey: "analytics.tab_income"    },
  { id: "expenses",  icon: TrendingDown,    labelKey: "analytics.tab_expenses"  },
  { id: "wealth",    icon: Wallet,          labelKey: "analytics.tab_wealth"    },
  { id: "work",      icon: Briefcase,       labelKey: "analytics.tab_work"      },
  { id: "reports",   icon: FileText,        labelKey: "analytics.tab_reports"   },
];

// ── Helpers ────────────────────────────────────────────────────

function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

type TFunc = (k: string, p?: Record<string, string | number>) => string;

function healthLabel(score: number, t: TFunc) {
  if (score >= 80) return { label: t("analytics.health_excellent"), color: "#10B981" };
  if (score >= 60) return { label: t("analytics.health_good"),      color: "#06B6D4" };
  if (score >= 40) return { label: t("analytics.health_fair"),      color: "#F59E0B" };
  return              { label: t("analytics.health_poor"),      color: "#F43F5E" };
}

// ── Mini components ────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, trend, iconColor, iconBg,
}: {
  icon: React.ElementType; label: string; value: string;
  sub?: string; trend?: "up" | "down" | "neutral"; iconColor: string; iconBg: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        {trend && trend !== "neutral" && (
          <div className={`flex items-center gap-0.5 text-[10px] font-bold ${
            trend === "up" ? "text-emerald-400" : "text-rose-400"
          }`}>
            {trend === "up" ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
          </div>
        )}
      </div>
      <p className="text-[10px] t3 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-base font-bold t1 number-display leading-tight">{value}</p>
      {sub && <p className="text-[10px] t3 mt-0.5">{sub}</p>}
    </div>
  );
}

function HealthRing({ score, label, color }: { score: number; label: string; color: string }) {
  const R = 44, circ = 2 * Math.PI * R;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          <motion.circle
            cx="50" cy="50" r={R} fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold t1 number-display">{score}</span>
          <span className="text-[9px] t3 uppercase tracking-wide">/ 100</span>
        </div>
      </div>
      <span className="text-sm font-semibold mt-2" style={{ color }}>{label}</span>
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-bold t1">{title}</p>
      {sub && <p className="text-xs t3 mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label, format }: {
  active?: boolean; payload?: { value: number; name: string; color: string }[];
  label?: string; format: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 shadow-2xl text-xs space-y-1"
      style={{ background: "hsl(var(--bg-card))", border: "1px solid rgba(255,255,255,0.08)" }}>
      {label && <p className="t3 mb-2 font-medium">{label}</p>}
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="t2">{p.name}:</span>
          <span className="font-bold t1">{format(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────

function OverviewTab({ data, format, t }: { data: BundleData; format: (n: number) => string; t: TFunc }) {
  const { ledger, health, forecast, netWorth } = data;
  const { score, factors } = health;
  const { label: hLabel, color: hColor } = healthLabel(score, t);
  const monthly = ledger.monthly;

  const incomeVsExp = monthly.map(m => ({
    label:    m.label,
    income:   m.income,
    expenses: m.expenses,
    net:      m.net,
  }));

  const factorItems = [
    { key: t("analytics.factor_savings"), score: factors.savingsScore, max: 30, detail: `${factors.savingsRate}% ${t("analytics.savings_rate_short")}` },
    { key: t("analytics.factor_debt"),    score: factors.debtScore,    max: 30, detail: `${factors.debtRatio}× ${t("analytics.debt_ratio_short")}` },
    { key: t("analytics.factor_budget"),  score: factors.budgetScore,  max: 20, detail: `${factors.budgetAvgUtil}% ${t("analytics.util_short")}` },
    { key: t("analytics.factor_emergency"), score: factors.emergencyScore, max: 20, detail: `${factors.emergMonths} ${t("analytics.months_short")}` },
  ];

  const proj365 = forecast.points365;
  const lastForecast = proj365[proj365.length - 1];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={TrendingUp} label={t("analytics.monthly_income")}
          value={format(ledger.kpis.monthlyIncome)}
          iconColor="text-emerald-400" iconBg="bg-emerald-400/10"
          trend={ledger.kpis.monthlyIncome >= ledger.kpis.avgMonthlyIncome ? "up" : "down"}
        />
        <KpiCard
          icon={TrendingDown} label={t("analytics.monthly_expenses")}
          value={format(ledger.kpis.monthlyExpenses)}
          iconColor="text-rose-400" iconBg="bg-rose-400/10"
          trend={ledger.kpis.monthlyExpenses <= ledger.kpis.avgMonthlyExpenses ? "up" : "down"}
        />
        <KpiCard
          icon={DollarSign} label={t("analytics.net_cash_flow")}
          value={format(ledger.kpis.monthlyNet)}
          iconColor={ledger.kpis.monthlyNet >= 0 ? "text-cyan-400" : "text-rose-400"}
          iconBg={ledger.kpis.monthlyNet >= 0 ? "bg-cyan-400/10" : "bg-rose-400/10"}
        />
        <KpiCard
          icon={Activity} label={t("analytics.savings_rate")}
          value={`${ledger.kpis.savingsRate}%`}
          sub={t("analytics.this_month")}
          iconColor="text-purple-400" iconBg="bg-purple-400/10"
        />
      </div>

      {/* Net Worth snapshot */}
      <div className="card p-4">
        <SectionTitle title={t("analytics.net_worth")} />
        <div className="flex items-center justify-between mb-3">
          <p className="text-xl font-bold t1 number-display">{format(netWorth.total)}</p>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${netWorth.total >= 0 ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>
            {netWorth.total >= 0 ? "+" : ""}{format(netWorth.total)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t("analytics.cash"), value: netWorth.cash, color: "text-cyan-400" },
            { label: t("analytics.investments_short"), value: netWorth.investments, color: "text-purple-400" },
            { label: t("analytics.debt_owed"), value: -netWorth.debtOwed, color: "text-rose-400" },
          ].map(item => (
            <div key={item.label} className="text-center rounded-xl p-2.5" style={{ background: "hsl(var(--bg-input))" }}>
              <p className="text-[9px] t3 uppercase tracking-wide">{item.label}</p>
              <p className={`text-xs font-bold number-display ${item.color}`}>{format(Math.abs(item.value))}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 12-month trend */}
      <div className="card p-4">
        <SectionTitle title={t("analytics.twelve_month_trend")} sub={t("analytics.income_vs_expenses")} />
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={incomeVsExp} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#F43F5E" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fill: "hsl(var(--text-3))", fontSize: 9 }}
              tickLine={false} axisLine={false}
              tickFormatter={l => l.split(" ")[0]} />
            <YAxis tick={{ fill: "hsl(var(--text-3))", fontSize: 9 }} tickLine={false} axisLine={false}
              tickFormatter={v => `${Math.round(v / 1000)}k`} />
            <Tooltip content={<ChartTooltip format={format} />} />
            <Area type="monotone" dataKey="income"   name={t("common.income")}   stroke="#10B981" fill="url(#incGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="expenses" name={t("common.expenses")} stroke="#F43F5E" fill="url(#expGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Health score */}
      <div className="card p-4">
        <SectionTitle title={t("analytics.health_score")} />
        <div className="flex items-center gap-6">
          <HealthRing score={score} label={hLabel} color={hColor} />
          <div className="flex-1 space-y-2.5">
            {factorItems.map(f => (
              <div key={f.key}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] t2">{f.key}</span>
                  <span className="text-[10px] font-bold t1">{f.score}/{f.max}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: hColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(f.score / f.max) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <p className="text-[9px] t3 mt-0.5">{f.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Forecast summary */}
      {lastForecast && (
        <div className="card p-4">
          <SectionTitle title={t("analytics.forecast_summary")} sub={t("analytics.forecast_sub")} />
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t("analytics.days_30"), val: forecast.points30[0]?.projectedNet ?? 0 },
              { label: t("analytics.days_90"), val: (forecast.points90[2]?.cumulative ?? 0) },
              { label: t("analytics.days_365"), val: (forecast.points365[11]?.cumulative ?? 0) },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: "hsl(var(--bg-input))" }}>
                <p className="text-[9px] t3 uppercase tracking-wide mb-1">{item.label}</p>
                <p className={`text-xs font-bold number-display ${item.val >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {item.val >= 0 ? "+" : ""}{format(item.val)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] t3 mt-3 text-center">{t("analytics.forecast_disclaimer")}</p>
        </div>
      )}
    </div>
  );
}

// ── Income Tab ─────────────────────────────────────────────────

function IncomeTab({ data, format, t }: { data: BundleData; format: (n: number) => string; t: TFunc }) {
  const { ledger } = data;
  const monthly = ledger.monthly;

  const SOURCE_LABELS: Record<string, string> = {
    transaction:       t("common.transaction"),
    work_payment:      t("analytics.work_income"),
    debt_repayment:    t("analytics.debt_repayment"),
    investment_return: t("analytics.investment_return"),
    recurring:         t("analytics.recurring_income"),
    manual:            t("analytics.manual"),
    other:             t("common.other"),
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={TrendingUp} label={t("analytics.ytd_income")}
          value={format(ledger.kpis.ytdIncome)}
          iconColor="text-emerald-400" iconBg="bg-emerald-400/10"
        />
        <KpiCard
          icon={Activity} label={t("analytics.avg_monthly_income")}
          value={format(ledger.kpis.avgMonthlyIncome)}
          iconColor="text-cyan-400" iconBg="bg-cyan-400/10"
        />
        <KpiCard
          icon={Briefcase} label={t("analytics.work_income")}
          value={format(ledger.kpis.workIncome)}
          sub={t("analytics.this_month")}
          iconColor="text-teal-400" iconBg="bg-teal-400/10"
        />
        <KpiCard
          icon={Target} label={t("analytics.savings_rate")}
          value={`${ledger.kpis.savingsRate}%`}
          iconColor="text-purple-400" iconBg="bg-purple-400/10"
        />
      </div>

      {/* Monthly income bar */}
      <div className="card p-4">
        <SectionTitle title={t("analytics.monthly_income_trend")} sub={t("analytics.last_12_months")} />
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fill: "hsl(var(--text-3))", fontSize: 9 }}
              tickLine={false} axisLine={false} tickFormatter={l => l.split(" ")[0]} />
            <YAxis tick={{ fill: "hsl(var(--text-3))", fontSize: 9 }} tickLine={false} axisLine={false}
              tickFormatter={v => `${Math.round(v / 1000)}k`} />
            <Tooltip content={<ChartTooltip format={format} />} />
            <Bar dataKey="income" name={t("common.income")} fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Income by source */}
      <div className="card p-4">
        <SectionTitle title={t("analytics.income_by_source")} />
        {ledger.incomeBySource.length === 0 ? (
          <p className="text-xs t3 text-center py-6">{t("analytics.no_data")}</p>
        ) : (
          <div className="space-y-3">
            {ledger.incomeBySource.map(src => (
              <div key={src.source}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs t1 font-medium capitalize">
                    {SOURCE_LABELS[src.source] ?? src.source}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs t3">{src.pct}%</span>
                    <span className="text-xs font-bold t1 number-display">{format(src.amount)}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <motion.div
                    className="h-full rounded-full bg-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${src.pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <p className="text-[9px] t3 mt-0.5">{src.count} {t("analytics.entries")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Expenses Tab ───────────────────────────────────────────────

const CAT_COLORS = ["#06B6D4","#10B981","#F43F5E","#8B5CF6","#F59E0B","#EC4899","#3B82F6","#22C55E","#F97316","#14B8A6","#6366F1","#84CC16"];

function ExpensesTab({ data, format, t }: { data: BundleData; format: (n: number) => string; t: TFunc }) {
  const { ledger } = data;
  const monthly = ledger.monthly;
  const topCat = ledger.expenseByCategory[0];

  const pieData = ledger.expenseByCategory.map((c, i) => ({
    name:  c.categoryName,
    value: c.amount,
    color: c.color || CAT_COLORS[i % CAT_COLORS.length],
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={TrendingDown} label={t("analytics.ytd_expenses")}
          value={format(ledger.kpis.ytdExpenses)}
          iconColor="text-rose-400" iconBg="bg-rose-400/10"
        />
        <KpiCard
          icon={Activity} label={t("analytics.avg_monthly_expenses")}
          value={format(ledger.kpis.avgMonthlyExpenses)}
          iconColor="text-amber-400" iconBg="bg-amber-400/10"
        />
        {topCat && (
          <KpiCard
            icon={PieChartIcon} label={t("analytics.top_category")}
            value={topCat.categoryName}
            sub={format(topCat.amount)}
            iconColor="text-purple-400" iconBg="bg-purple-400/10"
          />
        )}
        <KpiCard
          icon={BarChart3} label={t("analytics.monthly_expenses")}
          value={format(ledger.kpis.monthlyExpenses)}
          sub={t("analytics.this_month")}
          iconColor="text-cyan-400" iconBg="bg-cyan-400/10"
        />
      </div>

      {/* Monthly expenses area */}
      <div className="card p-4">
        <SectionTitle title={t("analytics.monthly_expense_trend")} sub={t("analytics.last_12_months")} />
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="expGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#F43F5E" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fill: "hsl(var(--text-3))", fontSize: 9 }}
              tickLine={false} axisLine={false} tickFormatter={l => l.split(" ")[0]} />
            <YAxis tick={{ fill: "hsl(var(--text-3))", fontSize: 9 }} tickLine={false} axisLine={false}
              tickFormatter={v => `${Math.round(v / 1000)}k`} />
            <Tooltip content={<ChartTooltip format={format} />} />
            <Area type="monotone" dataKey="expenses" name={t("common.expenses")}
              stroke="#F43F5E" fill="url(#expGrad2)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Category breakdown */}
      {ledger.expenseByCategory.length > 0 && (
        <div className="card p-4">
          <SectionTitle title={t("analytics.spending_by_category")} />
          <div className="flex gap-4 items-center mb-4">
            <div className="shrink-0">
              <PieChart width={110} height={110}>
                <Pie data={pieData} cx={50} cy={50} innerRadius={28} outerRadius={50}
                  dataKey="value" paddingAngle={2} strokeWidth={0}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              {ledger.expenseByCategory.slice(0, 5).map((c, i) => (
                <div key={c.categoryId ?? i} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color || CAT_COLORS[i % CAT_COLORS.length] }} />
                  <span className="text-xs t2 flex-1 truncate">{c.categoryName}</span>
                  <span className="text-xs font-bold t1 number-display shrink-0">{format(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {ledger.expenseByCategory.slice(5).map((c, i) => (
              <div key={c.categoryId ?? i + 5}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs t2">{c.categoryName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] t3">{c.pct}%</span>
                    <span className="text-xs font-semibold t1 number-display">{format(c.amount)}</span>
                  </div>
                </div>
                <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color || CAT_COLORS[(i + 5) % CAT_COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 10 expenses */}
      {ledger.topExpenses.length > 0 && (
        <div className="card p-4">
          <SectionTitle title={t("analytics.top_expenses")} />
          <div className="space-y-2">
            {ledger.topExpenses.map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="text-[10px] font-bold t3 w-5 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs t1 font-medium truncate">{e.description}</p>
                  <p className="text-[10px] t3">{e.category} · {e.date}</p>
                </div>
                <span className="text-sm font-bold text-rose-400 number-display shrink-0">{format(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Wealth Tab ─────────────────────────────────────────────────

function WealthTab({ data, format, t }: { data: BundleData; format: (n: number) => string; t: TFunc }) {
  const { debts, investments, budgets, goals, netWorth, accounts } = data;

  const totalBudget = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalSpent  = budgets.reduce((s, b) => s + b.spent,       0);
  const overBudget  = budgets.filter(b => b.utilization > 100);

  return (
    <div className="space-y-4">
      {/* Net Worth */}
      <div className="card p-4">
        <SectionTitle title={t("analytics.net_worth")} />
        <div className="text-center mb-4">
          <p className="text-3xl font-bold t1 number-display">{format(netWorth.total)}</p>
          <span className={`text-xs font-medium ${netWorth.total >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {t("analytics.total_net_worth")}
          </span>
        </div>
        <div className="space-y-2">
          {accounts.map(a => (
            <div key={a.id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs t1">{a.name}</span>
              </div>
              <span className="text-xs font-bold text-cyan-400 number-display">{format(num(a.balance))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Investments */}
      <div className="card p-4">
        <SectionTitle title={t("analytics.investment_portfolio")} />
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t("analytics.invested"),      value: format(investments.total_invested),  color: "text-purple-400" },
            { label: t("analytics.current_value"), value: format(investments.current_value),   color: "text-cyan-400"   },
            {
              label: t("analytics.gain_loss"),
              value: `${investments.profit_loss >= 0 ? "+" : ""}${format(investments.profit_loss)}`,
              color: investments.profit_loss >= 0 ? "text-emerald-400" : "text-rose-400",
            },
          ].map(item => (
            <div key={item.label} className="text-center rounded-xl p-3" style={{ background: "hsl(var(--bg-input))" }}>
              <p className="text-[9px] t3 uppercase tracking-wide mb-1">{item.label}</p>
              <p className={`text-xs font-bold number-display ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
        {investments.investments_count === 0 && (
          <p className="text-xs t3 text-center mt-3">{t("analytics.no_investments")}</p>
        )}
      </div>

      {/* Debts */}
      <div className="card p-4">
        <SectionTitle title={t("analytics.debt_analysis")} />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-xl p-3" style={{ background: "hsl(var(--bg-input))" }}>
            <p className="text-[9px] t3 uppercase tracking-wide mb-1">{t("analytics.i_owe")}</p>
            <p className="text-sm font-bold text-rose-400 number-display">{format(debts.total_payable_remaining ?? 0)}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "hsl(var(--bg-input))" }}>
            <p className="text-[9px] t3 uppercase tracking-wide mb-1">{t("analytics.owed_to_me")}</p>
            <p className="text-sm font-bold text-emerald-400 number-display">{format(debts.total_receivable_remaining ?? 0)}</p>
          </div>
        </div>
        <div className="flex justify-between text-xs">
          <span className="t2">{t("analytics.active_debts")}: <strong className="t1">{debts.active_debts}</strong></span>
          <span className="t2">{t("analytics.overdue")}: <strong className="text-rose-400">{debts.overdue_debts}</strong></span>
          <span className="t2">{t("analytics.paid")}: <strong className="text-emerald-400">{debts.paid_debts}</strong></span>
        </div>
      </div>

      {/* Budgets */}
      {budgets.length > 0 && (
        <div className="card p-4">
          <SectionTitle title={t("analytics.tab_budget")} />
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl p-3 text-center" style={{ background: "hsl(var(--bg-input))" }}>
              <p className="text-[9px] t3 uppercase mb-1">{t("analytics.budget_total_budget")}</p>
              <p className="text-xs font-bold text-cyan-400 number-display">{format(totalBudget)}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "hsl(var(--bg-input))" }}>
              <p className="text-[9px] t3 uppercase mb-1">{t("analytics.budget_total_spent")}</p>
              <p className={`text-xs font-bold number-display ${overBudget.length > 0 ? "text-rose-400" : "text-amber-400"}`}>{format(totalSpent)}</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {budgets.slice(0, 6).map(b => {
              const pct   = Math.min(b.utilization, 100);
              const color = b.utilization > 100 ? "#F43F5E" : b.utilization > 80 ? "#F59E0B" : "#10B981";
              return (
                <div key={b.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs t1 truncate max-w-[120px]">{b.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] t3">{b.utilization}%</span>
                      <span className="text-xs font-bold t1 number-display">{format(b.spent)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <div className="card p-4">
          <SectionTitle title={t("goals.title")} />
          <div className="space-y-3">
            {goals.map(g => (
              <div key={g.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  g.status === "completed" ? "bg-emerald-400/10" : "bg-cyan-400/10"
                }`}>
                  <Target className={`w-4 h-4 ${g.status === "completed" ? "text-emerald-400" : "text-cyan-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs t1 font-medium truncate">{g.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${g.progress}%` }} />
                    </div>
                    <span className="text-[10px] t3 shrink-0">{g.progress}%</span>
                  </div>
                  <p className="text-[10px] t3 mt-0.5">{format(g.currentAmount)} / {format(g.targetAmount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Work Tab ───────────────────────────────────────────────────

function WorkTab({ data, format, t }: { data: BundleData; format: (n: number) => string; t: TFunc }) {
  const { work } = data;
  const unpaid = num(work.expected_work_income) - num(work.received_work_income);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={Briefcase} label={t("analytics.hours_this_month")}
          value={`${num(work.hours_this_month).toFixed(1)}h`}
          iconColor="text-teal-400" iconBg="bg-teal-400/10"
        />
        <KpiCard
          icon={TrendingUp} label={t("analytics.expected_income")}
          value={format(num(work.expected_work_income))}
          iconColor="text-emerald-400" iconBg="bg-emerald-400/10"
        />
        <KpiCard
          icon={CheckCircle2} label={t("analytics.received_income")}
          value={format(num(work.received_work_income))}
          iconColor="text-cyan-400" iconBg="bg-cyan-400/10"
        />
        <KpiCard
          icon={AlertTriangle} label={t("analytics.unpaid_balance")}
          value={format(Math.max(0, unpaid))}
          iconColor={unpaid > 0 ? "text-amber-400" : "text-emerald-400"}
          iconBg={unpaid > 0 ? "bg-amber-400/10" : "bg-emerald-400/10"}
        />
      </div>

      {/* Utilization bar */}
      {num(work.expected_work_income) > 0 && (
        <div className="card p-4">
          <SectionTitle title={t("analytics.payment_collection")} />
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs t2">{t("analytics.collected_pct")}</span>
              <span className="text-xs font-bold t1">
                {Math.round((num(work.received_work_income) / num(work.expected_work_income)) * 100)}%
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <motion.div
                className="h-full rounded-full bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (num(work.received_work_income) / num(work.expected_work_income)) * 100)}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            </div>
          </div>
          <div className="flex justify-between text-xs mt-3">
            <div>
              <p className="t3">{t("analytics.expected")}</p>
              <p className="t1 font-bold number-display">{format(num(work.expected_work_income))}</p>
            </div>
            <div className="text-right">
              <p className="t3">{t("analytics.received")}</p>
              <p className="t1 font-bold number-display">{format(num(work.received_work_income))}</p>
            </div>
          </div>
        </div>
      )}

      {work.hours_this_month === 0 && work.expected_work_income === 0 && (
        <div className="card p-8 text-center">
          <Briefcase className="w-10 h-10 t3 opacity-20 mx-auto mb-3" />
          <p className="text-sm t2">{t("analytics.no_work_data")}</p>
          <p className="text-xs t3 mt-1">{t("analytics.no_work_sub")}</p>
        </div>
      )}
    </div>
  );
}

// ── Reports Tab ────────────────────────────────────────────────

function ReportsTab({ data, format, t }: { data: BundleData; format: (n: number) => string; t: TFunc }) {
  const { ledger } = data;
  const monthly = ledger.monthly;

  function downloadCSV() {
    const rows = [
      ["Month", "Income", "Expenses", "Net", "Savings Rate (%)"],
      ...monthly.map(m => [m.label, m.income.toFixed(2), m.expenses.toFixed(2), m.net.toFixed(2), m.savingsRate.toString()]),
      [],
      ["Category Breakdown (Last 12 Months)"],
      ["Category", "Amount", "% of Total", "Entries"],
      ...ledger.expenseByCategory.map(c => [c.categoryName, c.amount.toFixed(2), c.pct.toString(), c.count.toString()]),
    ];

    const csv    = rows.map(r => r.join(",")).join("\n");
    const blob   = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = `spendix-report-${new Date().toISOString().slice(0, 7)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const ytdSavingsRate = ledger.kpis.ytdIncome > 0
    ? Math.round(((ledger.kpis.ytdIncome - ledger.kpis.ytdExpenses) / ledger.kpis.ytdIncome) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* YTD summary */}
      <div className="card p-4">
        <SectionTitle title={t("analytics.ytd_summary")} />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <KpiCard icon={TrendingUp}   label={t("analytics.ytd_income")}   value={format(ledger.kpis.ytdIncome)}   iconColor="text-emerald-400" iconBg="bg-emerald-400/10" />
          <KpiCard icon={TrendingDown} label={t("analytics.ytd_expenses")} value={format(ledger.kpis.ytdExpenses)} iconColor="text-rose-400"    iconBg="bg-rose-400/10"    />
        </div>
        <div className="rounded-xl p-4 text-center" style={{ background: "hsl(var(--bg-input))" }}>
          <p className="text-[10px] t3 uppercase tracking-wide mb-1">{t("analytics.ytd_net")}</p>
          <p className={`text-2xl font-bold number-display ${ledger.kpis.ytdNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {ledger.kpis.ytdNet >= 0 ? "+" : ""}{format(ledger.kpis.ytdNet)}
          </p>
          <p className="text-xs t3 mt-1">{t("analytics.savings_rate")}: {ytdSavingsRate}%</p>
        </div>
      </div>

      {/* Monthly table */}
      <div className="card p-4">
        <SectionTitle title={t("analytics.monthly_report")} sub={t("analytics.last_12_months")} />
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="t3">
                <th className="text-start pb-2 font-medium">{t("common.month")}</th>
                <th className="text-end pb-2 font-medium">{t("common.income")}</th>
                <th className="text-end pb-2 font-medium">{t("common.expenses")}</th>
                <th className="text-end pb-2 font-medium">{t("analytics.net")}</th>
              </tr>
            </thead>
            <tbody>
              {[...monthly].reverse().map(m => (
                <tr key={m.month} className="border-t border-white/5">
                  <td className="py-2 t2">{m.label}</td>
                  <td className="py-2 text-end text-emerald-400 font-semibold number-display">{format(m.income)}</td>
                  <td className="py-2 text-end text-rose-400 font-semibold number-display">{format(m.expenses)}</td>
                  <td className={`py-2 text-end font-bold number-display ${m.net >= 0 ? "text-cyan-400" : "text-rose-400"}`}>
                    {m.net >= 0 ? "+" : ""}{format(m.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Download */}
      <button onClick={downloadCSV} className="btn-primary w-full flex items-center justify-center gap-2">
        <Download className="w-4 h-4" />
        {t("analytics.download_csv")}
      </button>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-4 h-24 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
        ))}
      </div>
      <div className="card h-52 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
      <div className="card h-40 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const { format }    = useCurrency();
  const { t }         = useTranslation();

  const { data, isLoading, error, refetch, isFetching } = useQuery<BundleData>({
    queryKey: queryKeys.analytics.bundle(),
    queryFn:  async () => {
      const res = await safeFetch("/api/analytics/bundle");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.errorKey ?? "analytics.load_error");
      }
      return res.json() as Promise<BundleData>;
    },
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold t1">{t("analytics.title")}</h1>
            <p className="text-xs t3 mt-0.5">{t("analytics.subtitle")}</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 t2 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 mb-4">
        <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {TABS.map(tb => {
            const Icon    = tb.icon;
            const isActive = tab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                  isActive
                    ? "bg-cyan-400/15 text-cyan-400 border border-cyan-400/20"
                    : "t3 hover:t2 hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(tb.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {isLoading && <LoadingSkeleton />}

        {error && !isLoading && (
          <div className="card p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm t2 mb-3">{t("analytics.load_error")}</p>
            <button onClick={() => refetch()} className="btn-primary text-sm px-4 py-2">
              {t("common.retry")}
            </button>
          </div>
        )}

        {data && !isLoading && (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {tab === "overview"  && <OverviewTab  data={data} format={format} t={t} />}
              {tab === "income"    && <IncomeTab     data={data} format={format} t={t} />}
              {tab === "expenses"  && <ExpensesTab   data={data} format={format} t={t} />}
              {tab === "wealth"    && <WealthTab     data={data} format={format} t={t} />}
              {tab === "work"      && <WorkTab       data={data} format={format} t={t} />}
              {tab === "reports"   && <ReportsTab    data={data} format={format} t={t} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
