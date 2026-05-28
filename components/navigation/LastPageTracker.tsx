"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { saveLastPage } from "@/lib/navigation";
import { isAppRoute } from "@/lib/routes";
import { ROUTES } from "@/lib/routes";

// Renders nothing — silently tracks the last visited app page in localStorage.
export default function LastPageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Don't track auth pages
    if (
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      !isAppRoute(pathname)
    ) return;

    saveLastPage(pathname);

    // Update document title to match route
    const segment = pathname.split("/").filter(Boolean).pop() ?? "dashboard";
    const label = segment.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    document.title = `${label} — Spendix`;
  }, [pathname]);

  return null;
}

// Helper: redirect to last visited page on cold open (client-only)
export function useLastPageRedirect() {
  const pathname = usePathname();
  return pathname === ROUTES.dashboard ? saveLastPage : () => {};
}
