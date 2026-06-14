"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TransactionForm from "@/components/transactions/TransactionForm";
import { useCreateTransaction } from "@/lib/query/hooks";
import type { TransactionFormData, TransactionType } from "@/types";

function NewTransactionForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const rawType      = searchParams.get("type");
  const initialType: TransactionType | undefined =
    rawType === "income" || rawType === "expense" ? rawType : undefined;

  const { mutateAsync } = useCreateTransaction();

  async function handleSubmit(data: TransactionFormData) {
    await mutateAsync(data);
    // TransactionForm calls onClose() itself on success, which triggers router.back()
  }

  return (
    <TransactionForm
      initialType={initialType}
      onSubmit={handleSubmit}
      onClose={() => router.back()}
    />
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense>
      <NewTransactionForm />
    </Suspense>
  );
}
