"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Wallet, X, Check, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signedIn } from "@/lib/auth/session-manager";
import { migrateGuestData } from "@/lib/guest/migrate";
import { useTranslation } from "@/lib/i18n";
import { spring, tapTransition } from "@/lib/motion";
import SheetDragHandle from "@/components/ui/SheetDragHandle";

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

type Mode = "login" | "signup";

export default function InlineLoginModal({ onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [mode,     setMode]     = useState<Mode>("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [done,     setDone]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);

    const supabase = createClient();

    const { data, error: authError } = mode === "login"
      ? await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      : await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });

    if (authError) {
      setError(t("auth.login_failed") || authError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      // Signup with email confirmation required
      setError(t("auth.email_not_verified"));
      setLoading(false);
      return;
    }

    // â”€â”€ Authenticated! â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { access_token, refresh_token } = data.session;

    // 1. Store tokens
    signedIn(access_token, refresh_token);

    // 2. Server cookies + bootstrap in background
    const bHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` };
    const locale   = localStorage.getItem("spendix_locale") ?? "ar";
    fetch("/api/auth/set-session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token, refresh_token }),
    }).catch(() => undefined);
    fetch("/api/auth/bootstrap", {
      method: "POST", headers: bHeaders,
      body: JSON.stringify({ locale }),
    }).catch(() => undefined);

    // 3. Migrate guest data â†’ Supabase silently
    await migrateGuestData({ saveSettings: true }).catch(() => undefined);

    setDone(true);
    setLoading(false);

    // Close after brief success animation
    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 800);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(11,15,20,0.85)", backdropFilter: "blur(12px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.97 }}
        transition={spring}
        className="w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
          maxHeight: "90dvh",
        }}
      >
        <SheetDragHandle onClose={onClose} />

        <div className="px-6 pt-2 pb-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500">
                <Wallet className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-black t1">
                  {mode === "login" ? t("auth.sign_in") : t("auth.sign_up")}
                </h2>
                <p className="text-xs t3 mt-0.5">
                  {mode === "login" ? t("auth.login_title") : t("auth.signup_title")}
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl t3 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 rounded-xl bg-[hsl(var(--bg-input))] p-1">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                  mode === m
                    ? "bg-[hsl(var(--bg-card))] text-cyan-400 shadow-sm"
                    : "t3 hover:t2"
                }`}>
                {m === "login" ? t("auth.sign_in") : t("auth.sign_up")}
              </button>
            ))}
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="done"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15">
                  <Check className="h-7 w-7 text-emerald-400" />
                </div>
                <p className="text-sm font-bold t1">{t("auth.welcome_back")}</p>
                <p className="text-xs t3">{t("auth.data_synced")}</p>
              </motion.div>
            ) : (
              <motion.form key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onSubmit={handleSubmit} className="space-y-3">

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                    {t("auth.email")}
                  </label>
                  <input type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="field text-sm" />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-semibold uppercase tracking-wide t3">
                    {t("auth.password")}
                  </label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} required value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                      className="field text-sm pe-10" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 p-1 rounded-lg t3 hover:t1 transition-colors">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">
                    {error}
                  </p>
                )}

                <motion.button type="submit" disabled={loading}
                  whileTap={{ scale: 0.97 }} transition={tapTransition}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: "#06B6D4", color: "#0D1117" }}>
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" />{t("auth.signing_in")}</>
                    : mode === "login"
                      ? t("auth.sign_in")
                      : <><UserPlus className="h-4 w-4" />{t("auth.sign_up")}</>}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Guest note */}
          {!done && (
            <p className="text-center text-[11px] t3 leading-relaxed">
              {t("auth.guest_data_will_sync")}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

