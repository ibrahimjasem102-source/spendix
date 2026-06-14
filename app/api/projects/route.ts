import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const url    = new URL(req.url);
  const status = url.searchParams.get("status");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("projects")
    .select(`
      id, name, description, status, hourly_rate, budget, currency,
      start_date, end_date, color, created_at,
      contact:financial_contacts(id, name)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  let body: {
    name: string; description?: string; contact_id?: string;
    hourly_rate?: number; budget?: number; currency?: string;
    start_date?: string; end_date?: string; color?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("projects").insert({
    user_id:     user.id,
    name:        body.name.trim(),
    description: body.description?.slice(0, 1000) ?? null,
    contact_id:  body.contact_id ?? null,
    hourly_rate: body.hourly_rate ?? null,
    budget:      body.budget ?? null,
    currency:    body.currency ?? "USD",
    start_date:  body.start_date ?? null,
    end_date:    body.end_date ?? null,
    color:       body.color ?? "#06B6D4",
  }).select("id, name").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
