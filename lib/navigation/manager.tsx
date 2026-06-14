"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const MAX_HISTORY = 20;

// The 4 fixed bottom nav tabs
const BOTTOM_TABS = ["/dashboard", "/ledger", "/analytics", "/more"] as const;

export type BottomTab = (typeof BOTTOM_TABS)[number];

function resolveActiveTab(pathname: string): BottomTab {
  return BOTTOM_TABS.find((t) => pathname === t || pathname.startsWith(t + "/")) ?? "/more";
}

interface NavigationState {
  currentRoute: string;
  activeTab:    BottomTab;
  history:      string[];
  canGoBack:    boolean;
  goBack:       (fallback?: string) => void;
}

const NavigationContext = createContext<NavigationState>({
  currentRoute: "/dashboard",
  activeTab:    "/dashboard",
  history:      [],
  canGoBack:    false,
  goBack:       () => {},
});

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const [history, setHistory] = useState<string[]>([]);
  const prevRef               = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevRef.current) {
      const prev = prevRef.current;
      prevRef.current = pathname;
      setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), prev]);
    }
  }, [pathname]);

  const goBack = useCallback(
    (fallback = "/dashboard") => {
      if (history.length > 0) router.back();
      else router.push(fallback);
    },
    [history.length, router],
  );

  return (
    <NavigationContext.Provider
      value={{
        currentRoute: pathname,
        activeTab:    resolveActiveTab(pathname),
        history,
        canGoBack:    history.length > 0,
        goBack,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationState {
  return useContext(NavigationContext);
}
