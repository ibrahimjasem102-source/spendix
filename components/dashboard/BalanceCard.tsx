"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

interface Props {
  balance: number;
  income: number;
  expenses: number;
}

export default function BalanceCard({ balance, income, expenses }: Props) {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const isPositive = balance >= 0;

  return (
    <div className={`rounded-xl p-6 text-white ${isPositive ? "bg-blue-600" : "bg-red-600"}`}>
      <p className="text-sm font-medium text-white/70 mb-1">{t("dashboard.total_balance")}</p>
      <p className="text-4xl font-bold tracking-tight">{format(balance)}</p>

      <div className="flex gap-6 mt-5 pt-5 border-t border-white/20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs text-white/60">{t("transactions.income")}</p>
            <p className="text-sm font-semibold">{format(income)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <TrendingDown className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs text-white/60">{t("transactions.expense")}</p>
            <p className="text-sm font-semibold">{format(expenses)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
