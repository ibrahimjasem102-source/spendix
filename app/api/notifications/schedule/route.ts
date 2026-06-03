import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runScheduler } from "@/lib/notifications/scheduler";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Read user's preferred locale so scheduler can produce localized notifications
  const { data: settings } = await supabase
    .from("profile_settings")
    .select("language")
    .eq("user_id", user.id)
    .maybeSingle();

  const locale = (settings?.language ?? "ar") as "ar" | "en" | "de";

  void runScheduler(supabase, user.id, locale);

  return NextResponse.json({ ok: true });
}
