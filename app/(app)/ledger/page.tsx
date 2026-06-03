"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BookOpen,
  Filter,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import LedgerTimeline from "@/components/ledger/LedgerTimeline";
import TransactionForm from "@/components/transactions/TransactionForm";
import { useLedger } from "@/contexts/LedgerContext";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { filterLedger, sortByDate } from "@/lib/ledger/engine";
import type { LedgerDirection, LedgerEntryType, LedgerFilters, UnifiedLedgerEntry } from "@/lib/ledger/types";
import {
  useDeleteTransaction, useUpdateTransaction, useTransactions,
  useDeleteDebt, useDeleteInvestment, useDeleteWorkSession,
} from "@/lib/query/hooks";
import { deleteItem } from "@/lib/query/crud-factory";
import type { Transaction, TransactionFormData } from "@/types";

const TYPE_TABS: { label: string; value: LedgerEntryType | "all"; color?: string }[] = [
  { label: "common.all",             value: "all" },
  { label: "transactions.income",    value: "income",       color: "#34d399" },
  { label: "transactions.expense",   value: "transaction",  color: "#fb7185" },
  { label: "nav.subscriptions",      value: "subscription", color: "#818cf8" },
  { label: "nav.debts",              value: "debt",         color: "#f59e0b" },
  { label: "nav.investments",        value: "investment",   color: "#a78bfa" },
  { label: "work.sessions",          value: "salary",       color: "#22d3ee" },
];

const DIRECTION_OPTS: { label: string; value: LedgerDirection | "all" }[] = [
  { label: "ledger.all_flows",    value: "all"     },
  { label: "ledger.inflow_only",  value: "inflow"  },
  { label: "ledger.outflow_only", value: "outflow" },
];

// ── Routes for non-transaction types ─────────────────────────
const TYPE_EDIT_ROUTES: Partial<Record<LedgerEntryType, string>> = {
  debt:         "/debts",
  investment:   "/investments",
  subscription: "/subscriptions",
  salary:       "/work",
};

