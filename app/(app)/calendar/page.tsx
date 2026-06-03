"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck, ChevronLeft, ChevronRight, CalendarDays, ExternalLink,
  TrendingUp, TrendingDown, RefreshCw, CreditCard,
  Landmark, Briefcase, DollarSign, X, Plus, Loader2, Check,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCalendar, useCreateTransaction } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import SheetDragHandle from "@/components/ui/SheetDragHandle";
import Link from "next/link";
import type { CalendarEvent, CalendarEventType, TransactionFormData, TransactionType } from "@/types";

// ── Event type meta ───────────────────────────────────────────

const TYPE_META: Record<CalendarEventType, { color: string; labelKey: string; Icon: React.ElementType }> = {
  income:       { color: "#10B981", labelKey: "calendar.type_income",       Icon: TrendingUp   },
  expense:      { color: "#F43F5E", labelKey: "calendar.type_expense",      Icon: TrendingDown },
  subscription: { color: "#8B5CF6", labelKey: "calendar.type_subscription", Icon: RefreshCw    },
  debt_due:     { color: "#F43F5E", labelKey: "calendar.type_debt_due",     Icon: CreditCard   },
  investment:   { color: "#3B82F6", labelKey: "calendar.type_investment",   Icon: Landmark     },
  work_session: { color: "#06B6D4", labelKey: "calendar.type_work_session", Icon: Briefcase    },
  work_payment: { color: "#10B981", labelKey: "calendar.type_work_payment", Icon: DollarSign   },
};

const SOURCE_LABEL_MAP: Record<string, string> = {
  transaction:  "calendar.source_transaction",
  subscription: "calendar.source_subscription",
  debt:         "calendar.source_debt",
  investment:   "calendar.source_investment",
  work:         "calendar.source_work",
};

function amountSign(type: CalendarEventType) {
  if (type === "income" || type === "work_payment") return "+";
  if (type === "expense" || type === "subscription" || type === "debt_due" || type === "investment") return "-";
  return "";
}

// ── Helpers ───────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay(); // 0=Sun
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Sub-components ────────────────────────────────────────────

