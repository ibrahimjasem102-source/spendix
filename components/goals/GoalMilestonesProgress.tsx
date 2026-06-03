"use client";

import { motion } from "framer-motion";
import type { GoalMilestone } from "@/types";

type Variant = "compact" | "regular";

interface Props {
  milestones?: GoalMilestone[];
  targetAmount: number;
  currentAmount?: number;
  progress?: number;
  color?: string | null;
  isRtl?: boolean;
  format?: (amount: number) => string;
  className?: string;
  variant?: Variant;
  showAmounts?: boolean;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export default function GoalMilestonesProgress({
  milestones,
  targetAmount,
  currentAmount,
  progress,
  color,
  isRtl = false,
  format,
  className = "",
  variant = "regular",
  showAmounts = false,
}: Props) {
  const accent = color ?? "#F59E0B";
  const pct = clamp(progress ?? (targetAmount > 0 ? ((currentAmount ?? 0) / targetAmount) * 100 : 0));
  const sorted = [...(milestones ?? [])].sort((a, b) => a.amount - b.amount);
  const reached = sorted.filter((item) => item.reached).length;
  const next = sorted.find((item) => !item.reached);
  const hasMilestones = sorted.length > 0 && targetAmount > 0;
  const barHeight = variant === "compact" ? "h-2" : "h-2.5";
  const markerSize = variant === "compact" ? "h-3 w-3" : "h-4 w-4";
  const markerInner = variant === "compact" ? "h-1.5 w-1.5" : "h-2 w-2";
  const gradient = `linear-gradient(${isRtl ? 270 : 90}deg, ${accent}88, ${accent})`;

  return (
    <div className={className}>
      <div className={`relative ${hasMilestones ? "py-1.5" : ""}`}>
        <div className={`${barHeight} relative overflow-hidden rounded-full bg-[hsl(var(--bg-input))]`}>
          <motion.div
            className={`absolute inset-y-0 rounded-full ${isRtl ? "right-0" : "left-0"}`}
            style={{ background: gradient }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          />
        </div>

        {hasMilestones && sorted.map((item) => {
          const pos = clamp((item.amount / targetAmount) * 100, 3, 97);
          const reachedItem = item.reached || (currentAmount ?? 0) >= item.amount;
          return (
            <span
              key={item.id}
              className={`absolute top-1/2 ${markerSize} -translate-y-1/2 rounded-full border shadow-sm`}
              style={{
                [isRtl ? "right" : "left"]: `${pos}%`,
                transform: isRtl ? "translate(50%, -50%)" : "translate(-50%, -50%)",
                backgroundColor: reachedItem ? accent : "hsl(var(--bg-card))",
                borderColor: reachedItem ? accent : "hsl(var(--border))",
                boxShadow: reachedItem ? `0 0 0 3px ${accent}18` : "none",
              }}
              title={item.label}
            >
              <span className={`absolute left-1/2 top-1/2 ${markerInner} -translate-x-1/2 -translate-y-1/2 rounded-full ${reachedItem ? "bg-white" : "bg-[hsl(var(--border))]"}`} />
            </span>
          );
        })}
      </div>

      {hasMilestones && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[10px] font-medium t3">
            {next ? next.label : sorted[sorted.length - 1]?.label}
          </p>
          <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums" style={{ backgroundColor: `${accent}14`, color: accent }}>
            {reached}/{sorted.length}
          </span>
        </div>
      )}

      {hasMilestones && variant === "regular" && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {sorted.map((item, index) => {
            const reachedItem = item.reached || (currentAmount ?? 0) >= item.amount;
            return (
              <div
                key={item.id}
                className="flex min-w-fit items-center gap-1.5 rounded-lg border px-2 py-1"
                style={{
                  borderColor: reachedItem ? `${accent}35` : "hsl(var(--border))",
                  backgroundColor: reachedItem ? `${accent}0F` : "hsl(var(--bg-input))",
                }}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black" style={{ backgroundColor: `${accent}18`, color: accent }}>
                  {index + 1}
                </span>
                <span className={`max-w-[110px] truncate text-[10px] font-bold ${reachedItem ? "" : "t3"}`} style={reachedItem ? { color: accent } : undefined}>
                  {item.label || format?.(item.amount) || item.amount}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showAmounts && (
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="text-[10px] t3 tabular-nums">{format?.(currentAmount ?? 0) ?? currentAmount ?? 0}</span>
          <span className="text-[10px] t3 tabular-nums">{format?.(targetAmount) ?? targetAmount}</span>
        </div>
      )}
    </div>
  );
}
