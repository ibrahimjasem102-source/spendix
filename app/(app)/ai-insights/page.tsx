"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { safeFetch } from "@/lib/fetch-safe";
import {
  Sparkles, Loader2, RefreshCw, AlertTriangle, CheckCircle,
  TrendingUp, DollarSign, PiggyBank, Activity, Shield, Target, X,
  Zap, TrendingDown, CreditCard, BarChart2,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { fadeBlur, spring, staggerContainer, staggerItem } from "@/lib/motion";
import type { AIInsightRecord, InsightCategory, InsightSeverity } from "@/lib/ai/aiTypes";
import { useLocalInsights, type LocalInsight } from "@/lib/ai/localInsights";

// ── Config maps ───────────────────────────────────────────────
const SEVERITY_CONFIG: Record<InsightSeverity, {
  border: string; bg: string; icon: React.ElementType; iconColor: string; badge: string;
}> = {
  critical: { border: "border-rose-400/30",    bg: "bg-rose-400/5",    icon: AlertTriangle, iconColor: "text-rose-400",    badge: "bg-rose-400/10 text-rose-400"    },
  warning:  { border: "border-amber-400/30",   bg: "bg-amber-400/5",   icon: AlertTriangle, iconColor: "text-amber-400",   badge: "bg-amber-400/10 text-amber-400"   },
  positive: { border: "border-emerald-400/30", bg: "bg-emerald-400/5", icon: CheckCircle,   iconColor: "text-emerald-400", badge: "bg-emerald-400/10 text-emerald-400" },
  info:     { border: "border-cyan-400/20",    bg: "bg-cyan-400/5",    icon: Sparkles,      iconColor: "text-cyan-400",    badge: "bg-cyan-400/10 text-cyan-400"      },
};

const CATEGORY_ICONS: Record<InsightCategory, React.ElementType> = {
  savings:    PiggyBank,
  spending:   DollarSign,
  debt:       AlertTriangle,
  investment: TrendingUp,
  income:     DollarSign,
  cashflow:   Activity,
  risk:       Shield,
  goal:       Target,
};

// ── Source icons for local insights ──────────────────────────
const SOURCE_ICON: Record<LocalInsight["source"], React.ElementType> = {
  forecast:   BarChart2,
  anomaly:    AlertTriangle,
  prediction: TrendingUp,
  debt:       CreditCard,
  investment: TrendingDown,
};

// ── LocalInsightCard ──────────────────────────────────────────
function LocalInsightCard({ insight, t }: { insight: LocalInsight; t: (k: string) => string }) {
  const cfg     = SEVERITY_CONFIG[insight.severity];
  const SrcIcon = SOURCE_ICON[insight.source];
  const SevIcon = cfg.icon;

  return (
    <motion.div
      variants={staggerItem}
      transition={{ ...spring }}
      className={`card p-5 ${cfg.border} ${cfg.bg}`}
    >
      <div className="flex items-start gap-4">
        {/* Icons column */}
        <div className="shrink-0 flex flex-col gap-1.5">
          <div className="p-2.5 rounded-xl bg-[hsl(var(--bg-input))]">
            <SevIcon className={`w-4 h-4 ${cfg.iconColor}`} />
          </div>
          <div className="p-1.5 rounded-lg bg-[hsl(var(--bg-input))]">
            <SrcIcon className="w-3 h-3 t3" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="text-sm font-semibold t1">{insight.title}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wide ${cfg.badge}`}>
              {t(`ai_insights.severity.${insight.severity}`)}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium bg-[hsl(var(--bg-input))] t3 capitalize">
              {t(`ai_local.source_${insight.source}`)}
            </span>
          </div>

          <p className="text-sm t2 leading-relaxed">{insight.body}</p>

          {/* Metric callout */}
          {insight.metric !== undefined && (
            <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[hsl(var(--bg-input))]">
              <span className={`text-lg font-black ${cfg.iconColor}`}>{insight.metric}</span>
              {insight.metricLabel && (
                <span className="text-xs t3 font-medium">{insight.metricLabel}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 mt-3">
            {/* Confidence bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs t3">{t("ai_insights.confidence")}</span>
              <div className="w-16 h-1.5 bg-[hsl(var(--border))] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(insight.confidence * 100)}%`,
                    background: insight.severity === "critical" ? "#F43F5E"
                      : insight.severity === "positive" ? "#10B981"
                      : "#06B6D4",
                    opacity: 0.8,
                  }}
                />
              </div>
              <span className="text-xs font-medium t2">{Math.round(insight.confidence * 100)}%</span>
            </div>

            {insight.action && insight.actionUrl && (
              <a
                href={insight.actionUrl}
                className={`text-xs font-semibold underline underline-offset-2 ${cfg.iconColor} hover:opacity-80 transition-opacity`}
              >
                {insight.action} →
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AIInsightsPage() {
  const { t, locale, formatDate } = useTranslation();
  const { insights: localInsights, isLoading: localLoading } = useLocalInsights();

  const [insights, setInsights]   = useState<AIInsightRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [source, setSource]       = useState<"cached" | "generated" | null>(null);

  // ── Fetch saved insights on mount ─────────────────────────
  const fetchSaved = useCallback(async () => {
    setLoading(true);
    try {
      const res = await safeFetch("/api/ai/insights");
      if (res.ok) {
        const data = await res.json();
        if (data.insights?.length) {
          setInsights(data.insights);
          setLastUpdated(new Date(data.insights[0].created_at));
          setSource("cached");
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSaved(); }, [fetchSaved]);

  // ── Generate fresh insights ───────────────────────────────
  async function generate(forceRefresh = false) {
    setGenerating(true);
    try {
      const res = await safeFetch("/api/ai/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: locale, forceRefresh }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.insights?.length) {
          setInsights(data.insights);
          setLastUpdated(new Date());
          setSource(data.cached ? "cached" : "generated");
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  // ── Dismiss ───────────────────────────────────────────────
  async function dismiss(id: string) {
    setInsights((p) => p.filter((i) => i.id !== id));
    await safeFetch(`/api/ai/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
  }

  // ── Stats ─────────────────────────────────────────────────
  const counts = {
    critical: insights.filter((i) => i.severity === "critical").length,
    warning:  insights.filter((i) => i.severity === "warning").length,
    positive: insights.filter((i) => i.severity === "positive").length,
    info:     insights.filter((i) => i.severity === "info").length,
  };

  const isBusy = loading || generating;

  return (
    <div className="space-y-6">

      {/* ── Live Analysis (local engines) ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold t1">{t("ai_local.section_title")}</h2>
            <p className="text-xs t3">{t("ai_local.section_sub")}</p>
          </div>
        </div>

        {localLoading ? (
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <div key={n} className="card p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(var(--bg-input))]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[hsl(var(--bg-input))] rounded w-2/3" />
                    <div className="h-3 bg-[hsl(var(--bg-input))] rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : localInsights.length === 0 ? (
          <div className="card p-5 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-sm t2">{t("ai_local.no_insights")}</p>
          </div>
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
            {localInsights.map((ins) => (
              <LocalInsightCard key={ins.id} insight={ins} t={t} />
            ))}
          </motion.div>
        )}
      </section>

      <div className="border-t border-[hsl(var(--border))]" />

      {/* ── AI Analysis (LLM-powered) ── */}
      {/* Header */}
      <motion.div {...fadeBlur} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold t1">{t("ai_insights.title")}</h1>
          <p className="text-sm t2 mt-0.5">
            {t("ai_insights.subtitle")}
            {lastUpdated && (
              <> · {t("ai_insights.last_updated")} {formatDate(lastUpdated, { dateStyle: "medium", timeStyle: "short" })}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {insights.length > 0 && (
            <button
              onClick={() => generate(false)}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-2 bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] t2 rounded-xl text-xs font-medium transition-all hover:t1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isBusy ? "animate-spin" : ""}`} />
              {t("ai_insights.refresh")}
            </button>
          )}
          <button
            onClick={() => generate(true)}
            disabled={isBusy}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-semibold transition-all pressable disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }}
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? t("ai_insights.analyzing") : t("ai_insights.generate")}
          </button>
        </div>
      </motion.div>

      {/* KPI chips */}
      {insights.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(["critical", "warning", "positive", "info"] as InsightSeverity[]).map((sev) => {
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <div key={sev} className={`card p-4 ${cfg.border} ${cfg.bg}`}>
                <p className="text-xs t3 uppercase tracking-wide mb-1.5">{t(`ai_insights.severity.${sev}`)}</p>
                <p className={`text-2xl font-bold ${cfg.iconColor}`}>{counts[sev]}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Source badge */}
      {source && insights.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
            {source === "cached" ? t("ai_insights.from_db") : t("ai_insights.generated_now")}
          </span>
          <span className="text-xs t3">{insights.length} insights</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--bg-input))]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[hsl(var(--bg-input))] rounded w-2/3" />
                  <div className="h-3 bg-[hsl(var(--bg-input))] rounded w-full" />
                  <div className="h-3 bg-[hsl(var(--bg-input))] rounded w-4/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && insights.length === 0 && (
        <motion.div {...fadeBlur} className="card py-16 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(124,58,237,0.15))" }}>
            <Sparkles className="w-6 h-6 text-cyan-400" />
          </div>
          <p className="text-sm font-semibold t1 mb-1">{t("ai_insights.no_data_title")}</p>
          <p className="text-xs t3 max-w-xs mx-auto">{t("ai_insights.empty_cta")}</p>
        </motion.div>
      )}

      {/* Insights list */}
      {!loading && insights.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {insights.map((insight) => {
            const cfg = SEVERITY_CONFIG[insight.severity];
            const CatIcon = CATEGORY_ICONS[insight.category] ?? Sparkles;
            const SevIcon = cfg.icon;

            return (
              <motion.div
                key={insight.id}
                variants={staggerItem}
                transition={{ ...spring }}
                layout
                className={`card p-5 ${cfg.border} ${cfg.bg} relative group`}
              >
                {/* Dismiss */}
                <button
                  onClick={() => dismiss(insight.id)}
                  className="absolute top-3 end-3 p-1.5 rounded-lg t3 hover:text-rose-400 hover:bg-rose-400/10 opacity-0 group-hover:opacity-100 transition-all"
                  title={t("ai_insights.dismiss")}
                >
                  <X className="w-3 h-3" />
                </button>

                <div className="flex items-start gap-4">
                  {/* Icons */}
                  <div className="shrink-0 flex flex-col gap-1.5">
                    <div className={`p-2.5 rounded-xl bg-[hsl(var(--bg-input))]`}>
                      <SevIcon className={`w-4 h-4 ${cfg.iconColor}`} />
                    </div>
                    <div className="p-1.5 rounded-lg bg-[hsl(var(--bg-input))]">
                      <CatIcon className="w-3 h-3 t3" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pe-6">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-sm font-semibold t1">{insight.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wide ${cfg.badge}`}>
                        {t(`ai_insights.severity.${insight.severity}`)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium bg-[hsl(var(--bg-input))] t3 capitalize">
                        {t(`ai_insights.category.${insight.category}`)}
                      </span>
                    </div>

                    <p className="text-sm t2 leading-relaxed">{insight.body}</p>

                    <div className="flex items-center gap-4 mt-3">
                      {/* Confidence bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs t3">{t("ai_insights.confidence")}</span>
                        <div className="w-20 h-1.5 bg-[hsl(var(--border))] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round(insight.confidence * 100)}%`,
                              background: insight.severity === "critical" ? "#F43F5E"
                                : insight.severity === "positive" ? "#10B981"
                                : "#06B6D4",
                              opacity: 0.8,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium t2">
                          {Math.round(insight.confidence * 100)}%
                        </span>
                      </div>

                      {/* Action link */}
                      {insight.action && insight.action_url && (
                        <a
                          href={insight.action_url}
                          className={`text-xs font-semibold underline underline-offset-2 ${cfg.iconColor} hover:opacity-80 transition-opacity`}
                        >
                          {insight.action} →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
