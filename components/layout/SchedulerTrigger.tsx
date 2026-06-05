"use client";

import { useEffect, useRef } from "react";
import { safeFetch } from "@/lib/fetch-safe";
import { useGuest } from "@/contexts/GuestContext";
import { runGoalChecker } from "@/lib/notifications/goal-checker";

const SCHEDULER_KEY    = "spendix_scheduler_ts";
const SCHEDULER_INTERVAL = 60 * 60 * 1000; // once per hour max

/** Silently triggers the smart notification scheduler — at most once per hour */
export default function SchedulerTrigger() {
  const { isGuest } = useGuest();
  const didRun = useRef(false);

  useEffect(() => {
    if (isGuest) return;
    if (didRun.current) return; // already ran in this React lifecycle

    // Throttle: don't run if it ran less than 1 hour ago
    try {
      const last = Number(localStorage.getItem(SCHEDULER_KEY) ?? "0");
      if (Date.now() - last < SCHEDULER_INTERVAL) return;
    } catch {}

    didRun.current = true;
    try { localStorage.setItem(SCHEDULER_KEY, String(Date.now())); } catch {}

    // Server-side scheduler (debts, analytics, investments, work)
    void safeFetch("/api/notifications/schedule", { method: "POST" }).catch(() => {});

    // Subscription + recurring processor
    void safeFetch("/api/subscriptions/process", { method: "POST" }).catch(() => {});
    void safeFetch("/api/recurring/process",     { method: "POST" }).catch(() => {});

    // Client-side goal checker
    void runGoalChecker();

    // Seed default categories if user has none
    void safeFetch("/api/categories/seed", { method: "POST" }).catch(() => {});
  }, [isGuest]);

  return null;
}
