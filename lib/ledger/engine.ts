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
      const q = filters.search.toLowerCase().trim();
      if (q) {
        const tags         = e.tags?.join(" ").toLowerCase() ?? "";
        const notes        = typeof e.metadata?.notes     === "string" ? e.metadata.notes.toLowerCase()     : "";
        const employer     = typeof e.metadata?.employer  === "string" ? e.metadata.employer.toLowerCase()  : "";
        const sourceModule = typeof e.metadata?.source_module === "string" ? e.metadata.source_module.toLowerCase() : "";
        const sourceText   = sourceModule === "calendar" ? "calendar financial calendar تقويم التقويم المالي" : "";
        const amountStr    = String(e.amount);

        // Debt-specific: add Arabic + English search aliases so "دين / debt / payable / receivable" all work
        let typeAlias = "";
        if (e.type === "debt") {
          const dt = typeof e.metadata?.debt_type === "string" ? e.metadata.debt_type : "";
          const status = typeof e.metadata?.status === "string" ? e.metadata.status : "";
          typeAlias = [
            dt, status,
            dt === "payable"    ? "payable مستحق عليك دين" : "",
            dt === "receivable" ? "receivable مستحق لك دين" : "",
            "debt دين",
          ].join(" ").toLowerCase();
        }
        if (e.type === "investment") {
          const assetType = typeof e.metadata?.asset_type === "string" ? e.metadata.asset_type : "";
          typeAlias = `investment استثمار ${assetType}`.toLowerCase();
        }
        if (e.type === "subscription") {
          typeAlias = "subscription اشتراك";
        }
        if (e.type === "salary") {
          typeAlias = "salary راتب عمل work";
        }

        const matches =
          e.title.toLowerCase().includes(q) ||
          (e.category?.toLowerCase().includes(q) ?? false) ||
          tags.includes(q) ||
          notes.includes(q) ||
          employer.includes(q) ||
          sourceModule.includes(q) ||
          sourceText.includes(q) ||
          amountStr.includes(q) ||
          typeAlias.includes(q);
        if (!matches) return false;
      }
    }
    return true;
  });
}

// ── Sorting ───────────────────────────────────────────────────
export function sortByDate(entries: UnifiedLedgerEntry[]): UnifiedLedgerEntry[] {
  return [...entries].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? "") ||
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
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
// income  = earned inflows (transactions + salary) + borrowed money (payable debts = inflow)
// expenses = cash outflows (transactions) + lent money (receivable debts = outflow)
// This keeps balance = income - expenses consistent.
export function getIncome(entries: UnifiedLedgerEntry[]): number {
  return entries
    .filter((e) => e.direction === "inflow" && (
      e.type === "income"      ||
      e.type === "transaction" ||
      e.type === "salary"      ||
      e.type === "debt"        // payable debt = you received money
    ))
    .reduce((s, e) => s + e.amount, 0);
}

export function getExpenses(entries: UnifiedLedgerEntry[]): number {
  return entries
    .filter((e) => e.direction === "outflow" && (
      e.type === "transaction" ||
      e.type === "debt"        // receivable debt = you gave money out
    ))
    .reduce((s, e) => s + e.amount, 0);
}

export function getInvestmentOutflow(entries: UnifiedLedgerEntry[]): number {
  return entries.filter((e) => e.type === "investment").reduce((s, e) => s + e.amount, 0);
}
