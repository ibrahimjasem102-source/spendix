"use client";

import { X, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface FormShellProps {
  title:        string;
  onClose:      () => void;
  onSubmit:     (e?: React.FormEvent) => void;
  submitLabel?: string;
  loading?:     boolean;
  error?:       string | null;
  children:     React.ReactNode;
  /** "back" shows a chevron, "close" shows an X */
  closeStyle?:  "back" | "close";
  className?:   string;
}

export function FormShell({
  title,
  onClose,
  onSubmit,
  submitLabel = "Save",
  loading     = false,
  error,
  children,
  closeStyle  = "close",
  className,
}: FormShellProps) {
  const CloseIcon = closeStyle === "back" ? ChevronLeft : X;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(e);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
      className={cn("flex flex-col h-full bg-[hsl(var(--bg-1))]", className)}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0 border-b border-[hsl(var(--border))]">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--bg-3))] text-[hsl(var(--text-2))] hover:text-[hsl(var(--text-1))] transition-colors"
          aria-label="Close"
        >
          <CloseIcon className={cn("h-4 w-4", closeStyle === "back" && "-ms-0.5")} />
        </button>

        <h1 className="flex-1 text-base font-semibold text-[hsl(var(--text-1))] truncate">
          {title}
        </h1>
      </header>

      {/* ── Body ───────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col flex-1 min-h-0"
        noValidate
      >
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 flex flex-col gap-4">
          {children}
        </div>

        {/* ── Sticky action bar ─────────────────────────── */}
        <div
          className="shrink-0 px-4 pt-3 pb-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--bg-1))] flex flex-col gap-2"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
        >
          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-ghost flex-1 py-3 rounded-xl text-sm font-semibold border border-[hsl(var(--border))]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-[2] py-3 rounded-xl text-sm font-semibold"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                      strokeLinecap="round" strokeDasharray="47" strokeDashoffset="12" />
                  </svg>
                  Saving…
                </span>
              ) : submitLabel}
            </button>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
