"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  ArrowDownRight, ArrowUpRight, BarChart3, CircleDollarSign, TrendingUp, Landmark, Briefcase,
  Sparkles, Bot, Settings, Bell, Target, Goal,
  ChevronRight, LockKeyhole, WalletCards,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import {
  useBudgets,
  useDebts,
  useInvestments,
  useNotifications,
  useTransactions,
  useWorkPayments,
  useWorkSessions,
} from "@/lib/query/hooks";
import { useGuest } from "@/contexts/GuestContext";
import { getRoomForPath, useRoomLocks } from "@/contexts/RoomLockContext";

const GROUPS = [
  {
    labelKey:    "nav.finance",
    description: "more.desc_finance",
    items: [
      { href: "/analytics",   icon: BarChart3,  labelKey: "nav.analytics",   desc: "more.desc_analytics",   color: "text-blue-400",    bg: "bg-blue-400/10"    },
      { href: "/investments", icon: TrendingUp, labelKey: "nav.investments", desc: "more.desc_investments", color: "text-purple-400",  bg: "bg-purple-400/10"  },
      { href: "/debts",       icon: Landmark,   labelKey: "nav.debts",       desc: "more.desc_debts",       color: "text-rose-400",    bg: "bg-rose-400/10"    },
      { href: "/work",        icon: Briefcase,  labelKey: "nav.work",        desc: "more.desc_work",        color: "text-cyan-400",    bg: "bg-cyan-400/10"    },
      { href: "/budgets",     icon: Target,     labelKey: "nav.budgets",     desc: "more.desc_budgets",     color: "text-emerald-400", bg: "bg-emerald-400/10" },
      { href: "/goals",       icon: Goal,       labelKey: "nav.goals",       desc: "more.desc_goals",       color: "text-amber-400",   bg: "bg-amber-400/10"   },
    ],
  },
  {
    labelKey:    "nav.ai_section",
    description: "more.desc_ai",
    items: [
      { href: "/ai-insights",  icon: Sparkles, labelKey: "nav.ai_insights",  desc: "more.desc_ai_insights",  color: "text-cyan-400",   bg: "bg-cyan-400/10"   },
      { href: "/ai-assistant", icon: Bot,      labelKey: "nav.ai_assistant", desc: "more.desc_ai_assistant", color: "text-purple-400", bg: "bg-purple-400/10" },
    ],
  },
  {
    labelKey:    "nav.system",
    description: "more.desc_system",
    items: [
      { href: "/notifications", icon: Bell,     labelKey: "nav.notifications", desc: "more.desc_notifications", color: "text-amber-400", bg: "bg-amber-400/10" },
      { href: "/settings",      icon: Settings, labelKey: "nav.settings",      desc: "more.desc_settings",      color: "text-gray-400",  bg: "bg-gray-400/10"  },
    ],
  },
];

