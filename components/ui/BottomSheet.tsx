"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import SheetDragHandle from "@/components/ui/SheetDragHandle";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BottomSheetProps {
  open:         boolean;
  onClose:      () => void;
  title?:       string;
  subtitle?:    string;
  children:     React.ReactNode;
  footer?:      React.ReactNode;
  className?:   string;
  /** Disable drag-to-close handle (default: false) */
  noDrag?:      boolean;
  /** Prevent backdrop click from closing (default: false) */
  noDismiss?:   boolean;
  /** Max height of the sheet (default: 90dvh) */
  maxHeight?:   string;
  /** Whether to show the close × button in the header */
  showClose?:   boolean;
}

// ── Animations ────────────────────────────────────────────────────────────────

const backdropAnim = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
};

const sheetAnim = {
  hidden:  { y: "100%", opacity: 0.7 },
  visible: { y: 0,      opacity: 1   },
  exit:    { y: "105%", opacity: 0   },
};

const sheetSpring = { type: "spring", stiffness: 380, damping: 38, mass: 0.9 } as const;
const backdropTransition = { duration: 0.18 } as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
  noDrag    = false,
  noDismiss = false,
  maxHeight = "90dvh",
  showClose = true,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ESC key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Scroll lock
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Hide bottom nav while open
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent("spendix:nav-hide"));
      return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
    }
  }, [open]);

  if (!mounted) return null;

  const hasHeader = !!(title || subtitle);

  const sheet = (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          role="presentation"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-[rgba(11,15,20,0.72)] backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]"
            variants={backdropAnim}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={backdropTransition}
            onClick={noDismiss ? undefined : onClose}
            aria-hidden="true"
          />

          {/* Sheet panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={sheetAnim}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={sheetSpring}
            className={cn(
              "relative z-10 w-full sm:max-w-lg flex flex-col",
              "rounded-t-[2rem] sm:rounded-[1.75rem] sm:mb-4",
              "modal-card",
              className,
            )}
            style={{ maxHeight }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            {!noDrag && (
              <div className="flex justify-center pt-3 pb-0 shrink-0" aria-hidden="true">
                <SheetDragHandle onClose={onClose} />
              </div>
            )}

            {/* Header */}
            {hasHeader && (
              <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-0 shrink-0">
                <div className="min-w-0">
                  {title && (
                    <p className="text-base font-bold t1 leading-tight">{title}</p>
                  )}
                  {subtitle && (
                    <p className="text-xs t3 mt-0.5">{subtitle}</p>
                  )}
                </div>
                {showClose && (
                  <button
                    onClick={onClose}
                    className={cn(
                      "shrink-0 flex items-center justify-center w-8 h-8 rounded-xl",
                      "bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))]",
                      "t3 hover:t1 transition-colors",
                    )}
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="shrink-0 px-5 pb-4 pt-0 border-t border-[hsl(var(--border-2))]">
                <div className="pt-3">{footer}</div>
              </div>
            )}

            {/* Safe area spacer */}
            <div
              className="shrink-0"
              style={{ height: "max(0px, env(safe-area-inset-bottom, 0px))" }}
              aria-hidden="true"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(sheet, document.body);
}
