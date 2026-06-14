"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Crown, Zap, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePlan } from "@/contexts/PlanContext";
import { PLAN_MAP, type PlanId } from "@/lib/plans";
import { getAuthToken } from "@/lib/auth/token-store";

const PLAN_ICONS: Record<PlanId, React.ElementType> = {
  free:  Sparkles,
  plus:  Zap,
  pro:   Crown,
  elite: Shield,
};

interface Props {
  requiredPlan: PlanId;
  featureNameKey?: string;
  featureName?: string;
  onClose: () => void;
}

export default function UpgradePrompt({ requiredPlan, featureName, onClose }: Props) {
  const router = useRouter();
  const { plan: currentPlan } = usePlan();
  const [loading, setLoading] = useState(false);

  const meta = PLAN_MAP[requiredPlan];
  const Icon = PLAN_ICONS[requiredPlan];

  async function handleUpgrade() {
    setLoading(true);
    try {
      const token = getAuthToken();
      if (!token) { router.push("/login"); return; }
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: requiredPlan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-6"
        style={{ backgroundColor: "rgba(11,15,20,0.80)", backdropFilter: "blur(6px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 38 }}
          className="w-full sm:max-w-md rounded-t-[1.75rem] sm:rounded-[1.5rem] overflow-hidden"
          style={{ background: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))" }}
        >
          {/* Gradient header */}
          <div
            className={`bg-gradient-to-br ${meta.colorClass} p-6 text-white`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                <Icon className="h-6 w-6" />
              </div>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <h2 className="text-xl font-black">ØªØ±Ù‚ÙŠØ© Ù…Ø·Ù„ÙˆØ¨Ø©</h2>
            {featureName && (
              <p className="mt-1 text-sm text-white/75">
                {featureName} Ù…ØªØ§Ø­ ÙÙŠ Ø®Ø·Ø© {requiredPlan === "plus" ? "Plus" : requiredPlan === "pro" ? "Pro" : "Elite"} ÙÙ‚Ø·
              </p>
            )}
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-[hsl(var(--border))] p-4">
              <p className="text-sm font-bold t1 mb-1">{requiredPlan === "plus" ? "Spendix Plus" : requiredPlan === "pro" ? "Spendix Pro" : "Spendix Elite"}</p>
              <p className="text-2xl font-black t1">${meta.price}<span className="text-sm font-normal t3">/Ø´Ù‡Ø±</span></p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-[hsl(var(--border))] py-2.5 text-sm font-semibold t2"
              >
                Ù„Ø§Ø­Ù‚Ø§Ù‹
              </button>
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white bg-gradient-to-r ${meta.colorClass} disabled:opacity-60`}
              >
                {loading ? "Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù…ÙŠÙ„..." : "ØªØ±Ù‚ÙŠØ© Ø§Ù„Ø¢Ù†"}
              </button>
            </div>

            <button
              onClick={() => { onClose(); router.push("/plans"); }}
              className="w-full text-center text-xs t3 hover:t1 transition-colors"
            >
              Ø¹Ø±Ø¶ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø®Ø·Ø·
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

