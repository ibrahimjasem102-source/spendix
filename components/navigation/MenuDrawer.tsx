"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, TrendingUp, Landmark, Briefcase, Sparkles,
  Bot, Settings, Bell, Target, BookOpen, LayoutDashboard,
  ArrowLeftRight, X,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { backdropVariants } from "@/lib/motion";

// ── Icon map ──────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  "/dashboard":    LayoutDashboard,
  "/transactions": ArrowLeftRight,
  "/analytics":    BarChart3,
  "/investments":  TrendingUp,
  "/debts":        Landmark,
  "/work":         Briefcase,
  "/budgets":      Target,
  "/ledger":       BookOpen,
  "/ai-insights":  Sparkles,
  "/ai-assistant": Bot,
  "/notifications":Bell,
  "/settings":     Settings,
};
const COLOR_MAP: Record<string, { color: string; bg: string }> = {
  "/dashboard":    { color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
  "/transactions": { color: "text-emerald-400", bg: "bg-emerald-400/10" },
  "/analytics":    { color: "text-blue-400",    bg: "bg-blue-400/10"    },
  "/investments":  { color: "text-purple-400",  bg: "bg-purple-400/10"  },
  "/debts":        { color: "text-rose-400",    bg: "bg-rose-400/10"    },
  "/work":         { color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
  "/budgets":      { color: "text-emerald-400", bg: "bg-emerald-400/10" },
  "/ledger":       { color: "text-amber-400",   bg: "bg-amber-400/10"   },
  "/ai-insights":  { color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
  "/ai-assistant": { color: "text-purple-400",  bg: "bg-purple-400/10"  },
  "/notifications":{ color: "text-amber-400",   bg: "bg-amber-400/10"   },
  "/settings":     { color: "text-gray-400",    bg: "bg-gray-400/10"    },
};

const GROUPS = [
  {
    labelKey: "nav.finance",
    hrefs: ["/analytics","/investments","/debts","/work","/budgets"],
  },
  {
    labelKey: "nav.ai_section",
    hrefs: ["/ai-insights","/ai-assistant"],
  },
  {
    labelKey: "nav.system",
    hrefs: ["/notifications","/settings"],
  },
];

// ── Hamburger icon — 3 lines of unequal length ────────────────
export function HamburgerIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-[5px] ${className}`}>
      <span className="h-[2px] rounded-full bg-current" style={{ width: 20 }} />
      <span className="h-[2px] rounded-full bg-current" style={{ width: 14 }} />
      <span className="h-[2px] rounded-full bg-current" style={{ width: 9  }} />
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────
export default function MenuDrawer() {
  const [open, setOpen]   = useState(false);
  const pathname          = usePathname();
  const { t }             = useTranslation();

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="p-2 rounded-xl t2 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
      >
        <HamburgerIcon />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="drawer-backdrop"
              variants={backdropVariants}
              initial="hidden" animate="visible" exit="exit"
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Drawer panel — slides from right (RTL start side) */}
            <motion.div
              key="drawer-panel"
              initial={{ x: "100%", opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 38 }}
              className="fixed top-0 end-0 bottom-0 z-50 w-72 max-w-[85vw] flex flex-col"
              style={{
                backgroundColor: "hsl(var(--bg-card))",
                borderInlineStart: "1px solid hsl(var(--border))",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-safe-top pb-4 border-b border-[hsl(var(--border-2))]"
                style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + 16px)` }}>
                <div>
                  <p className="text-base font-bold t1">Spendix</p>
                  <p className="text-xs t3 mt-0.5">{t("more.subtitle")}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-xl t3 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Nav items */}
              <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
                {GROUPS.map((group) => (
                  <div key={group.labelKey}>
                    <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em] px-2 mb-1.5">
                      {t(group.labelKey)}
                    </p>
                    <div className="space-y-0.5">
                      {group.hrefs.map((href) => {
                        const Icon   = ICON_MAP[href] ?? LayoutDashboard;
                        const cfg    = COLOR_MAP[href] ?? { color: "text-gray-400", bg: "bg-gray-400/10" };
                        const active = pathname === href;
                        const lk     = `nav.${href.replace("/", "").replace("-", "_")}`;

                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-[0.875rem] transition-all ${
                              active
                                ? "bg-[hsl(var(--bg-card-2))] t1"
                                : "t2 hover:t1 hover:bg-[hsl(var(--bg-input))]"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                              <Icon className={`w-4 h-4 ${cfg.color}`} />
                            </div>
                            <span className="text-sm font-medium flex-1">{t(lk)}</span>
                            {active && (
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom safe area */}
              <div style={{ height: "env(safe-area-inset-bottom, 0px)", minHeight: 8 }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
