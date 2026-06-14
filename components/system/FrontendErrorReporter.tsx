"use client";

import { useEffect } from "react";
import { getAuthToken } from "@/lib/auth/token-store";

export function FrontendErrorReporter() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      report({
        message: event.message,
        stack:   event.error?.stack,
        url:     window.location.href,
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      report({
        message: `Unhandled rejection: ${String(event.reason)}`,
        url:     window.location.href,
      });
    }

    async function report(payload: { message: string; stack?: string; url?: string }) {
      try {
        const token = getAuthToken();
        await fetch("/api/logs/error", {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
      } catch {
        // Never throw from error reporter
      }
    }

    window.addEventListener("error",               handleError);
    window.addEventListener("unhandledrejection",  handleRejection);
    return () => {
      window.removeEventListener("error",              handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
