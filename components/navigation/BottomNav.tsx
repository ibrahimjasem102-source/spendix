"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Plus, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { NAV_ITEMS, ROUTES, type NavItem as NavItemConfig, type AppRoute } from "@/lib/routes";
import { getRoomForNavItem, useRoomLocks } from "@/contexts/RoomLockContext";
import { useGlobalActions } from "@/contexts/GlobalActionsContext";
import { backdropVariants, ease } from "@/lib/motion";
import { useNavConfig } from "@/lib/nav-config";
import { NAV_ICON_MAP, NAV_HEX_MAP, NAV_COLOR_MAP } from "@/lib/nav-colors";
import SheetDragHandle from "@/components/ui/SheetDragHandle";

const NAV_H = 68;
const LONG_PRESS_MS = 500;
const tapTransition = { type: "tween", duration: 0.1 } as const;

const SHORT_LABEL: Record<string, string> = {
  "/dashboard":    "nav.dashboard_short",
  "/transactions": "nav.transactions_short",
  "/debts":        "nav.debts_short",
  "/more":         "nav.more_short",
  "/ai-assistant": "nav.ai_assistant_short",
  "/ai-insights":  "nav.ai_insights_short",
  "/goals":        "nav.goals_short",
  "/budgets":      "nav.budgets_short",
  "/analytics":    "nav.analytics_short",
};

// ── Single nav button ──────────────────────────────────────────
function NavButton({
  item, active, slotIndex, locked = false, roomLocked = false, badge, onLongPress,
}: {
  item: NavItemConfig;
  active: boolean;
  slotIndex: 0 | 1 | 2 | 3 | 4;
  locked?: boolean;
  roomLocked?: boolean;
  badge?: number;
  onLongPress: (slotIndex: 1 | 2 | 3) => void;
}) {
  const { t }  = useTranslation();
  const router = useRouter();

  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired    = useRef(false);
  const pointerMoved = useRef(false);
  const touchHandled = useRef(false);
  const startX       = useRef(0);
  const startY       = useRef(0);
  const [drawKey, setDrawKey] = useState(0);

  const shortKey = SHORT_LABEL[item.href] ?? item.title;
  const label    = t(shortKey) === shortKey ? t(item.title) : t(shortKey);

  const isMiddle = slotIndex === 1 || slotIndex === 2 || slotIndex === 3;
  const IconCmp  = NAV_ICON_MAP[item.href];
  const hex      = NAV_HEX_MAP[item.href] ?? "#22d3ee";

  useEffect(() => {
    if (active) setDrawKey((k) => k + 1);
  }, [active, item.href]);

  const cancelTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    longFired.current    = false;
    pointerMoved.current = false;
    startX.current       = e.clientX;
    startY.current       = e.clientY;
    if (locked || !isMiddle) return;
    timerRef.current = setTimeout(() => {
      longFired.current = true;
      cancelTimer();
      onLongPress(slotIndex as 1 | 2 | 3);
    }, LONG_PRESS_MS);
  }, [locked, isMiddle, slotIndex, onLongPress, cancelTimer]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerMoved.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      pointerMoved.current = true;
      cancelTimer();
    }
  }, [cancelTimer]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    touchHandled.current = true;
    cancelTimer();
    if (!longFired.current) router.push(item.href);
    longFired.current    = false;
    pointerMoved.current = false;
  }, [cancelTimer, item.href, router]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (touchHandled.current) { e.preventDefault(); touchHandled.current = false; return; }
    if (longFired.current) { e.preventDefault(); longFired.current = false; pointerMoved.current = false; return; }
    longFired.current    = false;
    pointerMoved.current = false;
  }, []);

  return (
    <motion.div
      className="flex-1 min-w-0"
      whileTap={{ scale: locked ? 1 : 0.92 }}
      transition={tapTransition}
    >
      <Link
        href={item.href}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={cancelTimer}
        onPointerCancel={cancelTimer}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className={cn(
          "group relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 select-none",
          active ? "" : "text-gray-500",
        )}
        style={{
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          backfaceVisibility: "hidden",
          textDecoration: "none",
          color: active ? hex : undefined,
        }}
      >
        {/* Active background pill */}
        {active && (
          <motion.span
            layoutId="bottom-nav-active-pill"
            className="absolute inset-x-1 top-1 bottom-1 rounded-[14px]"
            style={{ backgroundColor: `${hex}14`, border: `1px solid ${hex}28` }}
            transition={{ type: "spring", stiffness: 580, damping: 40 }}
          />
        )}

        {/* Icon */}
        <div className="relative z-10 flex h-8 w-8 items-center justify-center">
          <motion.span
            key={`${item.href}-${drawKey}`}
            initial={{ opacity: 0.75, scale: 0.9 }}
            animate={{ opacity: 1, y: active ? -1 : 0, scale: active ? 1.06 : 1 }}
            transition={{ type: "spring", stiffness: 680, damping: 32 }}
            className={cn(
              "flex h-[21px] w-[21px] items-center justify-center [&>svg]:h-full [&>svg]:w-full",
              active && "drop-shadow-[0_0_8px_currentColor]",
            )}
          >
            {IconCmp ? <IconCmp strokeWidth={active ? 2.7 : 2.35} /> : item.icon}
          </motion.span>

          {/* Badges */}
          {roomLocked && (
            <span className="absolute -end-1.5 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[#071018]">
              <LockKeyhole className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          )}
          {!roomLocked && badge != null && badge > 0 && (
            <span className="absolute -end-1.5 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-amber-400 px-0.5 text-[8px] font-black text-[#0B0F14]">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>

        {/* Label */}
        <span className="relative z-10 w-full max-w-[58px] truncate text-center text-[9px] font-semibold leading-none">
          {label}
        </span>

        {/* Active dot */}
        {active && (
          <motion.span
            layoutId="bottom-nav-active-dot"
            className="relative z-10 mt-0.5 h-[2.5px] w-3 rounded-full"
            style={{ backgroundColor: hex }}
            transition={{ type: "spring", stiffness: 580, damping: 40 }}
          />
        )}
      </Link>
    </motion.div>
  );
}

// ── Center FAB Button ──────────────────────────────────────────
function CenterFABButton({ onPress }: { onPress: () => void }) {
  const touchHandled = useRef(false);

  return (
    <div className="flex flex-1 min-w-0 flex-col items-center justify-center">
      <motion.button
        onTouchEnd={(e) => {
          e.preventDefault();
          touchHandled.current = true;
          onPress();
        }}
        onClick={() => {
          if (touchHandled.current) { touchHandled.current = false; return; }
          onPress();
        }}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.88 }}
        transition={tapTransition}
        className="relative flex items-center justify-center rounded-full"
        aria-label="Add new"
        style={{
          width: 50,
          height: 50,
          background: "linear-gradient(135deg, #06B6D4 0%, #2563EB 48%, #8B5CF6 100%)",
          boxShadow: "0 0 0 6px rgba(255,255,255,0.06), 0 12px 28px rgba(6,182,212,0.26), 0 8px 20px rgba(0,0,0,0.40)",
        }}
      >
        <Plus className="relative h-5 w-5 text-white" strokeWidth={2.6} />
      </motion.button>
    </div>
  );
}

