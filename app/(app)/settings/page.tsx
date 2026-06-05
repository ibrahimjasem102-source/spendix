"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, Check, ChevronRight, Download, Eye, EyeOff,
  Globe, KeyRound, Loader2, LockKeyhole, LogIn, LogOut,
  Moon, Palette, Shield, Sparkles, Sun, Trash2, User, WalletCards,
  Database, Lock, Unlock,
} from "lucide-react";
import { useGuest } from "@/contexts/GuestContext";
import { ROOM_DEFINITIONS, useRoomLocks } from "@/contexts/RoomLockContext";
import { useCurrency, CURRENCIES, type Currency } from "@/lib/currency";
import { useTranslation, LOCALES, type Locale } from "@/lib/i18n";
import { spring, tapTransition } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { migrateGuestData } from "@/lib/guest/migrate";
import { useTheme } from "@/lib/theme";

// ── Reusable components ───────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <motion.button type="button" onClick={() => !disabled && onChange(!checked)}
      whileTap={{ scale: disabled ? 1 : 0.93 }} transition={tapTransition} disabled={disabled}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-cyan-400" : "border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]"
      }`} aria-pressed={checked}>
      <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
        checked ? "translate-x-[22px] rtl:translate-x-[4px]" : "translate-x-1 rtl:translate-x-[22px]"
      }`} />
    </motion.button>
  );
}

