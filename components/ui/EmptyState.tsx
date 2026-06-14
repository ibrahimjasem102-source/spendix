"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmptyStateAction {
  label:    string;
  onClick?: () => void;
  href?:    string;
  variant?: "primary" | "ghost";
}

export interface EmptyStateProps {
  icon:              React.ElementType;
  title:             string;
  body?:             string;
  action?:           EmptyStateAction;
  secondaryAction?:  EmptyStateAction;
  iconColor?:        string;
  iconBg?:           string;
  compact?:          boolean;
  className?:        string;
}

// ── Sub-component: action button ──────────────────────────────────────────────

function ActionButton({ action }: { action: EmptyStateAction }) {
  const isPrimary = (action.variant ?? "primary") === "primary";
  const cls       = isPrimary
    ? "btn-primary px-5 py-2.5 text-sm rounded-xl font-semibold"
    : "btn-ghost   px-5 py-2.5 text-sm rounded-xl font-semibold border border-[hsl(var(--border))]";

  if (action.href) {
    return <Link href={action.href} className={cls}>{action.label}</Link>;
  }
  return (
    <button type="button" onClick={action.onClick} className={cls}>
      {action.label}
    </button>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

export function EmptyState({
  icon:      Icon,
  title,
  body,
  action,
  secondaryAction,
  iconColor = "text-[hsl(var(--accent-cyan))]",
  iconBg    = "bg-[hsl(var(--accent-cyan)/0.1)]",
  compact   = false,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        "empty-state flex flex-col items-center gap-4",
        compact ? "py-8 px-4" : "py-16 px-6",
        className,
      )}
    >
      {/* Icon bubble */}
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
        className={cn(
          "flex items-center justify-center rounded-2xl",
          iconBg,
          iconColor,
          compact ? "h-12 w-12" : "h-16 w-16",
        )}
      >
        <Icon
          className={cn(compact ? "h-5 w-5" : "h-7 w-7")}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </motion.span>

      {/* Text */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className={cn("font-semibold t1", compact ? "text-sm" : "text-base")}>
          {title}
        </p>
        {body && (
          <p className="text-xs t3 max-w-[280px] leading-relaxed">
            {body}
          </p>
        )}
      </div>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-2 mt-1">
          {action          && <ActionButton action={action} />}
          {secondaryAction && <ActionButton action={{ ...secondaryAction, variant: secondaryAction.variant ?? "ghost" }} />}
        </div>
      )}
    </motion.div>
  );
}
