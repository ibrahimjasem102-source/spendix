"use client";

import { useState, useMemo } from "react";
import {
  BookOpen, Search, TrendingUp, TrendingDown,
  Wallet, Filter,
} from "lucide-react";
import { useLedger } from "@/contexts/LedgerContext";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { LedgerEntryType, LedgerDirection, LedgerFilters } from "@/lib/ledger/types";
import { filterLedger, sortByDate } from "@/lib/ledger/engine";
import LedgerTimeline from "@/components/ledger/LedgerTimeline";

// ── Filter definitions ────────────────────────────────────────
const TYPE_TABS: { label: string; value: LedgerEntryType | "all" }[] = [
  { label: "common.all", value: "all" },
  { label: "transactions.income", value: "income" },
  { label: "transactions.expense", value: "transaction" },
  { label: "nav.investments", value: "investment" },
  { label: "nav.debts", value: "debt" },
];

const DIRECTION_OPTS: { label: string; value: LedgerDirection | "all" }[] = [
  { label: "ledger.all_flows", value: "all" },
  { label: "ledger.inflow_only", value: "inflow" },
  { label: "ledger.outflow_only", value: "outflow" },
];

export default function LedgerPage() {
  const { entries, balance, cashflow } = useLedger();
  const { format } = useCurrency();
  const { t } = useTranslation();

  const [filters, setFilters] = useState<LedgerFilters>({ type: "all", direction: "all" });
  const [search, setSearch]   = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const visible = useMemo(() =>
    sortByDate(filterLedger(entries, { ...filters, search: search.trim() || undefined })),
    [entries, filters, search]
  );

  function setType(type: LedgerEntryType | "all") {
    setFilters((p) => ({ ...p, type }));
  }
  function setDirection(direction: LedgerDirection | "all") {
    setFilters((p) => ({ ...p, direction }));
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-400/10">
            <BookOpen className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold t1">{t("ledger.title")}</h1>
            <p className="text-xs t3 mt-0.5">{t("ledger.total_entries", { count: entries.length })}</p>
          </div>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
            showFilters
              ? "bg-cyan-400/10 text-cyan-400 border-cyan-400/30"
              : "t2 border-[hsl(var(--border))] hover:t1 bg-[hsl(var(--bg-input))]"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />{t("ledger.filters")}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: t("transactions.net"),
            value: format(balance),
            icon: Wallet,
            color: balance >= 0 ? "text-cyan-400"    : "text-rose-400",
            bg:    balance >= 0 ? "bg-cyan-400/10"    : "bg-rose-400/10",
          },
          {
            label: t("ledger.total_inflow"),
            value: format(cashflow.totalInflow),
            icon: TrendingUp,
            color: "text-emerald-400",
            bg:    "bg-emerald-400/10",
          },
          {
            label: t("ledger.total_outflow"),
            value: format(cashflow.totalOutflow),
            icon: TrendingDown,
            color: "text-rose-400",
            bg:    "bg-rose-400/10",
          },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs t3 uppercase tracking-wide font-medium">{s.label}</p>
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card p-4 space-y-3">
          <div>
            <p className="text-xs t3 uppercase tracking-wide font-medium mb-2">{t("ledger.direction")}</p>
            <div className="flex gap-2 flex-wrap">
              {DIRECTION_OPTS.map((opt) => (
                <button key={opt.value} onClick={() => setDirection(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filters.direction === opt.value
                      ? "bg-cyan-400/10 text-cyan-400 border-cyan-400/30"
                      : "t2 border-[hsl(var(--border))] hover:t1 bg-[hsl(var(--bg-input))]"
                  }`}>
                  {t(opt.label)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs t3 mb-1">{t("ledger.from_date")}</label>
              <input type="date" value={filters.dateFrom ?? ""} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value || undefined }))} className="field text-sm" />
            </div>
            <div>
              <label className="block text-xs t3 mb-1">{t("ledger.to_date")}</label>
              <input type="date" value={filters.dateTo ?? ""} onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value || undefined }))} className="field text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Type tabs + search */}
      <div className="space-y-3">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TYPE_TABS.map((tab) => (
            <button key={tab.value} onClick={() => setType(tab.value)}
              className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                filters.type === tab.value
                  ? "bg-cyan-400/10 text-cyan-400"
                  : "t3 hover:t2 hover:bg-[hsl(var(--bg-input))]"
              }`}>
              {t(tab.label)}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 t3" />
          <input
            type="text" placeholder={t("ledger.search")}
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="field ps-9"
          />
        </div>
      </div>

      {/* Showing count */}
      {(search || filters.type !== "all" || filters.direction !== "all") && (
        <p className="text-xs t3 px-1">
          {t("ledger.showing", { visible: visible.length, total: entries.length })}
          {search && <span className="text-cyan-400"> {t("ledger.matching", { query: search })}</span>}
        </p>
      )}

      {/* Timeline */}
      <LedgerTimeline entries={visible} />
    </div>
  );
}
