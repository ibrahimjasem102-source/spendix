import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateNotificationData } from "@/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status   = searchParams.get("status");
  const type     = searchParams.get("type");
  const source   = searchParams.get("source");
  const limit    = parseInt(searchParams.get("limit") ?? "50");

  let query = supabase
    .from("notifications")
    .select("id,user_id,title,message,type,status,priority,source,related_source_id,action_url,metadata,scheduled_for,read_at,created_at,updated_at")
    .eq("user_id", user.id)
    // Only show scheduled notifications that are due
    .or("scheduled_for.is.null,scheduled_for.lte.now()")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status)  query = query.eq("status", status);
  if (type)    query = query.eq("type", type);
  if (source)  query = query.eq("source", source);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unreadCount = (data ?? []).filter((n) => n.status === "unread").length;
  return NextResponse.json({ notifications: data, unreadCount });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: Omit<CreateNotificationData, "user_id"> = await request.json();

  const { data, error } = await supabase
    .from("notifications")
    .insert({ ...body, user_id: user.id, status: "unread" })
    .select("id,user_id,title,message,type,status,priority,source,related_source_id,action_url,metadata,scheduled_for,read_at,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notification: data }, { status: 201 });
}
