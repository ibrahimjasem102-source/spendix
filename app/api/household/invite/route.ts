import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — send an invitation to an email address
// DELETE — cancel a pending invitation
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, role = "member" } = await request.json();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "You are not in a household" }, { status: 404 });
  if (!["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can invite" }, { status: 403 });
  }
  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (membership.role !== "owner" && role !== "member") {
    return NextResponse.json({ error: "Only the owner can invite admins" }, { status: 403 });
  }

  const { data: invitation, error } = await supabase
    .from("household_invitations")
    .insert({
      household_id: membership.household_id,
      email: email.toLowerCase().trim(),
      role,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This email already has a pending invitation" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invitation }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invitation_id } = await request.json();

  if (!invitation_id) {
    return NextResponse.json({ error: "invitation_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("household_invitations")
    .delete()
    .eq("id", invitation_id)
    .eq("invited_by", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
