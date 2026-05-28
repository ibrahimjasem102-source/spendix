"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { spring } from "@/lib/motion";

interface Props {
  title: string;
  subtitle?: string;
  badge?: string | number;
  defaultOpen?: boolean;
  storageKey?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title, subtitle, badge, defaultOpen = true, storageKey, action, children,
}: Props) {
  const [open, setOpen] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      const v = sessionStorage.getItem(`section_${storageKey}`);
      if (v !== null) return v === "1";
    }
    return defaultOpen;
  });

  function toggle() {
    const next = !open;
    setOpen(next);
    if (storageKey) sessionStorage.setItem(`section_${storageKey}`, next ? "1" : "0");
  }

  return (
    <div>
      {/* Header */}
      <button
        onClick={toggle}
        className="flex items-center gap-2 w-full mb-3 group"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h2 className="text-sm font-bold t1">{title}</h2>
          {badge !== undefined && badge !== 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400">
              {badge}
            </span>
          )}
          {subtitle && <p className="text-xs t3 truncate hidden sm:block">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
          <motion.div animate={{ rotate: open ? 0 : -90 }} transition={spring}>
            <ChevronDown className="w-4 h-4 t3 group-hover:t2 transition-colors" />
          </motion.div>
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
