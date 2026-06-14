"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, ChevronDown, ChevronRight, Globe,
  LogOut, Moon, Settings, Sun, User, Wallet,
} from "lucide-react";
import GlobalSearch from "@/components/search/GlobalSearch";
import NotificationBell from "@/components/notifications/NotificationBell";
import { createClient } from "@/lib/supabase/client";
import { getNavItem, ROUTES } from "@/lib/routes";
import { LOCALES, type Locale, useTranslation } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { NAV_ICON_MAP, NAV_HEX_MAP } from "@/lib/nav-colors";

export default function TopBar() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useTranslation();
  const { theme, toggleTheme }   = useTheme();

  const [showUser, setShowUser]           = useState(false);
  const [showLang, setShowLang]           = useState(false);
  const [userEmail, setUserEmail]         = useState<string | null>(null);
  const [userDisplayName, setDisplayName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
      const metaName = (
        user?.user_metadata?.full_name || user?.user_metadata?.name
      ) as string | undefined;
      if (metaName) { setDisplayName(metaName); return; }
      if (user) {
        supabase
          .from("profile_settings")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle()
          .then(({ data }) => { if (data?.full_name) setDisplayName(data.full_name); });
      }
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showUser) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUser(false);
        setShowLang(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showUser]);

  const page          = useMemo(() => getNavItem(pathname), [pathname]);
  const currentLocale = LOCALES.find((l) => l.code === locale);
  const userInitial   = (userDisplayName?.[0] ?? userEmail?.[0] ?? "S").toUpperCase();
  const pageHex       = NAV_HEX_MAP[page?.href ?? ""] ?? "#22d3ee";
  const PageIcon      = NAV_ICON_MAP[page?.href ?? ""];
  const isDashboard   = pathname === "/dashboard" || !page;

  function closeMenus() { setShowUser(false); setShowLang(false); }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    const { signedOut } = await import("@/lib/auth/session-manager");
    signedOut();
    window.location.replace("/login");
  }

  const menuItemCls = [
    "group flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2",
    "text-sm font-medium t2 transition-all hover:bg-[hsl(var(--bg-input))] hover:t1 text-start",
  ].join(" ");

  const sectionLabelCls = "px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest t3";

  return (
    // ── Safe-area-top wrapper ──────────────────────────────────
    // On PWA / standalone mode on a notched device (iPhone Dynamic Island = 59px,
    // iPhone X/11/12 = 44px), env(safe-area-inset-top) pushes the bar below the
    // hardware cutout. In normal browser mode it evaluates to 0px.
    <div
      className="shrink-0 bg-[hsl(var(--bg-page))]"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <header className="relative z-30 px-3 sm:px-4 lg:px-6 pt-3 pb-2">
        <div className="modern-surface flex h-14 items-center gap-2 rounded-xl px-2.5 sm:px-3">

          {/* ── Mobile: logo / page icon ─────────────────────── */}
          <div className="flex sm:hidden items-center gap-2 shrink-0 min-w-0">
            {isDashboard ? (
              <Link
                href="/dashboard"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500 shrink-0"
                aria-label="Dashboard"
              >
                <Wallet className="h-4 w-4 text-white" />
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-all"
                style={{
                  backgroundColor: `${pageHex}18`,
                  border: `1px solid ${pageHex}30`,
                }}
                aria-label="Back to dashboard"
              >
                {PageIcon
                  ? <PageIcon className="h-4 w-4" style={{ color: pageHex }} />
                  : <Wallet className="h-4 w-4 text-white" />
                }
              </Link>
            )}
            {!isDashboard && page && (
              <div className="min-w-0 overflow-hidden">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] t3 leading-tight">
                  Spendix
                </p>
                <p className="text-[13px] font-bold t1 truncate max-w-[110px] leading-tight">
                  {t(page.title)}
                </p>
              </div>
            )}
          </div>

          {/* ── sm–lg: logo only ─────────────────────────────── */}
          <Link href="/dashboard" className="hidden sm:flex lg:hidden items-center gap-2 px-1 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500">
              <Wallet className="h-4 w-4 text-white" />
            </div>
          </Link>

          {/* ── xl: logo + page name ─────────────────────────── */}
          <div className="hidden xl:flex min-w-[180px] flex-col px-2 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] t3">Spendix</span>
            <span className="truncate text-sm font-bold t1">
              {page ? t(page.title) : t("dashboard.title")}
            </span>
          </div>

          {/* ── Global search ────────────────────────────────── */}
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>

          {/* ── Right controls ───────────────────────────────── */}
          <div className="ms-auto flex shrink-0 items-center gap-1.5">
            {/* Theme toggle — hidden on mobile (available in user menu) */}
            <button
              onClick={toggleTheme}
              className="icon-button hidden sm:flex"
              aria-label={theme === "dark" ? t("topbar.switch_light") : t("topbar.switch_dark")}
            >
              {theme === "dark"
                ? <Sun  className="h-4 w-4" />
                : <Moon className="h-4 w-4" />}
            </button>

            <NotificationBell />

            {/* User dropdown ───────────────────────────────── */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setShowUser((v) => !v); setShowLang(false); }}
                className={[
                  "flex min-h-[38px] items-center gap-2 rounded-xl border p-1.5 ps-2 transition-all",
                  showUser
                    ? "border-cyan-500/40 bg-cyan-500/10"
                    : "border-[hsl(var(--border))] bg-[hsl(var(--bg-input))] hover:border-[rgba(255,255,255,0.16)]",
                ].join(" ")}
                aria-haspopup="menu"
                aria-expanded={showUser}
                aria-label="User menu"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500 text-xs font-bold text-white select-none">
                  {userInitial}
                </div>
                <ChevronDown
                  className={[
                    "hidden h-3.5 w-3.5 t3 sm:block transition-transform duration-200",
                    showUser ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>

              {/* ── Dropdown menu ───────────────────────────── */}
              {showUser && (
                <div
                  role="menu"
                  className={[
                    "absolute end-0 top-full mt-1.5 z-50 overflow-hidden rounded-xl",
                    "w-[min(17rem,calc(100vw-1.5rem))]",
                  ].join(" ")}
                  style={{
                    background:  "hsl(var(--bg-card))",
                    border:      "1px solid rgba(255,255,255,0.09)",
                    boxShadow:   "0 16px 48px rgba(0,0,0,0.45)",
                  }}
                >
                  {/* User header */}
                  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[hsl(var(--border))]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-sm font-bold text-white">
                      {userInitial}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] t3">{t("topbar.signed_in")}</p>
                      <p className="truncate text-sm font-semibold t1">
                        {userDisplayName ?? userEmail ?? "—"}
                      </p>
                    </div>
                  </div>

                  {/* Quick links */}
                  <div className="px-2 pt-2 pb-2 border-b border-[hsl(var(--border))]">
                    <p className={sectionLabelCls}>{t("topbar.quick_links")}</p>
                    <Link href={ROUTES.profile} onClick={closeMenus} className={menuItemCls} role="menuitem">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-400/10">
                        <User className="h-4 w-4 text-violet-300" />
                      </span>
                      <span className="flex-1">{t("nav.profile")}</span>
                      <ChevronRight className="h-3.5 w-3.5 t3" />
                    </Link>
                    <Link href={ROUTES.settings} onClick={closeMenus} className={menuItemCls} role="menuitem">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-400/10">
                        <Settings className="h-4 w-4 text-slate-300" />
                      </span>
                      <span className="flex-1">{t("nav.settings")}</span>
                      <ChevronRight className="h-3.5 w-3.5 t3" />
                    </Link>
                    <Link href={ROUTES.notifications} onClick={closeMenus} className={menuItemCls} role="menuitem">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/10">
                        <Bell className="h-4 w-4 text-cyan-300" />
                      </span>
                      <span className="flex-1">{t("topbar.notifications")}</span>
                      <ChevronRight className="h-3.5 w-3.5 t3" />
                    </Link>
                  </div>

                  {/* Appearance */}
                  <div className="px-2 pt-2 pb-2 border-b border-[hsl(var(--border))]">
                    <p className={sectionLabelCls}>{t("topbar.appearance")}</p>
                    <button onClick={toggleTheme} className={menuItemCls} role="menuitem">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/10">
                        {theme === "dark"
                          ? <Sun  className="h-4 w-4 text-amber-400" />
                          : <Moon className="h-4 w-4 text-violet-400" />}
                      </span>
                      <span className="flex-1">
                        {theme === "dark" ? t("topbar.switch_light") : t("topbar.switch_dark")}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[hsl(var(--bg-input))] t3">
                        {theme === "dark" ? t("topbar.dark") : t("topbar.light")}
                      </span>
                    </button>

                    {/* Language selector */}
                    <button
                      onClick={() => setShowLang((v) => !v)}
                      className={menuItemCls}
                      role="menuitem"
                      aria-expanded={showLang}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/10">
                        <Globe className="h-4 w-4 text-cyan-400" />
                      </span>
                      <span className="flex-1">{t("topbar.language")}</span>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[hsl(var(--bg-input))] t3 me-1">
                        {currentLocale?.badge}
                      </span>
                      <ChevronRight
                        className={[
                          "h-3.5 w-3.5 t3 transition-transform duration-200",
                          showLang ? "rotate-90" : "",
                        ].join(" ")}
                      />
                    </button>

                    {showLang && (
                      <div className="ms-11 mb-1 space-y-0.5 rounded-xl bg-black/10 p-1">
                        {LOCALES.map((item) => (
                          <button
                            key={item.code}
                            onClick={() => { void setLocale(item.code as Locale); setShowLang(false); }}
                            className={[
                              "flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm transition-colors",
                              locale === item.code
                                ? "bg-cyan-400/10 text-cyan-300"
                                : "t3 hover:bg-[hsl(var(--bg-input))] hover:t1",
                            ].join(" ")}
                            role="menuitem"
                          >
                            <span className="w-6 text-xs font-bold">{item.badge}</span>
                            <span>{item.nativeLabel}</span>
                            {locale === item.code && (
                              <span className="ms-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sign out */}
                  <div className="px-2 py-2">
                    <button onClick={handleSignOut} className={`${menuItemCls} text-rose-400`} role="menuitem">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-400/10">
                        <LogOut className="h-4 w-4" />
                      </span>
                      <span className="flex-1">{t("nav.sign_out")}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
