"use client";

import { motion } from "framer-motion";
import { tapTransition } from "@/lib/motion";

interface Props {
  onClose: () => void;
  className?: string;
  disabled?: boolean;
}

export default function SheetDragHandle({ onClose, className = "", disabled = false }: Props) {
  return (
    <motion.button
      type="button"
      aria-label="Close sheet"
      disabled={disabled}
      drag={disabled ? false : "y"}
      dragConstraints={{ top: 0, bottom: 76 }}
      dragElastic={0.16}
      onDragEnd={(_event, info) => {
        if (disabled) return;
        if (info.offset.y > 42 || info.velocity.y > 520) onClose();
      }}
      whileTap={disabled ? undefined : { scaleX: 1.18, scaleY: 1.25 }}
      transition={tapTransition}
      className={`mx-auto block h-6 w-16 touch-none rounded-full p-2 active:cursor-grabbing ${className}`}
    >
      <span className="block h-1 w-10 rounded-full bg-white/15" />
    </motion.button>
  );
}
