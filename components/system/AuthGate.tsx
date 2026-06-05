"use client";

import { useGuest } from "@/contexts/GuestContext";

/**
 * Prevents rendering children in guest state while auth is still loading.
 * Avoids flash of guest UI for logged-in users.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useGuest();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
