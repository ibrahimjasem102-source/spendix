"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { migrateGuestData } from "@/lib/guest/migrate";
import { isLocale, useTranslation, type Locale } from "@/lib/i18n";
import OAuthButtons from "@/components/auth/OAuthButtons";

export default function LoginPage() {
  const router = useRouter();
  const { t, setLocale } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "oauth_callback") {
      setError(t("auth.login_failed"));
    }
  }, [t]);

  async function applyUserLocale(userId: string) {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("profile_settings").select("language").eq("user_id", userId).maybeSingle();
      if (isLocale(data?.language)) await setLocale(data.language as Locale);
    } catch {
      // Locale loading should never block login.
    }
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setNeedsConfirmation(false);
    setResent(false);
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      const message = error.message || "";
      const isUnconfirmed = /confirm|confirmed|verification|not verified/i.test(message);
      setNeedsConfirmation(isUnconfirmed);
      setError(isUnconfirmed ? t("auth.email_not_verified") : (t("auth.login_failed") || message));
      setLoading(false);
      return;
    }

    if (data.user) await applyUserLocale(data.user.id);
    await fetch("/api/auth/bootstrap", { method: "POST" }).catch(() => undefined);
    await migrateGuestData().catch(() => undefined);
    router.replace("/dashboard");
    router.refresh();
  }

  async function handleResendConfirmation() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setResent(false);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResent(true);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "hsl(214 28% 5%)" }}
    >
      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }}
          >
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Spendix</h1>
          <p className="text-sm mt-1" style={{ color: "hsl(215 18% 55%)" }}>
            {t("auth.login_title")}
          </p>
        </div>

        <div
          className="rounded-[1.5rem] p-7 space-y-5"
          style={{
            background: "hsl(215 26% 10%)",
            border: "1px solid hsl(0 0% 100% / 0.08)",
            boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "hsl(215 18% 55%)" }}>
                {t("auth.email")}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none"
                style={{
                  background: "hsl(215 22% 13%)",
                  border: "1px solid hsl(0 0% 100% / 0.08)",
                  color: "hsl(210 25% 96%)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(6,182,212,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "hsl(0 0% 100% / 0.08)")}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "hsl(215 18% 55%)" }}>
                {t("auth.password")}
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="w-full px-4 py-3 pe-11 rounded-xl text-sm transition-all outline-none"
                  style={{
                    background: "hsl(215 22% 13%)",
                    border: "1px solid hsl(0 0% 100% / 0.08)",
                    color: "hsl(210 25% 96%)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(6,182,212,0.5)")}
                  onBlur={(e) => (e.target.style.borderColor = "hsl(0 0% 100% / 0.08)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                  style={{ color: "hsl(215 18% 55%)" }}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "hsl(350 89% 60% / 0.1)",
                  color: "hsl(350 89% 70%)",
                  border: "1px solid hsl(350 89% 60% / 0.2)",
                }}
              >
                {error}
                {needsConfirmation && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={loading}
                    className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold text-[#0B0F14] disabled:opacity-60"
                    style={{ background: "#FBBF24" }}
                  >
                    {t("auth.resend_verification")}
                  </button>
                )}
              </div>
            )}

            {resent && (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "hsl(160 84% 39% / 0.1)",
                  color: "hsl(160 84% 65%)",
                  border: "1px solid hsl(160 84% 39% / 0.2)",
                }}
              >
                {t("auth.verification_sent")}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[hsl(214_28%_5%)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: loading ? "#0891B2" : "linear-gradient(135deg, #06B6D4, #0891B2)" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("auth.signing_in")}
                </>
              ) : (
                t("auth.sign_in")
              )}
            </button>
          </form>

          <OAuthButtons />

          <p className="text-center text-xs pt-2" style={{ color: "hsl(215 18% 45%)" }}>
            {t("auth.dont_have_account")}{" "}
            <Link href="/signup" className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
              {t("auth.sign_up")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
