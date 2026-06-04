import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { validateServerEnv } from "@/lib/env";

export async function createClient() {
  validateServerEnv();
  const cookieStore = await cookies();
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");
  // TEMP DIAGNOSTIC — remove after fix
  if (process.env.NODE_ENV === "production") {
    console.log("[server-client] authorization header:", authorization ? `Bearer ${authorization.slice(7,27)}…` : "MISSING");
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: authorization ? { headers: { authorization } } : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
