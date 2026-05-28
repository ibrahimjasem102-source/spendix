"use client";

import { memo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

interface DataPoint { day: number; amount: number }
interface Props { data: DataPoint[] }

function SpendingLineChart({ data }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { format } = useCurrency();

  const gridColor = theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const tickColor = theme === "dark" ? "#4B5563" : "#94A3B8";
  const tooltipBg = theme === "dark" ? "#1a2235" : "#ffffff";
  const tooltipBorder = theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const tooltipText = theme === "dark" ? "#ffffff" : "#0F172A";
  const chartData = data.length > 0 ? data : [];
  const avg = chartData.length > 0
    ? Math.round(chartData.reduce((sum, item) => sum + item.amount, 0) / chartData.length)
    : 0;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold t1">{t("dashboard.daily_spending")}</h3>
          <p className="text-xs t2 mt-0.5">{t("dashboard.last_30_days")}</p>
        </div>
        <div className="text-xs font-medium text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-lg">
          {t("dashboard.avg")} {format(avg)}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} interval={4} />
          <YAxis tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={(value) => format(Number(value))} />
          <Tooltip
            formatter={(value: number) => [format(value), t("dashboard.total_spent")]}
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 12 }}
            labelFormatter={(label) => t("dashboard.day", { day: Number(label) })}
            labelStyle={{ color: tooltipText, fontSize: 12 }}
            itemStyle={{ color: tooltipText }}
            cursor={{ stroke: gridColor }}
          />
          <Area type="monotone" dataKey="amount" stroke="#06B6D4" strokeWidth={2} fill="url(#spendGrad)" dot={false} activeDot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(SpendingLineChart);
