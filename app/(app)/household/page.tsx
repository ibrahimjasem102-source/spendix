"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Plus, UserPlus, Trash2, LogOut, X, Check, Copy,
  Loader2, Users, Mail, Crown, Shield, User,
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Clock, AlertTriangle, Sparkles, Target, BarChart2,
} from "lucide-react";
import {
  useHousehold, useHouseholdSummary, useHouseholdPending,
  useCreateHousehold, useDeleteHousehold,
  useInviteToHousehold, useCancelInvitation, useAcceptInvitation,
  useLeaveHousehold, useRemoveHouseholdMember, useUpdateHouseholdMemberRole,
} from "@/lib/query/hooks";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useGuest } from "@/contexts/GuestContext";
import { spring, tapTransition } from "@/lib/motion";
import type { HouseholdRole, HouseholdSummary } from "@/types";
import PlanGate from "@/components/plans/PlanGate";

// ── Helpers ────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: "from-cyan-400/40 to-violet-400/40",   text: "text-cyan-300"    },
  { bg: "from-emerald-400/40 to-teal-400/40",  text: "text-emerald-300" },
  { bg: "from-rose-400/40 to-pink-400/40",     text: "text-rose-300"    },
  { bg: "from-amber-400/40 to-orange-400/40",  text: "text-amber-300"   },
  { bg: "from-indigo-400/40 to-purple-400/40", text: "text-indigo-300"  },
];

function avatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation();
  const map: Record<string, { label: string; cls: string; Icon: typeof Crown }> = {
    owner:  { label: t("household.role_owner"),  cls: "text-amber-400  bg-amber-400/10",  Icon: Crown  },
    admin:  { label: t("household.role_admin"),  cls: "text-violet-400 bg-violet-400/10", Icon: Shield },
    member: { label: t("household.role_member"), cls: "text-sky-400    bg-sky-400/10",    Icon: User   },
  };
  const cfg = map[role] ?? map.member;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.cls}`}>
      <cfg.Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

// ── Member card (redesigned) ───────────────────────────────────

function MemberCard({
  member, index, isMe, isOwner, canRemove, canManageRole,
  onRemove, onRoleChange, removing, updatingRole, format,
  totalIncome, totalExpenses,
}: {
  member: HouseholdSummary;
  index: number;
  isMe: boolean;
  isOwner: boolean;
  canRemove: boolean;
  canManageRole: boolean;
  onRemove: (id: string) => void;
  onRoleChange: (id: string, role: Exclude<HouseholdRole, "owner">) => void;
  removing: boolean;
  updatingRole: boolean;
  format: (n: number) => string;
  totalIncome: number;
  totalExpenses: number;
}) {
  const { t } = useTranslation();
  const ac = avatarColor(index);
  const initials = member.member_email.slice(0, 2).toUpperCase();
  const savingsRate = member.monthly_income > 0
    ? Math.max(0, Math.round(((member.monthly_income - member.monthly_expenses) / member.monthly_income) * 100))
    : 0;
  const incomePct  = totalIncome   > 0 ? Math.round((member.monthly_income   / totalIncome)   * 100) : 0;
  const expensePct = totalExpenses > 0 ? Math.round((member.monthly_expenses / totalExpenses) * 100) : 0;
  const isPositive = member.net_balance >= 0;

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }} transition={spring}
      className="card p-4 space-y-4"
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${ac.bg} flex items-center justify-center shrink-0`}>
          <span className={`text-sm font-black ${ac.text}`}>{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold t1 truncate">{member.member_email}</p>
            {isMe && <span className="text-[10px] text-cyan-400 font-semibold shrink-0">({t("household.you")})</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <RoleBadge role={member.member_role} />
            <span className="text-[10px] t3">{member.transaction_count} {t("household.transactions")}</span>
          </div>
        </div>
        {/* Net balance badge */}
        <div className={`shrink-0 rounded-2xl px-3 py-1.5 text-sm font-black tabular-nums ${
          isPositive ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"
        }`}>
          {isPositive ? "+" : ""}{format(member.net_balance)}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-[9px] t3 uppercase tracking-wide">{t("household.income")}</span>
          </div>
          <p className="text-xs font-bold text-emerald-400 tabular-nums">{format(member.monthly_income)}</p>
          {/* Contribution bar */}
          <div className="h-1 rounded-full bg-[hsl(var(--bg-input))] overflow-hidden">
            <div className="h-full rounded-full bg-emerald-400/60 transition-all"
              style={{ width: `${incomePct}%` }} />
          </div>
          <p className="text-[9px] t3">{incomePct}% {t("household.of_total")}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3 text-rose-400 shrink-0" />
            <span className="text-[9px] t3 uppercase tracking-wide">{t("household.expenses")}</span>
          </div>
          <p className="text-xs font-bold text-rose-400 tabular-nums">{format(member.monthly_expenses)}</p>
          <div className="h-1 rounded-full bg-[hsl(var(--bg-input))] overflow-hidden">
            <div className="h-full rounded-full bg-rose-400/60 transition-all"
              style={{ width: `${expensePct}%` }} />
          </div>
          <p className="text-[9px] t3">{expensePct}% {t("household.of_total")}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="text-[9px] t3 uppercase tracking-wide">{t("household.savings")}</span>
          </div>
          <p className="text-xs font-bold text-cyan-400 tabular-nums">{savingsRate}%</p>
          <div className="h-1 rounded-full bg-[hsl(var(--bg-input))] overflow-hidden">
            <div className="h-full rounded-full bg-cyan-400/60 transition-all"
              style={{ width: `${savingsRate}%` }} />
          </div>
          <p className="text-[9px] t3">{t("household.savings_rate")}</p>
        </div>
      </div>

      {/* Role management (owner only) */}
      {canManageRole && !isOwner && (
        <div className="flex items-center gap-2 pt-1 border-t border-[hsl(var(--border-2))]">
          <div className="relative flex-1">
            {updatingRole && (
              <Loader2 className="pointer-events-none absolute end-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-cyan-400" />
            )}
            <select
              value={member.member_role}
              disabled={updatingRole}
              onChange={(e) => onRoleChange(member.member_user_id, e.target.value as Exclude<HouseholdRole, "owner">)}
              className="field text-xs py-2 pe-7 disabled:opacity-60"
            >
              <option value="member">{t("household.role_member")}</option>
              <option value="admin">{t("household.role_admin")}</option>
            </select>
          </div>
          {canRemove && (
            <button
              onClick={() => onRemove(member.member_user_id)}
              disabled={removing}
              className="p-2 rounded-xl t3 hover:text-rose-400 hover:bg-rose-400/10 transition-all shrink-0"
            >
              {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      )}
      {canRemove && !canManageRole && (
        <div className="pt-1 border-t border-[hsl(var(--border-2))]">
          <button
            onClick={() => onRemove(member.member_user_id)}
            disabled={removing}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors"
          >
            {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {t("household.remove_member")}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Insight card ───────────────────────────────────────────────

function InsightCard({ icon: Icon, text, tone }: {
  icon: typeof Sparkles;
  text: string;
  tone: "positive" | "warning" | "info";
}) {
  const colors = {
    positive: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300",
    warning:  "border-amber-400/20   bg-amber-400/5   text-amber-300",
    info:     "border-cyan-400/20    bg-cyan-400/5    text-cyan-300",
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 ${colors[tone]}`}>
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <p className="text-xs font-medium leading-relaxed">{text}</p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

function HouseholdPageInner() {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const { isGuest, isLoading: guestLoading } = useGuest();
  const authenticated = !isGuest && !guestLoading;

  const { data: householdData, isLoading: hhLoading } = useHousehold(authenticated);
  const { data: summary = [], isLoading: summaryLoading } = useHouseholdSummary(
    authenticated && !!householdData?.household
  );
  const { data: pending } = useHouseholdPending(authenticated);

  const createHousehold  = useCreateHousehold();
  const deleteHousehold  = useDeleteHousehold();
  const invite           = useInviteToHousehold();
  const cancelInvitation = useCancelInvitation();
  const acceptInvitation = useAcceptInvitation();
  const leave            = useLeaveHousehold();
  const removeMember     = useRemoveHouseholdMember();
  const updateRole       = useUpdateHouseholdMemberRole();

  const [createName,    setCreateName]    = useState("");
  const [showCreate,    setShowCreate]    = useState(false);
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteRole,    setInviteRole]    = useState<Exclude<HouseholdRole, "owner">>("member");
  const [showInvite,    setShowInvite]    = useState(false);
  const [acceptToken,   setAcceptToken]   = useState("");
  const [showAccept,    setShowAccept]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removingId,    setRemovingId]    = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [copiedToken,   setCopiedToken]   = useState<string | null>(null);

  const household = householdData?.household ?? null;
  const myRole    = householdData?.role ?? "member";
  const isOwner   = myRole === "owner";
  const canInvite = myRole === "owner" || myRole === "admin";
  const myUserId  = (householdData as { user_id?: string } | null)?.user_id;

  // ── Aggregates ───────────────────────────────────────────────
  const totalIncome   = summary.reduce((s, m) => s + m.monthly_income,   0);
  const totalExpenses = summary.reduce((s, m) => s + m.monthly_expenses, 0);
  const totalBalance  = summary.reduce((s, m) => s + m.net_balance,      0);
  const savingsRate   = totalIncome > 0
    ? Math.max(0, Math.round(((totalIncome - totalExpenses) / totalIncome) * 100))
    : 0;

  // Health score 0-100
  const healthScore = useMemo(() => {
    let score = 50;
    if (savingsRate >= 20) score += 20;
    else if (savingsRate >= 10) score += 10;
    if (totalBalance > 0) score += 15;
    if (summary.length >= 2) score += 15; // family collaboration bonus
    return Math.min(100, score);
  }, [savingsRate, totalBalance, summary.length]);

  const healthLabel = healthScore >= 80 ? t("household.health_excellent")
    : healthScore >= 60 ? t("household.health_good")
    : healthScore >= 40 ? t("household.health_fair")
    : t("household.health_needs_attention");

  const healthColor = healthScore >= 80 ? "text-emerald-400"
    : healthScore >= 60 ? "text-cyan-400"
    : healthScore >= 40 ? "text-amber-400"
    : "text-rose-400";

  // Smart insights
  const insights = useMemo(() => {
    const list: { icon: typeof Sparkles; text: string; tone: "positive" | "warning" | "info" }[] = [];
    if (savingsRate >= 20) list.push({ icon: TrendingUp, text: t("household.insight_saving_well", { rate: savingsRate }), tone: "positive" });
    if (savingsRate < 10 && totalIncome > 0) list.push({ icon: AlertTriangle, text: t("household.insight_low_savings"), tone: "warning" });
    if (totalBalance < 0) list.push({ icon: AlertTriangle, text: t("household.insight_negative_balance"), tone: "warning" });
    if (summary.length >= 2) {
      const top = [...summary].sort((a, b) => b.monthly_income - a.monthly_income)[0];
      if (top && top.monthly_income > 0) list.push({ icon: Target, text: t("household.insight_top_earner", { email: top.member_email.split("@")[0] }), tone: "info" });
    }
    if (totalExpenses > totalIncome && totalIncome > 0) list.push({ icon: AlertTriangle, text: t("household.insight_overspending"), tone: "warning" });
    return list.slice(0, 3);
  }, [savingsRate, totalBalance, totalIncome, totalExpenses, summary, t]);

  function handleCopyToken(token: string) {
    void navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) return;
    await createHousehold.mutateAsync(name);
    setShowCreate(false); setCreateName("");
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    await invite.mutateAsync({ email, role: isOwner ? inviteRole : "member" });
    setInviteEmail(""); setInviteRole("member"); setShowInvite(false);
  }

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    const token = acceptToken.trim();
    if (!token) return;
    await acceptInvitation.mutateAsync(token);
    setAcceptToken(""); setShowAccept(false);
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId);
    try { await removeMember.mutateAsync(userId); } finally { setRemovingId(null); }
  }

  async function handleRoleChange(userId: string, role: Exclude<HouseholdRole, "owner">) {
    setUpdatingRoleId(userId);
    try { await updateRole.mutateAsync({ target_user_id: userId, role }); } finally { setUpdatingRoleId(null); }
  }

  // ── Loading / guest ──────────────────────────────────────────

  if (guestLoading || hhLoading) {
    return (
      <div className="py-24 flex items-center justify-center gap-2 t3">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">{t("common.loading")}</span>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/5 p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10">
              <Users className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black t1">{t("household.guest_title")}</h1>
              <p className="mt-1 text-sm t2 leading-relaxed">{t("household.guest_subtitle")}</p>
            </div>
          </div>
          <Link href="/login" className="btn-primary flex min-h-11 w-full items-center justify-center text-sm">
            {t("nav.sign_in")}
          </Link>
        </div>
      </div>
    );
  }

  // ── No household ─────────────────────────────────────────────

  if (!household) {
    return (
      <div className="space-y-5 max-w-xl mx-auto">
        {/* Header */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10">
            <Home className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black t1">{t("household.title")}</h1>
            <p className="mt-0.5 text-xs font-medium t3">{t("household.subtitle")}</p>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }} transition={tapTransition}
            onClick={() => setShowCreate(true)}
            className="card p-4 text-start space-y-2 hover:border-cyan-400/30 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-400/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-sm font-bold t1">{t("household.create")}</p>
            <p className="text-[11px] t3">{t("household.create_hint")}</p>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }} transition={tapTransition}
            onClick={() => setShowAccept(true)}
            className="card p-4 text-start space-y-2 hover:border-emerald-400/30 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-400/10 flex items-center justify-center">
              <Mail className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-sm font-bold t1">{t("household.enter_token")}</p>
            <p className="text-[11px] t3">{t("household.token_hint")}</p>
          </motion.button>
        </div>

        {/* Pending invitations */}
        {(pending?.received ?? []).length > 0 && (
          <div className="card p-4 space-y-3">
            <p className="text-sm font-bold t1">{t("household.pending_received")}</p>
            {pending!.received.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 p-3 bg-[hsl(var(--bg-input))] rounded-2xl">
                <div className="w-8 h-8 rounded-xl bg-cyan-400/10 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold t1 truncate">
                    {(inv.household as { name?: string } | undefined)?.name ?? t("household.unknown")}
                  </p>
                  <p className="text-[10px] t3">{t("household.expires")} {new Date(inv.expires_at).toLocaleDateString()}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }} transition={tapTransition}
                  onClick={() => acceptInvitation.mutate(inv.token)}
                  disabled={acceptInvitation.isPending}
                  className="btn-primary text-xs px-3 py-1.5 shrink-0"
                >
                  {acceptInvitation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("household.accept")}
                </motion.button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        <div className="card py-12 px-5 flex flex-col items-center gap-3 text-center">
          <div className="p-4 rounded-2xl bg-cyan-400/10">
            <Users className="w-10 h-10 text-cyan-400 opacity-60" />
          </div>
          <p className="text-sm font-semibold t1">{t("household.empty")}</p>
          <p className="text-xs t3 max-w-xs">{t("household.empty_sub")}</p>
        </div>

        {/* Forms */}
        <AnimatePresence>
          {showCreate && (
            <motion.form key="create"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={spring}
              onSubmit={handleCreate} className="card p-4 space-y-3"
            >
              <p className="text-sm font-bold t1">{t("household.create")}</p>
              <input autoFocus type="text" maxLength={60} value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={t("household.name_placeholder")} className="field text-sm" />
              <div className="flex gap-2">
                <motion.button type="submit" whileTap={{ scale: 0.97 }} transition={tapTransition}
                  disabled={!createName.trim() || createHousehold.isPending}
                  className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-1.5">
                  {createHousehold.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />{t("common.save")}</>}
                </motion.button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost px-4 text-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.form>
          )}
          {showAccept && (
            <motion.form key="accept"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={spring}
              onSubmit={handleAccept} className="card p-4 space-y-3"
            >
              <p className="text-sm font-bold t1">{t("household.enter_token")}</p>
              <input autoFocus type="text" value={acceptToken}
                onChange={(e) => setAcceptToken(e.target.value)}
                placeholder={t("household.token_placeholder")} className="field text-sm font-mono" />
              <div className="flex gap-2">
                <motion.button type="submit" whileTap={{ scale: 0.97 }} transition={tapTransition}
                  disabled={!acceptToken.trim() || acceptInvitation.isPending}
                  className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-1.5">
                  {acceptInvitation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />{t("household.accept")}</>}
                </motion.button>
                <button type="button" onClick={() => setShowAccept(false)} className="btn-ghost px-4 text-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {acceptInvitation.isError && <p className="text-xs text-rose-400">{t("household.error_accept")}</p>}
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Has household ─────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* ── Hero banner ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}
        className="relative overflow-hidden rounded-[1.75rem] p-5"
        style={{
          background: "linear-gradient(135deg, #0a1f2e 0%, #0d1420 50%, #1a0d2e 100%)",
          border: "1px solid rgba(6,182,212,0.18)",
        }}
      >
        <div className="absolute top-0 end-0 w-48 h-48 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ background: "#06B6D4", transform: "translate(35%,-35%)" }} />

        {/* Top row */}
        <div className="relative z-10 flex items-start justify-between gap-3 mb-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15 border border-cyan-400/20">
              <Home className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300/60">{t("household.title")}</p>
              <h1 className="mt-0.5 truncate text-xl font-black text-white">{household.name}</h1>
              <p className="text-xs text-white/50 mt-0.5">
                {summary.length} {t("household.members_count")}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-end">
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">{t("household.health_score")}</p>
            <p className={`text-2xl font-black tabular-nums mt-0.5 ${healthColor}`}>{healthScore}</p>
            <p className={`text-[10px] font-semibold ${healthColor}`}>{healthLabel}</p>
          </div>
        </div>

        {/* Health bar */}
        <div className="relative z-10 mb-5">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${healthScore}%` }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="h-full rounded-full"
              style={{ background: healthScore >= 80 ? "#10B981" : healthScore >= 60 ? "#06B6D4" : healthScore >= 40 ? "#F59E0B" : "#F43F5E" }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="relative z-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t("household.income"),     value: format(totalIncome),   color: "text-emerald-400", Icon: ArrowUpRight  },
            { label: t("household.expenses"),   value: format(totalExpenses), color: "text-rose-400",    Icon: ArrowDownRight },
            { label: t("household.net_balance"), value: (totalBalance >= 0 ? "+" : "") + format(totalBalance), color: totalBalance >= 0 ? "text-emerald-400" : "text-rose-400", Icon: TrendingUp },
            { label: t("household.savings"),    value: `${savingsRate}%`,     color: "text-cyan-400",    Icon: BarChart2 },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="rounded-2xl bg-white/5 border border-white/8 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-[9px] font-semibold text-white/40 uppercase tracking-wide">{label}</span>
              </div>
              <p className={`text-sm font-black tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Invite button */}
        {canInvite && (
          <div className="relative z-10 mt-4 pt-4 border-t border-white/10">
            <motion.button
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              <UserPlus className="w-4 h-4" />{t("household.invite_member")}
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* ── Smart Insights ─────────────────────────────────────── */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <p className="text-[10px] font-semibold uppercase tracking-wide t3">{t("household.insights")}</p>
          </div>
          {insights.map((ins, i) => (
            <InsightCard key={i} icon={ins.icon} text={ins.text} tone={ins.tone} />
          ))}
        </div>
      )}

      {/* ── Invite form ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showInvite && (
          <motion.form key="invite"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={spring}
            onSubmit={handleInvite} className="card p-4 space-y-3"
          >
            <p className="text-sm font-bold t1">{t("household.invite_member")}</p>
            <input autoFocus type="email" value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t("household.invite_placeholder")} className="field text-sm" />
            {isOwner && (
              <div className="grid grid-cols-2 gap-2">
                {(["member", "admin"] as const).map((role) => (
                  <button key={role} type="button" onClick={() => setInviteRole(role)}
                    className={`rounded-2xl border px-3 py-2.5 text-start transition-all ${
                      inviteRole === role
                        ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                        : "border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] t2"
                    }`}>
                    <span className="block text-xs font-bold">
                      {role === "admin" ? t("household.role_admin") : t("household.role_member")}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug t3">
                      {role === "admin" ? t("household.role_admin_hint") : t("household.role_member_hint")}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <motion.button type="submit" whileTap={{ scale: 0.97 }} transition={tapTransition}
                disabled={!inviteEmail.trim() || invite.isPending}
                className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-1.5">
                {invite.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" />{t("household.send_invite")}</>}
              </motion.button>
              <button type="button" onClick={() => setShowInvite(false)} className="btn-ghost px-4">
                <X className="w-4 h-4" />
              </button>
            </div>
            {invite.isError && <p className="text-xs text-rose-400">{t("household.error_invite")}</p>}
          </motion.form>
        )}
      </AnimatePresence>

      {/* ── Pending invitations ─────────────────────────────────── */}
      {(pending?.sent ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border-2))] flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-sm font-bold t1">{t("household.pending_invitations")}</p>
          </div>
          {pending!.sent.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border-2))] last:border-0">
              <div className="w-8 h-8 rounded-xl bg-amber-400/10 flex items-center justify-center shrink-0">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium t1 truncate">{inv.email}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <RoleBadge role={inv.role} />
                  <span className="text-[10px] t3">{t("household.expires")} {new Date(inv.expires_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleCopyToken(inv.token)}
                  className="p-1.5 rounded-xl t3 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"
                  title={t("household.copy_token")}>
                  {copiedToken === inv.token ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => cancelInvitation.mutate(inv.id)}
                  className="p-1.5 rounded-xl t3 hover:text-rose-400 hover:bg-rose-400/10 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Members ─────────────────────────────────────────────── */}
      {summaryLoading ? (
        <div className="py-10 flex items-center justify-center gap-2 t3">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] t3 font-semibold uppercase tracking-wide px-1">{t("household.members")}</p>
          <AnimatePresence>
            {summary.map((member, i) => (
              <MemberCard
                key={member.member_user_id}
                member={member}
                index={i}
                isMe={member.member_user_id === myUserId}
                isOwner={member.member_role === "owner"}
                canRemove={isOwner && member.member_user_id !== myUserId}
                canManageRole={isOwner && member.member_user_id !== myUserId && member.member_role !== "owner"}
                onRemove={handleRemove}
                onRoleChange={handleRoleChange}
                removing={removingId === member.member_user_id}
                updatingRole={updatingRoleId === member.member_user_id}
                format={format}
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Danger zone ─────────────────────────────────────────── */}
      <div className="card p-4 border border-rose-400/20">
        <p className="text-[10px] t3 font-semibold uppercase tracking-wide mb-3">{t("household.danger_zone")}</p>
        {isOwner ? (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <p className="text-sm t2 flex-1">{t("household.delete_confirm")}</p>
              <button onClick={() => deleteHousehold.mutate()} disabled={deleteHousehold.isPending}
                className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-600 transition-colors disabled:opacity-60">
                {deleteHousehold.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" />{t("household.delete")}</>}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-ghost px-3 py-1.5 text-sm">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm text-rose-400 hover:text-rose-300 transition-colors">
              <Trash2 className="w-4 h-4" />{t("household.delete_household")}
            </button>
          )
        ) : (
          <button onClick={() => leave.mutate()} disabled={leave.isPending}
            className="flex items-center gap-2 text-sm text-rose-400 hover:text-rose-300 transition-colors">
            {leave.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {t("household.leave")}
          </button>
        )}
      </div>
    </div>
  );
}

export default function HouseholdPage() {
  return (
    <PlanGate require="elite" featureName="الحسابات العائلية" overlay>
      <HouseholdPageInner />
    </PlanGate>
  );
}
