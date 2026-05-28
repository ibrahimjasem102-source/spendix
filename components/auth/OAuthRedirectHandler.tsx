"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setAuthToken } from "@/lib/auth/token-store";
import { migrateGuestData } from "@/lib/guest/migrate";

function isAuthCallbackUrl(url: string) {
  return url.includes("/auth/callback") || url.startsWith("com.spendix.app://auth/callback");
}

function getCode(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("code");
  } catch {
    return null;
  }
}

export default function OAuthRedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    let removeListener: (() => void) | undefined;

    async function handleUrl(url: string) {
      if (!isAuthCallbackUrl(url)) return;

      const code = getCode(url);
      if (!code) {
        await import("@capacitor/browser").then(({ Browser }) => Browser.close()).catch(() => undefined);
        router.replace("/login?error=oauth_callback");
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (data.session) {
        setAuthToken(data.session.access_token);
      }
      if (error) {
        await import("@capacitor/browser").then(({ Browser }) => Browser.close()).catch(() => undefined);
        router.replace("/login?error=oauth_callback");
        return;
      }

      // Sync session to server cookies so API routes can authenticate
      if (data.session) {
        await fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          }),
        }).catch(() => undefined);
      }

      await import("@capacitor/browser").then(({ Browser }) => Browser.close()).catch(() => undefined);
      await fetch("/api/auth/bootstrap", { method: "POST" }).catch(() => undefined);
      await migrateGuestData().catch(() => undefined);
      router.replace("/dashboard");
      router.refresh();
    }

    void import("@capacitor/app")
      .then(async ({ App }) => {
        const listener = await App.addListener("appUrlOpen", (event) => {
          void handleUrl(event.url);
        });
        removeListener = () => {
          void listener.remove();
        };
      })
      .catch(() => undefined);

    return () => {
      removeListener?.();
    };
  }, [router]);

  return null;
}
