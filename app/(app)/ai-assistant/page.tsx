"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Send, Bot, User, Trash2, Loader2, Sparkles, RefreshCw,
  AlertTriangle, CheckCircle, TrendingUp, DollarSign, PiggyBank,
  Activity, Shield, Target, X, Zap, TrendingDown, CreditCard,
  BarChart2, Wallet, ChevronDown, ChevronUp, FileText, BarChart3,
  CreditCard as DebtIcon, Repeat, LineChart, Copy,
} from "lucide-react";
import type { AdvisorType, ReportPeriod } from "@/lib/ai/aiTypes";
import { safeFetch } from "@/lib/fetch-safe";
import { useTranslation, LOCALES } from "@/lib/i18n";
import { fadeBlur, spring, staggerContainer, staggerItem } from "@/lib/motion";
import PlanGate from "@/components/plans/PlanGate";
import type { AIInsightRecord, InsightCategory, InsightSeverity } from "@/lib/ai/aiTypes";
import { useLocalInsights, type LocalInsight } from "@/lib/ai/localInsights";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// â”€â”€ Severity / category config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Compact insight card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
              {action} â†’
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// â”€â”€ Merged AI page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function AIAssistantPage() {
  const { t, locale } = useTranslation();
  const langLabel = LOCALES.find((l) => l.code === locale)?.label ?? locale;

  // â”€â”€ Chat state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Insights state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // ── Advisor state ──────────────────────────────────────────────
  const [advisorLoading, setAdvisorLoading] = useState<AdvisorType | null>(null);
  const [advisorResults, setAdvisorResults] = useState<Record<string, string>>({});
  const [openAdvisor,    setOpenAdvisor]    = useState<AdvisorType | null>(null);

  async function runAdvisor(type: AdvisorType) {
    setAdvisorLoading(type);
    try {
      const res = await safeFetch("/api/ai/advisor", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ advisorType: type, language: locale }),
      });
      if (res.ok) {
        const data = await res.json();
        setAdvisorResults(p => ({ ...p, [type]: data.analysis ?? "" }));
        setOpenAdvisor(type);
      }
    } finally {
      setAdvisorLoading(null);
    }
  }

  // ── Report state ───────────────────────────────────────────────
  const [reportLoading, setReportLoading] = useState<ReportPeriod | null>(null);
  const [reportText,    setReportText]    = useState<string | null>(null);
  const [reportPeriod,  setReportPeriod]  = useState<ReportPeriod | null>(null);
  const [reportCopied,  setReportCopied]  = useState(false);

  async function generateReport(period: ReportPeriod) {
    setReportLoading(period);
    setReportText(null);
    try {
      const res = await safeFetch("/api/ai/report", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ period, language: locale }),
      });
      if (res.ok) {
        const data = await res.json();
        setReportText(data.report ?? "");
        setReportPeriod(period);
      }
    } finally {
      setReportLoading(null);
    }
  }

  function copyReport() {
    if (!reportText) return;
    navigator.clipboard.writeText(reportText).then(() => {
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2000);
    });
  }

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
    <PlanGate require="pro" featureName="Ù…Ø³Ø§Ø¹Ø¯ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ" overlay>
    <div className="space-y-5">

      {/* â”€â”€ Page header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10">
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

      {/* â”€â”€ Chat section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
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
                      ? "bg-cyan-400/8 border border-cyan-400/20 t1 rounded-xl rounded-tr-sm"
                      : "card t1 rounded-xl rounded-tl-sm"
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
                  <div className="card px-4 py-3 rounded-xl rounded-tl-sm flex items-center gap-1.5">
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
            className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-[#0B0F17] transition-all shrink-0 self-end"
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

      {/* â”€â”€ Insights section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
              style={{ background: "#06B6D4" }}
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
              className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: "hsl(var(--bg-card-2))" }}
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

      {/* ── Advisors section ───────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold t1">{t("ai_assistant.advisors_title")}</h2>
        </div>
        <p className="text-xs t3 mb-4">{t("ai_assistant.advisors_sub")}</p>

        {([
          { type: "budget"        as AdvisorType, icon: Wallet,    label: t("ai_assistant.advisor_budget"),        color: "text-amber-400",   bg: "bg-amber-400/10"   },
          { type: "debt"          as AdvisorType, icon: DebtIcon,  label: t("ai_assistant.advisor_debt"),          color: "text-rose-400",    bg: "bg-rose-400/10"    },
          { type: "goals"         as AdvisorType, icon: Target,    label: t("ai_assistant.advisor_goals"),         color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
          { type: "subscriptions" as AdvisorType, icon: Repeat,    label: t("ai_assistant.advisor_subscriptions"), color: "text-purple-400",  bg: "bg-purple-400/10"  },
          { type: "investments"   as AdvisorType, icon: LineChart,  label: t("ai_assistant.advisor_investments"),  color: "text-emerald-400", bg: "bg-emerald-400/10" },
          { type: "health"        as AdvisorType, icon: Activity,  label: t("ai_assistant.advisor_health"),        color: "text-teal-400",    bg: "bg-teal-400/10"    },
        ] as const).map(({ type, icon: Icon, label, color, bg }) => {
          const result   = advisorResults[type];
          const isLoading = advisorLoading === type;
          const isOpen    = openAdvisor === type;
          return (
            <div key={type} className="card mb-2 overflow-hidden">
              <button
                onClick={() => result ? setOpenAdvisor(isOpen ? null : type) : runAdvisor(type)}
                disabled={isLoading}
                className="flex items-center gap-3 w-full p-4 text-start hover:bg-white/3 transition-colors"
              >
                <div className={`p-2 rounded-xl shrink-0 ${bg}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold t1">{label}</p>
                  <p className="text-xs t3 mt-0.5">
                    {result ? t("ai_assistant.tap_to_toggle") : t("ai_assistant.tap_to_analyze")}
                  </p>
                </div>
                {isLoading ? (
                  <Loader2 className={`w-4 h-4 animate-spin ${color} shrink-0`} />
                ) : result ? (
                  isOpen ? <ChevronUp className="w-4 h-4 t3 shrink-0" /> : <ChevronDown className="w-4 h-4 t3 shrink-0" />
                ) : (
                  <Zap className={`w-4 h-4 ${color} shrink-0`} />
                )}
              </button>
              {isOpen && result && (
                <div className="px-4 pb-4 border-t border-white/5">
                  <pre className="text-xs t2 leading-relaxed whitespace-pre-wrap font-sans mt-3">{result}</pre>
                  <button
                    onClick={() => { void send(`Tell me more about my ${type} situation`); }}
                    className={`mt-3 text-xs font-semibold underline underline-offset-2 ${color}`}
                  >
                    {t("ai_assistant.ask_follow_up")} →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* ── Reports section ────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold t1">{t("ai_assistant.reports_title")}</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["weekly", "monthly", "quarterly"] as ReportPeriod[]).map(period => (
            <button
              key={period}
              onClick={() => generateReport(period)}
              disabled={reportLoading !== null}
              className="card p-3 text-center hover:border-cyan-400/20 transition-all disabled:opacity-50"
            >
              {reportLoading === period
                ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400 mx-auto mb-1" />
                : <FileText className="w-4 h-4 text-cyan-400 mx-auto mb-1" />}
              <p className="text-xs font-semibold t1">{t(`ai_assistant.report_${period}`)}</p>
            </button>
          ))}
        </div>

        {reportText && reportPeriod && (
          <motion.div {...fadeBlur} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <p className="text-sm font-bold t1">{t(`ai_assistant.report_${reportPeriod}`)}</p>
              </div>
              <button
                onClick={copyReport}
                className="flex items-center gap-1.5 text-xs font-medium t2 hover:t1 transition-colors px-2 py-1 rounded-lg bg-[hsl(var(--bg-input))]"
              >
                <Copy className="w-3 h-3" />
                {reportCopied ? t("common.copied") : t("common.copy")}
              </button>
            </div>
            <div className="rounded-xl p-3 text-xs t2 leading-relaxed whitespace-pre-wrap font-sans"
              style={{ background: "hsl(var(--bg-input))" }}>
              {reportText}
            </div>
          </motion.div>
        )}
      </section>

      {/* ── AI Coach section ────────────────────────────────────── */}
      <AICoachSection locale={locale} />

    </div>
    </PlanGate>
  );
}

