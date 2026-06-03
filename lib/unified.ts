// Single import point for the unified financial data layer.
// All consumers (Analytics, Dashboard, AI, Reports, Budgets, Goals)
// should import from here — never directly from engine or ledger.

export type { UnifiedLedgerEntry, LedgerEntryType, LedgerDirection, LedgerFilters, CashflowSummary } from "@/lib/ledger/types";
export { ENTRY_CONFIG } from "@/lib/ledger/types";
export type { FinancialSnapshot } from "@/lib/finance/engine";
export { useFinancialEngine } from "@/lib/finance/engine";

// Convenience hook: just the ledger entries, sorted newest-first
import { useFinancialEngine } from "@/lib/finance/engine";
import { useMemo } from "react";

export function useUnifiedEntries() {
  const engine = useFinancialEngine();
  const entries = useMemo(
    () => [...engine.ledgerEntries].reverse(),
    [engine.ledgerEntries]
  );
  return {
    entries,
    isLoading: engine.isLoading,
    isError:   engine.isError,
  };
}
