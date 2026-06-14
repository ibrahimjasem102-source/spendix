import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { validateServerEnv } from "@/lib/env";
import { checkRequestAbuse } from "@/lib/security/abuse";

// ── Global API rate limiter (100 req/min per IP) ─────────────────────────────
const _rl = new Map<string, { n: number; t: number }>();
let _rlLastClean = Date.now();

function apiAllowed(ip: string): boolean {
  const now = Date.now();
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
  "script-src 'self' 'unsafe-inline'",
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

const APP_ROUTES = [
  "/dashboard", "/transactions", "/accounts", "/budgets", "/goals",
  "/analytics", "/ledger", "/debts", "/investments", "/ai-assistant",
  "/ai-insights", "/work", "/household", "/plans", "/settings",
  "/profile", "/notifications", "/calendar", "/tags", "/recurring",
  "/contacts", "/export", "/net-worth", "/subscriptions", "/more",
  "/categories", "/privacy", "/diagnostic",
  "/invoices", "/projects", "/automation",
  "/admin",
];

function isAppRoute(pathname: string) {
  return APP_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));
}

export async function middleware(request: NextRequest) {
  validateServerEnv();

  const { pathname } = request.nextUrl;
  const ua           = request.headers.get("user-agent") ?? "";
  const queryLen     = request.nextUrl.search.length;

  // Abuse / bot / probe detection — block before any auth logic
  const abuse = checkRequestAbuse(pathname, ua, queryLen);
  if (abuse.isSuspicious && abuse.severity !== "low") {
    return new NextResponse(null, { status: 404 });
  }

  // Rate limit API routes (Stripe webhook exempt — Stripe calls it directly)
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    !request.nextUrl.pathname.startsWith("/api/stripe/webhook")
  ) {
    // Use request.ip (set by Vercel edge — cannot be spoofed by the client).
    // Fall back to x-real-ip for other hosts, then a static key for local dev.
    const ip = (request as NextRequest & { ip?: string }).ip ?? request.headers.get("x-real-ip") ?? "local";
    if (!apiAllowed(ip)) {
      return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "60" },
      });
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const isAuth = pathname.startsWith("/login") || pathname.startsWith("/signup");

  // API routes authenticate via Bearer token — skip cookie-based auth here to
  // avoid Supabase writing session-clearing cookies that trigger spurious SIGNED_OUT
  if (!pathname.startsWith("/api/")) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            // Write updated cookies into both the request (for downstream) and the
            // response (so the browser stores the refreshed session).
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // getSession() is used instead of getUser() so that:
    //   1. When the access token expires (every hour) but the refresh token cookie
    //      is still valid, Supabase refreshes automatically — no redirect to /login.
    //   2. The refreshed tokens are written back via setAll → browser gets new cookies.
    // Trade-off: JWT is validated locally (no server round-trip) instead of being
    // re-checked against Supabase's revocation list. Acceptable for routing decisions;
    // API routes still use getUser() via requireUser() for data access.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    // Logged-in users should not see login / signup pages
    if (user && isAuth) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
    }

    if (!user && isAppRoute(pathname)) {
      // If Supabase itself is unreachable (network error), let the request through —
      // the client-side SessionRestorer will recover without showing the login page.
      const isNetworkError = !!sessionError && (
        sessionError.message?.toLowerCase().includes("fetch") ||
        sessionError.message?.toLowerCase().includes("network") ||
        sessionError.status === undefined
      );
      if (isNetworkError) return applySecurityHeaders(supabaseResponse);

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
