"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { usePlan } from "@/contexts/PlanContext";
import UpgradePrompt from "./UpgradePrompt";
import type { PlanId, PlanLimits } from "@/lib/plans";

const PLAN_ORDER: PlanId[] = ["free", "plus", "pro", "elite"];

function meetsRequirement(current: PlanId, required: PlanId): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(required);
}

interface Props {
  require: PlanId;
  feature?: keyof PlanLimits;
  featureName?: string;
  children: React.ReactNode;
  /** If true, renders children with a lock overlay instead of blocking */
  overlay?: boolean;
}

export default function PlanGate({ require: required, featureName, children, overlay }: Props) {
  const { plan, isLoading } = usePlan();
  const [showPrompt, setShowPrompt] = useState(false);

  if (isLoading) return <>{children}</>;

  const allowed = meetsRequirement(plan, required);

  if (allowed) return <>{children}</>;

  if (overlay) {
    return (
      <>
        <div className="relative cursor-pointer" onClick={() => setShowPrompt(true)}>
          <div className="pointer-events-none opacity-40 select-none">{children}</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1.5 rounded-xl bg-[hsl(var(--bg-card))]/90 px-4 py-3 backdrop-blur-sm border border-[hsl(var(--border))]">
              <Lock className="h-4 w-4 t2" />
              <p className="text-xs font-semibold t2">ترقية للوصول</p>
            </div>
          </div>
        </div>
        {showPrompt && (
          <UpgradePrompt requiredPlan={required} featureName={featureName} onClose={() => setShowPrompt(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className="flex items-center gap-2 cursor-pointer opacity-60 hover:opacity-80 transition-opacity"
        onClick={() => setShowPrompt(true)}
      >
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-medium">{featureName ?? "ترقية للوصول"}</span>
      </div>
      {showPrompt && (
        <UpgradePrompt requiredPlan={required} featureName={featureName} onClose={() => setShowPrompt(false)} />
      )}
    </>
  );
}
