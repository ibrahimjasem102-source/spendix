"use client";

import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface Props {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  sparkData: number[];
  sparkColor: string;
  positive?: boolean;
  href?: string;
}

export default function KPICard({
  title, value, change, changeLabel,
  icon: Icon, iconColor, iconBg,
  sparkData, sparkColor, positive, href,
}: Props) {
  const isUp      = positive !== undefined ? positive : change >= 0;
  const chartData = sparkData.map((v, i) => ({ i, v }));

  const inner = (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="w-20 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={1.5} dot={false} activeDot={false} strokeOpacity={0.75} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-[10px] font-semibold t3 uppercase tracking-wide mb-1">{title}</p>
      <p className="text-xl sm:text-2xl font-bold t1 tracking-tight number-display mb-2">{value}</p>

      <div className="flex items-center gap-1.5">
        {isUp
          ? <TrendingUp className="w-3 h-3 text-emerald-400" />
          : <TrendingDown className="w-3 h-3 text-rose-400" />
        }
        <span className={`text-[11px] font-semibold ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
          {change > 0 ? "+" : ""}{change}%
        </span>
        <span className="text-[11px] t3">{changeLabel}</span>
      </div>
    </>
  );

  if (href) {
    return (
      <a href={href}
        className="modern-card p-4 sm:p-5 hover:border-cyan-400/20 transition-all duration-200 group block"
        style={{ borderRadius: 20 }}>
        {inner}
      </a>
    );
  }

  return (
    <div className="modern-card p-4 sm:p-5 transition-all duration-200 group" style={{ borderRadius: 20 }}>
      {inner}
    </div>
  );
}
