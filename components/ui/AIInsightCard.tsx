"use client";

import { motion } from "framer-motion";
import { fadeIn, spring } from "@/lib/motion";
import { ArrowUpRight, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightLevel = "positive" | "warning" | "info" | "critical";

export interface FinancialInsight {
  id: string;
  title: string;
  body: string;
  level: InsightLevel;
  actionLabel?: string;
  actionHref?: string;
  confidence?: number;   // 0–1
}

const LEVEL_CONFIG: Record<InsightLevel, {
  icon: React.ElementType;
  iconColor: string;
  bg: string;
  border: string;
  badge: string;
  badgeText: string;
}> = {
  positive: {
    icon: TrendingUp,
    iconColor: "text-emerald-400",
    bg: "bg-emerald-400/5",
    border: "border-emerald-400/15",
    badge: "bg-emerald-400/10 text-emerald-400",
    badgeText: "Positive",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    bg: "bg-amber-400/5",
    border: "border-amber-400/15",
    badge: "bg-amber-400/10 text-amber-400",
    badgeText: "Watch",
  },
  critical: {
    icon: TrendingDown,
    iconColor: "text-rose-400",
    bg: "bg-rose-400/5",
    border: "border-rose-400/15",
    badge: "bg-rose-400/10 text-rose-400",
    badgeText: "Urgent",
  },
  info: {
    icon: Info,
    iconColor: "text-cyan-400",
    bg: "bg-cyan-400/5",
    border: "border-cyan-400/15",
    badge: "bg-cyan-400/10 text-cyan-400",
    badgeText: "Insight",
  },
};

interface Props {
  insight: FinancialInsight;
  delay?: number;
}

export default function AIInsightCard({ insight, delay = 0 }: Props) {
  const cfg = LEVEL_CONFIG[insight.level];
  const Icon = cfg.icon;

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      transition={{ ...spring, delay }}
      className={cn(
        "rounded-2xl p-4 border",
        cfg.bg, cfg.border
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="p-2 rounded-xl bg-[hsl(var(--bg-input))] shrink-0 mt-0.5">
          <Icon className={cn("w-4 h-4", cfg.iconColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold t1">{insight.title}</p>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide", cfg.badge)}>
              {cfg.badgeText}
            </span>
          </div>
          <p className="text-xs t2 leading-relaxed">{insight.body}</p>

          {/* Confidence bar */}
          {insight.confidence !== undefined && (
            <div className="flex items-center gap-2 mt-2.5">
              <div className="flex-1 h-0.5 bg-[hsl(var(--border-2))] rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", cfg.iconColor.replace("text-", "bg-"))}
                  initial={{ width: 0 }}
                  animate={{ width: `${insight.confidence * 100}%` }}
                  transition={{ ...spring, delay: delay + 0.2, duration: 0.6 }}
                  style={{ opacity: 0.6 }}
                />
              </div>
              <span className="text-[10px] t3 shrink-0">
                {Math.round(insight.confidence * 100)}% confidence
              </span>
            </div>
          )}

          {/* Action */}
          {insight.actionLabel && insight.actionHref && (
            <a href={insight.actionHref}
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 mt-2.5 transition-colors">
              {insight.actionLabel}
              <ArrowUpRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
