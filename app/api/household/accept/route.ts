import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — accept an invitation by token
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });

  // Check user is not already in a household
  const { data: existingMembership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .single();

  if (existingMembership) {
    return NextResponse.json({ error: "You are already in a household" }, { status: 409 });
  }

  // Fetch invitation
  const { data: invitation, error: invErr } = await supabase
    .from("household_invitations")
    .select("id, household_id, email, role, expires_at, accepted_at")
    .eq("token", token)
    .single();

  if (invErr || !invitation) return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  if (invitation.accepted_at) return NextResponse.json({ error: "Invitation already accepted" }, { status: 409 });
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  // Add user as member
  const { error: memberErr } = await supabase.from("household_members").insert({
    household_id: invitation.household_id,
    user_id: user.id,
    role: invitation.role,
  });

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

  // Mark invitation accepted
  await supabase
    .from("household_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return NextResponse.json({ household_id: invitation.household_id });
}
