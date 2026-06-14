"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, CreditCard, CheckCircle, AlertTriangle,
  Clock, Loader2, DollarSign, Search, User, TrendingUp, TrendingDown,
  Wrench, ChevronDown, Calendar, Brain, Receipt,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import {
  type Debt, type DebtStatus, type DebtFormData, type DebtPaymentFormData,
} from "@/types";
import { useGuest } from "@/contexts/GuestContext";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateDebtQueries } from "@/lib/query/invalidation";
import { safeFetch } from "@/lib/fetch-safe";
import {
  useDebts, useCreateDebt, useUpdateDebt, useDeleteDebt, useCreateDebtPayment,
  useDashboardSummary,
} from "@/lib/query/hooks";
import ToastList from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import DebtForm from "@/components/debts/DebtForm";
import DebtPaymentForm from "@/components/debts/DebtPaymentForm";
import ContactDetailModal from "@/components/contacts/ContactDetailModal";
import DebtTimeline from "@/components/debts/DebtTimeline";

type DebtTab = "all" | "payable" | "receivable" | "paid";
type TFn = (key: string, params?: Record<string, string | number>) => string;

const STATUS_CFG: Record<DebtStatus, { icon: React.ElementType; color: string; bar: string; bg: string }> = {
  active:         { icon: Clock,         color: "text-cyan-400",    bar: "#06B6D4", bg: "bg-cyan-400/10"    },
  partially_paid: { icon: DollarSign,    color: "text-amber-400",   bar: "#F59E0B", bg: "bg-amber-400/10"   },
  paid:           { icon: CheckCircle,   color: "text-emerald-400", bar: "#10B981", bg: "bg-emerald-400/10" },
  overdue:        { icon: AlertTriangle, color: "text-rose-400",    bar: "#F43F5E", bg: "bg-rose-400/10"    },
};

// â”€â”€ DTI Health Ring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DTICard({ ratio, t }: { ratio: number; t: TFn }) {
  const pct = Math.min(ratio * 100, 100);
  const color = pct >= 40 ? "#F43F5E" : pct >= 20 ? "#F59E0B" : "#10B981";
  const statusKey = pct >= 40 ? "debts.dti_poor" : pct >= 20 ? "debts.dti_fair" : "debts.dti_good";
  const circ = 2 * Math.PI * 22;

  return (
    <div className="card-elevated p-4 flex flex-col">
      <p className="text-[10px] t3 uppercase tracking-wide font-semibold mb-2">{t("debts.dti_label")}</p>
      <div className="flex items-center gap-3 flex-1">
        <div className="relative w-14 h-14 shrink-0">
          <svg viewBox="0 0 56 56" fill="none" className="w-full h-full -rotate-90">
            <circle cx="28" cy="28" r="22" stroke="hsl(var(--bg-input))" strokeWidth="4.5" />
            <circle cx="28" cy="28" r="22"
              stroke={color} strokeWidth="4.5"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct / 100)}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color }}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <div>
          <p className="text-sm font-bold t1">{t(statusKey)}</p>
          <p className="text-[10px] t3 mt-0.5">{t("debts.health_label")}</p>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Monthly rate card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MonthlyCard({
  avgPayment, activeDebts, dtiRatio, t, format,
}: { avgPayment: number; activeDebts: number; dtiRatio: number; t: TFn; format: (n: number) => string }) {
  return (
    <div className="card-elevated p-4 flex flex-col">
      <p className="text-[10px] t3 uppercase tracking-wide font-semibold mb-2">{t("debts.monthly_rate")}</p>
      <p className="text-xl font-black t1 number-display">{format(avgPayment)}</p>
      <p className="text-[10px] t3 mt-1">{activeDebts} {t("debts.active")}</p>
      <div className="mt-auto pt-2">
        <div className="h-1.5 bg-[hsl(var(--bg-input))] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(dtiRatio * 250, 100)}%`,
              background: "linear-gradient(90deg, #10B981, #F59E0B, #F43F5E)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Upcoming timeline item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TimelineRow({
  name, amount, daysLeft, format, t,
}: { name: string; amount: number; daysLeft: number; format: (n: number) => string; t: TFn }) {
  const isOverdue = daysLeft < 0;
  const isToday   = daysLeft === 0;
  const color = isOverdue ? "#F43F5E" : isToday ? "#F59E0B" : "#06B6D4";
  const badge = isOverdue
    ? t("debts.days_late_short", { count: Math.abs(daysLeft) })
    : isToday ? t("debts.today")
    : t("debts.days_short", { count: daysLeft });

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[hsl(var(--border-2))] last:border-0">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <p className="text-sm t1 flex-1 truncate font-medium">{name}</p>
      <p className="text-sm font-bold t1 shrink-0">{format(amount)}</p>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
        style={{ backgroundColor: `${color}22`, color }}>
        {badge}
      </span>
    </div>
  );
}

