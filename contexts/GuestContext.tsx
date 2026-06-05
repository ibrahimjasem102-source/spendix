"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signedIn, signedOut, initSession } from "@/lib/auth/session-manager";
import { getAuthToken, isTokenExpired } from "@/lib/auth/token-store";

interface GuestContextType {
  isGuest:   boolean;
  isLoading: boolean;
}

const GuestContext = createContext<GuestContextType>({ isGuest: true, isLoading: true });

export function GuestProvider({ children }: { children: React.ReactNode }) {
  // Synchronous: trust local token immediately if it's valid and not expired
  const hasValidToken = initSession(); // reads spendix_access_token, skips expired ones

  // If we have a valid token → show as authenticated instantly (no flicker)
  // If no token → show as guest, isLoading=false immediately
  const [isGuest,   setIsGuest]   = useState(!hasValidToken);
  const [isLoading, setIsLoading] = useState(false); // never block UI on auth check
  const validated = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Background validation: silently refresh/validate without blocking UI
    async function validateInBackground() {
      const localToken = getAuthToken();

      if (!localToken) {
        // No token → already showing guest state correctly
        validated.current = true;
        return;
      }

      try {
        // Try to get a fresh session from Supabase
        const { data: { session } } = await supabase.auth.getSession();

        if (!active) return;

        if (session?.access_token && !isTokenExpired(session.access_token)) {
          // Got a fresh valid session — update our token
          signedIn(session.access_token);
          setIsGuest(false);
          validated.current = true;
          return;
        }

        // Session missing or expired — try to refresh
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
          // Can't refresh — check if our local token is still usable
          const stillHaveToken = getAuthToken();
          if (!stillHaveToken) {
            // Token is gone → user needs to log in
            signedOut();
            setIsGuest(true);
          }
          // If we still have a non-expired local token, keep isGuest=false
          // The API will reject it and crud-factory handles the redirect
        }

        validated.current = true;
      } catch {
        // Network error — trust existing state
        if (!active) return;
        validated.current = true;
      }
    }

    void validateInBackground();

    // React to auth events (cross-tab login/logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (session?.access_token && !isTokenExpired(session.access_token)) {
        signedIn(session.access_token);
        setIsGuest(false);
        return;
      }

      // SIGNED_OUT event: only clear if we have no local token
      if (event === "SIGNED_OUT") {
        const local = getAuthToken();
        if (!local) {
          signedOut();
          setIsGuest(true);
        }
      }
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
