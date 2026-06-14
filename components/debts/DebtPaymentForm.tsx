"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, DollarSign, CalendarDays, FileText, Loader2, Check } from "lucide-react";
import { Debt, DebtPaymentFormData } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import SheetDragHandle from "@/components/ui/SheetDragHandle";

interface Props {
  debt?: Debt;
  debts?: Debt[];
  onSubmit: (data: DebtPaymentFormData) => Promise<void>;
  onClose: () => void;
}

const today = new Date().toISOString().split("T")[0];
const RING = "#34d399";

export default function DebtPaymentForm({ debt, debts, onSubmit, onClose }: Props) {
  const { t, formatDate } = useTranslation();
  const { format, symbol } = useCurrency();

  const paymentDebts = debts ?? (debt ? [debt] : []);
  const primaryDebt  = paymentDebts[0];
  const remaining    = paymentDebts.reduce((sum, item) => {
    return sum + Math.max(Number(item.remaining_amount ?? Number(item.total_amount) - Number(item.paid_amount)), 0);
  }, 0);
  const displayName  = primaryDebt?.contact?.name || primaryDebt?.person_or_entity || "";

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spendix:nav-hide"));
    setError("");  // reset any stale error on open
    return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
  }, []);

  const [form, setForm]     = useState<DebtPaymentFormData>({ amount: 0, payment_date: today, notes: null });
  const [rawAmount, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  function set<K extends keyof DebtPaymentFormData>(k: K, v: DebtPaymentFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function handleAmount(val: string) {
    setRaw(val);
    set("amount", parseFloat(val) || 0);
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (form.amount <= 0)        { setError(`${t("debts.payment_amount")} > 0`); return; }
    if (form.amount > remaining) { setError(`${t("debts.remaining")}: ${format(remaining)}`); return; }
    setLoading(true);
    setError("");
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknown_error"));
      setLoading(false);
    }
  }

  if (!primaryDebt) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(11,15,20,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={spring}
        className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden flex flex-col"
        style={{ backgroundColor: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", maxHeight: "92dvh" }}
      >
        {/* Header */}
        <div
          className="shrink-0 px-5 pt-5 pb-4"
          style={{ background: `${RING}10` }}
        >
          <div className="mb-2 sm:hidden">
            <SheetDragHandle onClose={onClose} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 rounded-xl p-2.5 ring-1 ring-white/5 bg-emerald-400/10">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold t1 truncate">{t("debts.add_payment")}</h2>
                <p className="text-xs t3 truncate">{displayName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 t3 transition-all hover:bg-white/5 hover:t1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">

            {/* Debt summary */}
            <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold t1 truncate">{displayName}</p>
                  <p className="text-[11px] t3 mt-0.5">
                    {paymentDebts.length} {t("relationship.total_debts")} Â· {t(`debts.${primaryDebt.debt_type}`)}
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-[10px] t3">{t("debts.remaining")}</p>
                  <p className="text-sm font-black number-display text-amber-400">{format(remaining)}</p>
                  {primaryDebt.due_date && (
                    <p className="text-[10px] t3 mt-0.5">{formatDate(primaryDebt.due_date)}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Amount */}
            <section
              className="rounded-xl border p-4"
              style={{ borderColor: `${RING}30`, backgroundColor: `${RING}08` }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide t2">{t("debts.payment_amount")}</label>
                {rawAmount && (
                  <button type="button" onClick={() => { setRaw(""); set("amount", 0); }}
                    className="rounded-lg p-1.5 t3 transition-colors hover:bg-white/5 hover:t1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute start-4 top-1/2 -translate-y-1/2 text-lg font-bold t3">{symbol}</span>
                <input
                  type="number" inputMode="decimal" min="0.01" step="0.01" max={remaining}
                  value={rawAmount}
                  onChange={(e) => handleAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full ps-12 pe-4 py-4 text-4xl font-black number-display rounded-xl bg-[hsl(var(--bg-card))] border focus:outline-none transition-all"
                  style={{ color: rawAmount ? RING : undefined, borderColor: rawAmount ? `${RING}40` : "hsl(var(--border))" }}
                  autoFocus
                />
              </div>
            </section>

            {/* Date + Notes */}
            <section className="space-y-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 p-4">
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
            className="shrink-0 px-5 pt-2"
            style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))" }}
          >
            <motion.button
              type="submit"
              disabled={loading || form.amount <= 0}
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${RING}, ${RING}bb)` }}
            >
              <AnimatePresence mode="wait">
                {loading ? (
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
      </motion.div>
    </div>,
    document.body
  );
}

