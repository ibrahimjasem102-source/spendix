"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowDownRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Banknote, Building2, CreditCard, Wallet, PiggyBank } from "lucide-react";
import { Account, AccountType, Category, Transaction, TransactionFormData, TransactionType } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import { useGuest } from "@/contexts/GuestContext";
import { GUEST_CATEGORIES } from "@/lib/guest/categories";
import CategoryIcon from "@/components/categories/CategoryIcon";
import { safeFetch } from "@/lib/fetch-safe";

const ACCOUNT_ICONS: Record<AccountType, React.ElementType> = {
  cash: Banknote, bank: Building2, credit_card: CreditCard, wallet: Wallet, savings: PiggyBank,
};
const ACCOUNT_COLORS: Record<AccountType, string> = {
  cash: "#10B981", bank: "#3B82F6", credit_card: "#8B5CF6", wallet: "#F59E0B", savings: "#06B6D4",
};

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

const QUICK_AMOUNTS = [5, 10, 25, 50, 100, 200];

export default function TransactionForm({ initial, initialType, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const { isGuest, isLoading: guestLoading } = useGuest();
  const isEdit = !!initial;

  const startType: TransactionType = initial?.type ?? initialType ?? "expense";
  const [type,       setType]       = useState<TransactionType>(startType);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState<TransactionFormData>({
    type:             startType,
    title:            initial?.title            ?? "",
    notes:            initial?.notes            ?? "",
    amount:           initial?.amount           ?? 0,
    category_id:      initial?.category_id      ?? null,
    account_id:       initial?.account_id       ?? null,
    transaction_date: initial?.transaction_date ?? today,
  });
  const [rawAmount, setRawAmount] = useState(initial?.amount ? fmt(Number(initial.amount)) : "");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const amountRef  = useRef<HTMLInputElement>(null);
  const catRowRef  = useRef<HTMLDivElement>(null);
  const accRowRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEdit) setTimeout(() => amountRef.current?.focus(), 120);
  }, [isEdit]);

  useEffect(() => {
    if (guestLoading) return;
    if (isGuest) { setCategories(GUEST_CATEGORIES); return; }
    safeFetch("/api/categories")
      .then((r) => r.json())
      .then(({ categories: c }) => setCategories(c ?? []))
      .catch(() => setCategories([]));
    safeFetch("/api/accounts")
      .then((r) => r.json())
      .then(({ accounts: a }) => {
        const list: Account[] = a ?? [];
        setAccounts(list);
        // Auto-select default account on new transaction
        if (!isEdit && !form.account_id) {
          const def = list.find((acc: Account) => acc.is_default);
          if (def) setForm((p) => ({ ...p, account_id: def.id }));
        }
      })
      .catch(() => setAccounts([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      ...p, type: nextType,
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
      const display = msg.includes(".") && !msg.includes(" ")
        ? (t(msg) !== msg ? t(msg) : t("transactions.form_error"))
        : (msg || t("transactions.form_error"));
      setError(display);
      setLoading(false);
    }
  }

  const filtered    = categories.filter((c) => c.type === type);
  const isExpense   = type === "expense";
  const accent      = isExpense ? "#F43F5E" : "#10B981";
  const accentBg    = isExpense ? "bg-rose-400/10"    : "bg-emerald-400/10";
  const accentText  = isExpense ? "text-rose-400"     : "text-emerald-400";
  const accentBorder= isExpense ? "border-rose-400/25": "border-emerald-400/25";

  // Scroll category row
  function scrollCats(dir: "left" | "right") {
    if (!catRowRef.current) return;
    catRowRef.current.scrollBy({ left: dir === "left" ? -120 : 120, behavior: "smooth" });
  }

  // Scroll account row
  function scrollAccounts(dir: "left" | "right") {
    if (!accRowRef.current) return;
    accRowRef.current.scrollBy({ left: dir === "left" ? -120 : 120, behavior: "smooth" });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{
        backgroundColor: "rgba(11,15,20,0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ ...spring }}
        className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden flex flex-col"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          maxHeight: "92dvh",
        }}
      >
        {/* ── Header: drag handle + type toggle ────────── */}
        <div className="shrink-0 px-5 pt-4 pb-3" style={{ background: `${accent}0D` }}>
          {/* Drag handle */}
          <div className="w-10 h-1 rounded-full bg-white/12 mx-auto mb-3 sm:hidden" />

          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold t3 uppercase tracking-widest">
              {isEdit ? t("transactions.edit") : t("transactions.new")}
            </p>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center t3 hover:t1 hover:bg-white/8 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Type toggle */}
          <div className="flex gap-1 bg-black/12 rounded-2xl p-1">
            {(["expense", "income"] as const).map((item) => {
              const isActive = type === item;
              const col = item === "expense" ? "#F43F5E" : "#10B981";
              return (
                <motion.button
                  key={item} type="button"
                  onClick={() => handleTypeChange(item)}
                  whileTap={{ scale: 0.97 }} transition={tapTransition}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={isActive ? {
                    backgroundColor: `${col}18`,
                    color: col,
                    boxShadow: `0 0 0 1.5px ${col}30`,
                  } : { color: "hsl(var(--text-3))" }}
                >
                  {item === "expense"
                    ? <ArrowDownRight className="w-4 h-4" />
                    : <ArrowUpRight   className="w-4 h-4" />}
                  {t(`transactions.${item}`)}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Scrollable body ───────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
          <div className="px-5 py-5 space-y-5">

            {/* ── Amount (centered big display) ─────────── */}
            <div className="text-center">
              <p className="text-[10px] font-semibold t3 uppercase tracking-[0.14em] mb-3">
                {t("transactions.amount")}
              </p>
              <div className="relative flex items-center justify-center gap-2">
                <span className="text-xl font-bold t3 select-none">{symbol}</span>
                <input
                  ref={amountRef}
                  type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={rawAmount}
                  onChange={(e) => handleAmount(e.target.value)}
                  placeholder="0.00"
                  className="text-5xl font-bold bg-transparent border-none outline-none tabular-nums text-center w-48 placeholder:text-[hsl(var(--text-3))]"
                  style={{ color: rawAmount ? accent : undefined }}
                />
                {form.amount > 0 && (
                  <button type="button"
                    onClick={() => { setRawAmount(""); set("amount", 0); }}
                    className="absolute -end-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[hsl(var(--bg-input))] flex items-center justify-center t3 hover:t1 transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick amounts */}
              <div className="flex justify-center gap-2 mt-4 flex-wrap">
                {QUICK_AMOUNTS.map((n) => (
                  <motion.button key={n} type="button"
                    onClick={() => addQuick(n)}
                    whileTap={{ scale: 0.94 }} transition={tapTransition}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${accentBg} ${accentText} ${accentBorder}`}>
                    +{n}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Separator */}
            <div className="h-px bg-[hsl(var(--border-2))]" />

            {/* ── Title ─────────────────────────────────── */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                {t("transactions.title_field")}
              </label>
              <input
                type="text" required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="field text-sm font-medium"
                placeholder={t("transactions.title_placeholder")}
              />
            </div>

            {/* ── Category (horizontal scroll) ──────────── */}
            {filtered.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold t3 uppercase tracking-[0.12em]">
                    {t("transactions.category")}
                  </label>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => scrollCats("left")}
                      className="w-6 h-6 rounded-lg bg-[hsl(var(--bg-input))] flex items-center justify-center t3 hover:t1 transition-all">
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => scrollCats("right")}
                      className="w-6 h-6 rounded-lg bg-[hsl(var(--bg-input))] flex items-center justify-center t3 hover:t1 transition-all">
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div
                  ref={catRowRef}
                  className="flex gap-2 overflow-x-auto pb-1"
                  style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
                >
                  {/* No category */}
                  <button type="button" onClick={() => set("category_id", null)}
                    className={`flex-none flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-2xl border transition-all min-w-[64px] ${
                      !form.category_id
                        ? `${accentBg} ${accentBorder} border-[1.5px]`
                        : "bg-[hsl(var(--bg-input))] border-[hsl(var(--border))]"
                    }`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[hsl(var(--bg-card-2))]">
                      <span className="text-base t3">—</span>
                    </div>
                    <span className="text-[9px] font-semibold t3 whitespace-nowrap">{t("transactions.uncategorized")}</span>
                  </button>

                  {filtered.map((cat) => {
                    const isSelected = form.category_id === cat.id;
                    return (
                      <button key={cat.id} type="button" onClick={() => set("category_id", cat.id)}
                        className="flex-none flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-2xl border transition-all min-w-[64px] relative"
                        style={isSelected ? {
                          backgroundColor: `${cat.color}14`,
                          borderColor: `${cat.color}45`,
                          borderWidth: 1.5,
                        } : {
                          backgroundColor: "hsl(var(--bg-input))",
                          borderColor: "hsl(var(--border))",
                          borderWidth: 1,
                        }}>
                        {isSelected && (
                          <span className="absolute top-1 end-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: cat.color }}>
                            <Check className="w-2 h-2 text-white" strokeWidth={3.5} />
                          </span>
                        )}
                        <CategoryIcon icon={(cat as Category & { icon?: string }).icon} color={cat.color} size="sm" />
                        <span className="text-[9px] font-semibold whitespace-nowrap" style={{ color: isSelected ? cat.color : "hsl(var(--text-2))" }}>
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Account ───────────────────────────────── */}
            {accounts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold t3 uppercase tracking-[0.12em]">
                    {t("transactions.account")}
                  </label>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => scrollAccounts("left")}
                      className="w-6 h-6 rounded-lg bg-[hsl(var(--bg-input))] flex items-center justify-center t3 hover:t1 transition-all">
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => scrollAccounts("right")}
                      className="w-6 h-6 rounded-lg bg-[hsl(var(--bg-input))] flex items-center justify-center t3 hover:t1 transition-all">
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div
                  ref={accRowRef}
                  className="flex gap-2 overflow-x-auto pb-1"
                  style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
                >
                  {/* No account */}
                  <button type="button" onClick={() => set("account_id", null)}
                    className={`flex-none flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-2xl border transition-all min-w-[64px] ${
                      !form.account_id
                        ? `${accentBg} ${accentBorder} border-[1.5px]`
                        : "bg-[hsl(var(--bg-input))] border-[hsl(var(--border))]"
                    }`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[hsl(var(--bg-card-2))]">
                      <span className="text-base t3">—</span>
                    </div>
                    <span className="text-[9px] font-semibold t3 whitespace-nowrap">{t("transactions.no_account")}</span>
                  </button>
                  {accounts.map((acc) => {
                    const isSelected = form.account_id === acc.id;
                    const color = ACCOUNT_COLORS[acc.type] ?? "#3B82F6";
                    const Icon = ACCOUNT_ICONS[acc.type] ?? Wallet;
                    return (
                      <button key={acc.id} type="button" onClick={() => set("account_id", acc.id)}
                        className="flex-none flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-2xl border transition-all min-w-[64px] relative"
                        style={isSelected ? {
                          backgroundColor: `${color}14`,
                          borderColor: `${color}45`,
                          borderWidth: 1.5,
                        } : {
                          backgroundColor: "hsl(var(--bg-input))",
                          borderColor: "hsl(var(--border))",
                          borderWidth: 1,
                        }}>
                        {isSelected && (
                          <span className="absolute top-1 end-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: color }}>
                            <Check className="w-2 h-2 text-white" strokeWidth={3.5} />
                          </span>
                        )}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: isSelected ? `${color}20` : "hsl(var(--bg-card-2))" }}>
                          <Icon className="w-4 h-4" style={{ color: isSelected ? color : "hsl(var(--text-3))" }} />
                        </div>
                        <span className="text-[9px] font-semibold whitespace-nowrap max-w-[60px] truncate"
                          style={{ color: isSelected ? color : "hsl(var(--text-2))" }}>
                          {acc.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Date ──────────────────────────────────── */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                {t("transactions.date")}
              </label>
              <div className="flex gap-2">
                {[
                  { label: t("transactions.today"),     val: today     },
                  { label: t("transactions.yesterday"), val: yesterday },
                ].map((s) => (
                  <button key={s.val} type="button"
                    onClick={() => set("transaction_date", s.val)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
                      form.transaction_date === s.val
                        ? `${accentBg} ${accentText} ${accentBorder} border-[1.5px]`
                        : "bg-[hsl(var(--bg-input))] t3 border-[hsl(var(--border))] hover:t2"
                    }`}>
                    {s.label}
                  </button>
                ))}
                <input
                  type="date"
                  value={form.transaction_date}
                  onChange={(e) => set("transaction_date", e.target.value)}
                  className="field flex-1 text-sm py-2 min-w-0"
                />
              </div>
            </div>

            {/* ── Notes ─────────────────────────────────── */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                {t("transactions.notes")}{" "}
                <span className="normal-case font-normal opacity-40">({t("transactions.notes_optional")})</span>
              </label>
              <input
                type="text"
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value || undefined)}
                className="field text-sm"
                placeholder={t("transactions.notes_placeholder")}
              />
            </div>

            {/* ── Error ─────────────────────────────────── */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2.5 rounded-xl"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

          </div>

          {/* ── Submit ────────────────────────────────────── */}
          <div className="px-5 pb-safe-or-5 pt-2 shrink-0"
            style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))" }}>
            <motion.button
              type="submit"
              disabled={loading || form.amount <= 0}
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              className="w-full py-4 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${accent} 0%, ${isExpense ? "#BE123C" : "#047857"} 100%)`,
                boxShadow: `0 4px 20px ${accent}35`,
              }}
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("common.saving")}
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
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
