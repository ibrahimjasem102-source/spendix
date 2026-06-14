"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CardVariant = "default" | "elevated" | "glass" | "flat" | "outlined";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:   CardVariant;
  padding?:   CardPadding;
  clickable?: boolean;
}

// ── Style maps ────────────────────────────────────────────────────────────────

const variantClasses: Record<CardVariant, string> = {
  default:  "card",
  elevated: "card-elevated",
  glass:    "modern-surface",
  flat:     "rounded-2xl bg-[hsl(var(--bg-card-2))]",
  outlined: "rounded-2xl border border-[hsl(var(--border))] bg-transparent",
};

const paddingClasses: Record<CardPadding, string> = {
  none: "",
  sm:   "p-3",
  md:   "p-4",
  lg:   "p-5",
};

// ── Card ──────────────────────────────────────────────────────────────────────

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padding = "md", clickable = false, className, children, onClick, ...props }, ref) => {
    const cls = cn(
      variantClasses[variant],
      paddingClasses[padding],
      clickable && "cursor-pointer",
      className,
    );

    if (clickable) {
      return (
        <motion.div
          ref={ref}
          whileTap={{ scale: 0.985 }}
          transition={{ type: "tween", duration: 0.1 }}
          className={cls}
          onClick={onClick}
          {...(props as React.ComponentPropsWithoutRef<typeof motion.div>)}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={cls} onClick={onClick} {...props}>
        {children}
      </div>
    );
  },
);
Card.displayName = "Card";

// ── Card sub-components ───────────────────────────────────────────────────────

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title:       string;
  subtitle?:   string;
  icon?:       React.ElementType;
  iconColor?:  string;
  iconBg?:     string;
  action?:     React.ReactNode;
}

function CardHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-[hsl(var(--accent-cyan))]",
  iconBg    = "bg-[hsl(var(--accent-cyan)/0.1)]",
  action,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn("flex items-start justify-between gap-3 mb-4", className)}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconBg, iconColor)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold t1 truncate">{title}</p>
          {subtitle && <p className="text-xs t3 truncate mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {children}
    </div>
  );
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

function CardFooter({ bordered = true, className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 mt-4",
        bordered && "pt-4 border-t border-[hsl(var(--border-2))]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function CardDivider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-[hsl(var(--border-2))] -mx-4 sm:-mx-5 my-3", className)} />;
}

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label:      string;
  value:      string | number;
  sub?:       string;
  valueColor?: string;
}

function KpiCard({ label, value, sub, valueColor = "t1", className, ...props }: KpiCardProps) {
  return (
    <div className={cn("kpi-card", className)} {...props}>
      <p className="kpi-label">{label}</p>
      <p className={cn("kpi-value number-display", valueColor)}>{value}</p>
      {sub && <p className="text-[10px] t3 mt-1">{sub}</p>}
    </div>
  );
}

export { Card, CardHeader, CardBody, CardFooter, CardDivider, KpiCard };
export type { CardHeaderProps, KpiCardProps };
