import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/api/request";
import type { RecurringFormData } from "@/app/api/recurring/route";

type Params = { params: Promise<{ id: string }> };

const SELECT = "id,user_id,title,amount,type,category_id,account_id,notes,frequency,interval_count,start_date,end_date,next_run_date,last_run_date,active,auto_create,created_at,updated_at,category:categories(id,name,color,icon)";

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const body = await readJson<Partial<RecurringFormData>>(request);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined)          update.title          = body.title.trim();
  if (body.amount !== undefined)         update.amount         = Number(body.amount);
  if (body.type !== undefined)           update.type           = body.type;
  if (body.category_id !== undefined)    update.category_id    = body.category_id ?? null;
  if (body.account_id !== undefined)     update.account_id     = body.account_id ?? null;
  if (body.notes !== undefined)          update.notes          = body.notes?.trim() ?? null;
  if (body.frequency !== undefined)      update.frequency      = body.frequency;
  if (body.interval_count !== undefined) update.interval_count = body.interval_count;
  if (body.start_date !== undefined)     update.start_date     = body.start_date;
  if (body.end_date !== undefined)       update.end_date       = body.end_date ?? null;
  if (body.next_run_date !== undefined)  update.next_run_date  = body.next_run_date;
  if (body.active !== undefined)         update.active         = body.active;
  if (body.auto_create !== undefined)    update.auto_create    = body.auto_create;

  const { data, error } = await supabase
    .from("recurring_transactions")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recurring: data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("recurring_transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
