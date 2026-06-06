import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/api/plan-guard";

// GET  — fetch current user's household (the one they're a member of)
// POST — create a new household (user becomes owner + first member)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find the household this user belongs to (first one found)
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role, joined_at, household:households(id, name, created_by, created_at, updated_at)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return NextResponse.json({ household: null });

  return NextResponse.json({
    household: membership.household,
    role: membership.role,
    joined_at: membership.joined_at,
    user_id: user.id,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessErr = await checkFeatureAccess(supabase, user.id, "household", "Household");
  if (accessErr) return accessErr;

  const body = await request.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Check if user is already in a household
  const { data: existing } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (existing) return NextResponse.json({ error: "Already in a household" }, { status: 409 });

  const { data: household, error } = await supabase
    .from("households")
    .insert({ name, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add creator as owner
  await supabase.from("household_members").insert({
    household_id: household.id,
    user_id: user.id,
    role: "owner",
  });

  return NextResponse.json({ household }, { status: 201 });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not in a household" }, { status: 404 });
  if (membership.role !== "owner") return NextResponse.json({ error: "Only the owner can delete the household" }, { status: 403 });

  const { error } = await supabase.from("households").delete().eq("id", membership.household_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
