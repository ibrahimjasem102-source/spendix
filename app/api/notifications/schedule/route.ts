import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runScheduler } from "@/lib/notifications/scheduler";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Run scheduler in background, don't await full completion
  void runScheduler(supabase, user.id);

  return NextResponse.json({ ok: true });
}
