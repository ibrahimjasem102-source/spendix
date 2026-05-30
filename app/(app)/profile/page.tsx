"use client";

import { useMemo, useEffect, useState } from "react";
import {
  User, Wallet, TrendingUp, TrendingDown,
  Shield, Star, Briefcase, CreditCard,
  Activity, CheckCircle, AlertCircle, Target,
  PiggyBank, Award, Zap, Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialEngine } from "@/lib/finance/engine";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { createClient } from "@/lib/supabase/client";
import { useGuest } from "@/contexts/GuestContext";
import { useGoals, useDebts } from "@/lib/query/hooks";
import { spring } from "@/lib/motion";

// ── Financial Score ────────────────────────────────────────────

interface ScoreFactor {
  key: string;
  earned: number;
  max: number;
  labelKey: string;
}

function computeScore(p: {
  savingsRate: number;
  overdueDebtsCount: number;
  hasInvestments: boolean;
  hasWorkIncome: boolean;
  balance: number;
  transactionCount: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}): { score: number; factors: ScoreFactor[] } {
  let savingsEarned = 0;
  if (p.savingsRate >= 30)     savingsEarned = 25;
  else if (p.savingsRate >= 20) savingsEarned = 18;
  else if (p.savingsRate >= 10) savingsEarned = 10;
  else if (p.savingsRate > 0)   savingsEarned = 5;

  const debtEarned = p.overdueDebtsCount === 0 ? 15 : Math.max(0, 15 - p.overdueDebtsCount * 5);

  let activityEarned = 0;
  if (p.transactionCount > 20)     activityEarned = 5;
  else if (p.transactionCount > 5) activityEarned = 3;
  else if (p.transactionCount > 0) activityEarned = 1;

  const factors: ScoreFactor[] = [
    { key: "base",        earned: 40, max: 40, labelKey: "profile.score_base"       },
    { key: "savings",     earned: savingsEarned, max: 25, labelKey: "profile.score_savings"  },
    { key: "debt",        earned: debtEarned,    max: 15, labelKey: "profile.score_debt"     },
    { key: "investments", earned: p.hasInvestments ? 10 : 0, max: 10, labelKey: "profile.score_investments" },
    { key: "balance",     earned: p.balance > 0 ? 10 : 0,   max: 10, labelKey: "profile.score_balance"     },
    { key: "activity",    earned: activityEarned, max: 5,  labelKey: "profile.score_activity" },
    { key: "work",        earned: p.hasWorkIncome ? 5 : 0,  max: 5,  labelKey: "profile.score_work"        },
  ];

  const score = Math.min(100, Math.max(0, factors.reduce((s, f) => s + f.earned, 0)));
  return { score, factors };
}

function scoreColor(score: number): string {
  if (score >= 80) return "#10B981";
  if (score >= 60) return "#22D3EE";
  if (score >= 40) return "#F59E0B";
  return "#F43F5E";
}

function scoreTier(score: number, t: (k: string) => string) {
  if (score >= 80) return t("profile.health_excellent");
  if (score >= 60) return t("profile.health_good");
  if (score >= 40) return t("profile.health_fair");
  return t("profile.health_poor");
}

// ── Gauge component ────────────────────────────────────────────

