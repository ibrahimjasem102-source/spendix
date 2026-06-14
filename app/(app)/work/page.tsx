"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, DollarSign, TrendingUp, Loader2,
  Pencil, Trash2, Briefcase, BarChart3, RefreshCcw,
  ExternalLink, CheckCircle2, AlertCircle, Timer,
  ArrowUpRight, Zap,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
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
import { spring, tapTransition } from "@/lib/motion";
import ToastList from "@/components/ui/Toast";
import PlanGate from "@/components/plans/PlanGate";
import ConfirmModal from "@/components/ui/ConfirmModal";
import WorkForm from "@/components/work/WorkForm";
import Link from "next/link";
import {
  useWorkSessions, useWorkPayments,
  useCreateWorkSession, useUpdateWorkSession, useDeleteWorkSession,
  useCreateWorkPayment, useUpdateWorkPayment, useDeleteWorkPayment,
} from "@/lib/query/hooks";

// â”€â”€ Types & constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Tab = "sessions" | "payments" | "recurring" | "statistics";

const STATUS: Record<WorkSessionStatus, {
  color: string; bg: string; border: string; bar: string;
  icon: React.ElementType; labelKey: string;
}> = {
  paid:    { color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.25)",  bar: "#34d399", icon: CheckCircle2, labelKey: "work.status_paid"    },
  pending: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.25)",  bar: "#fbbf24", icon: Clock,        labelKey: "work.status_pending" },
  overdue: { color: "#fb7185", bg: "rgba(251,113,133,0.08)", border: "rgba(251,113,133,0.25)", bar: "#fb7185", icon: AlertCircle,  labelKey: "work.status_overdue" },
};

const today = new Date().toISOString().split("T")[0];

function getStatus(s: WorkSession, payments: WorkPayment[]): WorkSessionStatus {
  const paid = payments.filter((p) => p.work_session_id === s.id).reduce((a, p) => a + Number(p.amount), 0);
  if (Number(s.expected_amount) > 0 && paid >= Number(s.expected_amount)) return "paid";
  if (s.due_date && s.due_date < today) return "overdue";
  return "pending";
}

