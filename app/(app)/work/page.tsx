"use client";

import { useState, useMemo } from "react";
import {
  Plus, Clock, DollarSign, TrendingUp, Loader2,
  Pencil, Trash2, Briefcase, BarChart3, RefreshCcw,
  ExternalLink, CheckCircle2, AlertCircle, Timer,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area,
} from "recharts";
import { format as fmtDate } from "date-fns";
import {
  type WorkSession, type WorkPayment,
  type WorkSessionFormData, type WorkPaymentFormData, type WorkSessionStatus,
} from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/useToast";
import ToastList from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import WorkSessionForm from "@/components/work/WorkSessionForm";
import WorkPaymentForm from "@/components/work/WorkPaymentForm";
import Link from "next/link";
import {
  useWorkSessions, useWorkPayments,
  useCreateWorkSession, useUpdateWorkSession, useDeleteWorkSession,
  useCreateWorkPayment, useUpdateWorkPayment, useDeleteWorkPayment,
} from "@/lib/query/hooks";

type Tab = "sessions" | "payments" | "recurring" | "statistics";

const STATUS_CFG: Record<WorkSessionStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  paid:           { label: "paid",    color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", icon: CheckCircle2 },
  partially_paid: { label: "partial", color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20",   icon: Clock        },
  unpaid:         { label: "unpaid",  color: "text-rose-400",    bg: "bg-rose-400/10",    border: "border-rose-400/20",    icon: AlertCircle  },
};

function computeStatus(session: WorkSession, payments: WorkPayment[]): WorkSessionStatus {
  const paid = payments.filter((p) => p.work_session_id === session.id).reduce((s, p) => s + Number(p.amount), 0);
  if (paid <= 0) return "unpaid";
  if (paid >= Number(session.expected_amount)) return "paid";
  return "partially_paid";
}

function paidPct(session: WorkSession, payments: WorkPayment[]): number {
  const paid = payments.filter((p) => p.work_session_id === session.id).reduce((s, p) => s + Number(p.amount), 0);
  const exp  = Number(session.expected_amount);
  return exp > 0 ? Math.min(100, Math.round((paid / exp) * 100)) : 0;
}

export default function WorkPage() {
  const { t }      = useTranslation();
  const { format, symbol } = useCurrency();
  const { theme }  = useTheme();
  const { toasts, addToast, dismiss } = useToast();

  const [tab, setTab]                         = useState<Tab>("sessions");
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editSession, setEditSession]         = useState<WorkSession | undefined>();
  const [editPayment, setEditPayment]         = useState<WorkPayment | undefined>();
  const [confirmSession, setConfirmSession]   = useState<string | null>(null);
  const [confirmPayment, setConfirmPayment]   = useState<string | null>(null);

  const { data: rawSessions = [], isLoading: sessionsLoading } = useWorkSessions();
  const { data: payments = [],    isLoading: paymentsLoading } = useWorkPayments();
  const loading = sessionsLoading || paymentsLoading;

  const sessions: WorkSession[] = useMemo(() =>
    rawSessions.map((s) => {
      const paidAmt = payments.filter((p) => p.work_session_id === s.id).reduce((a, p) => a + Number(p.amount), 0);
      return { ...s, status: computeStatus(s, payments), paid_amount: paidAmt };
    }),
    [rawSessions, payments]
  );

  const createSession  = useCreateWorkSession();
  const updateSession  = useUpdateWorkSession();
  const deleteSession  = useDeleteWorkSession();
  const createPayment  = useCreateWorkPayment();
  const updatePayment  = useUpdateWorkPayment();
  const deletePaymentM = useDeleteWorkPayment();

  async function handleSessionSubmit(data: WorkSessionFormData) {
    try {
      if (editSession) { await updateSession.mutateAsync({ id: editSession.id, data }); addToast(t("work.session_updated"), "success"); }
      else             { await createSession.mutateAsync(data); addToast(t("work.session_created"), "success"); }
      setShowSessionForm(false); setEditSession(undefined);
    } catch { addToast(t("common.unknown_error"), "error"); throw new Error("failed"); }
  }

  async function handleDeleteSession() {
    if (!confirmSession) return;
    const id = confirmSession; setConfirmSession(null);
    try { await deleteSession.mutateAsync(id); addToast(t("work.session_deleted"), "success"); }
    catch { addToast(t("common.unknown_error"), "error"); }
  }

  async function handlePaymentSubmit(data: WorkPaymentFormData) {
    try {
      if (editPayment) { await updatePayment.mutateAsync({ id: editPayment.id, data }); }
      else             { await createPayment.mutateAsync(data); }
      addToast(t("work.payment_created"), "success");
      setShowPaymentForm(false); setEditPayment(undefined);
    } catch { addToast(t("common.unknown_error"), "error"); throw new Error("failed"); }
  }

  async function handleDeletePayment() {
    if (!confirmPayment) return;
    const id = confirmPayment; setConfirmPayment(null);
    try { await deletePaymentM.mutateAsync(id); addToast(t("work.payment_deleted"), "success"); }
    catch { addToast(t("common.unknown_error"), "error"); }
  }

  // ── Stats ─────────────────────────────────────────────────────
  const now  = new Date();
  const mnth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const totalHoursAll   = useMemo(() => sessions.reduce((s, x) => s + Number(x.hours_worked), 0), [sessions]);
  const totalHoursMonth = useMemo(() => sessions.filter((s) => s.work_date.startsWith(mnth)).reduce((s, x) => s + Number(x.hours_worked), 0), [sessions, mnth]);
  const totalExpected   = useMemo(() => sessions.reduce((s, x) => s + Number(x.expected_amount), 0), [sessions]);
  const totalReceived   = useMemo(() => payments.reduce((s, x) => s + Number(x.amount), 0), [payments]);
  const unpaidBalance   = Math.max(0, totalExpected - totalReceived);
  const avgHourlyRate   = sessions.length > 0 ? sessions.reduce((s, x) => s + Number(x.hourly_rate), 0) / sessions.length : 0;
  const collectionRate  = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

  const hoursChart = useMemo(() => {
    const byMonth: Record<string, number> = {};
    sessions.forEach((s) => { const k = s.work_date.slice(0, 7); byMonth[k] = (byMonth[k] ?? 0) + Number(s.hours_worked); });
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([m, h]) => ({ month: fmtDate(new Date(`${m}-01`), "MMM yy"), hours: +h.toFixed(1) }));
  }, [sessions]);

  const incomeChart = useMemo(() => {
    const byMonth: Record<string, number> = {};
    payments.forEach((p) => { const k = p.payment_date.slice(0, 7); byMonth[k] = (byMonth[k] ?? 0) + Number(p.amount); });
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([m, v]) => ({ month: fmtDate(new Date(`${m}-01`), "MMM yy"), income: v }));
  }, [payments]);

  const recurSessions = useMemo(() => sessions.filter((s) => s.recurrence !== "none"), [sessions]);

  const gridColor  = theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tickColor  = theme === "dark" ? "#4B5563" : "#94A3B8";
  const tooltipBg  = theme === "dark" ? "#1a2235" : "#ffffff";
  const tooltipBor = theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

  const deletingSession = deleteSession.isPending ? (deleteSession.variables as string) : null;
  const deletingPayment = deletePaymentM.isPending ? (deletePaymentM.variables as string) : null;

  const TABS: { value: Tab; icon: React.ElementType; key: string }[] = [
    { value: "sessions",   icon: Clock,      key: "work.sessions"   },
    { value: "payments",   icon: DollarSign, key: "work.payments"   },
    { value: "recurring",  icon: RefreshCcw, key: "work.recurring"  },
    { value: "statistics", icon: BarChart3,  key: "work.statistics" },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-400/10">
            <Briefcase className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold t1">{t("work.title")}</h1>
            <p className="text-xs t3 mt-0.5">{t("work.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { setEditPayment(undefined); setShowPaymentForm(true); }}
            className="btn-ghost text-xs">
            <DollarSign className="w-3.5 h-3.5" />{t("work.add_payment")}
          </button>
          <button onClick={() => { setEditSession(undefined); setShowSessionForm(true); }}
            className="btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" />{t("work.add_session")}
          </button>
        </div>
      </div>

      {/* ── Hero banner ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[1.5rem] border border-[hsl(var(--border))] p-5 sm:p-6"
        style={{ background: "linear-gradient(135deg, #071820 0%, #0B1F1A 50%, #101420 100%)" }}>
        <div className="relative z-10 grid gap-5 sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_1fr]">

          {/* Total hours */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 mb-2">
              {t("work.total_hours") || "إجمالي ساعات العمل"}
            </p>
            <div className="flex items-end gap-3">
              <p className="text-4xl font-black text-white number-display">{totalHoursAll.toFixed(1)}</p>
              <span className="mb-1 text-base font-bold text-cyan-400">{t("work.hours_unit") || "ساعة"}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-400/10 border border-cyan-400/20">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span className="text-[11px] font-semibold text-cyan-400">
                  {totalHoursMonth.toFixed(1)}h {t("work.this_month") || "هذا الشهر"}
                </span>
              </div>
            </div>
          </div>

          {/* Collection rate */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 mb-2">
              {t("work.collection_rate") || "نسبة التحصيل"}
            </p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-black text-white number-display">{collectionRate}</p>
              <span className="mb-1 text-base font-bold text-emerald-400">%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                style={{ width: `${collectionRate}%` }} />
            </div>
            <p className="mt-1.5 text-[10px] text-white/35">
              {format(totalReceived)} / {format(totalExpected)}
            </p>
          </div>

          {/* Avg rate */}
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 mb-2">
              {t("work.avg_hourly") || "متوسط الأجر"}
            </p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-black text-white number-display">{avgHourlyRate.toFixed(0)}</p>
              <span className="mb-1 text-sm font-bold text-amber-400">{symbol}/h</span>
            </div>
            {unpaidBalance > 0 && (
              <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-400/10 border border-rose-400/20 w-fit">
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span className="text-[11px] font-semibold text-rose-400">
                  {format(unpaidBalance)} {t("work.unpaid_balance") || "غير محصّل"}
                </span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t("work.hours_this_month"), value: `${totalHoursMonth.toFixed(1)}h`, sub: `${t("work.total_hours") || "إجمالي"} ${totalHoursAll.toFixed(1)}h`, color: "text-cyan-400",    bg: "bg-cyan-400/10",    icon: Timer      },
          { label: t("work.income_expected"),  value: format(totalExpected),            sub: `${sessions.length} ${t("work.sessions")}`,                          color: "text-amber-400",   bg: "bg-amber-400/10",   icon: TrendingUp },
          { label: t("work.income_received"),  value: format(totalReceived),            sub: `${payments.length} ${t("work.payments")}`,                          color: "text-emerald-400", bg: "bg-emerald-400/10", icon: DollarSign },
          { label: t("work.unpaid_balance"),   value: format(unpaidBalance),            sub: `${collectionRate}% ${t("work.collection_rate") || "محصّل"}`,         color: "text-rose-400",    bg: "bg-rose-400/10",    icon: Briefcase  },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] t3 uppercase tracking-wide font-semibold leading-tight">{k.label}</p>
              <div className={`p-1.5 rounded-xl ${k.bg}`}><k.icon className={`w-3.5 h-3.5 ${k.color}`} /></div>
            </div>
            <p className={`text-xl font-bold number-display ${k.color}`}>{k.value}</p>
            <p className="text-[10px] t3 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map((tb) => (
          <button key={tb.value} onClick={() => setTab(tb.value)}
            className={`tab-pill shrink-0 flex items-center gap-1.5 ${tab === tb.value ? "active" : ""}`}>
            <tb.icon className="w-3 h-3" />{t(tb.key)}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-16 flex items-center justify-center gap-2 t3">
          <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">{t("common.loading")}</span>
        </div>
      )}

      {/* ── Sessions ───────────────────────────────────────────── */}
      {!loading && tab === "sessions" && (
        <div className="space-y-3">
          {sessions.filter((s) => s.recurrence === "none").length === 0 ? (
            <div className="card py-16 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-400/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-cyan-400 opacity-50" />
              </div>
              <p className="text-sm t3">{t("work.no_sessions")}</p>
              <button onClick={() => setShowSessionForm(true)} className="text-sm text-cyan-400 hover:underline">
                {t("work.add_session")}
              </button>
            </div>
          ) : (
            sessions.filter((s) => s.recurrence === "none").map((s) => {
              const status  = s.status ?? "unpaid";
              const cfg     = STATUS_CFG[status];
              const pct     = paidPct(s, payments);
              const StatusIcon = cfg.icon;
              return (
                <div key={s.id}
                  className={`card p-4 transition-opacity ${deletingSession === s.id ? "opacity-40 pointer-events-none" : ""}`}>
                  <div className="flex items-start gap-3">
                    {/* Hours circle */}
                    <div className="shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border-2))]">
                      <p className="text-base font-black text-cyan-400 number-display leading-none">{Number(s.hours_worked).toFixed(1)}</p>
                      <p className="text-[9px] t3 font-semibold mt-0.5">h</p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold t1">{s.title}</p>
                        <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          {t(`work.status_${status}`)}
                        </span>
                      </div>
                      <p className="text-xs t2 mt-0.5">{s.employer_or_client}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs t3 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Number(s.hours_worked).toFixed(1)}h × {symbol}{Number(s.hourly_rate).toFixed(0)}/h
                        </span>
                        <span className="text-xs font-bold text-emerald-400 number-display">
                          = {format(s.expected_amount)}
                        </span>
                        <span className="text-[11px] t3">{s.work_date}</span>
                      </div>

                      {/* Payment progress bar */}
                      {status !== "unpaid" && (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] t3">{t("work.paid_progress") || "المدفوع"}</span>
                            <span className={`text-[10px] font-bold ${cfg.color}`}>{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[hsl(var(--bg-input))] overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${status === "paid" ? "bg-emerald-400" : "bg-amber-400"}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setEditSession(s); setShowSessionForm(true); }}
                        className="p-1.5 t3 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-xl transition-all">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmSession(s.id)}
                        className="p-1.5 t3 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {s.notes && <p className="text-xs t3 mt-2.5 ps-[68px]">{s.notes}</p>}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Payments ───────────────────────────────────────────── */}
      {!loading && tab === "payments" && (
        <div className="space-y-3">
          {payments.length === 0 ? (
            <div className="card py-16 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-400 opacity-50" />
              </div>
              <p className="text-sm t3">{t("work.no_payments")}</p>
              <button onClick={() => setShowPaymentForm(true)} className="text-sm text-emerald-400 hover:underline">
                {t("work.add_payment")}
              </button>
            </div>
          ) : (
            payments.map((p) => (
              <div key={p.id}
                className={`card p-4 transition-opacity ${deletingPayment === p.id ? "opacity-40 pointer-events-none" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-10 h-10 rounded-2xl bg-emerald-400/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-emerald-400 number-display">+{format(p.amount)}</span>
                      <span className="text-xs t2">{p.employer_or_client}</span>
                    </div>
                    <p className="text-[11px] t3 mt-0.5">{p.payment_date}{p.notes && ` · ${p.notes}`}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.transaction_id && (
                      <Link href="/transactions?source=work_payment"
                        className="p-1.5 t3 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-xl transition-all"
                        title={t("work.view_transaction")}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    )}
                    <button onClick={() => setConfirmPayment(p.id)}
                      className="p-1.5 t3 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Recurring ──────────────────────────────────────────── */}
      {!loading && tab === "recurring" && (
        <div className="space-y-3">
          {recurSessions.length === 0 ? (
            <div className="card py-16 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-400/10 flex items-center justify-center">
                <RefreshCcw className="w-5 h-5 text-purple-400 opacity-50" />
              </div>
              <p className="text-sm t3">{t("work.no_recurring")}</p>
            </div>
          ) : (
            recurSessions.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border-2))]">
                    <p className="text-base font-black text-purple-400 number-display leading-none">{Number(s.hours_worked).toFixed(1)}</p>
                    <p className="text-[9px] t3 font-semibold mt-0.5">h</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold t1">{s.title}</p>
                    <p className="text-xs t2 mt-0.5">{s.employer_or_client}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="badge badge-neutral text-[10px]">{t(`work.recurrence_${s.recurrence}`)}</span>
                      <span className="text-xs t3">{Number(s.hours_worked).toFixed(1)}h × {symbol}{Number(s.hourly_rate).toFixed(0)}/h</span>
                      <span className="text-xs font-bold text-purple-400 number-display">= {format(s.expected_amount)}</span>
                    </div>
                  </div>
                  <button onClick={() => { setEditSession(s); setShowSessionForm(true); }}
                    className="p-1.5 t3 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-xl transition-all shrink-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Statistics ─────────────────────────────────────────── */}
      {!loading && tab === "statistics" && (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t("work.avg_hourly") || "متوسط الأجر/ساعة", value: `${symbol}${avgHourlyRate.toFixed(2)}/h`, color: "text-cyan-400" },
              { label: t("work.total_sessions") || "إجمالي الجلسات", value: `${sessions.length}`, color: "text-amber-400" },
              { label: t("work.collection_rate") || "نسبة التحصيل", value: `${collectionRate}%`, color: "text-emerald-400" },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <p className={`text-xl font-black number-display ${s.color}`}>{s.value}</p>
                <p className="text-[10px] t3 mt-1 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Hours chart */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-xl bg-cyan-400/10"><Timer className="w-4 h-4 text-cyan-400" /></div>
              <h3 className="text-sm font-bold t1">{t("work.hours_chart")}</h3>
            </div>
            {hoursChart.length === 0 ? (
              <p className="text-xs t3 text-center py-8">{t("work.no_sessions")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hoursChart} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} unit="h" />
                  <Tooltip
                    contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBor}`, borderRadius: 12 }}
                    labelStyle={{ color: tickColor }} itemStyle={{ color: "#22d3ee" }}
                    formatter={(v: number) => [`${v}h`, t("work.hours_chart")]}
                  />
                  <Bar dataKey="hours" name={t("work.hours_chart")} fill="#22d3ee" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Income chart */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-xl bg-emerald-400/10"><TrendingUp className="w-4 h-4 text-emerald-400" /></div>
              <h3 className="text-sm font-bold t1">{t("work.income_chart")}</h3>
            </div>
            {incomeChart.length === 0 ? (
              <p className="text-xs t3 text-center py-8">{t("work.no_payments")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={incomeChart} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={(v) => `${symbol}${v}`} />
                  <Tooltip
                    contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBor}`, borderRadius: 12 }}
                    labelStyle={{ color: tickColor }} itemStyle={{ color: "#10B981" }}
                    formatter={(v: number) => [format(v), t("work.income_chart")]}
                  />
                  <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2}
                    fill="url(#incomeGrad)" dot={false} activeDot={{ r: 4, fill: "#10B981" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {showSessionForm && (
        <WorkSessionForm initial={editSession} onSubmit={handleSessionSubmit}
          onClose={() => { setShowSessionForm(false); setEditSession(undefined); }} />
      )}
      {showPaymentForm && (
        <WorkPaymentForm initial={editPayment} sessions={sessions} onSubmit={handlePaymentSubmit}
          onClose={() => { setShowPaymentForm(false); setEditPayment(undefined); }} />
      )}
      {confirmSession && (
        <ConfirmModal message={t("work.confirm_delete_session")} loading={deleteSession.isPending}
          onConfirm={handleDeleteSession} onCancel={() => setConfirmSession(null)} />
      )}
      {confirmPayment && (
        <ConfirmModal message={t("work.confirm_delete_payment")} loading={deletePaymentM.isPending}
          onConfirm={handleDeletePayment} onCancel={() => setConfirmPayment(null)} />
      )}
      <ToastList toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
