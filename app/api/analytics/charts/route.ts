import { NextResponse } from "next/server";
import { getAnalyticsCharts } from "@/lib/analytics/analyticsService";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  try {
    const charts = await getAnalyticsCharts(user.id, supabase);
    return NextResponse.json({ charts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analytics failed" },
      { status: 500 }
    );
  }
}
