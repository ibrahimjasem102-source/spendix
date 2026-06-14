import { createAdminClient } from "@/lib/supabase/admin";

export function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS ?? "";
  if (!raw.trim()) return false;
  const admins = raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export type PlatformRole = "user" | "family_member" | "manager" | "admin" | "support_agent";

export async function getUserRole(userId: string): Promise<PlatformRole> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;
    const { data } = await db
      .from("user_permissions")
      .select("role")
      .eq("user_id", userId)
      .single();
    return (data?.role as PlatformRole) ?? "user";
  } catch {
    return "user";
  }
}

export async function setUserRole(
  userId: string,
  role: PlatformRole,
  grantedBy: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  await db.from("user_permissions").upsert(
    { user_id: userId, role, granted_by: grantedBy, granted_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
}

export const ROLE_RANK: Record<PlatformRole, number> = {
  user:          0,
  family_member: 1,
  manager:       2,
  support_agent: 3,
  admin:         4,
};

export function hasMinRole(role: PlatformRole, required: PlatformRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
