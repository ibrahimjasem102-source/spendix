import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET  — list all members of the caller's household (with email from auth.users via RPC)
// DELETE — leave or remove a member (owner can remove others)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ members: [] });

  const { data: members, error } = await supabase
    .from("household_members")
    .select("household_id, user_id, role, joined_at")
    .eq("household_id", membership.household_id)
    .order("joined_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ members: members ?? [], household_id: membership.household_id });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { target_user_id, role } = await request.json();
  if (!target_user_id) return NextResponse.json({ error: "target_user_id is required" }, { status: 400 });
  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { data: callerMembership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .single();

  if (!callerMembership) return NextResponse.json({ error: "Not in a household" }, { status: 404 });
  if (callerMembership.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can update permissions" }, { status: 403 });
  }
  if (target_user_id === user.id) {
    return NextResponse.json({ error: "Owner role cannot be changed" }, { status: 403 });
  }

  const { data: targetMember } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", callerMembership.household_id)
    .eq("user_id", target_user_id)
    .single();

  if (!targetMember) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (targetMember.role === "owner") {
    return NextResponse.json({ error: "Owner role cannot be changed" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("household_members")
    .update({ role })
    .eq("household_id", callerMembership.household_id)
    .eq("user_id", target_user_id)
    .select("household_id, user_id, role, joined_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { target_user_id } = await request.json();

  // Determine caller's role
  const { data: callerMembership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .single();

  if (!callerMembership) return NextResponse.json({ error: "Not in a household" }, { status: 404 });

  const targetId = target_user_id ?? user.id;
  const isLeavingSelf = targetId === user.id;

  if (!isLeavingSelf && callerMembership.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can remove members" }, { status: 403 });
  }

  // Cannot remove the owner
  const { data: targetMember } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", callerMembership.household_id)
    .eq("user_id", targetId)
    .single();

  if (targetMember?.role === "owner" && !isLeavingSelf) {
    return NextResponse.json({ error: "Cannot remove the owner" }, { status: 403 });
  }

  const { error } = await supabase
    .from("household_members")
    .delete()
    .eq("household_id", callerMembership.household_id)
    .eq("user_id", targetId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
