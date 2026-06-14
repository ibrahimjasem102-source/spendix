"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, Plus, Pencil, Trash2, Check, X,
  ArrowDownRight, ArrowUpRight, CalendarDays, Loader2,
  Pause, Play, TrendingDown, TrendingUp, Clock,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import { useCategories } from "@/lib/query/hooks";
import { fetchJson, postJson, putJson, deleteItem } from "@/lib/query/crud-factory";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SheetDragHandle from "@/components/ui/SheetDragHandle";
import type { RecurringTransaction, RecurringFormData } from "@/app/api/recurring/route";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
type Frequency = typeof FREQUENCIES[number];

function nextLabel(date: string, t: (k: string) => string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = new Date(date + "T00:00:00");
  const days  = Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
  if (days < 0)  return t("recurring.overdue");
  if (days === 0) return t("recurring.today");
  if (days === 1) return t("recurring.tomorrow");
  return t("recurring.in_days").replace("{{n}}", String(days));
}

function toMonthly(amount: number, frequency: Frequency, interval: number): number {
  const base = interval || 1;
  if (frequency === "daily")   return (amount / base) * 30;
  if (frequency === "weekly")  return (amount / base) * 4.33;
  if (frequency === "monthly") return amount / base;
  if (frequency === "yearly")  return amount / base / 12;
  return amount;
}

// â”€â”€ Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface FormProps {
  initial?: RecurringTransaction;
  onSubmit: (data: RecurringFormData) => Promise<void>;
  onClose: () => void;
  categories: { id: string; name: string; color: string }[];
}

