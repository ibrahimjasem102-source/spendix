"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DebtForm from "@/components/debts/DebtForm";
import { useCreateDebt } from "@/lib/query/hooks";
import type { DebtFormData, DebtType } from "@/types";

function NewDebtForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const rawType      = searchParams.get("type");
  const initialDebtType: DebtType | undefined =
    rawType === "payable" || rawType === "receivable" ? rawType : undefined;

  const { mutateAsync } = useCreateDebt();

  async function handleSubmit(data: DebtFormData) {
    await mutateAsync(data);
    // DebtForm calls onClose() itself on success, which triggers router.back()
  }

  return (
    <DebtForm
      initialDebtType={initialDebtType}
      onSubmit={handleSubmit}
      onClose={() => router.back()}
    />
  );
}

export default function NewDebtPage() {
  return (
    <Suspense>
      <NewDebtForm />
    </Suspense>
  );
}
