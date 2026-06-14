"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, ChevronDown, Filter, Search,
  TrendingDown, TrendingUp, Wallet, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LedgerTimeline from "@/components/ledger/LedgerTimeline";
import TransactionForm from "@/components/transactions/TransactionForm";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useLedger } from "@/contexts/LedgerContext";
import { useFinancialEngine } from "@/lib/finance/engine";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { filterLedger, sortByDate } from "@/lib/ledger/engine";
import type { LedgerDirection, LedgerEntryType, UnifiedLedgerEntry } from "@/lib/ledger/types";
import {
  useDeleteTransaction, useUpdateTransaction,
  useDeleteDebt, useDeleteInvestment, useDeleteWorkSession,
} from "@/lib/query/hooks";
import { deleteItem } from "@/lib/query/crud-factory";
import type { Account, Transaction, TransactionFormData } from "@/types";

// ── Filter state ───────────────────────────────────────────────────────────────

interface PageFilters {
  type:          LedgerEntryType | "all";
  direction:     LedgerDirection | "all";
  dateFrom?:     string;
  dateTo?:       string;
  accountId?:    string;
  contactId?:    string;
  categoryName?: string;
}

const EMPTY: PageFilters = { type: "all", direction: "all" };

// ── Type tabs ──────────────────────────────────────────────────────────────────

const TYPE_TABS = [
  { label: "All",          value: "all"          as LedgerEntryType | "all", hex: undefined         },
  { label: "Income",       value: "income"       as LedgerEntryType | "all", hex: "#34d399"         },
  { label: "Expense",      value: "transaction"  as LedgerEntryType | "all", hex: "#fb7185"         },
  { label: "Debt",         value: "debt"         as LedgerEntryType | "all", hex: "#f59e0b"         },
  { label: "Investment",   value: "investment"   as LedgerEntryType | "all", hex: "#a78bfa"         },
  { label: "Subscription", value: "subscription" as LedgerEntryType | "all", hex: "#818cf8"         },
  { label: "Salary",       value: "salary"       as LedgerEntryType | "all", hex: "#22d3ee"         },
  { label: "Goal",         value: "goal"         as LedgerEntryType | "all", hex: "#f472b6"         },
];

const TYPE_EDIT_ROUTES: Partial<Record<LedgerEntryType, string>> = {
  debt:         "/debts",
  investment:   "/investments",
  subscription: "/subscriptions",
  salary:       "/work",
  goal:         "/goals",
  recurring:    "/recurring",
};

const PAGE_SIZE = 25;

// ── Helpers ────────────────────────────────────────────────────────────────────

