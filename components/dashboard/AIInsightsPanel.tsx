"use client";

import { memo, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle, Lightbulb } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { safeFetch } from "@/lib/fetch-safe";
import type { AIInsight } from "@/types";

const typeConfig = {
  warning:  { icon: AlertTriangle, border: "border-rose-400/20",    bg: "bg-rose-400/5",    icon_color: "text-rose-400",    badge: "bg-rose-400/10 text-rose-400"      },
  positive: { icon: CheckCircle,   border: "border-emerald-400/20", bg: "bg-emerald-400/5", icon_color: "text-emerald-400", badge: "bg-emerald-400/10 text-emerald-400" },
  tip:      { icon: Lightbulb,     border: "border-cyan-400/20",    bg: "bg-cyan-400/5",    icon_color: "text-cyan-400",    badge: "bg-cyan-400/10 text-cyan-400"       },
};

function AIInsightsPanel() {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await safeFetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: locale }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.insights?.length) setInsights(data.insights);
      }
    } catch {}
    finally { setLoading(false); }
  }

  const typeLabels = {
    warning:  t("ai_insights.warnings"),
    positive: t("ai_insights.positive_finds"),
    tip:      t("ai_insights.tips"),
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-400/20 to-purple-500/20">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <h3 className="text-sm font-semibold t1">{t("dashboard.ai_insights")}</h3>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium t2 hover:t1 bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {loading ? t("ai_insights.analyzing") : t("ai_insights.refresh")}
        </button>
      </div>

      <div className="space-y-3">
        {insights.length === 0 && !loading && (
          <div className="empty-state py-8">
            <div className="empty-state-icon"><Sparkles className="w-5 h-5 t3" /></div>
            <p className="empty-state-title">{t("ai_insights.no_data_title")}</p>
            <p className="text-xs t2 mt-1">{t("ai_insights.empty_cta")}</p>
          </div>
        )}

        {insights.slice(0, 3).map((insight) => {
          const cfg = typeConfig[insight.type];
          return (
            <div key={insight.id} className={`flex gap-3 p-3.5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
              <cfg.icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.icon_color}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold t1">{insight.title}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${cfg.badge}`}>
                    {typeLabels[insight.type]}
                  </span>
                </div>
                <p className="text-xs t2 leading-relaxed">{insight.body}</p>
                {"confidence" in insight && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-0.5 bg-[hsl(var(--border))] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cfg.icon_color.replace("text-", "bg-")}`}
                        style={{ width: `${(insight as { confidence: number }).confidence * 100}%`, opacity: 0.6 }}
                      />
                    </div>
                    <span className="text-xs t3">
                      {Math.round((insight as { confidence: number }).confidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(AIInsightsPanel);
