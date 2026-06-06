import type { SupabaseClient, User } from "@supabase/supabase-js";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

type Locale = "ar" | "en" | "de";

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

function getCategoryName(cat: typeof DEFAULT_CATEGORIES[number], locale: Locale): string {
  if (locale === "en") return cat.name_en;
  if (locale === "de") return cat.name_en; // German fallback to English until name_de is added
  return cat.name_ar;
}

export async function bootstrapAuthenticatedUser(
  supabase: SupabaseClient,
  user: User,
  locale?: Locale,
) {
  const fullName  = getFullName(user);
  const avatarUrl = getAvatarUrl(user);
  const now       = new Date().toISOString();

  const { data: existingSettings, error: settingsReadError } = await supabase
    .from("profile_settings")
    .select("full_name, language, currency, theme")
    .eq("user_id", user.id)
    .maybeSingle();

  if (settingsReadError) throw settingsReadError;

  // Resolve locale: 1. passed explicitly, 2. already in profile, 3. default ar
  const resolvedLocale: Locale =
    locale ??
    (existingSettings?.language as Locale | undefined) ??
    "ar";

  const { error: profileErr } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName || null,
    avatar_url: avatarUrl,
  }, { onConflict: "id" });
  if (profileErr) console.warn("[bootstrap] profile upsert:", profileErr.message);

  const { error: settingsErr } = await supabase.from("profile_settings").upsert({
    user_id:   user.id,
    full_name: existingSettings?.full_name || fullName || null,
    language:  existingSettings?.language  || resolvedLocale,
    currency:  existingSettings?.currency  || "EUR",
    theme:     existingSettings?.theme     || "dark",
    updated_at: now,
  }, { onConflict: "user_id" });
  if (settingsErr) console.warn("[bootstrap] profile_settings upsert:", settingsErr.message);

  const { count, error: countError } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) throw countError;
  if ((count ?? 0) > 0) return { seeded: 0 };

  const rows = DEFAULT_CATEGORIES.map((cat) => ({
    user_id: user.id,
    name:    getCategoryName(cat, resolvedLocale),
    type:    cat.type,
    color:   cat.color,
    icon:    cat.icon,
    section: cat.section,
  }));

  const { data, error } = await supabase.from("categories").insert(rows).select("id");
  if (error) throw error;

  // Ensure free subscription row exists for new users (ignore errors)
  try {
    await supabase.rpc("upsert_free_subscription", { p_user_id: user.id });
  } catch { /* non-critical */ }

  return { seeded: data?.length ?? 0 };
}
