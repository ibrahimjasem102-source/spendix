"use client";

import {
  ArrowUpRight, ArrowDownRight, TrendingUp,
  Landmark, RefreshCcw, AlertTriangle, Sparkles, Minus,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { UnifiedLedgerEntry, LedgerEntryType, ENTRY_CONFIG } from "@/lib/ledger/types";
import { groupByMonth } from "@/lib/ledger/engine";
import { useCurrency } from "@/lib/currency";

// ── Icon per type ─────────────────────────────────────────────
const TYPE_ICONS: Record<LedgerEntryType, React.ElementType> = {
  transaction:  ArrowDownRight,
  income:       ArrowUpRight,
  investment:   TrendingUp,
  debt:         Landmark,
  repayment:    RefreshCcw,
  budget_alert: AlertTriangle,
  ai_insight:   Sparkles,
};

function EntryRow({ entry }: { entry: UnifiedLedgerEntry }) {
  const { format: fmt } = useCurrency();
  const cfg  = ENTRY_CONFIG[entry.type];
  const Icon = TYPE_ICONS[entry.type];

  const amountColor =
    entry.direction === "inflow"  ? "text-emerald-400" :
    entry.direction === "outflow" ? "text-rose-400"    : "text-cyan-400";

  const amountPrefix =
    entry.direction === "inflow"  ? "+" :
    entry.direction === "outflow" ? "-"  : "";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-l-2 ${cfg.border} hover:bg-[hsl(var(--bg-input))] transition-colors group`}>
      {/* Icon */}
      <div className={`p-2 rounded-xl shrink-0 ${cfg.bg}`}>
        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium t1 truncate">{entry.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
          {entry.category && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-md font-medium"
              style={{
                backgroundColor: entry.category_color ? `${entry.category_color}18` : undefined,
                color: entry.category_color ?? "#9CA3AF",
              }}
            >
              {entry.category}
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold tabular-nums ${amountColor}`}>
          {amountPrefix}{fmt(entry.amount)}
        </p>
        <p className="text-xs t3 mt-0.5">
          {format(parseISO(entry.date + "T00:00:00"), "d MMM")}
        </p>
      </div>
    </div>
  );
}

interface Props {
  entries: UnifiedLedgerEntry[];
  emptyMessage?: string;
}

export default function LedgerTimeline({ entries, emptyMessage }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 t3">
        <Minus className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">{emptyMessage ?? "No entries found."}</p>
      </div>
    );
  }

  const groups = groupByMonth(entries);
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {sortedKeys.map((monthKey) => {
        const monthEntries = groups.get(monthKey)!;
        const monthLabel   = format(parseISO(`${monthKey}-01`), "MMMM yyyy");
        const monthInflow  = monthEntries.filter((e) => e.direction === "inflow").reduce((s, e) => s + e.amount, 0);
        const monthOutflow = monthEntries.filter((e) => e.direction === "outflow").reduce((s, e) => s + e.amount, 0);

        return (
          <div key={monthKey}>
            {/* Month header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold t1">{monthLabel}</h3>
                <span className="text-xs t3">{monthEntries.length} entries</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {monthInflow  > 0 && <span className="text-emerald-400">+€{monthInflow.toFixed(0)}</span>}
                {monthOutflow > 0 && <span className="text-rose-400">-€{monthOutflow.toFixed(0)}</span>}
              </div>
            </div>

            {/* Entries */}
            <div className="space-y-1.5">
              {monthEntries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
