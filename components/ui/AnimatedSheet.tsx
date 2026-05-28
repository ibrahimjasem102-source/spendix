"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { backdropVariants, sheetVariants, sheetTransition, ease } from "@/lib/motion";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export default function AnimatedSheet({ open, onClose, title, children, maxHeight = "85vh" }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={ease}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet-panel"
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={sheetTransition}
            className="fixed inset-x-0 bottom-0 z-[51]"
            style={{ maxHeight }}
          >
            <div
              className="rounded-t-[2rem] overflow-hidden flex flex-col"
              style={{
                background: "hsl(215 26% 10%)",
                border: "1px solid hsl(0 0% 100% / 0.1)",
                borderBottom: "none",
                boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
                maxHeight,
              }}
            >
              {/* Handle + header */}
              <div className="shrink-0 pt-3 pb-2 px-6">
                {/* Drag handle */}
                <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-3" />

                {title && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold t1">{title}</p>
                    <button onClick={onClose}
                      className="p-2 rounded-xl t3 hover:t2 hover:bg-[hsl(var(--bg-input))] transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto pb-safe">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
