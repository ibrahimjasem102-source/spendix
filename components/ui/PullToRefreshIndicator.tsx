"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";

interface Props {
  pulling:    boolean;
  refreshing: boolean;
  progress:   number; // 0–1
}

export default function PullToRefreshIndicator({ pulling, refreshing, progress }: Props) {
  const size = 36;
  const show = pulling || refreshing;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          className="pointer-events-none fixed top-16 inset-x-0 z-50 flex justify-center"
        >
          <div
            className="flex items-center justify-center rounded-full bg-[hsl(var(--bg-card))] shadow-lg border border-[hsl(var(--border))]"
            style={{ width: size, height: size }}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
            ) : (
              <RefreshCw
                className="h-4 w-4 text-cyan-400 transition-transform"
                style={{ transform: `rotate(${progress * 360}deg)`, opacity: progress }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
