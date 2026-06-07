"use client";

import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, ChevronRight,
  Landmark, TrendingUp, TrendingDown,
  Wallet, Target, BrainCircuit, Zap,
  CreditCard, ReceiptText, Activity,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useGoals } from "@/lib/query/hooks";
import { useFinancialEngine } from "@/lib/finance/engine";
import { useLocalInsights } from "@/lib/ai/localInsights";
import { fadeBlur, spring } from "@/lib/motion";
import GoalMilestonesProgress from "@/components/goals/GoalMilestonesProgress";
import type { Transaction } from "@/types";

// ── Error boundary ─────────────────────────────────────────────

class WidgetBoundary extends Component<{ name: string; children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e: Error, i: ErrorInfo) {
    if (process.env.NODE_ENV === "development") console.error(`[Dashboard:${this.props.name}]`, e.message, i.componentStack);
  }
  render() {
    if (this.state.err) return (
      <div className="card p-3 border-rose-400/20 bg-rose-400/5">
        <p className="text-[11px] text-rose-400 font-semibold">⚠ {this.props.name} — temporarily unavailable</p>
      </div>
    );
    return this.props.children;
  }
}

// ── Helpers ────────────────────────────────────────────────────

function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${dateStr}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

function useGreeting(t: (k: string) => string, name?: string) {
  const h    = new Date().getHours();
  const base = h < 12 ? t("dashboard.good_morning") : h < 17 ? t("dashboard.good_afternoon") : t("dashboard.good_evening");
  return name ? `${base}، ${name}` : base;
}

function buildChartData(transactions: Transaction[]) {
  const now = new Date();
  const year = now.getFullYear(); const month = now.getMonth(); const today = now.getDate();
  return Array.from({ length: today }, (_, i) => {
    const d   = i + 1;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const slot = { day: String(d), income: 0, expenses: 0 };
    for (const tx of transactions) {
      if (tx.transaction_date === key) {
        if (tx.type === "income")  slot.income   += Number(tx.amount);
        if (tx.type === "expense") slot.expenses += Number(tx.amount);
      }
    }
    return slot;
  });
}

// ── Skeleton ───────────────────────────────────────────────────

function DashSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="skeleton h-7 w-44 rounded-xl" />
      <div className="skeleton h-52 w-full rounded-[24px]" />
      <div className="grid grid-cols-4 gap-2">
        {[0,1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[0,1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
      </div>
      <div className="skeleton h-36 w-full rounded-2xl" />
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────

function SectionHeader({
  icon: Icon, title, href, color = "text-cyan-400",
}: { icon: React.ElementType; title: string; href?: string; color?: string }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <h2 className="text-sm font-bold t1">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

// ── Tooltip ────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, format }: {
  active?: boolean; payload?: { value: number }[]; label?: string; format: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-2.5 text-xs shadow-xl border border-[hsl(var(--border-2))]">
      <p className="t3 mb-1.5 font-semibold">{label}</p>
      {(payload[0]?.value ?? 0) > 0 && <p className="text-emerald-400 font-bold">+{format(payload[0].value)}</p>}
      {(payload[1]?.value ?? 0) > 0 && <p className="text-rose-400 font-bold">−{format(payload[1].value)}</p>}
    </div>
  );
}

// ── DueBadge ───────────────────────────────────────────────────

function DueBadge({ days }: { days: number }) {
  const { t } = useTranslation();
  if (days < 0)   return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-400/15 text-rose-400">{t("dashboard.overdue")}</span>;
  if (days === 0) return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400/15 text-amber-400">{t("dashboard.due_today")}</span>;
  return <span className="text-[10px] t3">{t("dashboard.due_in_days", { days })}</span>;
}

// ── Main ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t, locale }  = useTranslation();
  const { format }     = useCurrency();
  const [userName, setUserName] = useState("");

  const engine   = useFinancialEngine();
  const { data: goals = [] } = useGoals(true);
  const { insights: aiInsights } = useLocalInsights();

  const transactions = engine.transactions;
  const debts        = engine.debts;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const metaName = (user.user_metadata?.full_name || user.user_metadata?.name) as string | undefined;
      if (metaName?.trim()) { setUserName(metaName.trim()); return; }
      supabase.from("profile_settings").select("full_name").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => { if (data?.full_name?.trim()) setUserName(data.full_name.trim()); });
    });
  }, []);

  const greeting    = useGreeting(t, userName || undefined);
  const dateLocale  = locale === "ar" ? "ar" : locale === "de" ? "de-DE" : "en-US";
  const isRtl       = locale === "ar";
  const netWorth    = engine.balance + engine.portfolioValue + engine.debtReceivable - engine.debtPayable;
  const nwPositive  = netWorth >= 0;
  const monthNet    = engine.monthlyIncome - engine.monthlyExpenses;

  const chartData  = useMemo(() => buildChartData(transactions), [transactions]);
  const hasChart   = chartData.some(d => d.income > 0 || d.expenses > 0);

  const nextDebt = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return debts
      .filter(d => d.debt_type === "payable" && d.status !== "paid" && !!d.due_date && d.due_date >= today)
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0] ?? null;
  }, [debts]);

  const topGoals = useMemo(() =>
    goals.filter(g => g.status !== "completed")
      .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
      .slice(0, 3),
    [goals],
  );

  const goalsOverall = useMemo(() => {
    const active = goals.filter(g => g.status !== "completed");
    if (!active.length) return goals.length ? 100 : 0;
    const total = active.reduce((s, g) => s + (g.target_amount ?? 0), 0);
    const saved = active.reduce((s, g) => s + (g.computed_saved ?? 0), 0);
    return total > 0 ? Math.min(100, Math.round((saved / total) * 100)) : 0;
  }, [goals]);

  const recent = useMemo(() =>
    [...transactions]
      .sort((a, b) => (b.created_at ?? b.transaction_date).localeCompare(a.created_at ?? a.transaction_date))
      .slice(0, 5),
    [transactions],
  );

  if (engine.isLoading) return <DashSkeleton />;

  // ── Wealth tiles ───────────────────────────────────────────

  const wealthTiles = [
    { label: t("dashboard.cash"),       value: format(engine.balance),        icon: Wallet,        color: "text-cyan-400",    bg: "bg-cyan-400/10",    href: "/accounts"    },
    { label: t("dashboard.portfolio"),  value: format(engine.portfolioValue),  icon: engine.portfolioGain >= 0 ? TrendingUp : TrendingDown,
      color: engine.portfolioGain >= 0 ? "text-emerald-400" : "text-rose-400",
      bg:    engine.portfolioGain >= 0 ? "bg-emerald-400/10" : "bg-rose-400/10",
      sub:   engine.investedTotal > 0 ? `${engine.portfolioGain >= 0 ? "+" : ""}${engine.portfolioGainPct.toFixed(1)}%` : undefined,
      href:  "/investments",
    },
    { label: t("dashboard.debt"),       value: format(engine.debtPayable),     icon: Landmark,      color: engine.debtPayable > 0 ? "text-rose-400"  : "text-gray-400",
      bg: engine.debtPayable > 0 ? "bg-rose-400/10" : "bg-gray-400/10",
      sub: engine.overdueDebtsCount > 0 ? `${engine.overdueDebtsCount} ${t("dashboard.overdue").toLowerCase()}` : undefined,
      href: "/debts",
    },
    { label: t("dashboard.receivable"), value: format(engine.debtReceivable),  icon: ArrowUpRight,  color: "text-amber-400",   bg: "bg-amber-400/10",   href: "/debts"       },
  ] as { label: string; value: string; icon: React.ElementType; color: string; bg: string; sub?: string; href: string }[];

  return (
    <div className="space-y-3">

      {/* ── Greeting ──────────────────────────────────────────── */}
      <div className="pt-0.5">
        <p className="text-[10px] font-semibold t3 uppercase tracking-[0.14em] mb-0.5">
          {new Date().toLocaleDateString(dateLocale, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-xl font-black t1">{greeting}</h1>
      </div>

      {/* ── Net Worth Hero ─────────────────────────────────────── */}
      <WidgetBoundary name="Net Worth">
        <motion.div
          variants={fadeBlur} initial="hidden" animate="visible"
          transition={{ ...spring, delay: 0.04 }}
          className="relative overflow-hidden rounded-[24px] p-5"
          style={{
            background: nwPositive
              ? "linear-gradient(135deg,rgba(16,185,129,.18) 0%,rgba(6,182,212,.12) 45%,rgba(124,58,237,.10) 100%)"
              : "linear-gradient(135deg,rgba(244,63,94,.20) 0%,rgba(245,158,11,.10) 45%,rgba(124,58,237,.09) 100%)",
            backdropFilter: "blur(32px) saturate(200%)",
            WebkitBackdropFilter: "blur(32px) saturate(200%)",
            border: "1px solid rgba(255,255,255,.11)",
            boxShadow: "0 1px 0 rgba(255,255,255,.10) inset, 0 16px 48px rgba(0,0,0,.30)",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_5%,rgba(255,255,255,.08),transparent_45%)]" />
          <div className="relative z-10">

            {/* Label + link */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">{t("dashboard.net_worth")}</p>
              </div>
              <Link href="/net-worth" className="text-[10px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-0.5">
                {t("common.view_all")} <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Big number */}
            <p className={`text-5xl font-black tracking-tight number-display leading-none mb-1 ${nwPositive ? "text-white" : "text-rose-300"}`}>
              {nwPositive ? "" : "−"}{format(Math.abs(netWorth))}
            </p>

            {/* Month delta */}
            <div className="flex items-center gap-2 mb-5">
              <span className={`flex items-center gap-1 text-xs font-semibold ${monthNet >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {monthNet >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {monthNet >= 0 ? "+" : ""}{format(monthNet)}
              </span>
              <span className="text-[10px] text-white/35">{t("dashboard.this_month_net")}</span>
              {engine.monthlySavingsRate > 0 && (
                <>
                  <span className="text-white/20">·</span>
                  <span className={`text-[10px] font-bold ${
                    engine.monthlySavingsRate >= 20 ? "text-emerald-300"
                    : engine.monthlySavingsRate >= 10 ? "text-white/60"
                    : "text-amber-300"
                  }`}>{engine.monthlySavingsRate}% {t("dashboard.savings_rate").toLowerCase()}</span>
                </>
              )}
            </div>

            {/* 3 pillars */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/10">
              {[
                { label: t("dashboard.monthly_income"),   value: `+${format(engine.monthlyIncome)}`,   cls: "text-emerald-300", href: "/transactions" },
                { label: t("dashboard.monthly_expenses"),  value: `−${format(engine.monthlyExpenses)}`, cls: "text-rose-300",    href: "/transactions" },
                {
                  label: `${t("dashboard.goals_progress")}${goals.length > 0 ? ` (${goals.filter(g => g.status !== "completed").length})` : ""}`,
                  value: `${goalsOverall}%`,
                  cls: goalsOverall >= 60 ? "text-emerald-300" : goalsOverall >= 30 ? "text-cyan-200" : "text-amber-300",
                  href: "/goals",
                },
              ].map(({ label, value, cls, href }) => (
                <Link key={label} href={href}
                  className="rounded-xl bg-white/6 p-2.5 hover:bg-white/10 transition-colors">
                  <p className="text-[9px] text-white/40 uppercase tracking-wide leading-tight mb-0.5">{label}</p>
                  <p className={`text-sm font-bold number-display truncate ${cls}`}>{value}</p>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </WidgetBoundary>

      {/* ── Quick Actions ──────────────────────────────────────── */}
      <motion.div
        variants={fadeBlur} initial="hidden" animate="visible"
        transition={{ ...spring, delay: 0.07 }}
        className="grid grid-cols-4 gap-2"
      >
        {([
          { icon: ArrowDownRight, label: t("transactions.expense"), color: "text-rose-400",    bg: "bg-rose-400/10",    action: () => window.dispatchEvent(new CustomEvent("spendix:toggle-fab")) },
          { icon: ArrowUpRight,   label: t("transactions.income"),  color: "text-emerald-400", bg: "bg-emerald-400/10", action: () => window.dispatchEvent(new CustomEvent("spendix:toggle-fab")) },
          { icon: Target,         label: t("nav.goals"),            color: "text-indigo-400",  bg: "bg-indigo-400/10",  href: "/goals"    },
          { icon: CreditCard,     label: t("nav.debts"),            color: "text-orange-400",  bg: "bg-orange-400/10",  href: "/debts"    },
        ] as { icon: React.ElementType; label: string; color: string; bg: string; action?: () => void; href?: string }[]).map(({ icon: Icon, label, color, bg, action, href }) =>
          href ? (
            <Link key={label} href={href}
              className="card flex flex-col items-center gap-1.5 py-3 hover:scale-[1.03] transition-transform active:scale-95">
              <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <span className="text-[10px] font-semibold t3 text-center leading-tight">{label}</span>
            </Link>
          ) : (
            <button key={label} type="button" onClick={action}
              className="card flex flex-col items-center gap-1.5 py-3 hover:scale-[1.03] transition-transform active:scale-95">
              <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <span className="text-[10px] font-semibold t3 text-center leading-tight">{label}</span>
            </button>
          )
        )}
      </motion.div>

      {/* ── Recent Transactions ────────────────────────────────── */}
      <WidgetBoundary name="Recent Transactions">
        {recent.length > 0 && (
          <motion.div
            variants={fadeBlur} initial="hidden" animate="visible"
            transition={{ ...spring, delay: 0.10 }}
            className="card overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2.5">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-3.5 h-3.5 text-cyan-400" />
                <h2 className="text-sm font-bold t1">{t("dashboard.recent_transactions")}</h2>
              </div>
              <Link href="/transactions"
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors">
                {t("common.view_all")} <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div>
              {recent.map((tx) => (
                <div key={tx.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-t border-[hsl(var(--border-2))] hover:bg-[hsl(var(--bg-input))] transition-colors">
                  <div className={`p-1.5 rounded-lg shrink-0 ${tx.type === "income" ? "bg-emerald-400/10" : "bg-rose-400/10"}`}>
                    {tx.type === "income"
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                      : <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium t1 truncate">{tx.title}</p>
                    <p className="text-[10px] t3">
                      {tx.category?.name && <span className="me-1.5">{tx.category.name}</span>}
                      {tx.transaction_date
                        ? new Date(`${tx.transaction_date}T00:00:00`).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })
                        : ""}
                    </p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums shrink-0 ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                    {tx.type === "income" ? "+" : "−"}{format(Number(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </WidgetBoundary>

      {/* ── Cashflow Chart ─────────────────────────────────────── */}
      <WidgetBoundary name="Chart">
        {hasChart && (
          <motion.div
            variants={fadeBlur} initial="hidden" animate="visible"
            transition={{ ...spring, delay: 0.13 }}
            className="card p-4"
          >
            <SectionHeader icon={Activity} title={t("dashboard.monthly_chart")} color="text-cyan-400" />
            <div className="flex items-center gap-3 text-[10px] t3 mb-3 -mt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />{t("transactions.income")}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />{t("transactions.expense")}</span>
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,.25)", fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip format={format} />} />
                <Area type="monotone" dataKey="income"   stroke="#10B981" strokeWidth={1.5} fill="url(#incGrad)" dot={false} />
                <Area type="monotone" dataKey="expenses" stroke="#F43F5E" strokeWidth={1.5} fill="url(#expGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </WidgetBoundary>

      {/* ── Wealth Breakdown ───────────────────────────────────── */}
      <WidgetBoundary name="Wealth Breakdown">
        <motion.div
          variants={fadeBlur} initial="hidden" animate="visible"
          transition={{ ...spring, delay: 0.16 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] t3 mb-2 px-1">{t("dashboard.wealth_breakdown")}</p>
          <div className="grid grid-cols-2 gap-2">
            {wealthTiles.map(({ label, value, icon: Icon, color, bg, sub, href }) => (
              <Link key={label} href={href} className="card p-3.5 hover:scale-[1.02] transition-transform active:scale-95">
                <div className={`p-1.5 rounded-lg w-fit ${bg} mb-2`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <p className="text-[10px] t3 leading-tight mb-0.5">{label}</p>
                <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
                {sub && <p className={`text-[10px] mt-0.5 ${color} opacity-70`}>{sub}</p>}
              </Link>
            ))}
          </div>
        </motion.div>
      </WidgetBoundary>

      {/* ── Goals Progress ─────────────────────────────────────── */}
      <WidgetBoundary name="Goals">
        <motion.div
          variants={fadeBlur} initial="hidden" animate="visible"
          transition={{ ...spring, delay: 0.19 }}
          className="card p-4"
        >
          <SectionHeader icon={Target} title={t("dashboard.goals_progress")} href="/goals" color="text-amber-400" />
          {topGoals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-amber-400 opacity-50" />
              </div>
              <p className="text-xs t3">{t("goals.empty_body")}</p>
              <Link href="/goals" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                {t("goals.new_goal")} →
              </Link>
            </div>
          ) : (
            <div className="space-y-3.5">
              {topGoals.map((goal) => {
                const pct = Math.min(100, Math.round(goal.progress ?? 0));
                return (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold t1 truncate max-w-[65%]">{goal.title}</p>
                      <span className="text-xs font-bold tabular-nums" style={{ color: goal.color ?? undefined }}>{pct}%</span>
                    </div>
                    <GoalMilestonesProgress
                      milestones={goal.milestones}
                      targetAmount={goal.target_amount}
                      currentAmount={goal.computed_saved ?? 0}
                      progress={pct}
                      color={goal.color}
                      isRtl={isRtl}
                      format={format}
                      variant="compact"
                      showAmounts
                      className="mt-1"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </WidgetBoundary>

      {/* ── Next Debt ──────────────────────────────────────────── */}
      <WidgetBoundary name="Next Debt">
        {nextDebt && (
          <motion.div
            variants={fadeBlur} initial="hidden" animate="visible"
            transition={{ ...spring, delay: 0.22 }}
          >
            <Link href="/debts" className="card p-3.5 hover:border-orange-400/30 transition-colors block">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="p-1.5 rounded-lg bg-orange-400/10 shrink-0">
                  <Landmark className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wide t3">{t("dashboard.next_debt")}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold t1 truncate">{nextDebt.person_or_entity}</p>
                  {nextDebt.due_date && <DueBadge days={daysUntil(nextDebt.due_date)} />}
                </div>
                <p className="text-sm font-bold text-orange-400 tabular-nums shrink-0">
                  {format(Number(nextDebt.total_amount) - Number(nextDebt.paid_amount))}
                </p>
              </div>
            </Link>
          </motion.div>
        )}
      </WidgetBoundary>

      {/* ── AI Insights ────────────────────────────────────────── */}
      <WidgetBoundary name="AI Insights">
        {aiInsights.length > 0 && (
          <motion.div
            variants={fadeBlur} initial="hidden" animate="visible"
            transition={{ ...spring, delay: 0.25 }}
            className="card p-4"
          >
            <SectionHeader icon={BrainCircuit} title={t("dashboard.ai_insights")} href="/analytics?tab=overview" color="text-cyan-400" />
            <div className="space-y-2">
              {aiInsights.slice(0, 4).map((ins) => (
                <Link key={ins.id} href={ins.actionUrl ?? "/analytics"}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-opacity hover:opacity-80 ${
                    ins.severity === "critical" ? "border-rose-400/25 bg-rose-400/7"
                    : ins.severity === "warning"  ? "border-amber-400/25 bg-amber-400/7"
                    : ins.severity === "positive" ? "border-emerald-400/25 bg-emerald-400/7"
                    : "border-cyan-400/20 bg-cyan-400/5"
                  }`}>
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                    ins.severity === "critical" ? "bg-rose-400/15"
                    : ins.severity === "warning"  ? "bg-amber-400/15"
                    : ins.severity === "positive" ? "bg-emerald-400/15"
                    : "bg-cyan-400/15"
                  }`}>
                    <Zap className={`w-3.5 h-3.5 ${
                      ins.severity === "critical" ? "text-rose-400"
                      : ins.severity === "warning"  ? "text-amber-400"
                      : ins.severity === "positive" ? "text-emerald-400"
                      : "text-cyan-400"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold t1 leading-tight">{ins.title}</p>
                    <p className="text-[11px] t2 mt-0.5 line-clamp-2">{ins.body}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 t3 shrink-0 mt-0.5" />
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </WidgetBoundary>

      {/* Empty state */}
      {transactions.length === 0 && (
        <div className="card p-6 border-cyan-400/20 bg-cyan-400/5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-cyan-400/10 flex items-center justify-center mx-auto mb-3">
            <ReceiptText className="w-6 h-6 text-cyan-400 opacity-60" />
          </div>
          <p className="text-sm font-semibold t1 mb-1">{t("common.no_data")}</p>
          <p className="text-xs t2">{t("ai_insights.no_data_body")}</p>
        </div>
      )}

    </div>
  );
}
