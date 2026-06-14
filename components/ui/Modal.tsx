"use client";

import { useEffect, useState, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModalSize     = "sm" | "md" | "lg" | "xl" | "full";
export type ModalPosition = "center" | "bottom";

export interface ModalProps {
  open:          boolean;
  onClose:       () => void;
  title?:        string;
  description?:  string;
  /** Rendered in the header area, replaces title+description */
  headerSlot?:   React.ReactNode;
  children:      React.ReactNode;
  footer?:       React.ReactNode;
  size?:         ModalSize;
  position?:     ModalPosition;
  /** Whether clicking the backdrop closes the modal (default: true) */
  dismissible?:  boolean;
  /** Whether ESC key closes the modal (default: true) */
  escClosable?:  boolean;
  className?:    string;
  /** Extra classes applied to the backdrop */
  backdropClassName?: string;
}

// ── Animations ────────────────────────────────────────────────────────────────

const backdropAnim = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
};

const centerAnim = {
  hidden:  { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1,    y: 0 },
  exit:    { opacity: 0, scale: 0.96, y: 8 },
};

const bottomAnim = {
  hidden:  { y: "100%", opacity: 0.7 },
  visible: { y: 0,      opacity: 1   },
  exit:    { y: "100%", opacity: 0   },
};

const springCenter = { type: "spring", stiffness: 360, damping: 32 } as const;
const springBottom = { type: "spring", stiffness: 380, damping: 38, mass: 0.9 } as const;

// ── Size map ──────────────────────────────────────────────────────────────────

const sizeClasses: Record<ModalSize, string> = {
  sm:   "max-w-sm",
  md:   "max-w-md",
  lg:   "max-w-lg",
  xl:   "max-w-2xl",
  full: "max-w-none w-full h-full",
};

// ── Modal ─────────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  description,
  headerSlot,
  children,
  footer,
  size         = "md",
  position     = "center",
  dismissible  = true,
  escClosable  = true,
  className,
  backdropClassName,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef             = useRef<HTMLDivElement>(null);
  const titleId               = useId();
  const descId                = useId();

  useEffect(() => { setMounted(true); }, []);

  // ESC to close
  useEffect(() => {
    if (!open || !escClosable) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, escClosable, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Focus trap — move focus into dialog on open
  useEffect(() => {
    if (open && dialogRef.current) {
      const focusable = dialogRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }
  }, [open]);

  if (!mounted) return null;

  const isBottom  = position === "bottom";
  const anim      = isBottom ? bottomAnim : centerAnim;
  const spring    = isBottom ? springBottom : springCenter;

  const hasHeader = !!(title || description || headerSlot);

  const dialog = (
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            "fixed inset-0 z-[60] flex",
            isBottom ? "items-end justify-center" : "items-center justify-center p-4",
          )}
          role="presentation"
        >
          {/* Backdrop */}
          <motion.div
            className={cn(
              "absolute inset-0",
              "bg-[rgba(11,15,20,0.72)] backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]",
              backdropClassName,
            )}
            variants={backdropAnim}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.18 }}
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            variants={anim}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={spring}
            className={cn(
              "relative z-10 w-full flex flex-col",
              "modal-card",
              isBottom
                ? "rounded-t-[2rem] max-h-[90dvh] sm:rounded-[1.75rem] sm:max-w-md sm:mb-4"
                : cn("rounded-[1.75rem]", sizeClasses[size], size !== "full" && "max-h-[90dvh]"),
              className,
            )}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle — mobile bottom sheets only */}
            {isBottom && (
              <div className="flex justify-center pt-3 pb-0 shrink-0 sm:hidden" aria-hidden="true">
                <div className="h-1 w-10 rounded-full bg-white/15" />
              </div>
            )}

            {/* Header */}
            {hasHeader && (
              <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-0 shrink-0">
                <div className="flex-1 min-w-0">
                  {headerSlot ?? (
                    <>
                      {title && (
                        <h2 id={titleId} className="text-base font-bold t1 leading-tight">
                          {title}
                        </h2>
                      )}
                      {description && (
                        <p id={descId} className="text-xs t3 mt-1 leading-relaxed">
                          {description}
                        </p>
                      )}
                    </>
                  )}
                </div>
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
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="shrink-0 px-6 pb-5 pt-0 border-t border-[hsl(var(--border-2))]">
                <div className="pt-4">{footer}</div>
              </div>
            )}

            {/* Safe area */}
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

  return createPortal(dialog, document.body);
}
