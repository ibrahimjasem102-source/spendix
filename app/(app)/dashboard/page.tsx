"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { useGuest } from "@/contexts/GuestContext";
import { useCurrency } from "@/lib/currency";
import { getGuestTransactions } from "@/lib/guest/storage";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useDashboardSummary, useTransactions } from "@/lib/query/hooks";
import { useFinancialEngine } from "@/lib/finance/engine";
import { fadeBlur, spring, staggerContainer, staggerItem } from "@/lib/motion";
import AICopilot from "@/components/dashboard/AICopilot";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import type { Transaction, TransactionSource } from "@/types";

const SpendingLineChart = dynamic(() => import("@/components/dashboard/SpendingLineChart"), {
  loading: () => <div className="card h-[260px] animate-pulse" />,
});
const CategoryDonut = dynamic(() => import("@/components/dashboard/CategoryDonut"), {
  loading: () => <div className="card h-[260px] animate-pulse" />,
});
const IncomeExpenseBar = dynamic(() => import("@/components/dashboard/IncomeExpenseBar"), {
  loading: () => <div className="card h-[260px] animate-pulse" />,
});

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

interface DashboardAnalytics {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  dailyBurn: number;
  workIncome: number;
  transactionCount: number;
  recentTransactions: Transaction[];
  spendingByCategory: CategorySpend[];
  incomeVsExpenses: IncomeExpensePoint[];
  monthlyCashflow: CashflowPoint[];
  sourceBreakdown: Array<{
    source: TransactionSource;
    label: string;
    income: number;
    expenses: number;
    total: number;
    count: number;
    color: string;
  }>;
  debtTruth: {
    total_payable_remaining: number;
    total_receivable_remaining: number;
    net_debt_exposure: number;
    debt_recovery_rate: number;
    overdue_ratio: number;
    active_debts: number;
    overdue_debts: number;
  };
  hasTransactions: boolean;
}

const EMPTY_DASHBOARD: DashboardAnalytics = {
  totalBalance: 0,
  monthlyIncome: 0,
  monthlyExpenses: 0,
  savingsRate: 0,
  dailyBurn: 0,
  workIncome: 0,
  transactionCount: 0,
  recentTransactions: [],
  spendingByCategory: [],
  incomeVsExpenses: [],
  monthlyCashflow: [],
  sourceBreakdown: [],
  debtTruth: {
    total_payable_remaining: 0,
    total_receivable_remaining: 0,
    net_debt_exposure: 0,
    debt_recovery_rate: 0,
    overdue_ratio: 0,
    active_debts: 0,
    overdue_debts: 0,
  },
  hasTransactions: false,
};

const CATEGORY_COLORS = ["#06B6D4", "#10B981", "#F43F5E", "#8B5CF6", "#F59E0B", "#EC4899"];

