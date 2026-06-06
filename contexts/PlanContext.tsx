"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getPlanLimits, type PlanId, type PlanLimits } from "@/lib/plans";
import { getAuthToken } from "@/lib/auth/token-store";

interface PlanState {
  plan: PlanId;
  limits: PlanLimits;
  isLoading: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  hasStripe: boolean;
  refetch: () => void;
  syncFromStripe: () => Promise<void>;
}

const PlanContext = createContext<PlanState>({
  plan: "free",
  limits: getPlanLimits("free"),
  isLoading: true,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  hasStripe: false,
  refetch: () => undefined,
  syncFromStripe: async () => undefined,
});

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan,               setPlan]               = useState<PlanId>("free");
  const [isLoading,          setIsLoading]          = useState(true);
  const [cancelAtPeriodEnd,  setCancelAtPeriodEnd]  = useState(false);
  const [currentPeriodEnd,   setCurrentPeriodEnd]   = useState<string | null>(null);
  const [hasStripe,          setHasStripe]          = useState(false);
  const [tick,               setTick]               = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  // Fetch plan from Supabase via our API
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setPlan("free");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch("/api/subscriptions/plan", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setPlan(data.plan ?? "free");
        setCancelAtPeriodEnd(data.cancel_at_period_end ?? false);
        setCurrentPeriodEnd(data.current_period_end ?? null);
        setHasStripe(data.hasStripe ?? false);
      })
      .catch(() => setPlan("free"))
      .finally(() => setIsLoading(false));
  }, [tick]);

  // Called after returning from Stripe Checkout — syncs subscription directly from Stripe
  const syncFromStripe = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res  = await fetch("/api/stripe/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setPlan(data.plan ?? "free");
        setCancelAtPeriodEnd(data.cancel_at_period_end ?? false);
        setCurrentPeriodEnd(data.current_period_end ?? null);
        setHasStripe(!!data.current_period_end);
      }
    } catch {
      // Non-critical — refetch from DB as fallback
      refetch();
    }
  }, [refetch]);

  return (
    <PlanContext.Provider value={{
      plan,
      limits: getPlanLimits(plan),
      isLoading,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      hasStripe,
      refetch,
      syncFromStripe,
    }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}

export function usePlanLimits() {
  const { limits } = useContext(PlanContext);
  return limits;
}