function SettingRow({ label, hint, children, danger }: {
  label: string; hint?: string; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <div className={`flex min-h-[52px] items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(var(--border-2))] last:border-0 ${
      danger ? "bg-rose-400/3" : ""
    }`}>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${danger ? "text-rose-300" : "t1"}`}>{label}</p>
        {hint && <p className="mt-0.5 text-xs t3 line-clamp-1">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, icon: Icon, color, bg, children }: {
  title: string; icon: React.ElementType; color: string; bg: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${bg}`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] t3">{title}</p>
      </div>
      <div className="card overflow-hidden">{children}</div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────

type NotificationState = { budget: boolean; weekly: boolean; ai_alerts: boolean; debt_reminders: boolean };
type AIState = { enabled: boolean; auto: boolean; model: "claude-haiku" | "claude-sonnet" };
type Tab = "account" | "prefs" | "privacy" | "data";

// ── Page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const { currency, setCurrency }  = useCurrency();
  const { theme, setTheme }        = useTheme();
  const { isGuest }                = useGuest();
  const { config: roomConfig, hasPin, setPin, clearPin, setRoomLocked, lockAllRooms } = useRoomLocks();

  // UI state
  const [tab,       setTab]       = useState<Tab>("account");
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  // Account
  const [userEmail, setUserEmail] = useState("");
  const [fullName,  setFullName]  = useState("");
  const [signingOut, setSigningOut] = useState(false);

  // Password
  const [showPw,     setShowPw]     = useState(false);
  const [newPw,      setNewPw]      = useState("");
  const [showNewPw,  setShowNewPw]  = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg,      setPwMsg]      = useState<{ ok: boolean; text: string } | null>(null);

  // Preferences
  const [notifs, setNotifs] = useState<NotificationState>({
    budget: true, weekly: true, ai_alerts: false, debt_reminders: true,
  });
  const [ai, setAI] = useState<AIState>({ enabled: true, auto: false, model: "claude-haiku" });

  // Privacy / Security
  const [roomPin,   setRoomPin]   = useState("");
  const [pinSaved,  setPinSaved]  = useState(false);
  const [pinError,  setPinError]  = useState("");

  // Data
  const [exporting,    setExporting]    = useState(false);
  const [importing,    setImporting]    = useState(false);
  const [importDone,   setImportDone]   = useState(false);
  const [hasGuestData, setHasGuestData] = useState(false);
  const [deleteStep,   setDeleteStep]   = useState<"idle" | "export" | "confirm">("idle");
  const [deleting,     setDeleting]     = useState(false);

  // ── Load from Supabase ───────────────────────────────────────
  useEffect(() => {
    if (isGuest) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserEmail(user.email ?? "");
      setFullName(user.user_metadata?.full_name ?? "");

      const { data } = await supabase
        .from("profile_settings")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.preferences) {
        const p = data.preferences as Record<string, unknown>;
        if (p.notifs)      setNotifs(p.notifs as NotificationState);
        if (p.ai_settings) setAI(p.ai_settings as AIState);
      }
    });
  }, [isGuest]);

  useEffect(() => {
    const keys = ["spendix_guest_transactions","spendix_guest_goals","spendix_guest_debts"];
    setHasGuestData(keys.some((k) => {
      try { return (JSON.parse(localStorage.getItem(k) ?? "[]") as unknown[]).length > 0; } catch { return false; }
    }));
  }, []);

  // ── Save ─────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (fullName.trim()) await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
      await supabase.from("profile_settings").upsert({
        user_id:     user.id,
        full_name:   fullName.trim() || null,
        language:    locale,
        currency,
        theme,
        preferences: { notifs, ai_settings: ai },
        updated_at:  new Date().toISOString(),
      }, { onConflict: "user_id" });
    }
    try {
      localStorage.setItem("spendix_notifs",      JSON.stringify(notifs));
      localStorage.setItem("spendix_ai_settings", JSON.stringify(ai));
    } catch {}
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handlePasswordChange() {
    if (newPw.length < 6) { setPwMsg({ ok: false, text: t("auth.password_min") }); return; }
    setChangingPw(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setChangingPw(false);
    if (error) { setPwMsg({ ok: false, text: error.message }); }
    else { setPwMsg({ ok: true, text: t("settings.password_changed") }); setNewPw(""); setShowPw(false); }
    setTimeout(() => setPwMsg(null), 3000);
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    const { signedOut } = await import("@/lib/auth/session-manager");
    signedOut();
    window.location.replace("/login");
  }

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!setPin(roomPin)) { setPinError(t("rooms.pin_length_error")); return; }
    setRoomPin(""); setPinError(""); setPinSaved(true);
    setTimeout(() => setPinSaved(false), 1800);
  }

  async function handleExport(type: "transactions" | "goals" | "debts") {
    setExporting(true);
    try {
      const res = await fetch(`/api/export?type=${type}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: `spendix-${type}-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      a.click(); URL.revokeObjectURL(a.href);
    } finally { setExporting(false); }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/auth/account", { method: "DELETE" });
    if (!res.ok) { setDeleting(false); setDeleteStep("idle"); return; }
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  const initials = useMemo(() => (fullName.trim() || userEmail || "S").slice(0, 2).toUpperCase(), [fullName, userEmail]);
  const lockedCount = ROOM_DEFINITIONS.filter((r) => roomConfig.rooms[r.id]).length;

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "account", label: t("settings.profile"),       icon: User    },
    { id: "prefs",   label: t("settings.preferences"),   icon: Palette },
    { id: "privacy", label: t("settings.security"),      icon: Shield  },
    { id: "data",    label: t("settings.data"),           icon: Database},
  ];

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* ── Sticky header ──────────────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-3 border-b border-[hsl(var(--border-2))] bg-[hsl(var(--bg))]/95 px-3 py-3 backdrop-blur-xl sm:-mx-5 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-black t1">{t("settings.title")}</h1>
            <p className="mt-0.5 text-[11px] t3 truncate">{t("settings.subtitle")}</p>
          </div>
          <motion.button type="button" onClick={handleSave} disabled={saving}
            whileTap={{ scale: 0.96 }} transition={tapTransition}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-2xl px-4 text-xs font-bold transition-all disabled:opacity-50 ${
              saved ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                    : "bg-cyan-400 text-[#071018]"
            }`}>
            {saved ? <Check className="h-3.5 w-3.5" /> : saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saved ? t("settings.saved") : saving ? t("common.loading") : t("settings.save")}
          </motion.button>
        </div>
      </div>

      {/* ── Profile card ───────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-4 p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-lg font-black text-white shadow-lg shadow-cyan-500/20">
            {isGuest ? <User className="h-6 w-6" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-black t1">{fullName || t("settings.profile")}</p>
            <p className="truncate text-xs t3 mt-0.5">{isGuest ? t("topbar.guest_mode") : userEmail || "—"}</p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <span className="rounded-xl bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold text-cyan-300">
              {LOCALES.find(l => l.code === locale)?.badge} {locale.toUpperCase()}
            </span>
            <span className="rounded-xl bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
              {CURRENCIES.find(c => c.code === currency)?.symbol} {currency}
            </span>
          </div>
        </div>

        {isGuest && (
          <div className="border-t border-[hsl(var(--border-2))] px-4 py-3 flex items-center gap-3 bg-cyan-400/5">
            <User className="h-4 w-4 text-cyan-300 shrink-0" />
            <p className="flex-1 text-xs t2">{t("guest_banner.message")}</p>
            <Link href="/login"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-1.5 text-xs font-bold text-[#071018]">
              <LogIn className="h-3 w-3" />{t("nav.sign_in")}
            </Link>
          </div>
        )}
      </div>

      {/* ── Tab bar ────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <motion.button key={id} type="button" onClick={() => setTab(id)}
            whileTap={{ scale: 0.97 }} transition={tapTransition}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-center transition-all ${
              tab === id
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                : "border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] t3 hover:t2"
            }`}>
            <Icon className="h-4 w-4" />
            <span className="text-[10px] font-bold leading-tight">{label}</span>
          </motion.button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }} transition={{ ...spring, duration: 0.18 }}
          className="space-y-4">

          {/* ──────── ACCOUNT ──────── */}
          {tab === "account" && (
            <>
              <Section title={t("settings.profile")} icon={User} color="text-cyan-300" bg="bg-cyan-400/10">
                <div className="p-4 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wide t3 block">{t("settings.full_name")}</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                      className="field text-sm" disabled={isGuest}
                      placeholder={t("settings.full_name")} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wide t3 block">{t("settings.email")}</label>
                    <input value={userEmail} readOnly className="field text-sm opacity-60 cursor-not-allowed" />
                  </div>
                </div>
              </Section>

              {!isGuest && (
                <Section title={t("settings.change_password")} icon={KeyRound} color="text-violet-300" bg="bg-violet-400/10">
                  <div className="p-4 space-y-3">
                    <div className="relative">
                      <input type={showNewPw ? "text" : "password"} value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder={t("auth.password_min")} minLength={6}
                        className="field text-sm pe-10" />
                      <button type="button" onClick={() => setShowNewPw(v => !v)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 p-1 t3 hover:t1 transition-colors">
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {pwMsg && (
                      <p className={`text-xs ${pwMsg.ok ? "text-emerald-400" : "text-rose-400"}`}>{pwMsg.text}</p>
                    )}
                    <motion.button type="button" onClick={handlePasswordChange}
                      disabled={changingPw || newPw.length < 6}
                      whileTap={{ scale: 0.97 }} transition={tapTransition}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                      {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {t("settings.change_password")}
                    </motion.button>
                  </div>
                </Section>
              )}

              {!isGuest && hasGuestData && (
                <Section title={t("settings.import_guest_title")} icon={LogIn} color="text-cyan-300" bg="bg-cyan-400/10">
                  <div className="p-4">
                    {importDone ? (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-sm font-semibold text-emerald-300">
                        <Check className="h-4 w-4" />{t("settings.import_guest_done")}
                      </div>
                    ) : (
                      <motion.button type="button" onClick={async () => {
                        setImporting(true);
                        await migrateGuestData({ saveSettings: false }).catch(() => undefined);
                        setHasGuestData(false); setImportDone(true);
                        setImporting(false);
                        setTimeout(() => setImportDone(false), 3000);
                      }} disabled={importing} whileTap={{ scale: 0.97 }} transition={tapTransition}
                        className="flex w-full items-center gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-300 disabled:opacity-50">
                        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                        {t("settings.import_guest_btn")}
                      </motion.button>
                    )}
                  </div>
                </Section>
              )}

              {!isGuest && (
                <Section title={t("nav.sign_out")} icon={LogOut} color="text-rose-300" bg="bg-rose-400/10">
                  <div className="p-4">
                    <motion.button type="button" onClick={handleSignOut} disabled={signingOut}
                      whileTap={{ scale: 0.97 }} transition={tapTransition}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 py-2.5 text-sm font-bold text-rose-300 disabled:opacity-50">
                      {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                      {t("nav.sign_out")}
                    </motion.button>
                  </div>
                </Section>
              )}
            </>
          )}

          {/* ──────── PREFERENCES ──────── */}
          {tab === "prefs" && (
            <>
              <Section title={t("settings.language")} icon={Globe} color="text-cyan-300" bg="bg-cyan-400/10">
                <div className="p-3 grid gap-2">
                  {LOCALES.map((item) => (
                    <motion.button key={item.code} type="button"
                      onClick={() => void setLocale(item.code as Locale)}
                      whileTap={{ scale: 0.98 }} transition={tapTransition}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-start transition-all ${
                        locale === item.code
                          ? "border-cyan-400/40 bg-cyan-400/10"
                          : "border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] hover:border-[hsl(var(--border))]"
                      }`}>
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${
                        locale === item.code ? "bg-cyan-400/20 text-cyan-300" : "bg-[hsl(var(--bg-input))] t2"
                      }`}>{item.badge}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold ${locale === item.code ? "text-cyan-300" : "t1"}`}>{item.nativeLabel}</p>
                        <p className="text-xs t3">{item.label}</p>
                      </div>
                      {locale === item.code && <Check className="h-4 w-4 text-cyan-300 shrink-0" />}
                    </motion.button>
                  ))}
                </div>
              </Section>

              <Section title={t("settings.currency")} icon={WalletCards} color="text-emerald-300" bg="bg-emerald-400/10">
                <div className="p-3 grid grid-cols-2 gap-2">
                  {CURRENCIES.map((item) => (
                    <motion.button key={item.code} type="button" onClick={() => setCurrency(item.code as Currency)}
                      whileTap={{ scale: 0.97 }} transition={tapTransition}
                      className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-start transition-all ${
                        currency === item.code
                          ? "border-emerald-400/40 bg-emerald-400/10"
                          : "border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] hover:border-[hsl(var(--border))]"
                      }`}>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black ${
                        currency === item.code ? "bg-emerald-400/20 text-emerald-300" : "bg-[hsl(var(--bg-input))] t2"
                      }`}>{item.symbol}</span>
                      <div className="min-w-0">
                        <p className={`text-xs font-black ${currency === item.code ? "text-emerald-300" : "t1"}`}>{item.code}</p>
                        <p className="text-[10px] t3 truncate">{t(item.labelKey)}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </Section>

              <Section title={t("settings.appearance")} icon={Palette} color="text-violet-300" bg="bg-violet-400/10">
                <div className="p-3 grid grid-cols-2 gap-2">
                  {([
                    { id: "dark",  label: t("settings.dark_mode"),  icon: Moon, color: "text-slate-300",  bg: "bg-slate-400/10" },
                    { id: "light", label: t("settings.light_mode"), icon: Sun,  color: "text-amber-300",  bg: "bg-amber-400/10" },
                  ] as const).map(({ id, label, icon: Icon, color, bg }) => (
                    <motion.button key={id} type="button" onClick={() => setTheme(id)}
                      whileTap={{ scale: 0.97 }} transition={tapTransition}
                      className={`flex flex-col items-center gap-2 rounded-2xl border py-4 transition-all ${
                        theme === id ? "border-violet-400/40 bg-violet-400/10" : "border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))]"
                      }`}>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${bg}`}>
                        <Icon className={`h-5 w-5 ${color}`} />
                      </div>
                      <p className={`text-xs font-bold ${theme === id ? "text-violet-300" : "t2"}`}>{label}</p>
                      {theme === id && <Check className="h-3.5 w-3.5 text-violet-300" />}
                    </motion.button>
                  ))}
                </div>
              </Section>

              <Section title={t("settings.notifications")} icon={Bell} color="text-amber-300" bg="bg-amber-400/10">
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
              </Section>

              <Section title={t("settings.ai")} icon={Sparkles} color="text-purple-300" bg="bg-purple-400/10">
                <SettingRow label={t("settings.enable_ai")} hint={t("settings.enable_ai_hint")}>
                  <Toggle checked={ai.enabled} onChange={(v) => setAI(p => ({ ...p, enabled: v }))} />
                </SettingRow>
                <SettingRow label={t("settings.auto_refresh")} hint={t("settings.auto_refresh_hint")}>
                  <Toggle checked={ai.auto} onChange={(v) => setAI(p => ({ ...p, auto: v }))} />
                </SettingRow>
                <div className="p-3 grid grid-cols-2 gap-2">
                  {([
                    { id: "claude-haiku",  label: "Claude Haiku",  sub: t("settings.model_fast")     },
                    { id: "claude-sonnet", label: "Claude Sonnet", sub: t("settings.model_balanced") },
                  ] as const).map(({ id, label, sub }) => (
                    <motion.button key={id} type="button" onClick={() => setAI(p => ({ ...p, model: id }))}
                      whileTap={{ scale: 0.97 }} transition={tapTransition}
                      className={`rounded-2xl border px-3 py-2.5 text-start transition-all ${
                        ai.model === id ? "border-purple-400/40 bg-purple-400/10" : "border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))]"
                      }`}>
                      <p className={`text-xs font-black ${ai.model === id ? "text-purple-300" : "t1"}`}>{label}</p>
                      <p className="text-[10px] t3 mt-0.5">{sub}</p>
                    </motion.button>
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* ──────── PRIVACY / SECURITY ──────── */}
          {tab === "privacy" && (
            <>
              <Section title={t("rooms.pin_title")} icon={KeyRound} color="text-cyan-300" bg="bg-cyan-400/10">
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] px-3 py-2.5">
                    {hasPin
                      ? <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
                      : <Unlock className="h-4 w-4 text-amber-400 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold t1">{hasPin ? t("rooms.pin_active") : t("rooms.pin_inactive")}</p>
                      <p className="text-[10px] t3">{hasPin ? t("rooms.change_pin_hint") : t("rooms.pin_required_hint")}</p>
                    </div>
                    {hasPin && (
                      <button type="button" onClick={clearPin}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 shrink-0">
                        {t("rooms.disable_all")}
                      </button>
                    )}
                  </div>
                  <form onSubmit={handlePinSubmit} className="flex gap-2">
                    <input value={roomPin} onChange={(e) => { setRoomPin(e.target.value); if (pinError) setPinError(""); }}
                      type="password" inputMode="numeric" autoComplete="new-password"
                      className="field flex-1 text-sm font-mono tracking-widest"
                      placeholder={t("rooms.new_pin_placeholder")} />
                    <button type="submit"
                      className="min-h-10 rounded-2xl bg-cyan-400 px-4 text-xs font-bold text-[#071018]">
                      {pinSaved ? <Check className="h-4 w-4" /> : t("rooms.save_pin")}
                    </button>
                  </form>
                  {pinError && <p className="text-xs text-rose-300">{pinError}</p>}
                </div>
              </Section>

              <Section title={t("settings.security")} icon={Shield} color="text-slate-300" bg="bg-slate-400/10">
                {ROOM_DEFINITIONS.map((room) => (
                  <SettingRow key={room.id} label={t(room.labelKey)} hint={t(room.descriptionKey)}>
                    <Toggle checked={roomConfig.rooms[room.id]} onChange={(v) => setRoomLocked(room.id, v)} disabled={!hasPin} />
                  </SettingRow>
                ))}
                <div className="p-3 pt-1">
                  <button type="button" onClick={lockAllRooms} disabled={!hasPin || lockedCount === ROOM_DEFINITIONS.length}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 py-2.5 text-xs font-bold text-amber-300 disabled:opacity-40 transition-all">
                    <LockKeyhole className="h-3.5 w-3.5" />{t("rooms.lock_now")}
                  </button>
                </div>
              </Section>

              <Link href="/privacy"
                className="card flex items-center gap-3 p-4 hover:border-cyan-400/20 transition-all">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-400/10 shrink-0">
                  <Shield className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold t1">{t("privacy.title")}</p>
                  <p className="text-xs t3 mt-0.5">{t("privacy.subtitle")}</p>
                </div>
                <ChevronRight className="h-4 w-4 t3 shrink-0" />
              </Link>
            </>
          )}

          {/* ──────── DATA ──────── */}
          {tab === "data" && (
            <>
              {!isGuest && (
                <Section title={t("settings.export_title")} icon={Download} color="text-emerald-300" bg="bg-emerald-400/10">
                  <div className="p-3 space-y-2">
                    {(["transactions", "goals", "debts"] as const).map((type) => (
                      <motion.button key={type} type="button" onClick={() => handleExport(type)} disabled={exporting}
                        whileTap={{ scale: 0.97 }} transition={tapTransition}
                        className="flex w-full items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-3 text-sm font-semibold text-emerald-300 disabled:opacity-50 transition-all hover:bg-emerald-400/12">
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {t(`settings.export_${type}`)}
                        <span className="ms-auto text-[10px] t3">CSV</span>
                      </motion.button>
                    ))}
                    <a href="/api/export?type=backup" download
                      className="flex w-full items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/8 px-4 py-3 text-sm font-semibold text-cyan-300 transition-all hover:bg-cyan-400/12">
                      <Database className="h-4 w-4" />
                      {t("export.json_backup")}
                      <span className="ms-auto text-[10px] t3">JSON</span>
                    </a>
                  </div>
                </Section>
              )}

              {!isGuest && (
                <Section title={t("settings.danger_zone")} icon={Trash2} color="text-rose-300" bg="bg-rose-400/10">
                  <div className="p-4 space-y-3">
                    {deleteStep === "idle" && (
                      <motion.button type="button" onClick={() => setDeleteStep("export")}
                        whileTap={{ scale: 0.98 }} transition={tapTransition}
                        className="flex w-full items-center gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-300 transition-all">
                        <Trash2 className="h-4 w-4" />
                        <span className="flex-1 text-start">{t("settings.delete_account")}</span>
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      </motion.button>
                    )}
                    {deleteStep === "export" && (
                      <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/8 p-4">
                        <p className="text-sm font-bold text-amber-300">{t("settings.delete_export_first")}</p>
                        <p className="text-xs text-amber-300/70">{t("settings.delete_export_hint")}</p>
                        <div className="flex gap-2">
                          <a href="/api/export?type=backup" download
                            onClick={() => setTimeout(() => setDeleteStep("confirm"), 1500)}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-bold text-white">
                            <Download className="h-3.5 w-3.5" />{t("settings.delete_export_btn")}
                          </a>
                          <button type="button" onClick={() => setDeleteStep("confirm")}
                            className="rounded-xl border border-rose-400/30 px-3 text-xs font-semibold text-rose-300">
                            {t("settings.delete_skip_export")}
                          </button>
                          <button type="button" onClick={() => setDeleteStep("idle")}
                            className="rounded-xl border border-[hsl(var(--border))] px-3 text-xs font-semibold t2">
                            {t("common.cancel")}
                          </button>
                        </div>
                      </div>
                    )}
                    {deleteStep === "confirm" && (
                      <div className="space-y-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4">
                        <p className="text-sm font-bold text-rose-300">{t("settings.delete_confirm_text")}</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={handleDeleteAccount} disabled={deleting}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            {t("settings.delete_confirm_btn")}
                          </button>
                          <button type="button" onClick={() => setDeleteStep("idle")}
                            className="rounded-xl border border-[hsl(var(--border))] px-4 text-xs font-semibold t2">
                            {t("common.cancel")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              )}
            </>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
