"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Debt, DebtStatus } from "@/lib/mock-data";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

interface Props {
  onAdd: (debt: Debt) => void;
  onClose: () => void;
}

const today = new Date().toISOString().split("T")[0];

export default function AddDebtModal({ onAdd, onClose }: Props) {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const [form, setForm] = useState({
    creditor: "", amount: "", paid: "0",
    interestRate: "", dueDate: today,
    status: "pending" as DebtStatus, notes: "",
  });

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      id: crypto.randomUUID(),
      creditor: form.creditor,
      amount: parseFloat(form.amount) || 0,
      paid: parseFloat(form.paid) || 0,
      interestRate: parseFloat(form.interestRate) || 0,
      dueDate: form.dueDate,
      status: form.status,
      notes: form.notes || undefined,
    });
    onClose();
  }

  const STATUS_COLORS: Record<DebtStatus, string> = {
    pending:  "bg-amber-400/10 text-amber-400 border-amber-400/30",
    paid:     "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
    overdue:  "bg-rose-400/10 text-rose-400 border-rose-400/30",
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">{t("debts.add")}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("debts.creditor")}</label>
            <input required value={form.creditor} onChange={(e) => set("creditor", e.target.value)}
              className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm placeholder:text-gray-600 focus:outline-none focus:border-rose-400/40 transition-all"
              placeholder={t("debts.creditor_placeholder")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("debts.amount")} ({symbol})</label>
              <input required type="number" min="0" step="0.01" value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-400/40"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("debts.paid")} ({symbol})</label>
              <input type="number" min="0" step="0.01" value={form.paid}
                onChange={(e) => set("paid", e.target.value)}
                className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-400/40"
                placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("debts.interest_rate")}</label>
              <input type="number" min="0" max="100" step="0.1" value={form.interestRate}
                onChange={(e) => set("interestRate", e.target.value)}
                className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-400/40"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("debts.due_date")}</label>
              <input type="date" required value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)}
                className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-400/40" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("debts.status_label")}</label>
            <div className="grid grid-cols-3 gap-2">
              {(["pending", "paid", "overdue"] as DebtStatus[]).map((s) => (
                <button key={s} type="button" onClick={() => set("status", s)}
                  className={`py-2 rounded-xl text-xs font-medium border capitalize transition-all ${
                    form.status === s ? STATUS_COLORS[s] : "bg-white/3 text-gray-500 border-white/8 hover:border-white/15"
                  }`}>
                  {t(`debts.status.${s}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              {t("debts.notes")} <span className="text-gray-600 font-normal">({t("debts.notes_optional")})</span>
            </label>
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)}
              className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm placeholder:text-gray-600 focus:outline-none focus:border-rose-400/40 transition-all"
              placeholder={t("debts.notes_placeholder")} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-white/10 text-gray-400 hover:text-white rounded-xl text-sm font-medium transition-all">
              {t("common.cancel")}
            </button>
            <button type="submit"
              className="flex-1 py-2.5 bg-gradient-to-r from-rose-500 to-rose-400 hover:from-rose-400 hover:to-rose-300 text-white rounded-xl text-sm font-semibold transition-all">
              {t("common.add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
