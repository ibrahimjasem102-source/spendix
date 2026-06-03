import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — get_household_summary RPC for the caller's household
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ summary: [] });

  const { data: summary, error } = await supabase.rpc("get_household_summary", {
    p_household_id: membership.household_id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ summary: summary ?? [] });
}