export default function MorePage() {
  const { t }       = useTranslation();
  const { format }  = useCurrency();
  const pathname    = usePathname();
  const { isGuest, isLoading: guestLoading } = useGuest();
  const { isRoomLocked, isRoomUnlocked } = useRoomLocks();
  const { data: notifData } = useNotifications(!isGuest);
  const unread = notifData?.unreadCount ?? 0;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: transactions = [] } = useTransactions(isGuest, !guestLoading);
  const { data: budgetData } = useBudgets(month, year, isGuest, !guestLoading);
  const { data: debtsData } = useDebts(isGuest, !guestLoading);
  const { data: investments = [] } = useInvestments(!isGuest && !guestLoading);
  const { data: workSessions = [] } = useWorkSessions(!isGuest && !guestLoading);
  const { data: workPayments = [] } = useWorkPayments(!isGuest && !guestLoading);

  const finance = useMemo(() => {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const monthTransactions = transactions.filter((tx) => tx.transaction_date?.startsWith(monthKey));
    const income = monthTransactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const expenses = monthTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const portfolio = investments.reduce(
      (sum, inv) => sum + Number(inv.current_value ?? inv.amount_invested ?? 0),
      0
    );
    const debtRemaining = (debtsData?.debts ?? [])
      .filter((debt) => debt.debt_type === "payable")
      .reduce((sum, debt) => sum + Math.max(0, Number(debt.total_amount) - Number(debt.paid_amount)), 0);
    const receivableRemaining = (debtsData?.debts ?? [])
      .filter((debt) => debt.debt_type === "receivable")
      .reduce((sum, debt) => sum + Math.max(0, Number(debt.total_amount) - Number(debt.paid_amount)), 0);
    const workExpected = workSessions
      .filter((session) => session.work_date?.startsWith(monthKey))
      .reduce((sum, session) => sum + Number(session.expected_amount || 0), 0);
    const workReceived = workPayments
      .filter((payment) => payment.payment_date?.startsWith(monthKey))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      income,
      expenses,
      net: income - expenses,
      portfolio,
      debtRemaining,
      receivableRemaining,
      workExpected,
      workReceived,
      budget: budgetData?.summary,
      recentTransactions: monthTransactions.slice(0, 3),
    };
  }, [budgetData?.summary, debtsData?.debts, investments, month, transactions, workPayments, workSessions, year]);

  const financeMeta: Record<string, string> = {
    "/analytics": format(finance.net),
    "/investments": format(finance.portfolio),
    "/debts": format(finance.debtRemaining),
    "/work": format(finance.workReceived || finance.workExpected),
    "/budgets": format(finance.budget?.totalBudget ?? 0),
    "/goals": "",
  };

  const overviewCards = [
    {
      label: t("more.month_income"),
      value: format(finance.income),
      icon: ArrowUpRight,
      tone: "text-emerald-300 bg-emerald-400/10",
    },
    {
      label: t("more.month_expenses"),
      value: format(finance.expenses),
      icon: ArrowDownRight,
      tone: "text-rose-300 bg-rose-400/10",
    },
    {
      label: t("more.net_cashflow"),
      value: format(finance.net),
      icon: CircleDollarSign,
      tone: finance.net >= 0 ? "text-cyan-300 bg-cyan-400/10" : "text-amber-300 bg-amber-400/10",
    },
    {
      label: t("more.budget_used"),
      value: `${Math.round(((finance.budget?.totalSpent ?? 0) / Math.max(finance.budget?.totalBudget ?? 0, 1)) * 100)}%`,
      icon: Target,
      tone: "text-emerald-300 bg-emerald-400/10",
    },
  ];

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold t1">{t("nav.more")}</h1>
        <p className="text-xs sm:text-sm t3 mt-0.5">{t("more.subtitle")}</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em]">
              {t("more.finance_overview")}
            </p>
            <p className="text-xs t3 mt-0.5">{t("more.finance_overview_desc")}</p>
          </div>
          <WalletCards className="h-4 w-4 text-cyan-300" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {overviewCards.map((card) => (
            <div key={card.label} className="card p-3 min-h-[92px]">
              <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-xl ${card.tone}`}>
                <card.icon className="h-4 w-4" />
              </div>
              <p className="text-[10px] font-semibold t3 leading-tight">{card.label}</p>
              <p className="mt-1 truncate text-sm font-black t1">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link href="/debts" className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card-2))] p-3 pressable">
            <p className="text-[10px] font-semibold t3">{t("more.receivables")}</p>
            <p className="mt-1 truncate text-sm font-bold text-emerald-300">{format(finance.receivableRemaining)}</p>
          </Link>
          <Link href="/work" className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card-2))] p-3 pressable">
            <p className="text-[10px] font-semibold t3">{t("more.work_expected")}</p>
            <p className="mt-1 truncate text-sm font-bold text-cyan-300">{format(finance.workExpected)}</p>
          </Link>
        </div>

        {finance.recentTransactions.length > 0 && (
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border-2))]">
              <p className="text-xs font-bold t1">{t("more.recent_finance")}</p>
              <Link href="/transactions" className="text-xs font-semibold text-cyan-300">
                {t("common.view_all")}
              </Link>
            </div>
            {finance.recentTransactions.map((tx) => (
              <Link
                key={tx.id}
                href="/transactions"
                className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(var(--border-2))] last:border-0 pressable"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold t1">{tx.title}</p>
                  <p className="text-[10px] t3">{tx.transaction_date}</p>
                </div>
                <p className={`shrink-0 text-sm font-black ${tx.type === "income" ? "text-emerald-300" : "text-rose-300"}`}>
                  {tx.type === "income" ? "+" : "-"}{format(Number(tx.amount))}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {GROUPS.map((group) => (
        <div key={group.labelKey}>
          {/* Group header */}
          <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em] px-1 mb-2">
            {t(group.labelKey)}
          </p>

          {/* Items list */}
          <div className="card overflow-hidden divide-y divide-[hsl(var(--border-2))]">
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const badge    = item.href === "/notifications" ? unread : 0;
              const room     = getRoomForPath(item.href);
              const locked   = isRoomLocked(room) && !isRoomUnlocked(room);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 sm:py-3.5 transition-all pressable ${
                    isActive ? "bg-[hsl(var(--bg-card-2))]" : "hover:bg-[hsl(var(--bg-input))]"
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}>
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                  </div>

                  {/* Labels */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-tight ${isActive ? "t1" : "t1"}`}>
                      {t(item.labelKey)}
                    </p>
                    <p className="text-xs t3 mt-0.5 leading-tight">
                      {t(item.desc)}
                    </p>
                  </div>

                  {/* Badge */}
                  {badge > 0 && (
                    <span className="text-[10px] font-bold bg-rose-400/10 text-rose-400 px-2 py-0.5 rounded-full min-w-[20px] text-center shrink-0">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}

                  {financeMeta[item.href] && (
                    <span className="hidden sm:inline shrink-0 max-w-[120px] truncate text-xs font-bold t2">
                      {financeMeta[item.href]}
                    </span>
                  )}

                  {locked && (
                    <LockKeyhole className="w-4 h-4 shrink-0 text-amber-300" />
                  )}

                  {/* Active / Chevron */}
                  {isActive
                    ? <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 t3 shrink-0" />
                  }
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
