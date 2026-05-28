"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { invalidateForRealtimeTable } from "@/lib/query/invalidation";

type TableName = "transactions" | "budgets" | "debts" | "debt_payments" | "investments" | "notifications" | "work_sessions" | "work_payments" | "financial_contacts";

const TABLES: TableName[] = [
  "transactions",
  "budgets",
  "debts",
  "debt_payments",
  "investments",
  "notifications",
  "work_sessions",
  "work_payments",
  "financial_contacts",
];

export function createRealtimeManager(queryClient: QueryClient) {
  const supabase = createClient();
  let channel: RealtimeChannel | null = null;
  let currentUserId: string | null = null;

  return {
    start(userId: string) {
      if (channel && currentUserId === userId) return;
      this.stop();
      currentUserId = userId;
      channel = supabase.channel(`spendix-realtime:${userId}`);

      TABLES.forEach((table) => {
        channel?.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
          () => invalidateForRealtimeTable(queryClient, table)
        );
      });

      channel.subscribe();
    },
    stop() {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
      currentUserId = null;
    },
  };
}
