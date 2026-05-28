"use client";

import { motion } from "framer-motion";
import { fadeInScale, tapTransition } from "@/lib/motion";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  subtext?: string;
  color?: string;             // text color class, e.g. "text-emerald-400"
  bg?: string;                // bg class, e.g. "bg-emerald-400/10"
  icon?: React.ElementType;
  spark?: number[];
  sparkColor?: string;
  href?: string;
  delay?: number;
}

function Spark({ data, color }: { data: number[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={24}>
      <LineChart data={data.map((v, i) => ({ i, v }))}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} activeDot={false} strokeOpacity={0.8} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function MetricChip({
  label, value, subtext, color = "t1", bg, icon: Icon,
  spark, sparkColor = "#06B6D4", href, delay = 0,
}: Props) {
  const Inner = (
    <motion.div
      variants={fadeInScale}
      initial="hidden"
      animate="visible"
      transition={{ ...tapTransition, delay }}
      whileTap={{ scale: 0.96 }}
      className={cn("card-elevated p-4 flex flex-col justify-between", href && "cursor-pointer hover:border-white/12 transition-all")}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold t3 uppercase tracking-[0.1em] leading-none">{label}</p>
        {Icon && bg && (
          <div className={cn("p-1.5 rounded-lg", bg)}>
            <Icon className={cn("w-3 h-3", color)} />
          </div>
        )}
      </div>

      <p className={cn("text-lg font-bold number-display leading-none", color)}>{value}</p>

      {spark && (
        <div className="mt-2 -mx-1">
          <Spark data={spark} color={sparkColor} />
        </div>
      )}

      {subtext && !spark && (
        <p className="text-[10px] t3 mt-1.5 leading-none">{subtext}</p>
      )}
    </motion.div>
  );

  if (href) return <a href={href}>{Inner}</a>;
  return Inner;
}
