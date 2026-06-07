// Vars required for the app to function at all — checked on every request via middleware.
const requiredPublicEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export function validateServerEnv() {
  const missing = requiredPublicEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

// Called once at startup (e.g., in instrumentation.ts or a health-check route)
// to surface missing secrets early, before they cause silent failures in routes.
export function validateAllSecrets(): { ok: boolean; missing: string[] } {
  const secrets = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "ANTHROPIC_API_KEY",
  ];
  const missing = secrets.filter((key) => !process.env[key]);
  return { ok: missing.length === 0, missing };
}
