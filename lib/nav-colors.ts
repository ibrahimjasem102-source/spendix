import {
  LayoutDashboard, ArrowLeftRight, BarChart3, Landmark,
  Target, BookOpen, Sparkles, Bot, Settings, Bell, Grid3X3,
  Goal, TrendingUp, Briefcase, Tag, CalendarDays,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const NAV_ICON_MAP: Record<string, LucideIcon> = {
  "/dashboard":    LayoutDashboard,
  "/transactions": ArrowLeftRight,
  "/analytics":    BarChart3,
  "/investments":  TrendingUp,
  "/debts":        Landmark,
  "/work":         Briefcase,
  "/budgets":      Target,
  "/goals":        Goal,
  "/ledger":       BookOpen,
  "/ai-insights":  Sparkles,
  "/ai-assistant": Bot,
  "/notifications":Bell,
  "/settings":     Settings,
  "/more":         Grid3X3,
  "/tags":         Tag,
  "/calendar":     CalendarDays,
};

export const NAV_HEX_MAP: Record<string, string> = {
  "/dashboard":    "#22d3ee",
  "/transactions": "#34d399",
  "/analytics":    "#60a5fa",
  "/investments":  "#a78bfa",
  "/debts":        "#fb7185",
  "/work":         "#22d3ee",
  "/budgets":      "#34d399",
  "/goals":        "#fbbf24",
  "/ledger":       "#fbbf24",
  "/ai-insights":  "#22d3ee",
  "/ai-assistant": "#a78bfa",
  "/notifications":"#fbbf24",
  "/settings":     "#9ca3af",
  "/more":         "#22d3ee",
  "/tags":         "#ec4899",
  "/calendar":     "#38bdf8",
};

export const NAV_COLOR_MAP: Record<string, { color: string; bg: string }> = {
  "/dashboard":    { color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
  "/transactions": { color: "text-emerald-400", bg: "bg-emerald-400/10" },
  "/analytics":    { color: "text-blue-400",    bg: "bg-blue-400/10"    },
  "/investments":  { color: "text-purple-400",  bg: "bg-purple-400/10"  },
  "/debts":        { color: "text-rose-400",    bg: "bg-rose-400/10"    },
  "/work":         { color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
  "/budgets":      { color: "text-emerald-400", bg: "bg-emerald-400/10" },
  "/goals":        { color: "text-amber-400",   bg: "bg-amber-400/10"   },
  "/ledger":       { color: "text-amber-400",   bg: "bg-amber-400/10"   },
  "/ai-insights":  { color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
  "/ai-assistant": { color: "text-purple-400",  bg: "bg-purple-400/10"  },
  "/notifications":{ color: "text-amber-400",   bg: "bg-amber-400/10"   },
  "/settings":     { color: "text-gray-400",    bg: "bg-gray-400/10"    },
  "/more":         { color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
  "/tags":         { color: "text-pink-400",    bg: "bg-pink-400/10"    },
  "/calendar":     { color: "text-sky-400",     bg: "bg-sky-400/10"     },
};
