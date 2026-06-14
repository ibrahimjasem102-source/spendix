"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signedIn, init as initSession, getSessionState } from "@/lib/auth/session-manager";
import { useTranslation } from "@/lib/i18n";
import OAuthButtons from "@/components/auth/OAuthButtons";

// Silently restore an existing session and redirect if one is found.
// Delegates all restore logic (cookie, localStorage fallback, server cookie
// refresh) to SessionManager.init() — the single source of truth.
// Hard 6-second timeout so a slow/unreachable Supabase never leaves the user
// staring at a loading spinner — the login form shows up regardless.
async function tryRestoreSession(dest: string): Promise<boolean> {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 6000));
  const restore = initSession()
    .then(() => {
      const { isAuthenticated } = getSessionState();
      if (isAuthenticated) {
        window.location.replace(dest);
        return true as const;
      }
      return false as const;
    })
    .catch(() => false as const);

  return Promise.race([restore, timeout]);
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { t } = useTranslation();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resent,   setResent]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [checking, setChecking] = useState(true);
  const [dest,     setDest]     = useState("/dashboard");

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const next    = params.get("next");
    const safeDest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    setDest(safeDest);

    if (params.get("error") === "oauth_callback") {
      setError(t("auth.login_failed"));
      setChecking(false);
      return;
    }

    tryRestoreSession(safeDest)
      .then((restored) => { if (!restored) setChecking(false); })
      .catch(() => setChecking(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setNeedsConfirmation(false); setResent(false); setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      const msg = signInError.message || "";
      const isUnconfirmed = /confirm|confirmed|verification|not verified/i.test(msg);
      setNeedsConfirmation(isUnconfirmed);
      setError(isUnconfirmed ? t("auth.email_not_verified") : (t("auth.login_failed") || msg));
      setLoading(false);
      return;
    }

    if (!data.session) {
      setNeedsConfirmation(true);
      setError(t("auth.email_not_verified"));
      setLoading(false);
      return;
    }

    const { access_token, refresh_token } = data.session;
    signedIn(access_token, refresh_token);

    // Set server-side cookies so middleware sees the session on the next request.
    // We await this before navigating to avoid a race where middleware redirects
    // back to /login because the cookie hasn't been written yet.
    await fetch("/api/auth/set-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token, refresh_token }),
    }).catch(() => undefined);

    const locale = typeof window !== "undefined"
      ? (localStorage.getItem("spendix_locale") ?? "ar") : "ar";
    const bHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` };
    const bBody    = JSON.stringify({ locale });
    try {
      const res = await fetch("/api/auth/bootstrap", { method: "POST", headers: bHeaders, body: bBody });
      if (!res.ok) {
        await new Promise(r => setTimeout(r, 600));
        fetch("/api/auth/bootstrap", { method: "POST", headers: bHeaders, body: bBody }).catch(() => undefined);
      }
    } catch {
      fetch("/api/auth/bootstrap", { method: "POST", headers: bHeaders, body: bBody }).catch(() => undefined);
    }

    // Full page navigation — guarantees the browser sends the freshly-set
    // session cookies to the middleware (router.replace() is client-side only
    // and may not flush Set-Cookie headers before the next RSC fetch).
    window.location.replace(dest);
  }

  async function handleResendConfirmation() {
    if (!email.trim()) return;
    setLoading(true); setError(""); setResent(false);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    setLoading(false);
    if (resendError) { setError(resendError.message); return; }
    setResent(true);
  }

  // ── Checking spinner ────────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(216 30% 7%)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-500">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  // ── Login form ──────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "hsl(216 30% 7%)" }}
    >
      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-cyan-500 mb-4">
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[hsl(210_20%_94%)] tracking-tight">Spendix</h1>
          <p className="text-sm mt-1.5" style={{ color: "hsl(215 15% 52%)" }}>
            {t("auth.login_title")}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-6 space-y-5"
          style={{
            background: "hsl(215 24% 10%)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.40)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider"
                style={{ color: "hsl(215 18% 50%)" }}>
                {t("auth.email")}
              </label>
              <div className="relative">
                <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "hsl(215 18% 45%)" }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full ps-10 pe-4 py-3 rounded-xl text-sm transition-colors outline-none"
                  style={{
                    background: "hsl(215 22% 12%)",
                    border: "1px solid hsl(0 0% 100% / 0.07)",
                    color: "hsl(210 25% 95%)",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(6,182,212,0.4)")}
                  onBlur={e  => (e.target.style.borderColor = "hsl(0 0% 100% / 0.07)")}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider"
                style={{ color: "hsl(215 18% 50%)" }}>
                {t("auth.password")}
              </label>
              <div className="relative">
                <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "hsl(215 18% 45%)" }} />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full ps-10 pe-11 py-3 rounded-xl text-sm transition-colors outline-none"
                  style={{
                    background: "hsl(215 22% 12%)",
                    border: "1px solid hsl(0 0% 100% / 0.07)",
                    color: "hsl(210 25% 95%)",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(6,182,212,0.4)")}
                  onBlur={e  => (e.target.style.borderColor = "hsl(0 0% 100% / 0.07)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors"
                  style={{ color: "hsl(215 18% 45%)" }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "hsl(350 89% 60% / 0.08)",
                  color: "hsl(350 89% 70%)",
                  border: "1px solid hsl(350 89% 60% / 0.18)",
                }}
              >
                {error}
                {needsConfirmation && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={loading}
                    className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60 transition-opacity"
                    style={{ background: "#FBBF24", color: "#0B0F14" }}
                  >
                    {t("auth.resend_verification")}
                  </button>
                )}
              </div>
            )}

            {/* Resent confirmation */}
            {resent && (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "hsl(160 84% 39% / 0.08)",
                  color: "hsl(160 84% 60%)",
                  border: "1px solid hsl(160 84% 39% / 0.18)",
                }}
              >
                {t("auth.verification_sent")}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
              style={{ background: "#06B6D4", color: "#0D1117" }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t("auth.signing_in")}</>
                : t("auth.sign_in")}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "hsl(0 0% 100% / 0.07)" }} />
            <span className="text-xs" style={{ color: "hsl(215 18% 40%)" }}>أو</span>
            <div className="flex-1 h-px" style={{ background: "hsl(0 0% 100% / 0.07)" }} />
          </div>

          <OAuthButtons />

          <p className="text-center text-xs pt-1" style={{ color: "hsl(215 18% 40%)" }}>
            {t("auth.dont_have_account")}{" "}
            <Link
              href="/signup"
              className="font-semibold transition-colors"
              style={{ color: "#22D3EE" }}
            >
              {t("auth.sign_up")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