function paidPct(s: WorkSession, payments: WorkPayment[]) {
  const paid = payments.filter((p) => p.work_session_id === s.id).reduce((a, p) => a + Number(p.amount), 0);
  const exp  = Number(s.expected_amount);
  return exp > 0 ? Math.min(100, Math.round((paid / exp) * 100)) : 0;
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function WorkPage() {
  const { t }               = useTranslation();
  const { format, symbol }  = useCurrency();
  const { theme }           = useTheme();
  const { toasts, addToast, dismiss } = useToast();

  const [tab, setTab]                   = useState<Tab>("sessions");
  const [showWorkForm, setShowWorkForm] = useState(false);
  const [workFormTab, setWorkFormTab]   = useState<"session" | "payment">("session");
  const [editSession, setEditSession]   = useState<WorkSession | undefined>();
  const [editPayment, setEditPayment]   = useState<WorkPayment | undefined>();
  const [confirmSession, setConfirmSession] = useState<string | null>(null);
  const [confirmPayment, setConfirmPayment] = useState<string | null>(null);

  const { data: rawSessions = [], isLoading: sessionsLoading } = useWorkSessions();
  const { data: payments = [],    isLoading: paymentsLoading } = useWorkPayments();
  const loading = sessionsLoading || paymentsLoading;

  const sessions = useMemo(() =>
    rawSessions.map((s) => ({
      ...s,
      status:      getStatus(s, payments),
      paid_amount: payments.filter((p) => p.work_session_id === s.id).reduce((a, p) => a + Number(p.amount), 0),
    })),
    [rawSessions, payments],
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
    } catch { addToast(t("common.unknown_error"), "error"); throw new Error("failed"); }
  }

  async function handleDeletePayment() {
    if (!confirmPayment) return;
    const id = confirmPayment; setConfirmPayment(null);
    try { await deletePaymentM.mutateAsync(id); addToast(t("work.payment_deleted"), "success"); }
    catch { addToast(t("common.unknown_error"), "error"); }
  }

  function openEdit(s: WorkSession) {
    setEditSession(s); setEditPayment(undefined);
    setWorkFormTab("session"); setShowWorkForm(true);
  }

  // â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const now  = new Date();
  const mnth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const oneSessions    = useMemo(() => sessions.filter((s) => s.recurrence === "none"),        [sessions]);
  const recurSessions  = useMemo(() => sessions.filter((s) => s.recurrence !== "none"),        [sessions]);
  const monthSessions  = useMemo(() => sessions.filter((s) => s.work_date.startsWith(mnth)),   [sessions, mnth]);

  const totalExpected  = useMemo(() => sessions.reduce((s, x) => s + Number(x.expected_amount), 0), [sessions]);
  const totalReceived  = useMemo(() => payments.reduce((s, x) => s + Number(x.amount), 0),          [payments]);
  const unpaidBalance  = Math.max(0, totalExpected - totalReceived);
  const collectionRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;
  const avgRate        = sessions.length > 0 ? sessions.reduce((s, x) => s + Number(x.hourly_rate), 0) / sessions.length : 0;
  const monthHours     = useMemo(() => monthSessions.reduce((s, x) => s + Number(x.hours_worked), 0), [monthSessions]);
  const totalHours     = useMemo(() => sessions.reduce((s, x) => s + Number(x.hours_worked), 0),      [sessions]);
  const pendingCount   = useMemo(() => oneSessions.filter((s) => s.status === "pending").length, [oneSessions]);
  const overdueCount   = useMemo(() => oneSessions.filter((s) => s.status === "overdue").length, [oneSessions]);

  const gridColor  = theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tickColor  = theme === "dark" ? "#4B5563" : "#94A3B8";
  const tooltipBg  = theme === "dark" ? "#1a2235" : "#ffffff";
  const tooltipBor = theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

  const hoursChart = useMemo(() => {
    const m: Record<string, number> = {};
    sessions.forEach((s) => { const k = s.work_date.slice(0, 7); m[k] = (m[k] ?? 0) + Number(s.hours_worked); });
    return Object.entries(m).sort(([a],[b])=>a.localeCompare(b)).slice(-6)
      .map(([mo, h]) => ({ month: fmtDate(new Date(`${mo}-01`), "MMM yy"), hours: +h.toFixed(1) }));
  }, [sessions]);

  const incomeChart = useMemo(() => {
    const m: Record<string, number> = {};
    payments.forEach((p) => { const k = p.payment_date.slice(0, 7); m[k] = (m[k] ?? 0) + Number(p.amount); });
    return Object.entries(m).sort(([a],[b])=>a.localeCompare(b)).slice(-6)
      .map(([mo, v]) => ({ month: fmtDate(new Date(`${mo}-01`), "MMM yy"), income: v }));
  }, [payments]);

  const TABS: { value: Tab; icon: React.ElementType; key: string; count?: number }[] = [
    { value: "sessions",   icon: Clock,      key: "work.sessions",   count: oneSessions.length   },
    { value: "payments",   icon: DollarSign, key: "work.payments",   count: payments.length      },
    { value: "recurring",  icon: RefreshCcw, key: "work.recurring",  count: recurSessions.length },
    { value: "statistics", icon: BarChart3,  key: "work.statistics"                              },
  ];

  const deletingSession = deleteSession.isPending ? (deleteSession.variables as string) : null;
  const deletingPayment = deletePaymentM.isPending ? (deletePaymentM.variables as string) : null;

  return (
    <PlanGate require="elite" featureName="ØªØªØ¨Ø¹ Ø§Ù„Ø¹Ù…Ù„ ÙˆØ§Ù„Ø¯Ø®Ù„" overlay>
    <div className="space-y-5">

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10">
          <Briefcase className="h-4 w-4 text-amber-400" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black t1">{t("work.title")}</h1>
          <p className="mt-0.5 text-xs font-medium t3">{t("work.subtitle")}</p>
        </div>
      </div>

      {/* â”€â”€ Summary Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="rounded-[1.5rem] overflow-hidden border border-[hsl(var(--border))]"
        style={{ background: "linear-gradient(145deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-card-2)) 100%)" }}>

        {/* Top row: income vs collected */}
        <div className="grid grid-cols-2 divide-x divide-[hsl(var(--border-2))]">
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide t3 mb-1">{t("work.income_expected")}</p>
            <p className="text-2xl font-black number-display text-amber-400">{format(totalExpected)}</p>
            <p className="text-[11px] t3 mt-0.5">{sessions.length} {t("work.sessions")}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide t3 mb-1">{t("work.income_received")}</p>
            <p className="text-2xl font-black number-display text-emerald-400">{format(totalReceived)}</p>
            <p className="text-[11px] t3 mt-0.5">{payments.length} {t("work.payments")}</p>
          </div>
        </div>

        {/* Collection bar */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              {overdueCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full border border-rose-400/20">
                  <AlertCircle className="w-2.5 h-2.5" />
                  {overdueCount} {t("work.status_overdue")}
                </span>
              )}
              {pendingCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  <Clock className="w-2.5 h-2.5" />
                  {pendingCount} {t("work.status_pending")}
                </span>
              )}
            </div>
            <span className="text-sm font-black number-display text-emerald-400">{collectionRate}%</span>
          </div>
          <div className="h-2 rounded-full bg-[hsl(var(--bg-input))] overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${collectionRate}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: collectionRate >= 80 ? "linear-gradient(90deg, #10B981, #34d399)" : collectionRate >= 40 ? "linear-gradient(90deg, #F59E0B, #fbbf24)" : "linear-gradient(90deg, #F43F5E, #fb7185)" }}
            />
          </div>
          {unpaidBalance > 0 && (
            <p className="text-[11px] text-rose-400 mt-1.5 font-semibold">
              {format(unpaidBalance)} {t("work.unpaid_balance")}
            </p>
          )}
        </div>

        {/* Bottom stats row */}
        <div className="grid grid-cols-3 border-t border-[hsl(var(--border-2))] divide-x divide-[hsl(var(--border-2))]">
          {[
            { icon: Timer,      color: "#22d3ee", label: t("work.hours_this_month"), value: `${monthHours.toFixed(1)}h`  },
            { icon: TrendingUp, color: "#a78bfa", label: t("work.avg_hourly"),       value: `${symbol}${avgRate.toFixed(0)}/h` },
            { icon: Clock,      color: "#fbbf24", label: t("work.total_hours"),      value: `${totalHours.toFixed(1)}h`  },
          ].map((s) => (
            <div key={s.label} className="px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <s.icon className="w-3 h-3" style={{ color: s.color }} />
                <p className="text-base font-black number-display" style={{ color: s.color }}>{s.value}</p>
              </div>
              <p className="text-[9px] t3 uppercase tracking-wide leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1">
        {TABS.map((tb) => (
          <button key={tb.value} onClick={() => setTab(tb.value)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              tab === tb.value
                ? "bg-[hsl(var(--bg-card-2))] t1 shadow-sm"
                : "t3 hover:t2"
            }`}>
            <tb.icon className="w-3.5 h-3.5" />
            {t(tb.key)}
            {tb.count !== undefined && tb.count > 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === tb.value ? "bg-cyan-400/20 text-cyan-400" : "bg-[hsl(var(--bg-input))] t3"
              }`}>{tb.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-16 flex items-center justify-center gap-2 t3">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      )}

      {/* â”€â”€ Sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence mode="popLayout">
        {!loading && tab === "sessions" && (
          <motion.div key="sessions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}
            className="space-y-2.5">
            {oneSessions.length === 0 ? (
              <div className="card py-14 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-400/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-cyan-400 opacity-40" />
                </div>
                <p className="text-sm t3">{t("work.no_sessions")}</p>
              </div>
            ) : oneSessions.map((s) => {
              const st  = s.status ?? "pending";
              const cfg = STATUS[st];
              const pct = paidPct(s, payments);
              const Icon = cfg.icon;
              const isDeleting = deletingSession === s.id;
              return (
                <motion.div key={s.id} layout
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ ...spring, duration: 0.2 }}
                  className={`relative rounded-[1.25rem] overflow-hidden border transition-opacity ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
                  style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
                >
                  {/* Status stripe on the start */}
                  <div className="absolute start-0 top-0 bottom-0 w-1 rounded-s-[1.25rem]"
                    style={{ backgroundColor: cfg.color }} />

                  <div className="ps-4 pe-3 py-3.5 ms-1">
                    {/* Row 1: title + amount */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold t1 truncate">{s.title}</p>
                        <p className="text-xs t3 mt-0.5 truncate">{s.employer_or_client}</p>
                      </div>
                      <div className="shrink-0 text-end">
                        <p className="text-base font-black number-display" style={{ color: cfg.color }}>
                          {format(s.expected_amount)}
                        </p>
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>
                          <Icon className="w-2.5 h-2.5" />
                          {t(cfg.labelKey)}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: meta info */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] t3 mb-2.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Number(s.hours_worked).toFixed(1)}h Ã— {symbol}{Number(s.hourly_rate).toFixed(0)}/h
                      </span>
                      <span>Â·</span>
                      <span>{s.work_date}</span>
                      {s.due_date && (
                        <>
                          <span>Â·</span>
                          <span className={s.due_date < today && st !== "paid" ? "text-rose-400 font-semibold" : ""}>
                            {t("work.due_date") || "Due"}: {s.due_date}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Row 3: progress */}
                    {pct > 0 && (
                      <div className="mb-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] t3">{t("work.paid_progress")}</span>
                          <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: cfg.color }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Row 4: notes + actions */}
                    <div className="flex items-center justify-between gap-2">
                      {s.notes
                        ? <p className="text-[11px] t3 truncate flex-1">{s.notes}</p>
                        : <span />
                      }
                      <div className="flex items-center gap-0.5 shrink-0">
                        <motion.button
                          onClick={() => openEdit(s)}
                          whileTap={{ scale: 0.9 }} transition={tapTransition}
                          className="p-1.5 rounded-xl t3 hover:t1 hover:bg-white/8 transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                        </motion.button>
                        <motion.button
                          onClick={() => setConfirmSession(s.id)}
                          whileTap={{ scale: 0.9 }} transition={tapTransition}
                          className="p-1.5 rounded-xl t3 hover:text-rose-400 hover:bg-rose-400/10 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Payments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence mode="popLayout">
        {!loading && tab === "payments" && (
          <motion.div key="payments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}
            className="space-y-2.5">
            {payments.length === 0 ? (
              <div className="card py-14 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-400/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-400 opacity-40" />
                </div>
                <p className="text-sm t3">{t("work.no_payments")}</p>
              </div>
            ) : payments.map((p) => {
              const linkedSession = sessions.find((s) => s.id === p.work_session_id);
              const isDeleting = deletingPayment === p.id;
              return (
                <motion.div key={p.id} layout
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ ...spring, duration: 0.2 }}
                  className={`card px-4 py-3.5 transition-opacity ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}>
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: "rgba(52,211,153,0.12)" }}>
                      <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-black number-display text-emerald-400">+{format(p.amount)}</span>
                        <span className="text-xs t2 truncate">{p.employer_or_client}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] t3">
                        <span>{p.payment_date}</span>
                        {linkedSession && (
                          <>
                            <span>Â·</span>
                            <span className="text-cyan-400/80 truncate">{linkedSession.title}</span>
                          </>
                        )}
                        {p.notes && (
                          <>
                            <span>Â·</span>
                            <span className="truncate">{p.notes}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {p.transaction_id && (
                        <Link href="/transactions?source=work"
                          className="p-1.5 t3 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-xl transition-all"
                          title={t("work.view_transaction")}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <motion.button
                        onClick={() => setConfirmPayment(p.id)}
                        whileTap={{ scale: 0.9 }} transition={tapTransition}
                        className="p-1.5 t3 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Recurring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence mode="popLayout">
        {!loading && tab === "recurring" && (
          <motion.div key="recurring" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}
            className="space-y-2.5">
            {recurSessions.length === 0 ? (
              <div className="card py-14 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-400/10 flex items-center justify-center">
                  <RefreshCcw className="w-5 h-5 text-purple-400 opacity-40" />
                </div>
                <p className="text-sm t3">{t("work.no_recurring")}</p>
              </div>
            ) : recurSessions.map((s) => (
              <motion.div key={s.id} layout
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                transition={{ ...spring, duration: 0.2 }}
                className="relative rounded-[1.25rem] overflow-hidden border border-purple-400/20"
                style={{ backgroundColor: "rgba(167,139,250,0.06)" }}>
                <div className="absolute start-0 top-0 bottom-0 w-1 rounded-s-[1.25rem] bg-purple-400" />
                <div className="ps-4 pe-3 py-3.5 ms-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold t1 truncate">{s.title}</p>
                      <p className="text-xs t3 mt-0.5 truncate">{s.employer_or_client}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-400/15 text-purple-400">
                          <RefreshCcw className="w-2.5 h-2.5" />
                          {t(`work.recurrence_${s.recurrence}`)}
                        </span>
                        <span className="text-[11px] t3">
                          {Number(s.hours_worked).toFixed(1)}h Ã— {symbol}{Number(s.hourly_rate).toFixed(0)}/h
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-base font-black number-display text-purple-400">{format(s.expected_amount)}</p>
                      <motion.button
                        onClick={() => openEdit(s)}
                        whileTap={{ scale: 0.9 }} transition={tapTransition}
                        className="p-1.5 t3 hover:text-purple-400 hover:bg-purple-400/10 rounded-xl transition-all mt-0.5">
                        <Pencil className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Statistics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence mode="popLayout">
        {!loading && tab === "statistics" && (
          <motion.div key="statistics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}
            className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t("work.avg_hourly"),      value: `${symbol}${avgRate.toFixed(0)}/h`,   color: "#22d3ee" },
                { label: t("work.total_sessions"),  value: String(sessions.length),              color: "#fbbf24" },
                { label: t("work.collection_rate"), value: `${collectionRate}%`,                 color: "#34d399" },
              ].map((s) => (
                <div key={s.label} className="card p-4 text-center">
                  <p className="text-xl font-black number-display" style={{ color: s.color }}>{s.value}</p>
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
              {hoursChart.length === 0
                ? <p className="text-xs t3 text-center py-8">{t("work.no_sessions")}</p>
                : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={hoursChart} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} unit="h" />
                      <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBor}`, borderRadius: 12 }}
                        labelStyle={{ color: tickColor }} itemStyle={{ color: "#22d3ee" }}
                        formatter={(v: number) => [`${v}h`, t("work.hours_chart")]} />
                      <Bar dataKey="hours" fill="#22d3ee" radius={[6, 6, 0, 0]} maxBarSize={32} />
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
              {incomeChart.length === 0
                ? <p className="text-xs t3 text-center py-8">{t("work.no_payments")}</p>
                : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={incomeChart} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10B981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `${symbol}${v}`} />
                      <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBor}`, borderRadius: 12 }}
                        labelStyle={{ color: tickColor }} itemStyle={{ color: "#10B981" }}
                        formatter={(v: number) => [format(v), t("work.income_chart")]} />
                      <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2}
                        fill="url(#incGrad)" dot={false} activeDot={{ r: 4, fill: "#10B981" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
            </div>

            {/* Breakdown by client */}
            {sessions.length > 0 && (() => {
              const byClient: Record<string, { hours: number; earned: number; sessions: number }> = {};
              sessions.forEach((s) => {
                const k = s.employer_or_client;
                if (!byClient[k]) byClient[k] = { hours: 0, earned: 0, sessions: 0 };
                byClient[k].hours    += Number(s.hours_worked);
                byClient[k].earned   += Number(s.expected_amount);
                byClient[k].sessions += 1;
              });
              const clients = Object.entries(byClient).sort(([,a],[,b]) => b.earned - a.earned).slice(0, 5);
              const maxEarned = clients[0]?.[1]?.earned ?? 0;
              return (
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded-xl bg-purple-400/10"><Briefcase className="w-4 h-4 text-purple-400" /></div>
                    <h3 className="text-sm font-bold t1">{t("work.top_clients") || "Ø£Ø¨Ø±Ø² Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡"}</h3>
                  </div>
                  <div className="space-y-3">
                    {clients.map(([client, stats]) => (
                      <div key={client}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold t1 truncate max-w-[55%]">{client}</span>
                          <div className="flex items-center gap-2 text-[11px] t3">
                            <span>{stats.hours.toFixed(1)}h</span>
                            <span className="font-bold text-purple-400 number-display">{format(stats.earned)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-[hsl(var(--bg-input))] overflow-hidden">
                          <div className="h-full rounded-full bg-purple-400/60 transition-all"
                            style={{ width: maxEarned > 0 ? `${(stats.earned / maxEarned) * 100}%` : "0%" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Modals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showWorkForm && (
        <WorkForm
          initialTab={workFormTab}
          initialSession={editSession}
          initialPayment={editPayment}
          sessions={sessions}
          onSubmitSession={handleSessionSubmit}
          onSubmitPayment={handlePaymentSubmit}
          onClose={() => { setShowWorkForm(false); setEditSession(undefined); setEditPayment(undefined); }}
        />
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
    </PlanGate>
  );
}

