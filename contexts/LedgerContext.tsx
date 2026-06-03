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
import { useFinancialEngine } from "@/lib/finance/engine";
import { on } from "@/lib/events";

const STORAGE_KEY = "spendix_ledger_additions";

interface LedgerContextType {
  entries:    UnifiedLedgerEntry[];
  balance:    number;
  cashflow:   CashflowSummary;
  addEntry:   (entry: UnifiedLedgerEntry) => void;
  getFiltered:(filters: LedgerFilters) => UnifiedLedgerEntry[];
}

const defaultCashflow: CashflowSummary = {
  totalInflow: 0, totalOutflow: 0, netBalance: 0, byType: {},
};

const LedgerContext = createContext<LedgerContextType>({
  entries:     [],
  balance:     0,
  cashflow:    defaultCashflow,
  addEntry:    () => {},
  getFiltered: () => [],
});

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  // Real ledger data from Supabase via the financial engine
  const { ledgerEntries: realEntries } = useFinancialEngine();

  // Optimistic additions — entries added before the server refetches
  const [additions, setAdditions] = useState<UnifiedLedgerEntry[]>([]);

  // Hydrate additions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setAdditions(JSON.parse(stored) as UnifiedLedgerEntry[]);
    } catch {}
  }, []);

  // Listen for new ledger entries dispatched from other parts of the app
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

  // Remove optimistic additions once they appear in real server data
  useEffect(() => {
    if (realEntries.length === 0) return;
    const realIds = new Set(realEntries.map((e) => e.id));
    setAdditions((prev) => {
      const filtered = prev.filter((a) => !realIds.has(a.id));
      if (filtered.length === prev.length) return prev;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered)); } catch {}
      return filtered;
    });
  }, [realEntries]);

  const addEntry = useCallback((entry: UnifiedLedgerEntry) => {
    setAdditions((prev) => {
      if (prev.some((p) => p.id === entry.id)) return prev;
      const updated = [entry, ...prev];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // Merge: optimistic additions first (deduplicated against real data)
  const entries = useMemo(() => {
    const realIds = new Set(realEntries.map((e) => e.id));
    const pending = additions.filter((a) => !realIds.has(a.id));
    return sortByDate([...pending, ...realEntries]);
  }, [realEntries, additions]);

  // Balance = same logic as dashboard: only cash movements (exclude investments/subscriptions/work sessions)
  // investments are tracked separately and don't reduce your "cash on hand"
  const cashEntries = useMemo(
    () => entries.filter(
      (e) => e.type === "transaction" || e.type === "income"
          || e.type === "salary"       || e.type === "debt"
    ),
    [entries]
  );

  const balance  = useMemo(() => calculateBalance(cashEntries),   [cashEntries]);
  const cashflow = useMemo(() => getCashflowSummary(cashEntries), [cashEntries]);

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
