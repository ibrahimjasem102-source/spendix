"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowDownRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Banknote, Building2, CreditCard, Wallet, PiggyBank, Hash, Bookmark, Trash2 } from "lucide-react";
import { Account, AccountType, Category, Tag, Transaction, TransactionFormData, TransactionType } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import { useGuest } from "@/contexts/GuestContext";
import CategoryIcon from "@/components/categories/CategoryIcon";
import SheetDragHandle from "@/components/ui/SheetDragHandle";
import { safeFetch } from "@/lib/fetch-safe";
import { COLOR_PALETTE, ICON_MAP, type CategorySection } from "@/lib/categories";
import { useCategories, useCreateCategory, type CategoryFormData } from "@/lib/query/hooks";
import {
  type TransactionTemplate,
  getTemplates, saveTemplate, useTemplate as applyTemplate, deleteTemplate,
} from "@/lib/transaction-templates";
import { saveDraft, loadDraft, clearDraft } from "@/lib/form-draft";

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
const QUICK_CATEGORY_ICONS = Object.keys(ICON_MAP).slice(0, 24);

function isOtherCategory(category: Category) {
  return category.icon === "MoreHorizontal" ||
    category.id.toLowerCase().includes("other") ||
    category.name.toLowerCase().includes("other") ||
    category.name.includes("أخرى");
}

function sectionForType(type: TransactionType): CategorySection {
  return type === "income" ? "income" : "expense";
}

