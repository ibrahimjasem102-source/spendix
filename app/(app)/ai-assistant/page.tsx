"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Send, Bot, User, Trash2, Loader2, Sparkles, RefreshCw,
  AlertTriangle, CheckCircle, TrendingUp, DollarSign, PiggyBank,
  Activity, Shield, Target, X, Zap, TrendingDown, CreditCard,
  BarChart2,
} from "lucide-react";
import { safeFetch } from "@/lib/fetch-safe";
import { useTranslation, LOCALES } from "@/lib/i18n";
import { fadeBlur, spring, staggerContainer, staggerItem } from "@/lib/motion";
import type { AIInsightRecord, InsightCategory, InsightSeverity } from "@/lib/ai/aiTypes";
import { useLocalInsights, type LocalInsight } from "@/lib/ai/localInsights";

// ── Types ─────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ── Severity / category config ────────────────────────────────

const SEV: Record<InsightSeverity, {
  border: string; bg: string; icon: React.ElementType; iconColor: string; badge: string; dot: string;
}> = {
  critical: { border: "border-rose-400/30",    bg: "bg-rose-400/5",    icon: AlertTriangle, iconColor: "text-rose-400",    badge: "bg-rose-400/10 text-rose-400",    dot: "bg-rose-400"    },
  warning:  { border: "border-amber-400/30",   bg: "bg-amber-400/5",   icon: AlertTriangle, iconColor: "text-amber-400",   badge: "bg-amber-400/10 text-amber-400",  dot: "bg-amber-400"   },
  positive: { border: "border-emerald-400/30", bg: "bg-emerald-400/5", icon: CheckCircle,   iconColor: "text-emerald-400", badge: "bg-emerald-400/10 text-emerald-400", dot: "bg-emerald-400" },
  info:     { border: "border-cyan-400/20",    bg: "bg-cyan-400/5",    icon: Sparkles,      iconColor: "text-cyan-400",    badge: "bg-cyan-400/10 text-cyan-400",    dot: "bg-cyan-400"    },
};

const CAT_ICONS: Record<InsightCategory, React.ElementType> = {
  savings: PiggyBank, spending: DollarSign, debt: AlertTriangle,
  investment: TrendingUp, income: DollarSign, cashflow: Activity,
  risk: Shield, goal: Target,
};

const SRC_ICON: Record<LocalInsight["source"], React.ElementType> = {
  forecast: BarChart2, anomaly: AlertTriangle,
  prediction: TrendingUp, debt: CreditCard, investment: TrendingDown,
};

// ── Compact insight card ──────────────────────────────────────

