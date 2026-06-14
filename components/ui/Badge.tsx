"use client";

import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "income"
  | "expense"
  | "invest"
  | "debt"
  | "neutral"
  | "warning"
  | "success";

export interface BadgeProps {
  variant?:  BadgeVariant;
  children:  React.ReactNode;
  className?: string;
  dot?:      boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "badge",
  income:  "badge badge-income",
  expense: "badge badge-expense",
  invest:  "badge badge-invest",
  debt:    "badge badge-debt",
  neutral: "badge bg-[hsl(var(--bg-3))] text-[hsl(var(--text-2))]",
  warning: "badge bg-amber-500/15 text-amber-400 border border-amber-500/20",
  success: "badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
};

export function Badge({ variant = "default", children, className, dot }: BadgeProps) {
  return (
    <span className={cn(variantClasses[variant], "inline-flex items-center gap-1", className)}>
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}
