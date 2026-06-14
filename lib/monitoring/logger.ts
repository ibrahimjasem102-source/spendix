"use client";

// Client-side monitoring logger with batching and rate limiting

export type LogLevel    = "debug" | "info" | "warn" | "error" | "critical";
export type LogCategory = "api" | "auth" | "sync" | "perf" | "ui" | "offline";

export interface LogEntry {
  level:    LogLevel;
  category: LogCategory;
  message:  string;
  data?:    Record<string, unknown>;
  url?:     string;
  duration?: number;
  timestamp: number;
  sessionId: string;
}

// ── Session ID (one per page load) ─────────────────────────────

const SESSION_ID = typeof crypto !== "undefined" ? crypto.randomUUID() : "unknown";

// ── Rate limiting: max 50 errors per minute ────────────────────

const RATE_WINDOW = 60_000;
let _errorCount   = 0;
let _windowStart  = Date.now();

function isRateLimited(): boolean {
  const now = Date.now();
  if (now - _windowStart > RATE_WINDOW) {
    _errorCount  = 0;
    _windowStart = now;
  }
  _errorCount++;
  return _errorCount > 50;
}

// ── Batch buffer ───────────────────────────────────────────────

let _buffer:      LogEntry[] = [];
let _flushTimer:  ReturnType<typeof setTimeout> | null = null;
const BATCH_SIZE  = 10;
const FLUSH_DELAY = 5_000;    // flush every 5 seconds
const ENDPOINT    = "/api/monitoring/log";

async function flush() {
  if (_buffer.length === 0) return;
  const batch = _buffer.splice(0, BATCH_SIZE);

  try {
    await fetch(ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ logs: batch }),
      keepalive: true,
    });
  } catch {
    // Silently drop — monitoring should never break the app
  }
}

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    void flush();
  }, FLUSH_DELAY);
}

// Flush immediately on page unload
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  window.addEventListener("beforeunload", () => void flush());
}

// ── Core log function ──────────────────────────────────────────

function log(level: LogLevel, category: LogCategory, message: string, data?: Record<string, unknown>) {
  if (level === "error" || level === "critical") {
    if (isRateLimited()) return;
  }

  const entry: LogEntry = {
    level,
    category,
    message,
    data,
    url:       typeof window !== "undefined" ? window.location.pathname : undefined,
    timestamp: Date.now(),
    sessionId: SESSION_ID,
  };

  _buffer.push(entry);

  // Immediate flush for critical errors
  if (level === "critical" || _buffer.length >= BATCH_SIZE) {
    void flush();
  } else {
    scheduleFlush();
  }

  // Also log to console in development
  if (process.env.NODE_ENV === "development") {
    const fn = level === "error" || level === "critical" ? console.error
      : level === "warn" ? console.warn
      : console.log;
    fn(`[Spendix:${category}]`, message, data ?? "");
  }
}

// ── Public API ─────────────────────────────────────────────────

export const logger = {
  debug:    (category: LogCategory, message: string, data?: Record<string, unknown>) => log("debug",    category, message, data),
  info:     (category: LogCategory, message: string, data?: Record<string, unknown>) => log("info",     category, message, data),
  warn:     (category: LogCategory, message: string, data?: Record<string, unknown>) => log("warn",     category, message, data),
  error:    (category: LogCategory, message: string, data?: Record<string, unknown>) => log("error",    category, message, data),
  critical: (category: LogCategory, message: string, data?: Record<string, unknown>) => log("critical", category, message, data),

  // Convenience: measure API call duration
  apiCall: async <T>(
    label: string,
    fn: () => Promise<T>,
    category: LogCategory = "api",
  ): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      const ms     = Math.round(performance.now() - start);
      if (ms > 3_000) {
        log("warn", category, `Slow ${label}: ${ms}ms`, { label, duration: ms });
      }
      return result;
    } catch (err) {
      const ms = Math.round(performance.now() - start);
      log("error", category, `Failed ${label}: ${String(err)}`, { label, duration: ms });
      throw err;
    }
  },
};
