import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("family_members")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    name: string; relationship: string; birth_date?: string | null; notes?: string | null;
  };

  if (!body.name?.trim())         return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!body.relationship?.trim()) return NextResponse.json({ error: "Relationship is required" }, { status: 400 });

  const AVATAR_COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#3b82f6"];
  const avatar_color  = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const { data, error } = await supabase
    .from("family_members")
    .insert({
      user_id:      user.id,
      name:         body.name.trim(),
      relationship: body.relationship.trim(),
      birth_date:   body.birth_date || null,
      notes:        body.notes?.trim() || null,
      avatar_color,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data }, { status: 201 });
}
