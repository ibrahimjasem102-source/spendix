import "server-only";

import type { TransactionFormData, TransactionSource, TransactionType } from "@/types";

type SupabaseLike = {
  from: (table: string) => any;
};

type LinkedTransactionPayload = Omit<TransactionFormData, "category_id" | "notes"> & {
  user_id: string;
  category_id?: string | null;
  notes?: string | null;
  source?: TransactionSource;
  related_source_id?: string | null;
  contact_id?: string | null;
};

export function isOptionalTransactionColumnError(message = "") {
  return (
    message.includes("transactions.source") ||
    message.includes("transactions.contact_id") ||
    message.includes("categories.icon") ||
    message.includes("categories.section") ||
    message.includes("related_source_id") ||
    message.includes("contact_id") ||
    message.includes("schema cache") ||
    message.includes("Could not find") ||
    message.includes("transactions_source_check") ||
    message.includes("violates check constraint")
  );
}

function toLegacyPayload(payload: LinkedTransactionPayload) {
  const {
    source: _source,
    related_source_id: _relatedSourceId,
    contact_id: _contactId,
    ...legacy
  } = payload;
  return legacy;
}

export async function insertLinkedTransaction(db: SupabaseLike, payload: LinkedTransactionPayload) {
  const extended = await db
    .from("transactions")
    .insert(payload)
    .select("id")
    .single();

  if (!extended.error) return { data: extended.data as { id: string }, error: null };
  if (!isOptionalTransactionColumnError(extended.error.message)) {
    return { data: null, error: extended.error };
  }

  const legacy = await db
    .from("transactions")
    .insert(toLegacyPayload(payload))
    .select("id")
    .single();

  return {
    data: legacy.data as { id: string } | null,
    error: legacy.error,
  };
}

export async function updateTransactionSourceLink(
  db: SupabaseLike,
  transactionId: string | null | undefined,
  relatedSourceId: string,
) {
  if (!transactionId) return;

  const { error } = await db
    .from("transactions")
    .update({ related_source_id: relatedSourceId })
    .eq("id", transactionId);

  if (error && !isOptionalTransactionColumnError(error.message)) {
    throw new Error(error.message);
  }
}

export function transactionTypeForDebtPayment(debtType: "payable" | "receivable"): TransactionType {
  return debtType === "receivable" ? "income" : "expense";
}