// ── Nav Picker Sheet ──────────────────────────────────────────
function NavPickerSheet({
  slotIndex, currentSlots, onPick, onClose,
}: {
  slotIndex: 1 | 2 | 3;
  currentSlots: AppRoute[];
  onPick: (route: AppRoute) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <motion.div
        key="picker-backdrop"
        variants={backdropVariants}
        initial="hidden" animate="visible" exit="exit"
        transition={ease}
        className="fixed inset-0 z-[110]"
        style={{ backgroundColor: "rgba(19,26,34,0.58)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <motion.div
        key="picker-sheet"
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="fixed inset-x-3 z-[120] flex flex-col overflow-hidden rounded-[1.5rem] pointer-events-auto"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          bottom: `calc(${NAV_H}px + max(18px, env(safe-area-inset-bottom, 0px)))`,
          maxHeight: `min(58dvh, calc(100dvh - ${NAV_H}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 72px))`,
          transform: "translate3d(0,0,0)",
          backfaceVisibility: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.42)",
        }}
      >
        <div className="flex justify-center pt-2.5 pb-0.5">
          <SheetDragHandle onClose={onClose} />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border-2))]">
          <div>
            <p className="text-sm font-bold t1">{t("nav_picker.title")}</p>
            <p className="text-xs t3 mt-0.5">{t("nav_picker.subtitle")}</p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl t3 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3" style={{ overscrollBehaviorY: "contain" }}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {NAV_ITEMS.map((item) => {
              const isSelected = currentSlots[slotIndex] === item.href;
              const isFixed    = item.href === ROUTES.dashboard || item.href === ROUTES.more;
              const isUsed     = currentSlots.includes(item.href) && !isSelected;
              const IconCmp    = NAV_ICON_MAP[item.href];
              const hex        = NAV_HEX_MAP[item.href] ?? "#22d3ee";

              return (
                <button
                  key={item.href}
                  disabled={isUsed || isFixed}
                  onClick={() => { onPick(item.href); }}
                  className={cn(
                    "flex min-h-[82px] flex-col items-center justify-center gap-1.5 rounded-2xl p-2.5 text-center transition-all",
                    isSelected
                      ? "border-2"
                      : isUsed || isFixed
                        ? "opacity-30 cursor-not-allowed bg-[hsl(var(--bg-input))]"
                        : "bg-[hsl(var(--bg-input))] hover:bg-[hsl(var(--bg-card-2))] border border-[hsl(var(--border))]"
                  )}
                  style={isSelected ? {
                    backgroundColor: `${hex}12`,
                    borderColor: `${hex}40`,
                  } : undefined}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center relative"
                    style={{ backgroundColor: isSelected ? `${hex}20` : "hsl(var(--bg-card-2))" }}>
                    {IconCmp
                      ? <IconCmp className="h-[18px] w-[18px]" style={{ color: isSelected ? hex : "hsl(var(--text-3))" }} />
                      : <span className="h-[18px] w-[18px] [&>svg]:h-full [&>svg]:w-full" style={{ color: isSelected ? hex : undefined }}>{item.icon}</span>
                    }
                    {isSelected && (
                      <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: hex }}>
                        <Check className="w-2.5 h-2.5 text-[#0B0F14]" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold leading-tight w-full truncate"
                    style={{ color: isSelected ? hex : "hsl(var(--text-2))" }}>
                    {t(item.title)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </>,
    document.body
  );
}

