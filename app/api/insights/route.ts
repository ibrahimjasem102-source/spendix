import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInsights } from "@/lib/ai/insights";
import { Transaction } from "@/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ errorKey: "errors.unauthorized" }, { status: 401 });
  }

  const { data: transactions = [] } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(50);

  const body = await request.json().catch(() => ({}));
  const insights = await generateInsights((transactions as Transaction[]) ?? [], body.language);

  return NextResponse.json({ insights });
}
