"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, CalendarDays, ExternalLink,
  TrendingUp, TrendingDown, Receipt, RefreshCw, CreditCard,
  Landmark, Briefcase, DollarSign, X,
} from "lucide-react";
import { useCalendar } from "@/lib/query/hooks";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring } from "@/lib/motion";
import Link from "next/link";
import type { CalendarEvent, CalendarEventType } from "@/types";

// ── Event type meta ───────────────────────────────────────────

const TYPE_META: Record<CalendarEventType, { color: string; labelKey: string; Icon: React.ElementType }> = {
  income:       { color: "#10B981", labelKey: "calendar.type_income",       Icon: TrendingUp   },
  expense:      { color: "#F43F5E", labelKey: "calendar.type_expense",      Icon: TrendingDown },
  bill_due:     { color: "#F59E0B", labelKey: "calendar.type_bill_due",     Icon: Receipt      },
  bill_paid:    { color: "#10B981", labelKey: "calendar.type_bill_paid",    Icon: Receipt      },
  bill_overdue: { color: "#EF4444", labelKey: "calendar.type_bill_overdue", Icon: Receipt      },
  subscription: { color: "#8B5CF6", labelKey: "calendar.type_subscription", Icon: RefreshCw    },
  debt_due:     { color: "#F43F5E", labelKey: "calendar.type_debt_due",     Icon: CreditCard   },
  investment:   { color: "#3B82F6", labelKey: "calendar.type_investment",   Icon: Landmark     },
  work_session: { color: "#06B6D4", labelKey: "calendar.type_work_session", Icon: Briefcase    },
  work_payment: { color: "#10B981", labelKey: "calendar.type_work_payment", Icon: DollarSign   },
};

const SOURCE_LABEL_MAP: Record<string, string> = {
  transaction:  "calendar.source_transaction",
  bill:         "calendar.source_bill",
  subscription: "calendar.source_subscription",
  debt:         "calendar.source_debt",
  investment:   "calendar.source_investment",
  work:         "calendar.source_work",
};

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
      className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
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
        <p className="text-sm font-medium text-white leading-tight truncate">{event.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-xs px-1.5 py-0.5 rounded-md font-medium"
            style={{ backgroundColor: color + "22", color }}
          >
            {t(meta?.labelKey ?? "calendar.type_expense")}
          </span>
          {event.source && (
            <span className="text-xs text-white/40">
              {t(SOURCE_LABEL_MAP[event.source] ?? "calendar.source_transaction")}
            </span>
          )}
        </div>
      </div>

      {/* Amount + link */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {event.amount != null && (
          <span className="text-sm font-semibold" style={{ color }}>
            {format(event.amount)}
          </span>
        )}
        {event.action_url && (
          <Link href={event.action_url} className="text-white/30 hover:text-white/70 transition-colors">
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
  onClose,
  format,
  t,
  locale,
}: {
  dateStr: string | null;
  events: CalendarEvent[];
  today: string;
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
        <div className={`flex-1 min-w-0 ${isToday ? "text-emerald-400" : "text-white"}`}>
          <p className="text-sm font-semibold capitalize leading-tight">{label}</p>
          {isToday && (
            <p className="text-xs text-emerald-400/70 mt-0.5">{t("calendar.today")}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white/60"
        >
          <X size={14} />
        </button>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-white/30">
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

// ── Main page ─────────────────────────────────────────────────

export default function CalendarPage() {
  const { t, locale } = useTranslation();
  const { format } = useCurrency();

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const today = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());

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
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
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

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t("calendar.title")}</h1>
            <p className="text-sm text-white/50 mt-0.5">{t("calendar.subtitle")}</p>
          </div>
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

        {/* ── Main area: calendar + side panel ──────────────── */}
        <div className={`flex gap-4 ${hasSidePanel ? "lg:grid lg:grid-cols-[1fr_320px]" : ""}`}>
          {/* Calendar grid */}
          <div className="flex-1 min-w-0">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {dayHeaders.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-white/40 uppercase tracking-wide">
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

            {/* Grid */}
            {!isLoading && (
              <div className="grid grid-cols-7 gap-1">
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

                  // Collect unique colors (up to 3 dots)
                  const dotColors = [...new Set(dayEvs.map((e) => e.color))].slice(0, 4);

                  return (
                    <motion.button
                      key={dateStr}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => setSelectedDay(isSel ? null : dateStr)}
                      className={[
                        "relative aspect-square rounded-xl flex flex-col items-center justify-start pt-1.5 px-1 pb-1 transition-colors",
                        isSel  ? "bg-indigo-600/40 ring-1 ring-indigo-500/60"
                               : isToday ? "bg-emerald-500/15 ring-1 ring-emerald-500/40"
                               : "hover:bg-white/5",
                        dayEvs.length > 0 ? "cursor-pointer" : "cursor-default",
                      ].join(" ")}
                    >
                      <span className={[
                        "text-xs font-semibold leading-none",
                        isToday ? "text-emerald-400"
                                : isSel ? "text-indigo-300"
                                : "text-white/80",
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
              </div>
            )}
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
                className="hidden lg:flex flex-col bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden"
                style={{ minWidth: 280, maxWidth: 320 }}
              >
                <DayPanel
                  dateStr={selectedDay}
                  events={selectedEvents}
                  today={today}
                  onClose={() => setSelectedDay(null)}
                  format={format}
                  t={t}
                  locale={locale}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile bottom sheet */}
        <AnimatePresence>
          {hasSidePanel && (
            <motion.div
              key="bottom-sheet"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#12121A] border-t border-white/10 rounded-t-3xl p-5 max-h-[65vh] flex flex-col"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
            >
              {/* Drag handle */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
              <DayPanel
                dateStr={selectedDay}
                events={selectedEvents}
                today={today}
                onClose={() => setSelectedDay(null)}
                format={format}
                t={t}
                locale={locale}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Legend ──────────────────────────────────────────── */}
        {activeTypes.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wide mb-3">
              {t("calendar.legend")}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {activeTypes.map((type) => {
                const meta = TYPE_META[type];
                return (
                  <div key={type} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                    <span className="text-xs text-white/60">{t(meta.labelKey)}</span>
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
    </div>
  );
}

// ── Month summary ─────────────────────────────────────────────

function MonthSummary({ events, format, t }: { events: CalendarEvent[]; format: (n: number) => string; t: (k: string) => string }) {
  const income     = events.filter((e) => e.type === "income").reduce((s, e) => s + (e.amount ?? 0), 0);
  const billsDue   = events.filter((e) => e.type === "bill_due" || e.type === "bill_overdue").reduce((s, e) => s + (e.amount ?? 0), 0);
  const subs       = events.filter((e) => e.type === "subscription").reduce((s, e) => s + (e.amount ?? 0), 0);
  const investments = events.filter((e) => e.type === "investment").reduce((s, e) => s + (e.amount ?? 0), 0);

  const stats = [
    { labelKey: "calendar.type_income",       value: income,      color: "#10B981" },
    { labelKey: "calendar.type_bill_due",      value: billsDue,    color: "#F59E0B" },
    { labelKey: "calendar.type_subscription",  value: subs,        color: "#8B5CF6" },
    { labelKey: "calendar.type_investment",    value: investments, color: "#3B82F6" },
  ].filter((s) => s.value > 0);

  if (stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.labelKey}
          className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-1"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-white/50">{t(s.labelKey)}</span>
          </div>
          <span className="text-base font-bold text-white">{format(s.value)}</span>
        </div>
      ))}
    </div>
  );
}
