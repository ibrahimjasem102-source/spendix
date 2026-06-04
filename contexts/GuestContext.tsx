"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signedIn, signedOut, initSession } from "@/lib/auth/session-manager";
import { getAuthToken } from "@/lib/auth/token-store";

interface GuestContextType {
  isGuest:   boolean;
  isLoading: boolean;
}

const GuestContext = createContext<GuestContextType>({ isGuest: true, isLoading: true });

export function GuestProvider({ children }: { children: React.ReactNode }) {
  // Synchronous init from localStorage — correct state before first render
  const hasSession       = initSession();
  const [isGuest,    setIsGuest]    = useState(!hasSession);
  const [isLoading,  setIsLoading]  = useState(!hasSession);
  const resolvedOnce = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (session?.access_token) {
        // Supabase confirmed a valid session
        signedIn(session.access_token);
        setIsGuest(false);
        setIsLoading(false);
        resolvedOnce.current = true;
        return;
      }

      // ── session is null ──────────────────────────────────────
      // CRITICAL: Never trust SIGNED_OUT / null session from Supabase alone.
      // Supabase fires SIGNED_OUT after token refresh failures, network errors,
      // or internal state mismatches — even when the user legitimately logged in.
      //
      // We rely on OUR OWN token (spendix_access_token) as the source of truth.
      // Only call signedOut() from explicit user logout, never from here.

      const localToken = getAuthToken();

      if (localToken) {
        // We have a valid Bearer token — stay authenticated
        setIsGuest(false);
        setIsLoading(false);
      } else {
        // No local token AND Supabase says no session → truly a guest
        setIsGuest(true);
        setIsLoading(false);
      }

      resolvedOnce.current = true;
    });

    // Safety timeout: if onAuthStateChange never fires (edge case),
    // fall back to local token state after 3 seconds
    const timeout = setTimeout(() => {
      if (!active || resolvedOnce.current) return;
      const localToken = getAuthToken();
      setIsGuest(!localToken);
      setIsLoading(false);
    }, 3000);

    return () => {
      active = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
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
