import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AIInsightRecord } from "@/lib/ai/aiTypes";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from("ai_insights")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "dismissed")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ insights: (data ?? []) as AIInsightRecord[] });
  } catch {
    return NextResponse.json({ insights: [] });
  }
}
