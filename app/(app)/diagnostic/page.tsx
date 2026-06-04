"use client";

import { useState, useEffect } from "react";
import { useGuest } from "@/contexts/GuestContext";
import { getAuthToken } from "@/lib/auth/token-store";
import { getIsAuthenticated } from "@/lib/auth/session-manager";
import { safeFetch } from "@/lib/fetch-safe";

interface DiagRow { label: string; value: string; ok: boolean }

export default function DiagnosticPage() {
  const { isGuest, isLoading } = useGuest();
  const [rows,    setRows]    = useState<DiagRow[]>([]);
  const [running, setRunning] = useState(false);
  const [apiResult, setApiResult] = useState<string>("");

  async function run() {
    setRunning(true);
    const results: DiagRow[] = [];

    // 1. localStorage token
    const stored = typeof window !== "undefined"
      ? localStorage.getItem("spendix_access_token")
      : null;
    results.push({
      label: "spendix_access_token in localStorage",
      value: stored ? `✓ ${stored.slice(0, 25)}…` : "NULL — not found",
      ok: !!stored,
    });

    // 2. In-memory token
    const memToken = getAuthToken();
    results.push({
      label: "_token (in-memory via getAuthToken)",
      value: memToken ? `✓ ${memToken.slice(0, 25)}…` : "NULL — not in memory",
      ok: !!memToken,
    });

    // 3. Session-manager _isAuthenticated
    results.push({
      label: "session-manager _isAuthenticated",
      value: String(getIsAuthenticated()),
      ok: getIsAuthenticated() === true,
    });

    // 4. GuestContext isGuest
    results.push({
      label: "GuestContext isGuest",
      value: String(isGuest),
      ok: !isGuest,
    });

    // 5. GuestContext isLoading
    results.push({
      label: "GuestContext isLoading",
      value: String(isLoading),
      ok: !isLoading,
    });

    // 6. Supabase localStorage keys
    const supaKeys = Object.keys(localStorage).filter((k) => k.startsWith("sb-"));
    results.push({
      label: "Supabase localStorage keys (sb-*)",
      value: supaKeys.length > 0 ? supaKeys.join(", ") : "NONE",
      ok: supaKeys.length > 0,
    });

    // 7. API call via safeFetch (includes Bearer token)
    try {
      const res = await safeFetch("/api/debug-auth");
      const data = await res.json();
      results.push({
        label: "API /debug-auth via safeFetch",
        value: `user_found: ${data.auth?.user_found}, has_bearer: ${data.request?.has_auth_header}, error: ${data.auth?.session_error ?? "none"}`,
        ok: data.auth?.user_found === true,
      });
      setApiResult(JSON.stringify(data, null, 2));
    } catch (e) {
      results.push({ label: "API /debug-auth via safeFetch", value: `ERROR: ${e}`, ok: false });
    }

    // 8. Test transaction creation (dry run — just checks auth)
    try {
      const res = await safeFetch("/api/transactions", { method: "GET" });
      results.push({
        label: "GET /api/transactions (auth check)",
        value: `HTTP ${res.status} ${res.ok ? "✓ authorized" : "✗ unauthorized"}`,
        ok: res.ok,
      });
    } catch (e) {
      results.push({ label: "GET /api/transactions", value: `ERROR: ${e}`, ok: false });
    }

    setRows(results);
    setRunning(false);
  }

  useEffect(() => { void run(); }, [isGuest, isLoading]);

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black t1">Auth Diagnostic</h1>
          <p className="text-xs t3 mt-0.5">تشخيص حالة المصادقة</p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="px-4 py-2 rounded-xl text-sm font-bold bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20 transition-all"
        >
          {running ? "Running…" : "Re-run"}
        </button>
      </div>

      <div className="card overflow-hidden">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-[hsl(var(--border-2))] last:border-0">
            <span className={`shrink-0 mt-0.5 text-sm font-black ${row.ok ? "text-emerald-400" : "text-rose-400"}`}>
              {row.ok ? "✓" : "✗"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold t2">{row.label}</p>
              <p className={`text-xs font-mono mt-0.5 break-all ${row.ok ? "text-emerald-400" : "text-rose-400"}`}>
                {row.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {apiResult && (
        <div className="card p-4">
          <p className="text-xs font-semibold t3 mb-2">Full API Response:</p>
          <pre className="text-[10px] font-mono text-cyan-300 overflow-auto max-h-48 whitespace-pre-wrap">{apiResult}</pre>
        </div>
      )}

      <div className="card p-4 text-xs t3 space-y-1">
        <p className="font-semibold t2">Expected after login:</p>
        <p>✓ spendix_access_token: present</p>
        <p>✓ _token: present</p>
        <p>✓ isAuthenticated: true</p>
        <p>✓ isGuest: false</p>
        <p>✓ API user_found: true</p>
        <p>✓ GET /api/transactions: HTTP 200</p>
      </div>
    </div>
  );
}
