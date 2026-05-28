"use client";

import { useState } from "react";
import { X, DollarSign } from "lucide-react";
import { Debt, DebtPaymentFormData } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

interface Props {
  debt?: Debt;
  debts?: Debt[];
  onSubmit: (data: DebtPaymentFormData) => Promise<void>;
  onClose: () => void;
}

const today = new Date().toISOString().split("T")[0];

export default function DebtPaymentForm({ debt, debts, onSubmit, onClose }: Props) {
  const { t, formatDate } = useTranslation();
  const { format } = useCurrency();

  const paymentDebts = debts ?? (debt ? [debt] : []);
  const primaryDebt = paymentDebts[0];
  const remaining = paymentDebts.reduce((sum, item) => {
    return sum + Math.max(Number(item.remaining_amount ?? Number(item.total_amount) - Number(item.paid_amount)), 0);
  }, 0);
  const displayName = primaryDebt?.contact?.name || primaryDebt?.person_or_entity || "";

  const [form, setForm] = useState<DebtPaymentFormData>({
    amount: 0,
    payment_date: today,
    notes: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof DebtPaymentFormData>(k: K, v: DebtPaymentFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (form.amount <= 0) {
      setError(`${t("debts.payment_amount")} > 0`);
      return;
    }
    if (form.amount > remaining) {
      setError(`${t("debts.remaining")}: ${format(remaining)}`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknown_error"));
      setLoading(false);
    }
  }

  if (!primaryDebt) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="modal-card w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-400/10">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold t1">{t("debts.add_payment")}</h2>
          </div>
          <button onClick={onClose} className="t3 hover:t1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-4 pb-2">
          <div className="bg-[hsl(var(--bg-input))] rounded-xl px-4 py-3">
            <p className="text-xs t3">{t("debts.creditor")}</p>
            <p className="text-sm font-semibold t1 mt-0.5">{displayName}</p>
            <p className="text-xs t3 mt-0.5">
              {paymentDebts.length} {t("relationship.total_debts")} · {t(`debts.${primaryDebt.debt_type}`)}
            </p>
            <div className="flex items-center justify-between mt-2">
              <div>
                <p className="text-xs t3">{t("debts.remaining")}</p>
                <p className="text-sm font-bold text-amber-400">{format(remaining)}</p>
              </div>
              {primaryDebt.due_date && (
                <div className="text-end">
                  <p className="text-xs t3">{t("debts.due_date")}</p>
                  <p className="text-sm t1">{formatDate(primaryDebt.due_date)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-5 space-y-4 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium t2 mb-1.5">{t("debts.payment_amount")}</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                max={remaining}
                value={form.amount || ""}
                onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
                className="field"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium t2 mb-1.5">{t("debts.payment_date")}</label>
              <input
                type="date"
                required
                value={form.payment_date}
                onChange={(e) => set("payment_date", e.target.value)}
                className="field"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium t2 mb-1.5">
              {t("debts.payment_notes")} <span className="t3 font-normal">({t("debts.notes_optional")})</span>
            </label>
            <input
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || null)}
              className="field"
              placeholder={t("debts.notes_placeholder")}
            />
          </div>

          {error && <p className="text-xs text-rose-400 bg-rose-400/10 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-[hsl(var(--border))] t2 hover:t1 rounded-xl text-sm font-medium transition-all"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 text-[#0B0F17] rounded-xl text-sm font-semibold transition-all"
            >
              {loading ? "..." : t("debts.add_payment")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
