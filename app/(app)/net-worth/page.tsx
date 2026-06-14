"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Banknote, TrendingUp, AlertCircle, ArrowUpRight,
  ChevronDown, ArrowRight, Scale, Minus, Plus,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useFinancialEngine } from "@/lib/finance/engine";
import { ROUTES } from "@/lib/routes";
import type { Investment, Debt } from "@/types";

// â”€â”€ types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface LineItem {
  id: string;
  name: string;
  amount: number;
  sub?: string;
}

interface Group {
  key: string;
  icon: React.ReactNode;
  amount: number;
  items: LineItem[];
  href: string;
  isAsset: boolean;
}

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function investmentValue(i: Investment): number {
  return Number(i.current_value ?? i.amount_invested);
}

function debtRemaining(d: Debt): number {
  return Math.max(0, Number(d.total_amount) - Number(d.paid_amount));
}

// â”€â”€ GroupCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function GroupCard({ group, label, sub }: { group: Group; label: string; sub: string }) {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const [open, setOpen] = useState(false);

  const accent = group.isAsset
    ? { border: "border-emerald-500/20", bg: "bg-emerald-500/5", iconBg: "bg-emerald-500/20", iconText: "text-emerald-400", amtText: "text-emerald-400", dotBg: "bg-emerald-500" }
    : { border: "border-red-500/20",     bg: "bg-red-500/5",     iconBg: "bg-red-500/20",     iconText: "text-red-400",     amtText: "text-red-400",     dotBg: "bg-red-500"     };

  const noKey = `net_worth.no_${group.key}` as Parameters<typeof t>[0];

  return (
    <div className={`rounded-xl border ${accent.border} ${accent.bg} overflow-hidden`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 text-start hover:bg-white/5 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent.iconBg} ${accent.iconText}`}>
          {group.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-white">{label}</div>
          <div className="text-xs text-white/40 mt-0.5 truncate">{sub}</div>
        </div>
        <div className="text-end shrink-0 me-1">
          <div className={`font-bold text-base ${accent.amtText}`}>{format(group.amount)}</div>
          <div className="text-xs text-white/40 mt-0.5">
            {group.items.length} {t("net_worth.items")}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10">
              {group.items.length === 0 ? (
                <div className="px-4 py-4 text-center text-sm text-white/40">
                  {t(noKey)}
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm text-white/80 truncate">{item.name}</div>
                        {item.sub && <div className="text-xs text-white/40 mt-0.5">{item.sub}</div>}
                      </div>
                      <div className={`font-semibold text-sm shrink-0 ms-3 ${accent.amtText}`}>
                        {format(item.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-4 py-3 border-t border-white/5">
                <Link
                  href={group.href}
                  className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors"
                >
                  {t("net_worth.go_to")}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function NetWorthPage() {
  const { t, formatDate } = useTranslation();
  const { format } = useCurrency();
  // Single source of truth â€” same engine used by Dashboard
  const engine = useFinancialEngine();

  const investments = engine.investments;
  const debts       = engine.debts;
  const isLoading   = engine.isLoading;

  // â”€â”€ Amounts â€” all from engine (identical to Dashboard) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cashTotal       = engine.balance;
  const investTotal     = engine.portfolioValue;
  const receivableTotal = engine.debtReceivable;
  const debtTotal       = engine.debtPayable;

  const totalAssets      = cashTotal + investTotal + receivableTotal;
  const totalLiabilities = debtTotal;
  const netWorth         = totalAssets - totalLiabilities;
  const isPositive       = netWorth >= 0;

  // Stacked-bar widths
  const barTotal = Math.max(totalAssets + totalLiabilities, 0.01);
  const assetPct = Math.round((totalAssets    / barTotal) * 100);
  const liabPct  = 100 - assetPct;

  // â”€â”€ Item lists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const payableDebts    = debts.filter((d) => d.debt_type === "payable"    && d.status !== "paid");
  const receivableDebts = debts.filter((d) => d.debt_type === "receivable" && d.status !== "paid");

  // â”€â”€ Group data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const assetGroups: (Group & { label: string; sub: string })[] = [
    {
      key: "cash", isAsset: true,
      label: t("net_worth.cash"), sub: t("net_worth.cash_sub"),
      icon: <Banknote className="w-5 h-5" />,
      amount: cashTotal,
      href: ROUTES.transactions,
      items: [{ id: "cash-position", name: t("net_worth.cash_position"), amount: cashTotal }],
    },
    {
      key: "investments", isAsset: true,
      label: t("net_worth.investments"), sub: t("net_worth.investments_sub"),
      icon: <TrendingUp className="w-5 h-5" />,
      amount: investTotal,
      href: ROUTES.investments,
      items: investments.map((i) => {
        const val     = investmentValue(i);
        const gain    = i.current_value !== null ? Number(i.current_value) - Number(i.amount_invested) : 0;
        const gainPct = Number(i.amount_invested) > 0
          ? Math.abs(Math.round((gain / Number(i.amount_invested)) * 100))
          : 0;
        const sub = i.current_value !== null && gainPct > 0
          ? t(gain >= 0 ? "net_worth.gain" : "net_worth.loss", { pct: gainPct })
          : undefined;
        return { id: i.id, name: i.asset_name, amount: val, sub };
      }),
    },
    {
      key: "receivables", isAsset: true,
      label: t("net_worth.receivables"), sub: t("net_worth.receivables_sub"),
      icon: <ArrowUpRight className="w-5 h-5" />,
      amount: receivableTotal,
      href: ROUTES.debts,
      items: receivableDebts.map((d) => ({
        id:     d.id,
        name:   d.person_or_entity,
        amount: debtRemaining(d),
        sub:    d.due_date ? t("net_worth.due", { date: formatDate(d.due_date) }) : undefined,
      })),
    },
  ];

  const liabGroups: (Group & { label: string; sub: string })[] = [
    {
      key: "debts", isAsset: false,
      label: t("net_worth.debts"), sub: t("net_worth.debts_sub"),
      icon: <AlertCircle className="w-5 h-5" />,
      amount: debtTotal,
      href: ROUTES.debts,
      items: payableDebts.map((d) => ({
        id:     d.id,
        name:   d.person_or_entity,
        amount: debtRemaining(d),
        sub:    d.due_date ? t("net_worth.due", { date: formatDate(d.due_date) }) : undefined,
      })),
    },
  ];

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

      {/* Header */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
          <Scale className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black t1">{t("net_worth.title")}</h1>
          <p className="mt-0.5 text-xs font-medium t3">{t("net_worth.subtitle")}</p>
        </div>
      </div>

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card p-6 space-y-5"
      >
        {/* Label */}
        <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-widest">
          <Scale className="w-3.5 h-3.5" />
          {t("net_worth.total")}
        </div>

        {/* Big number */}
        {isLoading ? (
          <div className="h-14 w-48 rounded-xl bg-white/10 animate-pulse" />
        ) : (
          <div className={`text-5xl font-black tracking-tight ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
            {!isPositive && "âˆ’"}
            {format(Math.abs(netWorth))}
          </div>
        )}

        {/* Stacked bar */}
        <div className="space-y-2">
          <div className="h-3 rounded-full bg-white/10 overflow-hidden flex gap-px">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${assetPct}%` }}
              transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
              className="h-full bg-emerald-500 rounded-l-full"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${liabPct}%` }}
              transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
              className="h-full bg-red-500 rounded-r-full"
            />
          </div>
          <div className="flex justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span className="text-white/50">{t("net_worth.total_assets")}</span>
              <span className="text-emerald-400 font-semibold">{format(totalAssets)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-red-400 font-semibold">{format(totalLiabilities)}</span>
              <span className="text-white/50">{t("net_worth.total_liabilities")}</span>
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Assets section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            {t("net_worth.assets")}
          </h2>
          <span className="text-emerald-400 font-bold text-sm">{format(totalAssets)}</span>
        </div>

        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))
          : assetGroups.map((g, i) => (
              <motion.div
                key={g.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
              >
                <GroupCard group={g} label={g.label} sub={g.sub} />
              </motion.div>
            ))}
      </section>

      {/* Liabilities section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Minus className="w-4 h-4 text-red-400" />
            {t("net_worth.liabilities")}
          </h2>
          <span className="text-red-400 font-bold text-sm">{format(totalLiabilities)}</span>
        </div>

        {isLoading
          ? Array.from({ length: 1 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))
          : liabGroups.map((g, i) => (
              <motion.div
                key={g.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.06 }}
              >
                <GroupCard group={g} label={g.label} sub={g.sub} />
              </motion.div>
            ))}
      </section>

      {/* Equation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="rounded-xl border border-white/10 bg-white/5 p-5"
      >
        <div className="flex items-center justify-center gap-3 flex-wrap text-sm">
          <div className="text-center">
            <div className="text-emerald-400 font-bold text-lg">{format(totalAssets)}</div>
            <div className="text-white/40 text-xs mt-1">{t("net_worth.assets")}</div>
          </div>
          <span className="text-white/30 text-xl font-thin">âˆ’</span>
          <div className="text-center">
            <div className="text-red-400 font-bold text-lg">{format(totalLiabilities)}</div>
            <div className="text-white/40 text-xs mt-1">{t("net_worth.liabilities")}</div>
          </div>
          <span className="text-white/30 text-xl font-thin">=</span>
          <div className="text-center">
            <div className={`font-bold text-lg ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {!isPositive && "âˆ’"}{format(Math.abs(netWorth))}
            </div>
            <div className="text-white/40 text-xs mt-1">{t("net_worth.total")}</div>
          </div>
        </div>
      </motion.div>

    </div>
  );
}