function InsightCard({
  title, body, severity, metric, metricLabel, action, actionUrl, onDismiss, t,
}: {
  title: string; body: string; severity: InsightSeverity;
  metric?: string | number; metricLabel?: string;
  action?: string; actionUrl?: string;
  onDismiss?: () => void;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const cfg = SEV[severity];
  const Icon = cfg.icon;

  return (
    <motion.div
      variants={staggerItem}
      layout
      className={`card p-4 ${cfg.border} ${cfg.bg} relative group`}
    >
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2.5 end-2.5 p-1 rounded-lg t3 hover:text-rose-400 hover:bg-rose-400/10 opacity-0 group-hover:opacity-100 transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl bg-[hsl(var(--bg-input))] shrink-0 mt-0.5`}>
          <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0 pe-5">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold t1">{title}</p>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide shrink-0 ${cfg.badge}`}>
              {t(`ai_insights.severity.${severity}`)}
            </span>
          </div>
          <p className="text-xs t2 leading-relaxed">{body}</p>
          {metric !== undefined && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[hsl(var(--bg-input))]">
              <span className={`text-base font-black ${cfg.iconColor}`}>{metric}</span>
              {metricLabel && <span className="text-[10px] t3">{metricLabel}</span>}
            </div>
          )}
          {action && actionUrl && (
            <a
              href={actionUrl}
              className={`mt-2 inline-block text-xs font-semibold underline underline-offset-2 ${cfg.iconColor} hover:opacity-70 transition-opacity`}
            >
              {action} →
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Merged AI page ────────────────────────────────────────────

export default function AIAssistantPage() {
  const { t, locale } = useTranslation();
  const langLabel = LOCALES.find((l) => l.code === locale)?.label ?? locale;

  // ── Chat state ──────────────────────────────────────────
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const examples = [
    t("ai_assistant.example_1"),
    t("ai_assistant.example_2"),
    t("ai_assistant.example_3"),
  ];

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chatLoading) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setChatLoading(true);
    inputRef.current?.focus();
    try {
      const res = await safeFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          language: locale,
        }),
      });
      const data = await res.json();
      setMessages((p) => [
        ...p,
        { id: crypto.randomUUID(), role: "assistant", content: data.reply ?? t("ai_assistant.empty_reply") },
      ]);
    } catch {
      setMessages((p) => [
        ...p,
        { id: crypto.randomUUID(), role: "assistant", content: t("ai_assistant.connection_error") },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  // ── Insights state ──────────────────────────────────────
  const { insights: localInsights, isLoading: localLoading } = useLocalInsights();

  const [aiInsights,    setAiInsights]    = useState<AIInsightRecord[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [generating,    setGenerating]    = useState(false);
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null);

  const fetchSaved = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await safeFetch("/api/ai/insights");
      if (res.ok) {
        const data = await res.json();
        if (data.insights?.length) {
          setAiInsights(data.insights);
          setLastUpdated(new Date(data.insights[0].created_at));
        }
      }
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSaved(); }, [fetchSaved]);

  async function generate(force = false) {
    setGenerating(true);
    try {
      const res = await safeFetch("/api/ai/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: locale, forceRefresh: force }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.insights?.length) {
          setAiInsights(data.insights);
          setLastUpdated(new Date());
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  async function dismissAI(id: string) {
    setAiInsights((p) => p.filter((i) => i.id !== id));
    await safeFetch(`/api/ai/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
  }

  const isBusy = insightsLoading || generating;

  // Merge and sort: local (always fresh) first, then AI
  const SEV_ORDER: Record<InsightSeverity, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
  const sortedLocal = [...localInsights].sort(
    (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity],
  );
  const sortedAI = [...aiInsights].sort(
    (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity],
  );
  const totalInsights = localInsights.length + aiInsights.length;

  return (
    <div className="space-y-5 pb-32">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10">
            <Brain className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black t1">{t("ai_assistant.title")}</h1>
            <p className="mt-0.5 text-xs font-medium t3">{t("ai_assistant.subtitle")}</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-lg border border-cyan-400/20 shrink-0">
          {langLabel}
        </span>
      </div>

      {/* ── Chat section ─────────────────────────────────── */}
      <div className="card overflow-hidden">

        {/* Chat messages */}
        <div
          ref={chatBoxRef}
          className="overflow-y-auto space-y-4 p-4"
          style={{ height: 320 }}
        >
          {messages.length === 0 ? (
            /* Welcome */
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-400/10 to-purple-500/10 border border-cyan-400/20">
                <Bot className="w-7 h-7 text-cyan-400" />
              </div>
              <div className="text-center">
                <h2 className="text-base font-bold t1">{t("ai_assistant.welcome_title")}</h2>
                <p className="text-xs t2 mt-1">{t("ai_assistant.welcome_subtitle")}</p>
              </div>
              <div className="flex flex-col gap-1.5 w-full">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => send(ex)}
                    className="text-start px-3 py-2.5 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] text-xs t2 hover:t1 hover:border-cyan-400/20 transition-all"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`p-1.5 rounded-xl shrink-0 self-start ${msg.role === "user" ? "bg-cyan-400/10" : "bg-purple-400/10"}`}>
                    {msg.role === "user"
                      ? <User className="w-3.5 h-3.5 text-cyan-400" />
                      : <Bot className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <div className={`max-w-[78%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-cyan-400/8 border border-cyan-400/20 t1 rounded-2xl rounded-tr-sm"
                      : "card t1 rounded-2xl rounded-tl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {chatLoading && (
                <div className="flex gap-2.5">
                  <div className="p-1.5 rounded-xl bg-purple-400/10 self-start">
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="card px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 160}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-[hsl(var(--border-2))]" />

        {/* Input row */}
        <div className="flex gap-2 items-end p-3">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title={t("ai_assistant.clear")}
              className="p-2.5 rounded-xl t3 hover:t2 hover:bg-[hsl(var(--bg-input))] transition-all shrink-0 self-end"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t("ai_assistant.placeholder")}
            rows={1}
            disabled={chatLoading}
            className="field flex-1 resize-none min-h-[42px] max-h-28 py-2.5 text-sm leading-relaxed"
            style={{ overflowY: "auto" }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || chatLoading}
            aria-label={t("ai_assistant.send")}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:opacity-40 text-[#0B0F17] transition-all shrink-0 self-end"
          >
            {chatLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </div>

        <p className="text-center text-[10px] t3 pb-3">
          {t("ai_assistant.powered_by")}
        </p>
      </div>

      {/* ── Insights section ──────────────────────────────── */}
      <section>
        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold t1">{t("ai_insights.smart_insights")}</h2>
              {totalInsights > 0 && (
                <p className="text-[10px] t3">{totalInsights} insights</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {aiInsights.length > 0 && (
              <button
                onClick={() => generate(false)}
                disabled={isBusy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] t2 rounded-xl text-xs font-medium transition-all hover:t1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
                {t("ai_insights.refresh")}
              </button>
            )}
            <button
              onClick={() => generate(true)}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white rounded-xl text-xs font-semibold transition-all pressable disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }}
            >
              {generating
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Zap className="w-3 h-3" />}
              {generating ? t("ai_insights.analyzing") : t("ai_insights.generate")}
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {(localLoading || insightsLoading) && (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="card p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[hsl(var(--bg-input))] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-[hsl(var(--bg-input))] rounded w-2/3" />
                    <div className="h-3 bg-[hsl(var(--bg-input))] rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* All clear */}
        {!localLoading && !insightsLoading && totalInsights === 0 && (
          <motion.div {...fadeBlur} className="card p-6 text-center">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(124,58,237,0.15))" }}
            >
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-sm font-semibold t1 mb-1">{t("ai_insights.no_data_title")}</p>
            <p className="text-xs t3 max-w-xs mx-auto">{t("ai_insights.empty_cta")}</p>
          </motion.div>
        )}

        {/* Local insights (always fresh) */}
        {!localLoading && sortedLocal.length > 0 && (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2 mb-3">
            {sortedLocal.map((ins) => (
              <InsightCard
                key={ins.id}
                title={ins.title}
                body={ins.body}
                severity={ins.severity}
                metric={ins.metric}
                metricLabel={ins.metricLabel}
                action={ins.action}
                actionUrl={ins.actionUrl}
                t={t}
              />
            ))}
          </motion.div>
        )}

        {/* AI insights (LLM-generated) */}
        {!insightsLoading && sortedAI.length > 0 && (
          <>
            {/* AI badge */}
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-[hsl(var(--border-2))]" />
              <span className="text-[10px] font-bold text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2.5 py-1 rounded-full">
                Claude AI
              </span>
              {lastUpdated && (
                <span className="text-[10px] t3">
                  {new Date(lastUpdated).toLocaleDateString()}
                </span>
              )}
              <div className="h-px flex-1 bg-[hsl(var(--border-2))]" />
            </div>

            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
              {sortedAI.map((ins) => (
                <InsightCard
                  key={ins.id}
                  title={ins.title}
                  body={ins.body}
                  severity={ins.severity}
                  action={ins.action ?? undefined}
                  actionUrl={ins.action_url ?? undefined}
                  onDismiss={() => dismissAI(ins.id)}
                  t={t}
                />
              ))}
            </motion.div>
          </>
        )}
      </section>
    </div>
  );
}
