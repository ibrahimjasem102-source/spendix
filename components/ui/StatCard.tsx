"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label:      string;
  value:      string;
  icon:       React.ElementType;
  iconColor:  string;
  iconBg:     string;
  sub?:       string;
  trend?:     number;
  href?:      string;
  className?: string;
  loading?:   boolean;
}

function TrendBadge({ trend }: { trend: number }) {
  if (trend === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-[hsl(var(--text-3))]">
        <Minus className="h-3 w-3" />0%
      </span>
    );
  }
  const up  = trend > 0;
  const pct = Math.abs(trend).toFixed(1);
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[10px] font-medium",
        up ? "text-emerald-400" : "text-red-400",
      )}
    >
      {up ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {pct}%
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  sub,
  trend,
  href,
  className,
  loading = false,
}: StatCardProps) {
  const inner = (
    <div className="flex flex-col gap-3">
      {/* Icon */}
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[10px]",
          iconBg,
        )}
      >
        <Icon className={cn("h-4.5 w-4.5", iconColor)} strokeWidth={2} style={{ width: 18, height: 18 }} />
      </div>

      {/* Value */}
      {loading ? (
        <div className="flex flex-col gap-1.5 animate-pulse">
          <div className="h-5 w-20 rounded bg-[hsl(var(--bg-3))]" />
          <div className="h-2.5 w-14 rounded bg-[hsl(var(--bg-3))]" />
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <p className="text-base font-bold tracking-tight text-[hsl(var(--text-1))] tabular-nums">
            {value}
          </p>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-[hsl(var(--text-3))]">{label}</p>
            {trend !== undefined && <TrendBadge trend={trend} />}
          </div>
          {sub && (
            <p className="text-[10px] text-[hsl(var(--text-3))] mt-0.5">{sub}</p>
          )}
        </div>
      )}
    </div>
  );

  const base = cn("card p-4 flex-1 min-w-0", href && "cursor-pointer", className);

  if (href) {
    return (
      <motion.div whileTap={{ scale: 0.97 }} transition={{ type: "tween", duration: 0.1 }}>
        <Link href={href} className={cn(base, "block no-underline")}>
          {inner}
        </Link>
      </motion.div>
    );
  }

  return <div className={base}>{inner}</div>;
}
