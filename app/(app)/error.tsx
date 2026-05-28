"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Spendix]", error.message);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-rose-400/10 border border-rose-400/20">
        <AlertTriangle className="h-7 w-7 text-rose-400" />
      </div>
      <div>
        <p className="text-lg font-bold text-[hsl(var(--text-1))]">Something went wrong</p>
        <p className="mt-1 text-sm text-[hsl(var(--text-2))]">
          An unexpected error occurred. Try refreshing the page.
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-400/10 border border-rose-400/20 text-sm font-medium text-rose-300 hover:bg-rose-400/15 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}
