"use client";

import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import {
  Plus, Trash2, Pencil, ArrowUpRight, ArrowDownRight,
  Search, Loader2, TrendingUp, Landmark, DollarSign,
  Briefcase, X, Wallet, Filter, MoreVertical, Copy,
} from "lucide-react";
import type { Transaction, TransactionFormData, TransactionSource } from "@/types";
import CategoryIcon from "@/components/categories/CategoryIcon";
import TransactionForm from "@/components/transactions/TransactionForm";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ToastList from "@/components/ui/Toast";
import { useGuest } from "@/contexts/GuestContext";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import {
  useCreateTransaction, useDeleteTransaction,
  useTransactions, useUpdateTransaction,
} from "@/lib/query/hooks";
import { useToast } from "@/hooks/useToast";
import { spring, staggerContainer, staggerItem, tapTransition } from "@/lib/motion";

// ── Source config ─────────────────────────────────────────────
const SOURCE_CONFIG: Record<string, {
  icon: React.ElementType; color: string; bg: string; labelKey: string;
}> = {
  manual:       { icon: Wallet,      color: "text-gray-400",    bg: "bg-gray-400/10",    labelKey: "transactions.source_manual"       },
  investment:   { icon: TrendingUp,  color: "text-purple-400",  bg: "bg-purple-400/10",  labelKey: "transactions.source_investment"    },
  debt:         { icon: Landmark,    color: "text-orange-400",  bg: "bg-orange-400/10",  labelKey: "transactions.source_debt"         },
  debt_payment: { icon: DollarSign,  color: "text-amber-400",   bg: "bg-amber-400/10",   labelKey: "transactions.source_debt_payment" },
  work:         { icon: Briefcase,   color: "text-cyan-400",    bg: "bg-cyan-400/10",    labelKey: "transactions.source_work"         },
  work_payment: { icon: Briefcase,   color: "text-emerald-400", bg: "bg-emerald-400/10", labelKey: "transactions.source_work_payment" },
};

// ── Virtual item types ────────────────────────────────────────
type VirtualItem =
  | { kind: "date";        id: string; date: string; income: number; expense: number }
  | { kind: "transaction"; id: string; transaction: Transaction; date: string };

// ── Pre-filter by URL param ───────────────────────────────────
function applyPreFilter(txs: Transaction[], filter: string | null): Transaction[] {
  if (!filter) return txs;
  const prefix = new Date().toISOString().slice(0, 7);
  if (filter === "monthly_income")   return txs.filter((t) => t.type === "income"  && t.transaction_date.startsWith(prefix));
  if (filter === "monthly_expenses") return txs.filter((t) => t.type === "expense" && t.transaction_date.startsWith(prefix));
  return txs;
}

function buildVirtualItems(transactions: Transaction[]): VirtualItem[] {
  const items: VirtualItem[] = [];
  // Pre-compute daily totals
  const dailyTotals: Record<string, { income: number; expense: number }> = {};
  for (const tx of transactions) {
    const d = tx.transaction_date;
    if (!dailyTotals[d]) dailyTotals[d] = { income: 0, expense: 0 };
    if (tx.type === "income")  dailyTotals[d].income  += Number(tx.amount);
    else                       dailyTotals[d].expense += Number(tx.amount);
  }

  let lastDate = "";
  for (const tx of transactions) {
    if (tx.transaction_date !== lastDate) {
      lastDate = tx.transaction_date;
      const totals = dailyTotals[lastDate] ?? { income: 0, expense: 0 };
      items.push({ kind: "date", id: `date-${lastDate}`, date: lastDate, ...totals });
    }
    items.push({ kind: "transaction", id: tx.id, transaction: tx, date: tx.transaction_date });
  }
  return items;
}

function findActiveDate(items: VirtualItem[], index: number) {
  for (let i = index; i >= 0; i--) {
    if (items[i]?.kind === "date") return items[i].date;
  }
  return items.find((i) => i.kind === "date")?.date ?? "";
}