function RateGauge({ value, label, color, sublabel }: {
  value: number; label: string; color: string; sublabel: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-16 overflow-hidden">
        <svg viewBox="0 0 112 56" className="w-full h-full">
          {/* Track */}
          <path d="M8 56 A 48 48 0 0 1 104 56" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" strokeLinecap="round"/>
          {/* Fill */}
          <path
            d="M8 56 A 48 48 0 0 1 104 56" fill="none"
            stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * 150.8} 150.8`}
            style={{ transition: "stroke-dasharray .8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0.5">
          <span className="text-xl font-bold text-white leading-none">{clamped}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[10px] mt-0.5" style={{ color }}>{sublabel}</p>
      </div>
    </div>
  );
}

// ── Mini score ring ────────────────────────────────────────────

function ScoreRing({ score, size = 136, ready }: { score: number; size?: number; ready: boolean }) {
  const r    = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = ready ? circ * (1 - score / 100) : circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,.06)" strokeWidth="10" fill="none"/>
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth="10" fill="none"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash}
        style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(.34,1.56,.64,1)" }}/>
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t }       = useTranslation();
  const { format }  = useCurrency();
  const { isGuest } = useGuest();
  const engine      = useFinancialEngine();

  const { data: goals = [] }     = useGoals(!isGuest);
  const { data: debtsData }      = useDebts(isGuest, !isGuest);
  const debts                    = debtsData?.debts ?? [];

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [ringReady, setRingReady] = useState(false);
  const [showScoreDetail, setShowScoreDetail] = useState(false);

  useEffect(() => {
    if (isGuest) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUserEmail(user?.email ?? null));
  }, [isGuest]);

  useEffect(() => {
    const id = setTimeout(() => setRingReady(true), 400);
    return () => clearTimeout(id);
  }, []);

  const userInitial = (userEmail?.[0] ?? "S").toUpperCase();
  const displayName = userEmail?.split("@")[0] ?? "Spendix User";

  const transactionCount = useMemo(
    () => engine.ledgerEntries.filter((e) => e.type === "transaction").length,
    [engine.ledgerEntries]
  );

  const { score, factors } = useMemo(
    () => computeScore({
      savingsRate:       engine.savingsRate,
      overdueDebtsCount: engine.overdueDebtsCount,
      hasInvestments:    engine.investedTotal > 0,
      hasWorkIncome:     engine.workIncome > 0,
      balance:           engine.balance,
      transactionCount,
      monthlyIncome:     engine.monthlyIncome,
      monthlyExpenses:   engine.monthlyExpenses,
    }),
    [engine, transactionCount]
  );

  const color = scoreColor(score);
  const tier  = scoreTier(score, t);

  // ── Net Worth ──────────────────────────────────────────────
  const netWorth = engine.balance + engine.portfolioValue - engine.debtPayable;

  // ── Monthly data ───────────────────────────────────────────
  const now   = new Date();
  const dayOfMonth   = now.getDate();
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100);

  const spendingRate = engine.monthlyIncome > 0
    ? Math.round((engine.monthlyExpenses / engine.monthlyIncome) * 100)
    : 0;
  const monthlySavings = engine.monthlyIncome - engine.monthlyExpenses;

  // Top categories this month
  const currentMonth = now.toISOString().slice(0, 7);
  const topCategories = useMemo(() => {
    const spend: Record<string, { amount: number; color: string }> = {};
    engine.ledgerEntries.forEach((e) => {
      if (e.type === "transaction" && e.direction === "outflow" && e.date.startsWith(currentMonth)) {
        const cat = (e.category as string) ?? "Other";
        if (!spend[cat]) spend[cat] = { amount: 0, color: e.category_color ?? "#6b7280" };
        spend[cat].amount += e.amount;
      }
    });
    return Object.entries(spend)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 5);
  }, [engine.ledgerEntries, currentMonth]);

  const maxCategorySpend = topCategories[0]?.[1]?.amount ?? 1;

  // ── Badges ────────────────────────────────────────────────
  const paidDebtsCount = useMemo(
    () => debts.filter((d) => d.status === "paid").length,
    [debts]
  );
  const completedGoals = useMemo(
    () => goals.filter((g) => g.status === "completed").length,
    [goals]
  );

  const badges = useMemo(() => [
    {
      id: "first_step",     icon: Star,         color: "#F59E0B", bg: "bg-amber-400/10",
      unlocked: transactionCount > 0,
    },
    {
      id: "saver",          icon: PiggyBank,    color: "#10B981", bg: "bg-emerald-400/10",
      unlocked: engine.savingsRate >= 20,
    },
    {
      id: "pro_saver",      icon: Shield,       color: "#34D399", bg: "bg-emerald-400/10",
      unlocked: engine.savingsRate >= 30,
    },
    {
      id: "investor",       icon: TrendingUp,   color: "#A78BFA", bg: "bg-purple-400/10",
      unlocked: engine.investedTotal > 0,
    },
    {
      id: "hard_worker",    icon: Briefcase,    color: "#22D3EE", bg: "bg-cyan-400/10",
      unlocked: engine.workIncome > 0,
    },
    {
      id: "debt_free",      icon: CheckCircle,  color: "#10B981", bg: "bg-emerald-400/10",
      unlocked: engine.debtPayable === 0 && transactionCount > 0,
    },
    {
      id: "debt_slayer",    icon: Zap,          color: "#F97316", bg: "bg-orange-400/10",
      unlocked: paidDebtsCount > 0,
    },
    {
      id: "balanced",       icon: Activity,     color: "#22D3EE", bg: "bg-cyan-400/10",
      unlocked: engine.monthlyIncome > 0 && engine.monthlyExpenses < engine.monthlyIncome,
    },
    {
      id: "goal_setter",    icon: Target,       color: "#6366F1", bg: "bg-indigo-400/10",
      unlocked: goals.length > 0,
    },
    {
      id: "goal_achiever",  icon: Trophy,       color: "#F59E0B", bg: "bg-amber-400/10",
      unlocked: completedGoals > 0,
    },
    {
      id: "wealthy",        icon: Award,        color: "#34D399", bg: "bg-emerald-400/10",
      unlocked: netWorth > 0,
    },
    {
      id: "consistent",     icon: CreditCard,   color: "#8B5CF6", bg: "bg-purple-400/10",
      unlocked: transactionCount >= 50,
    },
  ], [engine, transactionCount, paidDebtsCount, goals.length, completedGoals, netWorth]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="space-y-5 pb-8">

      {/* ── Hero ── */}
      <div
        className="relative rounded-[1.5rem] overflow-hidden p-6"
        style={{ background: "linear-gradient(135deg, #0F1A2E 0%, #0E1F3A 55%, #0B2A2A 100%)" }}
      >
        <div
          className="absolute top-0 end-0 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "#22D3EE", transform: "translate(30%, -30%)" }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar + info */}
          <div className="flex flex-col items-center sm:items-start gap-3 flex-1 min-w-0 text-center sm:text-start">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-2xl font-bold text-white shrink-0">
              {isGuest ? <User className="h-8 w-8" /> : userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 mb-1">
                {t("profile.financial_profile")}
              </p>
              <h1 className="text-2xl font-bold text-white truncate">{displayName}</h1>
              {userEmail && <p className="text-sm text-white/40 mt-0.5 truncate">{userEmail}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
                {tier}
              </span>
              <span className="text-xs text-white/40">
                {unlockedCount}/{badges.length} {t("profile.badges")}
              </span>
            </div>
          </div>

          {/* Score ring */}
          <button
            onClick={() => setShowScoreDetail((v) => !v)}
            className="shrink-0 flex flex-col items-center gap-1 cursor-pointer group"
          >
            <div className="relative">
              <ScoreRing score={score} ready={ringReady} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white number-display">{score}</span>
                <span className="text-[10px] text-white/40 font-semibold tracking-widest">/ 100</span>
              </div>
            </div>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.14em]">{t("profile.health_score")}</p>
            <p className="text-[9px] text-white/20 group-hover:text-white/40 transition-colors">
              {showScoreDetail ? "▲" : "▼"} details
            </p>
          </button>
        </div>
      </div>

      {/* ── Score Breakdown (expandable) ── */}
      <AnimatePresence>
        {showScoreDetail && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div className="card p-5">
              <h3 className="text-sm font-semibold t1 mb-4">{t("profile.score_breakdown")}</h3>
              <div className="space-y-3">
                {factors.map((f, i) => {
                  const pct    = (f.earned / f.max) * 100;
                  const fColor = pct === 100 ? "#10B981" : pct > 0 ? "#F59E0B" : "#6b7280";
                  return (
                    <motion.div
                      key={f.key}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...spring, delay: i * 0.05 }}
                      className="grid grid-cols-[1fr_auto] items-center gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs t2">{t(f.labelKey as Parameters<typeof t>[0])}</span>
                          <span className="text-[10px] font-bold tabular-nums" style={{ color: fColor }}>
                            {f.earned}/{f.max}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: fColor }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.05 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Net Worth ── */}
      <div className="card-elevated p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold t1">{t("profile.net_worth")}</h3>
            <p className="text-xs t3 mt-0.5">{t("profile.net_worth_sub")}</p>
          </div>
          <div className={`text-2xl font-bold number-display ${netWorth >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {netWorth < 0 ? "−" : "+"}{format(Math.abs(netWorth))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t("profile.net_worth_cash"),      value: engine.balance,        color: "text-cyan-400",    bg: "bg-cyan-400/10",    sign: "+" },
            { label: t("profile.net_worth_portfolio"),  value: engine.portfolioValue, color: "text-purple-400",  bg: "bg-purple-400/10",  sign: "+" },
            { label: t("profile.net_worth_debt"),       value: engine.debtPayable,    color: "text-rose-400",    bg: "bg-rose-400/10",    sign: "−" },
          ].map(({ label, value, color: c, bg, sign }) => (
            <div key={label} className={`rounded-xl ${bg} p-3 text-center`}>
              <p className="text-[10px] t3 mb-1 leading-tight">{label}</p>
              <p className={`text-sm font-bold number-display ${c}`}>{sign}{format(value)}</p>
            </div>
          ))}
        </div>

        {/* Net worth bar */}
        {(engine.balance + engine.portfolioValue) > 0 && (
          <div className="mt-4 h-2 bg-white/6 rounded-full overflow-hidden flex gap-px">
            {engine.balance > 0 && (
              <motion.div
                className="h-full bg-cyan-400 rounded-l-full"
                style={{ width: `${(engine.balance / (engine.balance + engine.portfolioValue)) * (100 - (engine.debtPayable > 0 ? 20 : 0))}%` }}
                initial={{ width: 0 }} animate={{ width: `${(engine.balance / (engine.balance + engine.portfolioValue)) * (100 - (engine.debtPayable > 0 ? 20 : 0))}%` }}
                transition={{ duration: .7, ease: "easeOut" }}
              />
            )}
            {engine.portfolioValue > 0 && (
              <motion.div
                className="h-full bg-purple-400"
                style={{ flex: 1 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              />
            )}
            {engine.debtPayable > 0 && (
              <motion.div
                className="h-full bg-rose-400 rounded-r-full"
                style={{ width: "20%" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Monthly Summary ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold t1">{t("profile.monthly_summary")}</h3>
          <span className="text-[10px] t3">
            {t("profile.monthly_day", { day: String(dayOfMonth), total: String(daysInMonth) })}
          </span>
        </div>

        {/* Month progress bar */}
        <div className="mb-5">
          <div className="h-1 bg-white/6 rounded-full overflow-hidden">
            <div className="h-full bg-white/20 rounded-full" style={{ width: `${monthProgress}%` }} />
          </div>
        </div>

        {/* Income vs Expenses bars */}
        <div className="space-y-3 mb-5">
          {[
            {
              label: t("profile.monthly_income"),
              value: engine.monthlyIncome,
              color: "#10B981", bg: "bg-emerald-400",
              pct: 100,
            },
            {
              label: t("profile.monthly_expenses"),
              value: engine.monthlyExpenses,
              color: "#F43F5E", bg: "bg-rose-400",
              pct: engine.monthlyIncome > 0 ? Math.min(100, (engine.monthlyExpenses / engine.monthlyIncome) * 100) : 0,
            },
            {
              label: t("profile.monthly_savings"),
              value: Math.max(0, monthlySavings),
              color: "#22D3EE", bg: "bg-cyan-400",
              pct: engine.monthlyIncome > 0 ? Math.max(0, Math.min(100, (monthlySavings / engine.monthlyIncome) * 100)) : 0,
            },
          ].map(({ label, value, color: c, bg, pct }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs t2">{label}</span>
                <span className="text-xs font-bold number-display" style={{ color: c }}>{format(value)}</span>
              </div>
              <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${bg}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: .7, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Top categories */}
        {topCategories.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold t3 uppercase tracking-wide mb-3">{t("profile.top_categories")}</h4>
            <div className="space-y-2">
              {topCategories.map(([cat, { amount, color: catColor }]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: catColor }} />
                  <span className="text-xs t2 flex-1 truncate">{cat}</span>
                  <div className="flex-1 h-1 bg-white/6 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(amount / maxCategorySpend) * 100}%`, background: catColor }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold t3 tabular-nums shrink-0">{format(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Rates ── */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold t1 mb-5">{t("profile.savings_rate")} & {t("profile.spending_rate")}</h3>
        <div className="flex items-start justify-around">
          <RateGauge
            value={engine.monthlySavingsRate}
            label={t("profile.savings_rate")}
            color={engine.monthlySavingsRate >= 20 ? "#10B981" : engine.monthlySavingsRate >= 10 ? "#F59E0B" : "#F43F5E"}
            sublabel={
              engine.monthlySavingsRate >= 20 ? t("profile.rate_ideal") :
              engine.monthlySavingsRate >= 10 ? t("profile.rate_ok") :
              t("profile.rate_low")
            }
          />
          <div className="w-px bg-white/8 self-stretch" />
          <RateGauge
            value={spendingRate}
            label={t("profile.spending_rate")}
            color={spendingRate <= 70 ? "#10B981" : spendingRate <= 90 ? "#F59E0B" : "#F43F5E"}
            sublabel={`${format(engine.monthlyExpenses)} / ${t("profile.monthly_income")}`}
          />
        </div>

        {/* Rate context bar */}
        {engine.monthlyIncome > 0 && (
          <div className="mt-5 flex h-3 rounded-full overflow-hidden">
            <motion.div
              className="bg-emerald-400 h-full"
              title={t("profile.monthly_savings")}
              initial={{ flex: 0 }}
              animate={{ flex: Math.max(0, engine.monthlySavingsRate) }}
              transition={{ duration: .8, ease: "easeOut" }}
            />
            <motion.div
              className="bg-rose-400 h-full"
              title={t("profile.monthly_expenses")}
              initial={{ flex: 0 }}
              animate={{ flex: Math.min(100, spendingRate) }}
              transition={{ duration: .8, ease: "easeOut" }}
            />
            <div className="flex-1 bg-white/4 h-full" />
          </div>
        )}
      </div>

      {/* ── Achievements ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold t1">{t("profile.badges")}</h3>
            <p className="text-xs t3 mt-0.5">{unlockedCount} / {badges.length} unlocked</p>
          </div>
          {/* Progress bar */}
          <div className="w-24 h-1.5 bg-white/6 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 rounded-full"
              style={{ width: `${(unlockedCount / badges.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {badges.map((badge, i) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...spring, delay: i * 0.04 }}
              title={t(`profile.badge_${badge.id}_hint` as Parameters<typeof t>[0])}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all cursor-default ${
                badge.unlocked
                  ? "border-[hsl(var(--border))] shadow-sm"
                  : "border-[hsl(var(--border))] opacity-30 grayscale"
              }`}
            >
              <div className={`p-2.5 rounded-xl ${badge.unlocked ? badge.bg : "bg-white/5"}`}>
                <badge.icon
                  className="w-5 h-5"
                  style={{ color: badge.unlocked ? badge.color : "#6b7280" }}
                />
              </div>
              <p className="text-[10px] text-center t2 font-medium leading-tight">
                {t(`profile.badge_${badge.id}` as Parameters<typeof t>[0])}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Activity + Debts ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Activity */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold t1 mb-4">{t("profile.activity")}</h3>
          <div className="space-y-0">
            {[
              { icon: Activity,     color: "text-cyan-400",    bg: "bg-cyan-400/10",    label: t("profile.total_transactions"), value: String(transactionCount), vc: "t1" },
              { icon: TrendingUp,   color: "text-emerald-400", bg: "bg-emerald-400/10", label: t("profile.all_time_income"),    value: format(engine.income),    vc: "text-emerald-400" },
              { icon: TrendingDown, color: "text-rose-400",    bg: "bg-rose-400/10",    label: t("profile.all_time_expenses"),  value: format(engine.expenses),  vc: "text-rose-400" },
              ...(engine.workIncome > 0 ? [{ icon: Briefcase, color: "text-cyan-400", bg: "bg-cyan-400/10", label: t("profile.work_income"), value: format(engine.workIncome), vc: "text-cyan-400" }] : []),
              { icon: Wallet, color: engine.balance >= 0 ? "text-emerald-400" : "text-rose-400", bg: engine.balance >= 0 ? "bg-emerald-400/10" : "bg-rose-400/10", label: t("profile.net_position"), value: format(engine.balance), vc: engine.balance >= 0 ? "text-emerald-400" : "text-rose-400" },
            ].map((row, i, arr) => (
              <div key={row.label} className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? "border-b border-[hsl(var(--border))]" : ""}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${row.bg}`}>
                    <row.icon className={`w-3.5 h-3.5 ${row.color}`} />
                  </div>
                  <span className="text-sm t2">{row.label}</span>
                </div>
                <span className={`text-sm font-bold number-display ${row.vc}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Debts + Portfolio */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold t1">{t("debts.title")}</h3>
          {engine.debtPayable === 0 && engine.debtReceivable === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm t2 text-center">{t("debts.no_data")}</p>
            </div>
          ) : (
            <div className="space-y-0">
              {engine.debtPayable > 0 && (
                <div className="flex items-center justify-between py-3 border-b border-[hsl(var(--border))]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-rose-400/10">
                      <CreditCard className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                    <span className="text-sm t2">{t("debts.payable")}</span>
                  </div>
                  <span className="text-sm font-bold text-rose-400 number-display">{format(engine.debtPayable)}</span>
                </div>
              )}
              {engine.debtReceivable > 0 && (
                <div className="flex items-center justify-between py-3 border-b border-[hsl(var(--border))]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-400/10">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <span className="text-sm t2">{t("debts.receivable")}</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-400 number-display">{format(engine.debtReceivable)}</span>
                </div>
              )}
              {engine.overdueDebtsCount > 0 && (
                <div className="flex items-center gap-2 my-2 px-3 py-2.5 rounded-xl bg-rose-400/8 border border-rose-400/20">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <p className="text-xs text-rose-400">{engine.overdueDebtsCount} {t("debts.overdue")}</p>
                </div>
              )}
              <div className="flex items-center justify-between pt-3">
                <span className="text-xs t3">{t("debts.net_balance")}</span>
                <span className={`text-sm font-bold number-display ${engine.netDebt <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {format(Math.abs(engine.netDebt))}
                  <span className="text-xs font-normal ms-1 t3">
                    {engine.netDebt <= 0 ? t("profile.in_your_favor") : t("profile.you_owe")}
                  </span>
                </span>
              </div>
            </div>
          )}

          {engine.investedTotal > 0 && (
            <div className="border-t border-[hsl(var(--border))] pt-4 space-y-2">
              <h3 className="text-sm font-semibold t1 mb-3">{t("investments.portfolio_value")}</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm t2">{t("investments.current_value")}</span>
                <span className="text-sm font-bold text-purple-400 number-display">{format(engine.portfolioValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm t2">{t("investments.return")}</span>
                <span className={`text-sm font-bold number-display ${engine.portfolioGain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {engine.portfolioGain >= 0 ? "+" : ""}{engine.portfolioGainPct.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
