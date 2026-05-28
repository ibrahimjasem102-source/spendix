import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Status = "read" | "dismissed" | "acted";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json() as { status?: Status };
  const status = body.status;

  if (!status || !["read", "dismissed", "acted"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("ai_insights")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ insight: data });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
