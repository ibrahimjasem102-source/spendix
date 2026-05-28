import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bootstrapAuthenticatedUser } from "@/lib/auth/bootstrap";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await bootstrapAuthenticatedUser(supabase, user);
    return NextResponse.json(result.seeded === 0
      ? { seeded: 0, message: "Already has categories" }
      : result
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Seed failed" }, { status: 500 });
  }
}
