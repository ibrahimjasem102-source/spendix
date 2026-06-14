"use client";

import { useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Banknote, Building2, CreditCard, Wallet, PiggyBank, TrendingUp,
  ChevronRight, Loader2, Plus,
  Receipt, AlertCircle, CheckCircle2,
  Repeat, Landmark,
} from "lucide-react";
import type {
  Account, AccountType, Subscription, Debt, Budget,
  Transaction, TransactionFormData,
} from "@/types";
import { useGuest } from "@/contexts/GuestContext";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import {
  useTransactions, useAccounts, useBudgets,
  useSubscriptions, useDebts,
  useCreateTransaction,
} from "@/lib/query/hooks";
import { ROUTES } from "@/lib/routes";
import CategoryIcon from "@/components/categories/CategoryIcon";
import TransactionForm from "@/components/transactions/TransactionForm";
import TransactionRow from "@/components/transactions/TransactionRow";
import ToastList from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { staggerContainer, staggerItem } from "@/lib/motion";

// â”€â”€ Account type meta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ACCOUNT_META: Record<AccountType, { icon: React.ElementType; color: string }> = {
  cash:        { icon: Banknote,    color: "#10B981" },
  bank:        { icon: Building2,   color: "#3B82F6" },
  credit_card: { icon: CreditCard,  color: "#8B5CF6" },
  wallet:      { icon: Wallet,      color: "#F59E0B" },
  savings:     { icon: PiggyBank,   color: "#06B6D4" },
  investment:  { icon: TrendingUp,  color: "#6366F1" },
};

// â”€â”€ Section header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SectionHeader({ title, href }: { title: string; href: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold t1">{title}</h2>
      <Link
        href={href}
        className="flex items-center gap-0.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        {t("common.view_all")}
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

// â”€â”€ Skeleton row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="card overflow-hidden">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border-2))] last:border-0 animate-pulse"
        >
          <div className="w-7 h-7 rounded-xl bg-[hsl(var(--bg-input))] shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-[hsl(var(--bg-input))] rounded w-2/3" />
            <div className="h-2.5 bg-[hsl(var(--bg-input))] rounded w-1/3" />
          </div>
          <div className="h-3.5 bg-[hsl(var(--bg-input))] rounded w-14" />
        </div>
      ))}
    </div>
  );
}

// â”€â”€ Accounts section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AccountsSection({
  accounts, isLoading, format,
}: {
  accounts: Account[];
  isLoading: boolean;
  format: (n: number) => string;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-36 h-[88px] rounded-xl bg-[hsl(var(--bg-input))] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const totalBalance = accounts.reduce(
    (s, a) => s + (a.balance ?? a.initial_balance),
    0,
  );

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
      {/* Total balance card */}
      {accounts.length > 0 && (
        <Link
          href={ROUTES.accounts}
          className="shrink-0 snap-start w-36 rounded-xl p-3.5 flex flex-col justify-between"
          style={{
            background: "linear-gradient(135deg, rgba(6,182,212,0.18), rgba(6,182,212,0.06))",
            border: "1px solid rgba(6,182,212,0.25)",
          }}
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-cyan-400">
            {t("accounts.total_balance") || t("common.total")}
          </p>
          <div className="mt-auto pt-3">
            <p className="text-base font-bold t1 tabular-nums leading-tight">{format(totalBalance)}</p>
            <p className="text-[10px] t3 mt-0.5">{accounts.length} {t("nav.accounts")}</p>
          </div>
        </Link>
      )}

      {/* Individual account cards */}
      {accounts.map((account) => {
        const meta = ACCOUNT_META[account.type];
        const Icon = meta.icon;
        const balance = account.balance ?? account.initial_balance;
        return (
          <Link
            key={account.id}
            href={ROUTES.accounts}
            className="shrink-0 snap-start w-36 rounded-xl p-3.5 flex flex-col justify-between"
            style={{
              background: `linear-gradient(135deg, ${meta.color}18, ${meta.color}08)`,
              border: `1px solid ${meta.color}25`,
            }}
          >
            <div className="p-1.5 rounded-lg w-fit" style={{ backgroundColor: `${meta.color}20` }}>
              <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
            </div>
            <div className="mt-2">
              <p className="text-[10px] t3 truncate">{account.name}</p>
              <p className="text-sm font-bold t1 tabular-nums truncate">{format(balance)}</p>
            </div>
          </Link>
        );
      })}

      {/* Add account */}
      <Link
        href={ROUTES.accounts}
        className="shrink-0 snap-start w-16 rounded-xl border-2 border-dashed border-[hsl(var(--border))] flex items-center justify-center hover:border-cyan-400/40 transition-colors"
      >
        <Plus className="w-5 h-5 t3" />
      </Link>
    </div>
  );
}

