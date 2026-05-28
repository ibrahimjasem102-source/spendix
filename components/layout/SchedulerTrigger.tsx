"use client";

import { useEffect } from "react";
import { safeFetch } from "@/lib/fetch-safe";
import { useGuest } from "@/contexts/GuestContext";
import { runGoalChecker } from "@/lib/notifications/goal-checker";

/** Silently triggers the smart notification scheduler once per session */
export default function SchedulerTrigger() {
  const { isGuest, isLoading } = useGuest();

  useEffect(() => {
    if (isLoading || isGuest) return;

    // Only run once per browser session
    const key = "spendix_scheduler_ran";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    // Server-side scheduler (debts, analytics, investments, work)
    void safeFetch("/api/notifications/schedule", { method: "POST" }).catch(() => {});

    // Client-side goal checker (reads localStorage goals)
    void runGoalChecker();

    // Seed default categories if user has none
    void safeFetch("/api/categories/seed", { method: "POST" }).catch(() => {});
  }, [isGuest, isLoading]);

  return null;
}
