"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import {
  User, Wallet, TrendingUp, TrendingDown, Shield, Star, Briefcase,
  CreditCard, Activity, CheckCircle, AlertCircle, Target, PiggyBank,
  Award, Zap, Trophy, Settings, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialEngine } from "@/lib/finance/engine";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { createClient } from "@/lib/supabase/client";
import { useGuest } from "@/contexts/GuestContext";
import { useGoals, useDebts } from "@/lib/query/hooks";
import { spring, staggerContainer, staggerItem } from "@/lib/motion";

// ── Financial score ──────────────────────────────────────────────────────────

interface ScoreFactor { key: string; earned: number; max: number; labelKey: string; }

function computeScore(p: {
  savingsRate: number; overdueDebtsCount: number; hasInvestments: boolean;
  hasWorkIncome: boolean; balance: number; transactionCount: number;
  monthlyIncome: number; monthlyExpenses: number;
}): { score: number; factors: ScoreFactor[] } {
  let savingsEarned = 0;
  if      (p.savingsRate >= 30) savingsEarned = 25;
  else if (p.savingsRate >= 20) savingsEarned = 18;
  else if (p.savingsRate >= 10) savingsEarned = 10;
  else if (p.savingsRate >   0) savingsEarned = 5;

  const debtEarned = p.overdueDebtsCount === 0 ? 15 : Math.max(0, 15 - p.overdueDebtsCount * 5);

  let activityEarned = 0;
  if      (p.transactionCount > 20) activityEarned = 5;
  else if (p.transactionCount > 5)  activityEarned = 3;
  else if (p.transactionCount > 0)  activityEarned = 1;

  const factors: ScoreFactor[] = [
    { key: "base",        earned: 40,                            max: 40, labelKey: "profile.score_base"        },
    { key: "savings",     earned: savingsEarned,                 max: 25, labelKey: "profile.score_savings"     },
    { key: "debt",        earned: debtEarned,                    max: 15, labelKey: "profile.score_debt"        },
    { key: "investments", earned: p.hasInvestments ? 10 : 0,    max: 10, labelKey: "profile.score_investments" },
    { key: "balance",     earned: p.balance > 0 ? 10 : 0,       max: 10, labelKey: "profile.score_balance"     },
    { key: "activity",    earned: activityEarned,                max: 5,  labelKey: "profile.score_activity"    },
    { key: "work",        earned: p.hasWorkIncome ? 5 : 0,       max: 5,  labelKey: "profile.score_work"        },
  ];

  const score = Math.min(100, Math.max(0, factors.reduce((s, f) => s + f.earned, 0)));
  return { score, factors };
}

function scoreColor(score: number) {
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

// ── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 120, ready }: { score: number; size?: number; ready: boolean }) {
  const r    = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = ready ? circ * (1 - score / 100) : circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.06)" strokeWidth="10" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={scoreColor(score)} strokeWidth="10" fill="none"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash}
        style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(.34,1.56,.64,1)" }} />
    </svg>
  );
}

// ── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({ icon: Icon, iconColor, iconBg, label, value, valueColor }: {
  icon: React.ElementType; iconColor: string; iconBg: string;
  label: string; value: string; valueColor: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[hsl(var(--border-2))] last:border-0">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${iconBg}`}>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        <span className="text-sm t2">{label}</span>
      </div>
      <span className={`text-sm font-bold number-display ${valueColor}`}>{value}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t }       = useTranslation();
  const { format }  = useCurrency();
  const { isGuest } = useGuest();
  const engine      = useFinancialEngine();

  const { data: goals = [] }  = useGoals(!isGuest);
  const { data: debtsData }   = useDebts(!isGuest);
  const debts                 = debtsData?.debts ?? [];

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

  const userInitial  = (userEmail?.[0] ?? "S").toUpperCase();
  const displayName  = userEmail?.split("@")[0] ?? "Spendix User";

  const transactionCount = useMemo(
    () => engine.ledgerEntries.filter((e) => e.type === "transaction").length,
    [engine.ledgerEntries],
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
    [engine, transactionCount],
  );

  const color = scoreColor(score);
  const tier  = scoreTier(score, t);

  const netWorth      = engine.balance + engine.portfolioValue + engine.debtReceivable - engine.debtPayable;
  const now           = new Date();
  const daysInMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = Math.round((now.getDate() / daysInMonth) * 100);
  const spendingRate  = engine.monthlyIncome > 0 ? Math.round((engine.monthlyExpenses / engine.monthlyIncome) * 100) : 0;
  const monthlySavings = engine.monthlyIncome - engine.monthlyExpenses;

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
    return Object.entries(spend).sort((a, b) => b[1].amount - a[1].amount).slice(0, 5);
  }, [engine.ledgerEntries, currentMonth]);

  const maxCategorySpend = topCategories[0]?.[1]?.amount ?? 1;

  const paidDebtsCount = useMemo(() => debts.filter((d) => d.status === "paid").length, [debts]);
  const completedGoals = useMemo(() => goals.filter((g) => g.status === "completed").length, [goals]);

  const badges = useMemo(() => [
    { id: "first_step",   icon: Star,        color: "#F59E0B", bg: "bg-amber-400/10",   unlocked: transactionCount > 0 },
    { id: "saver",        icon: PiggyBank,   color: "#10B981", bg: "bg-emerald-400/10", unlocked: engine.savingsRate >= 20 },
    { id: "pro_saver",    icon: Shield,      color: "#34D399", bg: "bg-emerald-400/10", unlocked: engine.savingsRate >= 30 },
    { id: "investor",     icon: TrendingUp,  color: "#A78BFA", bg: "bg-purple-400/10",  unlocked: engine.investedTotal > 0 },
    { id: "hard_worker",  icon: Briefcase,   color: "#22D3EE", bg: "bg-cyan-400/10",    unlocked: engine.workIncome > 0 },
    { id: "debt_free",    icon: CheckCircle, color: "#10B981", bg: "bg-emerald-400/10", unlocked: engine.debtPayable === 0 && transactionCount > 0 },
    { id: "debt_slayer",  icon: Zap,         color: "#F97316", bg: "bg-orange-400/10",  unlocked: paidDebtsCount > 0 },
    { id: "balanced",     icon: Activity,    color: "#22D3EE", bg: "bg-cyan-400/10",    unlocked: engine.monthlyIncome > 0 && engine.monthlyExpenses < engine.monthlyIncome },
    { id: "goal_setter",  icon: Target,      color: "#6366F1", bg: "bg-indigo-400/10",  unlocked: goals.length > 0 },
    { id: "goal_achiever",icon: Trophy,      color: "#F59E0B", bg: "bg-amber-400/10",   unlocked: completedGoals > 0 },
    { id: "wealthy",      icon: Award,       color: "#34D399", bg: "bg-emerald-400/10", unlocked: netWorth > 0 },
    { id: "consistent",   icon: CreditCard,  color: "#8B5CF6", bg: "bg-purple-400/10",  unlocked: transactionCount >= 50 },
  ], [engine, transactionCount, paidDebtsCount, goals.length, completedGoals, netWorth]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-4 pb-8"
    >

      {/* ── Hero ── */}
      <motion.div variants={staggerItem}>
        <div
          className="relative rounded-2xl overflow-hidden p-5"
          style={{ background: "linear-gradient(135deg, #0F1A2E 0%, #0E1F3A 55%, #0B2A2A 100%)" }}
        >
          <div
            className="absolute top-0 end-0 w-64 h-64 rounded-full opacity-15 blur-3xl pointer-events-none"
            style={{ background: "#22D3EE", transform: "translate(30%, -30%)" }}
          />
          <div className="relative z-10 flex items-center gap-5">
            {/* Avatar */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-xl font-bold text-white">
              {isGuest ? <User className="h-7 w-7" /> : userInitial}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 mb-0.5">
                {t("profile.financial_profile")}
              </p>
              <h1 className="text-xl font-black text-white truncate">{displayName}</h1>
              {userEmail && <p className="text-xs text-white/40 mt-0.5 truncate">{userEmail}</p>}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
                  {tier}
                </span>
                <span className="text-[10px] text-white/40">
                  {unlockedCount}/{badges.length} {t("profile.badges")}
                </span>
              </div>
            </div>

            {/* Score ring */}
            <button
              onClick={() => setShowScoreDetail((v) => !v)}
              className="shrink-0 flex flex-col items-center gap-1 cursor-pointer"
            >
              <div className="relative">
                <ScoreRing score={score} ready={ringReady} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white number-display">{score}</span>
                  <span className="text-[9px] text-white/40 font-semibold tracking-widest">/ 100</span>
                </div>
              </div>
              <p className="text-[9px] text-white/30 uppercase tracking-[0.12em]">{t("profile.health_score")}</p>
            </button>
          </div>

          {/* Quick links */}
          <div className="relative z-10 mt-4 flex gap-2">
            <Link href="/settings"
              className="flex items-center gap-1.5 rounded-xl bg-white/8 hover:bg-white/12 px-3 py-2 text-xs font-semibold text-white/60 hover:text-white/80 transition-all">
              <Settings className="h-3 w-3" />{t("nav.settings")}
            </Link>
            <Link href="/net-worth"
              className="flex items-center gap-1.5 rounded-xl bg-white/8 hover:bg-white/12 px-3 py-2 text-xs font-semibold text-white/60 hover:text-white/80 transition-all">
              <TrendingUp className="h-3 w-3" />{t("nav.net_worth")}
              <ChevronRight className="h-3 w-3 opacity-50" />
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── Score breakdown ── */}
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
              <h3 className="text-sm font-bold t1 mb-4">{t("profile.score_breakdown")}</h3>
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
                    >
                      <div className="flex items-center justify-between mb-1.5">
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
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Net Worth ── */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-emerald-400/10">
            <Wallet className="h-3 w-3 text-emerald-400" />
          </div>
          <p className="text-[10px] font-black t3 uppercase tracking-[0.15em]">{t("profile.net_worth")}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs t3">{t("profile.net_worth_sub")}</p>
            </div>
            <div className={`text-2xl font-black number-display ${netWorth >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {netWorth < 0 ? "−" : "+"}{format(Math.abs(netWorth))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: t("profile.net_worth_cash"),      value: engine.balance,        color: "text-cyan-400",   bg: "bg-cyan-400/10",   sign: "+" },
              { label: t("profile.net_worth_portfolio"),  value: engine.portfolioValue, color: "text-purple-400", bg: "bg-purple-400/10", sign: "+" },
              { label: t("profile.net_worth_debt"),       value: engine.debtPayable,    color: "text-rose-400",   bg: "bg-rose-400/10",   sign: "−" },
            ].map(({ label, value, color: c, bg, sign }) => (
              <div key={label} className={`rounded-xl ${bg} p-3 text-center`}>
                <p className="text-[10px] t3 mb-1 leading-tight">{label}</p>
                <p className={`text-sm font-bold number-display ${c}`}>{sign}{format(value)}</p>
              </div>
            ))}
          </div>

          {(engine.balance + engine.portfolioValue) > 0 && (
            <div className="h-1.5 bg-white/6 rounded-full overflow-hidden flex gap-px">
              {engine.balance > 0 && (
                <motion.div
                  className="h-full bg-cyan-400 rounded-l-full"
                  style={{ width: `${(engine.balance / (engine.balance + engine.portfolioValue)) * (100 - (engine.debtPayable > 0 ? 20 : 0))}%` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(engine.balance / (engine.balance + engine.portfolioValue)) * (100 - (engine.debtPayable > 0 ? 20 : 0))}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              )}
              {engine.portfolioValue > 0 && (
                <motion.div className="h-full bg-purple-400 flex-1"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
              )}
              {engine.debtPayable > 0 && (
                <motion.div className="h-full bg-rose-400 rounded-r-full w-[20%]"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} />
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Monthly Summary ── */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-cyan-400/10">
            <Activity className="h-3 w-3 text-cyan-400" />
          </div>
          <p className="text-[10px] font-black t3 uppercase tracking-[0.15em]">{t("profile.monthly_summary")}</p>
          <span className="ms-auto text-[10px] t3">
            {t("profile.monthly_day", { day: String(now.getDate()), total: String(daysInMonth) })}
          </span>
        </div>
        <div className="card p-5">
          {/* Month progress */}
          <div className="mb-4">
            <div className="h-1 bg-white/6 rounded-full overflow-hidden">
              <div className="h-full bg-white/20 rounded-full" style={{ width: `${monthProgress}%` }} />
            </div>
          </div>

          {/* Income / Expenses / Savings */}
          <div className="space-y-3 mb-5">
            {[
              { label: t("profile.monthly_income"),   value: engine.monthlyIncome,   color: "#10B981", bg: "bg-emerald-400", pct: 100 },
              { label: t("profile.monthly_expenses"),  value: engine.monthlyExpenses,  color: "#F43F5E", bg: "bg-rose-400",    pct: engine.monthlyIncome > 0 ? Math.min(100, (engine.monthlyExpenses / engine.monthlyIncome) * 100) : 0 },
              { label: t("profile.monthly_savings"),   value: Math.max(0, monthlySavings), color: "#22D3EE", bg: "bg-cyan-400",    pct: engine.monthlyIncome > 0 ? Math.max(0, Math.min(100, (monthlySavings / engine.monthlyIncome) * 100)) : 0 },
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
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Rate context bar */}
          {engine.monthlyIncome > 0 && (
            <div className="mb-4 flex h-2.5 rounded-full overflow-hidden gap-px">
              <motion.div className="bg-emerald-400 h-full"
                initial={{ flex: 0 }}
                animate={{ flex: Math.max(0, engine.monthlySavingsRate) }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
              <motion.div className="bg-rose-400 h-full"
                initial={{ flex: 0 }}
                animate={{ flex: Math.min(100, spendingRate) }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
              <div className="flex-1 bg-white/4 h-full" />
            </div>
          )}

          {/* Top categories */}
          {topCategories.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] t3 mb-3">{t("profile.top_categories")}</p>
              <div className="space-y-2">
                {topCategories.map(([cat, { amount, color: catColor }]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: catColor }} />
                    <span className="text-xs t2 flex-1 truncate">{cat}</span>
                    <div className="flex-1 h-1 bg-white/6 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(amount / maxCategorySpend) * 100}%`, background: catColor }} />
                    </div>
                    <span className="text-[10px] font-semibold t3 tabular-nums shrink-0">{format(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Achievements ── */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-400/10">
            <Award className="h-3 w-3 text-amber-400" />
          </div>
          <p className="text-[10px] font-black t3 uppercase tracking-[0.15em]">{t("profile.badges")}</p>
          <span className="ms-auto text-[10px] t3">{unlockedCount} / {badges.length}</span>
          <div className="w-20 h-1 bg-white/6 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full"
              style={{ width: `${(unlockedCount / badges.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="card p-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {badges.map((badge, i) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...spring, delay: i * 0.04 }}
                title={t(`profile.badge_${badge.id}_hint` as Parameters<typeof t>[0])}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-default ${
                  badge.unlocked
                    ? "border-[hsl(var(--border))]"
                    : "border-[hsl(var(--border-2))] opacity-30 grayscale"
                }`}
              >
                <div className={`p-2 rounded-xl ${badge.unlocked ? badge.bg : "bg-white/5"}`}>
                  <badge.icon className="w-4 h-4" style={{ color: badge.unlocked ? badge.color : "#6b7280" }} />
                </div>
                <p className="text-[9px] text-center t2 font-medium leading-tight">
                  {t(`profile.badge_${badge.id}` as Parameters<typeof t>[0])}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Activity & Debts ── */}
      <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-2">

        {/* Activity */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-cyan-400/10">
              <TrendingUp className="h-3 w-3 text-cyan-400" />
            </div>
            <p className="text-[10px] font-black t3 uppercase tracking-[0.15em]">{t("profile.activity")}</p>
          </div>
          <div className="card p-4">
            <StatRow icon={Activity}     iconColor="text-cyan-400"    iconBg="bg-cyan-400/10"    label={t("profile.total_transactions")} value={String(transactionCount)} valueColor="t1" />
            <StatRow icon={TrendingUp}   iconColor="text-emerald-400" iconBg="bg-emerald-400/10" label={t("profile.all_time_income")}    value={format(engine.income)}    valueColor="text-emerald-400" />
            <StatRow icon={TrendingDown} iconColor="text-rose-400"    iconBg="bg-rose-400/10"    label={t("profile.all_time_expenses")}  value={format(engine.expenses)}  valueColor="text-rose-400" />
            {engine.workIncome > 0 && (
              <StatRow icon={Briefcase}  iconColor="text-cyan-400"    iconBg="bg-cyan-400/10"    label={t("profile.work_income")}        value={format(engine.workIncome)} valueColor="text-cyan-400" />
            )}
            <StatRow
              icon={Wallet}
              iconColor={engine.balance >= 0 ? "text-emerald-400" : "text-rose-400"}
              iconBg={engine.balance >= 0 ? "bg-emerald-400/10" : "bg-rose-400/10"}
              label={t("profile.net_position")}
              value={format(engine.balance)}
              valueColor={engine.balance >= 0 ? "text-emerald-400" : "text-rose-400"}
            />
          </div>
        </div>

        {/* Debts */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-orange-400/10">
              <CreditCard className="h-3 w-3 text-orange-400" />
            </div>
            <p className="text-[10px] font-black t3 uppercase tracking-[0.15em]">{t("debts.title")}</p>
          </div>
          <div className="card p-4">
            {engine.debtPayable === 0 && engine.debtReceivable === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-sm t2 text-center">{t("debts.no_data")}</p>
              </div>
            ) : (
              <>
                {engine.debtPayable > 0 && (
                  <StatRow icon={CreditCard} iconColor="text-rose-400" iconBg="bg-rose-400/10"
                    label={t("debts.payable")} value={format(engine.debtPayable)} valueColor="text-rose-400" />
                )}
                {engine.debtReceivable > 0 && (
                  <StatRow icon={CreditCard} iconColor="text-emerald-400" iconBg="bg-emerald-400/10"
                    label={t("debts.receivable")} value={format(engine.debtReceivable)} valueColor="text-emerald-400" />
                )}
                {engine.overdueDebtsCount > 0 && (
                  <div className="flex items-center gap-2 my-2 px-3 py-2 rounded-xl bg-rose-400/8 border border-rose-400/20">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <p className="text-xs text-rose-400">{engine.overdueDebtsCount} {t("debts.overdue")}</p>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--border-2))] mt-1">
                  <span className="text-xs t3">{t("debts.net_balance")}</span>
                  <span className={`text-sm font-bold number-display ${engine.netDebt <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {format(Math.abs(engine.netDebt))}
                    <span className="text-xs font-normal ms-1 t3">
                      {engine.netDebt <= 0 ? t("profile.in_your_favor") : t("profile.you_owe")}
                    </span>
                  </span>
                </div>
              </>
            )}

            {engine.investedTotal > 0 && (
              <div className="border-t border-[hsl(var(--border-2))] pt-3 mt-3 space-y-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] t3 mb-3">{t("investments.portfolio_value")}</p>
                <StatRow icon={TrendingUp} iconColor="text-purple-400" iconBg="bg-purple-400/10"
                  label={t("investments.current_value")} value={format(engine.portfolioValue)} valueColor="text-purple-400" />
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm t2">{t("investments.return")}</span>
                  <span className={`text-sm font-bold number-display ${engine.portfolioGain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {engine.portfolioGain >= 0 ? "+" : ""}{engine.portfolioGainPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

      </motion.div>
    </motion.div>
  );
}
