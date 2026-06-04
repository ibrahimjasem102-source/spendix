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
  const hasSession   = initSession(); // reads spendix_access_token (non-expired)
  const [isGuest,   setIsGuest]   = useState(!hasSession);
  const [isLoading, setIsLoading] = useState(true); // always start loading to validate
  const resolved = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function bootstrap() {
      const localToken = getAuthToken(); // null if expired or missing

      // Case 1: no local token → guest
      if (!localToken) {
        if (!active) return;
        setIsGuest(true);
        setIsLoading(false);
        resolved.current = true;
        return;
      }

      // Case 2: local token exists → try Supabase session
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!active) return;

        if (session?.access_token && !isTokenExpired(session.access_token)) {
          // Fresh session from Supabase
          signedIn(session.access_token);
          setIsGuest(false);
          setIsLoading(false);
          resolved.current = true;
          return;
        }

        // Session missing or expired → try refresh
        const { data: refreshData } = await supabase.auth.refreshSession();

        if (!active) return;

        if (refreshData.session?.access_token) {
          // Successfully refreshed
          signedIn(refreshData.session.access_token);
          setIsGuest(false);
          setIsLoading(false);
          resolved.current = true;
          return;
        }

        // Refresh failed — local token might still be valid for Bearer auth
        // Use it as long as it's not expired
        const stillValid = getAuthToken(); // re-check after refresh attempt
        if (stillValid) {
          setIsGuest(false);
          setIsLoading(false);
        } else {
          // Truly expired and can't refresh → force re-login
          signedOut();
          setIsGuest(true);
          setIsLoading(false);
        }
        resolved.current = true;

      } catch {
        // Network error — trust local token if it exists
        if (!active) return;
        const fallback = getAuthToken();
        setIsGuest(!fallback);
        setIsLoading(false);
        resolved.current = true;
      }
    }

    void bootstrap();

    // Also listen for auth state changes (cross-tab logout, fresh login)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (session?.access_token && !isTokenExpired(session.access_token)) {
        signedIn(session.access_token);
        setIsGuest(false);
        setIsLoading(false);
        return;
      }

      // For SIGNED_OUT: only sign out if we also have no local token
      if (event === "SIGNED_OUT") {
        const local = getAuthToken();
        if (!local) {
          signedOut();
          setIsGuest(true);
          setIsLoading(false);
        }
      }
      // For other null-session events: don't touch state — bootstrap() handles it
    });

    // Safety fallback: resolve after 4s no matter what
    const timer = setTimeout(() => {
      if (!active || resolved.current) return;
      const fallback = getAuthToken();
      setIsGuest(!fallback);
      setIsLoading(false);
    }, 4000);

    return () => {
      active = false;
      subscription.unsubscribe();
      clearTimeout(timer);
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
