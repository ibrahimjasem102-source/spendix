"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAuthToken, getAuthToken, storeRefreshToken, getRefreshToken, clearTokens } from "@/lib/auth/token-store";

interface GuestContextType {
  isGuest:   boolean;
  isLoading: boolean; // true until auth state is determined
}

const GuestContext = createContext<GuestContextType>({ isGuest: true, isLoading: true });

export function GuestProvider({ children }: { children: React.ReactNode }) {
  // Both start as true to avoid hydration mismatch
  // useLayoutEffect will immediately correct isGuest before first paint
  const [isGuest,   setIsGuest]   = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // ── Requirement 2 & 3: synchronous init BEFORE first paint ───
  useLayoutEffect(() => {
    const token = getAuthToken(); // reads spendix_access_token from localStorage
    if (token) {
      setIsGuest(false);
      console.log("[auth] layout init — isGuest=false (token found)");
    } else {
      console.log("[auth] layout init — isGuest=true (no token)");
    }
    setIsLoading(false);
    console.log("[auth] initialized");
  }, []);

  // ── Background: Supabase session validation + listener ───────
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Validate / refresh session in background
    void (async () => {
      const localToken = getAuthToken();
      if (!localToken) return; // already guest — nothing to validate

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;

        if (session?.access_token) {
          // Fresh session from Supabase — update our token
          setAuthToken(session.access_token);
          if (session.refresh_token) storeRefreshToken(session.refresh_token);
          setIsGuest(false);
          console.log("[auth] session validated from Supabase");
          return;
        }

        // No Supabase session — try refresh
        const storedRefresh = getRefreshToken();
        if (storedRefresh) {
          const { data } = await supabase.auth.refreshSession({ refresh_token: storedRefresh });
          if (!active) return;
          if (data.session?.access_token) {
            setAuthToken(data.session.access_token);
            if (data.session.refresh_token) storeRefreshToken(data.session.refresh_token);
            setIsGuest(false);
            console.log("[auth] session refreshed successfully");
            return;
          }
        }

        // Cannot refresh — but keep isGuest=false if we still have local token
        // API calls will fail with 401 only if the token is truly expired
        const stillHave = getAuthToken();
        console.log("[auth] no Supabase session, local token still:", !!stillHave);
        // Do NOT call setIsGuest(true) — let API retry handle expiry

      } catch (e) {
        console.log("[auth] validation error (network?):", e);
        // Network error → keep current state
      }
    })();

    // ── Requirement 5: onAuthStateChange ────────────────────────
    // ONLY set isGuest=true on SIGNED_OUT event AND no local token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      console.log("[auth] onAuthStateChange event:", event, "session:", !!session);

      if (session?.access_token) {
        // ── Requirement 8: force isGuest=false immediately ──────
        setAuthToken(session.access_token);
        if (session.refresh_token) storeRefreshToken(session.refresh_token);
        setIsGuest(false);
        setIsLoading(false);
        console.log("[auth] signed in via onAuthStateChange — isGuest=false");
        return;
      }

      // session is null
      if (event === "SIGNED_OUT") {
        // Only honour SIGNED_OUT if we have no local token
        // (explicit logout already calls clearTokens before signOut)
        const local = getAuthToken();
        if (!local) {
          setIsGuest(true);
          console.log("[auth] SIGNED_OUT + no local token → isGuest=true");
        } else {
          console.log("[auth] SIGNED_OUT but local token exists → keeping isGuest=false");
        }
        return;
      }

      // Other null-session events (INITIAL_SESSION, TOKEN_REFRESHED failures):
      // ── Requirement 1: isGuest must never stay true if token exists ──
      const local = getAuthToken();
      if (local) {
        setIsGuest(false);
        console.log("[auth]", event, "— local token exists → isGuest=false");
      }
      // If no local token → leave isGuest=true (already the default)
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <GuestContext.Provider value={{ isGuest, isLoading }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  return useContext(GuestContext);
}
