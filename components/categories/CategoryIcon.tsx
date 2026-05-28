"use client";

import { getIcon } from "@/lib/categories";

interface Props {
  icon:  string | null | undefined;
  color: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE: Record<string, { wrap: string; icon: string }> = {
  xs: { wrap: "w-6 h-6 rounded-lg",  icon: "w-3 h-3"   },
  sm: { wrap: "w-8 h-8 rounded-xl",  icon: "w-4 h-4"   },
  md: { wrap: "w-10 h-10 rounded-xl",icon: "w-5 h-5"   },
  lg: { wrap: "w-12 h-12 rounded-2xl",icon: "w-6 h-6"  },
};

export default function CategoryIcon({ icon, color, size = "sm", className = "" }: Props) {
  const Icon = getIcon(icon);
  const s    = SIZE[size];

  return (
    <div
      className={`${s.wrap} flex items-center justify-center shrink-0 ${className}`}
      style={{ backgroundColor: `${color}18` }}
    >
      <Icon className={s.icon} style={{ color }} />
    </div>
  );
}
