"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Users, Activity, Database, Search, RefreshCw,
  Loader2, CheckCircle2, AlertTriangle, XCircle, BarChart3,
  Lock, Globe, Zap, TrendingUp, ServerCrash, Clock,
} from "lucide-react";
import { getAuthToken } from "@/lib/auth/token-store";
import { computePlatformScores, type PlatformScores } from "@/lib/platform/scores";

// ── Types ──────────────────────────────────────────────────────

interface HealthData {
  status: string;
  latency: { totalHealthCheckMs: number; transactionsTableMs: number; ledgerTableMs: number };
  counts: { users: number; transactions: number; goals: number; pendingGdpr: number };
  recentFrontendErrors: { message: string; created_at: string }[];
}

interface SecurityData {
  summary: { failedLogins24h: number; highSeverity24h: number; rateLimitHits7d: number };
  recentEvents: { id: string; event_type: string; severity: string; ip_address: string; created_at: string }[];
}

interface DQData {
  overallStatus: string;
  totalIssues: number;
  checks: { name: string; issues: number; status: string }[];
}

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in: string;
  subscription: { plan: string; status: string } | null;
  permission: { role: string };
}

// ── Tab system ─────────────────────────────────────────────────

const TABS = [
  { id: "health",    label: "الصحة",    icon: Activity },
  { id: "security",  label: "الأمان",   icon: Shield },
  { id: "users",     label: "المستخدمون", icon: Users },
  { id: "quality",   label: "جودة البيانات", icon: Database },
  { id: "scores",    label: "التقييم",  icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Score badge ────────────────────────────────────────────────

function ScoreBadge({ score, max }: { score: number; max: number }) {
  const pct = score / max;
  const color = pct >= 0.85 ? "text-emerald-400" : pct >= 0.65 ? "text-amber-400" : "text-red-400";
  return (
    <span className={`text-2xl font-black ${color}`}>
      {score}<span className="text-sm t3">/{max}</span>
    </span>
  );
}

function StatusDot({ status }: { status: "pass" | "warn" | "fail" }) {
  return status === "pass"
    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    : status === "warn"
    ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    : <XCircle       className="w-3.5 h-3.5 text-red-400 shrink-0" />;
}

// ── Page ──────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab,     setTab]     = useState<TabId>("health");
  const [access,  setAccess]  = useState<"loading" | "granted" | "denied">("loading");

  // Health
  const [health,     setHealth]     = useState<HealthData | null>(null);
  const [healthLoad, setHealthLoad] = useState(false);

  // Security
  const [security,    setSecurity]    = useState<SecurityData | null>(null);
  const [securityLoad, setSecurityLoad] = useState(false);

  // Users
  const [users,      setUsers]      = useState<AdminUser[]>([]);
  const [userQuery,  setUserQuery]  = useState("");
  const [usersLoad,  setUsersLoad]  = useState(false);

  // DQ
  const [dq,     setDq]     = useState<DQData | null>(null);
  const [dqLoad, setDqLoad] = useState(false);

  // Scores (static computation)
  const scores: PlatformScores = computePlatformScores();

  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const loadHealth = useCallback(async () => {
    setHealthLoad(true);
    const res = await fetch("/api/admin/system-health", { headers });
    const d = await res.json();
    if (d.ok) setHealth(d.data);
    else if (res.status === 403) setAccess("denied");
    setHealthLoad(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSecurity = useCallback(async () => {
    setSecurityLoad(true);
    const res = await fetch("/api/admin/security", { headers });
    const d = await res.json();
    if (d.ok) setSecurity(d.data);
    setSecurityLoad(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUsers = useCallback(async (q = "") => {
    setUsersLoad(true);
    const url = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : "/api/admin/users";
    const res = await fetch(url, { headers });
    const d = await res.json();
    if (d.ok) setUsers(d.data ?? []);
    setUsersLoad(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runDQ = useCallback(async () => {
    setDqLoad(true);
    const res = await fetch("/api/admin/data-quality", { headers });
    const d = await res.json();
    if (d.ok) setDq(d.data);
    setDqLoad(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadHealth().then(() => setAccess(a => a === "loading" ? "granted" : a));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (access !== "granted") return;
    if (tab === "security" && !security) loadSecurity();
    if (tab === "users"    && !users.length) loadUsers();
    if (tab === "quality"  && !dq) runDQ();
  }, [tab, access]); // eslint-disable-line react-hooks/exhaustive-deps

  if (access === "loading") {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="card p-12 text-center">
        <Lock className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-base font-black t1 mb-1">وصول مرفوض</p>
        <p className="text-xs t3">هذه الصفحة مخصصة للمديرين فقط</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-black t1">لوحة الإدارة</h1>
            <p className="text-xs t3">Admin Panel · Internal Only</p>
          </div>
        </div>
        <button onClick={() => { setHealth(null); setSecurity(null); loadHealth(); }}
          className="p-2.5 rounded-xl border border-[hsl(var(--border))] t3 hover:t1 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold shrink-0 transition-all ${
                tab === t.id
                  ? "bg-red-400/10 border border-red-400/30 text-red-400"
                  : "border border-[hsl(var(--border))] t3 hover:t2"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Health Tab ─────────────────────────────────────────── */}
      {tab === "health" && (
        <div className="space-y-4">
          {healthLoad ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>
          ) : health ? (
            <>
              {/* Status banner */}
              <div className={`card p-4 flex items-center gap-3 ${
                health.status === "healthy" ? "border-emerald-400/20 bg-emerald-400/5" : "border-amber-400/20 bg-amber-400/5"
              }`}>
                {health.status === "healthy"
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  : <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
                <p className="text-sm font-bold t1">
                  {health.status === "healthy" ? "النظام يعمل بشكل طبيعي" : "أداء متدهور — تحقق من قواعد البيانات"}
                </p>
              </div>

              {/* Latency cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "الفحص الكامل",     ms: health.latency.totalHealthCheckMs },
                  { label: "جدول المعاملات",   ms: health.latency.transactionsTableMs },
                  { label: "جدول الأستاذ",     ms: health.latency.ledgerTableMs },
                ].map(({ label, ms }) => (
                  <div key={label} className="card p-3 text-center">
                    <Clock className="w-4 h-4 t3 mx-auto mb-1" />
                    <p className={`text-lg font-black ${ms < 100 ? "text-emerald-400" : ms < 300 ? "text-amber-400" : "text-red-400"}`}>
                      {ms}ms
                    </p>
                    <p className="text-[10px] t3">{label}</p>
                  </div>
                ))}
              </div>

              {/* Counts */}
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(health.counts).map(([key, val]) => (
                  <div key={key} className="card p-3 flex items-center gap-3">
                    <Database className="w-4 h-4 t3 shrink-0" />
                    <div>
                      <p className="text-base font-black t1">{val.toLocaleString()}</p>
                      <p className="text-[10px] t3">{key}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent frontend errors */}
              {health.recentFrontendErrors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold t3">أخطاء الواجهة (آخر ساعة)</p>
                  {health.recentFrontendErrors.map((err, i) => (
                    <div key={i} className="card p-3 flex items-start gap-2">
                      <ServerCrash className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs t2 truncate">{err.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ── Security Tab ───────────────────────────────────────── */}
      {tab === "security" && (
        <div className="space-y-4">
          {securityLoad ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>
          ) : security ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "تسجيلات فاشلة (24h)", value: security.summary.failedLogins24h, color: "text-amber-400" },
                  { label: "أحداث عالية الخطورة",  value: security.summary.highSeverity24h,  color: "text-red-400" },
                  { label: "تجاوز Rate Limit (7d)", value: security.summary.rateLimitHits7d,  color: "text-purple-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card p-3 text-center">
                    <p className={`text-xl font-black ${color}`}>{value}</p>
                    <p className="text-[10px] t3 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold t3">أحداث الأمان الأخيرة</p>
                {security.recentEvents.length === 0 ? (
                  <div className="card p-6 text-center t3 text-xs">لا أحداث في آخر 24 ساعة</div>
                ) : security.recentEvents.map(evt => (
                  <div key={evt.id} className="card p-3 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      evt.severity === "critical" ? "bg-red-500"
                      : evt.severity === "high"   ? "bg-red-400"
                      : evt.severity === "medium" ? "bg-amber-400"
                      : "bg-slate-400"
                    }`} />
                    <p className="text-xs font-mono t2 flex-1 truncate">{evt.event_type}</p>
                    <p className="text-[10px] t3 shrink-0">{evt.ip_address ?? "—"}</p>
                    <p className="text-[10px] t3 shrink-0">
                      {new Date(evt.created_at).toLocaleTimeString("ar-SA")}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex justify-center py-8">
              <button onClick={loadSecurity} className="text-xs t3 hover:t1">تحميل البيانات</button>
            </div>
          )}
        </div>
      )}

      {/* ── Users Tab ──────────────────────────────────────────── */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 t3" />
              <input
                value={userQuery}
                onChange={e => setUserQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loadUsers(userQuery)}
                placeholder="ابحث بالبريد الإلكتروني..."
                className="input-field w-full text-sm ps-9"
              />
            </div>
            <button onClick={() => loadUsers(userQuery)}
              className="rounded-xl bg-red-400/10 border border-red-400/30 px-4 text-red-400 text-sm font-bold">
              {usersLoad ? <Loader2 className="w-4 h-4 animate-spin" /> : "بحث"}
            </button>
          </div>

          {users.map(u => (
            <div key={u.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold t1 truncate">{u.email}</p>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                  u.subscription?.plan === "elite" ? "bg-purple-400/10 text-purple-400"
                  : u.subscription?.plan === "pro"  ? "bg-blue-400/10 text-blue-400"
                  : u.subscription?.plan === "plus" ? "bg-cyan-400/10 text-cyan-400"
                  : "bg-slate-400/10 text-slate-400"
                }`}>
                  {u.subscription?.plan ?? "free"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-[10px] t3">
                <span>الدور: <strong className="t2">{u.permission.role}</strong></span>
                <span>آخر دخول: {u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString("ar-SA") : "—"}</span>
                <span>انضم: {new Date(u.created_at).toLocaleDateString("ar-SA")}</span>
              </div>
            </div>
          ))}

          {!usersLoad && users.length === 0 && (
            <div className="card p-8 text-center t3 text-xs">ابحث عن مستخدم</div>
          )}
        </div>
      )}

      {/* ── Data Quality Tab ───────────────────────────────────── */}
      {tab === "quality" && (
        <div className="space-y-4">
          {dqLoad ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              <p className="text-xs t3">جارٍ فحص قواعد البيانات...</p>
            </div>
          ) : dq ? (
            <>
              <div className={`card p-4 flex items-center gap-3 ${
                dq.overallStatus === "pass" ? "border-emerald-400/20 bg-emerald-400/5"
                : dq.overallStatus === "warn" ? "border-amber-400/20 bg-amber-400/5"
                : "border-red-400/20 bg-red-400/5"
              }`}>
                {dq.overallStatus === "pass"
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  : <AlertTriangle className="w-5 h-5 text-amber-400" />}
                <p className="text-sm font-bold t1">
                  {dq.overallStatus === "pass"
                    ? `لا مشاكل — البيانات سليمة`
                    : `${dq.totalIssues} مشكلة محتملة`}
                </p>
              </div>

              <div className="space-y-2">
                {dq.checks.map(c => (
                  <div key={c.name} className="card p-3 flex items-center gap-3">
                    <StatusDot status={c.status as "pass" | "warn" | "fail"} />
                    <div className="flex-1">
                      <p className="text-xs font-semibold t1">{c.name}</p>
                    </div>
                    <span className={`text-xs font-bold ${
                      c.issues === 0 ? "text-emerald-400" : "text-amber-400"
                    }`}>
                      {c.issues} مشكلة
                    </span>
                  </div>
                ))}
              </div>

              <button onClick={runDQ}
                className="w-full rounded-xl border border-[hsl(var(--border))] py-3 text-xs font-bold t2">
                إعادة الفحص
              </button>
            </>
          ) : (
            <div className="card p-8 text-center">
              <button onClick={runDQ}
                className="text-xs t3 hover:t1 flex items-center gap-2 mx-auto">
                <RefreshCw className="w-4 h-4" /> تشغيل فحص جودة البيانات
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Scores Tab ─────────────────────────────────────────── */}
      {tab === "scores" && (
        <div className="space-y-5">
          {/* Score cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "الأمان",     icon: Shield,    data: scores.security },
              { label: "الموثوقية", icon: Activity,  data: scores.reliability },
              { label: "التوسع",    icon: TrendingUp, data: scores.scalability },
            ].map(({ label, icon: Icon, data }) => (
              <div key={label} className="card p-4 text-center space-y-1">
                <Icon className="w-4 h-4 t3 mx-auto" />
                <ScoreBadge score={data.score} max={data.max} />
                <p className="text-[10px] t3">{label}</p>
              </div>
            ))}
          </div>

          {/* Check lists */}
          {[
            { label: "تفاصيل الأمان",    items: scores.security.items,     color: "text-red-400" },
            { label: "تفاصيل الموثوقية", items: scores.reliability.items,   color: "text-blue-400" },
            { label: "تفاصيل التوسع",    items: scores.scalability.items,   color: "text-purple-400" },
          ].map(group => (
            <div key={group.label} className="space-y-1.5">
              <p className="text-[10px] font-bold t3 uppercase tracking-wider">{group.label}</p>
              {group.items.map(item => (
                <div key={item.label} className="card p-2.5 flex items-start gap-2">
                  <StatusDot status={item.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs t1 font-medium">{item.label}</p>
                    {item.note && <p className="text-[10px] t3 mt-0.5">{item.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Risks */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold t3 uppercase tracking-wider">المخاطر المتبقية</p>
            {scores.risks.map(risk => (
              <div key={risk.risk} className={`card p-3 border-s-2 ${
                risk.severity === "high"   ? "border-red-400"
                : risk.severity === "medium" ? "border-amber-400"
                : "border-slate-500"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold ${
                    risk.severity === "high" ? "text-red-400" : risk.severity === "medium" ? "text-amber-400" : "t3"
                  }`}>{risk.severity.toUpperCase()}</span>
                  <span className="text-[10px] t3">· {risk.area}</span>
                </div>
                <p className="text-xs font-semibold t1 mb-0.5">{risk.risk}</p>
                <p className="text-[10px] t3 leading-relaxed">{risk.mitigation}</p>
              </div>
            ))}
          </div>

          {/* Roadmap */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold t3 uppercase tracking-wider">خارطة طريق 12 شهر</p>
            {scores.roadmap.map(quarter => (
              <div key={quarter.quarter} className="card p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <p className="text-xs font-bold text-cyan-400">{quarter.quarter}</p>
                </div>
                <ul className="space-y-1">
                  {quarter.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs t2">
                      <Zap className="w-3 h-3 t3 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
