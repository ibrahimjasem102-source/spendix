"use client";

import { ArrowDownRight, ArrowUpRight, CalendarDays, FileText } from "lucide-react";
import CategoryIcon from "@/components/categories/CategoryIcon";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import type { Transaction } from "@/types";

interface Props {
  transaction: Transaction;
  density?: "compact" | "regular";
  showCategory?: boolean;
  showNotes?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function TransactionRow({
  transaction,
  density = "regular",
  showCategory = true,
  showNotes = true,
  trailing,
  onClick,
  className = "",
}: Props) {
  const { t, formatDate } = useTranslation();
  const { format } = useCurrency();
  const isIncome = transaction.type === "income";
  const color = isIncome ? "#10B981" : "#F43F5E";
  const amountColor = isIncome ? "text-emerald-400" : "text-rose-400";
  const py = density === "compact" ? "py-2.5" : "py-3";
  const iconSize = density === "compact" ? "sm" : "md";
  const date = formatDate(transaction.transaction_date, { month: "short", day: "numeric" });
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl border px-3.5 ${py} text-start transition-all hover:-translate-y-0.5 hover:bg-[hsl(var(--bg-input))] hover:shadow-sm ${className}`}
      style={{
        backgroundColor: "hsl(var(--bg-card-2))",
        borderColor: "hsl(var(--border))",
      }}
    >
      {transaction.category ? (
        <CategoryIcon
          icon={transaction.category.icon}
          color={transaction.category.color}
          size={iconSize}
        />
      ) : (
        <div
          className={`${density === "compact" ? "h-8 w-8 rounded-xl" : "h-10 w-10 rounded-xl"} flex shrink-0 items-center justify-center`}
          style={{ backgroundColor: `${color}18` }}
        >
          {isIncome
            ? <ArrowUpRight className={density === "compact" ? "h-4 w-4" : "h-5 w-5"} style={{ color }} />
            : <ArrowDownRight className={density === "compact" ? "h-4 w-4" : "h-5 w-5"} style={{ color }} />}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-bold leading-5 t1">{transaction.title}</p>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${
              isIncome ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"
            }`}
          >
            {t(isIncome ? "transactions.income" : "transactions.expense")}
          </span>
        </div>

        {showNotes && transaction.notes && (
          <p className="mt-0.5 line-clamp-1 text-xs t3">{transaction.notes}</p>
        )}

        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
          {showCategory && transaction.category && (
            <span
              className="max-w-[150px] truncate rounded-lg px-2 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: `${transaction.category.color}18`,
                color: transaction.category.color,
              }}
            >
              {transaction.category.name}
            </span>
          )}
          {!transaction.category && showCategory && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-0.5 text-[10px] font-bold t3">
              <FileText className="h-3 w-3" />
              {t("transactions.uncategorized")}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-0.5 text-[10px] font-bold t3">
            <CalendarDays className="h-3 w-3" />
            {date}
          </span>
        </div>
      </div>

      <div className="shrink-0 text-end">
        <p className={`text-sm font-black tabular-nums ${amountColor}`}>
          {isIncome ? "+" : "-"}{format(Number(transaction.amount))}
        </p>
        {trailing && <div className="mt-1 flex justify-end">{trailing}</div>}
      </div>
    </Wrapper>
  );
}

