"use client";

import { useEffect } from "react";
import { refreshOnResume } from "@/lib/auth/session-manager";

// Re-checks the session every time the app comes to the foreground.
// Covers two scenarios:
//   1. Tab regains focus after >1 hour backgrounded — access token may have expired.
//   2. Capacitor app resumed — WebView may have cleared cookies while suspended.
// The initial session restore (on page load) is handled by SessionManager.init(),
// which GuestProvider calls on mount.
export default function SessionRestorer() {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refreshOnResume().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