export default function TransactionForm({ initial, initialType, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const { isGuest, isLoading: guestLoading } = useGuest();
  const isEdit = !!initial;
  const { data: categoryData = [] } = useCategories(!guestLoading);
  const createCategory = useCreateCategory();

  const startType: TransactionType = initial?.type ?? initialType ?? "expense";
  const DRAFT_KEY = `tx_${startType}`;

  // Load draft if new transaction (not edit)
  const draft = !isEdit ? loadDraft<{ form: TransactionFormData; rawAmount: string }>(DRAFT_KEY) : null;

  const [type,       setType]       = useState<TransactionType>(startType);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState<TransactionFormData>(draft?.form ?? {
    type:             startType,
    title:            initial?.title            ?? "",
    notes:            initial?.notes            ?? "",
    amount:           initial?.amount           ?? 0,
    category_id:      initial?.category_id      ?? null,
    account_id:       initial?.account_id       ?? null,
    transaction_date: initial?.transaction_date ?? today,
    source:           initial?.source,
    related_source_id: initial?.related_source_id ?? null,
    contact_id:       initial?.contact_id ?? null,
  });
  const [rawAmount,   setRawAmount]   = useState(draft?.rawAmount ?? (initial?.amount ? fmt(Number(initial.amount)) : ""));
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [templates,   setTemplates]   = useState<TransactionTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [savedTemplate,  setSavedTemplate]  = useState(false);
  const hasSavedDraft = !!draft && !isEdit;
  const [allTags,  setAllTags]  = useState<Tag[]>([]);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<CategoryFormData>({
    name: "",
    type: startType,
    color: startType === "income" ? "#10B981" : "#F43F5E",
    icon: "MoreHorizontal",
    section: sectionForType(startType),
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    initial?.tags?.map((t) => t.id) ?? []
  );

  const amountRef  = useRef<HTMLInputElement>(null);
  const catRowRef  = useRef<HTMLDivElement>(null);
  const accRowRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEdit) setTimeout(() => amountRef.current?.focus(), 120);
  }, [isEdit]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spendix:nav-hide"));
    setTemplates(getTemplates());
    return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
  }, []);

  // Auto-save draft every 1.5s when form changes (new transactions only)
  const autoSave = useCallback(() => {
    if (!isEdit && (form.title || form.amount > 0)) {
      saveDraft(DRAFT_KEY, { form, rawAmount });
    }
  }, [form, rawAmount, isEdit, DRAFT_KEY]);

  useEffect(() => {
    if (isEdit) return;
    const timer = setTimeout(autoSave, 1500);
    return () => clearTimeout(timer);
  }, [autoSave, isEdit]);

  function handleSaveTemplate() {
    const { transaction_date: _d, ...data } = form;
    saveTemplate({ ...data, type, tag_ids: selectedTagIds });
    setTemplates(getTemplates());
    setSavedTemplate(true);
    setTimeout(() => setSavedTemplate(false), 2000);
  }

  function handleApplyTemplate(id: string) {
    const tmpl = applyTemplate(id);
    if (!tmpl) return;
    const d = tmpl.data;
    handleTypeChange((d.type ?? type) as TransactionType);
    setForm((p) => ({
      ...p,
      title:             d.title,
      notes:             d.notes ?? "",
      amount:            d.amount,
      category_id:       d.category_id ?? null,
      account_id:        d.account_id ?? null,
      source:            d.source,
      related_source_id: d.related_source_id ?? null,
      contact_id:        d.contact_id ?? null,
    }));
    setRawAmount(fmt(Number(d.amount)));
    setSelectedTagIds(d.tag_ids ?? []);
    setShowTemplates(false);
  }

  function handleDeleteTemplate(id: string) {
    deleteTemplate(id);
    setTemplates(getTemplates());
  }

  useEffect(() => {
    if (guestLoading) return;
    if (isGuest) return;
    safeFetch("/api/tags")
      .then((r) => r.json())
      .then(({ tags: t }) => setAllTags(t ?? []))
      .catch(() => setAllTags([]));
    safeFetch("/api/accounts")
      .then((r) => r.json())
      .then(({ accounts: a }) => {
        const list: Account[] = a ?? [];
        setAccounts(list);
        // Auto-select default account on new transaction only
        if (!isEdit) {
          setForm((p) => {
            if (p.account_id) return p;
            const def = list.find((acc: Account) => acc.is_default);
            return def ? { ...p, account_id: def.id } : p;
          });
        }
      })
      .catch(() => setAccounts([]));
  }, [guestLoading, isGuest, isEdit]);

  useEffect(() => {
    setCategories(categoryData);
  }, [categoryData]);

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
    setNewCategory((current) => ({
      ...current,
      type: nextType,
      color: nextType === "income" ? "#10B981" : "#F43F5E",
      section: sectionForType(nextType),
    }));
  }

  async function createInlineCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!newCategory.name.trim()) {
      setError(t("categories.name_required"));
      return;
    }

    const category = await createCategory.mutateAsync({
      ...newCategory,
      name: newCategory.name.trim(),
      type,
      section: sectionForType(type),
    });

    setCategories((current) => [...current.filter((item) => item.id !== category.id), category]);
    set("category_id", category.id);
    setNewCategory({
      name: "",
      type,
      color: type === "income" ? "#10B981" : "#F43F5E",
      icon: "MoreHorizontal",
      section: sectionForType(type),
    });
    setCategorySheetOpen(false);
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (form.amount <= 0) { setError(t("transactions.amount_positive")); return; }
    if (!form.title.trim()) { setError(t("transactions.title_required") || "Title required"); return; }
    setLoading(true); setError("");
    try {
      await onSubmit({ ...form, type, tag_ids: selectedTagIds });
      clearDraft(DRAFT_KEY);  // clear saved draft on success
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

  const filtered = categories
    .filter((c) => c.type === type)
    .sort((a, b) => {
      const aOther = /other/i.test(a.name) || a.name.includes("أخرى");
      const bOther = /other/i.test(b.name) || b.name.includes("أخرى");
      if (aOther && !bOther) return 1;
      if (!aOther && bOther) return -1;
      return 0;
    });
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

  if (typeof document === "undefined") return null;

  return createPortal(
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
        className="relative w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden flex flex-col"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          maxHeight: "92dvh",
        }}
      >
        {/* ── Header: drag handle + type toggle ────────── */}
        <div className="shrink-0 px-5 pt-4 pb-3" style={{ background: `${accent}0D` }}>
          {/* Drag handle */}
          <div className="mb-1 sm:hidden">
            <SheetDragHandle onClose={onClose} />
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold t3 uppercase tracking-widest">
                {isEdit ? t("transactions.edit") : t("transactions.new")}
              </p>
              {/* Templates button — only for new transactions */}
              {!isEdit && templates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTemplates((s) => !s)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    showTemplates ? "bg-cyan-400/20 text-cyan-400" : "t3 hover:t2 bg-[hsl(var(--bg-input))]"
                  }`}
                >
                  <Bookmark className="w-3 h-3" />
                  {t("templates.label") || "قوالب"}
                </button>
              )}
            </div>
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

          {/* ── Draft indicator ─────────────────────────── */}
          {hasSavedDraft && (
            <p className="text-[9px] text-cyan-400/70 text-center mt-1">
              {t("transactions.draft_restored") || "✓ تم استعادة المسودة المحفوظة"}
            </p>
          )}

          {/* ── Templates list ───────────────────────────── */}
          <AnimatePresence>
            {showTemplates && templates.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}
                className="overflow-hidden mt-3"
              >
                <p className="text-[9px] font-bold t3 uppercase tracking-wide mb-1.5">{t("templates.recent") || "القوالب الأخيرة"}</p>
                <div className="space-y-1 max-h-[140px] overflow-y-auto">
                  {templates.map((tmpl) => (
                    <div key={tmpl.id} className="flex items-center gap-2 group">
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(tmpl.id)}
                        className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[hsl(var(--bg-input))] hover:bg-[hsl(var(--bg-card-2))] transition-all text-start"
                      >
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          tmpl.data.type === "income" ? "bg-emerald-400/15 text-emerald-400" : "bg-rose-400/15 text-rose-400"
                        }`}>
                          {tmpl.data.type === "income" ? "+" : "-"}
                        </span>
                        <span className="text-xs font-semibold t1 truncate flex-1">{tmpl.name}</span>
                        {tmpl.data.amount > 0 && (
                          <span className="text-[10px] t3 shrink-0">{symbol}{tmpl.data.amount}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tmpl.id)}
                        className="p-1.5 rounded-xl t3 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Scrollable body ───────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

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
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          if (isOtherCategory(cat)) {
                            setCategorySheetOpen(true);
                            return;
                          }
                          set("category_id", cat.id);
                        }}
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
                onChange={(e) => set("notes", e.target.value)}
                className="field text-sm"
                placeholder={t("transactions.notes_placeholder")}
              />
            </div>

            {/* ── Tags ──────────────────────────────────── */}
            {allTags.length > 0 && (
              <div>
                <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                  {t("tags.label")}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const sel = selectedTagIds.includes(tag.id);
                    return (
                      <motion.button
                        key={tag.id} type="button"
                        whileTap={{ scale: 0.94 }} transition={tapTransition}
                        onClick={() => setSelectedTagIds((prev) =>
                          sel ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                        )}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                        style={{
                          backgroundColor: sel ? `${tag.color}25` : "hsl(var(--bg-input))",
                          color: sel ? tag.color : "hsl(var(--text-3))",
                          border: `1.5px solid ${sel ? tag.color + "60" : "hsl(var(--border))"}`,
                        }}
                      >
                        <Hash className="w-2.5 h-2.5" />
                        {tag.name}
                        {sel && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Save as template ──────────────────────── */}
            {!isEdit && form.title.trim() && form.amount > 0 && (
              <motion.button
                type="button"
                onClick={handleSaveTemplate}
                whileTap={{ scale: 0.96 }} transition={tapTransition}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  savedTemplate
                    ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                    : "bg-[hsl(var(--bg-input))] t2 border-[hsl(var(--border))] hover:t1"
                }`}
              >
                {savedTemplate ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                {savedTemplate ? (t("templates.saved") || "تم الحفظ") : (t("templates.save_as") || "حفظ كقالب")}
              </motion.button>
            )}

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
          <div className="shrink-0 px-5 pt-2"
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

        <AnimatePresence>
          {categorySheetOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-end bg-black/50 backdrop-blur-sm"
              onClick={(event) => event.target === event.currentTarget && setCategorySheetOpen(false)}
            >
              <motion.form
                onSubmit={createInlineCategory}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={spring}
                className="w-full rounded-t-3xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold t1">{t("categories.quick_add")}</h3>
                    <p className="text-xs t3">{t(`transactions.${type}`)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCategorySheetOpen(false)}
                    className="rounded-xl p-2 t3 hover:bg-white/5 hover:t1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <input
                    value={newCategory.name}
                    onChange={(event) => setNewCategory((current) => ({ ...current, name: event.target.value }))}
                    className="field"
                    placeholder={t("categories.name_placeholder")}
                    autoFocus
                  />

                  <div className="grid grid-cols-9 gap-2">
                    {COLOR_PALETTE.slice(0, 18).map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewCategory((current) => ({ ...current, color }))}
                        className="grid aspect-square place-items-center rounded-xl border"
                        style={{
                          backgroundColor: `${color}1A`,
                          borderColor: newCategory.color === color ? color : "hsl(var(--border))",
                        }}
                      >
                        {newCategory.color === color && <Check className="h-3 w-3" style={{ color }} />}
                      </button>
                    ))}
                  </div>

                  <div className="grid max-h-36 grid-cols-8 gap-2 overflow-y-auto">
                    {QUICK_CATEGORY_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setNewCategory((current) => ({ ...current, icon }))}
                        className="grid aspect-square place-items-center rounded-xl border"
                        style={{
                          backgroundColor: newCategory.icon === icon ? `${newCategory.color}14` : "hsl(var(--bg-input))",
                          borderColor: newCategory.icon === icon ? `${newCategory.color}66` : "hsl(var(--border))",
                        }}
                      >
                        <CategoryIcon icon={icon} color={newCategory.color} size="xs" />
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={createCategory.isPending}
                    className="w-full rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: newCategory.color }}
                  >
                    {t("categories.create_and_select")}
                  </button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
}
