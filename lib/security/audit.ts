import { createAdminClient } from "@/lib/supabase/admin";

export type SecurityEventType =
  | "login_failed" | "login_success" | "suspicious_request"
  | "rate_limit_exceeded" | "token_abuse" | "api_abuse"
  | "password_reset" | "email_change" | "subscription_change"
  | "admin_action" | "gdpr_export" | "gdpr_delete" | "account_locked";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

interface LogSecurityEventOpts {
  userId?:    string;
  eventType:  SecurityEventType;
  severity?:  SecuritySeverity;
  ipAddress?: string;
  userAgent?: string;
  path?:      string;
  metadata?:  Record<string, unknown>;
}

export async function logSecurityEvent(opts: LogSecurityEventOpts): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;
    await db.from("security_events").insert({
      user_id:    opts.userId    ?? null,
      event_type: opts.eventType,
      severity:   opts.severity  ?? "low",
      ip_address: opts.ipAddress ?? null,
      user_agent: opts.userAgent ?? null,
      path:       opts.path      ?? null,
      metadata:   opts.metadata  ?? {},
    });
  } catch {
    // Non-fatal — security logging must never break the main request flow
  }
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function getUserAgent(req: Request): string {
  return req.headers.get("user-agent") ?? "";
}
