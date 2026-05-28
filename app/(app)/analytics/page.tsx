"use client";

import { useCallback, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n";
import { useAnalytics } from "@/lib/query/hooks";
import type { TransactionSource } from "@/types";

interface CategorySpend {
  name: string;
  value: number;
  color: string;
}

interface IncomeExpensePoint {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

interface CashflowPoint {
  day: number;
  date: string;
  amount: number;
}

interface SourceBreakdownPoint {
  source: TransactionSource;
  label: string;
  income: number;
  expenses: number;
  total: number;
  count: number;
  color: string;
}

interface AnalyticsCharts {
  spendingByCategory: CategorySpend[];
  incomeVsExpenses: IncomeExpensePoint[];
  monthlyCashflow: CashflowPoint[];
  sourceBreakdown: SourceBreakdownPoint[];
}

interface DebtAnalytics {
  total_payable: number;
  total_receivable: number;
  total_paid: number;
  total_remaining: number;
  active_debts: number;
  paid_debts: number;
  overdue_debts: number;
}

interface InvestmentAnalytics {
  total_invested: number;
  current_value: number;
  profit_loss: number;
  profit_loss_percentage: number;
  investments_count: number;
}

interface WorkAnalytics {
  hours_this_month: number;
  expected_work_income: number;
  received_work_income: number;
  unpaid_work_balance: number;
}

const EMPTY_CHARTS: AnalyticsCharts = {
  spendingByCategory: [],
  incomeVsExpenses: [],
  monthlyCashflow: [],
  sourceBreakdown: [],
};

const EMPTY_DEBTS: DebtAnalytics = {
  total_payable: 0,
  total_receivable: 0,
  total_paid: 0,
  total_remaining: 0,
  active_debts: 0,
  paid_debts: 0,
  overdue_debts: 0,
};

const EMPTY_INVESTMENTS: InvestmentAnalytics = {
  total_invested: 0,
  current_value: 0,
  profit_loss: 0,
  profit_loss_percentage: 0,
  investments_count: 0,
};

const EMPTY_WORK: WorkAnalytics = {
  hours_this_month: 0,
  expected_work_income: 0,
  received_work_income: 0,
  unpaid_work_balance: 0,
};

function CardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="skeleton h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, index) => <div key={index} className="skeleton h-24 rounded-2xl" />)}
      </div>
      <div className="skeleton h-72 rounded-2xl" />
      <div className="skeleton h-72 rounded-2xl" />
    </div>
  );
}