// ── Main BottomNav ─────────────────────────────────────────────
export default function BottomNav() {
  const pathname = usePathname();
  const { t }   = useTranslation();
  const { slots, items, updateSlot } = useNavConfig();
  const { isRoomLocked, isRoomUnlocked } = useRoomLocks();
  const { activeModal } = useGlobalActions();

  const [pickerSlot, setPickerSlot] = useState<1 | 2 | 3 | null>(null);
  const [navHidden, setNavHidden]   = useState(false);

  const pickerSlots = useMemo(
    () => { const s = [...slots] as typeof slots; s[2] = ROUTES.more; return s; },
    [slots],
  );

  useEffect(() => {
    const hide = () => setNavHidden(true);
    const show = () => setNavHidden(false);
    window.addEventListener("spendix:nav-hide", hide);
    window.addEventListener("spendix:nav-show", show);
    return () => {
      window.removeEventListener("spendix:nav-hide", hide);
      window.removeEventListener("spendix:nav-show", show);
    };
  }, []);

  const handleLongPress = useCallback((slotIndex: 1 | 2 | 3) => {
    setPickerSlot(slotIndex);
  }, []);

  if (navHidden || activeModal) return null;

  return (
    <>
      {/* ── Navigation Bar ─────────────────────────────────── */}
      <nav
        aria-label={t("nav.more")}
        className={cn(
          "fixed inset-x-0 z-30 mx-3 flex flex-col items-stretch overflow-hidden rounded-2xl modern-surface",
          pickerSlot !== null && "pointer-events-none"
        )}
        style={{
          bottom: "max(6px, env(safe-area-inset-bottom, 0px))",
          transform: "translate3d(0,0,0)",
          backfaceVisibility: "hidden",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div className="flex items-center gap-0.5 px-1.5" style={{ height: `${NAV_H}px` }}>
          <NavButton
            item={items[0]} active={pathname === items[0].href || pathname.startsWith(items[0].href + "/")}
            slotIndex={0} locked onLongPress={handleLongPress}
            roomLocked={isRoomLocked(getRoomForNavItem(items[0])) && !isRoomUnlocked(getRoomForNavItem(items[0]))}
          />
          <NavButton
            item={items[1]} active={pathname === items[1].href || pathname.startsWith(items[1].href + "/")}
            slotIndex={1} onLongPress={handleLongPress}
            roomLocked={isRoomLocked(getRoomForNavItem(items[1])) && !isRoomUnlocked(getRoomForNavItem(items[1]))}
          />
          <CenterFABButton onPress={() => window.dispatchEvent(new CustomEvent("spendix:toggle-fab"))} />
          <NavButton
            item={items[3]} active={pathname === items[3].href || pathname.startsWith(items[3].href + "/")}
            slotIndex={3} onLongPress={handleLongPress}
            roomLocked={isRoomLocked(getRoomForNavItem(items[3])) && !isRoomUnlocked(getRoomForNavItem(items[3]))}
          />
          <NavButton
            item={items[4]} active={pathname === items[4].href || pathname.startsWith(items[4].href + "/")}
            slotIndex={4} locked onLongPress={handleLongPress}
            roomLocked={isRoomLocked(getRoomForNavItem(items[4])) && !isRoomUnlocked(getRoomForNavItem(items[4]))}
          />
        </div>
      </nav>

      {/* ── Nav Picker ─────────────────────────────────────── */}
      <AnimatePresence>
        {pickerSlot !== null && (
          <NavPickerSheet
            slotIndex={pickerSlot}
            currentSlots={pickerSlots}
            onPick={(route) => { updateSlot(pickerSlot, route); setPickerSlot(null); }}
            onClose={() => setPickerSlot(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export { type NavItemConfig };
