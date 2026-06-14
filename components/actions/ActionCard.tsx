"use client";

import { motion } from "framer-motion";
import { tapTransition } from "@/lib/motion";
import type { LucideIcon } from "lucide-react";

interface ActionCardProps {
  icon:        LucideIcon;
  label:       string;
  description: string;
  color:       string;
  onClick:     () => void;
}

export default function ActionCard({ icon: Icon, label, description, color, onClick }: ActionCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.93 }}
      transition={tapTransition}
      className="flex flex-col gap-3 p-4 rounded-xl text-start w-full"
      style={{
        backgroundColor: "hsl(var(--bg-card-2))",
        border: "1px solid hsl(var(--border))",
      }}
    >
      <div
        className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}1A` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight" style={{ color: "hsl(var(--text-1))" }}>
          {label}
        </p>
        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "hsl(var(--text-3))" }}>
          {description}
        </p>
      </div>
    </motion.button>
  );
}