// ── Smart Insight Card ────────────────────────────────────────
function SmartInsightCard({
  savingsRate, dailyBurn, monthlyIncome, overdueDebts, workIncome, format, t,
}: {
  savingsRate: number; dailyBurn: number; monthlyIncome: number;
  overdueDebts: number; workIncome: number; format: (n: number) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const insight = (() => {
    if (overdueDebts > 0)
      return { msg: t("dashboard.insight_overdue", { count: overdueDebts }), Icon: AlertTriangle, color: "text-rose-300", bg: "bg-rose-400/10", border: "border-rose-400/20" };
    if (monthlyIncome > 0 && dailyBurn > monthlyIncome / 25)
      return { msg: t("dashboard.insight_daily_burn", { amount: format(dailyBurn) }), Icon: BarChart3, color: "text-amber-300", bg: "bg-amber-400/10", border: "border-amber-400/20" };
    if (savingsRate >= 25)
      return { msg: t("dashboard.insight_strong_savings", { rate: savingsRate }), Icon: CheckCircle2, color: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/20" };
    if (savingsRate >= 10)
      return { msg: t("dashboard.insight_ok_savings", { rate: savingsRate }), Icon: Lightbulb, color: "text-cyan-300", bg: "bg-cyan-400/10", border: "border-cyan-400/20" };
    if (savingsRate < 10 && monthlyIncome > 0)
      return { msg: t("dashboard.insight_low_savings", { rate: savingsRate }), Icon: TrendingDown, color: "text-amber-300", bg: "bg-amber-400/10", border: "border-amber-400/20" };
    if (workIncome > 0)
      return { msg: t("dashboard.insight_work_income", { amount: format(workIncome) }), Icon: Briefcase, color: "text-purple-300", bg: "bg-purple-400/10", border: "border-purple-400/20" };
    return { msg: t("dashboard.insight_empty"), Icon: Lightbulb, color: "text-cyan-300", bg: "bg-cyan-400/10", border: "border-cyan-400/20" };
  })();
  const Icon = insight.Icon;

  return (
    <div className={`modern-card border ${insight.border} ${insight.bg} p-4`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/15 ${insight.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--text-3))]">
            {t("dashboard.financial_health")}
          </p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-[hsl(var(--text-1))]">{insight.msg}</p>
        </div>
      </div>
    </div>
  );
}

function useGreeting(t: (key: string) => string, userName?: string) {
  const hour = new Date().getHours();
  const base =
    hour < 12 ? t("dashboard.good_morning") :
    hour < 17 ? t("dashboard.good_afternoon") :
                t("dashboard.good_evening");
  return userName ? `${base}, ${userName}` : base;
}

function Spark({ data, color = "#06B6D4" }: { data: number[]; color?: string }) {
  const safe = data.length > 0 ? data : [0, 0, 0, 0, 0, 0];
  const points = safe.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={28}>
      <LineChart data={points}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} activeDot={false} strokeOpacity={0.9} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="skeleton h-8 w-48 mb-1" />
      <div className="skeleton h-44 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
      <div className="skeleton h-56 rounded-2xl" />
    </div>
  );
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildGuestDashboard(transactions: Transaction[]): DashboardAnalytics {
  if (transactions.length === 0) return EMPTY_DASHBOARD;

  const now = new Date();
  const monthStart = dateOnly(new Date(now.getFullYear(), now.getMonth(), 1));
  const nextMonth = dateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const inCurrentMonth = (tx: Transaction) => tx.transaction_date >= monthStart && tx.transaction_date < nextMonth;
  const sum = (items: Transaction[]) => items.reduce((total, tx) => total + Number(tx.amount || 0), 0);

  const allIncome = sum(transactions.filter((tx) => tx.type === "income"));
  const allExpenses = sum(transactions.filter((tx) => tx.type === "expense"));
  const monthlyIncome = sum(transactions.filter((tx) => tx.type === "income" && inCurrentMonth(tx)));
  const monthlyExpenses = sum(transactions.filter((tx) => tx.type === "expense" && inCurrentMonth(tx)));

  const categoryMap = new Map<string, CategorySpend>();
  transactions.filter((tx) => tx.type === "expense" && inCurrentMonth(tx)).forEach((tx) => {
    const name = tx.category?.name || "Uncategorized";
    const existing = categoryMap.get(name);
    categoryMap.set(name, {
      name,
      value: (existing?.value ?? 0) + Number(tx.amount || 0),
      color: tx.category?.color || existing?.color || CATEGORY_COLORS[categoryMap.size % CATEGORY_COLORS.length],
    });
  });

  const monthlyCashflow = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (29 - index));
    const key = dateOnly(date);
    return {
      day: date.getDate(),
      date: key,
      amount: sum(transactions.filter((tx) => tx.type === "expense" && tx.transaction_date === key)),
    };
  });

  const incomeVsExpenses = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const start = dateOnly(date);
    const end = dateOnly(new Date(date.getFullYear(), date.getMonth() + 1, 1));
    const income = sum(transactions.filter((tx) => tx.type === "income" && tx.transaction_date >= start && tx.transaction_date < end));
    const expenses = sum(transactions.filter((tx) => tx.type === "expense" && tx.transaction_date >= start && tx.transaction_date < end));
    return { month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, income, expenses, savings: income - expenses };
  });

  return {
    ...EMPTY_DASHBOARD,
    totalBalance: allIncome - allExpenses,
    monthlyIncome,
    monthlyExpenses,
    savingsRate: monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0,
    dailyBurn: monthlyCashflow.reduce((total, point) => total + point.amount, 0) / monthlyCashflow.length,
    workIncome: sum(transactions.filter((tx) => tx.source === "work_payment")),
    transactionCount: transactions.length,
    recentTransactions: [...transactions].sort((a, b) => (b.created_at || b.transaction_date).localeCompare(a.created_at || a.transaction_date)).slice(0, 10),
    spendingByCategory: [...categoryMap.values()].sort((a, b) => b.value - a.value),
    incomeVsExpenses,
    monthlyCashflow,
    hasTransactions: true,
  };
}

