"use client";

import { useEffect, useState } from "react";
import { useGuest } from "@/contexts/GuestContext";
import { getAuthToken } from "@/lib/auth/token-store";
import { safeFetch } from "@/lib/fetch-safe";

export default function AuthStatusBadge() {
  const { isGuest } = useGuest();
  const [token, setToken]   = useState<string | null>(null);
  const [apiOk, setApiOk]   = useState<boolean | null>(null);

  useEffect(() => {
    const t = getAuthToken();
    setToken(t);

    // Quick API test
    safeFetch("/api/debug-auth")
      .then((r) => r.json())
      .then((d) => setApiOk(d?.auth?.user_found === true))
      .catch(() => setApiOk(false));
  }, [isGuest]);

  const status =
    apiOk === true  ? { label: "✓ مسجّل الدخول — API يعمل",   color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" }
    : isGuest       ? { label: "✗ وضع الزائر — البيانات محلية", color: "bg-amber-500/20   text-amber-300   border-amber-500/30"   }
    : apiOk === false? { label: "⚠ مسجّل لكن API يرفض (401)",   color: "bg-rose-500/20    text-rose-300    border-rose-500/30"    }
    :                  { label: "… جارٍ التحقق",                 color: "bg-slate-500/20   text-slate-300   border-slate-500/30"   };

  return (
    <div className={`fixed bottom-24 end-3 z-[999] rounded-2xl border px-3 py-1.5 text-[10px] font-bold shadow-lg backdrop-blur-sm ${status.color}`}>
      {status.label}
      {token && <span className="ms-2 opacity-50">{token.slice(0, 8)}…</span>}
    </div>
  );
}
