"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize    = "xs" | "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:      ButtonVariant;
  size?:         ButtonSize;
  loading?:      boolean;
  icon?:         React.ElementType;
  iconPosition?: "start" | "end";
  iconOnly?:     boolean;
  fullWidth?:    boolean;
}

// ── Style maps ────────────────────────────────────────────────────────────────

const variantClasses: Record<ButtonVariant, string> = {
  primary:  "btn-primary",
  secondary:"btn-ghost border border-[hsl(var(--border))]",
  ghost:    "btn-ghost",
  danger:   "btn-danger",
  outline:  [
    "inline-flex items-center gap-2 font-semibold transition-all",
    "rounded-xl border border-[hsl(var(--border))]",
    "text-[hsl(var(--text-2))] bg-transparent",
    "hover:border-[hsl(var(--accent-cyan)/0.4)] hover:text-[hsl(var(--accent-cyan))]",
    "active:scale-[0.97]",
  ].join(" "),
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "h-7  px-2.5 text-[11px] rounded-lg  gap-1",
  sm: "h-8  px-3   text-xs     rounded-lg  gap-1.5",
  md: "h-10 px-4   text-sm     rounded-xl  gap-2",
  lg: "h-11 px-5   text-sm     rounded-xl  gap-2",
};

const iconSizeClasses: Record<ButtonSize, string> = {
  xs: "h-3   w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4   w-4",
  lg: "h-4   w-4",
};

const iconOnlyClasses: Record<ButtonSize, string> = {
  xs: "h-7  w-7  px-0 rounded-lg",
  sm: "h-8  w-8  px-0 rounded-lg",
  md: "h-10 w-10 px-0 rounded-xl",
  lg: "h-11 w-11 px-0 rounded-xl",
};

// ── Component ─────────────────────────────────────────────────────────────────

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant      = "primary",
      size         = "md",
      loading      = false,
      icon: Icon,
      iconPosition = "start",
      iconOnly     = false,
      fullWidth    = false,
      children,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: isDisabled ? 1 : 0.96 }}
        transition={{ type: "tween", duration: 0.1 }}
        {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
        disabled={isDisabled}
        className={cn(
          "relative inline-flex items-center justify-center font-semibold select-none transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-cyan)/0.5)] focus-visible:ring-offset-1",
          variantClasses[variant],
          iconOnly ? iconOnlyClasses[size] : sizeClasses[size],
          fullWidth && "w-full",
          isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className,
        )}
        aria-disabled={isDisabled}
        aria-busy={loading}
      >
        {loading && (
          <Loader2 className="absolute h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        <span
          className={cn(
            "inline-flex items-center",
            iconOnly ? "gap-0" : sizeClasses[size].split(" ").find(c => c.startsWith("gap-")),
            loading && "invisible",
          )}
        >
          {Icon && iconPosition === "start" && !iconOnly && (
            <Icon className={cn("shrink-0", iconSizeClasses[size])} aria-hidden="true" />
          )}
          {iconOnly && Icon && (
            <Icon className={cn("shrink-0", iconSizeClasses[size])} aria-hidden="true" />
          )}
          {!iconOnly && children}
          {Icon && iconPosition === "end" && !iconOnly && (
            <Icon className={cn("shrink-0", iconSizeClasses[size])} aria-hidden="true" />
          )}
        </span>
      </motion.button>
    );
  },
);
Button.displayName = "Button";

export { Button };
