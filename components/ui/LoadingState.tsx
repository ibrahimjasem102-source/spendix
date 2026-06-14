"use client";

import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoadingStateProps {
  text?:      string;
  rows?:      number;
  compact?:   boolean;
  className?: string;
}

// ── Skeleton primitives ───────────────────────────────────────────────────────

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg skeleton",
        className,
      )}
    />
  );
}

// ── List skeleton — icon + 2 lines + trailing value ───────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <Bone className="h-10 w-10 rounded-xl shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1">
        <Bone className="h-3.5 w-2/5" />
        <Bone className="h-2.5 w-1/3" />
      </div>
      <Bone className="h-4 w-14 shrink-0" />
    </div>
  );
}

// ── Card skeleton — compact tile shape ────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="card p-4 animate-pulse space-y-3">
      <div className="flex items-center gap-2">
        <Bone className="h-8 w-8 rounded-xl shrink-0" />
        <Bone className="h-3.5 flex-1" />
      </div>
      <Bone className="h-6 w-1/2" />
      <Bone className="h-2.5 w-4/5" />
    </div>
  );
}

// ── Stats skeleton — 2-col metric tiles ──────────────────────────────────────

function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi-card space-y-2">
          <Bone className="h-2.5 w-3/5" />
          <Bone className="h-5 w-2/3" />
          <Bone className="h-2 w-2/5" />
        </div>
      ))}
    </div>
  );
}

// ── Page skeleton — header + stats + list ────────────────────────────────────

function SkeletonPage() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Bone className="h-5 w-36" />
          <Bone className="h-3 w-24" />
        </div>
        <Bone className="h-9 w-24 rounded-xl" />
      </div>

      {/* KPI row */}
      <SkeletonStats count={4} />

      {/* List */}
      <div className="card p-4 space-y-4">
        {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
      </div>
    </div>
  );
}

// ── LoadingState — row-based list skeleton ────────────────────────────────────

export function LoadingState({ text, rows = 3, compact = false, className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        compact ? "py-4" : "py-8 px-4",
        className,
      )}
      aria-busy="true"
      aria-label={text ?? "Loading"}
      role="status"
    >
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
      {text && (
        <p className="text-center text-xs t3 mt-2">{text}</p>
      )}
    </div>
  );
}

// ── LoadingSpinner ────────────────────────────────────────────────────────────

export function LoadingSpinner({
  size  = 20,
  className,
}: {
  size?:      number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)} role="status" aria-label="Loading">
      <svg
        className="animate-spin text-[hsl(var(--accent-cyan))]"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12" cy="12" r="10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="47"
          strokeDashoffset="12"
        />
      </svg>
    </div>
  );
}

// Named exports for specific use cases
export { SkeletonRow, SkeletonCard, SkeletonStats, SkeletonPage };
