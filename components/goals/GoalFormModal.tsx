"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export const GOAL_CATEGORIES = ["emergency", "home", "travel", "education", "car", "other"] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export interface FinancialGoal {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  monthlyContribution: number;
  dueDate: string;
  category: GoalCategory;
}

export interface GoalFormData {
  title: string;
  targetAmount: number;
  savedAmount: number;
  monthlyContribution: number;
  dueDate: string;
  category: GoalCategory;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function GoalFormModal({
  initial,
  loading = false,
  onClose,
  onSubmit,
}: {
  initial?: FinancialGoal;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: GoalFormData) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<GoalFormData>({
    title:               initial?.title               ?? "",
    targetAmount:        initial?.targetAmount        ?? 0,
    savedAmount:         initial?.savedAmount         ?? 0,
    monthlyContribution: initial?.monthlyContribution ?? 0,
    dueDate:             initial?.dueDate             ?? toInputDate(addMonths(new Date(), 6)),
    category:            initial?.category            ?? "emergency",
  });
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || Number(form.targetAmount) <= 0 || Number(form.savedAmount) < 0) {
      setError(t("goals.form_error"));
      return;
    }
    setError("");
    onSubmit({
      ...form,
      title:               form.title.trim(),
      targetAmount:        Number(form.targetAmount),
      savedAmount:         Number(form.savedAmount),
      monthlyContribution: Number(form.monthlyContribution),
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-3 sm:items-center sm:p-4"
      style={{ backgroundColor: "rgba(19,26,34,0.68)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="modal-card mt-[calc(72px+env(safe-area-inset-top,0px))] w-full space-y-4 overflow-y-auto overscroll-contain rounded-[1.5rem] p-5 sm:mt-0 sm:max-w-md"
        style={{ maxHeight: "calc(100dvh - 108px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold t1">
              {initial ? t("goals.edit_goal") : t("goals.new_goal")}
            </h2>
            <p className="mt-1 text-xs t3">{t("goals.form_hint")}</p>
          </div>
          <button type="button" onClick={onClose} className="icon-button" aria-label={t("common.close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t3">
            {t("goals.title_field")}
          </label>
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="field"
            placeholder={t("goals.title_placeholder")}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t3">
              {t("goals.target_amount")}
            </label>
            <input type="number" min="0.01" step="0.01" inputMode="decimal"
              value={form.targetAmount || ""}
              onChange={(e) => setForm((p) => ({ ...p, targetAmount: Number(e.target.value) }))}
              className="field number-display" placeholder="0.00" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t3">
              {t("goals.saved_amount")}
            </label>
            <input type="number" min="0" step="0.01" inputMode="decimal"
              value={form.savedAmount || ""}
              onChange={(e) => setForm((p) => ({ ...p, savedAmount: Number(e.target.value) }))}
              className="field number-display" placeholder="0.00" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t3">
              {t("goals.due_date")}
            </label>
            <input type="date" value={form.dueDate}
              onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
              className="field" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t3">
              {t("goals.category")}
            </label>
            <select value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as GoalCategory }))}
              className="field">
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`goals.categories.${c}`)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t3">
            {t("goals.monthly_contribution")}
          </label>
          <input type="number" min="0" step="0.01" inputMode="decimal"
            value={form.monthlyContribution || ""}
            onChange={(e) => setForm((p) => ({ ...p, monthlyContribution: Number(e.target.value) }))}
            className="field number-display" placeholder="0.00" />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 py-3 text-sm font-bold text-[#0B0F14] disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? t("common.save") : t("goals.create_goal")}
        </button>
      </form>
    </div>
  );
}
