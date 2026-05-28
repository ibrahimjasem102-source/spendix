"use client";

import { TrendingUp, TrendingDown, Wallet, Activity } from "lucide-react";
import { DashboardStats } from "@/types";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

interface Props {
  stats: DashboardStats;
}

export default function StatsCards({ stats }: Props) {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const cards = [
    {
      label: t("transactions.net"),
      value: format(stats.totalBalance),
      icon: Wallet,
      color: stats.totalBalance >= 0 ? "text-blue-600" : "text-red-600",
      bg: stats.totalBalance >= 0 ? "bg-blue-50" : "bg-red-50",
    },
    {
      label: t("transactions.total_income"),
      value: format(stats.totalIncome),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: t("transactions.total_expenses"),
      value: format(stats.totalExpenses),
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: t("nav.transactions"),
      value: stats.transactionCount.toString(),
      icon: Activity,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500 font-medium">{card.label}</p>
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
