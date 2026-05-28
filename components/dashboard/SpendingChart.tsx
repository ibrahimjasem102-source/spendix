"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Transaction } from "@/types";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

interface Props {
  transactions: Transaction[];
}

function buildChartData(transactions: Transaction[]) {
  const byCategory: Record<string, { income: number; expense: number }> = {};

  transactions.forEach((transaction) => {
    const key = transaction.category?.name ?? "Uncategorised";
    if (!byCategory[key]) byCategory[key] = { income: 0, expense: 0 };
    byCategory[key][transaction.type] += transaction.amount;
  });

  return Object.entries(byCategory)
    .map(([category, values]) => ({ category, ...values }))
    .sort((a, b) => b.expense - a.expense)
    .slice(0, 6);
}

export default function SpendingChart({ transactions }: Props) {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const data = buildChartData(transactions);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">{t("dashboard.spending_by_category")}</h2>
        <p className="text-sm text-gray-400 text-center py-10">
          {t("dashboard.no_chart_data")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-4">{t("dashboard.spending_by_category")}</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value: number) => format(value)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name={t("transactions.income")} fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name={t("transactions.expense")} fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