function EventCard({ event, format, t }: { event: CalendarEvent; format: (n: number) => string; t: (k: string) => string }) {
  const meta = TYPE_META[event.type];
  const Icon = meta?.Icon ?? CalendarDays;
  const color = event.color ?? meta?.color ?? "#6B7280";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-start gap-3 p-3 rounded-xl border transition-colors"
      style={{ background: "hsl(var(--bg-input))", borderColor: "hsl(var(--border))" }}
    >
      {/* Color strip + icon */}
      <div
        className="mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm"
        style={{ backgroundColor: color + "22", color }}
      >
        {event.icon ? (
          <span className="text-base leading-none">{event.icon}</span>
        ) : (
          <Icon size={15} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium t1 leading-tight truncate">{event.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-xs px-1.5 py-0.5 rounded-md font-medium"
            style={{ backgroundColor: color + "22", color }}
          >
            {t(meta?.labelKey ?? "calendar.type_expense")}
          </span>
          {event.source && (
            <span className="text-xs t3">
              {t(SOURCE_LABEL_MAP[event.source] ?? "calendar.source_transaction")}
            </span>
          )}
        </div>
      </div>

      {/* Amount + link */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {event.amount != null && (
          <span className="text-sm font-semibold" style={{ color }}>
            {amountSign(event.type)}{format(event.amount)}
          </span>
        )}
        {event.action_url && (
          <Link href={event.action_url} className="t3 hover:t1 transition-colors">
            <ExternalLink size={13} />
          </Link>
        )}
      </div>
    </motion.div>
  );
}

function DayPanel({
  dateStr,
  events,
  today,
  onAdd,
  onClose,
  format,
  t,
  locale,
}: {
  dateStr: string | null;
  events: CalendarEvent[];
  today: string;
  onAdd: (date: string) => void;
  onClose: () => void;
  format: (n: number) => string;
  t: (k: string) => string;
  locale: string;
}) {
  if (!dateStr) return null;

  const date = new Date(dateStr + "T12:00:00");
  const isToday = dateStr === today;
  const label = date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  return (
    <motion.div
      key={dateStr}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={spring}
      className="flex flex-col gap-3 h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`flex-1 min-w-0 ${isToday ? "text-emerald-400" : "t1"}`}>
          <p className="text-sm font-semibold capitalize leading-tight">{label}</p>
          {isToday && (
            <p className="text-xs text-emerald-400/70 mt-0.5">{t("calendar.today")}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors t3 hover:t1 hover:bg-[hsl(var(--bg-input))]"
        >
          <X size={14} />
        </button>
      </div>

      <button
        onClick={() => onAdd(dateStr)}
        className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-400/10 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-400/15"
      >
        <Plus size={15} />
        {t("calendar.add_financial_event")}
      </button>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto space-y-2 pe-1">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 t3">
            <CalendarDays size={28} strokeWidth={1.5} />
            <p className="text-sm">{t("calendar.no_events_day")}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} format={format} t={t} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

function FinancialEventForm({
  initialDate,
  onClose,
  onSubmit,
  t,
  symbol,
}: {
  initialDate: string;
  onClose: () => void;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  t: (k: string) => string;
  symbol: string;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(initialDate);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!title.trim()) { setError(t("transactions.title_required")); return; }
    if (!Number.isFinite(value) || value <= 0) { setError(t("transactions.amount_positive")); return; }

    setLoading(true);
    setError("");
    try {
      await onSubmit({
        title: title.trim(),
        amount: value,
        type,
        category_id: null,
        account_id: null,
        transaction_date: date,
        source: "manual",
        related_source_id: `calendar:${date}`,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknown_error"));
      setLoading(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.form
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={spring}
        onSubmit={handleSubmit}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#12121A] sm:max-w-md sm:rounded-[1.75rem]"
      >
        <div className="shrink-0 border-b border-white/10 px-5 pb-4 pt-5">
          <div className="mb-2 sm:hidden">
            <SheetDragHandle onClose={onClose} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">{t("calendar.add_financial_event")}</p>
              <p className="mt-0.5 text-xs text-white/45">{t("calendar.add_financial_event_subtitle")}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-white/45 hover:bg-white/10 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            {(["expense", "income"] as TransactionType[]).map((item) => {
              const active = type === item;
              const income = item === "income";
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setType(item)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition-colors ${
                    active
                      ? income ? "border-emerald-400/40 bg-emerald-400/12 text-emerald-300" : "border-rose-400/40 bg-rose-400/12 text-rose-300"
                      : "border-white/10 bg-white/5 text-white/55"
                  }`}
                >
                  {income ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {t(income ? "transactions.income" : "transactions.expense")}
                </button>
              );
            })}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">
              {t("transactions.title")}
            </label>
            <input
              autoFocus
              value={title}
              onChange={(event) => { setTitle(event.target.value); if (error) setError(""); }}
              className="field"
              placeholder={t("calendar.event_title_placeholder")}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">
              {t("transactions.amount")}
            </label>
            <div className="relative">
              <span className="absolute start-4 top-1/2 -translate-y-1/2 text-xl font-bold text-white/35">{symbol}</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => { setAmount(event.target.value); if (error) setError(""); }}
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pe-4 ps-10 text-3xl font-bold text-white number-display focus:outline-none focus:border-cyan-400/40"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">
              {t("calendar.event_date")}
            </label>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="field" />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">
              {t("transactions.notes")}
              <span className="ms-1 font-normal normal-case opacity-60">({t("transactions.notes_optional")})</span>
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="field min-h-[92px] resize-none"
              placeholder={t("transactions.notes_placeholder")}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-300"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="shrink-0 px-5 pt-2" style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 8px))" }}>
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            transition={tapTransition}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("calendar.save_financial_event")}
          </motion.button>
        </div>
      </motion.form>
    </div>,
    document.body
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function CalendarPage() {
  const { t, locale } = useTranslation();
  const { format, symbol } = useCurrency();
  const queryClient = useQueryClient();
  const createTransaction = useCreateTransaction();

  const now = new Date();
  const today = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [addEventDate, setAddEventDate] = useState(today);
  const [swipeDir, setSwipeDir] = useState<"next" | "prev">("next");
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 55;

  const { data: events = [], isLoading, isError } = useCalendar(year, month);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.date) ?? [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    return map;
  }, [events]);

  const selectedEvents = selectedDay ? (eventsByDate.get(selectedDay) ?? []) : [];

  // Calendar grid
  const daysInMonth   = getDaysInMonth(year, month);
  const firstWeekday  = getFirstWeekday(year, month);

  function prevMonth() {
    setSwipeDir("prev");
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    setSwipeDir("next");
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  }

  function handleSwipeTouchStart(e: React.TouchEvent) {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  }

  function handleSwipeTouchEnd(e: React.TouchEvent) {
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    // Only fire for predominantly horizontal swipes
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx) * 0.8) return;
    if (dx < 0) nextMonth();
    else prevMonth();
  }

  function getDefaultEventDate() {
    if (selectedDay) return selectedDay;
    const viewingCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    return viewingCurrentMonth ? today : toDateStr(year, month, 1);
  }

  function openAddEvent(date = getDefaultEventDate()) {
    setAddEventDate(date);
    setShowAddEvent(true);
  }

  async function handleCreateEvent(data: TransactionFormData) {
    await createTransaction.mutateAsync(data);
    const eventDate = new Date(`${data.transaction_date}T00:00:00`);
    setYear(eventDate.getFullYear());
    setMonth(eventDate.getMonth() + 1);
    setSelectedDay(data.transaction_date);
    await queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all, refetchType: "all" });
  }

  // Day abbreviations (Sun→Sat) using Intl
  const dayHeaders = useMemo(() => {
    const base = new Date(2025, 0, 5); // a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(5 + i);
      return d.toLocaleDateString(locale, { weekday: "short" });
    });
  }, [locale]);

  // Month label
  const monthLabel = useMemo(() => {
    return new Date(year, month - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  }, [year, month, locale]);

  // Legend — deduplicate event types present this month
  const activeTypes = useMemo(() => {
    const seen = new Set<CalendarEventType>();
    for (const ev of events) seen.add(ev.type);
    return [...seen];
  }, [events]);

  const hasSidePanel = selectedDay !== null;

  // Hide bottom nav on mobile when day panel is open
  useEffect(() => {
    if (selectedDay) {
      window.dispatchEvent(new CustomEvent("spendix:nav-hide"));
    } else {
      window.dispatchEvent(new CustomEvent("spendix:nav-show"));
    }
    return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
  }, [selectedDay]);

  return (
    <>
      <div className="space-y-5">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10">
              <CalendarCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black t1">{t("calendar.title")}</h1>
              <p className="mt-0.5 text-xs font-medium t3">{t("calendar.subtitle")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openAddEvent()}
              className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 text-sm font-bold text-white transition-colors hover:bg-cyan-400"
            >
              <Plus size={16} />
              {t("calendar.add_financial_event")}
            </button>
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
              <button
                onClick={prevMonth}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold px-3 capitalize min-w-[160px] text-center">{monthLabel}</span>
              <button
                onClick={nextMonth}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Main area: calendar + side panel ──────────────── */}
        <div className={`flex gap-4 ${hasSidePanel ? "lg:grid lg:grid-cols-[1fr_320px]" : ""}`}>
          {/* Calendar grid */}
          <div
            className="flex-1 min-w-0 overflow-hidden"
            onTouchStart={handleSwipeTouchStart}
            onTouchEnd={handleSwipeTouchEnd}
          >
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {dayHeaders.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium t3 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Loading / error */}
            {isLoading && (
              <div className="flex items-center justify-center h-48 text-white/40 text-sm">
                {t("calendar.loading")}
              </div>
            )}
            {isError && !isLoading && (
              <div className="flex items-center justify-center h-48 text-red-400 text-sm">
                {t("calendar.error")}
              </div>
            )}

            {/* Grid — animates in the swipe direction on month change */}
            <AnimatePresence mode="wait" initial={false} custom={swipeDir}>
              {!isLoading && (
                <motion.div
                  key={`${year}-${month}`}
                  custom={swipeDir}
                  variants={{
                    enter: (dir: "next" | "prev") => ({ x: dir === "next" ? 72 : -72, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit:  (dir: "next" | "prev") => ({ x: dir === "next" ? -72 : 72, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "tween", duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="grid grid-cols-7 gap-1"
                >
                  {/* Leading empty cells */}
                  {Array.from({ length: firstWeekday }, (_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}

                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day     = i + 1;
                    const dateStr = toDateStr(year, month, day);
                    const dayEvs  = eventsByDate.get(dateStr) ?? [];
                    const isToday = dateStr === today;
                    const isSel   = dateStr === selectedDay;

                    // Collect unique colors (up to 4 dots)
                    const dotColors = [...new Set(dayEvs.map((e) => e.color))].slice(0, 4);

                    return (
                      <motion.button
                        key={dateStr}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => setSelectedDay(isSel ? null : dateStr)}
                        className={[
                          "relative aspect-square rounded-xl flex flex-col items-center justify-start pt-1.5 px-1 pb-1 transition-colors",
                          isSel  ? "bg-cyan-400/15 ring-1 ring-cyan-400/40"
                                 : isToday ? "bg-emerald-500/15 ring-1 ring-emerald-500/40"
                                 : "hover:bg-[hsl(var(--bg-input))]",
                          dayEvs.length > 0 ? "cursor-pointer" : "cursor-default",
                        ].join(" ")}
                      >
                        <span className={[
                          "text-xs font-semibold leading-none",
                          isToday ? "text-emerald-400"
                                  : isSel ? "text-cyan-300"
                                  : "t2",
                        ].join(" ")}>
                          {day}
                        </span>

                        {/* Dots */}
                        {dotColors.length > 0 && (
                          <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                            {dotColors.map((color, ci) => (
                              <span
                                key={ci}
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Side panel (desktop) */}
          <AnimatePresence>
            {hasSidePanel && (
              <motion.div
                key="side-panel"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="hidden lg:flex flex-col rounded-2xl p-4 overflow-hidden"
                style={{ background: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", minWidth: 280, maxWidth: 320 }}
              >
                <DayPanel
                  dateStr={selectedDay}
                  events={selectedEvents}
                  today={today}
                  onAdd={openAddEvent}
                  onClose={() => setSelectedDay(null)}
                  format={format}
                  t={t}
                  locale={locale}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile bottom sheet + backdrop */}
        <AnimatePresence>
          {hasSidePanel && (
            <>
              {/* Backdrop */}
              <motion.div
                key="cal-bd"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="lg:hidden fixed inset-0 z-[44]"
                style={{ backgroundColor: "rgba(5,8,14,0.72)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
                onClick={() => setSelectedDay(null)}
              />
              {/* Sheet */}
              <motion.div
                key="bottom-sheet"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 32, stiffness: 320 }}
                className="lg:hidden fixed inset-x-0 bottom-0 z-[45] flex flex-col overflow-hidden rounded-t-[1.75rem]"
                style={{
                  background: "hsl(var(--bg-card-2))",
                  border: "1px solid hsl(var(--border))",
                  borderBottom: "none",
                  maxHeight: "72dvh",
                  paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))",
                }}
              >
                <div className="mt-1">
                  <SheetDragHandle onClose={() => setSelectedDay(null)} />
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-3 pt-2">
                  <DayPanel
                    dateStr={selectedDay}
                    events={selectedEvents}
                    today={today}
                    onAdd={openAddEvent}
                    onClose={() => setSelectedDay(null)}
                    format={format}
                    t={t}
                    locale={locale}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Legend ──────────────────────────────────────────── */}
        {activeTypes.length > 0 && (
          <div className="card p-4">
            <p className="text-xs font-medium t3 uppercase tracking-wide mb-3">
              {t("calendar.legend")}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {activeTypes.map((type) => {
                const meta = TYPE_META[type];
                return (
                  <div key={type} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                    <span className="text-xs t2">{t(meta.labelKey)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Event summary strip (month totals) ──────────────── */}
        {events.length > 0 && (
          <MonthSummary events={events} format={format} t={t} />
        )}
      </div>

      <AnimatePresence>
        {showAddEvent && (
          <FinancialEventForm
            initialDate={addEventDate}
            onClose={() => setShowAddEvent(false)}
            onSubmit={handleCreateEvent}
            t={t}
            symbol={symbol}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Month summary ─────────────────────────────────────────────

function MonthSummary({ events, format, t }: { events: CalendarEvent[]; format: (n: number) => string; t: (k: string) => string }) {
  const income     = events.filter((e) => e.type === "income").reduce((s, e) => s + (e.amount ?? 0), 0);
  const expenses   = events.filter((e) => e.type === "expense").reduce((s, e) => s + (e.amount ?? 0), 0);
  const subs       = events.filter((e) => e.type === "subscription").reduce((s, e) => s + (e.amount ?? 0), 0);
  const debtDue    = events.filter((e) => e.type === "debt_due").reduce((s, e) => s + (e.amount ?? 0), 0);
  const investments = events.filter((e) => e.type === "investment").reduce((s, e) => s + (e.amount ?? 0), 0);
  const outflow = expenses + subs + debtDue + investments;
  const monthNet = income - outflow;

  const stats = [
    { labelKey: "calendar.type_income",       value: income,                  color: "#10B981", sign: "+" },
    { labelKey: "calendar.type_expense",      value: expenses,                color: "#F43F5E", sign: "-" },
    { labelKey: "calendar.type_subscription", value: subs,                    color: "#8B5CF6", sign: "-" },
    { labelKey: "calendar.type_debt_due",     value: debtDue,                 color: "#F43F5E", sign: "-" },
    { labelKey: "calendar.type_investment",   value: investments,             color: "#3B82F6", sign: "-" },
    { labelKey: "calendar.month_net",         value: Math.abs(monthNet),      color: monthNet >= 0 ? "#10B981" : "#F43F5E", sign: monthNet >= 0 ? "+" : "-" },
  ].filter((s) => s.value > 0 || s.labelKey === "calendar.month_net");

  if (stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.labelKey}
          className="card p-3 flex flex-col gap-1"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-xs t3">{t(s.labelKey)}</span>
          </div>
          <span className="text-base font-bold number-display t1">{s.sign}{format(s.value)}</span>
        </div>
      ))}
    </div>
  );
}
