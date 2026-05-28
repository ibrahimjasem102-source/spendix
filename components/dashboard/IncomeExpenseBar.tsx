"use client";

import { memo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

interface DataPoint { month: string; income: number; expenses: number; savings: number }
interface Props { data: DataPoint[] }

function IncomeExpenseBar({ data }: Props) {
  const { theme } = useTheme();
  const { t, locale } = useTranslation();
  const { format } = useCurrency();

  const gridColor = theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tickColor = theme === "dark" ? "#4B5563" : "#94A3B8";
  const tooltipBg = theme === "dark" ? "#1a2235" : "#ffffff";
  const tooltipBorder = theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const tooltipText = theme === "dark" ? "#ffffff" : "#0F172A";
  const cursorFill = theme === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)";
  const localeTag = locale === "ar" ? "ar" : locale === "de" ? "de-DE" : "en-US";
  const formatMonth = (value: string) => {
    const [year, month] = value.split("-").map(Number);
    if (!year || !month) return value;
    return new Date(year, month - 1, 1).toLocaleDateString(localeTag, { month: "short" });
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold t1">{t("dashboard.income_vs_expenses")}</h3>
          <p className="text-xs t2 mt-0.5">{t("dashboard.last_6_months")}</p>
        </div>
        <div className="flex items-center gap-4 text-xs t2">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />{t("transactions.income")}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400" />{t("transactions.expense")}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -16, bottom: 0 }} barGap={4} barSize={16}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={formatMonth} />
          <YAxis tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={(value) => format(Number(value))} />
          <Tooltip
            formatter={(value: number, name: string) => [format(value), name]}
            labelFormatter={(label) => formatMonth(String(label))}
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 12 }}
            labelStyle={{ color: tooltipText, fontSize: 12 }}
            itemStyle={{ color: tooltipText }}
            cursor={{ fill: cursorFill }}
          />
          <Bar dataKey="income" name={t("transactions.income")} fill="#10B981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name={t("transactions.expense")} fill="#F43F5E" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(IncomeExpenseBar);
