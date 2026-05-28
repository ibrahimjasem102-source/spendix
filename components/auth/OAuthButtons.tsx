"use client";

import { useState } from "react";
import { Chrome, Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";
import { getOAuthRedirectTo } from "@/lib/auth/redirect";
import { useTranslation } from "@/lib/i18n";

type OAuthProvider = "google";

export default function OAuthButtons() {
  const { t } = useTranslation();
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");

  async function signIn(provider: OAuthProvider) {
    setError("");
    setLoadingProvider(provider);

    try {
      const supabase = createClient();
      const isNative = Capacitor.isNativePlatform();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: isNative ? "com.spendix.app://auth/callback" : getOAuthRedirectTo(),
          skipBrowserRedirect: isNative,
          queryParams: provider === "google"
            ? { prompt: "select_account" }
            : undefined,
        },
      });

      if (error) {
        setError(error.message);
        setLoadingProvider(null);
        return;
      }

      if (isNative) {
        if (!data.url) {
          setError(t("auth.login_failed"));
          setLoadingProvider(null);
          return;
        }

        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: data.url, windowName: "_self" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.login_failed"));
      setLoadingProvider(null);
    }
  }

  const buttons = [
    { provider: "google" as const, label: t("auth.continue_google"), icon: Chrome },
  ];

  return (
    <div className="space-y-3">
      <div className="relative py-1">
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
        <div className="relative mx-auto w-fit bg-[hsl(215_26%_10%)] px-3 text-[10px] font-semibold uppercase tracking-wide text-[hsl(215_18%_55%)]">
          {t("auth.or_continue_with")}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {buttons.map(({ provider, label, icon: Icon }) => {
          const loading = loadingProvider === provider;
          return (
            <button
              key={provider}
              type="button"
              onClick={() => void signIn(provider)}
              disabled={loadingProvider !== null}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white transition-all hover:bg-white/[0.06] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}
