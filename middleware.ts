import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { validateServerEnv } from "@/lib/env";

// ── Global API rate limiter (100 req/min per IP) ─────────────────────────────
// Per-instance only in serverless — sufficient for Vercel's single warm instance per region
const _rl = new Map<string, { n: number; t: number }>();
let _rlLastClean = Date.now();

function apiAllowed(ip: string): boolean {
  const now = Date.now();
  // Purge expired entries every 5 min to prevent unbounded memory growth
  if (now - _rlLastClean > 300_000) {
    for (const [k, v] of _rl) { if (v.t <= now) _rl.delete(k); }
    _rlLastClean = now;
  }
  const b = _rl.get(ip);
  if (!b || b.t <= now) { _rl.set(ip, { n: 1, t: now + 60_000 }); return true; }
  b.n += 1;
  return b.n <= 100;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("content-security-policy", CSP);
  if (process.env.NODE_ENV === "production") {
    response.headers.set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  }
  response.headers.set("x-request-id", crypto.randomUUID());
  return response;
}

export async function middleware(request: NextRequest) {
  validateServerEnv();

  // Global rate limit for API routes — exempt Stripe webhook (Stripe calls it, not users)
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    !request.nextUrl.pathname.startsWith("/api/stripe/webhook")
  ) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!apiAllowed(ip)) {
      return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "60" },
      });
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");

  // Skip Supabase cookie-based auth for API routes — they use Bearer token directly
  // Running getUser() on API routes causes Supabase to set session-clearing cookies
  // that propagate to the browser and trigger spurious SIGNED_OUT events
  if (!pathname.startsWith("/api/")) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    // Authenticated users bounced away from login/signup
    if (user && isAuthRoute) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
    }

    // Unauthenticated users blocked from app routes
    const isAppRoute = pathname.startsWith("/dashboard") ||
      pathname.startsWith("/transactions") ||
      pathname.startsWith("/accounts") ||
      pathname.startsWith("/budgets") ||
      pathname.startsWith("/goals") ||
      pathname.startsWith("/analytics") ||
      pathname.startsWith("/ledger") ||
      pathname.startsWith("/debts") ||
      pathname.startsWith("/investments") ||
      pathname.startsWith("/ai-assistant") ||
      pathname.startsWith("/ai-insights") ||
      pathname.startsWith("/work") ||
      pathname.startsWith("/household") ||
      pathname.startsWith("/plans") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/notifications") ||
      pathname.startsWith("/calendar") ||
      pathname.startsWith("/tags") ||
      pathname.startsWith("/recurring") ||
      pathname.startsWith("/contacts") ||
      pathname.startsWith("/export") ||
      pathname.startsWith("/net-worth") ||
      pathname.startsWith("/subscriptions") ||
      pathname.startsWith("/more") ||
      pathname.startsWith("/categories");

    if (!user && isAppRoute) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  return applySecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