function ChipBtn({
  label, active, hex, onSelect, onClear,
}: {
  label:    string;
  active:   boolean;
  hex?:     string;
  onSelect: () => void;
  onClear?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={active && onClear ? onClear : onSelect}
      className="flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition-all"
      style={
        active && hex
          ? { backgroundColor: `${hex}15`, color: hex, borderColor: `${hex}35` }
          : active
          ? { backgroundColor: "hsl(var(--bg-card-2))", color: "hsl(var(--text-1))", borderColor: "hsl(var(--border))" }
          : { backgroundColor: "transparent", color: "hsl(var(--text-3))", borderColor: "transparent" }
      }
    >
      {hex && (
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: active ? hex : "hsl(var(--text-3))" }}
        />
      )}
      {label}
      {active && onClear && <X className="h-3 w-3 shrink-0" />}
    </button>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] t3">{label}</p>
      {children}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LedgerPage() {
  const router             = useRouter();
  const { entries, balance, cashflow } = useLedger();
  const engine             = useFinancialEngine();
  const { format }         = useCurrency();
  const { t }              = useTranslation();

  // Mutations
  const updateTx     = useUpdateTransaction();
  const deleteTx     = useDeleteTransaction();
  const deleteDebt   = useDeleteDebt();
  const deleteInv    = useDeleteInvestment();
  const deleteWork   = useDeleteWorkSession();

  // UI state
  const [search,      setSearch]      = useState("");
  const [filters,     setFilters]     = useState<PageFilters>(EMPTY);
  const [panelOpen,   setPanelOpen]   = useState(false);
  const [page,        setPage]        = useState(1);
  const sentinelRef  = useRef<HTMLDivElement>(null);

  // Edit / delete state
  const [editingTx,    setEditingTx]    = useState<Transaction | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<UnifiedLedgerEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Lookup maps ──────────────────────────────────────────────
  // tx.id → Transaction (for inline edit)
  const txById = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const tx of engine.transactions) map.set(tx.id, tx);
    return map;
  }, [engine.transactions]);

  // accountId → Set<txId>
  const txByAccount = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const tx of engine.transactions) {
      if (!tx.account_id) continue;
      if (!map.has(tx.account_id)) map.set(tx.account_id, new Set());
      map.get(tx.account_id)!.add(tx.id);
    }
    return map;
  }, [engine.transactions]);

  // contactId → Set<txId | debtId>
  const txByContact = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const tx of engine.transactions) {
      if (!tx.contact_id) continue;
      if (!map.has(tx.contact_id)) map.set(tx.contact_id, new Set());
      map.get(tx.contact_id)!.add(tx.id);
    }
    for (const debt of engine.debts) {
      if (!debt.contact_id) continue;
      if (!map.has(debt.contact_id)) map.set(debt.contact_id, new Set());
      map.get(debt.contact_id)!.add(debt.id);
    }
    return map;
  }, [engine.transactions, engine.debts]);

  // ── Filter options derived from data ─────────────────────────
  // Only show type tabs with at least 1 entry
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>([["all", entries.length]]);
    for (const e of entries) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return m;
  }, [entries]);

  // Unique categories from entries
  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>(); // name → color
    for (const e of entries) {
      if (e.category && !map.has(e.category)) {
        map.set(e.category, e.category_color ?? "#6b7280");
      }
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, color]) => ({ name, color }));
  }, [entries]);

  // Unique contacts from transactions + debts
  const contactOptions = useMemo(() => {
    const map = new Map<string, string>(); // id → name
    for (const tx of engine.transactions) {
      if (tx.contact_id && tx.contact?.name) map.set(tx.contact_id, tx.contact.name);
    }
    for (const debt of engine.debts) {
      if (debt.contact_id) {
        const name = (debt as { contact?: { name?: string } }).contact?.name ?? debt.person_or_entity;
        map.set(debt.contact_id, name);
      }
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [engine.transactions, engine.debts]);

  // ── Filtered entries ─────────────────────────────────────────
  const allFiltered = useMemo(() => {
    // 1. Standard ledger filter (type, direction, date, search)
    let result = filterLedger(entries, {
      type:      filters.type,
      direction: filters.direction,
      dateFrom:  filters.dateFrom,
      dateTo:    filters.dateTo,
      search:    search.trim() || undefined,
    });

    // 2. Account filter
    if (filters.accountId) {
      const ids = txByAccount.get(filters.accountId);
      result = ids?.size
        ? result.filter((e) => e.related_module_id != null && ids.has(e.related_module_id))
        : [];
    }

    // 3. Contact filter
    if (filters.contactId) {
      const ids = txByContact.get(filters.contactId);
      result = ids?.size
        ? result.filter((e) => e.related_module_id != null && ids.has(e.related_module_id))
        : [];
    }

    // 4. Category filter
    if (filters.categoryName) {
      result = result.filter((e) => e.category === filters.categoryName);
    }

    return result;
  }, [entries, filters, search, txByAccount, txByContact]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filters, search]);

  const paged   = useMemo(() => allFiltered.slice(0, page * PAGE_SIZE), [allFiltered, page]);
  const hasMore = paged.length < allFiltered.length;

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore) setPage((p) => p + 1); },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore]);

  // ── Stats (react to filters) ─────────────────────────────────
  const isFiltered = (
    filters.type !== "all" ||
    filters.direction !== "all" ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    Boolean(filters.accountId) ||
    Boolean(filters.contactId) ||
    Boolean(filters.categoryName) ||
    Boolean(search.trim())
  );

  const stats = useMemo(() => {
    if (!isFiltered) {
      return { net: balance, inflow: cashflow.totalInflow, outflow: cashflow.totalOutflow };
    }
    let inflow = 0; let outflow = 0;
    for (const e of allFiltered) {
      if (e.direction === "inflow")  inflow  += e.amount;
      if (e.direction === "outflow") outflow += e.amount;
    }
    return { net: inflow - outflow, inflow, outflow };
  }, [isFiltered, allFiltered, balance, cashflow]);

  const activeCount = [
    filters.type !== "all",
    filters.direction !== "all",
    Boolean(filters.dateFrom),
    Boolean(filters.dateTo),
    Boolean(filters.accountId),
    Boolean(filters.contactId),
    Boolean(filters.categoryName),
    Boolean(search.trim()),
  ].filter(Boolean).length;

  // ── Edit / delete ─────────────────────────────────────────────
  function handleEdit(entry: UnifiedLedgerEntry) {
    if ((entry.type === "transaction" || entry.type === "income") && entry.related_module_id) {
      const tx = txById.get(entry.related_module_id);
      if (tx) { setEditingTx(tx); return; }
    }
    const route = TYPE_EDIT_ROUTES[entry.type];
    if (route) router.push(route);
  }

  async function handleDelete(entry: UnifiedLedgerEntry) {
    setDeletingEntry(entry);
  }

  async function confirmDelete() {
    if (!deletingEntry?.related_module_id) { setDeletingEntry(null); return; }
    const { type, related_module_id: id } = deletingEntry;
    setDeleteLoading(true);
    try {
      if (type === "transaction" || type === "income") {
        await deleteTx.mutateAsync(id);
      } else if (type === "debt") {
        await deleteDebt.mutateAsync(id);
      } else if (type === "investment") {
        await deleteInv.mutateAsync(id);
      } else if (type === "salary") {
        await deleteWork.mutateAsync(id);
      } else if (type === "subscription") {
        await deleteItem(`/api/subscriptions/${id}`);
      }
    } finally {
      setDeleteLoading(false);
      setDeletingEntry(null);
    }
  }

  async function handleUpdateTx(data: TransactionFormData) {
    if (!editingTx) return;
    await updateTx.mutateAsync({ id: editingTx.id, data });
    setEditingTx(null);
  }

  function clearAll() {
    setSearch("");
    setFilters(EMPTY);
  }

  // ── Labels for active filter chips ────────────────────────────
  const activeAccountName  = filters.accountId
    ? engine.accounts.find((a) => a.id === filters.accountId)?.name
    : undefined;
  const activeContactName  = filters.contactId
    ? contactOptions.find((c) => c.id === filters.contactId)?.name
    : undefined;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-3 pb-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10">
            <BookOpen className="h-4 w-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black t1">{t("ledger.title")}</h1>
            <p className="mt-0.5 text-[10px] t3">
              {isFiltered
                ? `${allFiltered.length} of ${entries.length} entries`
                : `${entries.length} entries`}
            </p>
          </div>
        </div>

        {/* Filter toggle */}
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className={[
            "relative flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold transition-all",
            panelOpen
              ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-400"
              : "border-[hsl(var(--border))] bg-[hsl(var(--bg-input))] t2 hover:t1",
          ].join(" ")}
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">Filters</span>
          <ChevronDown
            className={[
              "h-3 w-3 transition-transform duration-200",
              panelOpen ? "rotate-180" : "",
            ].join(" ")}
          />
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 px-1 text-[9px] font-black text-slate-950">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Net",     value: stats.net,     color: stats.net >= 0 ? "text-cyan-400"    : "text-rose-400",    bg: stats.net >= 0 ? "bg-cyan-400/10"    : "bg-rose-400/10",    icon: Wallet      },
          { label: "In",      value: stats.inflow,  color: "text-emerald-400", bg: "bg-emerald-400/10", icon: TrendingUp   },
          { label: "Out",     value: stats.outflow, color: "text-rose-400",    bg: "bg-rose-400/10",    icon: TrendingDown },
        ].map((s) => (
          <div key={s.label} className="card p-3.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] t3 font-semibold uppercase tracking-wide">{s.label}</p>
              <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${s.bg}`}>
                <s.icon className={`h-3 w-3 ${s.color}`} />
              </div>
            </div>
            <p className={`text-[13px] sm:text-sm font-black tabular-nums ${s.color}`}>
              {s.label === "Net" && stats.net >= 0 ? "+" : ""}
              {format(Math.abs(s.value))}
            </p>
          </div>
        ))}
      </div>

      {/* ── Search ──────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 t3 pointer-events-none" />
        <input
          type="search"
          placeholder="Search entries, amounts, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field ps-10 pe-9 text-sm w-full"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute end-3 top-1/2 -translate-y-1/2 p-1 rounded-lg t3 hover:t1 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Type tabs ───────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
        {TYPE_TABS.filter((tab) => tab.value === "all" || (typeCounts.get(tab.value) ?? 0) > 0).map((tab) => {
          const isActive = filters.type === tab.value;
          const count    = typeCounts.get(tab.value) ?? 0;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilters((p) => ({ ...p, type: tab.value }))}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-all"
              style={
                isActive && tab.hex
                  ? { backgroundColor: `${tab.hex}15`, color: tab.hex, borderColor: `${tab.hex}35` }
                  : isActive
                  ? { backgroundColor: "hsl(var(--bg-card-2))", color: "hsl(var(--text-1))", borderColor: "hsl(var(--border))" }
                  : { backgroundColor: "transparent", color: "hsl(var(--text-3))", borderColor: "transparent" }
              }
            >
              {tab.label}
              {count > 0 && tab.value !== "all" && (
                <span
                  className="rounded-full px-1 py-0.5 text-[9px] font-bold"
                  style={{
                    backgroundColor: isActive && tab.hex ? `${tab.hex}25` : "hsl(var(--bg-input))",
                    color: isActive && tab.hex ? tab.hex : "hsl(var(--text-3))",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filter panel ────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {panelOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "tween", duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="card p-4 space-y-4">

              {/* Direction */}
              <FilterSection label="Direction">
                <div className="flex gap-1.5 flex-wrap">
                  {(["all", "inflow", "outflow"] as const).map((d) => (
                    <ChipBtn
                      key={d}
                      label={d === "all" ? "All flows" : d === "inflow" ? "Inflow" : "Outflow"}
                      active={filters.direction === d}
                      hex={d === "inflow" ? "#34d399" : d === "outflow" ? "#fb7185" : undefined}
                      onSelect={() => setFilters((p) => ({ ...p, direction: d }))}
                    />
                  ))}
                </div>
              </FilterSection>

              {/* Date range */}
              <FilterSection label="Date range">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] t3 mb-1">From</label>
                    <input
                      type="date"
                      value={filters.dateFrom ?? ""}
                      onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value || undefined }))}
                      className="field text-xs w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] t3 mb-1">To</label>
                    <input
                      type="date"
                      value={filters.dateTo ?? ""}
                      onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value || undefined }))}
                      className="field text-xs w-full"
                    />
                  </div>
                </div>
              </FilterSection>

              {/* Accounts */}
              {engine.accounts.length > 0 && (
                <FilterSection label="Account">
                  <div className="flex gap-1.5 flex-wrap">
                    {engine.accounts.map((acct) => (
                      <ChipBtn
                        key={acct.id}
                        label={acct.name}
                        active={filters.accountId === acct.id}
                        hex={acct.color ?? undefined}
                        onSelect={() => setFilters((p) => ({ ...p, accountId: acct.id }))}
                        onClear={() => setFilters((p) => ({ ...p, accountId: undefined }))}
                      />
                    ))}
                  </div>
                </FilterSection>
              )}

              {/* Categories */}
              {categoryOptions.length > 0 && (
                <FilterSection label="Category">
                  <div className="flex gap-1.5 flex-wrap">
                    {categoryOptions.map((cat) => (
                      <ChipBtn
                        key={cat.name}
                        label={cat.name}
                        active={filters.categoryName === cat.name}
                        hex={cat.color}
                        onSelect={() => setFilters((p) => ({ ...p, categoryName: cat.name }))}
                        onClear={() => setFilters((p) => ({ ...p, categoryName: undefined }))}
                      />
                    ))}
                  </div>
                </FilterSection>
              )}

              {/* Contacts */}
              {contactOptions.length > 0 && (
                <FilterSection label="Contact">
                  <div className="flex gap-1.5 flex-wrap">
                    {contactOptions.map((c) => (
                      <ChipBtn
                        key={c.id}
                        label={c.name}
                        active={filters.contactId === c.id}
                        onSelect={() => setFilters((p) => ({ ...p, contactId: c.id }))}
                        onClear={() => setFilters((p) => ({ ...p, contactId: undefined }))}
                      />
                    ))}
                  </div>
                </FilterSection>
              )}

              {/* Clear all */}
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="w-full rounded-xl border border-rose-400/20 bg-rose-400/5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-400/10 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active filter chips ──────────────────────────────────── */}
      {isFiltered && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] t3 font-semibold">
            {allFiltered.length} result{allFiltered.length !== 1 ? "s" : ""}
          </span>

          {activeAccountName && (
            <button
              type="button"
              onClick={() => setFilters((p) => ({ ...p, accountId: undefined }))}
              className="flex items-center gap-1 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] font-semibold t2 hover:t1 transition-colors"
            >
              {activeAccountName} <X className="h-2.5 w-2.5" />
            </button>
          )}
          {activeContactName && (
            <button
              type="button"
              onClick={() => setFilters((p) => ({ ...p, contactId: undefined }))}
              className="flex items-center gap-1 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] font-semibold t2 hover:t1 transition-colors"
            >
              {activeContactName} <X className="h-2.5 w-2.5" />
            </button>
          )}
          {filters.categoryName && (
            <button
              type="button"
              onClick={() => setFilters((p) => ({ ...p, categoryName: undefined }))}
              className="flex items-center gap-1 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] font-semibold t2 hover:t1 transition-colors"
            >
              {filters.categoryName} <X className="h-2.5 w-2.5" />
            </button>
          )}
          {(filters.dateFrom || filters.dateTo) && (
            <button
              type="button"
              onClick={() => setFilters((p) => ({ ...p, dateFrom: undefined, dateTo: undefined }))}
              className="flex items-center gap-1 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] font-semibold t2 hover:t1 transition-colors"
            >
              {filters.dateFrom ?? "…"} – {filters.dateTo ?? "…"} <X className="h-2.5 w-2.5" />
            </button>
          )}

          <button
            type="button"
            onClick={clearAll}
            className="ms-auto text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Timeline ─────────────────────────────────────────────── */}
      <LedgerTimeline
        entries={paged}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* ── Infinite scroll sentinel ─────────────────────────────── */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-4 t3">
          <div className="h-4 w-4 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
          <span className="text-xs">Loading…</span>
        </div>
      )}

      {/* End of list */}
      {!hasMore && allFiltered.length > PAGE_SIZE && (
        <p className="text-center text-[10px] t3 py-2">
          All {allFiltered.length} entries shown
        </p>
      )}

      {/* ── Edit modal ────────────────────────────────────────────── */}
      {editingTx && (
        <TransactionForm
          initial={editingTx}
          onSubmit={handleUpdateTx}
          onClose={() => setEditingTx(null)}
        />
      )}

      {/* ── Delete confirm ────────────────────────────────────────── */}
      {deletingEntry && (
        <ConfirmModal
          message={`Delete "${deletingEntry.title}"? This cannot be undone.`}
          loading={deleteLoading}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingEntry(null)}
        />
      )}
    </div>
  );
}
