"use client";

import { useState, useEffect, useMemo } from "react";
import { X, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { Debt, DebtPaymentFormData } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { createDebtGroupPayment } from "@/lib/finance/createFinancialEntry";
import { safeFetch } from "@/lib/fetch-safe";

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

const today = new Date().toISOString().split("T")[0];

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
  const { t, formatDate } = useTranslation();
  const { format } = useCurrency();

  const [step, setStep]             = useState<"select" | "pay">("select");
  const [debts, setDebts]           = useState<Debt[]>([]);
  const [loadingDebts, setLoading]  = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<DebtGroup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  const [form, setForm] = useState<DebtPaymentFormData>({
    amount:       0,
    payment_date: today,
    notes:        null,
  });

  useEffect(() => {
    safeFetch("/api/debts")
      .then((r) => r.json())
      .then((data) => {
        const active = (data.debts ?? []).filter(
          (d: Debt) => d.status !== "paid"
        ) as Debt[];
        setDebts(active);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function set<K extends keyof DebtPaymentFormData>(k: K, v: DebtPaymentFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function selectGroup(group: DebtGroup) {
    setSelectedGroup(group);
    setStep("pay");
  }

  const debtGroups = useMemo(() => {
    const groups = new Map<string, DebtGroup>();

    debts.forEach((debt) => {
      const name = debt.contact?.name || debt.person_or_entity;
      const key = `${debt.contact_id || name.trim().toLowerCase()}::${debt.debt_type}`;
      const remaining = Math.max(
        Number(debt.remaining_amount ?? Number(debt.total_amount) - Number(debt.paid_amount)),
        0
      );
      const current = groups.get(key) ?? {
        key,
        name,
        debtType: debt.debt_type,
        debts: [],
        totalRemaining: 0,
        totalAmount: 0,
        paidAmount: 0,
        overdueCount: 0,
      };

      current.debts.push(debt);
      current.totalRemaining += remaining;
      current.totalAmount += Number(debt.total_amount);
      current.paidAmount += Number(debt.paid_amount);
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
    if (form.amount > remaining) { setError(`الحد الأقصى: ${format(remaining)}`); return; }

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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
      <div className="modal-card w-full max-w-md overflow-hidden rounded-t-[2rem] sm:rounded-[1.25rem] flex flex-col" style={{ maxHeight: "85dvh" }}>

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/10" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-2">
            {step === "pay" && (
              <button onClick={() => setStep("select")} className="t3 hover:t1 p-1 rounded-lg transition-all">
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <h2 className="text-sm font-semibold t1">
              {step === "select"
                ? t("debts.add_payment") + " — " + t("common.all")
                : `${t("debts.add_payment")}: ${selectedGroup?.name}`}
            </h2>
          </div>
          <button onClick={onClose} className="t3 hover:t1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1 — Select debt */}
        {step === "select" && (
          <div className="p-4 space-y-2 overflow-y-auto flex-1" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}>
            {loadingDebts ? (
              <div className="flex items-center justify-center py-8 gap-2 t3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t("common.loading")}</span>
              </div>
            ) : debtGroups.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm t3">{t("debts.no_data")}</p>
              </div>
            ) : (
              debtGroups.map((group) => {
                const pct = group.totalAmount > 0 ? (group.paidAmount / group.totalAmount) * 100 : 0;
                return (
                  <div key={group.key} className="rounded-xl border border-[hsl(var(--border-2))] card-2 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => selectGroup(group)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--bg-input))] transition-all text-start group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold t1 truncate">{group.name}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--bg-input))] t3">
                            {group.debts.length}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            group.debtType === "receivable" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"
                          }`}>
                            {t(`debts.${group.debtType}`)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-400/10 text-amber-400">
                            {t("debts.remaining")}
                          </span>
                          {group.overdueCount > 0 && (
                            <span className="text-xs flex items-center gap-0.5 text-rose-400">
                              <AlertTriangle className="w-3 h-3" />{group.overdueCount} {t("debts.status.overdue")}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 h-1 bg-[hsl(var(--bg-input))] rounded-full overflow-hidden w-36">
                          <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                      <div className="text-end ms-3 shrink-0">
                        <p className="text-sm font-bold text-amber-400">{format(group.totalRemaining)}</p>
                        <p className="text-xs t3">{t("debts.remaining")}</p>
                        <ChevronRight className="w-4 h-4 t3 mt-1 ms-auto group-hover:text-cyan-400 transition-all" />
                      </div>
                    </button>

                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Step 2 - Payment form */}
        {step === "pay" && selectedGroup && (
          <form onSubmit={handleSubmit} className="px-6 pt-5 space-y-4 overflow-y-auto flex-1"
            style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))" }}>
            {/* Debt summary */}
            <div className="card-2 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs t3">{t("debts.creditor")}</p>
                <p className="text-sm font-semibold t1">{selectedGroup.name}</p>
                <p className="text-xs t3 mt-0.5">
                  {selectedGroup.debts.length} {t("relationship.total_debts")} - {t(`debts.${selectedGroup.debtType}`)}
                </p>
              </div>
              <div className="text-end">
                <p className="text-xs t3">{t("debts.remaining")}</p>
                <p className="text-sm font-bold text-amber-400">
                  {format(selectedGroup.totalRemaining)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium t2 mb-1.5">{t("debts.payment_amount")}</label>
                <input type="number" required min="0.01" step="0.01"
                  value={form.amount || ""}
                  onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
                  className="field" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium t2 mb-1.5">{t("debts.payment_date")}</label>
                <input type="date" required value={form.payment_date}
                  onChange={(e) => set("payment_date", e.target.value)}
                  className="field" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium t2 mb-1.5">
                {t("debts.payment_notes")} <span className="t3 font-normal">({t("debts.notes_optional")})</span>
              </label>
              <input value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value || null)}
                className="field" placeholder={t("debts.notes_placeholder")} />
            </div>

            {error && <p className="text-xs text-rose-400 bg-rose-400/10 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-[hsl(var(--border))] t2 hover:t1 rounded-xl text-sm font-medium transition-all">
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 text-[#0B0F17] rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "..." : t("debts.add_payment")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
