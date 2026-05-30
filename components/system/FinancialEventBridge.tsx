"use client";

/**
 * FinancialEventBridge
 *
 * Mounted once at the app layout level — renders nothing.
 * Subscribes to financialBus events emitted by any mutation in any section
 * and triggers the correct cross-module React Query invalidations.
 *
 * Event flow:
 *   mutation (hooks.ts)
 *     → financialBus.emit("transaction:added", {...})
 *     → FinancialEventBridge listener fires
 *     → invalidateDomains(qc, ["dashboard", "analytics", "budgets"])
 *     → all affected sections refetch automatically
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { financialBus } from "@/lib/finance/eventBus";
import { invalidateDomains } from "@/lib/query/invalidation";

type Domain = Parameters<typeof invalidateDomains>[1][number];

// Maps each event to the list of domains that should be invalidated.
// Hooks already invalidate their own primary query — bridge handles cross-module.
const EVENT_DOMAINS: Record<string, Domain[]> = {
  "transaction:added":     ["dashboard", "analytics", "budgets"],
  "transaction:updated":   ["dashboard", "analytics", "budgets"],
  "transaction:deleted":   ["dashboard", "analytics", "budgets"],
  "debt:created":          ["debts", "transactions", "dashboard", "analytics"],
  "debt:updated":          ["debts", "dashboard", "analytics"],
  "debt:deleted":          ["debts", "dashboard", "analytics"],
  "debt:payment_recorded": ["debts", "transactions", "dashboard", "analytics", "budgets", "contacts"],
  "investment:added":      ["investments", "dashboard", "analytics"],
  "investment:updated":    ["investments", "dashboard", "analytics"],
  "investment:deleted":    ["investments", "dashboard", "analytics"],
  "work:session_logged":   ["work", "dashboard"],
  "work:session_updated":  ["work", "dashboard"],
  "work:session_deleted":  ["work", "dashboard"],
  "work:payment_received": ["work", "transactions", "dashboard", "analytics"],
  "work:payment_deleted":  ["work", "transactions", "dashboard", "analytics"],
  "account:created":        ["accounts"],
  "account:updated":        ["accounts"],
  "account:deleted":        ["accounts", "transactions"],
  "bill:created":           ["bills"],
  "bill:updated":           ["bills"],
  "bill:deleted":           ["bills"],
  "bill:paid":              ["bills", "transactions", "dashboard", "analytics", "budgets"],
  "subscription:created":   ["subscriptions"],
  "subscription:updated":   ["subscriptions"],
  "subscription:deleted":   ["subscriptions"],
  "subscription:charged":   ["subscriptions", "transactions", "dashboard", "analytics", "budgets"],
};

export function FinancialEventBridge() {
  const qc = useQueryClient();

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // Wire each event type to its cross-module invalidation
    for (const [event, domains] of Object.entries(EVENT_DOMAINS)) {
      const unsub = financialBus.on(
        event as keyof typeof EVENT_DOMAINS,
        () => invalidateDomains(qc, domains),
      );
      unsubs.push(unsub);
    }

    // Secondary event: investment profit signal
    unsubs.push(
      financialBus.on("investment:updated", ({ previousValue, currentValue, id }) => {
        if (currentValue > previousValue) {
          financialBus.emit("investment:profit", { id, gain: currentValue - previousValue });
        }
      }),
    );

    return () => { unsubs.forEach((u) => u()); };
  }, [qc]);

  return null;
}
