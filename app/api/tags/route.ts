import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TagFormData } from "@/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tags, error } = await supabase
    .from("tags")
    .select("id,user_id,name,color,created_at,transaction_count:transaction_tags(count)")
    .eq("user_id", user.id)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten the count from Supabase aggregate format
  const normalized = (tags ?? []).map((t) => ({
    ...t,
    transaction_count:
      Array.isArray(t.transaction_count) && t.transaction_count.length > 0
        ? (t.transaction_count[0] as { count: number }).count
        : 0,
  }));

  return NextResponse.json({ tags: normalized });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: TagFormData = await request.json();
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Tag name required" }, { status: 400 });

  const { data: tag, error } = await supabase
    .from("tags")
    .insert({ user_id: user.id, name, color: body.color ?? "#06B6D4" })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tag }, { status: 201 });
}
