"use client";

import { useState, useMemo } from "react";
import { safeFetch } from "@/lib/fetch-safe";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, CreditCard, CheckCircle, AlertTriangle,
  Clock, Loader2, DollarSign, Search, User, TrendingUp, TrendingDown,
  Shield, Activity, Wrench, ChevronDown,
} from "lucide-react";
import { type Debt, type DebtStatus, type DebtFormData, type DebtPaymentFormData, type FinancialContact } from "@/types";
import { useGuest } from "@/contexts/GuestContext";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/useToast";
import ToastList from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import DebtForm from "@/components/debts/DebtForm";
import DebtPaymentForm from "@/components/debts/DebtPaymentForm";
import ContactDetailModal from "@/components/contacts/ContactDetailModal";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateDebtQueries } from "@/lib/query/invalidation";
import {
  useDebts, useCreateDebt, useUpdateDebt, useDeleteDebt, useCreateDebtPayment,
} from "@/lib/query/hooks";

type TabValue = "all" | "active" | "partially_paid" | "overdue" | "paid";

const STATUS_CONFIG: Record<DebtStatus, {
  icon: React.ElementType; color: string; bg: string; border: string; bar: string;
}> = {
  active:         { icon: Clock,         color: "text-cyan-400",    bg: "bg-cyan-400/10",    border: "border-cyan-400/20",    bar: "#06B6D4" },
  partially_paid: { icon: DollarSign,    color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20",   bar: "#F59E0B" },
  paid:           { icon: CheckCircle,   color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", bar: "#10B981" },
  overdue:        { icon: AlertTriangle, color: "text-rose-400",    bg: "bg-rose-400/10",    border: "border-rose-400/20",    bar: "#F43F5E" },
};

const HEALTH_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  healthy:          { color: "text-emerald-400", bg: "bg-emerald-400/10", label: "✓" },
  attention_needed: { color: "text-amber-400",   bg: "bg-amber-400/10",  label: "!" },
  high_risk:        { color: "text-orange-400",  bg: "bg-orange-400/10", label: "!!" },
  overdue:          { color: "text-rose-400",    bg: "bg-rose-400/10",   label: "⚠" },
  settled:          { color: "text-gray-400",    bg: "bg-gray-400/10",   label: "✓" },
};

const TABS: { value: TabValue; labelKey: string }[] = [
  { value: "all",            labelKey: "debt_tabs.all"            },
  { value: "active",         labelKey: "debt_tabs.active"         },
  { value: "partially_paid", labelKey: "debt_tabs.partially_paid" },
  { value: "overdue",        labelKey: "debt_tabs.overdue"        },
  { value: "paid",           labelKey: "debt_tabs.paid"           },
];

export default function DebtsPage() {
  const { isGuest } = useGuest();
  const { t, formatDate } = useTranslation();
  const { format }        = useCurrency();
  const { toasts, addToast, dismiss } = useToast();
  const queryClient = useQueryClient();

  const [cleaning, setCleaning]       = useState(false);

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

  const [showForm, setShowForm]       = useState(false);
  const [showPayment, setShowPayment] = useState<Debt | null>(null);
  const [editing, setEditing]         = useState<Debt | undefined>();
  const [confirmId, setConfirmId]     = useState<string | null>(null);
  const [tab, setTab]                 = useState<TabValue>("all");
  const [search, setSearch]           = useState("");
  const [contactFilter, setContactFilter] = useState<string | null>(null);
  const [contactModal, setContactModal]   = useState<string | null>(null);
  const [expandedIds, setExpandedIds]     = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Data ──────────────────────────────────────────────────────
  const { data: result, isLoading } = useDebts(isGuest);
  const debts: Debt[]   = result?.debts   ?? [];
  const summary         = result?.summary ?? { totalPayable: 0, totalReceivable: 0, overdueCount: 0, totalDebts: 0, activeDebts: 0 };

  const createMut  = useCreateDebt();
  const updateMut  = useUpdateDebt();
  const deleteMut  = useDeleteDebt();
  const paymentMut = useCreateDebtPayment();

  const deletingId = deleteMut.isPending ? (deleteMut.variables as string) : null;

  // ── Handlers ──────────────────────────────────────────────────
  async function handleSubmit(data: DebtFormData) {
    if (isGuest) { addToast(t("debts.guest_auth"), "info"); setShowForm(false); return; }
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
    } catch {
      addToast(t("debts.save_failed"), "error");
      throw new Error("submit failed");
    }
  }

  async function handlePayment(debt: Debt, data: DebtPaymentFormData) {
    if (isGuest) { addToast(t("debts.guest_payment"), "info"); setShowPayment(null); return; }
    try {
      await paymentMut.mutateAsync({ debtId: debt.id, data });
      addToast(t("debts.payment_added"), "success");
      setShowPayment(null);
    } catch {
      addToast(t("debts.payment_failed"), "error");
      throw new Error("payment failed");
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

  // ── Derived ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...debts];
    if (tab !== "all") list = list.filter((d) => d.status === tab);
    if (contactFilter) list = list.filter((d) => d.contact_id === contactFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.person_or_entity.toLowerCase().includes(q) ||
        (d.notes?.toLowerCase().includes(q) ?? false) ||
        (d.contact?.name?.toLowerCase().includes(q) ?? false)
      );
    }
    const order: Record<DebtStatus, number> = { overdue: 0, active: 1, partially_paid: 2, paid: 3 };
    return list.sort((a, b) => order[a.status] - order[b.status]);
  }, [debts, tab, contactFilter, search]);

  const uniqueContacts = useMemo(() => {
    const seen = new Map<string, Pick<FinancialContact, "id" | "name" | "type">>();
    debts.forEach((d) => {
      if (d.contact_id && d.contact && !seen.has(d.contact_id)) {
        seen.set(d.contact_id, d.contact as Pick<FinancialContact, "id" | "name" | "type">);
      }
    });
    return Array.from(seen.values());
  }, [debts]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: debts.length, active: 0, partially_paid: 0, overdue: 0, paid: 0 };
    debts.forEach((d) => { counts[d.status] = (counts[d.status] ?? 0) + 1; });
    return counts as Record<TabValue, number>;
  }, [debts]);

  const netBalance = summary.totalReceivable - summary.totalPayable;
  const isNetPositive = netBalance >= 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold t1">{t("debts.title")}</h1>
          <p className="text-sm t2 mt-0.5">{t("debts.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isGuest && (
            <button onClick={cleanupLegacyTransactions} disabled={cleaning}
              title="إصلاح الرصيد — حذف المعاملات المكررة القديمة"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-amber-400/25 text-amber-400 bg-amber-400/8 hover:bg-amber-400/15 transition-all disabled:opacity-50">
              {cleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
              {cleaning ? "..." : t("debts.fix_balance")}
            </button>
          )}
          <button onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-all pressable"
            style={{ background: "linear-gradient(135deg, #F43F5E, #E11D48)" }}>
            <Plus className="w-3.5 h-3.5" />{t("debts.add")}
          </button>
        </div>
      </div>

      {/* ── Financial Truth Hero ────────────────────────────────── */}
      {!isLoading && debts.length > 0 && (
        <div className="relative rounded-[1.5rem] overflow-hidden p-6"
          style={{
            background: isNetPositive
              ? "linear-gradient(135deg, #0B3D2A 0%, #0E1F3A 60%, #0B3D4F 100%)"
              : "linear-gradient(135deg, #3D0B1A 0%, #1A0F0B 60%, #1A0F3A 100%)",
          }}>
          <div className="absolute top-0 end-0 w-56 h-56 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: isNetPositive ? "#10B981" : "#F43F5E", transform: "translate(30%,-30%)" }} />

          <div className="relative z-10">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em] mb-1">
              {t("debts.net_balance")}
            </p>
            <p className="text-4xl font-bold text-white number-display mb-4">
              {isNetPositive ? "+" : ""}{format(netBalance)}
            </p>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
              {/* Receivable */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                  <p className="text-[10px] text-white/40 uppercase tracking-wide">{t("debts.receivable")}</p>
                </div>
                <p className="text-sm font-bold text-emerald-300">+{format(summary.totalReceivable)}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{t("debts.receivable_hint")}</p>
              </div>

              {/* Payable */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="w-3 h-3 text-rose-400 shrink-0" />
                  <p className="text-[10px] text-white/40 uppercase tracking-wide">{t("debts.payable")}</p>
                </div>
                <p className="text-sm font-bold text-rose-300">-{format(summary.totalPayable)}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{t("debts.payable_hint")}</p>
              </div>

              {/* Overdue */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <p className="text-[10px] text-white/40 uppercase tracking-wide">{t("debts.overdue")}</p>
                </div>
                <p className={`text-sm font-bold ${summary.overdueCount > 0 ? "text-rose-300" : "text-emerald-300"}`}>
                  {summary.overdueCount}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">{t("debts.debts")}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      {!isLoading && debts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: t("debts.total_debt"),
              value: format(debts.reduce((s, d) => s + Number(d.total_amount), 0)),
              sub:   `${summary.totalDebts} ${t("debts.debts")}`,
              icon:  CreditCard,
              color: "text-rose-400",
              bg:    "bg-rose-400/10",
            },
            {
              label: t("debts.total_paid"),
              value: format(debts.reduce((s, d) => s + Number(d.paid_amount), 0)),
              sub:   `${debts.filter(d => d.status === "paid").length} ${t("debts.status.paid")}`,
              icon:  CheckCircle,
              color: "text-emerald-400",
              bg:    "bg-emerald-400/10",
            },
            {
              label: t("debts.remaining"),
              value: format(summary.totalPayable + summary.totalReceivable),
              sub:   `${summary.activeDebts} ${t("debts.active")}`,
              icon:  Activity,
              color: "text-amber-400",
              bg:    "bg-amber-400/10",
            },
            {
              label: t("debts.health"),
              value: summary.overdueCount === 0 ? "✓ " + t("debts.health_good") : `${summary.overdueCount} ${t("debts.overdue")}`,
              sub:   t(summary.overdueCount === 0 ? "debts.no_overdue" : "debts.has_overdue"),
              icon:  Shield,
              color: summary.overdueCount === 0 ? "text-emerald-400" : "text-rose-400",
              bg:    summary.overdueCount === 0 ? "bg-emerald-400/10" : "bg-rose-400/10",
            },
          ].map((k) => (
            <div key={k.label} className="card-elevated p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] t3 uppercase tracking-wide font-semibold">{k.label}</p>
                <div className={`p-1.5 rounded-lg ${k.bg}`}><k.icon className={`w-3 h-3 ${k.color}`} /></div>
              </div>
              <p className={`text-base font-bold number-display ${k.color}`}>{k.value}</p>
              <p className="text-[10px] t3 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map((tb) => (
          <button key={tb.value} onClick={() => setTab(tb.value)}
            className={`tab-pill shrink-0 flex items-center gap-1.5 ${tab === tb.value ? "active" : ""}`}>
            {t(tb.labelKey)}
            {tabCounts[tb.value] > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                tab === tb.value ? "bg-white/20 text-white" : "bg-[hsl(var(--bg-input))] t3"
              }`}>{tabCounts[tb.value]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Search + Contact filter ─────────────────────────────── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 t3" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={`${t("debts.creditor")}...`} className="field ps-9" />
        </div>
        {uniqueContacts.length > 0 && (
          <select value={contactFilter ?? ""} onChange={(e) => setContactFilter(e.target.value || null)}
            className="field w-auto text-sm" style={{ backgroundColor: "hsl(var(--bg-input))" }}>
            <option value="">{t("contacts.select")}</option>
            {uniqueContacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Debt Cards ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card p-5 animate-pulse">
              <div className="flex gap-4">
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
        <div className="card py-16 text-center">
          <CreditCard className="w-8 h-8 t3 opacity-25 mx-auto mb-3" />
          <p className="text-sm font-semibold t1">{t("debts.no_data")}</p>
          {tab === "all" && !search && !contactFilter && (
            <button onClick={() => setShowForm(true)} className="text-sm text-rose-400 hover:underline mt-2">
              {t("debts.add")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((debt) => {
            const cfg         = STATUS_CONFIG[debt.status as DebtStatus] ?? STATUS_CONFIG.active;
            const total       = Number(debt.total_amount);
            const paid        = Number((debt as Debt & { paid_amount: number }).paid_amount ?? 0);
            const remaining   = Number((debt as Debt & { remaining_amount?: number }).remaining_amount ?? (total - paid));
            const pct         = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
            const health      = (debt as Debt & { health?: string }).health;
            const healthCfg   = health ? HEALTH_CONFIG[health] : null;
            const overdueDays = (debt as Debt & { overdueDays?: number }).overdueDays ?? 0;
            const paymentsCount = (debt as Debt & { paymentsCount?: number }).paymentsCount ?? 0;
            const isDeleting  = deletingId === debt.id;
            const isOverdue   = !!debt.due_date && new Date(debt.due_date) < new Date() && debt.status !== "paid";
            const isExpanded  = expandedIds.has(debt.id);

            return (
              <div key={debt.id}
                className={`card overflow-hidden transition-all ${
                  debt.status === "overdue" ? "border-rose-400/25" : ""
                } ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}>

                {/* Progress accent line */}
                <div className="h-0.5 w-full" style={{ backgroundColor: cfg.bar, opacity: 0.5 }} />

                {/* ── Compact row (always visible) ─────────────── */}
                <button
                  type="button"
                  onClick={() => toggleExpand(debt.id)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-start hover:bg-[hsl(var(--bg-input))] transition-colors"
                >
                  <div className={`p-2 rounded-xl shrink-0 ${cfg.bg}`}>
                    <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold t1 truncate">{debt.person_or_entity}</p>
                      {healthCfg && health !== "settled" && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${healthCfg.bg} ${healthCfg.color}`}>
                          {healthCfg.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        debt.debt_type === "receivable" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"
                      }`}>{t(`debts.${debt.debt_type}`)}</span>
                      <span className={`text-[10px] font-medium ${cfg.color}`}>{t(`debts.status.${debt.status}`)}</span>
                      {pct > 0 && pct < 100 && (
                        <span className="text-[10px] t3">{pct.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-end">
                      <p className="text-sm font-bold t1">{format(remaining)}</p>
                      {paid > 0 && <p className="text-[10px] t3">{t("debts.paid_amount", { amount: format(paid) })}</p>}
                    </div>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-4 h-4 t3" />
                    </motion.div>
                  </div>
                </button>

                {/* ── Expanded details ──────────────────────────── */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-[hsl(var(--border-2))] space-y-3">
                        {/* Contact */}
                        {debt.contact && debt.contact_id && (
                          <button type="button" onClick={() => setContactModal(debt.contact_id!)}
                            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                            <User className="w-3 h-3" />
                            <span>{debt.contact.name}</span>
                            <span className="t3">· {t(`contacts.types.${debt.contact.type}`)}</span>
                          </button>
                        )}

                        {/* Due date */}
                        {debt.due_date && (
                          <p className={`text-xs ${isOverdue ? "text-rose-400 font-medium" : "t3"}`}>
                            {t("debts.due", { date: formatDate(debt.due_date) })}
                            {overdueDays > 0 && <span className="text-rose-400 font-semibold ms-1">({overdueDays} {t("debts.days_overdue")})</span>}
                          </p>
                        )}

                        {/* Notes */}
                        {debt.notes && <p className="text-xs t3">{debt.notes}</p>}

                        {/* Progress bar */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs t3">{paymentsCount} {t("debts.payments")}</span>
                            <span className={`text-xs font-semibold ${pct >= 100 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "t3"}`}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-2 bg-[hsl(var(--bg-input))] rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              style={{ backgroundColor: cfg.bar }}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin t3" /> : (
                            <>
                              {debt.status !== "paid" && (
                                <button onClick={() => setShowPayment(debt)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 rounded-lg transition-all">
                                  <DollarSign className="w-3 h-3" />{t("debts.add_payment")}
                                </button>
                              )}
                              <button onClick={() => { setEditing(debt); setShowForm(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold t2 hover:t1 bg-[hsl(var(--bg-input))] hover:bg-[hsl(var(--bg-card-2))] rounded-lg transition-all">
                                <Pencil className="w-3 h-3" />{t("common.edit")}
                              </button>
                              <button onClick={() => setConfirmId(debt.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all ms-auto">
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
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────── */}
      {showForm && (
        <DebtForm initial={editing} onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditing(undefined); }} />
      )}
      {showPayment && (
        <DebtPaymentForm debt={showPayment}
          onSubmit={(data: DebtPaymentFormData) => handlePayment(showPayment, data)}
          onClose={() => setShowPayment(null)} />
      )}
      {confirmId && (
        <ConfirmModal message={t("debts.confirm_delete_msg")} loading={deleteMut.isPending}
          onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
      )}
      {contactModal && (
        <ContactDetailModal contactId={contactModal} onClose={() => setContactModal(null)} />
      )}
      <ToastList toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
