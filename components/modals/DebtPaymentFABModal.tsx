"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Loader2, AlertTriangle, DollarSign, CalendarDays, FileText, Check } from "lucide-react";
import { Debt, DebtPaymentFormData } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { createDebtGroupPayment } from "@/lib/finance/createFinancialEntry";
import { safeFetch } from "@/lib/fetch-safe";
import { spring, tapTransition } from "@/lib/motion";
import SheetDragHandle from "@/components/ui/SheetDragHandle";

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

const today = new Date().toISOString().split("T")[0];
const RING  = "#f59e0b"; // amber for debt payment selection

type DebtGroup = {
  key: string;
  name: string;
  debtType: Debt["debt_type"];
  debts: Debt[];
  totalRemaining: number;
  totalAmount: number;
  paidAmount: number;
  overdueCount: number;
};

export default function DebtPaymentFABModal({ onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const { format, symbol } = useCurrency();

  const [step, setStep]                   = useState<"select" | "pay">("select");
  const [debts, setDebts]                 = useState<Debt[]>([]);
  const [loadingDebts, setLoading]        = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<DebtGroup | null>(null);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState("");
  const [rawAmount, setRawAmount]         = useState("");

  const [form, setForm] = useState<DebtPaymentFormData>({
    amount: 0, payment_date: today, notes: null,
  });

  useEffect(() => {
    safeFetch("/api/debts")
      .then((r) => r.json())
      .then((data) => {
        const active = (data.debts ?? []).filter((d: Debt) => d.status !== "paid") as Debt[];
        setDebts(active);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function set<K extends keyof DebtPaymentFormData>(k: K, v: DebtPaymentFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function handleAmount(val: string) {
    setRawAmount(val);
    set("amount", parseFloat(val) || 0);
  }

  function selectGroup(group: DebtGroup) {
    setSelectedGroup(group);
    setStep("pay");
  }

  const debtGroups = useMemo(() => {
    const groups = new Map<string, DebtGroup>();
    debts.forEach((debt) => {
      const name = debt.contact?.name || debt.person_or_entity;
      const key  = `${debt.contact_id || name.trim().toLowerCase()}::${debt.debt_type}`;
      const remaining = Math.max(
        Number(debt.remaining_amount ?? Number(debt.total_amount) - Number(debt.paid_amount)), 0
      );
      const current = groups.get(key) ?? {
        key, name, debtType: debt.debt_type, debts: [],
        totalRemaining: 0, totalAmount: 0, paidAmount: 0, overdueCount: 0,
      };
      current.debts.push(debt);
      current.totalRemaining += remaining;
      current.totalAmount    += Number(debt.total_amount);
      current.paidAmount     += Number(debt.paid_amount);
      if (debt.status === "overdue") current.overdueCount += 1;
      groups.set(key, current);
    });
    return Array.from(groups.values()).sort((a, b) => b.totalRemaining - a.totalRemaining);
  }, [debts]);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!selectedGroup) return;
    if (form.amount <= 0) { setError(t("transactions.amount_positive")); return; }
    const remaining = selectedGroup.totalRemaining;
    if (form.amount > remaining) { setError(`${t("debts.remaining")}: ${format(remaining)}`); return; }

    setSubmitting(true);
    setError("");
    try {
      await createDebtGroupPayment(selectedGroup.debts.map((debt) => debt.id), form);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknown_error"));
      setSubmitting(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(19,26,34,0.68)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={spring}
        className="w-full sm:max-w-md rounded-t-[1.75rem] sm:rounded-[1.5rem] overflow-hidden flex flex-col"
        style={{ backgroundColor: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", maxHeight: "88dvh" }}
      >
        {/* Header */}
        <div
          className="shrink-0 px-5 pt-4 pb-4 border-b border-[hsl(var(--border))]"
          style={{ background: `${RING}10` }}
        >
          <div className="mb-2 sm:hidden">
            <SheetDragHandle onClose={onClose} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {step === "pay" && (
                <motion.button
                  type="button"
                  onClick={() => setStep("select")}
                  whileTap={{ scale: 0.92 }} transition={tapTransition}
                  className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center t3 hover:t1 hover:bg-white/8 transition-all"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </motion.button>
              )}
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 rounded-2xl p-2.5 ring-1 ring-white/5 bg-amber-400/10">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold t1 truncate">
                    {step === "select" ? t("debts.add_payment") : `${t("debts.add_payment")}: ${selectedGroup?.name}`}
                  </h2>
                  <p className="text-xs t3 truncate">
                    {step === "select" ? t("common.all") : selectedGroup?.name}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 t3 transition-all hover:bg-white/5 hover:t1 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step 1 — Select debt group */}
        {step === "select" && (
          <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))" }}>
            {loadingDebts ? (
              <div className="flex items-center justify-center py-12 gap-2 t3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t("common.loading")}</span>
              </div>
            ) : debtGroups.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm t3">{t("debts.no_data")}</p>
              </div>
            ) : (
              debtGroups.map((group) => {
                const pct = group.totalAmount > 0 ? (group.paidAmount / group.totalAmount) * 100 : 0;
                return (
                  <motion.button
                    key={group.key}
                    type="button"
                    onClick={() => selectGroup(group)}
                    whileTap={{ scale: 0.98 }} transition={tapTransition}
                    className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 p-4 text-start hover:border-amber-400/30 hover:bg-amber-400/5 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold t1 truncate">{group.name}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[hsl(var(--bg-card))] t3 border border-[hsl(var(--border))]">
                            {group.debts.length}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                            group.debtType === "receivable" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"
                          }`}>
                            {t(`debts.${group.debtType}`)}
                          </span>
                          {group.overdueCount > 0 && (
                            <span className="text-[10px] flex items-center gap-0.5 text-rose-400 font-medium">
                              <AlertTriangle className="w-3 h-3" />{group.overdueCount}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 h-1.5 bg-[hsl(var(--bg-card))] rounded-full overflow-hidden w-32">
                          <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                      <div className="text-end shrink-0 flex items-center gap-2">
                        <div>
                          <p className="text-sm font-bold number-display text-amber-400">{format(group.totalRemaining)}</p>
                          <p className="text-[10px] t3">{t("debts.remaining")}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 t3 group-hover:text-amber-400 transition-all" />
                      </div>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>
        )}

        {/* Step 2 — Payment form */}
        {step === "pay" && selectedGroup && (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">

              {/* Summary */}
              <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold t1 truncate">{selectedGroup.name}</p>
                    <p className="text-[11px] t3 mt-0.5">
                      {selectedGroup.debts.length} {t("relationship.total_debts")} · {t(`debts.${selectedGroup.debtType}`)}
                    </p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-[10px] t3">{t("debts.remaining")}</p>
                    <p className="text-sm font-black number-display text-amber-400">{format(selectedGroup.totalRemaining)}</p>
                  </div>
                </div>
              </section>

              {/* Amount */}
              <section
                className="rounded-2xl border p-4"
                style={{ borderColor: "#34d39930", backgroundColor: "#34d39908" }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-wide t2">{t("debts.payment_amount")}</label>
                  {rawAmount && (
                    <button type="button" onClick={() => { setRawAmount(""); set("amount", 0); }}
                      className="rounded-lg p-1.5 t3 transition-colors hover:bg-white/5 hover:t1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute start-4 top-1/2 -translate-y-1/2 text-lg font-bold t3">{symbol}</span>
                  <input
                    type="number" inputMode="decimal" min="0.01" step="0.01"
                    max={selectedGroup.totalRemaining}
                    value={rawAmount}
                    onChange={(e) => handleAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full ps-12 pe-4 py-4 text-4xl font-black number-display rounded-2xl bg-[hsl(var(--bg-card))] border focus:outline-none transition-all"
                    style={{ color: rawAmount ? "#34d399" : undefined, borderColor: rawAmount ? "#34d39940" : "hsl(var(--border))" }}
                    autoFocus
                  />
                </div>
              </section>

              {/* Date + Notes */}
              <section className="space-y-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide t2 mb-2">
                      <CalendarDays className="w-4 h-4 t3" />
                      {t("debts.payment_date")}
                    </label>
                    <input
                      type="date" required value={form.payment_date}
                      onChange={(e) => set("payment_date", e.target.value)}
                      className="field text-sm"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide t2 mb-2">
                      <FileText className="w-4 h-4 t3" />
                      {t("debts.payment_notes")}
                      <span className="font-normal normal-case t3">({t("debts.notes_optional")})</span>
                    </label>
                    <input
                      value={form.notes ?? ""}
                      onChange={(e) => set("notes", e.target.value || null)}
                      className="field text-sm"
                      placeholder={t("debts.notes_placeholder")}
                    />
                  </div>
                </div>
              </section>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-400"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div
              className="shrink-0 border-t border-[hsl(var(--border))] px-5 pt-3"
              style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 8px))" }}
            >
              <motion.button
                type="submit"
                disabled={submitting || form.amount <= 0}
                whileTap={{ scale: 0.97 }} transition={tapTransition}
                className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #34d399, #34d399bb)" }}
              >
                <AnimatePresence mode="wait">
                  {submitting ? (
                    <motion.span key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("common.saving")}
                    </motion.span>
                  ) : (
                    <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" />
                      {t("debts.add_payment")}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </form>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
