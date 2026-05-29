"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, ArrowUpRight, ArrowDownRight, TrendingUp,
  CreditCard, DollarSign, Briefcase, Check, X, ChevronRight,
  LayoutDashboard, ArrowLeftRight, BarChart3, Landmark,
  Target, BookOpen, Sparkles, Bot, Settings, Bell, Grid3X3,
  Goal, LockKeyhole, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useGlobalActions, ModalType } from "@/contexts/GlobalActionsContext";
import { useGoalCount } from "@/hooks/useGoalCount";
import { NAV_ITEMS, ROUTES, type NavItem as NavItemConfig, type AppRoute } from "@/lib/routes";
import { getRoomForNavItem, useRoomLocks } from "@/contexts/RoomLockContext";
import { backdropVariants, ease } from "@/lib/motion";
import { useNavConfig } from "@/lib/nav-config";

const NAV_H = 72;
const FAB_H = 52;
const LONG_PRESS_MS = 500;
const tapTransition = { type: "tween", duration: 0.1 } as const;

// ── Two-section action items ───────────────────────────────────
type ActionItem = { type: ModalType; icon: React.ElementType; labelKey: string; hintKey: string; hex: string };

const INCOME_ITEMS: ActionItem[] = [
  { type: "income",          icon: ArrowUpRight,  labelKey: "actions.income",       hintKey: "actions.income_hint",        hex: "#10B981" },
  { type: "debt_receivable", icon: DollarSign,    labelKey: "debts.receivable",     hintKey: "debts.receivable_hint",      hex: "#34d399" },
  { type: "work_payment",    icon: Briefcase,     labelKey: "actions.work_payment", hintKey: "actions.work_payment_hint",  hex: "#22d3ee" },
];

const EXPENSE_ITEMS: ActionItem[] = [
  { type: "expense",         icon: ArrowDownRight, labelKey: "actions.expense",      hintKey: "actions.expense_hint",       hex: "#F43F5E" },
  { type: "investment",      icon: TrendingUp,     labelKey: "nav.investments",      hintKey: "actions.investment_hint",    hex: "#a78bfa" },
  { type: "debt_payable",    icon: CreditCard,     labelKey: "debts.payable",        hintKey: "debts.payable_hint",         hex: "#fb923c" },
  { type: "work_session",    icon: Briefcase,      labelKey: "actions.work_session", hintKey: "actions.work_session_hint",  hex: "#22d3ee" },
];

// Icon map for picker
const ICON_MAP: Record<string, React.ElementType> = {
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
};
const COLOR_MAP: Record<string, { color: string; bg: string }> = {
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
};

// Short display labels
const SHORT_LABEL: Record<string, string> = {
  "/dashboard":    "nav.dashboard_short",
  "/transactions": "nav.transactions_short",
  "/debts":        "nav.debts_short",
  "/more":         "nav.more_short",
};

// ── Single nav item with long-press ──────────────────────────
function NavItem({
  item, active, slotIndex, locked = false, roomLocked = false, badge, onLongPress,
}: {
  item: NavItemConfig;
  active: boolean;
  slotIndex: 0 | 1 | 2 | 3;
  locked?: boolean;
  roomLocked?: boolean;
  badge?: number;
  onLongPress: (slotIndex: 0 | 1 | 2 | 3) => void;
}) {
  const { t }   = useTranslation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressing, setPressing] = useState(false);

  const shortKey = SHORT_LABEL[item.href] ?? item.title;
  const label    = t(shortKey) === shortKey ? t(item.title) : t(shortKey);

  const startPress = useCallback(() => {
    if (locked) return;
    setPressing(true);
    timerRef.current = setTimeout(() => {
      setPressing(false);
      onLongPress(slotIndex);
    }, LONG_PRESS_MS);
  }, [locked, slotIndex, onLongPress]);

  const cancelPress = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setPressing(false);
  }, []);

  return (
    <Link
      href={item.href}
      prefetch
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-all flex-1 min-w-0 min-h-[50px] select-none",
        active ? "text-cyan-400" : "text-gray-500 hover:text-gray-300",
      )}
      style={{
        transition: "transform 0.1s ease-out",
        WebkitTapHighlightColor: "transparent",
        transform: pressing ? "translate3d(0,0,0) scale(0.95)" : "translate3d(0,0,0)",
        backfaceVisibility: "hidden",
      }}
    >
      <div className={cn(
        "relative px-1.5 py-1 rounded-[10px] transition-all duration-200",
        active && "bg-cyan-400/[0.12]"
      )}>
        <span className="w-5 h-5 flex items-center justify-center [&>svg]:h-full [&>svg]:w-full">
          {item.icon}
        </span>
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
      <span className="text-[10px] font-semibold leading-none truncate w-full text-center max-w-[62px]">
        {label}
      </span>
      {active && (
        <span className="mt-0.5 w-3.5 h-[2px] rounded-full bg-cyan-400" />
      )}
    </Link>
  );
}