// ── Date header with daily totals ────────────────────────────
const DateHeader = memo(function DateHeader({
  date, income, expense, formatDate, format,
}: {
  date: string; income: number; expense: number;
  formatDate: (d: string, o?: Intl.DateTimeFormatOptions) => string;
  format: (n: number) => string;
}) {
  const net = income - expense;
  return (
    <div className="px-4 py-2 flex items-center justify-between sticky top-0 z-10"
      style={{ backgroundColor: "hsl(var(--bg-input))", borderBottom: "1px solid hsl(var(--border-2))" }}>
      <p className="text-xs font-bold t3 uppercase tracking-wide">
        {formatDate(date, { weekday: "short", month: "short", day: "numeric" })}
      </p>
      <div className="flex items-center gap-2">
        {income > 0  && <span className="text-[10px] font-semibold text-emerald-400">+{format(income)}</span>}
        {expense > 0 && <span className="text-[10px] font-semibold text-rose-400">-{format(expense)}</span>}
        <span className={`text-[10px] font-bold ${net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {net >= 0 ? "+" : "-"}{format(Math.abs(net))}
        </span>
      </div>
    </div>
  );
});

// ── Transaction row with ⋮ menu ───────────────────────────────
const TransactionRow = memo(function TransactionRow({
  tx, locale, formatAmount, formatDate, onEdit, onDelete, onDuplicate,
}: {
  tx: Transaction;
  locale: string;
  formatAmount: (n: number) => string;
  formatDate: (d: string, o?: Intl.DateTimeFormatOptions) => string;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onDuplicate: (tx: Transaction) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const { t } = useTranslation();
  const isRtl = locale === "ar";
  const src    = (tx.source ?? "manual") as string;
  const srcCfg = SOURCE_CONFIG[src] ?? SOURCE_CONFIG.manual;

  // Category icon takes priority over source icon
  const showCatIcon = !!tx.category;

  const updateMenuPosition = useCallback(() => {
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 168;
    const padding = 12;
    const top = Math.min(rect.bottom + 6, window.innerHeight - 156);
    if (isRtl) {
      setMenuPosition({ top, left: Math.max(padding, Math.min(rect.left, window.innerWidth - width - padding)) });
      return;
    }
    setMenuPosition({ top, right: Math.max(padding, window.innerWidth - rect.right) });
  }, [isRtl]);

  const toggleMenu = useCallback(() => {
    if (!menuOpen) updateMenuPosition();
    setMenuOpen((previous) => !previous);
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;
    updateMenuPosition();
    const close = () => setMenuOpen(false);
    const reposition = () => updateMenuPosition();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", reposition);
    };
  }, [menuOpen, updateMenuPosition]);

  const menuOverlay = typeof document !== "undefined" ? createPortal(
    <AnimatePresence>
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-[2147483646]"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[2147483647] rounded-xl shadow-2xl overflow-hidden"
            style={{
              backgroundColor: "hsl(var(--bg-card))",
              border: "1px solid hsl(var(--border))",
              minWidth: 168,
              top: menuPosition?.top ?? 0,
              left: menuPosition?.left,
              right: menuPosition?.right,
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(tx); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm t2 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5 text-cyan-400" />
              {t("common.edit")}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate(tx); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm t2 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-purple-400" />
              {t("common.add")}
            </button>
            <div className="h-px bg-[hsl(var(--border-2))] mx-3" />
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(tx.id); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-400/5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("common.delete")}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  ) : null;

  return (
    <motion.div
      whileTap={{ scale: 0.995 }}
      transition={tapTransition}
      role="button"
      tabIndex={0}
      onClick={() => onEdit(tx)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(tx);
        }
      }}
      className="pressable relative border-b border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card))] hover:bg-[hsl(var(--bg-input))] cursor-pointer outline-none transition-colors"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icon: category > source */}
        {showCatIcon ? (
          <div className="relative shrink-0">
            <CategoryIcon
              icon={(tx.category as typeof tx.category & { icon?: string })?.icon}
              color={tx.category!.color}
              size="sm"
            />
            <span className={`absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full border-2 border-[hsl(var(--bg-card))] ${tx.type === "income" ? "bg-emerald-400" : "bg-rose-400"}`} />
          </div>
        ) : (
          <div className={`p-2 rounded-xl shrink-0 relative ${srcCfg.bg}`}>
            <srcCfg.icon className={`w-4 h-4 ${srcCfg.color}`} />
            <span className={`absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full border-2 border-[hsl(var(--bg-card))] ${tx.type === "income" ? "bg-emerald-400" : "bg-rose-400"}`} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold t1 truncate">{tx.title}</p>
            {src !== "manual" && (
              <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase shrink-0 ${srcCfg.bg} ${srcCfg.color}`}>
                {src.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {tx.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: `${tx.category.color}15`, color: tx.category.color }}>
                {tx.category.name}
              </span>
            )}
            <span className="text-xs t3">
              {formatDate(tx.transaction_date, { month: "short", day: "numeric" })}
              {tx.notes ? ` - ${tx.notes}` : ""}
            </span>
          </div>
        </div>

        {/* Amount */}
        <p className={`text-sm font-bold tabular-nums shrink-0 ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
          {tx.type === "income" ? "+" : "-"}{formatAmount(Number(tx.amount))}
        </p>

        {/* ⋮ menu trigger */}
        <div className="relative shrink-0">
          <button
            ref={menuButtonRef}
            onClick={(e) => { e.stopPropagation(); toggleMenu(); }}
            className="p-1.5 rounded-lg t3 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-all -me-1"
            aria-expanded={menuOpen}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOverlay}
        </div>
      </div>
    </motion.div>
  );
});

// ── Animated stat card ────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <motion.div layout className="card px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="text-[10px] sm:text-xs t3 truncate">{label}</p>
      <p className={`text-sm sm:text-base font-bold mt-0.5 tabular-nums ${color}`}>{value}</p>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────
function TransactionsInner() {
  const { isGuest, isLoading } = useGuest();
  const { t, locale, formatDate } = useTranslation();
  const { format } = useCurrency();
  const { toasts, addToast, dismiss } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const preFilter = searchParams.get("filter");
  const parentRef = useRef<HTMLDivElement | null>(null);

  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<Transaction | undefined>();
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [search,      setSearch]      = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Unified filter: "all" | type | source
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const { data: transactions = [], isLoading: txLoading, isRefetching } = useTransactions(isGuest, !isLoading);
  const createMut  = useCreateTransaction(isGuest);
  const updateMut  = useUpdateTransaction(isGuest);
  const deleteMut  = useDeleteTransaction(isGuest);

  // ── Build filter options with counts ──────────────────────
  const filterOptions = useMemo(() => {
    const pre = applyPreFilter(transactions, preFilter);
    const counts: Record<string, number> = { all: pre.length };
    for (const tx of pre) {
      const src = tx.source ?? "manual";
      counts[src] = (counts[src] ?? 0) + 1;
      counts[tx.type] = (counts[tx.type] ?? 0) + 1;
    }
    return [
      { key: "all",          label: t("common.all"),               count: counts.all ?? 0,          group: "type"   },
      { key: "income",       label: t("transactions.income"),      count: counts.income ?? 0,        group: "type"   },
      { key: "expense",      label: t("transactions.expense"),     count: counts.expense ?? 0,       group: "type"   },
      { key: "investment",   label: t("nav.investments"),          count: counts.investment ?? 0,    group: "source" },
      { key: "debt",         label: t("transactions.source_debt"), count: counts.debt ?? 0,          group: "source" },
      { key: "debt_payment", label: t("transactions.source_debt_payment"), count: counts.debt_payment ?? 0, group: "source" },
      { key: "work",         label: t("nav.work"),                 count: counts.work ?? 0,          group: "source" },
      { key: "work_payment", label: t("transactions.source_work_payment"), count: counts.work_payment ?? 0, group: "source" },
      { key: "manual",       label: t("transactions.source_manual"), count: counts.manual ?? 0,      group: "source" },
    ].filter((o) => o.key === "all" || o.count > 0);
  }, [transactions, preFilter, t]);

  // ── Apply filter & search ─────────────────────────────────
  const filtered = useMemo(() => {
    const pre = applyPreFilter(transactions, preFilter);
    const q   = search.trim().toLowerCase();

    return pre.filter((tx) => {
      // Filter
      if (activeFilter !== "all") {
        const src = tx.source ?? "manual";
        const isTypeFilter = activeFilter === "income" || activeFilter === "expense";
        if (isTypeFilter) {
          if (tx.type !== activeFilter) return false;
        } else {
          if (src !== activeFilter) return false;
        }
      }
      // Search
      if (!q) return true;
      return (
        tx.title.toLowerCase().includes(q) ||
        (tx.category?.name?.toLowerCase().includes(q) ?? false) ||
        (tx.notes?.toLowerCase().includes(q) ?? false) ||
        String(tx.amount).includes(q) ||
        tx.transaction_date.includes(q)
      );
    });
  }, [transactions, preFilter, activeFilter, search]);

  // ── Totals ────────────────────────────────────────────────
  const { income, expenses, net } = useMemo(() => {
    let income = 0, expenses = 0;
    filtered.forEach((tx) => {
      if (tx.type === "income") income += Number(tx.amount);
      else expenses += Number(tx.amount);
    });
    return { income, expenses, net: income - expenses };
  }, [filtered]);

  // ── Virtual list ──────────────────────────────────────────
  const virtualItems = useMemo(() => buildVirtualItems(filtered), [filtered]);
  const rowVirtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => virtualItems[i]?.kind === "date" ? 38 : 74,
    overscan: 10,
    getItemKey: (i) => virtualItems[i]?.id ?? i,
  });
  const visible    = rowVirtualizer.getVirtualItems();
  const activeDate = visible.length > 0 ? findActiveDate(virtualItems, visible[0].index) : "";

  // ── Handlers ──────────────────────────────────────────────
  const handleAdd = useCallback(async (data: TransactionFormData) => {
    try {
      await createMut.mutateAsync(data);
      addToast(t("transactions.created"), "success");
    } catch {
      addToast(t("transactions.form_error"), "error");
      throw new Error(t("transactions.form_error"));
    }
  }, [createMut, addToast, t]);

  const handleEdit = useCallback(async (data: TransactionFormData) => {
    if (!editing) return;
    try {
      await updateMut.mutateAsync({ id: editing.id, data });
      setEditing(undefined);
      addToast(t("transactions.updated"), "success");
    } catch {
      addToast(t("transactions.form_error"), "error");
      throw new Error(t("transactions.form_error"));
    }
  }, [editing, updateMut, addToast, t]);

  const handleDelete = useCallback(async () => {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    try {
      await deleteMut.mutateAsync(id);
      addToast(t("transactions.deleted"), "success");
    } catch {
      addToast(t("transactions.delete_failed"), "error");
    }
  }, [confirmId, deleteMut, addToast, t]);

  const handleDuplicate = useCallback(async (tx: Transaction) => {
    const data: TransactionFormData = {
      title:            tx.title,
      notes:            tx.notes ?? undefined,
      amount:           Number(tx.amount),
      type:             tx.type,
      category_id:      tx.category_id,
      transaction_date: new Date().toISOString().split("T")[0],
    };
    try {
      await createMut.mutateAsync(data);
      addToast(t("transactions.created"), "success");
    } catch {
      addToast(t("transactions.form_error"), "error");
    }
  }, [createMut, addToast, t]);

  const loading = isLoading || txLoading;

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold t1">{t("transactions.title")}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs t3">{transactions.length} {t("common.total")}</p>
            {isRefetching && <Loader2 className="w-3 h-3 t3 animate-spin" />}
          </div>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-[#0B0F14] rounded-xl text-sm font-bold transition-all shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("transactions.add")}</span>
          <span className="sm:hidden">{t("common.add")}</span>
        </button>
      </div>

      {/* ── Pre-filter banner ───────────────────────────── */}
      {preFilter && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
          <p className="text-sm text-cyan-400 font-medium">{t(`transactions.filter_${preFilter}`) || preFilter}</p>
          <button onClick={() => router.push("/transactions")} className="text-xs text-cyan-400/70 hover:text-cyan-400 underline">
            {t("common.all")}
          </button>
        </div>
      )}

      {/* ── Stat cards ──────────────────────────────────── */}
      <motion.div
        variants={staggerContainer} initial="hidden" animate="visible"
        className="grid grid-cols-3 gap-2 sm:gap-3"
      >
        <motion.div variants={staggerItem}>
          <StatCard label={t("transactions.total_income")} value={format(income)} color="text-emerald-400" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard label={t("transactions.total_expenses")} value={format(expenses)} color="text-rose-400" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard label={t("transactions.net")} value={format(net)} color={net >= 0 ? "text-cyan-400" : "text-rose-400"} />
        </motion.div>
      </motion.div>

      {/* ── Search + filter toggle ───────────────────────── */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 t3 pointer-events-none" />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 p-0.5 rounded t3 hover:t2">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <input
              type="text"
              placeholder={t("transactions.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field ps-9 pe-9 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters((p) => !p)}
            className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
              showFilters || activeFilter !== "all"
                ? "bg-cyan-400/10 text-cyan-400 border-cyan-400/30"
                : "bg-[hsl(var(--bg-input))] t2 border-[hsl(var(--border))]"
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Filter pills — collapsible */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="tabs-row gap-1.5 py-1">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setActiveFilter(opt.key)}
                    className={`tab-pill shrink-0 flex items-center gap-1.5 ${activeFilter === opt.key ? "active" : ""}`}
                  >
                    {opt.label}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeFilter === opt.key
                        ? "bg-white/20 text-white"
                        : "bg-[hsl(var(--bg-input))] t3"
                    }`}>
                      {opt.count}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active filter badge (when filters hidden) */}
        {!showFilters && activeFilter !== "all" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5">
              {filterOptions.find((o) => o.key === activeFilter)?.label}
              <button onClick={() => setActiveFilter("all")} className="hover:text-cyan-200 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
            <span className="text-xs t3">{filtered.length} {t("common.total")}</span>
          </div>
        )}
      </div>

      {/* ── Transaction list ─────────────────────────────── */}
      <div className="card overflow-hidden rounded-2xl">
        {loading ? (
          <div className="space-y-0">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border-2))] animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-[hsl(var(--bg-input))] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-[hsl(var(--bg-input))] rounded w-2/3" />
                  <div className="h-3 bg-[hsl(var(--bg-input))] rounded w-1/3" />
                </div>
                <div className="h-4 bg-[hsl(var(--bg-input))] rounded w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Wallet className="w-8 h-8 t3 opacity-20 mx-auto mb-3" />
            <p className="text-sm font-semibold t1">{search ? t("transactions.no_results") : t("common.no_data")}</p>
            <p className="text-xs t3 mt-1">
              {activeFilter !== "all"
                ? `${t("common.all")} -> ${filterOptions.find((o) => o.key === activeFilter)?.label}`
                : ""}
            </p>
            {!search && activeFilter === "all" && (
              <button onClick={() => setShowForm(true)} className="text-sm text-cyan-400 hover:underline mt-2">
                {t("transactions.add")}
              </button>
            )}
          </div>
        ) : (
          <div ref={parentRef} className="relative overflow-auto overscroll-contain" style={{ height: "66vh", maxHeight: "600px" }}>
            {activeDate && (() => {
              const activeDateItem = virtualItems.find((i) => i.kind === "date" && i.date === activeDate);
              const di = activeDateItem?.kind === "date" ? activeDateItem : null;
              return (
                <div className="sticky top-0 z-20 shadow-sm">
                  <DateHeader
                    date={activeDate}
                    income={di?.income ?? 0}
                    expense={di?.expense ?? 0}
                    formatDate={formatDate}
                    format={format}
                  />
                </div>
              );
            })()}
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {visible.map((vRow) => {
                const item = virtualItems[vRow.index];
                if (!item) return null;
                return (
                  <div
                    key={vRow.key}
                    data-index={vRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}
                  >
                    {item.kind === "date"
                      ? <DateHeader
                          date={item.date}
                          income={item.income}
                          expense={item.expense}
                          formatDate={formatDate}
                          format={format}
                        />
                      : <TransactionRow
                          tx={item.transaction}
                          locale={locale}
                          formatAmount={format}
                          formatDate={formatDate}
                          onEdit={(tx) => { setEditing(tx); setShowForm(true); }}
                          onDelete={setConfirmId}
                          onDuplicate={handleDuplicate}
                        />
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────── */}
      {showForm && (
        <TransactionForm
          initial={editing}
          onSubmit={editing ? handleEdit : handleAdd}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
        />
      )}
      {confirmId && (
        <ConfirmModal
          message={t("transactions.delete_message")}
          loading={deleteMut.isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
      <ToastList toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className="py-16 flex items-center justify-center t3">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    }>
      <TransactionsInner />
    </Suspense>
  );
}