export default function AnalyticsPage() {
  const { theme } = useTheme();
  const { t, locale } = useTranslation();
  const { format } = useCurrency();

  const analyticsQuery = useAnalytics();

  const grid = theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tick = theme === "dark" ? "#4B5563" : "#94A3B8";
  const bgTip = theme === "dark" ? "#1a2235" : "#ffffff";
  const borTip = theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const txtTip = theme === "dark" ? "#ffffff" : "#0F172A";
  const localeTag = locale === "ar" ? "ar" : locale === "de" ? "de-DE" : "en-US";

  const formatMonth = useCallback((value: string) => {
    const [year, month] = value.split("-").map(Number);
    if (!year || !month) return value;
    return new Date(year, month - 1, 1).toLocaleDateString(localeTag, { month: "short" });
  }, [localeTag]);

  const formatDate = useCallback((value: string) => {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(localeTag, { month: "short", day: "numeric" });
  }, [localeTag]);

  const charts = (analyticsQuery.data?.charts ?? EMPTY_CHARTS) as AnalyticsCharts;
  const debts = (analyticsQuery.data?.debts ?? EMPTY_DEBTS) as DebtAnalytics;
  const investments = (analyticsQuery.data?.investments ?? EMPTY_INVESTMENTS) as InvestmentAnalytics;
  const work = (analyticsQuery.data?.work ?? EMPTY_WORK) as WorkAnalytics;
  const error = analyticsQuery.isError ? t("transactions.fetch_error") : null;

  const hasData = useMemo(
    () => charts.incomeVsExpenses.some((item) => item.income > 0 || item.expenses > 0) ||
      charts.spendingByCategory.length > 0 ||
      charts.sourceBreakdown.length > 0,
    [charts]
  );

  if (analyticsQuery.isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold t3 uppercase tracking-[0.12em] mb-1">Financial Cockpit</p>
          <h1 className="text-xl font-bold t1">{t("analytics.title")}</h1>
          <p className="text-sm t2 mt-0.5">{t("analytics.subtitle")}</p>
        </div>
        <button
          onClick={() => void analyticsQuery.refetch()}
          className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/15 px-3 py-2 rounded-xl transition-all pressable"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("common.retry")}
        </button>
      </div>

      {error && (
        <div className="card p-4 border-rose-400/20 bg-rose-400/5">
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      {!hasData && !error && (
        <div className="card p-5 border-cyan-400/20 bg-cyan-400/5">
          <p className="text-sm font-semibold t1">{t("common.no_data")}</p>
          <p className="text-xs t2 mt-1">{t("ai_insights.no_data_body")}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t("debts.remaining"), value: format(debts.total_remaining), tone: "text-amber-400" },
          { label: t("investments.current_value"), value: format(investments.current_value), tone: "text-purple-400" },
          { label: t("work.income_received"), value: format(work.received_work_income), tone: "text-cyan-400" },
          { label: t("dashboard.savings_rate"), value: `${Math.round(investments.profit_loss_percentage)}%`, tone: investments.profit_loss >= 0 ? "text-emerald-400" : "text-rose-400" },
        ].map((item) => (
          <div key={item.label} className="card p-4">
            <p className="text-[10px] t3 uppercase tracking-wide font-semibold">{item.label}</p>
            <p className={`text-lg font-bold number-display mt-2 ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold t1">{t("analytics.spending_trends")}</h3>
            <p className="text-xs t2 mt-0.5">{t("analytics.trends_subtitle")}</p>
          </div>
          <div className="flex items-center gap-3 text-xs t2">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />{t("transactions.income")}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400" />{t("transactions.expense")}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400" />{t("dashboard.savings_rate")}</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={charts.incomeVsExpenses} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
            <defs>
              {[["incGrad", "#10B981"], ["expGrad", "#F43F5E"], ["savGrad", "#06B6D4"]].map(([id, color]) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: tick }} tickLine={false} axisLine={false} tickFormatter={formatMonth} />
            <YAxis tick={{ fontSize: 11, fill: tick }} tickLine={false} axisLine={false} tickFormatter={(v) => format(Number(v))} />
            <Tooltip
              formatter={(value: number) => format(value)}
              labelFormatter={(label) => formatMonth(String(label))}
              contentStyle={{ background: bgTip, border: `1px solid ${borTip}`, borderRadius: 12 }}
              labelStyle={{ color: txtTip, fontSize: 12 }}
              itemStyle={{ color: txtTip }}
            />
            <Area type="monotone" dataKey="income" name={t("transactions.income")} stroke="#10B981" strokeWidth={2} fill="url(#incGrad)" dot={false} activeDot={false} />
            <Area type="monotone" dataKey="expenses" name={t("transactions.expense")} stroke="#F43F5E" strokeWidth={2} fill="url(#expGrad)" dot={false} activeDot={false} />
            <Area type="monotone" dataKey="savings" name={t("dashboard.savings_rate")} stroke="#06B6D4" strokeWidth={2} fill="url(#savGrad)" dot={false} activeDot={false} strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="mb-5">
            <h3 className="text-sm font-semibold t1">{t("dashboard.daily_spending")}</h3>
            <p className="text-xs t2 mt-0.5">{t("dashboard.last_30_days")}</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.monthlyCashflow} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: tick }} tickLine={false} axisLine={false} tickFormatter={formatDate} interval={5} />
              <YAxis tick={{ fontSize: 11, fill: tick }} tickLine={false} axisLine={false} tickFormatter={(v) => format(Number(v))} />
              <Tooltip
                formatter={(value: number) => [format(value), t("dashboard.total_spent")]}
                labelFormatter={(label) => formatDate(String(label))}
                contentStyle={{ background: bgTip, border: `1px solid ${borTip}`, borderRadius: 12 }}
                labelStyle={{ color: txtTip, fontSize: 12 }}
                itemStyle={{ color: txtTip }}
              />
              <Bar dataKey="amount" fill="#06B6D4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="mb-5">
            <h3 className="text-sm font-semibold t1">{t("dashboard.by_category")}</h3>
            <p className="text-xs t2 mt-0.5">{t("dashboard.this_month")}</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={charts.spendingByCategory.length > 0 ? charts.spendingByCategory : [{ name: t("common.no_data"), value: 1, color: "rgba(148,163,184,0.25)" }]}
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={82}
                dataKey="value"
                strokeWidth={0}
              >
                {(charts.spendingByCategory.length > 0 ? charts.spendingByCategory : [{ color: "rgba(148,163,184,0.25)" }]).map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [charts.spendingByCategory.length > 0 ? format(value) : format(0), name]}
                contentStyle={{ background: bgTip, border: `1px solid ${borTip}`, borderRadius: 12 }}
                itemStyle={{ color: txtTip }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-5">
          <h3 className="text-sm font-semibold t1">{t("transactions.source_label")}</h3>
          <p className="text-xs t2 mt-0.5">{t("dashboard.income_vs_expenses")}</p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={charts.sourceBreakdown} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="source" tick={{ fontSize: 11, fill: tick }} tickLine={false} axisLine={false} tickFormatter={(source) => t(`transactions.source_${source}`)} />
            <YAxis tick={{ fontSize: 11, fill: tick }} tickLine={false} axisLine={false} tickFormatter={(v) => format(Number(v))} />
            <Tooltip
              formatter={(value: number) => format(value)}
              labelFormatter={(source) => t(`transactions.source_${source}`)}
              contentStyle={{ background: bgTip, border: `1px solid ${borTip}`, borderRadius: 12 }}
              labelStyle={{ color: txtTip, fontSize: 12 }}
              itemStyle={{ color: txtTip }}
            />
            <Bar dataKey="income" name={t("transactions.income")} fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name={t("transactions.expense")} fill="#F43F5E" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Debts summary */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full bg-orange-400" />
            <h3 className="text-sm font-semibold t1">{t("debts.title")}</h3>
          </div>
          <Row label={t("debts.payable")}       value={format(debts.total_payable)}    tone="text-rose-400"    />
          <Row label={t("debts.receivable")}     value={format(debts.total_receivable)} tone="text-emerald-400" />
          <Row label={t("debts.total_paid")}     value={format(debts.total_paid)}       tone="text-cyan-400"    />
          {debts.overdue_debts > 0 && (
            <Row label={t("debts.status.overdue")} value={String(debts.overdue_debts)} tone="text-rose-400" />
          )}
        </div>

        {/* Investments summary */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full bg-purple-400" />
            <h3 className="text-sm font-semibold t1">{t("investments.title")}</h3>
          </div>
          <Row label={t("investments.total_invested")} value={format(investments.total_invested)} />
          <Row label={t("investments.current_value")}  value={format(investments.current_value)} tone="text-purple-400" />
          <Row label={t("investments.profit_loss")}    value={format(investments.profit_loss)}
            tone={investments.profit_loss >= 0 ? "text-emerald-400" : "text-rose-400"} />
        </div>

        {/* Work summary */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full bg-cyan-400" />
            <h3 className="text-sm font-semibold t1">{t("work.title")}</h3>
          </div>
          <Row label={t("work.hours_worked")}    value={`${work.hours_this_month.toFixed(1)}h`} />
          <Row label={t("work.income_expected")} value={format(work.expected_work_income)}  tone="text-amber-400" />
          <Row label={t("work.income_received")} value={format(work.received_work_income)}  tone="text-emerald-400" />
          {work.unpaid_work_balance > 0 && (
            <Row label={t("work.unpaid_balance")} value={format(work.unpaid_work_balance)} tone="text-rose-400" />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-xs t2">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${tone ?? "t1"}`}>{value}</span>
    </div>
  );
}
