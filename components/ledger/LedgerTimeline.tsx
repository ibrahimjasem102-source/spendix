"use client";

import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  AlertTriangle,
  Briefcase,
  CalendarDays,
  Landmark,
  Minus,
  Pencil,
  RefreshCcw,
  Repeat,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { UnifiedLedgerEntry, LedgerEntryType, ENTRY_CONFIG } from "@/lib/ledger/types";
import { groupByMonth } from "@/lib/ledger/engine";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

const TYPE_ICONS: Record<LedgerEntryType, React.ElementType> = {
  transaction:  ArrowDownRight,
  income:       ArrowUpRight,
  investment:   TrendingUp,
  debt:         Landmark,
  repayment:    RefreshCcw,
  subscription: Repeat,
  salary:       Briefcase,
  transfer:     ArrowLeftRight,
  budget_alert: AlertTriangle,
  ai_insight:   Sparkles,
};

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: UnifiedLedgerEntry;
  onEdit?:   (entry: UnifiedLedgerEntry) => void;
  onDelete?: (entry: UnifiedLedgerEntry) => void;
}) {
  const { format: fmt } = useCurrency();
  const { t, formatDate } = useTranslation();
  const cfg     = ENTRY_CONFIG[entry.type];
  const Icon    = TYPE_ICONS[entry.type];
  const fromCal = entry.metadata?.source_module === "calendar" || entry.tags?.includes("calendar");
  const note    = typeof entry.metadata?.notes === "string" ? entry.metadata.notes.trim() : "";

  const amountColor  = entry.direction === "inflow"  ? "text-emerald-400"
                     : entry.direction === "outflow" ? "text-rose-400"
                     : "text-cyan-400";
  const amountPrefix = entry.direction === "inflow"  ? "+"
                     : entry.direction === "outflow" ? "-"
                     : "";

  const canEdit   = !!onEdit   && !!entry.related_module_id;
  const canDelete = !!onDelete && !!entry.related_module_id;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ backgroundColor: "hsl(var(--bg-card-2))", borderColor: "hsl(var(--border))" }}
    >
      {/* Color stripe */}
      <div className={`absolute inset-y-0 start-0 w-1 ${cfg.bg}`} />

      <div className="flex items-center gap-3 px-3.5 py-3 ms-1">
        {/* Icon */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${cfg.bg}`}>
          <Icon className={`h-[18px] w-[18px] ${cfg.color}`} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-5 t1">{entry.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold leading-none ${cfg.bg} ${cfg.color}`}>
              {t(`ledger.entry_type.${entry.type}`)}
            </span>
            {entry.category && (
              <span
                className="rounded-lg px-2 py-0.5 text-[10px] font-bold leading-none"
                style={{
                  backgroundColor: entry.category_color ? `${entry.category_color}18` : "hsl(var(--bg-input))",
                  color: entry.category_color ?? "hsl(var(--text-3))",
                }}
              >
                {entry.category}
              </span>
            )}
            {fromCal && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold leading-none text-cyan-300">
                <CalendarDays className="h-3 w-3" />
                {t("ledger.financial_calendar")}
              </span>
            )}
            {note && <span className="text-[10px] t3 truncate max-w-[120px]">{note}</span>}
          </div>
        </div>

        {/* Amount + Date + Actions */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <p className={`text-sm font-black tabular-nums ${amountColor}`}>
            {amountPrefix}{fmt(entry.amount)}
          </p>
          <p className="text-[11px] font-medium t3">
            {formatDate(entry.date, { day: "numeric", month: "short" })}
          </p>
          {/* Action buttons — always visible on mobile, hover on desktop */}
          {(canEdit || canDelete) && (
            <div className="flex items-center gap-0.5 mt-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEdit!(entry)}
                  className="h-7 w-7 flex items-center justify-center rounded-xl t3 hover:bg-cyan-400/10 hover:text-cyan-300 transition-colors"
                  title={t("ledger.edit_transaction")}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete!(entry)}
                  className="h-7 w-7 flex items-center justify-center rounded-xl t3 hover:bg-rose-400/10 hover:text-rose-300 transition-colors"
                  title={t("ledger.delete_transaction")}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  entries: UnifiedLedgerEntry[];
  emptyMessage?: string;
  onEdit?:   (entry: UnifiedLedgerEntry) => void;
  onDelete?: (entry: UnifiedLedgerEntry) => void;
  /** @deprecated use onEdit */
  onEditTransaction?: (entry: UnifiedLedgerEntry) => void;
  /** @deprecated use onDelete */
  onDeleteTransaction?: (entry: UnifiedLedgerEntry) => void;
}

export default function LedgerTimeline({
  entries,
  emptyMessage,
  onEdit,
  onDelete,
  onEditTransaction,
  onDeleteTransaction,
}: Props) {
  const { t, formatDate } = useTranslation();
  const { format: fmt } = useCurrency();

  const editHandler   = onEdit   ?? onEditTransaction;
  const deleteHandler = onDelete ?? onDeleteTransaction;

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border px-6 py-16 text-center t3"
        style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--bg-card-2))" }}>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--bg-input))]">
          <Minus className="h-5 w-5 opacity-50" />
        </div>
        <p className="text-sm font-semibold">{emptyMessage ?? t("ledger.empty")}</p>
      </div>
    );
  }

  const groups    = groupByMonth(entries);
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {sortedKeys.map((monthKey) => {
        const monthEntries = groups.get(monthKey)!;
        const monthLabel   = formatDate(`${monthKey}-01`, { month: "long", year: "numeric" });
        const monthInflow  = monthEntries.filter((e) => e.direction === "inflow").reduce((s, e) => s + e.amount, 0);
        const monthOutflow = monthEntries.filter((e) => e.direction === "outflow").reduce((s, e) => s + e.amount, 0);
        const monthNet     = monthInflow - monthOutflow;

        return (
          <div key={monthKey} className="relative">
            <div className="sticky top-0 z-10 -mx-1 mb-3 flex items-center justify-between gap-3 rounded-2xl px-1 py-2 backdrop-blur-md">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black t1">{monthLabel}</h3>
                <p className="text-[11px] font-medium t3">{t("ledger.month_entries", { count: monthEntries.length })}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold">
                {monthInflow  > 0 && <span className="rounded-xl bg-emerald-400/10 px-2 py-1 text-emerald-400">+{fmt(monthInflow)}</span>}
                {monthOutflow > 0 && <span className="rounded-xl bg-rose-400/10    px-2 py-1 text-rose-400">-{fmt(monthOutflow)}</span>}
                <span className={`hidden rounded-xl px-2 py-1 sm:inline-flex ${monthNet >= 0 ? "bg-cyan-400/10 text-cyan-300" : "bg-amber-400/10 text-amber-300"}`}>
                  {monthNet >= 0 ? "+" : ""}{fmt(monthNet)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {monthEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onEdit={editHandler}
                  onDelete={deleteHandler}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
