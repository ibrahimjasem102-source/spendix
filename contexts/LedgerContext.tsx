"use client";

import {
  createContext, useContext, useState,
  useEffect, useCallback, useMemo,
} from "react";
import { UnifiedLedgerEntry, CashflowSummary, LedgerFilters } from "@/lib/ledger/types";
import {
  calculateBalance, getCashflowSummary,
  filterLedger, sortByDate,
} from "@/lib/ledger/engine";
import { buildInitialLedger } from "@/lib/ledger/sync";
import { mockTransactions, mockInvestments, mockDebts } from "@/lib/mock-data";
import { on } from "@/lib/events";

const STORAGE_KEY = "spendix_ledger_additions";

interface LedgerContextType {
  entries: UnifiedLedgerEntry[];
  balance: number;
  cashflow: CashflowSummary;
  addEntry: (entry: UnifiedLedgerEntry) => void;
  getFiltered: (filters: LedgerFilters) => UnifiedLedgerEntry[];
}

const defaultCashflow: CashflowSummary = {
  totalInflow: 0, totalOutflow: 0, netBalance: 0, byType: {},
};

const LedgerContext = createContext<LedgerContextType>({
  entries: [],
  balance: 0,
  cashflow: defaultCashflow,
  addEntry: () => {},
  getFiltered: () => [],
});

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  // Base entries built from mock data (never changes)
  const baseEntries = useMemo(
    () => sortByDate(buildInitialLedger(mockTransactions, mockInvestments, mockDebts)),
    []
  );

  // Runtime additions (from FAB adds or events)
  const [additions, setAdditions] = useState<UnifiedLedgerEntry[]>([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setAdditions(JSON.parse(stored) as UnifiedLedgerEntry[]);
    } catch {}
  }, []);

  useEffect(() => {
    return on("spendix:ledger-entry-added", (entry) => {
      if (!entry?.id) return;
      setAdditions((prev) => {
        if (prev.some((p) => p.id === entry.id)) return prev;
        const updated = [entry, ...prev];
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
    });
  }, []);

  const addEntry = useCallback((entry: UnifiedLedgerEntry) => {
    setAdditions((prev) => {
      if (prev.some((p) => p.id === entry.id)) return prev;
      const updated = [entry, ...prev];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const entries = useMemo(
    () => sortByDate([...additions, ...baseEntries]),
    [baseEntries, additions]
  );

  const balance  = useMemo(() => calculateBalance(entries),    [entries]);
  const cashflow = useMemo(() => getCashflowSummary(entries),  [entries]);

  const getFiltered = useCallback(
    (filters: LedgerFilters) => filterLedger(entries, filters),
    [entries]
  );

  return (
    <LedgerContext.Provider value={{ entries, balance, cashflow, addEntry, getFiltered }}>
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger() {
  return useContext(LedgerContext);
}
