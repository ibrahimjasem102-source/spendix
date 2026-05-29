"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, CreditCard,
  AlertTriangle, AlertCircle, Info, CheckCircle,
  Star, Zap, Shield, Award, BarChart2, Briefcase,
  Activity, Clock, Target, Flame,
} from "lucide-react";
import { motion } from "framer-motion";
import { useFinancialHub }  from "@/lib/finance/hub";
import type { Achievement } from "@/lib/finance/achievementEngine";
import { useTranslation }   from "@/lib/i18n";
import { useCurrency }      from "@/lib/currency";
import { useTheme }         from "@/lib/theme";
import { spring }           from "@/lib/motion";

// ── Icon map for achievements ─────────────────────────────────

const ACHIEVEMENT_ICONS: Record<string, React.ElementType> = {
  first_step:       Star,
  active_user:      Flame,
  saver:            Shield,
  super_saver:      Award,
  investor:         TrendingUp,
  profit_maker:     BarChart2,
  hard_worker:      Briefcase,
  debt_free:        CheckCircle,
  balanced:         Activity,
  positive_balance: Wallet,
  no_overdue:       Clock,
  monthly_saver:    Target,
};

const ACHIEVEMENT_COLORS: Record<string, { color: string; bg: string }> = {
  first_step:       { color: "#F59E0B", bg: "bg-amber-400/10"   },
  active_user:      { color: "#F97316", bg: "bg-orange-400/10"  },
  saver:            { color: "#10B981", bg: "bg-emerald-400/10" },
  super_saver:      { color: "#6366F1", bg: "bg-indigo-400/10"  },
  investor:         { color: "#A78BFA", bg: "bg-purple-400/10"  },
  profit_maker:     { color: "#10B981", bg: "bg-emerald-400/10" },
  hard_worker:      { color: "#22D3EE", bg: "bg-cyan-400/10"    },
  debt_free:        { color: "#10B981", bg: "bg-emerald-400/10" },
  balanced:         { color: "#22D3EE", bg: "bg-cyan-400/10"    },
  positive_balance: { color: "#F59E0B", bg: "bg-amber-400/10"   },
  no_overdue:       { color: "#34D399", bg: "bg-emerald-400/10" },
  monthly_saver:    { color: "#34D399", bg: "bg-emerald-400/10" },
};

// ── Risk ──────────────────────────────────────────────────────

const RISK_CONFIG = {
  low:      { color: "#10B981", label: "hub.risk_low"      },
  medium:   { color: "#F59E0B", label: "hub.risk_medium"   },
  high:     { color: "#F97316", label: "hub.risk_high"     },
  critical: { color: "#F43F5E", label: "hub.risk_critical" },
} as const;

const FLAG_ICONS = {
  info:     Info,
  warning:  AlertTriangle,
  critical: AlertCircle,
} as const;

// ── Achievement card ──────────────────────────────────────────

