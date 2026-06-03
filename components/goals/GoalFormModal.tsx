"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Car,
  CheckCircle2,
  GraduationCap,
  Home,
  Loader2,
  Package,
  Plane,
  Shield,
  Target,
  X,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import SheetDragHandle from "@/components/ui/SheetDragHandle";

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

type CategoryMeta = {
  icon: React.ElementType;
  color: string;
  bg: string;
  ring: string;
};

const CATEGORY_META: Record<GoalCategory, CategoryMeta> = {
  emergency: { icon: Shield,        color: "text-emerald-400", bg: "bg-emerald-400/10", ring: "#34d399" },
  home:      { icon: Home,          color: "text-cyan-400",    bg: "bg-cyan-400/10",    ring: "#22d3ee" },
  travel:    { icon: Plane,         color: "text-sky-400",     bg: "bg-sky-400/10",     ring: "#38bdf8" },
  education: { icon: GraduationCap, color: "text-purple-400",  bg: "bg-purple-400/10",  ring: "#a78bfa" },
  car:       { icon: Car,           color: "text-amber-400",   bg: "bg-amber-400/10",   ring: "#fbbf24" },
  other:     { icon: Package,       color: "text-gray-400",    bg: "bg-gray-400/10",    ring: "#9ca3af" },
};

