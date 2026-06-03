import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET  — list pending invitations for the current user (matched by email)
// Also returns invitations sent FROM the current user (for the admin view)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userEmail = user.email ?? "";

  // Invitations sent to this user (not yet accepted, not expired)
  const { data: received } = await supabase
    .from("household_invitations")
    .select("id, household_id, email, role, token, expires_at, accepted_at, created_at, household:households(id, name)")
    .eq("email", userEmail.toLowerCase())
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  // Invitations sent by this user (for their household management panel)
  const { data: sent } = await supabase
    .from("household_invitations")
    .select("id, household_id, email, role, token, expires_at, accepted_at, created_at")
    .eq("invited_by", user.id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    received: received ?? [],
    sent:     sent ?? [],
  });
}
