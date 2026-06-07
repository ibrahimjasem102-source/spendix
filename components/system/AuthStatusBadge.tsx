"use client";

import { useEffect, useState } from "react";
import { useGuest } from "@/contexts/GuestContext";
import { getAuthToken } from "@/lib/auth/token-store";

export default function AuthStatusBadge() {
  const { isGuest } = useGuest();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getAuthToken());
  }, [isGuest]);

  // Only show in development
  if (process.env.NODE_ENV !== "development") return null;

  const status = isGuest
    ? { label: "✗ وضع الزائر", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" }
    : { label: "✓ مسجّل الدخول",  color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };

  return (
    <div className={`fixed bottom-24 end-3 z-[999] rounded-2xl border px-3 py-1.5 text-[10px] font-bold shadow-lg backdrop-blur-sm ${status.color}`}>
      {status.label}
      {token && <span className="ms-2 opacity-50">{token.slice(0, 8)}…</span>}
    </div>
  );
}
