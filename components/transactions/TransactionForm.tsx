"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowDownRight, ArrowUpRight, Check } from "lucide-react";
import { Category, Transaction, TransactionFormData, TransactionType } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import { useGuest } from "@/contexts/GuestContext";
import { GUEST_CATEGORIES } from "@/lib/guest/categories";
import CategoryIcon from "@/components/categories/CategoryIcon";
import { safeFetch } from "@/lib/fetch-safe";

interface Props {
  initial?: Transaction;
  initialType?: TransactionType;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onClose: () => void;
}

const today     = new Date().toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

function fmt(v: number) {
  if (v === 0) return "";
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}

// Quick amount presets
const QUICK_AMOUNTS = [10, 25, 50, 100, 200, 500];

export default function TransactionForm({ initial, initialType, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const { isGuest, isLoading: guestLoading } = useGuest();
  const isEdit = !!initial;

  const startType: TransactionType = initial?.type ?? initialType ?? "expense";
  const [type,       setType]       = useState<TransactionType>(startType);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<TransactionFormData>({
    type:             startType,
    title:            initial?.title            ?? "",
    notes:            initial?.notes            ?? "",
    amount:           initial?.amount           ?? 0,
    category_id:      initial?.category_id      ?? null,
    transaction_date: initial?.transaction_date ?? today,
  });
  const [rawAmount, setRawAmount] = useState(initial?.amount ? fmt(Number(initial.amount)) : "");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEdit) setTimeout(() => amountRef.current?.focus(), 120);
  }, [isEdit]);

  useEffect(() => {
    if (guestLoading) return;
    if (isGuest) {
      setCategories(GUEST_CATEGORIES);
      return;
    }
    safeFetch("/api/categories")
      .then((r) => r.json())
      .then(({ categories: c }) => setCategories(c ?? []))
      .catch(() => setCategories([]));
  }, [guestLoading, isGuest]);

  useEffect(() => {
    if (isEdit) return;
    const match = categories.find((c) => c.type === type);
    setForm((p) => ({ ...p, type, category_id: match?.id ?? null }));
  }, [type, categories, isEdit]);

  function set<K extends keyof TransactionFormData>(k: K, v: TransactionFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function handleAmount(raw: string) {
    setRawAmount(raw);
    const parsed = parseFloat(raw.replace(",", ".")) || 0;
    set("amount", parsed);
  }

  function addQuick(n: number) {
    const next = (form.amount || 0) + n;
    setRawAmount(fmt(next));
    set("amount", next);
  }

  function handleTypeChange(nextType: TransactionType) {
    setType(nextType);
    setForm((p) => ({
      ...p,
      type: nextType,
      category_id: p.type === nextType ? p.category_id : null,
    }));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (form.amount <= 0) { setError(t("transactions.amount_positive")); return; }
    if (!form.title.trim()) { setError(t("transactions.title_required") || "Title required"); return; }
    setLoading(true); setError("");
    try {
      await onSubmit({ ...form, type });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // translate i18n error keys returned from the API
      const display = msg.includes(".") && !msg.includes(" ") ? (t(msg) !== msg ? t(msg) : t("transactions.form_error")) : (msg || t("transactions.form_error"));
      setError(display);
      setLoading(false);
    }
  }

  const filtered = categories.filter((c) => c.type === type);
  const isExpense = type === "expense";
  const accent    = isExpense ? "#F43F5E" : "#10B981";
  const accentBg  = isExpense ? "bg-rose-400/10"    : "bg-emerald-400/10";
  const accentText= isExpense ? "text-rose-400"     : "text-emerald-400";
  const accentBorder = isExpense ? "border-rose-400/30" : "border-emerald-400/30";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{
        backgroundColor: "rgba(19,26,34,0.68)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        transform: "translate3d(0,0,0)",
        backfaceVisibility: "hidden",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>

      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ ...spring }}
        className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          transform: "translate3d(0,0,0)",
          backfaceVisibility: "hidden",
        }}
      >
        {/* ── Type toggle header ─────────────────────────────── */}
        <div className="relative px-5 pt-5 pb-4" style={{ background: `${accent}10` }}>
          {/* Drag handle (mobile) */}
          <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-4 sm:hidden" />

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold t1">
              {isEdit ? t("transactions.edit") : (isExpense ? t("transactions.add_expense") : t("transactions.add_income"))}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-xl t3 hover:t1 hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Type switcher */}
          <div className="flex gap-1.5 bg-[hsl(var(--bg-input))] p-1 rounded-2xl">
            {(["expense", "income"] as const).map((item) => (
              <motion.button
                key={item}
                type="button"
                onClick={() => handleTypeChange(item)}
                layout
                whileTap={{ scale: 0.98 }}
                transition={tapTransition}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors relative z-10 ${
                  type === item ? (item === "expense" ? "text-rose-400" : "text-emerald-400") : "t3"
                }`}
                style={type === item ? {
                  backgroundColor: item === "expense" ? "rgba(244,63,94,0.12)" : "rgba(16,185,129,0.12)",
                  boxShadow: `0 0 0 1px ${item === "expense" ? "rgba(244,63,94,0.25)" : "rgba(16,185,129,0.25)"}`,
                } : {}}>
                {item === "expense"
                  ? <ArrowDownRight className="w-3.5 h-3.5" />
                  : <ArrowUpRight   className="w-3.5 h-3.5" />}
                {t(`transactions.${item}`)}
              </motion.button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4 max-h-[85vh] overflow-y-auto">

            {/* ── Amount ─────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("transactions.amount")}
              </label>
              <div className="relative">
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm font-bold t3 select-none whitespace-nowrap">
                  {symbol}
                </span>
                <input
                  ref={amountRef}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={rawAmount}
                  onChange={(e) => handleAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full ps-14 pe-4 py-4 text-3xl font-bold number-display rounded-2xl bg-[hsl(var(--bg-input))] border focus:outline-none transition-all"
                  style={{
                    color: rawAmount ? accent : undefined,
                    borderColor: rawAmount ? `${accent}40` : "hsl(var(--border))",
                  }}
                />
              </div>

              {/* Quick amounts */}
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                {QUICK_AMOUNTS.map((n) => (
                  <button key={n} type="button" onClick={() => addQuick(n)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all hover:scale-105 ${accentBg} ${accentText} ${accentBorder}`}>
                    +{n}
                  </button>
                ))}
                {form.amount > 0 && (
                  <button type="button" onClick={() => { setRawAmount(""); set("amount", 0); }}
                    className="px-3 py-1 rounded-xl text-xs font-medium t3 hover:t1 border border-[hsl(var(--border))] transition-all">
                    x
                  </button>
                )}
              </div>
            </div>

            {/* ── Title ──────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("transactions.title_field")}
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="field text-sm"
                placeholder={t("transactions.title_placeholder")}
              />
            </div>

            {/* ── Category ───────────────────────────────────── */}
            {(filtered.length > 0 || categories.length > 0) && (
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("transactions.category")}
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {/* No category */}
                  <button type="button" onClick={() => set("category_id", null)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                      !form.category_id
                        ? `${accentBg} ${accentBorder} border-2`
                        : "bg-[hsl(var(--bg-input))] border-[hsl(var(--border))]"
                    }`}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[hsl(var(--bg-card-2))]">
                      <span className="text-sm t3">-</span>
                    </div>
                    <span className="text-[9px] font-medium t3 truncate w-full text-center leading-tight">
                      {t("transactions.uncategorized")}
                    </span>
                  </button>

                  {filtered.map((cat) => {
                    const isSelected = form.category_id === cat.id;
                    return (
                      <button key={cat.id} type="button" onClick={() => set("category_id", cat.id)}
                        className="relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all"
                        style={isSelected ? {
                          backgroundColor: `${cat.color}12`,
                          borderColor: `${cat.color}50`,
                          borderWidth: 2,
                        } : {
                          backgroundColor: "hsl(var(--bg-input))",
                          borderColor: "hsl(var(--border))",
                          borderWidth: 1,
                        }}>
                        {isSelected && (
                          <span className="absolute top-0.5 end-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center z-10"
                            style={{ backgroundColor: cat.color }}>
                            <Check className="w-2 h-2 text-white" strokeWidth={3.5} />
                          </span>
                        )}
                        <CategoryIcon icon={(cat as Category & { icon?: string }).icon} color={cat.color} size="sm" />
                        <span className={`text-[9px] font-medium truncate w-full text-center leading-tight ${isSelected ? "" : "t2"}`}
                          style={isSelected ? { color: cat.color } : {}}>
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Date ───────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("transactions.date")}
              </label>
              <div className="flex gap-1.5">
                {/* Shortcuts */}
                {[
                  { label: t("transactions.today"),     val: today     },
                  { label: t("transactions.yesterday"), val: yesterday },
                ].map((s) => (
                  <button key={s.val} type="button"
                    onClick={() => set("transaction_date", s.val)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      form.transaction_date === s.val
                        ? `${accentBg} ${accentText} ${accentBorder}`
                        : "bg-[hsl(var(--bg-input))] t3 border-[hsl(var(--border))] hover:t1"
                    }`}>
                    {s.label}
                  </button>
                ))}
                <input
                  type="date"
                  value={form.transaction_date}
                  onChange={(e) => set("transaction_date", e.target.value)}
                  className="field flex-1 text-sm py-1.5"
                />
              </div>
            </div>

            {/* ── Notes ──────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("transactions.notes")}{" "}
                <span className="normal-case font-normal opacity-50">({t("transactions.notes_optional")})</span>
              </label>
              <input
                type="text"
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value || undefined)}
                className="field text-sm"
                placeholder={t("transactions.notes_placeholder")}
              />
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2 rounded-xl">
                {error}
              </motion.p>
            )}
          </div>

          {/* ── Submit ─────────────────────────────────────────── */}
          <div className="px-5 pt-2" style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 8px))" }}>
            <motion.button
              type="submit"
              disabled={loading || form.amount <= 0}
              whileTap={{ scale: 0.97 }}
              transition={tapTransition}
              className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${accent}, ${isExpense ? "#E11D48" : "#059669"})` }}>
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2 text-white">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("common.saving")}
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2 text-white">
                    {isEdit
                      ? <><Check className="w-4 h-4" />{t("transactions.save_edit")}</>
                      : isExpense
                        ? <><ArrowDownRight className="w-4 h-4" />{t("transactions.add_expense")}</>
                        : <><ArrowUpRight   className="w-4 h-4" />{t("transactions.add_income")}</>}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
