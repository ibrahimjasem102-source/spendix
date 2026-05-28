import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GUEST_CATEGORIES } from "@/lib/guest/categories";

const SELECT = "id,user_id,name,type,color,icon,section,created_at";
const LEGACY_SELECT = "id,user_id,name,type,color,created_at";

function isOptionalCategoryColumnError(message = "") {
  return message.includes("categories.icon") ||
    message.includes("categories.section") ||
    message.includes("Could not find") ||
    message.includes("schema cache");
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ categories: GUEST_CATEGORIES });

  const result = await supabase
    .from("categories")
    .select(SELECT)
    .eq("user_id", user.id)
    .order("section")
    .order("type")
    .order("name");
  let data: unknown = result.data;
  let error = result.error;

  if (error && isOptionalCategoryColumnError(error.message)) {
    const legacy = await supabase
      .from("categories")
      .select(LEGACY_SELECT)
      .eq("user_id", user.id)
      .order("type")
      .order("name");
    data = legacy.data;
    error = legacy.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    name: string; type: string; color: string;
    icon?: string; section?: string;
  };

  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const result = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name:    body.name.trim(),
      type:    body.type === "income" ? "income" : "expense",
      color:   body.color || "#6B7280",
      icon:    body.icon   ?? null,
      section: body.section ?? "general",
    })
    .select(SELECT)
    .single();
  let data: unknown = result.data;
  let error = result.error;

  if (error && isOptionalCategoryColumnError(error.message)) {
    const legacy = await supabase
      .from("categories")
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        type: body.type === "income" ? "income" : "expense",
        color: body.color || "#6B7280",
      })
      .select(LEGACY_SELECT)
      .single();
    data = legacy.data;
    error = legacy.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { id: string; name?: string; color?: string; icon?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name)  updates.name  = body.name.trim();
  if (body.color) updates.color = body.color;
  if (body.icon !== undefined) updates.icon = body.icon;

  const result = await supabase
    .from("categories")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select(SELECT)
    .single();
  let data: unknown = result.data;
  let error = result.error;

  if (error && isOptionalCategoryColumnError(error.message)) {
    const { icon: _icon, section: _section, ...legacyUpdates } = updates;
    const legacy = await supabase
      .from("categories")
      .update(legacyUpdates)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select(LEGACY_SELECT)
      .single();
    data = legacy.data;
    error = legacy.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
