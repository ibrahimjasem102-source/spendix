"use client";

import { motion } from "framer-motion";
import { WifiOff, LockKeyhole, AlertTriangle, ShieldX, RefreshCw, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ErrorType = "network" | "auth" | "permission" | "not_found" | "generic";

export interface ErrorStateProps {
  type?:         ErrorType;
  title?:        string;
  body?:         string;
  onRetry?:      () => void;
  retryLabel?:   string;
  onBack?:       () => void;
  backLabel?:    string;
  compact?:      boolean;
  className?:    string;
}

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS: Record<ErrorType, {
  icon:      React.ElementType;
  title:     string;
  body:      string;
  iconColor: string;
  iconBg:    string;
}> = {
  network: {
    icon:      WifiOff,
    title:     "No connection",
    body:      "Check your internet connection and try again.",
    iconColor: "text-amber-400",
    iconBg:    "bg-amber-400/10",
  },
  auth: {
    icon:      LockKeyhole,
    title:     "Session expired",
    body:      "You've been signed out. Please sign in again.",
    iconColor: "text-[hsl(var(--accent-cyan))]",
    iconBg:    "bg-[hsl(var(--accent-cyan)/0.1)]",
  },
  permission: {
    icon:      ShieldX,
    title:     "Access denied",
    body:      "You don't have permission to view this content.",
    iconColor: "text-rose-400",
    iconBg:    "bg-rose-400/10",
  },
  not_found: {
    icon:      AlertTriangle,
    title:     "Not found",
    body:      "This page or resource doesn't exist.",
    iconColor: "text-amber-400",
    iconBg:    "bg-amber-400/10",
  },
  generic: {
    icon:      AlertTriangle,
    title:     "Something went wrong",
    body:      "An unexpected error occurred. Try again.",
    iconColor: "text-rose-400",
    iconBg:    "bg-rose-400/10",
  },
};

// ── ErrorState ────────────────────────────────────────────────────────────────

export function ErrorState({
  type       = "generic",
  title,
  body,
  onRetry,
  retryLabel = "Try again",
  onBack,
  backLabel  = "Go back",
  compact    = false,
  className,
}: ErrorStateProps) {
  const preset = PRESETS[type];
  const Icon   = preset.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        "flex flex-col items-center gap-4 text-center",
        compact ? "py-8 px-4" : "py-14 px-6",
        className,
      )}
    >
      {/* Icon */}
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
        className={cn(
          "flex items-center justify-center rounded-2xl",
          preset.iconBg, preset.iconColor,
          compact ? "h-12 w-12" : "h-16 w-16",
        )}
      >
        <Icon className={cn(compact ? "h-5 w-5" : "h-7 w-7")} strokeWidth={1.8} aria-hidden="true" />
      </motion.span>

      {/* Text */}
      <div className="flex flex-col items-center gap-1">
        <p className={cn("font-semibold t1", compact ? "text-sm" : "text-base")}>
          {title ?? preset.title}
        </p>
        <p className="text-xs t3 max-w-[280px] leading-relaxed">
          {body ?? preset.body}
        </p>
      </div>

      {/* Actions */}
      {(onRetry || onBack) && (
        <div className="flex flex-col sm:flex-row items-center gap-2 mt-1">
          {onRetry && (
            <button
              onClick={onRetry}
              className="btn-ghost flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl font-semibold border border-[hsl(var(--border))]"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {retryLabel}
            </button>
          )}
          {onBack && (
            <button
              onClick={onBack}
              className="btn-ghost flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl font-semibold border border-[hsl(var(--border))]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {backLabel}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
