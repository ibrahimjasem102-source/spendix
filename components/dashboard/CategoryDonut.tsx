"use client";

import { memo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

interface Category { name: string; value: number; color: string }
interface Props { data: Category[] }

function CenterLabel({
  viewBox,
  total,
  label,
  format,
}: {
  viewBox?: { cx: number; cy: number };
  total: number;
  label: string;
  format: (amount: number) => string;
}) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <g>
      <text x={cx} y={cy - 6} textAnchor="middle" fill="currentColor" fontSize={18} fontWeight={700}>
        {format(total)}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#6B7280" fontSize={11}>
        {label}
      </text>
    </g>
  );
}

function CategoryDonut({ data }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { format } = useCurrency();

  const tooltipBg = theme === "dark" ? "#1a2235" : "#ffffff";
  const tooltipBorder = theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const tooltipText = theme === "dark" ? "#ffffff" : "#0F172A";
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData = total > 0 ? data : [{ name: t("common.no_data"), value: 1, color: "rgba(148,163,184,0.25)" }];

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold t1">{t("dashboard.by_category")}</h3>
        <p className="text-xs t2 mt-0.5">{t("dashboard.this_month")}</p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={3} dataKey="value" strokeWidth={0}>
            {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
            <CenterLabel total={total} label={t("dashboard.total_spent")} format={format} />
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [format(value), name]}
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 12 }}
            itemStyle={{ color: tooltipText }}
            labelStyle={{ color: tooltipText }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-2 mt-3">
        {total === 0 ? (
          <p className="text-xs t3 text-center py-2">{t("common.no_data")}</p>
        ) : data.slice(0, 4).map((category) => (
          <div key={category.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
              <span className="text-xs t2">{category.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs t3">{Math.round((category.value / total) * 100)}%</span>
              <span className="text-xs font-medium t1">{format(category.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(CategoryDonut);
