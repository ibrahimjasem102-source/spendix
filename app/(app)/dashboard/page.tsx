"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight, ArrowDownRight, ChevronRight,
  TrendingUp, TrendingDown,
  Wallet, Building2, CreditCard, PiggyBank,
  ReceiptText,
} from "lucide-react";
import { useFinancialEngine } from "@/lib/finance/engine";
import { useCurrency } from "@/lib/currency";
import { fadeIn, spring } from "@/lib/motion";
import { EmptyState } from "@/components/ui";
import type { Account, AccountType, Transaction } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CategoryRow {
  name:  string;
  total: number;
  color: string;
}

// ── Data helpers ───────────────────────────────────────────────────────────────

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function currentMonthTxs(txs: Transaction[]) {
  const key = currentMonthKey();
  return txs.filter((t) => t.transaction_date?.startsWith(key));
}

function topCategories(txs: Transaction[], type: "income" | "expense", limit = 4): CategoryRow[] {
  const map = new Map<string, { total: number; color: string }>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const name  = t.category?.name  ?? "Other";
    const color = t.category?.color ?? (type === "income" ? "#10b981" : "#f43f5e");
    const prev  = map.get(name);
    map.set(name, { total: (prev?.total ?? 0) + Number(t.amount), color: prev?.color ?? color });
  }
  return [...map.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([name, v]) => ({ name, total: v.total, color: v.color }));
}

// Account type → icon + fallback hex
const ACCT_META: Record<AccountType, { icon: React.ElementType; hex: string }> = {
  cash:        { icon: Wallet,    hex: "#22d3ee" },
  bank:        { icon: Building2, hex: "#60a5fa" },
  credit_card: { icon: CreditCard, hex: "#f43f5e" },
  wallet:      { icon: Wallet,    hex: "#fbbf24" },
  savings:     { icon: PiggyBank, hex: "#34d399" },
  investment:  { icon: TrendingUp, hex: "#a78bfa" },
};

// ── Skeleton ───────────────────────────────────────────────────────────────────

function DashSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="skeleton h-52 w-full rounded-2xl" />
      <div className="skeleton h-44 w-full rounded-2xl" />
      <div className="skeleton h-44 w-full rounded-2xl" />
      <div className="skeleton h-48 w-full rounded-2xl" />
      <div className="skeleton h-64 w-full rounded-2xl" />
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  href,
  cta = "See all",
}: {
  title: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[11px] font-bold t3 uppercase tracking-[0.14em]">{title}</h2>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-0.5 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {cta}
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// ── Category bars ──────────────────────────────────────────────────────────────

function CategoryBars({
  rows,
  total,
  format,
}: {
  rows:   CategoryRow[];
  total:  number;
  format: (n: number) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-xs t3 py-2">No transactions this month</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const pct = total > 0 ? Math.round((row.total / total) * 100) : 0;
        return (
          <div key={row.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium t2 truncate max-w-[55%]">{row.name}</span>
              <span className="text-[11px] font-bold tabular-nums t1 shrink-0">{format(row.total)}</span>
            </div>
            <div className="h-[3px] rounded-full bg-[hsl(var(--bg-input))]">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: row.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 1. Net Worth ───────────────────────────────────────────────────────────────

function NetWorthSection({
  netWorth,
  accountsTotal,
  portfolioValue,
  debtReceivable,
  debtPayable,
  monthlyIncome,
  monthlyExpenses,
  format,
}: {
  netWorth:        number;
  accountsTotal:   number;
  portfolioValue:  number;
  debtReceivable:  number;
  debtPayable:     number;
  monthlyIncome:   number;
  monthlyExpenses: number;
  format:          (n: number) => string;
}) {
  const isPositive = netWorth >= 0;
  const monthNet   = monthlyIncome - monthlyExpenses;
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const breakdown = [
    { label: "Cash & Accounts", value: accountsTotal,  color: "text-cyan-400"    },
    { label: "Investments",      value: portfolioValue, color: "text-violet-400"  },
    { label: "Receivables",      value: debtReceivable, color: "text-emerald-400" },
    { label: "Debts",            value: -debtPayable,   color: "text-rose-400"    },
  ];

  return (
    <motion.div
      variants={fadeIn} initial="hidden" animate="visible"
      transition={{ ...spring, delay: 0.02 }}
      className="card p-5"
    >
      <SectionHeader title="Net Worth" href="/net-worth" />

      {/* Total */}
      <p
        className={[
          "text-4xl sm:text-5xl font-black tracking-tight number-display leading-none mb-1.5",
          isPositive ? "t1" : "text-rose-400",
        ].join(" ")}
      >
        {isPositive ? "" : "−"}{format(Math.abs(netWorth))}
      </p>

      {/* Month net */}
      <div className="flex items-center gap-1.5 mb-5">
        {monthNet >= 0
          ? <TrendingUp  className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          : <TrendingDown className="h-3.5 w-3.5 text-rose-400 shrink-0" />}
        <span className={`text-sm font-bold ${monthNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {monthNet >= 0 ? "+" : ""}{format(monthNet)}
        </span>
        <span className="text-[11px] t3">{monthLabel}</span>
      </div>

      {/* Breakdown */}
      <div className="space-y-2 border-t border-[hsl(var(--border-2))] pt-4">
        {breakdown.map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[11px] t3">{label}</span>
            <span className={`text-[13px] font-bold tabular-nums ${color}`}>
              {value >= 0 ? "+" : "−"}{format(Math.abs(value))}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── 2. Income ──────────────────────────────────────────────────────────────────

function IncomeSection({
  total,
  savingsRate,
  categories,
  format,
}: {
  total:       number;
  savingsRate: number;
  categories:  CategoryRow[];
  format:      (n: number) => string;
}) {
  return (
    <motion.div
      variants={fadeIn} initial="hidden" animate="visible"
      transition={{ ...spring, delay: 0.06 }}
      className="card p-4"
    >
      <SectionHeader title="Income" href="/transactions?type=income" />

      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[10px] t3 mb-0.5">This month</p>
          <p className="text-3xl font-black text-emerald-400 number-display leading-none">
            {format(total)}
          </p>
        </div>
        {savingsRate > 0 && (
          <span className="px-2.5 py-1 rounded-xl bg-emerald-400/10 text-[11px] font-bold text-emerald-400 shrink-0">
            {savingsRate}% saved
          </span>
        )}
      </div>

      <CategoryBars rows={categories} total={total} format={format} />
    </motion.div>
  );
}

// ── 3. Expenses ────────────────────────────────────────────────────────────────

function ExpensesSection({
  total,
  income,
  categories,
  format,
}: {
  total:      number;
  income:     number;
  categories: CategoryRow[];
  format:     (n: number) => string;
}) {
  const burnPct = income > 0 ? Math.min(100, Math.round((total / income) * 100)) : 0;
  const burnColor =
    burnPct >= 90 ? "bg-rose-400 text-rose-400"
    : burnPct >= 70 ? "bg-amber-400 text-amber-400"
    : "bg-emerald-400 text-emerald-400";
  const [barColor, labelColor] = burnColor.split(" ");

  return (
    <motion.div
      variants={fadeIn} initial="hidden" animate="visible"
      transition={{ ...spring, delay: 0.09 }}
      className="card p-4"
    >
      <SectionHeader title="Expenses" href="/transactions?type=expense" />

      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-[10px] t3 mb-0.5">This month</p>
          <p className="text-3xl font-black text-rose-400 number-display leading-none">
            {format(total)}
          </p>
        </div>
        {income > 0 && (
          <span className={`px-2.5 py-1 rounded-xl bg-[hsl(var(--bg-input))] text-[11px] font-bold shrink-0 ${labelColor}`}>
            {burnPct}% of income
          </span>
        )}
      </div>

      {/* Burn rate bar */}
      {income > 0 && (
        <div className="mb-4">
          <div className="h-[3px] rounded-full bg-[hsl(var(--bg-input))]">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${burnPct}%` }}
            />
          </div>
        </div>
      )}

      <CategoryBars rows={categories} total={total} format={format} />
    </motion.div>
  );
}

// ── 4. Accounts ────────────────────────────────────────────────────────────────

function AccountsSection({
  accounts,
  total,
  format,
}: {
  accounts: Account[];
  total:    number;
  format:   (n: number) => string;
}) {
  const sorted = useMemo(
    () => [...accounts].sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0)),
    [accounts],
  );

  return (
    <motion.div
      variants={fadeIn} initial="hidden" animate="visible"
      transition={{ ...spring, delay: 0.12 }}
      className="card overflow-hidden"
    >
      <div className="px-4 pt-4 pb-0">
        <SectionHeader title="Accounts" href="/accounts" />
      </div>

      {sorted.length === 0 ? (
        <div className="px-4 pb-4">
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            body="Add a cash, bank, or savings account to track your balances."
            action={{ label: "Add account", href: "/accounts" }}
            compact
          />
        </div>
      ) : (
        <>
          <div>
            {sorted.slice(0, 6).map((acct) => {
              const meta    = ACCT_META[acct.type] ?? ACCT_META.cash;
              const Icon    = meta.icon;
              const hex     = acct.color ?? meta.hex;
              const balance = Number(acct.balance) ?? 0;

              return (
                <div
                  key={acct.id}
                  className="flex items-center gap-3 px-4 py-3 border-t border-[hsl(var(--border-2))] hover:bg-[hsl(var(--bg-input))] transition-colors"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${hex}18`, border: `1px solid ${hex}30` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: hex }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold t1 truncate">{acct.name}</p>
                    <p className="text-[10px] t3 capitalize">{acct.type.replace("_", " ")}</p>
                  </div>

                  <span
                    className={[
                      "text-sm font-bold tabular-nums shrink-0",
                      balance < 0 ? "text-rose-400" : "t1",
                    ].join(" ")}
                  >
                    {balance < 0 ? "−" : ""}{format(Math.abs(balance))}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total row */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--bg-card-2))]">
            <span className="text-[11px] font-semibold t3 uppercase tracking-wide">Total</span>
            <span
              className={[
                "text-sm font-black tabular-nums",
                total < 0 ? "text-rose-400" : "text-cyan-400",
              ].join(" ")}
            >
              {total < 0 ? "−" : ""}{format(Math.abs(total))}
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ── 5. Recent Activity ─────────────────────────────────────────────────────────

function RecentActivitySection({
  transactions,
  format,
}: {
  transactions: Transaction[];
  format:       (n: number) => string;
}) {
  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
        .slice(0, 10),
    [transactions],
  );

  return (
    <motion.div
      variants={fadeIn} initial="hidden" animate="visible"
      transition={{ ...spring, delay: 0.15 }}
      className="card overflow-hidden"
    >
      <div className="px-4 pt-4 pb-0">
        <SectionHeader title="Recent Activity" href="/ledger" cta="Full ledger" />
      </div>

      {recent.length === 0 ? (
        <div className="px-4 pb-4">
          <EmptyState
            icon={ReceiptText}
            title="No transactions yet"
            body="Record your first income or expense to start tracking."
            compact
          />
        </div>
      ) : (
        <div>
          {recent.map((tx) => {
            const isIncome = tx.type === "income";
            const date     = new Date(`${tx.transaction_date}T00:00:00`).toLocaleDateString(
              "en-US", { day: "numeric", month: "short" },
            );

            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-4 py-3 border-t border-[hsl(var(--border-2))] hover:bg-[hsl(var(--bg-input))] transition-colors"
              >
                {/* Type icon */}
                <div
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    isIncome ? "bg-emerald-400/10" : "bg-rose-400/10",
                  ].join(" ")}
                >
                  {isIncome
                    ? <ArrowUpRight   className="h-4 w-4 text-emerald-400" />
                    : <ArrowDownRight className="h-4 w-4 text-rose-400" />}
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold t1 truncate">{tx.title}</p>
                  <p className="text-[10px] t3">
                    {tx.category?.name ? `${tx.category.name} · ` : ""}{date}
                  </p>
                </div>

                {/* Amount */}
                <span
                  className={[
                    "text-sm font-bold tabular-nums shrink-0",
                    isIncome ? "text-emerald-400" : "text-rose-400",
                  ].join(" ")}
                >
                  {isIncome ? "+" : "−"}{format(Number(tx.amount))}
                </span>
              </div>
            );
          })}

          {/* Footer link when there are more */}
          {transactions.length > 10 && (
            <div className="border-t border-[hsl(var(--border-2))]">
              <Link
                href="/ledger"
                className="flex items-center justify-center gap-1.5 py-3 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                View all {transactions.length} transactions
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const engine     = useFinancialEngine();
  const { format } = useCurrency();

  const monthTxs          = useMemo(() => currentMonthTxs(engine.transactions), [engine.transactions]);
  const incomeCategories  = useMemo(() => topCategories(monthTxs, "income"),    [monthTxs]);
  const expenseCategories = useMemo(() => topCategories(monthTxs, "expense"),   [monthTxs]);

  if (engine.isLoading) return <DashSkeleton />;

  return (
    <div className="space-y-3">

      {/* 1 — Net Worth */}
      <NetWorthSection
        netWorth={engine.netWorth}
        accountsTotal={engine.accountsTotal}
        portfolioValue={engine.portfolioValue}
        debtReceivable={engine.debtReceivable}
        debtPayable={engine.debtPayable}
        monthlyIncome={engine.monthlyIncome}
        monthlyExpenses={engine.monthlyExpenses}
        format={format}
      />

      {/* 2 — Income */}
      <IncomeSection
        total={engine.monthlyIncome}
        savingsRate={engine.monthlySavingsRate}
        categories={incomeCategories}
        format={format}
      />

      {/* 3 — Expenses */}
      <ExpensesSection
        total={engine.monthlyExpenses}
        income={engine.monthlyIncome}
        categories={expenseCategories}
        format={format}
      />

      {/* 4 — Accounts */}
      <AccountsSection
        accounts={engine.accounts}
        total={engine.accountsTotal}
        format={format}
      />

      {/* 5 — Recent Activity */}
      <RecentActivitySection
        transactions={engine.transactions}
        format={format}
      />

    </div>
  );
}
