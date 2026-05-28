"use client";

import Link from "next/link";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Transaction } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { ROUTES } from "@/lib/routes";

interface Props { transactions: Transaction[] }

export default function RecentTransactions({ transactions }: Props) {
  const { t, formatDate } = useTranslation();
  const { format } = useCurrency();

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold t1">{t("dashboard.recent_transactions")}</h3>
        <Link href={ROUTES.transactions} className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
          {t("common.view_all")}
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm t2">{t("common.no_data")}</p>
          <Link href={ROUTES.transactions} className="text-xs text-cyan-400 hover:underline mt-1 block">
            {t("transactions.add")}
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[hsl(var(--bg-input))] transition-colors">
              <div className={`p-1.5 rounded-lg shrink-0 ${tx.type === "income" ? "bg-emerald-400/10" : "bg-rose-400/10"}`}>
                {tx.type === "income"
                  ? <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                  : <ArrowDownRight className="w-3 h-3 text-rose-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium t1 truncate">{tx.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {tx.category && (
                    <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                      style={{ backgroundColor: `${tx.category.color}18`, color: tx.category.color }}>
                      {tx.category.name}
                    </span>
                  )}
                  <span className="text-xs t3">{formatDate(tx.transaction_date)}</span>
                </div>
              </div>
              <span className={`text-sm font-semibold shrink-0 ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                {tx.type === "income" ? "+" : "-"}{format(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
