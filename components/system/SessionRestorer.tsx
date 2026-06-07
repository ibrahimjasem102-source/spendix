"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { signedIn } from "@/lib/auth/session-manager";
import { getRefreshToken, storeRefreshToken } from "@/lib/auth/token-store";

// Silently refreshes the Supabase session cookie without interrupting the user.
// Handles two scenarios:
//   1. App load after Capacitor WebView cleared cookies (but localStorage still has refresh token)
//   2. App resume after being backgrounded for >1 hour (access token expired)
// Called on mount and every time the browser tab/app becomes visible again.
async function restoreIfNeeded(): Promise<void> {
  const supabase = createClient();

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    signedIn(session.access_token, session.refresh_token ?? undefined);
    return;
  }

  const storedRefresh = getRefreshToken();
  if (!storedRefresh) return;

  const { data } = await supabase.auth.refreshSession({ refresh_token: storedRefresh });
  if (!data.session?.access_token) return;

  const { access_token, refresh_token } = data.session;
  signedIn(access_token, refresh_token ?? undefined);
  if (refresh_token) storeRefreshToken(refresh_token);

  await fetch("/api/auth/set-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token, refresh_token }),
  }).catch(() => undefined);
}

export default function SessionRestorer() {
  useEffect(() => {
    // Check on first load
    restoreIfNeeded().catch(() => undefined);

    // Check every time the app comes to the foreground (Capacitor resume, browser tab focus)
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        restoreIfNeeded().catch(() => undefined);
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
