"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { spring, tapTransition } from "@/lib/motion";
import { useTranslation } from "@/lib/i18n";

// ── FormShell ─────────────────────────────────────────────────────────────────
// Shared outer chrome for all financial form bottom sheets.
// Handles: portal rendering, dark overlay, spring-animated sheet,
// standard rounded corners, and 92dvh max height.

interface FormShellProps {
  onClose: () => void;
  /** Optional max-width class, e.g. "sm:max-w-md". Default: "sm:max-w-lg". */
  maxWidth?: string;
  children: React.ReactNode;
}

export function FormShell({ onClose, maxWidth = "sm:max-w-lg", children }: FormShellProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{
        backgroundColor: "rgba(7,16,24,0.76)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 64, opacity: 0 }}
        transition={spring}
        className={cn(
          "relative w-full flex flex-col overflow-hidden",
          "rounded-t-[2rem] sm:rounded-[1.75rem]",
          maxWidth,
        )}
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          maxHeight: "92dvh",
        }}
      >
        {children}
      </motion.div>
    </div>,
    document.body,
  );
}

// ── FormFooter ────────────────────────────────────────────────────────────────
// Pinned footer with standardized safe-area-aware bottom padding.
// Always sits at the bottom of the sheet, never scrolls out of view.

interface FormFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function FormFooter({ children, className }: FormFooterProps) {
  return (
    <div
      className={cn("shrink-0 px-5 pt-2", className)}
      style={{ paddingBottom: "max(20px,calc(env(safe-area-inset-bottom,0px)+12px))" }}
    >
      {children}
    </div>
  );
}

// ── FormSaveBtn ───────────────────────────────────────────────────────────────
// Standardized animated submit button for all financial forms.

interface FormSaveBtnProps {
  label: string;
  icon?: React.ReactNode;
  accentHex: string;
  loading?: boolean;
  disabled?: boolean;
}

export function FormSaveBtn({
  label,
  icon,
  accentHex,
  loading = false,
  disabled = false,
}: FormSaveBtnProps) {
  const { t } = useTranslation();

  return (
    <motion.button
      type="submit"
      disabled={loading || disabled}
      whileTap={{ scale: 0.97 }}
      transition={tapTransition}
      className="w-full rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-40 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${accentHex} 0%, ${accentHex}99 100%)`,
        boxShadow: `0 4px 20px ${accentHex}30`,
      }}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("common.saving")}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2"
          >
            {icon}
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