export default function DashboardPage() {
  const { isGuest, isLoading } = useGuest();
  const { t, locale } = useTranslation();
  const { format } = useCurrency();

  const [dashboard, setDashboard] = useState<DashboardAnalytics>(EMPTY_DASHBOARD);
  const [userName, setUserName]   = useState<string>("");
  const dashboardQuery = useDashboardSummary(!isGuest && !isLoading);
  const engine = useFinancialEngine();

  // Live transactions from React Query cache — updates immediately via optimistic updates
  const { data: liveTransactions = [] } = useTransactions(isGuest, !isLoading);

  const loadGuestDashboard = useCallback(() => {
    if (isGuest) setDashboard(buildGuestDashboard(getGuestTransactions()));
  }, [isGuest]);

  useEffect(() => { if (!isLoading) loadGuestDashboard(); }, [isLoading, loadGuestDashboard]);

  // Fetch user's display name from profile_settings or auth metadata
  useEffect(() => {
    if (isGuest) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      // Try profile_settings first, fall back to auth metadata
      supabase
        .from("profile_settings")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          const name =
            data?.full_name?.trim() ||
            (user.user_metadata?.full_name as string | undefined)?.trim() ||
            "";
          if (name) setUserName(name);
        });
    });
  }, [isGuest]);

  const activeDashboard = (isGuest ? dashboard : dashboardQuery.data) as DashboardAnalytics | undefined;

  // Merge live transactions into dashboard — ensures newly added transactions appear instantly
  const currentDashboard = useMemo((): DashboardAnalytics => {
    const base = activeDashboard ?? EMPTY_DASHBOARD;
    if (!liveTransactions.length) return base;
    // Use live transactions for recent list (shows optimistic updates immediately)
    const recent = [...liveTransactions]
      .sort((a, b) => (b.created_at ?? b.transaction_date).localeCompare(a.created_at ?? a.transaction_date))
      .slice(0, 10);
    return { ...base, recentTransactions: recent, hasTransactions: liveTransactions.length > 0 };
  }, [activeDashboard, liveTransactions]);

  const greeting = useGreeting(t, userName || undefined);
  const dateLocale = locale === "ar" ? "ar" : locale === "de" ? "de-DE" : "en-US";
  const sparkFromCashflow = useMemo(() => currentDashboard.monthlyCashflow.slice(-7).map((point) => point.amount), [currentDashboard.monthlyCashflow]);
  const investmentSpend = useMemo(
    () => currentDashboard.sourceBreakdown.find((item) => item.source === "investment")?.expenses ?? 0,
    [currentDashboard.sourceBreakdown]
  );

  if (isLoading || (!isGuest && dashboardQuery.isLoading)) return <DashSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6 pb-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] sm:text-xs font-semibold t3 uppercase tracking-[0.12em] mb-0.5">
            {new Date().toLocaleDateString(dateLocale, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold t1">{greeting}</h1>
        </div>
      </div>

      {!currentDashboard.hasTransactions && (
        <div className="card p-5 border-cyan-400/20 bg-cyan-400/5">
          <p className="text-sm font-semibold t1">{t("common.no_data")}</p>
          <p className="text-xs t2 mt-1">{t("ai_insights.no_data_body")}</p>
          <Link href="/transactions" className="inline-flex mt-3 text-xs font-medium text-cyan-400 hover:text-cyan-300">
            {t("transactions.add")}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { href: "/transactions", label: t("transactions.add"), Icon: Plus, tone: "text-cyan-300 bg-cyan-400/10" },
          { href: "/analytics", label: t("nav.analytics"), Icon: BarChart3, tone: "text-blue-300 bg-blue-400/10" },
          { href: "/budgets", label: t("nav.budgets"), Icon: Wallet, tone: "text-emerald-300 bg-emerald-400/10" },
          { href: "/ai-insights", label: t("nav.ai_insights"), Icon: Lightbulb, tone: "text-purple-300 bg-purple-400/10" },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="quick-card">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
              <item.Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold t1 leading-tight">{item.label}</span>
          </Link>
        ))}
      </div>

      <motion.div
        variants={fadeBlur}
        initial="hidden"
        animate="visible"
        transition={{ ...spring, delay: 0.05 }}
        className="modern-card relative overflow-hidden rounded-[24px] p-5 sm:p-7"
        style={{
          background: engine.balance >= 0
            ? "linear-gradient(135deg, rgba(6,182,212,0.28) 0%, rgba(16,185,129,0.16) 42%, rgba(124,58,237,0.13) 100%)"
            : "linear-gradient(135deg, rgba(244,63,94,0.26) 0%, rgba(245,158,11,0.12) 42%, rgba(124,58,237,0.12) 100%)",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_30%),linear-gradient(180deg,rgba(11,15,20,0.08),rgba(11,15,20,0.35))]" />
        <div className="relative z-10">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-[0.15em] mb-2">
            {t("dashboard.total_balance")}
          </p>
          <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight number-display mb-3 sm:mb-4">
            {format(engine.balance)}
          </p>

          <div className="grid grid-cols-1 gap-2 pt-4 sm:grid-cols-3 sm:border-t sm:border-white/10">
            <Link href="/transactions?filter=monthly_income" className="group flex-1 rounded-2xl bg-white/5 p-3 transition-colors hover:bg-white/10">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{t("dashboard.monthly_income")}</p>
              <p className="text-sm font-bold text-emerald-300 group-hover:text-emerald-200 transition-colors">
                +{format(engine.monthlyIncome)}
              </p>
            </Link>
            <Link href="/transactions?filter=monthly_expenses" className="group flex-1 rounded-2xl bg-white/5 p-3 transition-colors hover:bg-white/10">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{t("dashboard.monthly_expenses")}</p>
              <p className="text-sm font-bold text-rose-300 group-hover:text-rose-200 transition-colors">
                -{format(engine.monthlyExpenses)}
              </p>
            </Link>
            <div className="flex-1 rounded-2xl bg-white/5 p-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{t("dashboard.savings_rate")}</p>
              <p className="text-sm font-bold text-white">{engine.monthlySavingsRate}%</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div>
        <div className="section-head">
          <div className="section-head-bar" />
          <h2 className="section-head-title">{t("nav.debts")}</h2>
          <Link href="/debts" className="section-head-action">
            {t("common.view_all")} <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3"
        >
          {[
            {
              label: t("relationship.total_receivables"),
              value: format(engine.debtReceivable),
              color: "text-emerald-400",
            },
            {
              label: t("relationship.total_payables"),
              value: format(engine.debtPayable),
              color: "text-rose-400",
            },
            {
              label: t("relationship.net_debt_exposure"),
              value: format(engine.netDebt),
              color: engine.netDebt >= 0 ? "text-cyan-400" : "text-amber-400",
            },
            {
              label: t("relationship.debt_recovery_rate"),
              value: `${Math.round(engine.debtRecoveryRate)}%`,
              color: engine.overdueDebtsCount > 0 ? "text-amber-400" : "text-purple-400",
            },
          ].map((item) => (
            <motion.div key={item.label} variants={staggerItem} className="metric-tile p-3 sm:p-4">
              <p className="text-[9px] sm:text-[10px] t3 uppercase tracking-wide font-semibold leading-tight">{item.label}</p>
              <p className={`text-base sm:text-lg font-bold number-display mt-1 ${item.color}`}>{item.value}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── Smart Insight Card (replaces 4-widget grid) ──── */}
      {currentDashboard.hasTransactions && (
        <SmartInsightCard
          savingsRate={engine.monthlySavingsRate}
          dailyBurn={currentDashboard.dailyBurn}
          monthlyIncome={engine.monthlyIncome}
          overdueDebts={engine.overdueDebtsCount}
          workIncome={engine.workIncome}
          format={format}
          t={t}
        />
      )}

      {/* ── Charts (collapsible) ──────────────────────── */}
      <div className="card p-4 sm:p-5">
        <div className="section-head">
          <div className="section-head-bar" />
          <h2 className="section-head-title">{t("dashboard.income_vs_expenses")}</h2>
        </div>
        <CollapsibleSection title="" storageKey="dash_charts" defaultOpen={true}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><SpendingLineChart data={currentDashboard.monthlyCashflow} /></div>
            <CategoryDonut data={currentDashboard.spendingByCategory} />
          </div>
          <div className="mt-4">
            <IncomeExpenseBar data={currentDashboard.incomeVsExpenses} />
          </div>
        </CollapsibleSection>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 card p-4 sm:p-5">
          <CollapsibleSection
            title={t("dashboard.recent_transactions")}
            badge={currentDashboard.recentTransactions.length}
            storageKey="dash_recent"
            action={
              <Link href="/transactions" className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5">
                {t("common.view_all")}<ChevronRight className="w-3 h-3" />
              </Link>
            }
          >

          {currentDashboard.recentTransactions.length === 0 ? (
            <div className="empty-state py-8">
              <div className="empty-state-icon"><Wallet className="w-5 h-5 t3" /></div>
              <p className="empty-state-title">{t("common.no_data")}</p>
              <Link href="/transactions" className="text-xs text-cyan-400 hover:underline mt-1">
                {t("transactions.add")}
              </Link>
            </div>
          ) : (
            <div className="space-y-0.5">
              {currentDashboard.recentTransactions.map((tx) => {
                const src = tx.source as string;
                const srcColor =
                  src === "investment" ? "bg-purple-400/10 text-purple-400" :
                  src === "debt" ? "bg-orange-400/10 text-orange-400" :
                  src === "debt_payment" ? "bg-amber-400/10 text-amber-400" :
                  src === "work_payment" ? "bg-cyan-400/10 text-cyan-400" :
                  tx.type === "income" ? "bg-emerald-400/10 text-emerald-400" :
                                         "bg-rose-400/10 text-rose-400";
                return (
                  <div key={tx.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[hsl(var(--bg-input))] transition-all pressable">
                    <div className={`p-1.5 rounded-lg shrink-0 ${srcColor}`}>
                      {tx.type === "income"
                        ? <ArrowUpRight className="w-3.5 h-3.5" />
                        : <ArrowDownRight className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium t1 truncate">{tx.title}</p>
                      <p className="text-[10px] t3">
                        {tx.category?.name && <span className="me-1.5">{tx.category.name}</span>}
                        {new Date(`${tx.transaction_date}T00:00:00`).toLocaleDateString(dateLocale)}
                      </p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                      {tx.type === "income" ? "+" : "-"}{format(Number(tx.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          </CollapsibleSection>
        </div>

        <div className="lg:col-span-2">
          <AICopilot
            totalBalance={currentDashboard.totalBalance}
            monthlyIncome={currentDashboard.monthlyIncome}
            monthlyExpenses={currentDashboard.monthlyExpenses}
            savingsRate={currentDashboard.savingsRate}
            dailyBurn={currentDashboard.dailyBurn}
            workIncome={currentDashboard.workIncome}
            debtTruth={currentDashboard.debtTruth}
            hasTransactions={currentDashboard.hasTransactions}
            currency={format}
          />
        </div>
      </div>
    </div>
  );
}
