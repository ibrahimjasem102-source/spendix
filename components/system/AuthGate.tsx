"use client";

// Middleware protects all (app) routes — no client-side gating needed.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
