import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Deletes all legacy debt-creation transactions (source='debt').
// These were created by old logic that double-counted debt amounts
// in the balance. Safe to delete — payments are tracked separately.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: deleted, error } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", user.id)
    .eq("source", "debt")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ cleaned: deleted?.length ?? 0 });
}
