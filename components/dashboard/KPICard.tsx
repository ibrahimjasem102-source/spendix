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
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium t2 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold t1 mt-1.5 tracking-tight">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-1.5">
          {isUp
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            : <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          }
          <span className={`text-xs font-medium ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
            {change > 0 ? "+" : ""}{change}%
          </span>
          <span className="text-xs t3">{changeLabel}</span>
        </div>
        <div className="w-24 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={1.5} dot={false} activeDot={false} strokeOpacity={0.8} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <a href={href}
        className="card p-5 hover:shadow-lg hover:border-cyan-400/20 transition-all duration-200 group block">
        {inner}
      </a>
    );
  }

  return (
    <div className="card p-5 hover:shadow-lg transition-all duration-200 group">
      {inner}
    </div>
  );
}