export default function LedgerPage() {
  const router = useRouter();
  const { entries, balance, cashflow } = useLedger();
  const { data: transactions = [] } = useTransactions();
  const { format }  = useCurrency();
  const { t }       = useTranslation();

  // Mutations
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const deleteDebt        = useDeleteDebt();
  const deleteInvestment  = useDeleteInvestment();
  const deleteWorkSession = useDeleteWorkSession();

  // UI state
  const [filters,    setFilters]    = useState<LedgerFilters>({ type: "all", direction: "all" });
  const [search,     setSearch]     = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingEntry,      setDeletingEntry]      = useState<UnifiedLedgerEntry | null>(null);
  const [deleteLoading,      setDeleteLoading]      = useState(false);

  const transactionById = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const tx of transactions) map.set(tx.id, tx);
    return map;
  }, [transactions]);

  const visible = useMemo(
    () => sortByDate(filterLedger(entries, { ...filters, search: search.trim() || undefined })),
    [entries, filters, search],
  );

  const activeFilterCount = [
    filters.type !== "all",
    filters.direction !== "all",
    Boolean(filters.dateFrom),
    Boolean(filters.dateTo),
    Boolean(search.trim()),
  ].filter(Boolean).length;

  const visibleCashflow = useMemo(() => {
    let inflow = 0; let outflow = 0;
    for (const e of visible) {
      if (e.direction === "inflow")  inflow  += e.amount;
      if (e.direction === "outflow") outflow += e.amount;
    }
    return { inflow, outflow, net: inflow - outflow };
  }, [visible]);

  const typeCounts = useMemo(() => {
    const counts = new Map<LedgerEntryType | "all", number>([["all", entries.length]]);
    for (const e of entries) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    return counts;
  }, [entries]);

  // ── Edit handler ─────────────────────────────────────────────
  function handleEdit(entry: UnifiedLedgerEntry) {
    if ((entry.type === "transaction" || entry.type === "income") && entry.related_module_id) {
      const tx = transactionById.get(entry.related_module_id);
      if (tx) { setEditingTransaction(tx); return; }
    }
    // For other types: navigate to the relevant section
    const route = TYPE_EDIT_ROUTES[entry.type];
    if (route) router.push(route);
  }

  // ── Delete handler ───────────────────────────────────────────
  function handleDelete(entry: UnifiedLedgerEntry) {
    setDeletingEntry(entry);
  }

  async function confirmDelete() {
    if (!deletingEntry) return;
    const { type, related_module_id: id } = deletingEntry;
    if (!id) { setDeletingEntry(null); return; }

    setDeleteLoading(true);
    try {
      if (type === "transaction" || type === "income") {
        const tx = transactionById.get(id);
        if (tx) await deleteTransaction.mutateAsync(tx.id);
      } else if (type === "debt") {
        await deleteDebt.mutateAsync(id);
      } else if (type === "investment") {
        await deleteInvestment.mutateAsync(id);
      } else if (type === "salary") {
        await deleteWorkSession.mutateAsync(id);
      } else if (type === "subscription") {
        await deleteItem(`/api/subscriptions/${id}`);
      }
    } finally {
      setDeleteLoading(false);
      setDeletingEntry(null);
    }
  }

  async function handleUpdateTransaction(data: TransactionFormData) {
    if (!editingTransaction) return;
    await updateTransaction.mutateAsync({ id: editingTransaction.id, data });
    setEditingTransaction(null);
  }

  function resetFilters() {
    setSearch(""); setFilters({ type: "all", direction: "all" });
  }

  const netValue    = activeFilterCount > 0 ? visibleCashflow.net    : balance;
  const inflowValue = activeFilterCount > 0 ? visibleCashflow.inflow  : cashflow.totalInflow;
  const outflowValue= activeFilterCount > 0 ? visibleCashflow.outflow : cashflow.totalOutflow;

  // Delete message based on type
  const deleteMsg = deletingEntry
    ? deletingEntry.type === "transaction" || deletingEntry.type === "income"
      ? t("ledger.delete_transaction_confirm", { title: deletingEntry.title })
      : t("ledger.delete_entry_confirm", { title: deletingEntry.title })
    : "";

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10">
            <BookOpen className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black t1">{t("ledger.title")}</h1>
            <p className="mt-0.5 text-xs font-medium t3">{t("ledger.total_entries", { count: entries.length })}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`relative flex h-10 shrink-0 items-center gap-2 rounded-2xl border px-3 text-sm font-bold transition-all ${
            showFilters
              ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-400"
              : "border-[hsl(var(--border))] bg-[hsl(var(--bg-input))] t2 hover:t1"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("ledger.filters")}</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1.5 text-[10px] font-black text-slate-950">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[
          { label: t("transactions.net"), value: format(netValue),     icon: Wallet,      color: netValue >= 0 ? "text-cyan-400" : "text-rose-400", bg: netValue >= 0 ? "bg-cyan-400/10" : "bg-rose-400/10" },
          { label: t("ledger.total_inflow"),  value: format(inflowValue),  icon: TrendingUp,  color: "text-emerald-400", bg: "bg-emerald-400/10" },
          { label: t("ledger.total_outflow"), value: format(outflowValue), icon: TrendingDown, color: "text-rose-400",    bg: "bg-rose-400/10" },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs t3 uppercase tracking-wide font-medium">{s.label}</p>
              <div className={`p-2 rounded-lg ${s.bg}`}><s.icon className={`w-3.5 h-3.5 ${s.color}`} /></div>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card p-4 space-y-3">
          <div>
            <p className="text-xs t3 uppercase tracking-wide font-medium mb-2">{t("ledger.direction")}</p>
            <div className="flex gap-2 flex-wrap">
              {DIRECTION_OPTS.map((opt) => (
                <button key={opt.value} onClick={() => setFilters((p) => ({ ...p, direction: opt.value }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filters.direction === opt.value
                      ? "bg-cyan-400/10 text-cyan-400 border-cyan-400/30"
                      : "t2 border-[hsl(var(--border))] hover:t1 bg-[hsl(var(--bg-input))]"
                  }`}>
                  {t(opt.label)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs t3 mb-1">{t("ledger.from_date")}</label>
              <input type="date" value={filters.dateFrom ?? ""} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value || undefined }))} className="field text-sm" />
            </div>
            <div>
              <label className="block text-xs t3 mb-1">{t("ledger.to_date")}</label>
              <input type="date" value={filters.dateTo ?? ""} onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value || undefined }))} className="field text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 t3 pointer-events-none" />
        <input
          type="text" placeholder={t("ledger.search")}
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="field ps-10 pe-9 text-sm"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")}
            className="absolute end-3 top-1/2 -translate-y-1/2 p-1 rounded-lg t3 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1">
        {TYPE_TABS.map((tab) => {
          const isActive = filters.type === tab.value;
          const count    = typeCounts.get(tab.value) ?? 0;
          return (
            <button key={tab.value}
              onClick={() => setFilters((p) => ({ ...p, type: tab.value }))}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 border"
              style={isActive && tab.color
                ? { backgroundColor: `${tab.color}15`, color: tab.color, borderColor: `${tab.color}30` }
                : isActive
                  ? { backgroundColor: "hsl(var(--bg-card-2))", borderColor: "hsl(var(--border))" }
                  : { backgroundColor: "transparent", color: "hsl(var(--text-3))", borderColor: "transparent" }
              }
            >
              {t(tab.label)}
              {count > 0 && (
                <span className={`ms-1 text-[9px] font-bold px-1 py-0.5 rounded-full ${
                  isActive ? "bg-white/15" : "bg-[hsl(var(--bg-input))]"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active filter summary */}
      {activeFilterCount > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs t3">
            <span className="font-semibold t1">{visible.length}</span> / {entries.length}
            {search && <span className="text-cyan-400"> · {t("ledger.matching", { query: search })}</span>}
          </p>
          <button onClick={resetFilters} className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-colors">
            {t("ledger.clear_filters")}
          </button>
        </div>
      )}

      {/* Timeline */}
      <LedgerTimeline
        entries={visible}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {editingTransaction && (
        <TransactionForm
          initial={editingTransaction}
          onSubmit={handleUpdateTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {deletingEntry && (
        <ConfirmModal
          message={deleteMsg}
          loading={deleteLoading}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingEntry(null)}
        />
      )}
    </div>
  );
}
