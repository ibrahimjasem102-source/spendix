"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getAuthToken } from "@/lib/auth/token-store";
import { getDeviceCategory, getConnectionType, collectNavigationTimings, type PerfSample } from "@/lib/monitoring/rum";

const SESSION_ID = typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36);

export function PerformanceTracker() {
  const pathname = usePathname();
  const reported = useRef(new Set<string>());

  useEffect(() => {
    // Only report once per page per session
    if (reported.current.has(pathname)) return;
    reported.current.add(pathname);

    const lcpSamples: PerfSample[] = [];
    let observer: PerformanceObserver | null = null;

    try {
      observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last    = entries[entries.length - 1];
        if (last && last.startTime > 0) {
          lcpSamples.push({ metric: "lcp", value_ms: Math.round(last.startTime) });
        }
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // PerformanceObserver may not be supported
    }

    // Wait for the page to settle before collecting (LCP needs time)
    const timer = window.setTimeout(async () => {
      observer?.disconnect();

      const baseSamples  = collectNavigationTimings();
      const allSamples   = [...baseSamples, ...lcpSamples].filter(s => s.value_ms > 0 && s.value_ms < 60_000);
      if (allSamples.length === 0) return;

      const token = getAuthToken();
      await fetch("/api/analytics/performance", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          page:            pathname,
          session_id:      SESSION_ID,
          device_category: getDeviceCategory(),
          connection_type: getConnectionType(),
          samples:         allSamples,
        }),
      }).catch(() => {/* non-fatal */});
    }, 4500);

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
