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
    let active = true;

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!active) return;
        setAuthToken(session?.access_token ?? null);
        setIsGuest(!session?.user);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setIsGuest(true);
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!active) return;
      setAuthToken(session?.access_token ?? null);
      setIsGuest(!session?.user);
      setIsLoading(false);
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
