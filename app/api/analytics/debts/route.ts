import { NextResponse } from "next/server";
import { getDebtAnalytics } from "@/lib/analytics/analyticsService";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });

  const debts = await getDebtAnalytics(user.id, supabase);
  return NextResponse.json({ debts });
}
