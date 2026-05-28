import { createClient } from "@/lib/supabase/client";
import { getGuestTransactions, clearGuestData } from "./storage";

export async function migrateGuestData(): Promise<void> {
  const guestTx = getGuestTransactions();
  if (guestTx.length === 0) return;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Map guest category names to the user's real category IDs
  const { data: realCategories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", user.id);

  const nameToId = new Map<string, string>(
    (realCategories ?? []).map((c: { id: string; name: string }) => [c.name, c.id])
  );

  const rows = guestTx.map((tx) => ({
    user_id: user.id,
    title: tx.title,
    notes: tx.notes ?? null,
    amount: tx.amount,
    type: tx.type,
    category_id: tx.category?.name ? (nameToId.get(tx.category.name) ?? null) : null,
    transaction_date: tx.transaction_date,
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("transactions").insert(rows);
    if (error) return;
  }

  clearGuestData();
}
