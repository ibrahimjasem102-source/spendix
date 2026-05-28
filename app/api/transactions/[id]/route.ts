import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TransactionFormData } from "@/types";
import { isOptionalTransactionColumnError } from "@/lib/finance/serverTransactions";

type Params = { params: Promise<{ id: string }> };
const LEGACY_TRANSACTION_SELECT_NO_CATEGORY =
  "id,user_id,category_id,title,notes,amount,type,transaction_date,created_at,updated_at";
const TRANSACTION_SELECT_NO_CATEGORY =
  "id,user_id,category_id,title,notes,amount,type,source,related_source_id,contact_id,transaction_date,created_at,updated_at";

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body: Partial<TransactionFormData> = await request.json();
  const payload: Record<string, unknown> = {};
  if (body.title !== undefined) payload.title = body.title.trim();
  if (body.notes !== undefined) payload.notes = body.notes?.trim() || null;
  if (body.amount !== undefined) payload.amount = Number(body.amount);
  if (body.type !== undefined) payload.type = body.type;
  if (body.category_id !== undefined) payload.category_id = body.category_id || null;
  if (body.transaction_date !== undefined) payload.transaction_date = body.transaction_date;
  if (body.source !== undefined) payload.source = body.source;
  if (body.related_source_id !== undefined) payload.related_source_id = body.related_source_id ?? null;
  if (body.contact_id !== undefined) payload.contact_id = body.contact_id ?? null;

  const result = await supabase
    .from("transactions")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(TRANSACTION_SELECT_NO_CATEGORY)
    .single();
  let data: unknown = result.data;
  let error = result.error;

  if (error && isOptionalTransactionColumnError(error.message)) {
    const { source: _source, related_source_id: _relatedSourceId, contact_id: _contactId, ...legacyPayload } = payload;
    const legacy = await supabase
      .from("transactions")
      .update(legacyPayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select(LEGACY_TRANSACTION_SELECT_NO_CATEGORY)
      .single();
    data = legacy.data;
    error = legacy.error;
  }

  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });

  return NextResponse.json({ transaction: data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
