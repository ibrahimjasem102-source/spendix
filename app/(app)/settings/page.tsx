"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User, Globe, Palette, Bell, Sparkles, Check, DollarSign,
  Moon, Sun, Shield, LogOut, ChevronRight, KeyRound, LockKeyhole, Loader2,
} from "lucide-react";
import Link from "next/link";
import { useTranslation, LOCALES, type Locale } from "@/lib/i18n";
import { useCurrency, CURRENCIES, type Currency } from "@/lib/currency";
import { useTheme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/client";
import { fadeIn, spring, tapTransition } from "@/lib/motion";
import { ROOM_DEFINITIONS, useRoomLocks } from "@/contexts/RoomLockContext";
import { useGuest } from "@/contexts/GuestContext";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <motion.button
      type="button"
      onClick={() => onChange(!checked)}
      whileTap={{ scale: 0.9 }}
      transition={tapTransition}
      className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition-colors ${
        checked ? "bg-cyan-400" : "bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))]"
      }`}
    >
      <span className={`inline-block w-[16px] h-[16px] rounded-full bg-white shadow-sm transform transition-all duration-200 ${
        checked ? "translate-x-[20px]" : "translate-x-[3px]"
      }`} />
    </motion.button>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[hsl(var(--border-2))] last:border-0">
      <div className="flex-1 min-w-0 me-4">
        <p className="text-sm font-medium t1">{label}</p>
        {hint && <p className="text-xs t3 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

type SectionId = "profile" | "language" | "currency" | "appearance" | "notifications" | "ai" | "security";

interface Section { id: SectionId; label: string; icon: React.ElementType; badge?: string }

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  const { theme, setTheme }       = useTheme();
  const { isGuest } = useGuest();
  const { config: roomConfig, hasPin, setPin, clearPin, setRoomLocked, lockAllRooms } = useRoomLocks();

  const [active, setActive]    = useState<SectionId>("profile");
  const [saved,  setSaved]     = useState(false);
  const [saving, setSaving]    = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile]  = useState({ name: "", email: "" });
  const [notifs,  setNotifs]   = useState({ budget: true, weekly: true, ai_alerts: false, email: false, debt_reminders: true });
  const [ai,      setAI]       = useState({ enabled: true, auto: false, model: "claude-haiku" });
  const [roomPin, setRoomPin]  = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? "");
        setProfile({ name: user.user_metadata?.full_name ?? "", email: user.email ?? "" });
      }
    });
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    const { setAuthToken } = await import("@/lib/auth/token-store");
    setAuthToken(null);
    window.location.replace("/login");
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Save full_name to auth metadata so it's immediately available
      if (profile.name.trim()) {
        await supabase.auth.updateUser({
          data: { full_name: profile.name.trim() },
        });
      }
      // Save all settings including full_name to profile_settings
      await supabase.from("profile_settings").upsert({
        user_id:  user.id,
        full_name: profile.name.trim() || null,
        language:  locale,
        currency,
        theme,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const SECTIONS: Section[] = [
    { id: "profile",       label: t("settings.profile"),       icon: User       },
    { id: "language",      label: t("settings.language"),      icon: Globe      },
    { id: "currency",      label: t("settings.currency"),      icon: DollarSign },
    { id: "appearance",    label: t("settings.appearance"),    icon: Palette    },
    { id: "notifications", label: t("settings.notifications"), icon: Bell, badge: "3" },
    { id: "ai",            label: t("settings.ai"),            icon: Sparkles   },
    { id: "security",      label: t("settings.security"),      icon: Shield     },
  ];

  const initials = profile.name ? profile.name.slice(0, 2).toUpperCase() : (userEmail[0] ?? "U").toUpperCase();

  function handleRoomPinSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setPin(roomPin)) {
      setPinError(t("rooms.pin_length_error"));
      return;
    }
    setRoomPin("");
    setPinError("");
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 1800);
  }

  return (
    <div className="space-y-4 sm:space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold t1">{t("settings.title")}</h1>
        <p className="text-xs sm:text-sm t2 mt-0.5">{t("settings.subtitle")}</p>
      </div>

      {/* Guest login banner */}
      {isGuest && (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500">
            <User className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold t1">{t("topbar.guest_mode")}</p>
            <p className="text-xs t3 mt-0.5">{t("auth.dont_have_account")} <span className="text-cyan-400">{t("auth.sign_up")}</span></p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 px-4 py-2 text-xs font-bold text-[#0B0F14] transition-all hover:brightness-110"
            >
              {t("nav.sign_in")}
            </Link>
            <Link
              href="/signup"
              className="flex items-center justify-center rounded-xl border border-[hsl(var(--border))] px-4 py-2 text-xs font-semibold t2 hover:t1 transition-all"
            >
              {t("auth.sign_up")}
            </Link>
          </div>
        </div>
      )}

      {/* Mobile: horizontal scrollable tabs; Desktop: sidebar */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">

        {/* Mobile tabs — scrollable chips */}
        <div className="sm:hidden">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  active === id
                    ? "bg-[hsl(var(--bg-card-2))] t1 shadow-sm"
                    : "t3 hover:t2 bg-[hsl(var(--bg-input))]"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop sidebar nav */}
        <div className="hidden sm:block w-44 shrink-0 space-y-0.5">
          {SECTIONS.map(({ id, label, icon: Icon, badge }) => (
            <motion.button
              key={id}
              onClick={() => setActive(id)}
              whileTap={{ scale: 0.97 }}
              transition={tapTransition}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[0.875rem] text-sm font-medium transition-all ${
                active === id
                  ? "t1 bg-[hsl(var(--bg-card-2))]"
                  : "t3 hover:t2 hover:bg-[hsl(var(--bg-input))]"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-start">{label}</span>
              {badge && (
                <span className="text-[10px] font-bold bg-rose-400/10 text-rose-400 px-1.5 py-0.5 rounded-md">
                  {badge}
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* Content */}
        <motion.div
          key={active}
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={spring}
          className="flex-1 card p-4 sm:p-6 space-y-1 min-w-0"
        >

          {/* ── Profile ──────────────────────────────── */}
          {active === "profile" && (
            <div>
              <h2 className="text-base font-bold t1 mb-5">{t("settings.profile")}</h2>

              {/* Avatar + info */}
              <div className="flex items-center gap-4 mb-6 pb-5 border-b border-[hsl(var(--border-2))]">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold t1">{profile.name || t("settings.full_name")}</p>
                  <p className="text-xs t3 mt-0.5">{userEmail}</p>
                </div>
                {!isGuest && (
                  <motion.button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    whileTap={{ scale: 0.95 }}
                    transition={tapTransition}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-400/25 bg-rose-400/8 text-xs font-semibold text-rose-400 hover:bg-rose-400/15 transition-all disabled:opacity-50 shrink-0"
                  >
                    {signingOut
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <LogOut className="w-3.5 h-3.5" />}
                    {t("nav.sign_out")}
                  </motion.button>
                )}
              </div>

              <div className="space-y-4">
                {([
                  ["full_name", "name", "text", t("settings.full_name")],
                  ["email", "email", "email", t("settings.email")],
                ] as const).map(([key, field, type, label]) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold t3 uppercase tracking-wide mb-1.5">{label}</label>
                    <input type={type} value={profile[field]}
                      onChange={(e) => setProfile(p => ({ ...p, [field]: e.target.value }))}
                      className="field" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Language ─────────────────────────────── */}
          {active === "language" && (
            <div>
              <h2 className="text-base font-bold t1 mb-5">{t("settings.language")}</h2>
              <div className="grid grid-cols-1 gap-2">
                {LOCALES.map((l) => (
                  <motion.button
                    key={l.code}
                    onClick={() => void setLocale(l.code as Locale)}
                    whileTap={{ scale: 0.98 }}
                    transition={tapTransition}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-start transition-all ${
                      locale === l.code
                        ? "border-cyan-400/30 bg-cyan-400/5"
                        : "border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] hover:border-[hsl(var(--border))]"
                    }`}
                  >
                    <span className="text-xl">{l.badge === "AR" ? "🇸🇦" : l.badge === "DE" ? "🇩🇪" : "🇬🇧"}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${locale === l.code ? "text-cyan-400" : "t1"}`}>{l.nativeLabel ?? l.label}</p>
                      <p className="text-xs t3">{l.label}</p>
                    </div>
                    {locale === l.code && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </motion.button>
                ))}
              </div>
              <p className="text-xs t3 mt-4">{t("settings.language_hint")}</p>
            </div>
          )}

          {/* ── Currency ─────────────────────────────── */}
          {active === "currency" && (
            <div>
              <h2 className="text-base font-bold t1 mb-5">{t("settings.currency")}</h2>
              <div className="grid grid-cols-2 gap-2">
                {CURRENCIES.map((c) => (
                  <motion.button
                    key={c.code}
                    onClick={() => setCurrency(c.code as Currency)}
                    whileTap={{ scale: 0.97 }}
                    transition={tapTransition}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                      currency === c.code
                        ? "border-cyan-400/30 bg-cyan-400/5"
                        : "border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] hover:border-[hsl(var(--border))]"
                    }`}
                  >
                    <span className="text-lg font-bold w-8 text-center"
                      style={{ color: currency === c.code ? "#06B6D4" : undefined }}>
                      {c.symbol}
                    </span>
                    <div className="text-start">
                      <p className={`text-sm font-semibold ${currency === c.code ? "text-cyan-400" : "t1"}`}>{c.code}</p>
                      <p className="text-[10px] t3">{t(c.labelKey)}</p>
                    </div>
                    {currency === c.code && <Check className="w-3.5 h-3.5 text-cyan-400 ms-auto" />}
                  </motion.button>
                ))}
              </div>
              <p className="text-xs t3 mt-4">{t("settings.currency_hint")}</p>
            </div>
          )}

          {/* ── Appearance ───────────────────────────── */}
          {active === "appearance" && (
            <div>
              <h2 className="text-base font-bold t1 mb-5">{t("settings.appearance")}</h2>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {(["dark", "light"] as const).map((th) => (
                  <motion.button
                    key={th}
                    onClick={() => setTheme(th)}
                    whileTap={{ scale: 0.97 }}
                    transition={tapTransition}
                    className={`p-5 rounded-2xl border flex flex-col items-center gap-3 transition-all ${
                      theme === th
                        ? "border-cyan-400/30 bg-cyan-400/5"
                        : "border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] hover:border-[hsl(var(--border))]"
                    }`}
                  >
                    {th === "dark" ? <Moon className="w-6 h-6 text-purple-400" /> : <Sun className="w-6 h-6 text-amber-400" />}
                    <span className={`text-sm font-semibold ${theme === th ? "text-cyan-400" : "t1"}`}>
                      {t(`settings.${th}_mode`)}
                    </span>
                    {theme === th && <Check className="w-4 h-4 text-cyan-400" />}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* ── Notifications ────────────────────────── */}
          {active === "notifications" && (
            <div>
              <h2 className="text-base font-bold t1 mb-2">{t("settings.notifications")}</h2>
              <p className="text-xs t3 mb-5">{t("settings.notifications_hint")}</p>
              <SettingRow label={t("settings.budget_alerts")} hint={t("settings.budget_alerts_hint")}>
                <Toggle checked={notifs.budget} onChange={(v) => setNotifs(p => ({ ...p, budget: v }))} />
              </SettingRow>
              <SettingRow label={t("settings.debt_reminders")} hint={t("settings.debt_reminders_hint")}>
                <Toggle checked={notifs.debt_reminders} onChange={(v) => setNotifs(p => ({ ...p, debt_reminders: v }))} />
              </SettingRow>
              <SettingRow label={t("settings.weekly_summary")} hint={t("settings.weekly_summary_hint")}>
                <Toggle checked={notifs.weekly} onChange={(v) => setNotifs(p => ({ ...p, weekly: v }))} />
              </SettingRow>
              <SettingRow label={t("settings.ai_alerts")} hint={t("settings.ai_alerts_hint")}>
                <Toggle checked={notifs.ai_alerts} onChange={(v) => setNotifs(p => ({ ...p, ai_alerts: v }))} />
              </SettingRow>
              <SettingRow label={t("settings.email_notifications")} hint={t("settings.email_notifications_hint")}>
                <Toggle checked={notifs.email} onChange={(v) => setNotifs(p => ({ ...p, email: v }))} />
              </SettingRow>
            </div>
          )}

          {/* ── AI Settings ──────────────────────────── */}
          {active === "ai" && (
            <div>
              <h2 className="text-base font-bold t1 mb-2">{t("settings.ai")}</h2>
              <p className="text-xs t3 mb-5">{t("settings.ai_hint")}</p>
              <SettingRow label={t("settings.enable_ai")} hint={t("settings.enable_ai_hint")}>
                <Toggle checked={ai.enabled} onChange={(v) => setAI(p => ({ ...p, enabled: v }))} />
              </SettingRow>
              <SettingRow label={t("settings.auto_refresh")} hint={t("settings.auto_refresh_hint")}>
                <Toggle checked={ai.auto} onChange={(v) => setAI(p => ({ ...p, auto: v }))} />
              </SettingRow>
              <div className="py-4">
                <p className="text-sm font-semibold t1 mb-3">{t("settings.ai_model")}</p>
                <div className="space-y-2">
                  {[
                    { id: "claude-haiku",  label: "Claude Haiku",  desc: t("settings.model_fast")     },
                    { id: "claude-sonnet", label: "Claude Sonnet", desc: t("settings.model_balanced")  },
                  ].map((m) => (
                    <motion.button
                      key={m.id}
                      onClick={() => setAI(p => ({ ...p, model: m.id }))}
                      whileTap={{ scale: 0.98 }}
                      transition={tapTransition}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-start transition-all ${
                        ai.model === m.id
                          ? "border-cyan-400/30 bg-cyan-400/5 t1"
                          : "border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] t2 hover:border-[hsl(var(--border))]"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold">{m.label}</p>
                        <p className="text-xs t3">{m.desc}</p>
                      </div>
                      {ai.model === m.id && (
                        <span className="w-5 h-5 rounded-full bg-cyan-400 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-[hsl(var(--bg-page))]" />
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Security ─────────────────────────────── */}
          {active === "security" && (
            <div>
              <h2 className="text-base font-bold t1 mb-2">{t("settings.security")}</h2>
              <p className="text-xs t3 mb-5">{t("rooms.settings_hint")}</p>

              <form onSubmit={handleRoomPinSubmit} className="rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold t1">{t("rooms.pin_title")}</p>
                    <p className="mt-0.5 text-xs t3">{hasPin ? t("rooms.pin_active") : t("rooms.pin_inactive")}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={roomPin}
                    onChange={(event) => {
                      setRoomPin(event.target.value);
                      if (pinError) setPinError("");
                    }}
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    className="field flex-1"
                    placeholder={t("rooms.new_pin_placeholder")}
                  />
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.96 }}
                    transition={tapTransition}
                    className="min-h-[44px] rounded-xl bg-cyan-400 px-4 text-sm font-bold text-[#071018]"
                  >
                    {pinSaved ? t("common.saved") : t("rooms.save_pin")}
                  </motion.button>
                </div>
                {pinError && <p className="mt-2 text-xs text-rose-300">{pinError}</p>}
              </form>

              <div className="mt-4 rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] px-4">
                {ROOM_DEFINITIONS.map((room) => (
                  <SettingRow key={room.id} label={t(room.labelKey)} hint={t(room.descriptionKey)}>
                    <Toggle
                      checked={roomConfig.rooms[room.id]}
                      onChange={(value) => setRoomLocked(room.id, value)}
                    />
                  </SettingRow>
                ))}
              </div>

              {!hasPin && (
                <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
                  {t("rooms.pin_required_hint")}
                </p>
              )}

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={lockAllRooms}
                  disabled={!hasPin}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] px-4 py-3 text-start transition-all hover:border-[hsl(var(--border))] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LockKeyhole className="w-4 h-4 shrink-0 text-amber-300" />
                  <span className="text-sm font-medium t1">{t("rooms.lock_now")}</span>
                  <ChevronRight className="w-4 h-4 t3 ms-auto" />
                </button>
                <button
                  type="button"
                  onClick={clearPin}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] px-4 py-3 text-start transition-all hover:border-rose-400/30 hover:bg-rose-400/5"
                >
                  <Shield className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="text-sm font-medium text-rose-400">{t("rooms.disable_all")}</span>
                  <ChevronRight className="w-4 h-4 t3 ms-auto" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    const { setAuthToken } = await import("@/lib/auth/token-store");
                    setAuthToken(null);
                    window.location.replace("/login");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] px-4 py-3 text-start transition-all hover:border-rose-400/30 hover:bg-rose-400/5">
                  <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="text-sm font-medium text-rose-400">{t("nav.sign_out")}</span>
                  <ChevronRight className="w-4 h-4 t3 ms-auto" />
                </button>
              </div>
            </div>
          )}

          {/* Save button */}
          {active !== "security" && (
            <div className="flex justify-end pt-5 border-t border-[hsl(var(--border-2))] mt-4">
              <motion.button
                onClick={handleSave}
                disabled={saving}
                whileTap={{ scale: 0.96 }}
                transition={tapTransition}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                  saved
                    ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                    : "text-[hsl(var(--bg-page))]"
                }`}
                style={!saved ? { background: "linear-gradient(135deg, #06B6D4, #0891B2)" } : {}}
              >
                {saved
                  ? <><Check className="w-3.5 h-3.5" />{t("settings.saved")}</>
                  : saving
                    ? t("common.loading")
                    : t("settings.save")}
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
