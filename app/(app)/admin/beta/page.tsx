"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, Activity, Zap, BarChart3, CheckCircle2, XCircle,
  AlertTriangle, Loader2, Copy, Plus, RefreshCw, Lock,
  TrendingUp, Star, Shield,
} from "lucide-react";
import { getAuthToken } from "@/lib/auth/token-store";

// ── Types ──────────────────────────────────────────────────────

interface InviteCode { id: string; code: string; label?: string; use_count: number; max_uses: number; used_at?: string }
interface FeatureStat { feature: string; sessions: number; uniqueUsers: number }
interface PerfResult  { page: string; metric: string; p75: number; rating: string }
interface RetentionData { day1: number | null; day7: number | null; day30: number | null; cohortSize: number }
interface ConversionData { funnel: { label: string; count: number; pct: number }[]; paidConversionPct: number; upgradesLast30Days: number }
interface AuditCriterion { name: string; target: string; actual: string; pass: boolean; severity: string }
interface AuditData { overallStatus: string; recommendation: string; criteria: AuditCriterion[]; topIssues: string[]; topRequests: string[]; summary: Record<string, unknown> }

const TABS = [
  { id: "overview",    label: "نظرة عامة", icon: Activity },
  { id: "features",   label: "الميزات",   icon: Zap },
  { id: "performance",label: "الأداء",    icon: BarChart3 },
  { id: "retention",  label: "الاحتفاظ", icon: TrendingUp },
  { id: "audit",      label: "التدقيق",   icon: Shield },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Page ──────────────────────────────────────────────────────

export default function BetaAdminPage() {
  const [tab,    setTab]    = useState<TabId>("overview");
  const [access, setAccess] = useState<"loading" | "granted" | "denied">("loading");

  // Data states
  const [invites,     setInvites]     = useState<InviteCode[]>([]);
  const [features,    setFeatures]    = useState<FeatureStat[]>([]);
  const [perf,        setPerf]        = useState<PerfResult[]>([]);
  const [retention,   setRetention]   = useState<RetentionData | null>(null);
  const [conversion,  setConversion]  = useState<ConversionData | null>(null);
  const [audit,       setAudit]       = useState<AuditData | null>(null);

  // Invite form
  const [newLabel, setNewLabel] = useState("");
  const [newCount, setNewCount] = useState("5");
  const [creating, setCreating] = useState(false);
  const [copied,   setCopied]   = useState<string | null>(null);

  const [loading, setLoading] = useState<Partial<Record<TabId, boolean>>>({});

  const token = getAuthToken();
  const h     = { Authorization: `Bearer ${token}` };

  async function api<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url, { headers: h });
      if (res.status === 403) { setAccess("denied"); return null; }
      const d = await res.json();
      return d.ok ? d.data : null;
    } catch { return null; }
  }

  const loadTab = useCallback(async (t: TabId) => {
    setLoading(p => ({ ...p, [t]: true }));
    if (t === "overview") {
      const data = await api<InviteCode[]>("/api/beta/invite");
      if (data) { setInvites(data); setAccess("granted"); }
      else if (access === "loading") setAccess("denied");
      const conv = await api<ConversionData>("/api/analytics/conversion");
      if (conv) setConversion(conv);
    }
    if (t === "features") {
      const data = await api<{ features: FeatureStat[] }>("/api/analytics/features?days=30");
      if (data) setFeatures(data.features);
    }
    if (t === "performance") {
      const data = await api<PerfResult[]>("/api/analytics/performance?days=7");
      if (data) setPerf(data);
    }
    if (t === "retention") {
      const data = await api<RetentionData>("/api/analytics/retention");
      if (data) setRetention(data);
    }
    if (t === "audit") {
      const data = await api<AuditData>("/api/launch/audit");
      if (data) setAudit(data);
    }
    setLoading(p => ({ ...p, [t]: false }));
  }, [access]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadTab("overview"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (access === "granted") loadTab(tab);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createInvites() {
    setCreating(true);
    const res = await fetch("/api/beta/invite", {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel || undefined, count: parseInt(newCount) || 5 }),
    });
    const d = await res.json();
    if (d.ok) { setNewLabel(""); await loadTab("overview"); }
    setCreating(false);
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(`${window.location.origin}/beta?code=${code}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  if (access === "loading") return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;
  if (access === "denied")  return (
    <div className="card p-12 text-center">
      <Lock className="w-10 h-10 text-red-400 mx-auto mb-3" />
      <p className="text-sm font-black t1">وصول مرفوض</p>
    </div>
  );

  const isLoading = (t: TabId) => loading[t] === true;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black t1">لوحة البيتا</h1>
          <p className="text-xs t3 mt-0.5">Beta Program Management</p>
        </div>
        <button onClick={() => loadTab(tab)} className="p-2.5 rounded-xl border border-[hsl(var(--border))] t3 hover:t1 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold shrink-0 transition-all ${
                tab === t.id
                  ? "bg-purple-400/10 border border-purple-400/30 text-purple-400"
                  : "border border-[hsl(var(--border))] t3 hover:t2"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Overview ─────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "بيتا يوزرز", value: invites.filter(i => i.use_count > 0).length, color: "text-cyan-400" },
              { label: "Invite Codes", value: invites.length, color: "t1" },
              { label: "تحويل مدفوع", value: conversion ? `${conversion.paidConversionPct}%` : "—", color: "text-emerald-400" },
              { label: "ترقيات 30 يوم", value: conversion?.upgradesLast30Days ?? "—", color: "text-purple-400" },
            ].map(kpi => (
              <div key={kpi.label} className="card p-3 text-center">
                <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] t3 mt-1">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Conversion funnel */}
          {conversion && (
            <div className="card p-4 space-y-3">
              <p className="text-xs font-bold t3">Subscription Funnel</p>
              {conversion.funnel.map(tier => (
                <div key={tier.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold t1">{tier.label}</span>
                    <span className="t3">{tier.count} · {tier.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[hsl(var(--bg-input))]">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all" style={{ width: `${Math.max(tier.pct, 1)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create invites */}
          <div className="card p-4 space-y-3">
            <p className="text-xs font-bold t1">إنشاء رموز دعوة</p>
            <div className="flex gap-2">
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                placeholder="اسم الدفعة (مثلاً: Twitter Batch 1)" className="input-field flex-1 text-xs" />
              <input value={newCount} onChange={e => setNewCount(e.target.value)}
                type="number" min="1" max="50" className="input-field w-16 text-xs text-center" />
              <button onClick={createInvites} disabled={creating}
                className="rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 px-3 text-xs font-bold flex items-center gap-1.5">
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                إنشاء
              </button>
            </div>
          </div>

          {/* Invite list */}
          {isLoading("overview") ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] t3 font-bold uppercase tracking-wider">رموز الدعوة</p>
              {invites.slice(0, 50).map(inv => (
                <div key={inv.id} className="card p-3 flex items-center gap-3">
                  <p className="font-mono text-sm font-bold t1 flex-1">{inv.code}</p>
                  {inv.label && <p className="text-xs t3 truncate max-w-[120px]">{inv.label}</p>}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    inv.use_count >= inv.max_uses
                      ? "bg-emerald-400/10 text-emerald-400"
                      : "bg-slate-400/10 text-slate-400"
                  }`}>
                    {inv.use_count}/{inv.max_uses}
                  </span>
                  <button onClick={() => copyCode(inv.code)}
                    className="p-1.5 rounded-lg t3 hover:t1 transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copied === inv.code && <span className="text-[10px] text-emerald-400 shrink-0">نُسخ!</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Features ─────────────────────────────────────────────── */}
      {tab === "features" && (
        <div className="space-y-3">
          <p className="text-xs t3">الميزات الأكثر استخداماً خلال 30 يوم — بناءً على بيانات أداء الصفحات</p>
          {isLoading("features") ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>
          ) : features.length === 0 ? (
            <div className="card p-8 text-center t3 text-xs">لا بيانات بعد — تتوفر بعد جمع بيانات الأداء</div>
          ) : (
            <>
              {features.slice(0, 20).map((f, i) => {
                const maxSessions = features[0]?.sessions ?? 1;
                const pct         = Math.round((f.sessions / maxSessions) * 100);
                return (
                  <div key={f.feature} className="card p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] t3 font-mono w-5">{i + 1}</span>
                        <p className="text-xs font-semibold t1">{f.feature}</p>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] t3">
                        <span>{f.sessions} sessions</span>
                        <span>{f.uniqueUsers} users</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-[hsl(var(--bg-input))]">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="card p-3 border border-amber-400/20 bg-amber-400/5">
                <p className="text-xs t2">
                  <strong className="text-amber-400">تحذير:</strong>{" "}
                  الميزات الأقل من 5 جلسات قد لا تكون مستخدمة فعلياً — قيّم إزالتها بعد 60 يوم من البيتا.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Performance ──────────────────────────────────────────── */}
      {tab === "performance" && (
        <div className="space-y-3">
          <p className="text-xs t3">مقاييس Core Web Vitals — P75 من بيانات المستخدمين الحقيقيين</p>
          {isLoading("performance") ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>
          ) : perf.length === 0 ? (
            <div className="card p-8 text-center t3 text-xs">لا بيانات أداء — PerformanceTracker يجمع البيانات تلقائياً</div>
          ) : (
            <div className="space-y-2">
              {perf.map((r, i) => (
                <div key={i} className="card p-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    r.rating === "good" ? "bg-emerald-400"
                    : r.rating === "needs_improvement" ? "bg-amber-400"
                    : "bg-red-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold t1 truncate">{r.page}</p>
                    <p className="text-[10px] t3">{r.metric.toUpperCase()}</p>
                  </div>
                  <p className={`text-sm font-black shrink-0 ${
                    r.rating === "good" ? "text-emerald-400"
                    : r.rating === "needs_improvement" ? "text-amber-400"
                    : "text-red-400"
                  }`}>{r.p75}ms</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Retention ────────────────────────────────────────────── */}
      {tab === "retention" && (
        <div className="space-y-4">
          {isLoading("retention") ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>
          ) : retention ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Day 1",  value: retention.day1,  target: 40 },
                  { label: "Day 7",  value: retention.day7,  target: 20 },
                  { label: "Day 30", value: retention.day30, target: 10 },
                ].map(({ label, value, target }) => {
                  const pass = value !== null && value >= target;
                  return (
                    <div key={label} className="card p-4 text-center space-y-1">
                      <p className={`text-2xl font-black ${
                        value === null ? "t3"
                        : pass ? "text-emerald-400"
                        : "text-amber-400"
                      }`}>
                        {value !== null ? `${value}%` : "—"}
                      </p>
                      <p className="text-xs font-bold t1">{label}</p>
                      <p className="text-[10px] t3">هدف: {target}%+</p>
                    </div>
                  );
                })}
              </div>
              <div className="card p-3">
                <p className="text-xs t3">حجم المجموعة: <strong className="t1">{retention.cohortSize}</strong> مستخدم</p>
              </div>
              <div className="card p-4 border border-cyan-400/20 bg-cyan-400/5 space-y-1.5">
                <p className="text-xs font-bold text-cyan-400">كيف تُقرأ هذه الأرقام؟</p>
                <p className="text-xs t3 leading-relaxed">Day 1 = % المستخدمين الذين عادوا بعد التسجيل. Day 7 = عادوا في الأسبوع الثاني. Day 30 = مستخدمون نشطون بعد شهر. الهدف: Day 30 {">"}30% قبل التوسع.</p>
              </div>
            </>
          ) : (
            <div className="card p-8 text-center t3 text-xs">لا بيانات — تتوفر بعد تسجيل المستخدمين</div>
          )}
        </div>
      )}

      {/* ── Launch Audit ─────────────────────────────────────────── */}
      {tab === "audit" && (
        <div className="space-y-4">
          {isLoading("audit") ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              <p className="text-xs t3">جارٍ تدقيق معايير الإطلاق...</p>
            </div>
          ) : audit ? (
            <>
              {/* Status banner */}
              <div className={`card p-4 text-center ${
                audit.overallStatus === "GO"             ? "border-emerald-400/30 bg-emerald-400/5"
                : audit.overallStatus === "NO_GO"        ? "border-red-400/30 bg-red-400/5"
                : "border-amber-400/30 bg-amber-400/5"
              }`}>
                <p className={`text-2xl font-black mb-1 ${
                  audit.overallStatus === "GO" ? "text-emerald-400"
                  : audit.overallStatus === "NO_GO" ? "text-red-400" : "text-amber-400"
                }`}>{audit.overallStatus.replace("_", " ")}</p>
                <p className="text-xs t2">{audit.recommendation}</p>
              </div>

              {/* Criteria */}
              <div className="space-y-2">
                <p className="text-[10px] t3 font-bold uppercase tracking-wider">معايير النجاح</p>
                {audit.criteria.map(c => (
                  <div key={c.name} className="card p-3 flex items-start gap-3">
                    {c.pass
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      : c.severity === "critical"
                      ? <XCircle      className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <p className="text-xs font-semibold t1">{c.name}</p>
                      <p className="text-[10px] t3">هدف: {c.target} · فعلي: {c.actual}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top issues */}
              {audit.topIssues.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] t3 font-bold uppercase tracking-wider">أبرز المشاكل المفتوحة</p>
                  {audit.topIssues.slice(0, 10).map((issue, i) => (
                    <div key={i} className="card p-2.5 flex gap-2">
                      <span className="text-[10px] t3 font-mono w-4">{i + 1}</span>
                      <p className="text-xs t2">{issue}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Top requests */}
              {audit.topRequests.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] t3 font-bold uppercase tracking-wider">أكثر الميزات المطلوبة</p>
                  {audit.topRequests.slice(0, 10).map((req, i) => (
                    <div key={i} className="card p-2.5 flex gap-2">
                      <Star className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs t2">{req}</p>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => loadTab("audit")}
                className="w-full rounded-xl border border-[hsl(var(--border))] py-2.5 text-xs font-bold t2">
                إعادة تشغيل التدقيق
              </button>
            </>
          ) : (
            <div className="card p-8 text-center">
              <button onClick={() => loadTab("audit")} className="text-xs t3 hover:t1">تشغيل تدقيق الإطلاق</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