function RecurringForm({ initial, onSubmit, onClose, categories }: FormProps) {
  const { t }      = useTranslation();
  const { symbol } = useCurrency();
  const today      = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<RecurringFormData>({
    title:          initial?.title          ?? "",
    amount:         initial?.amount         ?? 0,
    type:           initial?.type           ?? "expense",
    category_id:    initial?.category_id    ?? null,
    account_id:     initial?.account_id     ?? null,
    notes:          initial?.notes          ?? null,
    frequency:      initial?.frequency      ?? "monthly",
    interval_count: initial?.interval_count ?? 1,
    start_date:     initial?.start_date     ?? today,
    end_date:       initial?.end_date       ?? null,
    next_run_date:  initial?.next_run_date  ?? today,
    active:         initial?.active         ?? true,
    auto_create:    initial?.auto_create    ?? true,
  });
  const [rawAmount, setRawAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  function set<K extends keyof RecurringFormData>(k: K, v: RecurringFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const isIncome = form.type === "income";
  const accent   = isIncome ? "#10B981" : "#F43F5E";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError(t("transactions.title_required")); return; }
    if (form.amount <= 0)   { setError(t("transactions.amount_positive")); return; }
    setLoading(true); setError("");
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknown_error"));
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(11,15,20,0.8)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={spring}
        className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden flex flex-col"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          maxHeight: "92dvh",
        }}
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-3 pb-4 border-b border-[hsl(var(--border-2))]">
          {/* Drag handle */}
          <div className="mb-3 sm:hidden">
            <SheetDragHandle onClose={onClose} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accent}18` }}>
                <RefreshCw className="h-4 w-4" style={{ color: accent }} />
              </div>
              <p className="text-base font-black t1">
                {initial ? t("recurring.edit") : t("recurring.new")}
              </p>
            </div>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl t3 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Type toggle */}
          <div className="flex gap-1.5 rounded-xl bg-[hsl(var(--bg-input))] p-1">
            {(["expense", "income"] as const).map((item) => {
              const itemColor = item === "income" ? "#10B981" : "#F43F5E";
              const isActive  = form.type === item;
              return (
                <motion.button key={item} type="button" onClick={() => set("type", item)}
                  whileTap={{ scale: 0.97 }} transition={tapTransition}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all"
                  style={isActive
                    ? { backgroundColor: `${itemColor}18`, color: itemColor, boxShadow: `0 0 0 1.5px ${itemColor}30` }
                    : { color: "hsl(var(--text-3))" }}
                >
                  {item === "expense"
                    ? <ArrowDownRight className="h-4 w-4" />
                    : <ArrowUpRight   className="h-4 w-4" />}
                  {t(`transactions.${item}`)}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 overscroll-contain">

            {/* Amount */}
            <div className="card p-4 text-center">
              <p className="text-[10px] font-semibold t3 uppercase tracking-[0.14em] mb-3">
                {t("transactions.amount")}
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl font-bold t3 select-none">{symbol}</span>
                <input
                  type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={rawAmount}
                  onChange={(e) => { setRawAmount(e.target.value); set("amount", parseFloat(e.target.value) || 0); }}
                  placeholder="0.00"
                  className="w-44 border-none bg-transparent text-center text-5xl font-bold outline-none tabular-nums placeholder:text-[hsl(var(--text-3))] number-display"
                  style={{ color: rawAmount ? accent : undefined }}
                />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                {t("transactions.title_field")}
              </label>
              <input required value={form.title} onChange={(e) => set("title", e.target.value)}
                className="field text-sm" placeholder={t("transactions.title_placeholder")} />
            </div>

            {/* Frequency */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                {t("recurring.frequency")}
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {FREQUENCIES.map((f) => (
                  <button key={f} type="button" onClick={() => set("frequency", f as Frequency)}
                    className="rounded-xl py-2.5 text-[11px] font-bold transition-all"
                    style={form.frequency === f
                      ? { backgroundColor: `${accent}18`, color: accent, boxShadow: `0 0 0 1.5px ${accent}30` }
                      : { backgroundColor: "hsl(var(--bg-input))", color: "hsl(var(--text-3))" }}>
                    {t(`recurring.freq_${f}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                  {t("recurring.start_date")}
                </label>
                <input type="date" value={form.start_date}
                  onChange={(e) => { set("start_date", e.target.value); set("next_run_date", e.target.value); }}
                  className="field text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                  {t("recurring.end_date")}
                  <span className="ms-1 font-normal opacity-50 normal-case">{t("transactions.notes_optional")}</span>
                </label>
                <input type="date" value={form.end_date ?? ""}
                  onChange={(e) => set("end_date", e.target.value || null)}
                  className="field text-sm" />
              </div>
            </div>

            {/* Category */}
            {categories.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                  {t("transactions.category")}
                </label>
                <select value={form.category_id ?? ""}
                  onChange={(e) => set("category_id", e.target.value || null)}
                  className="field text-sm">
                  <option value="">{t("transactions.uncategorized")}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Auto-create */}
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold t1">{t("recurring.auto_create")}</p>
                <p className="mt-0.5 text-xs t3">{t("recurring.auto_create_hint")}</p>
              </div>
              <button type="button" onClick={() => set("auto_create", !form.auto_create)}
                className={`h-6 w-11 shrink-0 rounded-full p-1 transition-colors ${form.auto_create ? "bg-cyan-500" : "bg-white/10"}`}>
                <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                  form.auto_create ? "translate-x-5 rtl:translate-x-0" : "rtl:translate-x-5"
                }`} />
              </button>
            </label>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                {t("transactions.notes")}
                <span className="ms-1 font-normal opacity-50 normal-case">{t("transactions.notes_optional")}</span>
              </label>
              <input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)}
                className="field text-sm" placeholder={t("transactions.notes_placeholder")} />
            </div>

            {error && (
              <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2.5 text-xs text-rose-400">
                {error}
              </p>
            )}
          </div>

          <div className="shrink-0 px-5 pt-2" style={{ paddingBottom: "max(80px, calc(env(safe-area-inset-bottom,0px) + 72px))" }}>
            <motion.button type="submit" disabled={loading}
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {loading ? t("common.saving") : initial ? t("common.save") : t("recurring.create")}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// â”€â”€ Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RecurringCard({
  r, catMap, onEdit, onDelete, onToggle,
}: {
  r: RecurringTransaction;
  catMap: Map<string, { id: string; name: string; color: string }>;
  onEdit: (r: RecurringTransaction) => void;
  onDelete: (id: string) => void;
  onToggle: (r: RecurringTransaction) => void;
}) {
  const { t }      = useTranslation();
  const { symbol } = useCurrency();
  const cat        = r.category_id ? catMap.get(r.category_id) : null;
  const today      = new Date().toISOString().slice(0, 10);
  const isOverdue  = r.next_run_date < today;
  const isIncome   = r.type === "income";
  const color      = isIncome ? "#10B981" : "#F43F5E";

  return (
    <motion.div layout
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      transition={{ ...spring, duration: 0.2 }}
      className={`card p-4 transition-opacity ${!r.active ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}15` }}>
          {isIncome
            ? <ArrowUpRight   className="h-4 w-4" style={{ color }} />
            : <ArrowDownRight className="h-4 w-4" style={{ color }} />}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold t1">{r.title}</p>
            {isOverdue && r.active && (
              <span className="shrink-0 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                {t("recurring.overdue")}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] t3">
              <RefreshCw className="h-3 w-3" />
              {t(`recurring.freq_${r.frequency}`)}
              {r.interval_count > 1 && ` Ã—${r.interval_count}`}
            </span>
            {cat && (
              <span className="rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: `${cat.color}18`, color: cat.color }}>
                {cat.name}
              </span>
            )}
            {r.active && (
              <span className="flex items-center gap-1 text-[11px] t3">
                <Clock className="h-3 w-3" />
                <span className={isOverdue ? "font-semibold text-amber-400" : ""}>
                  {nextLabel(r.next_run_date, t)}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="shrink-0 text-end">
          <p className="text-base font-black number-display" style={{ color }}>
            {isIncome ? "+" : "âˆ’"}{symbol}{Number(r.amount).toFixed(0)}
          </p>
          <div className="mt-1.5 flex items-center justify-end gap-0.5">
            <button onClick={() => onToggle(r)}
              className={`rounded-xl p-1.5 transition-all ${
                r.active
                  ? "t3 hover:bg-amber-400/10 hover:text-amber-400"
                  : "t3 hover:bg-emerald-400/10 hover:text-emerald-400"
              }`}>
              {r.active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
            <button onClick={() => onEdit(r)}
              className="rounded-xl p-1.5 t3 hover:bg-cyan-400/10 hover:text-cyan-400 transition-all">
              <Pencil className="h-3 w-3" />
            </button>
            <button onClick={() => onDelete(r.id)}
              className="rounded-xl p-1.5 t3 hover:bg-rose-400/10 hover:text-rose-400 transition-all">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function RecurringPage() {
  const { t }              = useTranslation();
  const { format, symbol } = useCurrency();
  const qc                 = useQueryClient();
  const { data: categories = [] } = useCategories();

  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<RecurringTransaction | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["recurring"],
    queryFn:  () => fetchJson<{ recurring: RecurringTransaction[] }>("/api/recurring").then((r) => r.recurring ?? []),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (d: RecurringFormData) => postJson<{ recurring: RecurringTransaction }>("/api/recurring", d),
    onSettled: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RecurringFormData> }) =>
      putJson<{ recurring: RecurringTransaction }>(`/api/recurring/${id}`, data),
    onSettled: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteItem(`/api/recurring/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });

  const active   = useMemo(() => items.filter((r) => r.active),  [items]);
  const inactive = useMemo(() => items.filter((r) => !r.active), [items]);

  const { monthlyIncome, monthlyExpense } = useMemo(() => {
    let inc = 0, exp = 0;
    for (const r of active) {
      const m = toMonthly(Number(r.amount), r.frequency as Frequency, r.interval_count);
      if (r.type === "income") inc += m; else exp += m;
    }
    return { monthlyIncome: inc, monthlyExpense: exp };
  }, [active]);

  const upcoming7 = useMemo(() => {
    const t7 = new Date(); t7.setDate(t7.getDate() + 7);
    return active.filter((r) => new Date(r.next_run_date + "T00:00:00") <= t7).length;
  }, [active]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  function openEdit(r: RecurringTransaction) { setEditing(r); setShowForm(true); }
  function openCreate() { setEditing(undefined); setShowForm(true); }

  async function handleSubmit(data: RecurringFormData) {
    if (editing) await updateMut.mutateAsync({ id: editing.id, data });
    else         await createMut.mutateAsync(data);
  }
  async function handleDelete() {
    if (!deleting) return;
    const id = deleting; setDeleting(null);
    await deleteMut.mutateAsync(id);
  }
  async function handleToggle(r: RecurringTransaction) {
    await updateMut.mutateAsync({ id: r.id, data: { active: !r.active } });
  }

  return (
    <div className="space-y-5 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-400/10">
            <RefreshCw className="h-4 w-4 text-teal-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black t1">{t("recurring.title")}</h1>
            <p className="mt-0.5 text-xs font-medium t3">{t("recurring.subtitle")}</p>
          </div>
        </div>
        <motion.button
          onClick={openCreate}
          whileTap={{ scale: 0.93 }} transition={tapTransition}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-400/10 text-teal-400 hover:bg-teal-400/20 transition-all">
          <Plus className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Summary banner */}
      {active.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}
          className="rounded-[1.75rem] p-5 grid grid-cols-3 gap-4"
          style={{
            background: "linear-gradient(135deg, #0d1f1a 0%, #0a0f14 100%)",
            border: "1px solid rgba(20,184,166,0.2)",
          }}
        >
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-teal-300/70 mb-1">
              {t("recurring.active_count")}
            </p>
            <p className="text-xl font-bold text-white">{active.length}</p>
          </div>
          <div className="text-center border-x border-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-teal-300/70 mb-1">
              {t("recurring.monthly_impact")}
            </p>
            <p className={`text-xl font-bold ${monthlyIncome >= monthlyExpense ? "text-emerald-400" : "text-rose-400"}`}>
              {monthlyIncome >= monthlyExpense ? "+" : "âˆ’"}{symbol}{Math.abs(monthlyIncome - monthlyExpense).toFixed(0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-teal-300/70 mb-1">
              {t("recurring.next_7_days")}
            </p>
            <p className="text-xl font-bold text-amber-400">{upcoming7}</p>
          </div>
        </motion.div>
      )}

      {/* Income vs Expense breakdown */}
      {active.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs t3 uppercase tracking-wide">{t("transactions.income")}</p>
              <div className="rounded-lg bg-emerald-400/10 p-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              </div>
            </div>
            <p className="text-lg font-black text-emerald-400 number-display">
              +{format(monthlyIncome)}
            </p>
            <p className="mt-0.5 text-[10px] t3">{t("subscriptions.monthly_total")}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs t3 uppercase tracking-wide">{t("transactions.expense")}</p>
              <div className="rounded-lg bg-rose-400/10 p-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
              </div>
            </div>
            <p className="text-lg font-black text-rose-400 number-display">
              -{format(monthlyExpense)}
            </p>
            <p className="mt-0.5 text-[10px] t3">{t("subscriptions.monthly_total")}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 t3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      )}

      {/* Active list */}
      {!isLoading && (
        <div className="space-y-2.5">
          {active.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-14">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-teal-400/10">
                <RefreshCw className="h-6 w-6 text-teal-400 opacity-40" />
              </div>
              <p className="text-sm t3">{t("recurring.empty")}</p>
              <motion.button onClick={openCreate}
                whileTap={{ scale: 0.97 }} transition={tapTransition}
                className="rounded-xl bg-teal-400/10 px-4 py-2 text-sm font-semibold text-teal-400 hover:bg-teal-400/20 transition-all">
                {t("recurring.create")}
              </motion.button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {active.map((r) => (
                <RecurringCard key={r.id} r={r} catMap={catMap}
                  onEdit={openEdit} onDelete={setDeleting} onToggle={handleToggle} />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Paused list */}
      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wide t3">
            {t("recurring.paused")} Â· {inactive.length}
          </p>
          <AnimatePresence mode="popLayout">
            {inactive.map((r) => (
              <RecurringCard key={r.id} r={r} catMap={catMap}
                onEdit={openEdit} onDelete={setDeleting} onToggle={handleToggle} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <RecurringForm
            key="form"
            initial={editing}
            categories={categories.filter((c) => c.type === "expense" || c.type === "income")}
            onSubmit={handleSubmit}
            onClose={() => { setShowForm(false); setEditing(undefined); }}
          />
        )}
      </AnimatePresence>

      {deleting && (
        <ConfirmModal
          message={t("recurring.confirm_delete")}
          loading={deleteMut.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

