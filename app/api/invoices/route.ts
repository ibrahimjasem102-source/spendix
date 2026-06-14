import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const url    = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("invoices")
    .select(`
      id, number, title, status, issue_date, due_date,
      total, currency, paid_at, created_at,
      contact:financial_contacts(id, name),
      project:projects(id, name)
    `, { count: "exact" })
    .eq("user_id", user.id)
    .order("issue_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data, count });
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const limited = rateLimit(req, { key: "invoices_create", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  let body: {
    contact_id?: string; project_id?: string; title: string;
    issue_date: string; due_date?: string; currency?: string;
    notes?: string; terms?: string; tax_rate?: number;
    items: { description: string; quantity: number; unit_price: number }[];
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 }); }

  if (!body.title?.trim() || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ ok: false, error: "title and items are required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Generate invoice number
  const { count } = await db
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const subtotal   = body.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxRate    = body.tax_rate ?? 0;
  const taxAmount  = subtotal * (taxRate / 100);
  const total      = subtotal + taxAmount;

  const { data: invoice, error } = await db.from("invoices").insert({
    user_id:    user.id,
    contact_id: body.contact_id ?? null,
    project_id: body.project_id ?? null,
    number:     invoiceNumber,
    title:      body.title.trim(),
    status:     "draft",
    issue_date: body.issue_date,
    due_date:   body.due_date ?? null,
    subtotal,
    tax_rate:   taxRate,
    tax_amount: taxAmount,
    total,
    currency:   body.currency ?? "USD",
    notes:      body.notes?.slice(0, 2000) ?? null,
    terms:      body.terms?.slice(0, 1000) ?? null,
  }).select("id, number").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Insert line items
  if (invoice?.id) {
    const itemRows = body.items.map((item, i) => ({
      invoice_id:  invoice.id,
      description: item.description.slice(0, 500),
      quantity:    item.quantity,
      unit_price:  item.unit_price,
      sort_order:  i,
    }));
    await db.from("invoice_items").insert(itemRows);
  }

  return NextResponse.json({ ok: true, invoice }, { status: 201 });
}
