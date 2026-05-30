"use client";

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

type FinancialDomain =
  | "transactions"
  | "dashboard"
  | "analytics"
  | "budgets"
  | "debts"
  | "investments"
  | "work"
  | "notifications"
  | "contacts"
  | "accounts"
  | "subscriptions";

export function invalidateDomains(queryClient: QueryClient, domains: FinancialDomain[]) {
  domains.forEach((domain) => {
    // refetchType: "all" ensures background refetch even when the page is unmounted,
    // so navigating back always shows fresh data.
    switch (domain) {
      case "transactions":
        void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all, refetchType: "all" });
        break;
      case "dashboard":
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all, refetchType: "all" });
        break;
      case "analytics":
        void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all, refetchType: "all" });
        break;
      case "budgets":
        void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all, refetchType: "all" });
        break;
      case "debts":
        void queryClient.invalidateQueries({ queryKey: queryKeys.debts.all, refetchType: "all" });
        break;
      case "investments":
        void queryClient.invalidateQueries({ queryKey: queryKeys.investments.all, refetchType: "all" });
        break;
      case "work":
        void queryClient.invalidateQueries({ queryKey: queryKeys.work.all, refetchType: "all" });
        break;
      case "notifications":
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all, refetchType: "all" });
        break;
      case "contacts":
        void queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all, refetchType: "all" });
        break;
      case "accounts":
        void queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all, refetchType: "all" });
        break;
      case "subscriptions":
        void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all, refetchType: "all" });
        break;
    }
  });
}

export function invalidateFinancialQueries(queryClient: QueryClient) {
  invalidateDomains(queryClient, ["transactions", "dashboard", "analytics", "budgets"]);
}

export function invalidateDebtQueries(queryClient: QueryClient) {
  invalidateDomains(queryClient, ["debts", "transactions", "dashboard", "analytics", "budgets", "contacts"]);
}

export function invalidateInvestmentQueries(queryClient: QueryClient) {
  invalidateDomains(queryClient, ["investments", "transactions", "dashboard", "analytics", "budgets"]);
}

export function invalidateWorkQueries(queryClient: QueryClient) {
  invalidateDomains(queryClient, ["work", "transactions", "dashboard", "analytics", "budgets"]);
}

export function invalidateForRealtimeTable(queryClient: QueryClient, table: string) {
  if (table === "notifications") {
    invalidateDomains(queryClient, ["notifications"]);
    return;
  }

  if (table === "debts" || table === "debt_payments") {
    invalidateDebtQueries(queryClient);
    return;
  }

  if (table === "investments") {
    invalidateInvestmentQueries(queryClient);
    return;
  }

  if (table === "work_sessions" || table === "work_payments") {
    invalidateWorkQueries(queryClient);
    return;
  }

  if (table === "financial_contacts") {
    invalidateDomains(queryClient, ["contacts", "debts", "dashboard", "analytics"]);
    return;
  }

  invalidateFinancialQueries(queryClient);
}
