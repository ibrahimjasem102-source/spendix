"use client";

import { useState } from "react";
import { Sparkles, Lightbulb, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { AIInsight } from "@/types";
import { safeFetch } from "@/lib/fetch-safe";
import { useTranslation } from "@/lib/i18n";

const typeConfig = {
  tip: {
    icon: Lightbulb,
    bg: "bg-blue-50",
    border: "border-blue-100",
    icon_color: "text-blue-500",
    title_color: "text-blue-800",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-100",
    icon_color: "text-amber-500",
    title_color: "text-amber-800",
  },
  positive: {
    icon: CheckCircle,
    bg: "bg-green-50",
    border: "border-green-100",
    icon_color: "text-green-500",
    title_color: "text-green-800",
  },
};

export default function InsightsPanel() {
  const { t, locale } = useTranslation();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchInsights() {
    setLoading(true);
    setError("");

    try {
      const res = await safeFetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: locale }),
      });
      if (!res.ok) throw new Error("Failed to generate insights");
      const data = await res.json();
      setInsights(data.insights);
    } catch {
      setError(t("ai_insights.generate_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <h2 className="font-semibold text-gray-900">{t("ai_insights.title")}</h2>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {loading ? t("ai_insights.analyzing") : t("ai_insights.analyze")}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">
          {error}
        </p>
      )}

      {insights.length === 0 && !loading ? (
        <p className="text-sm text-gray-400 text-center py-6">
          {t("ai_insights.empty_cta")}
        </p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => {
            const config = typeConfig[insight.type];
            return (
              <div
                key={insight.id}
                className={`flex gap-3 p-3 rounded-lg border ${config.bg} ${config.border}`}
              >
                <config.icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.icon_color}`} />
                <div>
                  <p className={`text-sm font-semibold ${config.title_color}`}>
                    {insight.title}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">{insight.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
