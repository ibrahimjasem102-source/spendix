"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAuthToken } from "@/lib/auth/token-store";

interface GuestContextType {
  isGuest: boolean;
  isLoading: boolean;
}

const GuestContext = createContext<GuestContextType>({ isGuest: true, isLoading: true });

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [isGuest, setIsGuest] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // onAuthStateChange fires INITIAL_SESSION synchronously from cached session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthToken(session?.access_token ?? null);
      setIsGuest(!session?.user);
      setIsLoading(false);
    });

    // Fallback if onAuthStateChange doesn't fire (e.g. no cached session)
    const timeout = setTimeout(() => setIsLoading(false), 3000);

    return () => {
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
