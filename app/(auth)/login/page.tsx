"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signedIn } from "@/lib/auth/session-manager";
import { getRefreshToken, storeRefreshToken } from "@/lib/auth/token-store";
import { useTranslation } from "@/lib/i18n";
import OAuthButtons from "@/components/auth/OAuthButtons";

// ── Restore session from stored refresh token (silent) ─────────────────────
async function tryRestoreSession(
  supabase: ReturnType<typeof createClient>,
  dest: string,
): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    signedIn(session.access_token, session.refresh_token ?? undefined);
    window.location.replace(dest);
    return true;
  }

  const storedRefresh = getRefreshToken();
  if (!storedRefresh) return false;

  const { data } = await supabase.auth.refreshSession({ refresh_token: storedRefresh });
  if (!data.session?.access_token) return false;

  const { access_token, refresh_token } = data.session;
  signedIn(access_token, refresh_token ?? undefined);
  if (refresh_token) storeRefreshToken(refresh_token);

  await fetch("/api/auth/set-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token, refresh_token }),
  }).catch(() => undefined);

  window.location.replace(dest);
  return true;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
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

    const supabase = createClient();
    tryRestoreSession(supabase, safeDest)
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(214 28% 5%)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }}>
              <Wallet className="w-7 h-7 text-white" />
            </div>
            <div className="absolute -inset-1 rounded-2xl opacity-30 blur-lg"
              style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }} />
          </div>
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  // ── Login form ──────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(214 60% 8%) 0%, hsl(214 28% 5%) 100%)" }}
    >
      {/* Glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-20 blur-3xl rounded-full"
          style={{ background: "radial-gradient(ellipse, #06B6D4 0%, #7C3AED 60%, transparent 100%)" }} />
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }}>
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -inset-1 rounded-2xl opacity-40 blur-xl"
              style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Spendix</h1>
          <p className="text-sm mt-1.5" style={{ color: "hsl(215 18% 50%)" }}>
            {t("auth.login_title")}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7 space-y-5"
          style={{
            background: "hsl(215 26% 9%)",
            border: "1px solid hsl(0 0% 100% / 0.07)",
            boxShadow: "0 0 0 1px hsl(0 0% 100% / 0.04), 0 32px 64px rgba(0,0,0,0.6)",
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
              className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
              style={{
                background: "linear-gradient(135deg, #06B6D4, #7C3AED)",
                color: "#fff",
                boxShadow: loading ? "none" : "0 0 24px rgba(6,182,212,0.25)",
              }}
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
