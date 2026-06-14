"use client";

import { memo, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle, Info, TrendingUp, PiggyBank, Activity, Shield, Target, DollarSign } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { safeFetch } from "@/lib/fetch-safe";
import type { AIInsightRecord, InsightSeverity, InsightCategory } from "@/lib/ai/aiTypes";

const SEV_CFG: Record<InsightSeverity, { icon: React.ElementType; border: string; bg: string; iconColor: string; badge: string }> = {
  critical: { icon: AlertTriangle, border: "border-rose-400/20",    bg: "bg-rose-400/5",    iconColor: "text-rose-400",    badge: "bg-rose-400/10 text-rose-400"      },
  warning:  { icon: AlertTriangle, border: "border-amber-400/20",   bg: "bg-amber-400/5",   iconColor: "text-amber-400",   badge: "bg-amber-400/10 text-amber-400"    },
  positive: { icon: CheckCircle,   border: "border-emerald-400/20", bg: "bg-emerald-400/5", iconColor: "text-emerald-400", badge: "bg-emerald-400/10 text-emerald-400"},
  info:     { icon: Info,          border: "border-cyan-400/20",    bg: "bg-cyan-400/5",    iconColor: "text-cyan-400",    badge: "bg-cyan-400/10 text-cyan-400"      },
};

const CAT_ICONS: Record<InsightCategory, React.ElementType> = {
  savings: PiggyBank, spending: DollarSign, debt: AlertTriangle,
  investment: TrendingUp, income: DollarSign, cashflow: Activity,
  risk: Shield, goal: Target,
};

function AIInsightsPanel() {
  const { t, locale } = useTranslation();
  const [loading, setLoading]   = useState(false);
  const [insights, setInsights] = useState<AIInsightRecord[]>([]);
  const [error, setError]       = useState<string | null>(null);

  async function refresh(force = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await safeFetch("/api/ai/insights/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ language: locale, forceRefresh: force }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.insights?.length) setInsights(data.insights);
      } else {
        setError(t("ai_insights.error_generic"));
      }
    } catch {
      setError(t("ai_insights.error_generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <h3 className="text-sm font-semibold t1">{t("dashboard.ai_insights")}</h3>
        </div>
        <button
          onClick={() => refresh(false)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium t2 hover:t1 bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {loading ? t("ai_insights.analyzing") : t("ai_insights.refresh")}
        </button>
      </div>

      <div className="space-y-3">
        {error && (
          <p className="text-xs text-amber-400 bg-amber-400/10 px-3 py-2 rounded-lg">{error}</p>
        )}

        {insights.length === 0 && !loading && !error && (
          <div className="empty-state py-8">
            <div className="empty-state-icon"><Sparkles className="w-5 h-5 t3" /></div>
            <p className="empty-state-title">{t("ai_insights.no_data_title")}</p>
            <p className="text-xs t2 mt-1">{t("ai_insights.empty_cta")}</p>
          </div>
        )}

        {insights.slice(0, 3).map((insight) => {
          const cfg  = SEV_CFG[insight.severity];
          const Icon = cfg.icon;
          const CatIcon = CAT_ICONS[insight.category];
          return (
            <div key={insight.id} className={`flex gap-3 p-3.5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
              <div className="p-1.5 rounded-lg bg-[hsl(var(--bg-input))] shrink-0 mt-0.5">
                <Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-sm font-semibold t1">{insight.title}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide shrink-0 ${cfg.badge}`}>
                    {t(`ai_insights.severity.${insight.severity}`)}
                  </span>
                </div>
                <p className="text-xs t2 leading-relaxed">{insight.body}</p>
                {insight.action && insight.action_url && (
                  <a
                    href={insight.action_url}
                    className={`mt-1.5 inline-block text-xs font-semibold underline underline-offset-2 ${cfg.iconColor}`}
                  >
                    {insight.action} →
                  </a>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div
                      className={`h-full rounded-full ${cfg.iconColor.replace("text-", "bg-")}`}
                      style={{ width: `${insight.confidence * 100}%`, opacity: 0.6 }}
                    />
                  </div>
                  <span className="text-[10px] t3 shrink-0">
                    <CatIcon className="w-2.5 h-2.5 inline me-0.5" />
                    {Math.round(insight.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {insights.length > 0 && (
        <a href="/ai-insights" className="mt-3 flex items-center justify-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
          <Sparkles className="w-3 h-3" />
          {t("ai_insights.view_all")}
        </a>
      )}
    </div>
  );
}

export default memo(AIInsightsPanel);
