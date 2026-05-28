"use client";

import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO, startOfMonth } from "date-fns";
import { Transaction } from "@/types";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

interface Props {
  transactions: Transaction[];
}

function buildMonthlyData(transactions: Transaction[]) {
  const byMonth: Record<string, { income: number; expenses: number }> = {};

  transactions.forEach((transaction) => {
    const key = format(startOfMonth(parseISO(transaction.transaction_date)), "yyyy-MM");
    if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0 };
    if (transaction.type === "income") byMonth[key].income += transaction.amount;
    else byMonth[key].expenses += transaction.amount;
  });

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, values]) => ({
      month: format(parseISO(`${key}-01`), "MMM yy"),
      ...values,
    }));
}

export default function MonthlyChart({ transactions }: Props) {
  const { t } = useTranslation();
  const { format: formatMoney } = useCurrency();
  const data = buildMonthlyData(transactions);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full">
      <h2 className="font-semibold text-gray-900 mb-4">{t("dashboard.monthly_overview")}</h2>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">
          {t("common.no_data")}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 0, right: 4, left: -8, bottom: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatMoney(Number(value))}
            />
            <Tooltip formatter={(value: number) => formatMoney(value)} cursor={{ fill: "#f9fafb" }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="income" name={t("transactions.income")} fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="expenses" name={t("transactions.expense")} fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
