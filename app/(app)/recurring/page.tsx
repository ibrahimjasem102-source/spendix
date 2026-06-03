"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, Plus, Pencil, Trash2, Check, X,
  ArrowDownRight, ArrowUpRight, CalendarDays, Loader2, Pause, Play,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import { useCategories } from "@/lib/query/hooks";
import { fetchJson, postJson, putJson, deleteItem } from "@/lib/query/crud-factory";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { RecurringTransaction, RecurringFormData } from "@/app/api/recurring/route";

// ── Helpers ────────────────────────────────────────────────────

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
type Frequency = typeof FREQUENCIES[number];

function nextLabel(date: string, t: (k: string) => string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = new Date(date + "T00:00:00");
  const days  = Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return t("recurring.overdue");
  if (days === 0) return t("recurring.today");
  if (days === 1) return t("recurring.tomorrow");
  return t("recurring.in_days").replace("{{n}}", String(days));
}

// ── Form ───────────────────────────────────────────────────────

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

  const accent = form.type === "income" ? "#10B981" : "#F43F5E";

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
      style={{ backgroundColor: "rgba(11,15,20,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={spring}
        className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden flex flex-col"
        style={{ backgroundColor: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", maxHeight: "92dvh" }}
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3" style={{ background: `${accent}0D` }}>
          <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold t3 uppercase tracking-widest">
              {initial ? t("recurring.edit") : t("recurring.new")}
            </p>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center t3 hover:t1">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Type toggle */}
          <div className="flex gap-1 bg-black/12 rounded-2xl p-1">
            {(["expense", "income"] as const).map((item) => (
              <motion.button key={item} type="button" onClick={() => set("type", item)}
                whileTap={{ scale: 0.97 }} transition={tapTransition}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={form.type === item
                  ? { backgroundColor: `${item === "expense" ? "#F43F5E" : "#10B981"}18`, color: item === "expense" ? "#F43F5E" : "#10B981", boxShadow: `0 0 0 1.5px ${item === "expense" ? "#F43F5E" : "#10B981"}30` }
                  : { color: "hsl(var(--text-3))" }}
              >
                {item === "expense" ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                {t(`transactions.${item}`)}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Amount */}
            <div className="text-center">
              <p className="text-[10px] font-semibold t3 uppercase tracking-[0.14em] mb-3">{t("transactions.amount")}</p>
              <div className="relative flex items-center justify-center gap-2">
                <span className="text-xl font-bold t3 select-none">{symbol}</span>
                <input
                  type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={rawAmount}
                  onChange={(e) => { setRawAmount(e.target.value); set("amount", parseFloat(e.target.value) || 0); }}
                  placeholder="0.00"
                  className="text-5xl font-bold bg-transparent border-none outline-none tabular-nums text-center w-48 placeholder:text-[hsl(var(--text-3))] number-display"
                  style={{ color: rawAmount ? accent : undefined }}
                />
              </div>
            </div>

            <div className="h-px bg-[hsl(var(--border-2))]" />

            {/* Title */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wide t3">{t("transactions.title_field")}</label>
              <input required value={form.title} onChange={(e) => set("title", e.target.value)}
                className="field text-sm" placeholder={t("transactions.title_placeholder")} />
            </div>

            {/* Frequency */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wide t3">{t("recurring.frequency")}</label>
              <div className="grid grid-cols-4 gap-1.5">
                {FREQUENCIES.map((f) => (
                  <button key={f} type="button" onClick={() => set("frequency", f as Frequency)}
                    className="py-2 rounded-xl text-[11px] font-bold transition-all"
                    style={form.frequency === f
                      ? { backgroundColor: `${accent}18`, color: accent, boxShadow: `0 0 0 1.5px ${accent}40` }
                      : { backgroundColor: "hsl(var(--bg-input))", color: "hsl(var(--text-3))" }}>
                    {t(`recurring.freq_${f}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Start date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-wide t3">{t("recurring.start_date")}</label>
                <input type="date" value={form.start_date}
                  onChange={(e) => { set("start_date", e.target.value); set("next_run_date", e.target.value); }}
                  className="field text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide t3">
                  {t("recurring.end_date")} <span className="font-normal opacity-50">({t("transactions.notes_optional")})</span>
                </label>
                <input type="date" value={form.end_date ?? ""}
                  onChange={(e) => set("end_date", e.target.value || null)} className="field text-sm" />
              </div>
            </div>

            {/* Category */}
            {categories.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-wide t3">{t("transactions.category")}</label>
                <select value={form.category_id ?? ""}
                  onChange={(e) => set("category_id", e.target.value || null)}
                  className="field text-sm" style={{ backgroundColor: "hsl(var(--bg-input))" }}>
                  <option value="">{t("transactions.uncategorized")}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Auto-create toggle */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-semibold t1">{t("recurring.auto_create")}</p>
                <p className="text-xs t3 mt-0.5">{t("recurring.auto_create_hint")}</p>
              </div>
              <button type="button" onClick={() => set("auto_create", !form.auto_create)}
                className={`h-6 w-11 rounded-full p-1 transition-colors ${form.auto_create ? "bg-cyan-500" : "bg-white/10"}`}>
                <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                  form.auto_create ? "translate-x-5 rtl:translate-x-0" : "rtl:translate-x-5"
                }`} />
              </button>
            </label>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide t3">
                {t("transactions.notes")} <span className="font-normal opacity-50">({t("transactions.notes_optional")})</span>
              </label>
              <input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)}
                className="field text-sm" placeholder={t("transactions.notes_placeholder")} />
            </div>

            {error && <p className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2 rounded-xl">{error}</p>}
          </div>

          <div className="shrink-0 px-5 pt-2" style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))" }}>
            <motion.button type="submit" disabled={loading}
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
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

// ── Page ───────────────────────────────────────────────────────

export default function RecurringPage() {
  const { t }             = useTranslation();
  const { format, symbol } = useCurrency();
  const qc                = useQueryClient();
  const { data: categories = [] } = useCategories();

  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<RecurringTransaction | undefined>();
  const [deleting,  setDeleting]  = useState<string | null>(null);

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

  const active   = useMemo(() => items.filter((r) => r.active), [items]);
  const inactive = useMemo(() => items.filter((r) => !r.active), [items]);
  const totalMonthly = useMemo(() =>
    active.reduce((s, r) => {
      const m = r.frequency === "monthly" ? 1 : r.frequency === "weekly" ? 4.33 : r.frequency === "daily" ? 30 : r.frequency === "yearly" ? 1/12 : 1;
      return s + (r.type === "expense" ? 1 : -1) * Number(r.amount) * m / (r.interval_count || 1);
    }, 0),
    [active]
  );

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  async function handleCreate(data: RecurringFormData) { await createMut.mutateAsync(data); }
  async function handleEdit(data: RecurringFormData) {
    if (!editing) return;
    await updateMut.mutateAsync({ id: editing.id, data });
    setEditing(undefined);
  }
  async function handleDelete() {
    if (!deleting) return;
    const id = deleting; setDeleting(null);
    await deleteMut.mutateAsync(id);
  }
  async function handleToggle(r: RecurringTransaction) {
    await updateMut.mutateAsync({ id: r.id, data: { active: !r.active } });
  }

  function RecurringCard({ r }: { r: RecurringTransaction }) {
    const cat = r.category_id ? catMap.get(r.category_id) : null;
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = r.next_run_date < today;
    return (
      <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ ...spring, duration: 0.2 }}
        className={`card p-4 ${!r.active ? "opacity-50" : ""}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: r.type === "income" ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)" }}>
            {r.type === "income"
              ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              : <ArrowDownRight className="w-4 h-4 text-rose-400" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold t1 truncate">{r.title}</p>
              {isOverdue && r.active && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 shrink-0">
                  {t("recurring.overdue")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] t3">
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {t(`recurring.freq_${r.frequency}`)}
                {r.interval_count > 1 && ` ×${r.interval_count}`}
              </span>
              {cat && (
                <span className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${cat.color}18`, color: cat.color }}>
                  {cat.name}
                </span>
              )}
            </div>
            {r.active && (
              <div className="flex items-center gap-1 mt-1.5 text-[10px] t3">
                <CalendarDays className="w-3 h-3" />
                <span>{t("recurring.next")}: </span>
                <span className={isOverdue ? "text-amber-400 font-semibold" : ""}>{nextLabel(r.next_run_date, t)}</span>
              </div>
            )}
          </div>

          <div className="shrink-0 text-end">
            <p className={`text-base font-black number-display ${r.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
              {r.type === "income" ? "+" : "-"}{symbol}{Number(r.amount).toFixed(0)}
            </p>

            <div className="flex items-center gap-0.5 mt-1 justify-end">
              <button onClick={() => handleToggle(r)}
                className={`p-1.5 rounded-xl transition-all ${r.active ? "t3 hover:text-amber-400 hover:bg-amber-400/10" : "t3 hover:text-emerald-400 hover:bg-emerald-400/10"}`}>
                {r.active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button onClick={() => { setEditing(r); setShowForm(true); }}
                className="p-1.5 rounded-xl t3 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={() => setDeleting(r.id)}
                className="p-1.5 rounded-xl t3 hover:text-rose-400 hover:bg-rose-400/10 transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-400/10 flex items-center justify-center shrink-0">
            <RefreshCw className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold t1">{t("recurring.title")}</h1>
            <p className="text-xs t3 mt-0.5">{t("recurring.subtitle")}</p>
          </div>
        </div>
        <motion.button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          whileTap={{ scale: 0.93 }} transition={tapTransition}
          className="w-10 h-10 rounded-2xl bg-purple-400/10 flex items-center justify-center text-purple-400 hover:bg-purple-400/20 transition-all">
          <Plus className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Monthly summary */}
      {active.length > 0 && (
        <div className="card p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] t3 uppercase tracking-wide mb-1">{t("recurring.active_count")}</p>
              <p className="text-xl font-black text-purple-400">{active.length}</p>
            </div>
            <div>
              <p className="text-[10px] t3 uppercase tracking-wide mb-1">{t("recurring.monthly_impact")}</p>
              <p className={`text-xl font-black number-display ${totalMonthly >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {totalMonthly >= 0 ? "+" : ""}{format(Math.abs(totalMonthly))}
              </p>
            </div>
            <div>
              <p className="text-[10px] t3 uppercase tracking-wide mb-1">{t("recurring.next_7_days")}</p>
              <p className="text-xl font-black text-amber-400">
                {active.filter((r) => {
                  const d = new Date(r.next_run_date + "T00:00:00");
                  const t7 = new Date(); t7.setDate(t7.getDate() + 7);
                  return d <= t7;
                }).length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="py-12 flex items-center justify-center gap-2 t3">
          <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">{t("common.loading")}</span>
        </div>
      )}

      {/* Active */}
      {!isLoading && (
        <div className="space-y-2.5">
          {active.length === 0 ? (
            <div className="card py-14 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-400/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-purple-400 opacity-40" />
              </div>
              <p className="text-sm t3">{t("recurring.empty")}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {active.map((r) => <RecurringCard key={r.id} r={r} />)}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Paused */}
      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide t3 px-1">{t("recurring.paused")}</p>
          <AnimatePresence mode="popLayout">
            {inactive.map((r) => <RecurringCard key={r.id} r={r} />)}
          </AnimatePresence>
        </div>
      )}

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <RecurringForm
            key="form"
            initial={editing}
            categories={categories.filter((c) => c.type === "expense" || c.type === "income")}
            onSubmit={editing ? handleEdit : handleCreate}
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
