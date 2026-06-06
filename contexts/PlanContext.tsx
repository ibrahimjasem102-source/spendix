"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
}

const PlanContext = createContext<PlanState>({
  plan: "free",
  limits: getPlanLimits("free"),
  isLoading: true,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  hasStripe: false,
  refetch: () => undefined,
});

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<PlanId>("free");
  const [isLoading, setIsLoading] = useState(true);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [hasStripe, setHasStripe] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = () => setTick((t) => t + 1);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      // Guest → free forever
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

  return (
    <PlanContext.Provider value={{
      plan,
      limits: getPlanLimits(plan),
      isLoading,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      hasStripe,
      refetch,
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
