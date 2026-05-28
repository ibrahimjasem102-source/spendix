// Pure functions — no React, no side effects.
import { UnifiedLedgerEntry, CashflowSummary, LedgerFilters, LedgerEntryType } from "./types";

// ── Balance ───────────────────────────────────────────────────
export function calculateBalance(entries: UnifiedLedgerEntry[]): number {
  return entries.reduce((sum, e) => {
    if (e.direction === "inflow")  return sum + e.amount;
    if (e.direction === "outflow") return sum - e.amount;
    return sum;
  }, 0);
}

// ── Cashflow summary ──────────────────────────────────────────
export function getCashflowSummary(entries: UnifiedLedgerEntry[]): CashflowSummary {
  const totalInflow  = entries.filter((e) => e.direction === "inflow").reduce((s, e) => s + e.amount, 0);
  const totalOutflow = entries.filter((e) => e.direction === "outflow").reduce((s, e) => s + e.amount, 0);

  const byType: Partial<Record<LedgerEntryType, number>> = {};
  entries.forEach((e) => {
    const current = byType[e.type] ?? 0;
    byType[e.type] = current + (e.direction === "outflow" ? e.amount : -e.amount);
  });

  return { totalInflow, totalOutflow, netBalance: totalInflow - totalOutflow, byType };
}

// ── Filtering ─────────────────────────────────────────────────
export function filterLedger(
  entries: UnifiedLedgerEntry[],
  filters: LedgerFilters
): UnifiedLedgerEntry[] {
  return entries.filter((e) => {
    if (filters.type      && filters.type      !== "all" && e.type      !== filters.type)      return false;
    if (filters.direction && filters.direction !== "all" && e.direction !== filters.direction) return false;
    if (filters.dateFrom  && e.date < filters.dateFrom)  return false;
    if (filters.dateTo    && e.date > filters.dateTo)    return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matches = e.title.toLowerCase().includes(q) || (e.category?.toLowerCase().includes(q) ?? false);
      if (!matches) return false;
    }
    return true;
  });
}

// ── Sorting ───────────────────────────────────────────────────
export function sortByDate(entries: UnifiedLedgerEntry[]): UnifiedLedgerEntry[] {
  return [...entries].sort((a, b) =>
    b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
  );
}

// ── Grouping ──────────────────────────────────────────────────
export function groupByMonth(entries: UnifiedLedgerEntry[]): Map<string, UnifiedLedgerEntry[]> {
  const groups = new Map<string, UnifiedLedgerEntry[]>();
  entries.forEach((e) => {
    const key = e.date.slice(0, 7); // YYYY-MM
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  });
  return groups;
}

// ── Stats helpers ─────────────────────────────────────────────
export function getIncome(entries: UnifiedLedgerEntry[]): number {
  return entries.filter((e) => e.direction === "inflow" && (e.type === "income" || e.type === "transaction"))
    .reduce((s, e) => s + e.amount, 0);
}

export function getExpenses(entries: UnifiedLedgerEntry[]): number {
  return entries.filter((e) => e.direction === "outflow" && e.type === "transaction")
    .reduce((s, e) => s + e.amount, 0);
}

export function getInvestmentOutflow(entries: UnifiedLedgerEntry[]): number {
  return entries.filter((e) => e.type === "investment").reduce((s, e) => s + e.amount, 0);
}