function AchievementBadge({ a, idx }: { a: Achievement; idx: number }) {
  const { t } = useTranslation();
  const Icon  = ACHIEVEMENT_ICONS[a.id] ?? Star;
  const cfg   = ACHIEVEMENT_COLORS[a.id] ?? { color: "#6b7280", bg: "bg-white/5" };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...spring, delay: idx * 0.04 }}
      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
        a.unlocked
          ? "border-[hsl(var(--border))]"
          : "border-[hsl(var(--border))] opacity-30 grayscale"
      }`}
    >
      <div className={`relative p-2.5 rounded-xl ${a.unlocked ? cfg.bg : "bg-white/5"}`}>
        <Icon className="w-5 h-5" style={{ color: a.unlocked ? cfg.color : "#6b7280" }} />
        {a.unlocked && (
          <span className="absolute -top-1 -end-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[hsl(var(--bg-base))]" />
        )}
      </div>
      <p className="text-[10px] text-center t2 font-medium leading-tight">
        {t(`hub.achievement_${a.id}`)}
      </p>
      {/* Progress bar */}
      {!a.unlocked && a.progress > 0 && (
        <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-cyan-400/60"
            style={{ width: `${a.progress}%`, transition: "width 0.6s ease-out" }}
          />
        </div>
      )}
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function HubPage() {
  const { t }      = useTranslation();
  const { format } = useCurrency();
  const { theme }  = useTheme();
  const hub        = useFinancialHub();

  const isDark    = theme === "dark";
  const gridColor = isDark ? "#ffffff08" : "#00000008";
  const textColor = isDark ? "#94a3b8" : "#64748b";

  const isPositiveNW = hub.netWorth >= 0;
  const riskCfg      = RISK_CONFIG[hub.risk.riskLevel];

  // Forecast chart data
  const forecastData = useMemo(
    () =>
      hub.forecast.months.map((m) => ({
        month:    m.month,
        income:   m.projectedInflow,
        expenses: m.projectedOutflow,
        balance:  m.cumulativeBalance,
      })),
    [hub.forecast.months],
  );

  // Level progress
  const { level, totalPoints, maxPoints } = hub;
  const nextThreshold = level.nextThreshold === Infinity ? maxPoints : level.nextThreshold;
  const levelPct      = Math.min(100, (totalPoints / nextThreshold) * 100);

  const unlockedCount = hub.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold t1">{t("hub.title")}</h1>
        <p className="text-sm t2 mt-0.5">{t("hub.subtitle")}</p>
      </div>

      {/* ── Net Worth Hero ─────────────────────────────────────── */}
      <div
        className="relative rounded-[1.5rem] overflow-hidden p-6"
        style={{
          background: isPositiveNW
            ? "linear-gradient(135deg, #0F1A2E 0%, #0B1F0F 50%, #0E2040 100%)"
            : "linear-gradient(135deg, #2A0A14 0%, #1A0F0B 50%, #1A0F2E 100%)",
        }}
      >
        <div
          className="absolute top-0 end-0 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{
            background: isPositiveNW ? "#22D3EE" : "#F43F5E",
            transform: "translate(35%, -35%)",
          }}
        />
        <div className="relative z-10">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.16em] mb-2">
            {t("hub.net_worth")}
          </p>
          <p className={`text-4xl sm:text-5xl font-bold number-display mb-1 ${isPositiveNW ? "text-white" : "text-rose-300"}`}>
            {format(Math.abs(hub.netWorth))}
          </p>
          <p className="text-xs text-white/30 mb-6">{t("hub.net_worth_sub")}</p>

          {/* Breakdown: cash / portfolio / debt */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t("hub.cash"),      value: hub.cashBalance,    color: "#22D3EE", Icon: Wallet       },
              { label: t("hub.portfolio"), value: hub.portfolioValue, color: "#A78BFA", Icon: TrendingUp   },
              { label: t("hub.debt"),      value: hub.totalDebt,      color: "#F43F5E", Icon: CreditCard   },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-white/5 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <item.Icon className="w-3 h-3" style={{ color: item.color }} />
                  <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wide">{item.label}</p>
                </div>
                <p className="text-sm font-bold number-display" style={{ color: item.color }}>
                  {format(item.value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Risk + Forecast ────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Risk Assessment */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold t1">{t("hub.risk")}</h3>
              <p className="text-xs t3 mt-0.5" style={{ color: riskCfg.color }}>
                {t(riskCfg.label)}
              </p>
            </div>
            {/* Safety score ring */}
            <div className="relative shrink-0">
              <svg width="72" height="72" className="-rotate-90">
                <circle cx="36" cy="36" r="30" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
                <circle
                  cx="36" cy="36" r="30"
                  stroke={riskCfg.color}
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 30}
                  strokeDashoffset={2 * Math.PI * 30 * (hub.risk.riskScore / 100)}
                  style={{ transition: "stroke-dashoffset 1s ease-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold t1 number-display leading-none">
                  {hub.risk.safetyScore}
                </span>
                <span className="text-[9px] t3">safe</span>
              </div>
            </div>
          </div>

          {/* Key risk metrics */}
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: t("hub.emergency_fund"),
                value: `${hub.risk.emergencyFundMonths} ${t("hub.months")}`,
                ok:    hub.risk.emergencyFundMonths >= 3,
              },
              {
                label: t("hub.debt_to_income"),
                value: `${hub.risk.debtToIncomeRatio}×`,
                ok:    hub.risk.debtToIncomeRatio < 1,
              },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-[hsl(var(--bg-input))] p-3">
                <p className="text-[10px] t3 mb-1">{m.label}</p>
                <p className={`text-sm font-bold number-display ${m.ok ? "text-emerald-400" : "text-rose-400"}`}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Risk flags */}
          {hub.risk.flags.length > 0 ? (
            <div className="space-y-2">
              {hub.risk.flags.map((flag) => {
                const FlagIcon = FLAG_ICONS[flag.severity];
                const colors = {
                  critical: { text: "text-rose-400",   bg: "bg-rose-400/8",   border: "border-rose-400/20"   },
                  warning:  { text: "text-amber-400",  bg: "bg-amber-400/8",  border: "border-amber-400/20"  },
                  info:     { text: "text-cyan-400",   bg: "bg-cyan-400/8",   border: "border-cyan-400/20"   },
                }[flag.severity];
                return (
                  <div key={flag.id} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border ${colors.bg} ${colors.border}`}>
                    <FlagIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${colors.text}`} />
                    <p className={`text-xs ${colors.text} leading-relaxed`}>{t(flag.msgKey)}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-400/8 border border-emerald-400/20">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-400">No risk flags — great financial health!</p>
            </div>
          )}
        </div>

        {/* 6-Month Forecast */}
        <div className="card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold t1">{t("hub.forecast")}</h3>
            <p className="text-xs t3 mt-0.5">{t("hub.forecast_sub")}</p>
          </div>

          {hub.forecast.avgMonthlyInflow === 0 ? (
            <div className="h-[180px] flex items-center justify-center">
              <p className="text-xs t3">{t("common.no_data")}</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={forecastData} barGap={4} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={30} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                    formatter={(value: number) => [format(value)]}
                  />
                  <Bar dataKey="income"   fill="#22D3EE" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                  <Bar dataKey="expenses" fill="#F43F5E" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>

              <div className="flex gap-3 mt-3">
                {[
                  { label: t("hub.projected_income"),   value: format(hub.forecast.avgMonthlyInflow),  color: "text-cyan-400"    },
                  { label: t("hub.projected_expenses"), value: format(hub.forecast.avgMonthlyOutflow), color: "text-rose-400"    },
                  { label: t("dashboard.savings_rate"), value: `${hub.monthlyHistory.at(-1)?.savings ?? 0}%`, color: "text-emerald-400" },
                ].map((s) => (
                  <div key={s.label} className="flex-1 rounded-xl bg-[hsl(var(--bg-input))] p-2.5">
                    <p className="text-[9px] t3 mb-0.5">{s.label}</p>
                    <p className={`text-xs font-bold number-display ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Cumulative Balance Forecast ────────────────────────── */}
      {hub.forecast.avgMonthlyInflow > 0 && (
        <div className="card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold t1">{t("dashboard.total_balance")}</h3>
            <p className="text-xs t3 mt-0.5">{t("hub.forecast_sub")}</p>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#22D3EE" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={30} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                formatter={(value: number) => [format(value), t("dashboard.total_balance")]}
              />
              <Area dataKey="balance" stroke="#22D3EE" strokeWidth={2} fill="url(#balGrad)" dot={{ r: 3, fill: "#22D3EE" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Achievements ───────────────────────────────────────── */}
      <div className="card p-5">
        {/* Header with level + points */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold t1">{t("hub.achievements")}</h3>
            <p className="text-xs t3 mt-0.5">{unlockedCount} / {hub.achievements.length} unlocked</p>
          </div>
          <div className="text-end">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mb-1"
              style={{ background: "#22D3EE20", color: "#22D3EE" }}
            >
              <Zap className="w-3 h-3" />
              {t("hub.level")} {level.level} · {t(level.titleKey)}
            </div>
            <p className="text-xs t3">{totalPoints} / {nextThreshold === Infinity ? maxPoints : nextThreshold} {t("hub.total_points")}</p>
            {/* Level progress bar */}
            <div className="mt-1.5 w-36 h-1.5 rounded-full bg-white/5 overflow-hidden ms-auto">
              <div
                className="h-full rounded-full bg-cyan-400"
                style={{ width: `${levelPct}%`, transition: "width 0.8s ease-out" }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          {hub.achievements.map((a, i) => (
            <AchievementBadge key={a.id} a={a} idx={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
