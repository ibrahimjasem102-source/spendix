"use client";

import { useMemo, useEffect, useState } from "react";
import {
  User, Wallet, TrendingUp, TrendingDown,
  Shield, Star, Briefcase, CreditCard,
  Activity, CheckCircle, AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { useFinancialEngine } from "@/lib/finance/engine";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { createClient } from "@/lib/supabase/client";
import { useGuest } from "@/contexts/GuestContext";
import { spring } from "@/lib/motion";

// ── Health score ───────────────────────────────────────────────

function computeHealthScore(p: {
  savingsRate: number;
  overdueDebtsCount: number;
  hasInvestments: boolean;
  hasWorkIncome: boolean;
  balance: number;
  transactionCount: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}): number {
  let score = 40;
  if (p.savingsRate >= 30)     score += 25;
  else if (p.savingsRate >= 20) score += 18;
  else if (p.savingsRate >= 10) score += 10;
  else if (p.savingsRate > 0)   score += 5;
  if (p.overdueDebtsCount === 0) score += 15;
  else score -= Math.min(15, p.overdueDebtsCount * 5);
  if (p.hasInvestments) score += 10;
  if (p.balance > 0)    score += 10;
  if (p.transactionCount > 20)     score += 5;
  else if (p.transactionCount > 5) score += 3;
  else if (p.transactionCount > 0) score += 1;
  if (p.hasWorkIncome) score += 5;
  return Math.min(100, Math.max(0, score));
}

function healthLabel(score: number, t: (k: string) => string) {
  if (score >= 80) return { label: t("profile.health_excellent"), color: "#10B981" };
  if (score >= 60) return { label: t("profile.health_good"),      color: "#22D3EE" };
  if (score >= 40) return { label: t("profile.health_fair"),      color: "#F59E0B" };
  return              { label: t("profile.health_poor"),           color: "#F43F5E" };
}

// ── Page ───────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t }       = useTranslation();
  const { format }  = useCurrency();
  const { isGuest } = useGuest();
  const engine      = useFinancialEngine();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [ringReady, setRingReady] = useState(false);

  useEffect(() => {
    if (isGuest) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUserEmail(user?.email ?? null));
  }, [isGuest]);

  useEffect(() => {
    const id = setTimeout(() => setRingReady(true), 400);
    return () => clearTimeout(id);
  }, []);

  const userInitial   = (userEmail?.[0] ?? "S").toUpperCase();
  const displayName   = userEmail?.split("@")[0] ?? "Spendix User";

  const transactionCount = useMemo(
    () => engine.ledgerEntries.filter((e) => e.type === "transaction").length,
    [engine.ledgerEntries],
  );

  const healthScore = useMemo(
    () =>
      computeHealthScore({
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

  const info = useMemo(() => healthLabel(healthScore, t), [healthScore, t]);

  // ── SVG ring ──────────────────────────────────────────────────
  const radius      = 54;
  const circ        = 2 * Math.PI * radius;
  const dashOffset  = ringReady ? circ * (1 - healthScore / 100) : circ;

  // ── Badges ────────────────────────────────────────────────────
  const badges = useMemo(
    () => [
      { id: "first_step",  icon: Star,         color: "#F59E0B", bg: "bg-amber-400/10",   unlocked: transactionCount > 0 },
      { id: "saver",       icon: Shield,        color: "#10B981", bg: "bg-emerald-400/10", unlocked: engine.savingsRate >= 20 },
      { id: "investor",    icon: TrendingUp,    color: "#A78BFA", bg: "bg-purple-400/10",  unlocked: engine.investedTotal > 0 },
      { id: "hard_worker", icon: Briefcase,     color: "#22D3EE", bg: "bg-cyan-400/10",    unlocked: engine.workIncome > 0 },
      { id: "debt_free",   icon: CheckCircle,   color: "#10B981", bg: "bg-emerald-400/10", unlocked: engine.debtPayable === 0 && transactionCount > 0 },
      { id: "balanced",    icon: Activity,      color: "#22D3EE", bg: "bg-cyan-400/10",    unlocked: engine.monthlyIncome > 0 && engine.monthlyExpenses < engine.monthlyIncome },
    ],
    [engine, transactionCount],
  );
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  // ── KPI tiles ─────────────────────────────────────────────────
  const kpis = [
    {
      label: t("dashboard.total_balance"),
      value: format(engine.balance),
      color: engine.balance >= 0 ? "text-emerald-400" : "text-rose-400",
      bg:    engine.balance >= 0 ? "bg-emerald-400/10" : "bg-rose-400/10",
      Icon:  Wallet,
    },
    {
      label: t("dashboard.monthly_income"),
      value: format(engine.monthlyIncome),
      color: "text-cyan-400",
      bg:    "bg-cyan-400/10",
      Icon:  TrendingUp,
    },
    {
      label: t("dashboard.monthly_expenses"),
      value: format(engine.monthlyExpenses),
      color: "text-rose-400",
      bg:    "bg-rose-400/10",
      Icon:  TrendingDown,
    },
    {
      label: t("dashboard.savings_rate"),
      value: `${engine.monthlySavingsRate}%`,
      color: engine.monthlySavingsRate >= 20 ? "text-emerald-400" : engine.monthlySavingsRate >= 10 ? "text-cyan-400" : "text-amber-400",
      bg:    engine.monthlySavingsRate >= 20 ? "bg-emerald-400/10" : engine.monthlySavingsRate >= 10 ? "bg-cyan-400/10" : "bg-amber-400/10",
      Icon:  engine.monthlySavingsRate >= 20 ? TrendingUp : TrendingDown,
    },
  ];

  return (
    <div className="space-y-5 pb-8">

      {/* ── Hero card ──────────────────────────────────────────── */}
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
                {t("profile.title")}
              </p>
              <h1 className="text-2xl font-bold text-white truncate">{displayName}</h1>
              {userEmail && (
                <p className="text-sm text-white/40 mt-0.5 truncate">{userEmail}</p>
              )}
            </div>
            <span
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ backgroundColor: `${info.color}20`, color: info.color }}
            >
              {info.label}
            </span>
          </div>

          {/* Health ring */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div className="relative">
              <svg width="136" height="136" className="-rotate-90">
                <circle
                  cx="68" cy="68" r={radius}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="68" cy="68" r={radius}
                  stroke={info.color}
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={dashOffset}
                  style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(0.34,1.56,0.64,1)" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white number-display">{healthScore}</span>
                <span className="text-[10px] text-white/40 font-semibold tracking-widest">/ 100</span>
              </div>
            </div>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.14em]">{t("profile.health_score")}</p>
          </div>
        </div>
      </div>

      {/* ── KPI tiles ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="card-elevated p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] t3 uppercase tracking-wide font-semibold leading-tight">{k.label}</p>
              <div className={`p-1.5 rounded-lg ${k.bg} shrink-0`}>
                <k.Icon className={`w-3 h-3 ${k.color}`} />
              </div>
            </div>
            <p className={`text-lg font-bold number-display ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Activity + Debt/Portfolio ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Activity */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold t1 mb-4">{t("profile.activity")}</h3>
          <div className="space-y-0">
            {[
              {
                icon: Activity,     color: "text-cyan-400",    bg: "bg-cyan-400/10",
                label: t("profile.total_transactions"),
                value: String(transactionCount),
                valueColor: "t1",
              },
              {
                icon: TrendingUp,   color: "text-emerald-400", bg: "bg-emerald-400/10",
                label: t("profile.all_time_income"),
                value: format(engine.income),
                valueColor: "text-emerald-400",
              },
              {
                icon: TrendingDown, color: "text-rose-400",    bg: "bg-rose-400/10",
                label: t("profile.all_time_expenses"),
                value: format(engine.expenses),
                valueColor: "text-rose-400",
              },
              ...(engine.workIncome > 0 ? [{
                icon: Briefcase,    color: "text-cyan-400",    bg: "bg-cyan-400/10",
                label: t("profile.work_income"),
                value: format(engine.workIncome),
                valueColor: "text-cyan-400",
              }] : []),
              {
                icon: Wallet,
                color: engine.balance >= 0 ? "text-emerald-400" : "text-rose-400",
                bg:    engine.balance >= 0 ? "bg-emerald-400/10" : "bg-rose-400/10",
                label: t("profile.net_position"),
                value: format(engine.balance),
                valueColor: engine.balance >= 0 ? "text-emerald-400" : "text-rose-400",
              },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? "border-b border-[hsl(var(--border))]" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${row.bg}`}>
                    <row.icon className={`w-3.5 h-3.5 ${row.color}`} />
                  </div>
                  <span className="text-sm t2">{row.label}</span>
                </div>
                <span className={`text-sm font-bold number-display ${row.valueColor}`}>{row.value}</span>
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

      {/* ── Achievements ───────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold t1">{t("profile.badges")}</h3>
          <span className="text-xs t3 font-medium">{unlockedCount} / {badges.length}</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {badges.map((badge, i) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...spring, delay: i * 0.06 }}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                badge.unlocked
                  ? "border-[hsl(var(--border))]"
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
                {t(`profile.badge_${badge.id}`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
