"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, BookOpen, BarChart3,
  Grid3X3, Plus, LockKeyhole,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useGlobalActions } from "@/contexts/GlobalActionsContext";
import { getRoomForNavItem, useRoomLocks } from "@/contexts/RoomLockContext";
import { NAV_ITEMS } from "@/lib/routes";

// ── Layout constants (consumed by PageContainer for clearance math) ─────────

export const NAV_H         = 68;   // px — height of the nav bar
export const NAV_CLEARANCE = 88;   // px — content bottom padding before safe-area

// ── Nav item definitions ─────────────────────────────────────────────────────

const ITEMS = [
  { href: "/dashboard", Icon: LayoutDashboard, labelKey: "nav.dashboard", hex: "#22d3ee" },
  { href: "/ledger",    Icon: BookOpen,         labelKey: "nav.ledger",    hex: "#fbbf24" },
  { href: "/analytics", Icon: BarChart3,        labelKey: "nav.analytics", hex: "#60a5fa" },
  { href: "/more",      Icon: Grid3X3,          labelKey: "nav.more",      hex: "#22d3ee" },
] as const;

const springPill = { type: "spring", stiffness: 580, damping: 40 } as const;
const tapAnim    = { type: "tween",  duration: 0.1              } as const;

// ── NavButton ────────────────────────────────────────────────────────────────

interface NavButtonProps {
  href:   string;
  Icon:   React.ElementType;
  label:  string;
  hex:    string;
  active: boolean;
  locked: boolean;
}

function NavButton({ href, Icon, label, hex, active, locked }: NavButtonProps) {
  return (
    <motion.div className="flex-1 min-w-0" whileTap={{ scale: 0.92 }} transition={tapAnim}>
      <Link
        href={href}
        prefetch={false}
        className={cn(
          "group relative flex min-h-[54px] flex-col items-center justify-center",
          "gap-0.5 rounded-xl px-1 py-1 select-none",
          !active && "text-gray-500",
        )}
        style={{ color: active ? hex : undefined }}
      >
        {/* Active background pill — shared layoutId animates between items */}
        {active && (
          <motion.span
            layoutId="nav-active-pill"
            className="absolute inset-x-1 top-1 bottom-1 rounded-[14px]"
            style={{ backgroundColor: `${hex}14`, border: `1px solid ${hex}28` }}
            transition={springPill}
          />
        )}

        {/* Icon */}
        <span className="relative z-10 flex h-8 w-8 items-center justify-center">
          <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.7 : 2.35} />
          {locked && (
            <span className="absolute -end-1.5 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[#071018]">
              <LockKeyhole className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          )}
        </span>

        {/* Label */}
        <span className="relative z-10 w-full max-w-[58px] truncate text-center text-[9px] font-semibold leading-none">
          {label}
        </span>

        {/* Active dot — shared layoutId animates between items */}
        {active && (
          <motion.span
            layoutId="nav-active-dot"
            className="relative z-10 mt-0.5 h-[2.5px] w-3 rounded-full"
            style={{ backgroundColor: hex }}
            transition={springPill}
          />
        )}
      </Link>
    </motion.div>
  );
}

// ── Center FAB ───────────────────────────────────────────────────────────────

function CenterFAB({ onPress }: { onPress: () => void }) {
  return (
    <div className="flex flex-1 min-w-0 items-center justify-center">
      <motion.button
        type="button"
        onClick={onPress}
        whileTap={{ scale: 0.88 }}
        transition={tapAnim}
        aria-label="Add new"
        className="flex items-center justify-center rounded-full"
        style={{
          width:     48,
          height:    48,
          background: "#06B6D4",
          boxShadow: "0 4px 16px rgba(6,182,212,0.30), 0 2px 8px rgba(0,0,0,0.30)",
        }}
      >
        <Plus className="h-5 w-5 text-white" strokeWidth={2.6} aria-hidden="true" />
      </motion.button>
    </div>
  );
}

// ── BottomNav ────────────────────────────────────────────────────────────────

export default function BottomNav() {
  const pathname                            = usePathname();
  const { t }                               = useTranslation();
  const { activeModal, fabOpen, toggleFAB } = useGlobalActions();
  const { isRoomLocked, isRoomUnlocked }    = useRoomLocks();

  // Hide when FAB sheet is open or a GlobalActions modal is active.
  // Modals rendered via portals (ConfirmModal, inline forms, etc.) cover the
  // nav visually — no need for the old spendix:nav-hide/show event system.
  const hidden = !!activeModal || fabOpen;

  // Render items in two halves: [Dashboard, Ledger] | FAB | [Analytics, More]
  function renderItem(item: typeof ITEMS[number]) {
    const navItem = NAV_ITEMS.find((i) => i.href === item.href);
    const room    = navItem ? getRoomForNavItem(navItem) : null;
    const locked  = room ? isRoomLocked(room) && !isRoomUnlocked(room) : false;

    return (
      <NavButton
        key={item.href}
        href={item.href}
        Icon={item.Icon}
        label={t(item.labelKey)}
        hex={item.hex}
        active={pathname === item.href || pathname.startsWith(item.href + "/")}
        locked={locked}
      />
    );
  }

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed inset-x-0 z-30 mx-3 overflow-hidden rounded-xl modern-surface",
        "transition-opacity duration-150",
        hidden && "opacity-0 pointer-events-none",
      )}
      style={{ bottom: "max(6px, env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        className="flex items-center gap-0.5 px-1.5"
        style={{ height: `${NAV_H}px` }}
      >
        {ITEMS.slice(0, 2).map(renderItem)}
        <CenterFAB onPress={toggleFAB} />
        {ITEMS.slice(2).map(renderItem)}
      </div>
    </nav>
  );
}
