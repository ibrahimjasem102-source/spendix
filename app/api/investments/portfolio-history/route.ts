import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all investments
  const { data: investments } = await supabase
    .from("investments")
    .select("id, amount_invested, current_value, investment_date")
    .eq("user_id", user.id)
    .order("investment_date");

  if (!investments || investments.length === 0) {
    return NextResponse.json({ history: [] });
  }

  // Build monthly portfolio value over last 7 months
  const now = new Date();
  const history: { month: string; value: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const cutoff = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    // Sum current_value for investments that existed at this month
    const value = investments
      .filter((inv) => inv.investment_date <= cutoff)
      .reduce((sum, inv) => {
        // Simple linear interpolation: use current_value as latest, amount_invested as starting
        // This gives a rough trend without historical price data
        const monthsHeld = Math.max(0, (d.getTime() - new Date(inv.investment_date).getTime()) / (1000 * 60 * 60 * 24 * 30));
        const totalMonths = Math.max(1, (now.getTime() - new Date(inv.investment_date).getTime()) / (1000 * 60 * 60 * 24 * 30));
        const progressRatio = monthsHeld / totalMonths;
        const startVal = Number(inv.amount_invested);
        const endVal = Number(inv.current_value ?? inv.amount_invested);
        const interpolated = startVal + (endVal - startVal) * progressRatio;
        return sum + interpolated;
      }, 0);

    history.push({ month: label, value: Math.round(value * 100) / 100 });
  }

  return NextResponse.json({ history });
}