// â”€â”€ Recent transactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RecentTransactions({
  transactions, isLoading,
}: {
  transactions: Transaction[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const recent = useMemo(() => transactions.slice(0, 5), [transactions]);

  if (isLoading) return <SkeletonRows count={4} />;

  if (recent.length === 0) {
    return (
      <div className="card px-4 py-5 text-center">
        <p className="text-xs t3">{t("common.no_data")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recent.map((tx) => (
        <TransactionRow key={tx.id} transaction={tx} density="regular" />
      ))}
    </div>
  );
}

// â”€â”€ Budgets section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BudgetsSection({
  budgets, isLoading, format,
}: {
  budgets: Budget[];
  isLoading: boolean;
  format: (n: number) => string;
}) {
  const { t } = useTranslation();
  const visible = useMemo(
    () => budgets.filter((b) => b.status !== "safe" || budgets.length <= 4).slice(0, 4),
    [budgets],
  );

  if (isLoading) return <SkeletonRows count={3} />;
  if (visible.length === 0) {
    return <div className="card px-4 py-5 text-center"><p className="text-xs t3">{t("common.no_data")}</p></div>;
  }

  return (
    <div className="card overflow-hidden">
      {visible.map((budget) => {
        const barColor =
          budget.status === "over"
            ? "bg-rose-500"
            : budget.status === "near_limit"
            ? "bg-amber-400"
            : "bg-emerald-400";
        return (
          <div
            key={budget.id}
            className="px-4 py-3 border-b border-[hsl(var(--border-2))] last:border-0"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                {budget.category && (
                  <CategoryIcon
                    icon={(budget.category as { icon?: string }).icon}
                    color={budget.category.color}
                    size="xs"
                  />
                )}
                <p className="text-sm font-medium t1 truncate">
                  {budget.category?.name ?? "â€”"}
                </p>
              </div>
              <p className="text-[10px] t3 tabular-nums shrink-0 ms-2">
                {format(budget.spent)} / {format(budget.monthly_limit)}
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-[hsl(var(--bg-input))] overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${barColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(budget.percent, 100)}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// â”€â”€ Subscriptions section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SubscriptionsSection({
  subscriptions, isLoading, format, formatDate,
}: {
  subscriptions: Subscription[];
  isLoading: boolean;
  format: (n: number) => string;
  formatDate: (d: string, o?: Intl.DateTimeFormatOptions) => string;
}) {
  const { t } = useTranslation();
  const active = useMemo(
    () => subscriptions.filter((s) => s.status === "active").slice(0, 4),
    [subscriptions],
  );

  if (isLoading) return <SkeletonRows count={3} />;
  if (active.length === 0) {
    return <div className="card px-4 py-5 text-center"><p className="text-xs t3">{t("common.no_data")}</p></div>;
  }

  const cycleShort: Record<string, string> = {
    weekly: "W", monthly: "M", quarterly: "Q", yearly: "Y",
  };

  return (
    <div className="card overflow-hidden">
      {active.map((sub) => (
        <div
          key={sub.id}
          className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border-2))] last:border-0"
        >
          <div
            className="p-1.5 rounded-lg shrink-0"
            style={{ backgroundColor: sub.color ? `${sub.color}20` : "rgba(168,85,247,0.1)" }}
          >
            <Repeat
              className="w-3.5 h-3.5"
              style={{ color: sub.color ?? "#A855F7" }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium t1 truncate">{sub.name}</p>
            <p className="text-[10px] t3">
              {formatDate(sub.next_billing_date, { month: "short", day: "numeric" })}
            </p>
          </div>
          <div className="text-end shrink-0">
            <p className="text-sm font-bold tabular-nums t1">{format(sub.amount)}</p>
            <p className="text-[10px] t3 uppercase">{cycleShort[sub.billing_cycle] ?? sub.billing_cycle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// â”€â”€ Debts section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DebtsSection({
  debts, isLoading, format,
}: {
  debts: Debt[];
  isLoading: boolean;
  format: (n: number) => string;
}) {
  const { t } = useTranslation();
  const active = useMemo(
    () =>
      debts
        .filter((d) => d.status !== "paid")
        .sort((a, b) => {
          if (a.status === "overdue" && b.status !== "overdue") return -1;
          if (b.status === "overdue" && a.status !== "overdue") return 1;
          return 0;
        })
        .slice(0, 4),
    [debts],
  );

  if (isLoading) return <SkeletonRows count={3} />;
  if (active.length === 0) {
    return <div className="card px-4 py-5 text-center"><p className="text-xs t3">{t("common.no_data")}</p></div>;
  }

  return (
    <div className="card overflow-hidden">
      {active.map((debt) => {
        const isOverdue = debt.status === "overdue";
        const remaining = debt.remaining_amount ?? (debt.total_amount - debt.paid_amount);
        const isPayable = debt.debt_type === "payable";
        return (
          <div
            key={debt.id}
            className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border-2))] last:border-0"
          >
            <div
              className={`p-1.5 rounded-lg shrink-0 ${
                isOverdue ? "bg-rose-400/10" : "bg-orange-400/10"
              }`}
            >
              <Landmark
                className={`w-3.5 h-3.5 ${
                  isOverdue ? "text-rose-400" : "text-orange-400"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium t1 truncate">{debt.person_or_entity}</p>
              <p className="text-[10px] t3">
                {isPayable ? t("debts.payable") : t("debts.receivable")}
              </p>
            </div>
            <p
              className={`text-sm font-bold tabular-nums shrink-0 ${
                isOverdue ? "text-rose-400" : isPayable ? "text-orange-400" : "text-emerald-400"
              }`}
            >
              {format(remaining)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// â”€â”€ Main hub â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TransactionsHub() {
  const { isGuest, isLoading: guestLoading } = useGuest();
  const { t, formatDate } = useTranslation();
  const { format } = useCurrency();
  const { toasts, addToast, dismiss } = useToast();
  const [showForm, setShowForm] = useState(false);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const ready = !guestLoading;
  const dataEnabled = ready && !isGuest;

  const { data: transactions = [], isLoading: txLoading }    = useTransactions(ready);
  const { data: accounts    = [], isLoading: acLoading }     = useAccounts(dataEnabled);
  const { data: budgetsData,      isLoading: bgLoading }     = useBudgets(month, year, isGuest, ready);
  const { data: subscriptions = [], isLoading: subLoading }  = useSubscriptions(dataEnabled);
  const { data: debtsData,        isLoading: deLoading }     = useDebts(dataEnabled);

  const budgets = budgetsData?.budgets ?? [];
  const debts   = debtsData?.debts ?? [];

  const createMut = useCreateTransaction();

  const handleAdd = async (data: TransactionFormData) => {
    try {
      await createMut.mutateAsync(data);
      setShowForm(false);
      addToast(t("transactions.created"), "success");
    } catch {
      addToast(t("transactions.form_error"), "error");
      throw new Error(t("transactions.form_error"));
    }
  };

  // Month stats from transactions
  const { monthIncome, monthExpenses } = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    let monthIncome = 0, monthExpenses = 0;
    for (const tx of transactions) {
      if (!tx.transaction_date.startsWith(prefix)) continue;
      if (tx.type === "income") monthIncome += Number(tx.amount);
      else monthExpenses += Number(tx.amount);
    }
    return { monthIncome, monthExpenses };
  }, [transactions, month, year]);

  if (!ready) {
    return (
      <div className="py-16 flex items-center justify-center t3">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10">
          <Receipt className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black t1">{t("transactions.title")}</h1>
          <p className="mt-0.5 text-xs font-medium t3">{t("transactions.subtitle")}</p>
        </div>
      </div>

      {/* â”€â”€ Monthly quick stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-2"
      >
        <motion.div variants={staggerItem} className="card px-4 py-3">
          <p className="text-[10px] t3 uppercase tracking-wide">{t("transactions.total_income")}</p>
          <p className="text-base font-bold text-emerald-400 tabular-nums mt-0.5">
            +{format(monthIncome)}
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className="card px-4 py-3">
          <p className="text-[10px] t3 uppercase tracking-wide">{t("transactions.total_expenses")}</p>
          <p className="text-base font-bold text-rose-400 tabular-nums mt-0.5">
            -{format(monthExpenses)}
          </p>
        </motion.div>
      </motion.div>

      {/* â”€â”€ Accounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section>
        <SectionHeader title={t("nav.accounts")} href={ROUTES.accounts} />
        <AccountsSection accounts={accounts} isLoading={acLoading} format={format} />
      </section>

      {/* â”€â”€ Recent transactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section>
        <SectionHeader title={t("ledger.title") || t("transactions.title")} href={ROUTES.ledger} />
        <RecentTransactions
          transactions={transactions}
          isLoading={txLoading}
        />
      </section>

      {/* â”€â”€ Budgets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section>
        <SectionHeader title={t("nav.budgets")} href={ROUTES.budgets} />
        <BudgetsSection budgets={budgets} isLoading={bgLoading} format={format} />
      </section>

      {/* â”€â”€ Subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section>
        <SectionHeader title={t("nav.subscriptions")} href={ROUTES.subscriptions} />
        <SubscriptionsSection
          subscriptions={subscriptions}
          isLoading={subLoading}
          format={format}
          formatDate={formatDate}
        />
      </section>

      {/* â”€â”€ Debts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section>
        <SectionHeader title={t("nav.debts")} href={ROUTES.debts} />
        <DebtsSection debts={debts} isLoading={deLoading} format={format} />
      </section>

      {/* â”€â”€ Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showForm && (
        <TransactionForm
          onSubmit={handleAdd}
          onClose={() => setShowForm(false)}
        />
      )}
      <ToastList toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 flex items-center justify-center t3">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      }
    >
      <TransactionsHub />
    </Suspense>
  );
}

