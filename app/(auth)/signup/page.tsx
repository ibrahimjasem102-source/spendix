"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { migrateGuestData } from "@/lib/guest/migrate";
import { useTranslation } from "@/lib/i18n";
import OAuthButtons from "@/components/auth/OAuthButtons";

export default function SignupPage() {
  const router = useRouter();
  const { t }  = useTranslation();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
      },
    });

    if (error) {
      setError(t("auth.signup_failed") || error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      await fetch("/api/auth/bootstrap", { method: "POST" }).catch(() => undefined);
      await migrateGuestData().catch(() => undefined);
      router.replace("/dashboard");
    } else {
      setConfirmationSent(true);
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "hsl(214 28% 5%)" }}
    >
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Spendix</h1>
          <p className="text-sm mt-1" style={{ color: "hsl(215 18% 55%)" }}>
            {t("auth.signup_title")}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[1.5rem] p-7 space-y-5"
          style={{
            background: "hsl(215 26% 10%)",
            border: "1px solid hsl(0 0% 100% / 0.08)",
            boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          }}>

          <form onSubmit={handleSubmit} className="space-y-4">
            {confirmationSent && (
              <div className="px-4 py-3 rounded-xl text-sm"
                style={{ background: "hsl(160 84% 39% / 0.1)", color: "hsl(160 84% 65%)", border: "1px solid hsl(160 84% 39% / 0.2)" }}>
                تم إنشاء الحساب. افتح رسالة التأكيد في بريدك الإلكتروني، ثم سجّل الدخول.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: "hsl(215 18% 55%)" }}>
                {t("auth.email")}
              </label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none"
                style={{
                  background: "hsl(215 22% 13%)",
                  border: "1px solid hsl(0 0% 100% / 0.08)",
                  color: "hsl(210 25% 96%)",
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(124,58,237,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "hsl(0 0% 100% / 0.08)"}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: "hsl(215 18% 55%)" }}>
                {t("auth.password")}
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} required minLength={6} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.password_min")}
                  className="w-full px-4 py-3 pe-11 rounded-xl text-sm transition-all outline-none"
                  style={{
                    background: "hsl(215 22% 13%)",
                    border: "1px solid hsl(0 0% 100% / 0.08)",
                    color: "hsl(210 25% 96%)",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(124,58,237,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "hsl(0 0% 100% / 0.08)"}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                  style={{ color: "hsl(215 18% 55%)" }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm"
                style={{ background: "hsl(350 89% 60% / 0.1)", color: "hsl(350 89% 70%)", border: "1px solid hsl(350 89% 60% / 0.2)" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: loading ? "#6D28D9" : "linear-gradient(135deg, #7C3AED, #6D28D9)" }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t("auth.creating_account")}</> : t("auth.create_account")}
            </button>
          </form>

          <OAuthButtons />

          <p className="text-center text-xs pt-2" style={{ color: "hsl(215 18% 45%)" }}>
            {t("auth.already_have_account")}{" "}
            <Link href="/login" className="font-semibold text-purple-400 hover:text-purple-300 transition-colors">
              {t("auth.sign_in")}
            </Link>
          </p>
        </div>

        {/* Privacy note */}
        <p className="text-center text-xs mt-5" style={{ color: "hsl(215 14% 32%)" }}>
          Spendix keeps your personal finance workspace private.
        </p>
      </div>
    </div>
  );
}