// ── Nav Picker Sheet ──────────────────────────────────────────
function NavPickerSheet({
  slotIndex,
  currentSlots,
  onPick,
  onClose,
}: {
  slotIndex: 0 | 1 | 2 | 3;
  currentSlots: AppRoute[];
  onPick: (route: AppRoute) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <motion.div
        key="picker-backdrop"
        variants={backdropVariants}
        initial="hidden" animate="visible" exit="exit"
        transition={ease}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        style={{ backgroundColor: "rgba(19,26,34,0.68)" }}
        onClick={onClose}
      />
      <motion.div
        key="picker-sheet"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[1.75rem] overflow-hidden"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          maxHeight: "75vh",
          transform: "translate3d(0,0,0)",
          backfaceVisibility: "hidden",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[hsl(var(--border))]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--border-2))]">
          <div>
            <p className="text-sm font-bold t1">{t("nav_picker.title")}</p>
            <p className="text-xs t3 mt-0.5">{t("nav_picker.subtitle")}</p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl t3 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options grid */}
        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {NAV_ITEMS.map((item) => {
              const isSelected = currentSlots[slotIndex] === item.href;
              const isFixed    = item.href === ROUTES.dashboard || item.href === ROUTES.more;
              const isUsed     = currentSlots.includes(item.href) && !isSelected;
              const cfg     = COLOR_MAP[item.href] ?? { color: "text-gray-400", bg: "bg-gray-400/10" };
              const IconCmp = ICON_MAP[item.href];

              return (
                <button
                  key={item.href}
                  disabled={isUsed || isFixed}
                  onClick={() => { onPick(item.href); }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-2xl transition-all text-center",
                    isSelected
                      ? "bg-cyan-400/10 border-2 border-cyan-400/40"
                      : isUsed || isFixed
                        ? "opacity-30 cursor-not-allowed bg-[hsl(var(--bg-input))]"
                        : "bg-[hsl(var(--bg-input))] hover:bg-[hsl(var(--bg-card-2))] border border-[hsl(var(--border))]"
                  )}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center relative ${cfg.bg}`}>
                    {IconCmp
                      ? <IconCmp className={`w-5 h-5 ${cfg.color}`} />
                      : <span className={`w-5 h-5 [&>svg]:h-full [&>svg]:w-full ${cfg.color}`}>{item.icon}</span>
                    }
                    {isSelected && (
                      <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-[#0B0F14]" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold leading-tight w-full truncate ${isSelected ? "text-cyan-400" : "t2"}`}>
                    {t(item.title)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Sheet animation ───────────────────────────────────────────
const sheetVariants = { hidden: { y: 24, opacity: 0 }, visible: { y: 0, opacity: 1 }, exit: { y: 24, opacity: 0 } };

// ── Main BottomNav ────────────────────────────────────────────
export default function BottomNav() {
  const pathname = usePathname();
  const { t }    = useTranslation();
  const { fabOpen, toggleFAB, openModal } = useGlobalActions();
  const { slots, leftItems, rightItems, updateSlot } = useNavConfig();
  const { isRoomLocked, isRoomUnlocked } = useRoomLocks();

  const [pickerSlot, setPickerSlot] = useState<0 | 1 | 2 | 3 | null>(null);
  const goalCount = useGoalCount();

  const handleLongPress = useCallback((slotIndex: 0 | 1 | 2 | 3) => {
    if (slotIndex === 0 || slotIndex === 3) return;
    setPickerSlot(slotIndex);
  }, []);

  return (
    <>
      <AnimatePresence>
        {fabOpen && (
          <>
            <motion.div
              key="fab-backdrop"
              variants={backdropVariants} initial="hidden" animate="visible" exit="exit"
              transition={ease}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              style={{ backgroundColor: "rgba(19,26,34,0.74)" }}
              onClick={toggleFAB}
            />

            {/* Action Sheet */}
            <motion.div
              key="fab-sheet"
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
              className="fixed inset-x-0 z-50 px-3"
              style={{ bottom: `calc(${NAV_H}px + env(safe-area-inset-bottom, 0px) + 10px)` }}
            >
              <div className="rounded-[2rem] shadow-2xl shadow-black/70 overflow-hidden"
                style={{
                  backgroundColor: "hsl(var(--bg-card))",
                  backdropFilter: "blur(32px)",
                  WebkitBackdropFilter: "blur(32px)",
                  border: "1px solid hsl(var(--border))",
                  transform: "translate3d(0,0,0)",
                  backfaceVisibility: "hidden",
                }}>

                {/* Handle + close */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3">
                  <div className="w-8 h-1 rounded-full bg-white/10 mx-auto absolute left-1/2 -translate-x-1/2 top-2.5" />
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-gradient-to-br from-cyan-400/20 to-purple-600/20">
                      <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <p className="text-sm font-bold t1">{t("actions.open")}</p>
                  </div>
                  <motion.button onClick={toggleFAB} whileTap={{ scale: 0.88 }} transition={tapTransition}
                    className="w-7 h-7 rounded-xl bg-white/6 flex items-center justify-center t3 hover:t1 transition-all">
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                </div>

                {/* ── Two-section layout ──────────────────────── */}
                <div className="px-3 pb-3 space-y-2.5">

                  {/* Income section */}
                  {[
                    { items: INCOME_ITEMS,   sectionColor: "#10B981", sectionLabelKey: "transactions.income",  SectionIcon: ArrowUpRight  },
                    { items: EXPENSE_ITEMS,  sectionColor: "#F43F5E", sectionLabelKey: "transactions.expense", SectionIcon: ArrowDownRight },
                  ].map(({ items, sectionColor, sectionLabelKey, SectionIcon }, si) => (
                    <motion.div key={sectionLabelKey}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 30, delay: si * 0.06 }}
                      className="rounded-2xl overflow-hidden"
                      style={{ border: `1px solid ${sectionColor}22` }}
                    >
                      {/* Section header */}
                      <div className="flex items-center gap-2 px-3.5 py-2.5"
                        style={{ background: `${sectionColor}12` }}>
                        <div className="p-1 rounded-lg" style={{ backgroundColor: `${sectionColor}20` }}>
                          <SectionIcon className="w-3.5 h-3.5" style={{ color: sectionColor }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: sectionColor }}>
                          {t(sectionLabelKey)}
                        </span>
                      </div>

                      {/* Sub-items */}
                      <div style={{ backgroundColor: "hsl(var(--bg-card))" }}>
                        {items.map((item, idx) => (
                          <motion.button
                            key={String(item.type)}
                            onClick={() => { toggleFAB(); openModal(item.type); }}
                            whileTap={{ scale: 0.985 }} transition={tapTransition}
                            className="flex items-center gap-3 w-full px-3.5 py-3 transition-colors text-start"
                            style={{
                              borderTop: idx === 0 ? "none" : `1px solid hsl(var(--border-2))`,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--bg-input))")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                          >
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${item.hex}18` }}>
                              <item.icon className="w-4 h-4" style={{ color: item.hex }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold t1 leading-snug">{t(item.labelKey)}</p>
                              <p className="text-[10px] t3 leading-snug mt-0.5 truncate">
                                {t(item.hintKey) !== item.hintKey ? t(item.hintKey) : ""}
                              </p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: `${item.hex}60` }} />
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  ))}

                  {/* Goal — standalone */}
                  <motion.button
                    onClick={() => { toggleFAB(); openModal("goal"); }}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.12 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-3 w-full px-3.5 py-3 rounded-2xl transition-all"
                    style={{
                      backgroundColor: "hsl(var(--bg-card))",
                      border: "1px solid #f59e0b22",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--bg-input))")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--bg-card))")}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-400/15 shrink-0">
                      <Goal className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold t1">{t("actions.goal")}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400/50 shrink-0" />
                  </motion.button>

                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Navigation Bar ─────────────────────────────────── */}
      <nav className="fixed inset-x-0 z-40 mx-3 flex flex-col items-stretch overflow-hidden rounded-[22px] shadow-2xl shadow-black/30"
        style={{
          bottom: "max(6px, env(safe-area-inset-bottom, 0px))",
          backgroundColor: "hsl(var(--bg-card) / 0.9)",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          border: "1px solid hsl(var(--border))",
          transform: "translate3d(0,0,0)",
          backfaceVisibility: "hidden",
          WebkitTapHighlightColor: "transparent",
        }}>
        <div className="flex items-center px-1.5" style={{ height: `${NAV_H}px` }}>
          {/* Left slots */}
          <div className="flex flex-1 items-center justify-around">
            {leftItems.map((item, i) => (
              <NavItem
                key={`left-${i}`}
                item={item}
                active={pathname === item.href || pathname.startsWith(item.href + "/")}
                slotIndex={i as 0 | 1}
                locked={item.href === ROUTES.dashboard || item.href === ROUTES.more}
                roomLocked={isRoomLocked(getRoomForNavItem(item)) && !isRoomUnlocked(getRoomForNavItem(item))}
                badge={item.href === ROUTES.goals ? goalCount : undefined}
                onLongPress={handleLongPress}
              />
            ))}
          </div>

          {/* FAB */}
          <div className="shrink-0 flex items-center justify-center relative" style={{ width: 58, height: `${NAV_H}px` }}>
            <motion.button
              onClick={toggleFAB}
              aria-label={fabOpen ? t("actions.close") : t("actions.open")}
              animate={{ rotate: fabOpen ? 45 : 0 }}
              whileTap={{ scale: 0.92 }}
              transition={tapTransition}
              className="absolute rounded-full flex items-center justify-center bg-gradient-to-br from-cyan-400 to-purple-600"
              style={{
                width: FAB_H, height: FAB_H,
                top: 10,
                boxShadow: fabOpen
                  ? "0 0 32px rgba(139,92,246,0.55), 0 8px 24px rgba(0,0,0,0.45)"
                  : "0 0 20px rgba(6,182,212,0.3), 0 8px 16px rgba(0,0,0,0.35)",
                transform: "translate3d(0,0,0)",
                backfaceVisibility: "hidden",
                WebkitTapHighlightColor: "transparent",
              }}>
              <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
            </motion.button>
            {fabOpen && (
              <span className="absolute rounded-full bg-purple-400/20 animate-ping pointer-events-none"
                style={{ width: FAB_H, height: FAB_H, top: 10 }} />
            )}
          </div>

          {/* Right slots */}
          <div className="flex flex-1 items-center justify-around">
            {rightItems.map((item, i) => (
              <NavItem
                key={`right-${i}`}
                item={item}
                active={pathname === item.href || pathname.startsWith(item.href + "/")}
                slotIndex={(i + 2) as 2 | 3}
                locked={item.href === ROUTES.dashboard || item.href === ROUTES.more}
                roomLocked={isRoomLocked(getRoomForNavItem(item)) && !isRoomUnlocked(getRoomForNavItem(item))}
                badge={item.href === ROUTES.goals ? goalCount : undefined}
                onLongPress={handleLongPress}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* ── Nav Picker ─────────────────────────────────────── */}
      <AnimatePresence>
        {pickerSlot !== null && (
          <NavPickerSheet
            slotIndex={pickerSlot}
            currentSlots={slots}
            onPick={(route) => {
              updateSlot(pickerSlot, route);
              setPickerSlot(null);
            }}
            onClose={() => setPickerSlot(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