// â”€â”€ Debt trend chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TrendChart({
  totalRemaining, avgMonthly, t, locale,
}: { totalRemaining: number; avgMonthly: number; t: TFn; locale: string }) {
  const data = useMemo(() => {
    const now = new Date();
    const dateLocale = locale === "ar" ? "ar" : locale === "de" ? "de-DE" : "en-US";
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = d.toLocaleDateString(dateLocale, { month: "short" });
      const debt = Math.max(0, Math.round(totalRemaining - avgMonthly * i));
      return { month: label, debt };
    });
  }, [totalRemaining, avgMonthly, locale]);

  const monthsLeft = avgMonthly > 0 ? Math.ceil(totalRemaining / avgMonthly) : null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold t1">{t("debts.reduction_trend")}</p>
        {monthsLeft != null && monthsLeft > 0 && monthsLeft < 120 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-400/10 text-rose-400 font-semibold">
            {t("debts.months_short", { count: monthsLeft })}
          </span>
        )}
      </div>
      <div className="h-36 mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <defs>
              <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#F43F5E" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-2))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(var(--foreground) / 0.4)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--foreground) / 0.4)" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--bg-card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 10, fontSize: 11,
              }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              itemStyle={{ color: "#F43F5E" }}
            />
            <Area type="monotone" dataKey="debt" name={t("debts.chart_debt")} stroke="#F43F5E" strokeWidth={2} fill="url(#dg)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// â”€â”€ AI Insights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AIPanel({
  debts, totalPaid, totalOriginal, overdueCount, dtiRatio, avgMonthly, t, format,
}: {
  debts: Debt[];
  totalPaid: number;
  totalOriginal: number;
  overdueCount: number;
  dtiRatio: number;
  avgMonthly: number;
  t: TFn;
  format: (n: number) => string;
}) {
  const insights = useMemo(() => {
    const list: { icon: string; text: string; positive: boolean }[] = [];
    const activeDebts = debts.filter((d) => d.status !== "paid");

    if (activeDebts.length === 0) {
      return [{ icon: "ðŸŽ‰", text: t("debts.ai_debt_free"), positive: true }];
    }

    if (overdueCount > 0) {
      list.push({ icon: "âš ï¸", text: t("debts.ai_overdue", { count: overdueCount }), positive: false });
    }

    const totalRemaining = activeDebts.reduce(
      (s, d) => s + Number(d.remaining_amount ?? (Number(d.total_amount) - Number(d.paid_amount))), 0,
    );
    const paidPct = totalOriginal > 0 ? Math.round((totalPaid / totalOriginal) * 100) : 0;
    if (paidPct > 0) {
      list.push({ icon: "ðŸ“Š", text: t("debts.ai_progress", { pct: paidPct }), positive: paidPct >= 40 });
    }

    if (dtiRatio >= 0.3) {
      list.push({ icon: "ðŸ“‰", text: t("debts.ai_dti_warning", { pct: Math.round(dtiRatio * 100) }), positive: false });
    }

    if (avgMonthly > 0 && totalRemaining > 0) {
      const extra = Math.round(totalRemaining / 12);
      const monthsNow   = Math.ceil(totalRemaining / avgMonthly);
      const monthsExtra = Math.ceil(totalRemaining / (avgMonthly + extra));
      const saved = monthsNow - monthsExtra;
      if (saved > 0) {
        list.push({ icon: "ðŸ’¡", text: t("debts.ai_payoff_tip", { amount: format(extra), n: saved }), positive: true });
      }
    }

    // Fastest payoff insight
    const sortedByRemaining = [...activeDebts]
      .filter((d) => (d.remaining_amount ?? 0) > 0)
      .sort((a, b) => (a.remaining_amount ?? 0) - (b.remaining_amount ?? 0));
    const smallest = sortedByRemaining[0];
    if (smallest && avgMonthly > 0 && activeDebts.length > 0) {
      const share = avgMonthly / activeDebts.length;
      const months = share > 0 ? Math.ceil((smallest.remaining_amount ?? 0) / share) : 0;
      if (months > 0 && months <= 6) {
        list.push({
          icon: "ðŸ†",
          text: t("debts.ai_fastest_payoff", { name: smallest.person_or_entity, months }),
          positive: true,
        });
      }
    }

    return list.slice(0, 4);
  }, [debts, totalPaid, totalOriginal, overdueCount, dtiRatio, avgMonthly, t, format]);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-purple-400" />
        <p className="text-sm font-bold t1">{t("debts.ai_insights")}</p>
      </div>
      <div className="space-y-2">
        {insights.map((ins, i) => (
          <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs leading-relaxed ${
            ins.positive
              ? "bg-emerald-400/8 text-emerald-300 border border-emerald-400/15"
              : "bg-rose-400/8 text-rose-300 border border-rose-400/15"
          }`}>
            <span className="text-sm shrink-0 mt-0.5">{ins.icon}</span>
            <p>{ins.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Main Page
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function DebtsPage() {
  const { isGuest }                       = useGuest();
  const { t, formatDate, locale }         = useTranslation();
  const { format }                        = useCurrency();
  const { toasts, addToast, dismiss }     = useToast();
  const queryClient                       = useQueryClient();

  const [showForm, setShowForm]           = useState(false);
  const [showPayment, setShowPayment]     = useState<Debt | null>(null);
  const [editing, setEditing]             = useState<Debt | undefined>();
  const [newDebtType, setNewDebtType]     = useState<Debt["debt_type"]>("payable");
  const [confirmId, setConfirmId]         = useState<string | null>(null);
  const [tab, setTab]                     = useState<DebtTab>("all");
  const [search, setSearch]               = useState("");
  const [debtPage, setDebtPage]           = useState(1);
  const debtSentinelRef                   = useRef<HTMLDivElement>(null);
  const DEBT_PAGE = 15;
  const [contactModal, setContactModal]   = useState<string | null>(null);
  const [expandedIds, setExpandedIds]     = useState<Set<string>>(new Set());
  const [cleaning, setCleaning]           = useState(false);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  // â”€â”€ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: result, isLoading } = useDebts();
  const debts   = result?.debts   ?? [];
  const summary = result?.summary ?? {
    totalPayable: 0, totalReceivable: 0, overdueCount: 0, totalDebts: 0, activeDebts: 0,
  };

  const { data: dashRaw } = useDashboardSummary(!isGuest);
  const monthlyIncome = (dashRaw as { monthlyIncome?: number } | null)?.monthlyIncome ?? 0;

  const createMut  = useCreateDebt();
  const updateMut  = useUpdateDebt();
  const deleteMut  = useDeleteDebt();
  const paymentMut = useCreateDebtPayment();
  const deletingId = deleteMut.isPending ? (deleteMut.variables as string) : null;

  function openNewDebt(type: Debt["debt_type"] = "payable") {
    setEditing(undefined);
    setNewDebtType(type);
    setShowForm(true);
  }

  // â”€â”€ Computed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const totalOriginal = useMemo(() => debts.reduce((s, d) => s + Number(d.total_amount), 0), [debts]);
  const totalPaid     = useMemo(() => debts.reduce((s, d) => s + Number(d.paid_amount), 0),  [debts]);
  const netPosition   = summary.totalReceivable - summary.totalPayable;

  const avgMonthly = useMemo(() => {
    if (totalPaid > 0 && debts.length > 0) {
      const dates   = debts.map((d) => new Date(d.created_at).getTime()).filter(Number.isFinite);
      if (dates.length === 0) return totalPaid;
      const earliest = Math.min(...dates);
      const months   = Math.max(1, (Date.now() - earliest) / (30 * 24 * 3600 * 1000));
      return totalPaid / months;
    }
    const total = summary.totalPayable + summary.totalReceivable;
    return total > 0 ? Math.max(total * 0.05, 50) : 0;
  }, [debts, totalPaid, summary.totalPayable, summary.totalReceivable]);

  const avgMonthlyPayable = useMemo(() => {
    const payableDebts = debts.filter((debt) => debt.debt_type === "payable");
    const paidPayable = payableDebts.reduce((sum, debt) => sum + Number(debt.paid_amount), 0);
    if (paidPayable > 0 && payableDebts.length > 0) {
      const dates = payableDebts.map((debt) => new Date(debt.created_at).getTime()).filter(Number.isFinite);
      if (dates.length === 0) return paidPayable;
      const earliest = Math.min(...dates);
      const months = Math.max(1, (Date.now() - earliest) / (30 * 24 * 3600 * 1000));
      return paidPayable / months;
    }
    return summary.totalPayable > 0 ? Math.max(summary.totalPayable * 0.05, 50) : 0;
  }, [debts, summary.totalPayable]);

  const dtiRatio = monthlyIncome > 0 ? avgMonthlyPayable / monthlyIncome : 0;

  // Reset page on tab/search change
  useEffect(() => { setDebtPage(1); }, [tab, search]);

  const filtered = useMemo(() => {
    let list = [...debts];
    if (tab === "payable")    list = list.filter((d) => d.debt_type === "payable"    && d.status !== "paid");
    if (tab === "receivable") list = list.filter((d) => d.debt_type === "receivable" && d.status !== "paid");
    if (tab === "paid")       list = list.filter((d) => d.status === "paid");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.person_or_entity.toLowerCase().includes(q) ||
        (d.notes?.toLowerCase().includes(q) ?? false),
      );
    }
    const order: Record<DebtStatus, number> = { overdue: 0, active: 1, partially_paid: 2, paid: 3 };
    return list.sort((a, b) => order[a.status] - order[b.status]);
  }, [debts, tab, search]);

  const filteredPage = useMemo(() => filtered.slice(0, debtPage * DEBT_PAGE), [filtered, debtPage]);
  const debtHasMore  = filteredPage.length < filtered.length;

  // Infinite scroll for debts
  useEffect(() => {
    const el = debtSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting && debtHasMore) setDebtPage((p) => p + 1); },
      { rootMargin: "150px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [debtHasMore]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return debts
      .filter((d) => d.due_date && d.status !== "paid")
      .map((d) => ({
        ...d,
        daysLeft: Math.round((new Date(d.due_date!).getTime() - now) / 86_400_000),
      }))
      .filter((d) => d.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [debts]);

  const TABS = useMemo(() => [
    { value: "all"        as DebtTab, label: t("debt_tabs.all"),         count: debts.length },
    { value: "payable"    as DebtTab, label: t("debts.payable_tab"),     count: debts.filter((d) => d.debt_type === "payable"    && d.status !== "paid").length },
    { value: "receivable" as DebtTab, label: t("debts.receivable_tab"),  count: debts.filter((d) => d.debt_type === "receivable" && d.status !== "paid").length },
    { value: "paid"       as DebtTab, label: t("debt_tabs.paid"),        count: debts.filter((d) => d.status === "paid").length },
  ], [debts, t]);

  function errorMessage(error: unknown, fallbackKey: string) {
    const fallback = t(fallbackKey);
    if (!(error instanceof Error) || !error.message) return fallback;
    if (error.message === "Unauthorized") return t("errors.unauthorized");
    if (error.message.startsWith("HTTP ")) return fallback;
    const translated = t(error.message);
    if (translated !== error.message) return translated;
    return error.message.includes(" ") ? error.message : fallback;
  }

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleSubmit(data: DebtFormData) {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data });
        addToast(t("debts.updated"), "success");
      } else {
        await createMut.mutateAsync(data);
        addToast(t("debts.created"), "success");
      }
      setEditing(undefined);
      setShowForm(false);
    } catch (error) {
      const message = errorMessage(error, "debts.save_failed");
      addToast(message, "error");
      throw new Error(message);
    }
  }

  async function handlePayment(debt: Debt, data: DebtPaymentFormData) {
    try {
      await paymentMut.mutateAsync({ debtId: debt.id, data });
      addToast(t("debts.payment_added"), "success");
      setShowPayment(null);
    } catch (error) {
      const message = errorMessage(error, "debts.payment_failed");
      addToast(message, "error");
      throw new Error(message);
    }
  }

  async function handleDelete() {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    try {
      await deleteMut.mutateAsync(id);
      addToast(t("debts.deleted"), "success");
    } catch {
      addToast(t("debts.delete_failed"), "error");
    }
  }

  async function cleanupLegacyTransactions() {
    setCleaning(true);
    try {
      const res = await safeFetch("/api/debts/cleanup", { method: "POST" });
      const data = await res.json() as { cleaned?: number };
      addToast(t("debts.cleanup_success", { count: data.cleaned ?? 0 }), "success");
      invalidateDebtQueries(queryClient);
    } catch {
      addToast(t("debts.cleanup_failed"), "error");
    } finally {
      setCleaning(false);
    }
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="space-y-5">

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-400/10">
            <CreditCard className="h-4 w-4 text-orange-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black t1">{t("debts.title")}</h1>
            <p className="mt-0.5 text-xs font-medium t3">{t("debts.dmc_subtitle")}</p>
          </div>
        </div>
        {!isGuest && (
          <button
            onClick={cleanupLegacyTransactions}
            disabled={cleaning}
            title={t("debts.fix_balance")}
            className="p-2.5 rounded-xl t3 hover:t1 bg-[hsl(var(--bg-input))] hover:bg-[hsl(var(--bg-card-2))] transition-all shrink-0"
          >
            {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          </button>
        )}
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-start gap-3 px-4 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
            <CreditCard className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold t1">{t("debts.guide_title")}</p>
            <p className="mt-0.5 text-xs leading-relaxed t3">{t("debts.guide_body")}</p>
          </div>
        </div>
      </section>

      {/* â”€â”€ Summary Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {!isLoading && debts.length > 0 && (
        <div
          className="relative rounded-[1.5rem] overflow-hidden p-5"
          style={{
            background: netPosition >= 0
              ? "linear-gradient(135deg, #0B3D2A 0%, #0E1F3A 60%, #0B3D4F 100%)"
              : "linear-gradient(135deg, #3D0B1A 0%, #1A0F0B 60%, #1A0F3A 100%)",
          }}
        >
          <div
            className="absolute top-0 end-0 w-52 h-52 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: netPosition >= 0 ? "#10B981" : "#F43F5E", transform: "translate(35%,-35%)" }}
          />
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em] mb-0.5">
              {t("debts.net_position")}
            </p>
            <p className="text-4xl font-bold text-white number-display mb-4">
              {netPosition >= 0 ? "+" : ""}{format(netPosition)}
            </p>
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <TrendingDown className="w-3 h-3 text-rose-400 shrink-0" />
                  <p className="text-[9px] text-white/40 uppercase tracking-wide">{t("debts.payable_tab")}</p>
                </div>
                <p className="text-sm font-bold text-rose-300">{format(summary.totalPayable)}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                  <p className="text-[9px] text-white/40 uppercase tracking-wide">{t("debts.receivable_tab")}</p>
                </div>
                <p className="text-sm font-bold text-emerald-300">{format(summary.totalReceivable)}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <p className="text-[9px] text-white/40 uppercase tracking-wide">{t("debts.overdue")}</p>
                </div>
                <p className={`text-sm font-bold ${summary.overdueCount > 0 ? "text-rose-300" : "text-emerald-300"}`}>
                  {summary.overdueCount} {t("debts.debts")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Health + Monthly â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {!isLoading && debts.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <DTICard ratio={dtiRatio} t={t} />
          <MonthlyCard avgPayment={avgMonthly} activeDebts={summary.activeDebts} dtiRatio={dtiRatio} t={t} format={format} />
        </div>
      )}

      {/* â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 tabs-row">
        {TABS.map((tb) => (
          <button
            key={tb.value}
            onClick={() => setTab(tb.value)}
            className={`tab-pill shrink-0 flex items-center gap-1.5 ${tab === tb.value ? "active" : ""}`}
          >
            {tb.label}
            {tb.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                tab === tb.value ? "bg-white/20 text-white" : "bg-[hsl(var(--bg-input))] t3"
              }`}>{tb.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* â”€â”€ Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 t3 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`${t("debts.creditor")}...`}
          className="field ps-9 w-full"
        />
      </div>

      {/* â”€â”€ Debt Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--bg-input))]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[hsl(var(--bg-input))] rounded w-2/3" />
                  <div className="h-3 bg-[hsl(var(--bg-input))] rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-14 text-center">
          <CreditCard className="w-8 h-8 t3 opacity-20 mx-auto mb-3" />
          <p className="text-sm font-semibold t2">{t("debts.no_data")}</p>
          {tab === "all" && !search && (
            <button onClick={() => openNewDebt("payable")} className="text-sm text-rose-400 hover:underline mt-2">
              {t("debts.add")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPage.map((debt) => {
            const cfg       = STATUS_CFG[debt.status as DebtStatus] ?? STATUS_CFG.active;
            const total     = Number(debt.total_amount);
            const paid      = Number(debt.paid_amount ?? 0);
            const remaining = Number(debt.remaining_amount ?? (total - paid));
            const pct       = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
            const isDeleting = deletingId === debt.id;
            const isExpanded = expandedIds.has(debt.id);
            const isOverdue  = !!debt.due_date && new Date(debt.due_date) < new Date() && debt.status !== "paid";

            return (
              <div
                key={debt.id}
                className={`card overflow-hidden transition-all ${
                  debt.status === "overdue" ? "border-rose-400/25" : ""
                } ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
              >
                {/* Animated progress accent line */}
                <div
                  className="h-0.5"
                  style={{
                    background: `linear-gradient(90deg, ${cfg.bar} 0%, ${cfg.bar} ${pct}%, hsl(var(--bg-input)) ${pct}%)`,
                  }}
                />

                {/* Compact row */}
                <button
                  type="button"
                  onClick={() => toggleExpand(debt.id)}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-start hover:bg-[hsl(var(--bg-input))] transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    {debt.contact
                      ? <User className={`w-[18px] h-[18px] ${cfg.color}`} />
                      : <cfg.icon className={`w-[18px] h-[18px] ${cfg.color}`} />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold t1 truncate">{debt.person_or_entity}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${cfg.bg} ${cfg.color}`}>
                        {t(`debts.status.${debt.status}`)}
                      </span>
                      {debt.debt_type === "receivable" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 bg-emerald-400/10 text-emerald-400">
                          â†‘
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-[hsl(var(--bg-input))] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: cfg.bar, transition: "width 0.4s ease" }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 ${cfg.color}`}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-end">
                      <p className="text-sm font-bold t1">{format(remaining)}</p>
                      <p className="text-[9px] t3">{t("debts.remaining")}</p>
                    </div>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-4 h-4 t3" />
                    </motion.div>
                  </div>
                </button>

                {/* Expanded details */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 320, damping: 32 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="px-4 pb-4 pt-2 border-t border-[hsl(var(--border-2))] space-y-3">
                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: t("debts.amount"), val: format(total), color: "t1" },
                            { label: t("debts.total_paid"), val: format(paid), color: "text-emerald-400" },
                            { label: t("debts.remaining"), val: format(remaining), color: "text-rose-400" },
                          ].map((s) => (
                            <div key={s.label} className="bg-[hsl(var(--bg-input))] rounded-xl p-2.5 text-center">
                              <p className="text-[9px] t3 uppercase tracking-wide">{s.label}</p>
                              <p className={`text-xs font-bold mt-0.5 ${s.color}`}>{s.val}</p>
                            </div>
                          ))}
                        </div>

                        {/* Contact */}
                        {debt.contact && debt.contact_id && (
                          <button
                            type="button"
                            onClick={() => setContactModal(debt.contact_id!)}
                            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            <User className="w-3 h-3" />
                            {debt.contact.name}
                            <span className="t3">Â· {t(`contacts.types.${debt.contact.type}`)}</span>
                          </button>
                        )}

                        {/* Due date */}
                        {debt.due_date && (
                          <p className={`text-xs flex items-center gap-1.5 ${isOverdue ? "text-rose-400 font-medium" : "t3"}`}>
                            <Calendar className="w-3 h-3 shrink-0" />
                            {t("debts.due", { date: formatDate(debt.due_date) })}
                            {(debt.overdueDays ?? 0) > 0 && (
                              <span className="text-rose-400 font-semibold ms-1">
                                ({debt.overdueDays} {t("debts.days_overdue")})
                              </span>
                            )}
                          </p>
                        )}

                        {/* Notes */}
                        {debt.notes && <p className="text-xs t3 italic">{debt.notes}</p>}

                        {/* Debt Timeline */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-3">
                            <Receipt className="w-3 h-3 t3" />
                            <p className="text-[10px] font-bold t3 uppercase tracking-wide">
                              {t("debts.timeline")}
                            </p>
                          </div>
                          <DebtTimeline
                            debt={debt}
                            format={format}
                            locale={locale}
                            isReceivable={debt.debt_type === "receivable"}
                          />
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin t3" />
                          ) : (
                            <>
                              {debt.status !== "paid" && (
                                <button
                                  onClick={() => setShowPayment(debt)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all"
                                  style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}
                                >
                                  <DollarSign className="w-3 h-3" />
                                  {t("debts.add_payment")}
                                </button>
                              )}
                              <button
                                onClick={() => { setEditing(debt); setShowForm(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold t2 bg-[hsl(var(--bg-input))] hover:bg-[hsl(var(--bg-card-2))] rounded-lg transition-all"
                              >
                                <Pencil className="w-3 h-3" />
                                {t("common.edit")}
                              </button>
                              <button
                                onClick={() => setConfirmId(debt.id)}
                                className="ms-auto flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          {/* Infinite scroll sentinel for debts */}
          {debtHasMore && (
            <div ref={debtSentinelRef} className="flex items-center justify-center gap-2 py-2 t3">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin" />
              <span className="text-xs">{t("common.loading")}</span>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ Upcoming Payments Timeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {!isLoading && upcoming.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <p className="text-sm font-bold t1">{t("debts.upcoming")}</p>
          </div>
          <p className="text-[10px] t3 mb-3">{t("debts.next_30_days")}</p>
          {upcoming.map((d) => (
            <TimelineRow
              key={d.id}
              name={d.person_or_entity}
              amount={d.remaining_amount ?? (Number(d.total_amount) - Number(d.paid_amount))}
              daysLeft={d.daysLeft}
              format={format}
              t={t}
            />
          ))}
        </div>
      )}

      {/* â”€â”€ Debt Reduction Trend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {!isLoading && (summary.totalPayable + summary.totalReceivable) > 0 && (
        <TrendChart
          totalRemaining={summary.totalPayable + summary.totalReceivable}
          avgMonthly={avgMonthly}
          t={t}
          locale={locale}
        />
      )}

      {/* â”€â”€ AI Insights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {!isLoading && debts.length > 0 && (
        <AIPanel
          debts={debts}
          totalPaid={totalPaid}
          totalOriginal={totalOriginal}
          overdueCount={summary.overdueCount}
          dtiRatio={dtiRatio}
          avgMonthly={avgMonthly}
          t={t}
          format={format}
        />
      )}

      {/* â”€â”€ Modals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showForm && (
        <DebtForm
          initial={editing}
          initialDebtType={newDebtType}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
        />
      )}
      {showPayment && (
        <DebtPaymentForm
          debt={showPayment}
          onSubmit={(data: DebtPaymentFormData) => handlePayment(showPayment, data)}
          onClose={() => setShowPayment(null)}
        />
      )}
      {confirmId && (
        <ConfirmModal
          message={t("debts.confirm_delete_msg")}
          loading={deleteMut.isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
      {contactModal && (
        <ContactDetailModal contactId={contactModal} onClose={() => setContactModal(null)} />
      )}
      <ToastList toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

