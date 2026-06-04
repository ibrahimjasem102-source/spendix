"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signedIn, signedOut, initSession } from "@/lib/auth/session-manager";
import { getAuthToken } from "@/lib/auth/token-store";

interface GuestContextType {
  isGuest:  boolean;
  isLoading: boolean;
}

const GuestContext = createContext<GuestContextType>({ isGuest: true, isLoading: true });

export function GuestProvider({ children }: { children: React.ReactNode }) {
  // Synchronous init from localStorage — no race condition on first render
  const hasSession = initSession();

  const [isGuest,   setIsGuest]   = useState(!hasSession);
  const [isLoading, setIsLoading] = useState(!hasSession);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // onAuthStateChange is the primary listener.
    // Rules:
    //   SIGNED_IN / TOKEN_REFRESHED → always authenticate
    //   SIGNED_OUT                  → only sign out if we also have no local token
    //   INITIAL_SESSION with null   → trust local token if present, else sign out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (session?.access_token) {
        // Supabase confirmed a valid session — trust it
        signedIn(session.access_token);
        setIsGuest(false);
        setIsLoading(false);
        return;
      }

      // session is null
      if (event === "SIGNED_OUT") {
        // Explicit logout — always honour
        signedOut();
        setIsGuest(true);
        setIsLoading(false);
        return;
      }

      // INITIAL_SESSION / TOKEN_REFRESHED with null session:
      // Supabase lost its internal session, but we may still have our Bearer token.
      // Keep the user authenticated if spendix_access_token is present.
      const localToken = getAuthToken();
      if (localToken) {
        // Token exists — stay authenticated, do not call signedOut()
        setIsGuest(false);
        setIsLoading(false);
      } else {
        // No local token either — truly a guest
        signedOut();
        setIsGuest(true);
        setIsLoading(false);
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
