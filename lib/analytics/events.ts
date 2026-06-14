"use client";

// ── Product Analytics Event Tracker ──────────────────────────
// Tracks user lifecycle events for growth analytics.
// Events are batched and sent to /api/analytics/events.

export type ProductEventName =
  | "signup"
  | "login"
  | "onboarding_started"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "subscription_upgrade_clicked"
  | "subscription_upgrade_completed"
  | "subscription_canceled"
  | "referral_invite_sent"
  | "referral_claimed"
  | "feature_gated"
  | "ai_assistant_used"
  | "report_generated"
  | "export_used"
  | "support_ticket_submitted"
  | "budget_created"
  | "goal_created"
  | "transaction_added"
  | "account_connected";

export interface ProductEvent {
  name: ProductEventName | string;
  properties?: Record<string, string | number | boolean | null>;
  timestamp: number;
  sessionId: string;
}

// ── Session ID (one per page load) ────────────────────────────
const SESSION_ID = typeof crypto !== "undefined" ? crypto.randomUUID() : "unknown";

// ── Batch buffer ───────────────────────────────────────────────
let _buffer: ProductEvent[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
const BATCH_SIZE  = 5;
const FLUSH_DELAY = 8_000;

async function flush() {
  if (_buffer.length === 0) return;
  const batch = _buffer.splice(0, BATCH_SIZE);
  try {
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // Silently drop — analytics must never break the app
  }
}

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => { _flushTimer = null; void flush(); }, FLUSH_DELAY);
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  window.addEventListener("beforeunload", () => void flush());
}

// ── Public API ─────────────────────────────────────────────────

export function trackEvent(
  name: ProductEventName | string,
  properties?: Record<string, string | number | boolean | null>,
) {
  _buffer.push({ name, properties, timestamp: Date.now(), sessionId: SESSION_ID });
  if (_buffer.length >= BATCH_SIZE) void flush();
  else scheduleFlush();
}

export const analytics = {
  track: trackEvent,

  signup:              (method: "email" | "oauth") => trackEvent("signup", { method }),
  login:               () => trackEvent("login"),
  onboardingStarted:   () => trackEvent("onboarding_started"),
  onboardingStep:      (step: string) => trackEvent("onboarding_step_completed", { step }),
  onboardingComplete:  () => trackEvent("onboarding_completed"),
  upgradeClicked:      (plan: string, from: string) => trackEvent("subscription_upgrade_clicked", { plan, from }),
  upgradeCompleted:    (plan: string) => trackEvent("subscription_upgrade_completed", { plan }),
  featureGated:        (feature: string, required: string) => trackEvent("feature_gated", { feature, required }),
  aiUsed:              (type: string) => trackEvent("ai_assistant_used", { type }),
  referralSent:        () => trackEvent("referral_invite_sent"),
  supportSubmitted:    (type: string) => trackEvent("support_ticket_submitted", { type }),
};
