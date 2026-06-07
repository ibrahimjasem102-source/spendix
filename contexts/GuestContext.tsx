"use client";

import { createContext, useContext, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAuthToken, getAuthToken, storeRefreshToken, getRefreshToken } from "@/lib/auth/token-store";

interface GuestContextType {
  isGuest:   boolean;
  isLoading: boolean;
}

// Middleware enforces auth on all (app) routes.
// isGuest is always false — users can only reach these pages authenticated.
const GuestContext = createContext<GuestContextType>({ isGuest: false, isLoading: false });

async function syncSessionCookie(accessToken: string, refreshToken: string | null | undefined) {
  if (!refreshToken) return;
  await fetch("/api/auth/set-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
  }).catch(() => undefined);
}

export function GuestProvider({ children }: { children: React.ReactNode }) {
  // Background: keep session tokens refreshed and server cookie in sync
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void (async () => {
      const localToken = getAuthToken();
      if (!localToken) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;

        if (session?.access_token) {
          setAuthToken(session.access_token);
          if (session.refresh_token) storeRefreshToken(session.refresh_token);
          void syncSessionCookie(session.access_token, session.refresh_token);
          return;
        }

        const storedRefresh = getRefreshToken();
        if (storedRefresh) {
          const { data } = await supabase.auth.refreshSession({ refresh_token: storedRefresh });
          if (!active) return;
          if (data.session?.access_token) {
            setAuthToken(data.session.access_token);
            if (data.session.refresh_token) storeRefreshToken(data.session.refresh_token);
            void syncSessionCookie(data.session.access_token, data.session.refresh_token);
          }
        }
      } catch {
        // Network error — SessionRestorer retries on focus
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session?.access_token) {
        setAuthToken(session.access_token);
        if (session.refresh_token) storeRefreshToken(session.refresh_token);
        void syncSessionCookie(session.access_token, session.refresh_token);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <GuestContext.Provider value={{ isGuest: false, isLoading: false }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  return useContext(GuestContext);
}
