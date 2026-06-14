"use client";

import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  lines?: number;
  card?: boolean;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-[hsl(var(--bg-card-2))]", className)} />
  );
}

export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="card p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-16 shrink-0" />
      </div>
      {lines > 1 && (
        <div className="space-y-2 pt-1">
          {Array.from({ length: lines - 1 }).map((_, i) => (
            <Skeleton key={i} className={`h-3 ${i % 2 === 0 ? "w-full" : "w-4/5"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 animate-pulse">
      {[1,2,3,4].map((i) => (
        <div key={i} className="card p-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4, props }: { count?: number; props?: Props }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={props?.lines ?? 2} />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      {/* Banner */}
      <Skeleton className="h-28 w-full rounded-[1.75rem]" />
      {/* List */}
      <ListSkeleton count={3} />
    </div>
  );
}