const QUICK_MONTHS = [3, 6, 12];

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function numberInput(value: number) {
  return value > 0 ? String(value) : "";
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
  const { symbol, format } = useCurrency();
  const isEdit = !!initial;

  const [form, setForm] = useState<GoalFormData>({
    title:               initial?.title               ?? "",
    targetAmount:        initial?.targetAmount        ?? 0,
    savedAmount:         initial?.savedAmount         ?? 0,
    monthlyContribution: initial?.monthlyContribution ?? 0,
    dueDate:             initial?.dueDate             ?? toInputDate(addMonths(new Date(), 6)),
    category:            initial?.category            ?? "emergency",
  });
  const [rawTarget,  setRawTarget]  = useState(numberInput(initial?.targetAmount        ?? 0));
  const [rawSaved,   setRawSaved]   = useState(numberInput(initial?.savedAmount         ?? 0));
  const [rawMonthly, setRawMonthly] = useState(numberInput(initial?.monthlyContribution ?? 0));
  const [error,      setError]      = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spendix:nav-hide"));
    return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
  }, []);

  function set<K extends keyof GoalFormData>(key: K, value: GoalFormData[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function setNumber(key: "targetAmount" | "savedAmount" | "monthlyContribution", raw: string) {
    const value = parseFloat(raw.replace(",", ".")) || 0;
    if (key === "targetAmount")        setRawTarget(raw);
    if (key === "savedAmount")         setRawSaved(raw);
    if (key === "monthlyContribution") setRawMonthly(raw);
    set(key, value);
  }

  function setQuickDue(months: number) {
    set("dueDate", toInputDate(addMonths(new Date(), months)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || Number(form.targetAmount) <= 0) {
      setError(t("goals.form_error"));
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await Promise.resolve(onSubmit({
        ...form,
        title:               form.title.trim(),
        targetAmount:        Number(form.targetAmount),
        savedAmount:         Number(form.savedAmount),
        monthlyContribution: Number(form.monthlyContribution),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknown_error"));
    } finally {
      setSubmitting(false);
    }
  }

  const cfg          = CATEGORY_META[form.category];
  const CategoryIcon = cfg.icon;
  const progress     = form.targetAmount > 0
    ? Math.min(100, Math.round((form.savedAmount / form.targetAmount) * 100))
    : 0;
  const remaining  = Math.max(form.targetAmount - form.savedAmount, 0);
  const monthsLeft = form.monthlyContribution > 0 && remaining > 0
    ? Math.ceil(remaining / form.monthlyContribution)
    : null;
  const duePreview = useMemo(() => {
    if (!form.dueDate) return "";
    return new Date(`${form.dueDate}T00:00:00`).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
  }, [form.dueDate]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{
        backgroundColor: "rgba(11,15,20,0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={spring}
        className="flex w-full flex-col overflow-hidden rounded-t-[2rem] sm:max-w-md sm:rounded-[1.75rem]"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          maxHeight: "92dvh",
        }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="relative shrink-0 px-5 pb-4 pt-5 transition-colors duration-300"
          style={{ background: `${cfg.ring}10` }}>
          <div className="mb-2 sm:hidden">
            <SheetDragHandle onClose={onClose} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <motion.div
                key={form.category}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className={`shrink-0 rounded-2xl p-2.5 ring-1 ring-white/5 ${cfg.bg}`}
              >
                <CategoryIcon className={`h-5 w-5 ${cfg.color}`} />
              </motion.div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold t1">
                  {isEdit ? t("goals.edit_goal") : t("goals.new_goal")}
                </h2>
                <p className="truncate text-xs t3">{t(`goals.categories.${form.category}`)}</p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="rounded-xl p-2 t3 transition-all hover:bg-white/5 hover:t1"
              aria-label={t("common.close")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Form ────────────────────────────────────────── */}
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">

            {/* 1 ── Target Amount (big, centered) ──────────── */}
            <div className="text-center">
              <p className="text-[10px] font-semibold t3 uppercase tracking-[0.14em] mb-3">
                {t("goals.target_amount")}
              </p>
              <div className="relative flex items-center justify-center gap-2">
                <span className="text-xl font-bold t3 select-none">{symbol}</span>
                <input
                  type="number" min="0.01" step="0.01" inputMode="decimal"
                  value={rawTarget}
                  onChange={(e) => setNumber("targetAmount", e.target.value)}
                  placeholder="0.00"
                  className="text-5xl font-bold bg-transparent border-none outline-none tabular-nums text-center w-48 placeholder:text-[hsl(var(--text-3))] number-display"
                  style={{ color: rawTarget ? cfg.ring : undefined }}
                />
                {rawTarget && (
                  <button type="button" onClick={() => { setRawTarget(""); set("targetAmount", 0); }}
                    className="absolute -end-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[hsl(var(--bg-input))] flex items-center justify-center t3 hover:t1 transition-all">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Separator */}
            <div className="h-px bg-[hsl(var(--border-2))]" />

            {/* 2 ── Title ─────────────────────────────────── */}
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                {t("goals.title_field")}
              </label>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="field"
                placeholder={t("goals.title_placeholder")}
                autoFocus
              />
            </div>

            {/* 3 ── Category ───────────────────────────────── */}
            <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 p-4">
              <label className="mb-3 block text-[10px] font-semibold uppercase tracking-wide t3">
                {t("goals.category")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GOAL_CATEGORIES.map((category) => {
                  const meta   = CATEGORY_META[category];
                  const Icon   = meta.icon;
                  const active = form.category === category;
                  return (
                    <motion.button
                      key={category} type="button"
                      onClick={() => set("category", category)}
                      whileTap={{ scale: 0.95 }} transition={tapTransition}
                      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-3 transition-all ${
                        active ? meta.bg : "bg-[hsl(var(--bg-card))] border-[hsl(var(--border))]"
                      }`}
                      style={active ? { borderColor: `${meta.ring}60` } : {}}
                    >
                      {active && (
                        <CheckCircle2 className={`absolute end-1.5 top-1.5 h-3.5 w-3.5 ${meta.color}`} />
                      )}
                      <Icon className={`h-4 w-4 ${active ? meta.color : "t3"}`} />
                      <span className={`text-[10px] font-bold leading-tight ${active ? meta.color : "t3"}`}>
                        {t(`goals.categories.${category}`)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* 4 ── Saved + Monthly ───────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                  {t("goals.saved_amount")}
                </label>
                <input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={rawSaved}
                  onChange={(e) => setNumber("savedAmount", e.target.value)}
                  className="field" placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                  {t("goals.monthly_contribution")}
                </label>
                <input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={rawMonthly}
                  onChange={(e) => setNumber("monthlyContribution", e.target.value)}
                  className="field" placeholder="0.00"
                />
              </div>
            </div>

            {/* 4 ── Due date ──────────────────────────────── */}
            <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 p-4 space-y-3">
              <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                {t("goals.due_date")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_MONTHS.map((months) => (
                  <motion.button
                    key={months} type="button"
                    onClick={() => setQuickDue(months)}
                    whileTap={{ scale: 0.96 }} transition={tapTransition}
                    className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] py-2 text-xs font-bold t2 transition-colors hover:t1"
                  >
                    {t("goals.months_away", { count: months })}
                  </motion.button>
                ))}
              </div>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
                className="field"
              />
            </section>

            {/* 5 ── Preview ───────────────────────────────── */}
            <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold t1">
                    {form.title || t("goals.title_placeholder")}
                  </p>
                  <p className="text-[11px] t3">
                    {duePreview ? `${t("goals.target_date")}: ${duePreview}` : t("goals.target_date")}
                  </p>
                </div>
                <p className={`shrink-0 text-sm font-black number-display ${cfg.color}`}>{progress}%</p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: cfg.ring }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span className="t3">{t("goals.remaining")}</span>
                <span className="font-bold t1 number-display">{format(remaining)}</span>
              </div>
              {monthsLeft !== null && (
                <p className="mt-1 text-[11px] t3">
                  {t("goals.projected_months", { count: monthsLeft })}
                </p>
              )}
            </section>

            {/* Error */}
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

          {/* ── Footer ────────────────────────────────────── */}
          <div className="shrink-0 px-5 pt-2"
            style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))" }}>
            <motion.button
              type="submit" disabled={loading || submitting}
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${cfg.ring}, ${cfg.ring}bb)` }}
            >
              {(loading || submitting) ? <Loader2 className="h-4 w-4 animate-spin" /> : <CategoryIcon className="h-4 w-4" />}
              {(loading || submitting) ? t("common.saving") : isEdit ? t("common.save") : t("goals.create_goal")}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
