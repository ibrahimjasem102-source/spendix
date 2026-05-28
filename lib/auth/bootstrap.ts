import type { SupabaseClient, User } from "@supabase/supabase-js";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

function getFullName(user: User) {
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.user_name ||
    user.email?.split("@")[0] ||
    ""
  );
}

function getAvatarUrl(user: User) {
  return user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
}

export async function bootstrapAuthenticatedUser(supabase: SupabaseClient, user: User) {
  const fullName = getFullName(user);
  const avatarUrl = getAvatarUrl(user);
  const now = new Date().toISOString();
  const { data: existingSettings, error: settingsReadError } = await supabase
    .from("profile_settings")
    .select("full_name, language, currency, theme")
    .eq("user_id", user.id)
    .maybeSingle();

  if (settingsReadError) throw settingsReadError;

  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName || null,
    avatar_url: avatarUrl,
  }, { onConflict: "id" }).throwOnError();

  await supabase.from("profile_settings").upsert({
    user_id: user.id,
    full_name: existingSettings?.full_name || fullName || null,
    language: existingSettings?.language || "ar",
    currency: existingSettings?.currency || "EUR",
    theme: existingSettings?.theme || "dark",
    updated_at: now,
  }, { onConflict: "user_id" }).throwOnError();

  const { count, error: countError } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) throw countError;
  if ((count ?? 0) > 0) return { seeded: 0 };

  const rows = DEFAULT_CATEGORIES.map((cat) => ({
    user_id: user.id,
    name: cat.name_ar,
    type: cat.type,
    color: cat.color,
    icon: cat.icon,
    section: cat.section,
  }));

  const { data, error } = await supabase.from("categories").insert(rows).select("id");
  if (error) throw error;
  return { seeded: data?.length ?? 0 };
}
