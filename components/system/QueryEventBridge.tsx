"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { on } from "@/lib/events";
import {
  invalidateDebtQueries,
  invalidateFinancialQueries,
  invalidateInvestmentQueries,
  invalidateWorkQueries,
} from "@/lib/query/invalidation";

export default function QueryEventBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refreshFinancial  = () => invalidateFinancialQueries(queryClient);
    const refreshDebt       = () => invalidateDebtQueries(queryClient);
    const refreshInvestment = () => invalidateInvestmentQueries(queryClient);
    const refreshWork       = () => invalidateWorkQueries(queryClient);

    const cleanups = [
      on("spendix:transaction-added",   refreshFinancial),
      on("spendix:transaction-deleted", refreshFinancial),
      on("spendix:debt-changed",        refreshDebt),
      on("spendix:investment-changed",  refreshInvestment),
      on("spendix:work-changed",        refreshWork),
    ];

    return () => cleanups.forEach((off) => off());
  }, [queryClient]);

  return null;
}
