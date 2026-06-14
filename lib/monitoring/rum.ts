export type RUMMetric = "fcp" | "lcp" | "ttfb" | "dom_load" | "page_load" | "cls" | "fid" | "inp";

export interface PerfSample {
  metric:   RUMMetric;
  value_ms: number;
}

export function getDeviceCategory(): "desktop" | "tablet" | "mobile" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua))   return "mobile";
  if (/Tablet|iPad/i.test(ua))    return "tablet";
  if (/Mac|Win|Linux/i.test(ua))  return "desktop";
  return "unknown";
}

export function getConnectionType(): string {
  if (typeof navigator === "undefined") return "unknown";
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
  return nav.connection?.effectiveType ?? "unknown";
}

export function collectNavigationTimings(): PerfSample[] {
  if (typeof performance === "undefined") return [];

  const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  const samples: PerfSample[] = [];

  if (nav) {
    const ttfb = nav.responseStart - nav.requestStart;
    if (ttfb > 0 && ttfb < 30_000) {
      samples.push({ metric: "ttfb",      value_ms: Math.round(ttfb) });
    }
    if (nav.domContentLoadedEventEnd > 0) {
      samples.push({ metric: "dom_load",  value_ms: Math.round(nav.domContentLoadedEventEnd) });
    }
    if (nav.loadEventEnd > 0) {
      samples.push({ metric: "page_load", value_ms: Math.round(nav.loadEventEnd) });
    }
  }

  for (const entry of performance.getEntriesByType("paint")) {
    if (entry.name === "first-contentful-paint" && entry.startTime > 0) {
      samples.push({ metric: "fcp", value_ms: Math.round(entry.startTime) });
    }
  }

  return samples;
}

// Core Web Vitals thresholds
export const CWV_THRESHOLDS = {
  fcp:       { good: 1800,  poor: 3000  },
  lcp:       { good: 2500,  poor: 4000  },
  ttfb:      { good: 800,   poor: 1800  },
  dom_load:  { good: 2000,  poor: 4000  },
  page_load: { good: 3000,  poor: 6000  },
  cls:       { good: 0.1,   poor: 0.25  },
  fid:       { good: 100,   poor: 300   },
  inp:       { good: 200,   poor: 500   },
} as const;

export function rateMetric(metric: RUMMetric, value: number): "good" | "needs_improvement" | "poor" {
  const t = CWV_THRESHOLDS[metric];
  if (!t) return "good";
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs_improvement";
  return "poor";
}
