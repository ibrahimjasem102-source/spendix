"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signedIn, signedOut, initSession } from "@/lib/auth/session-manager";
import { getAuthToken } from "@/lib/auth/token-store";

interface GuestContextType {
  isGuest:   boolean;
  isLoading: boolean;
}

const GuestContext = createContext<GuestContextType>({ isGuest: true, isLoading: false });

export function GuestProvider({ children }: { children: React.ReactNode }) {
  // Start as guest=true on BOTH server and client to avoid hydration mismatch.
  // useLayoutEffect runs client-side before first paint → sets correct state instantly.
  const [isGuest,   setIsGuest]   = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const validated = useRef(false);

  // ── Synchronous client-side init (before first paint) ────────
  useLayoutEffect(() => {
    const hasToken = initSession(); // reads spendix_access_token from localStorage
    if (hasToken) setIsGuest(false);
  }, []);

  // ── Background validation + auth state listener ───────────────
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function validateInBackground() {
      const localToken = getAuthToken();
      if (!localToken) {
        // No token at all → guest confirmed
        setIsGuest(true);
        validated.current = true;
        return;
      }

      try {
        // Try to get Supabase session (reads from its own localStorage key)
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;

        if (session?.access_token) {
          signedIn(session.access_token);
          setIsGuest(false);
          validated.current = true;
          return;
        }

        // No Supabase session — try refresh
        const storedRefresh = localStorage.getItem("spendix_refresh_token");
        const { data: refreshData } = storedRefresh
          ? await supabase.auth.refreshSession({ refresh_token: storedRefresh })
          : await supabase.auth.refreshSession();

        if (!active) return;

        if (refreshData.session?.access_token) {
          signedIn(refreshData.session.access_token);
          if (refreshData.session.refresh_token) {
            localStorage.setItem("spendix_refresh_token", refreshData.session.refresh_token);
          }
          setIsGuest(false);
        } else {
          // Refresh failed — keep using our Bearer token if still valid
          const stillValid = getAuthToken();
          if (!stillValid) {
            signedOut();
            setIsGuest(true);
          }
          // If stillValid → keep isGuest=false, API will validate the Bearer token
        }
        validated.current = true;
      } catch {
        // Network error — trust existing state
        if (!active) return;
        validated.current = true;
      }
    }

    void validateInBackground();

    // Auth event listener (cross-tab, token refresh, explicit logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (session?.access_token) {
        signedIn(session.access_token);
        setIsGuest(false);
        return;
      }

      // SIGNED_OUT: only honour if we also have no local token
      if (event === "SIGNED_OUT") {
        const local = getAuthToken();
        if (!local) {
          signedOut();
          setIsGuest(true);
        }
        // If we still have a local token, let the Bearer token carry auth
      }
    });

    // Safety: resolve after 4s if background validation hangs
    const fallback = setTimeout(() => {
      if (!active || validated.current) return;
      const local = getAuthToken();
      setIsGuest(!local);
    }, 4000);

    return () => {
      active = false;
      subscription.unsubscribe();
      clearTimeout(fallback);
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
