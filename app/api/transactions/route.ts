import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";
import { boundedInt, readJson } from "@/lib/api/request";
import { TransactionFormData } from "@/types";

const TRANSACTION_SELECT =
  "id,user_id,category_id,title,notes,amount,type,source,related_source_id,contact_id,transaction_date,created_at,updated_at,category:categories(id, name, color, icon)";
const TRANSACTION_SELECT_NO_CATEGORY =
  "id,user_id,category_id,title,notes,amount,type,source,related_source_id,contact_id,transaction_date,created_at,updated_at";
const LEGACY_TRANSACTION_SELECT =
  "id,user_id,category_id,title,notes,amount,type,transaction_date,created_at,updated_at,category:categories(id, name, color)";
const LEGACY_TRANSACTION_SELECT_NO_CATEGORY =
  "id,user_id,category_id,title,notes,amount,type,transaction_date,created_at,updated_at";

function isOptionalColumnError(message: string) {
  return message.includes("transactions.source") ||
    message.includes("transactions.contact_id") ||
    message.includes("categories.icon") ||
    message.includes("related_source_id") ||
    message.includes("transactions_source_check") ||
    message.includes("violates check constraint") ||
    message.includes("Could not find") ||
    message.includes("schema cache");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = boundedInt(searchParams.get("limit"), 0, 200, 0);
  const offset = boundedInt(searchParams.get("offset"), 0, 100_000, 0);

  const applyRange = <T extends { range: (from: number, to: number) => T }>(query: T) => {
    if (limit > 0) return query.range(offset, offset + limit - 1);
    return query;
  };

  let data: unknown = null;
  let error: { message: string } | null = null;

  for (const select of [
    TRANSACTION_SELECT,
    TRANSACTION_SELECT_NO_CATEGORY,
    LEGACY_TRANSACTION_SELECT,
    LEGACY_TRANSACTION_SELECT_NO_CATEGORY,
  ]) {
    let query = supabase
      .from("transactions")
      .select(select)
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false });
    query = applyRange(query);

    const result = await query;
    data = result.data;
    error = result.error;
    if (!error || !isOptionalColumnError(error.message)) break;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transactions: data ?? [] });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { key: "transactions-post", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const requestId = getRequestId(request);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<TransactionFormData>(request);
  const payload = {
    user_id: user.id,
    title: body.title?.trim(),
    notes: body.notes?.trim() || null,
    amount: Number(body.amount),
    type: body.type,
    source: body.source ?? "manual",
    related_source_id: body.related_source_id ?? null,
    contact_id: body.contact_id ?? null,
    category_id: body.category_id || null,
    transaction_date: body.transaction_date,
  };

  if (!payload.title || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    return NextResponse.json({ errorKey: "transactions.form_error" }, { status: 400 });
  }

  const result = await supabase
    .from("transactions")
    .insert(payload)
    .select(TRANSACTION_SELECT_NO_CATEGORY)
    .single();
  let data: unknown = result.data;
  let error = result.error;

  if (error && isOptionalColumnError(error.message)) {
    const { source: _source, related_source_id: _relatedSourceId, contact_id: _contactId, ...legacyPayload } = payload;
    const legacy = await supabase
      .from("transactions")
      .insert(legacyPayload)
      .select(LEGACY_TRANSACTION_SELECT_NO_CATEGORY)
      .single();
    data = legacy.data;
    error = legacy.error;
  }

  if (error) {
    console.error("[transactions/post]", { requestId, code: error.code, message: error.message });
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  return NextResponse.json({ transaction: data }, { status: 201 });
}
