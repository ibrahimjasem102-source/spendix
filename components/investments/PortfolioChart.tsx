"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCurrency } from "@/lib/currency";

interface DataPoint { month: string; value: number }
interface Props { data: DataPoint[] }

export default function PortfolioChart({ data }: Props) {
  const { format } = useCurrency();

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#8B5CF6" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#4B5563" }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: "#4B5563" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          }
        />
        <Tooltip
          formatter={(value: number) => [format(value), "Value"]}
          contentStyle={{ background: "#1a2235", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
          labelStyle={{ color: "#9CA3AF", fontSize: 12 }}
          itemStyle={{ color: "white", fontSize: 13 }}
          cursor={{ stroke: "rgba(255,255,255,0.05)" }}
        />
        <Area type="monotone" dataKey="value" stroke="#8B5CF6" strokeWidth={2} fill="url(#portGrad)" dot={false} activeDot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