// ── AI Coach ─────────────────────────────────────────────────

type CoachPeriod = "daily" | "weekly" | "monthly";

const COACH_TABS: { value: CoachPeriod; label: string; icon: React.ElementType }[] = [
  { value: "daily",   label: "يومي",    icon: Activity },
  { value: "weekly",  label: "أسبوعي",  icon: BarChart3 },
  { value: "monthly", label: "شهري",    icon: LineChart },
];

function AICoachSection({ locale }: { locale: string }) {
  const [period,   setPeriod]   = useState<CoachPeriod>("daily");
  const [coaching, setCoaching] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function fetchCoaching() {
    setLoading(true); setError(""); setCoaching("");
    try {
      const res = await safeFetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, language: locale }),
      });
      const d = await res.json();
      if (d.ok) setCoaching(d.coaching);
      else setError(d.error ?? "فشل التحميل");
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-violet-400" />
        <p className="text-sm font-black t1">المدرب المالي</p>
      </div>

      {/* Period tabs */}
      <div className="flex gap-2 mb-3">
        {COACH_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.value} onClick={() => setPeriod(tab.value)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                period === tab.value
                  ? "bg-violet-400/10 border border-violet-400/30 text-violet-400"
                  : "border border-[hsl(var(--border))] t3 hover:t2"
              }`}>
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="card p-4 space-y-3">
        {!coaching && !loading && !error && (
          <div className="text-center py-6">
            <Brain className="w-10 h-10 t3 mx-auto mb-2" />
            <p className="text-xs t3 mb-4">احصل على تحليل مالي مخصص بناءً على بياناتك</p>
            <button onClick={fetchCoaching}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-500 to-purple-600">
              <Sparkles className="w-4 h-4" />
              ابدأ جلسة التدريب
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            <p className="text-xs t3">جارٍ تحليل بياناتك...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {coaching && (
          <>
            <div className="prose-none text-sm t2 leading-relaxed whitespace-pre-wrap">{coaching}</div>
            <div className="flex gap-2 pt-2 border-t border-[hsl(var(--border))]">
              <button onClick={fetchCoaching}
                className="flex items-center gap-1.5 text-xs t3 hover:t1 transition-colors">
                <RefreshCw className="w-3 h-3" /> تحديث
              </button>
              <button onClick={() => navigator.clipboard?.writeText(coaching)}
                className="flex items-center gap-1.5 text-xs t3 hover:t1 transition-colors">
                <Copy className="w-3 h-3" /> نسخ
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

