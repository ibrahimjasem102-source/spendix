"use client";

import Link from "next/link";
import { Transaction } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";
import TransactionRow from "@/components/transactions/TransactionRow";

interface Props { transactions: Transaction[] }

export default function RecentTransactions({ transactions }: Props) {
  const { t } = useTranslation();

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
        <div className="space-y-2">
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} density="compact" />
          ))}
        </div>
      )}
    </div>
  );
}
