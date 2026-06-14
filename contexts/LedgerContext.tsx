"use client";

import { createContext, useContext, useCallback, useMemo } from "react";
import type { UnifiedLedgerEntry, CashflowSummary, LedgerFilters } from "@/lib/ledger/types";
import {
  calculateBalance, getCashflowSummary,
  filterLedger, sortByDate,
} from "@/lib/ledger/engine";
import { useFinancialEngine } from "@/lib/finance/engine";

interface LedgerContextType {
  entries:     UnifiedLedgerEntry[];
  balance:     number;
  cashflow:    CashflowSummary;
  getFiltered: (filters: LedgerFilters) => UnifiedLedgerEntry[];
}

const defaultCashflow: CashflowSummary = {
  totalInflow: 0, totalOutflow: 0, netBalance: 0, byType: {},
};

const LedgerContext = createContext<LedgerContextType>({
  entries:     [],
  balance:     0,
  cashflow:    defaultCashflow,
  getFiltered: () => [],
});

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const { ledgerEntries } = useFinancialEngine();

  const entries = useMemo(() => sortByDate(ledgerEntries), [ledgerEntries]);

  const cashEntries = useMemo(
    () => entries.filter(
      (e) => e.type === "transaction" || e.type === "income"
          || e.type === "salary"       || e.type === "debt"
    ),
    [entries],
  );

  const balance  = useMemo(() => calculateBalance(cashEntries),   [cashEntries]);
  const cashflow = useMemo(() => getCashflowSummary(cashEntries), [cashEntries]);

  const getFiltered = useCallback(
    (filters: LedgerFilters) => filterLedger(entries, filters),
    [entries],
  );

  return (
    <LedgerContext.Provider value={{ entries, balance, cashflow, getFiltered }}>
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger() {
  return useContext(LedgerContext);
}
