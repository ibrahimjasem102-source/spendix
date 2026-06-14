import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestId } from "@/lib/api/responses";
import { boundedInt } from "@/lib/api/request";

const LEDGER_SELECT =
  "id,user_id,source_module,source_id,entry_type,direction,amount,description,account_id,category_id,contact_id,transaction_id,created_at";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const supabase  = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit     = boundedInt(searchParams.get("limit"),  0, 500, 100);
  const offset    = boundedInt(searchParams.get("offset"), 0, 100_000, 0);
  const module_   = searchParams.get("module")    ?? undefined;
  const direction = searchParams.get("direction") ?? undefined;
  const dateFrom  = searchParams.get("date_from") ?? undefined;
  const dateTo    = searchParams.get("date_to")   ?? undefined;

  let query = supabase
    .from("ledger_entries")
    .select(LEDGER_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (module_)    query = query.eq("source_module", module_);
  if (direction)  query = query.eq("direction", direction);
  if (dateFrom)   query = query.gte("created_at", dateFrom);
  if (dateTo)     query = query.lte("created_at", dateTo);

  const { data, error } = await query;

  if (error) {
    console.error("[api/ledger] query failed:", { requestId, message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entries = data ?? [];

  // Lightweight server-side aggregates (avoid second round-trip from the client)
  const inflow  = entries.filter(e => e.direction === "inflow").reduce((s, e) => s + Number(e.amount), 0);
  const outflow = entries.filter(e => e.direction === "outflow").reduce((s, e) => s + Number(e.amount), 0);

  return NextResponse.json({
    entries,
    count: entries.length,
    summary: {
      inflow,
      outflow,
      net: inflow - outflow,
    },
  });
}
