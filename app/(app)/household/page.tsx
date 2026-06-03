"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Plus, UserPlus, Trash2, LogOut, X, Check, Copy,
  Loader2, Users, Mail, Crown, Shield, User,
  ArrowUpRight, ArrowDownRight, TrendingUp, Clock,
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

// ── Role badge ─────────────────────────────────────────────────
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

// ── Member card ────────────────────────────────────────────────
function MemberCard({
  member,
  isMe,
  isOwner,
  canRemove,
  canManageRole,
  onRemove,
  onRoleChange,
  removing,
  updatingRole,
  format,
}: {
  member: HouseholdSummary;
  isMe: boolean;
  isOwner: boolean;
  canRemove: boolean;
  canManageRole: boolean;
  onRemove: (id: string) => void;
  onRoleChange: (id: string, role: Exclude<HouseholdRole, "owner">) => void;
  removing: boolean;
  updatingRole: boolean;
  format: (n: number) => string;
}) {
  const { t } = useTranslation();
  const initials = member.member_email.slice(0, 2).toUpperCase();
  const savingsRate = member.monthly_income > 0
    ? Math.max(0, Math.round(((member.monthly_income - member.monthly_expenses) / member.monthly_income) * 100))
    : 0;

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }} transition={spring}
      className="card p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400/30 to-violet-400/30 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold t1">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold t1 truncate">{member.member_email}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <RoleBadge role={member.member_role} />
            {isMe && (
              <span className="text-[10px] text-cyan-400 font-semibold">{t("household.you")}</span>
            )}
          </div>
        </div>
        {!isOwner && (
          <div className="flex shrink-0 items-center gap-1.5">
            {canManageRole && (
              <div className="relative">
                {updatingRole && (
                  <Loader2 className="pointer-events-none absolute end-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-cyan-400" />
                )}
                <select
                  value={member.member_role}
                  disabled={updatingRole}
                  onChange={(event) => onRoleChange(member.member_user_id, event.target.value as Exclude<HouseholdRole, "owner">)}
                  className="h-8 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))] ps-2 pe-7 text-[11px] font-bold t1 outline-none disabled:opacity-60"
                  aria-label={t("household.permissions")}
                >
                  <option value="member">{t("household.role_member")}</option>
                  <option value="admin">{t("household.role_admin")}</option>
                </select>
              </div>
            )}
            {canRemove && (
              <button
                onClick={() => onRemove(member.member_user_id)}
                disabled={removing}
                className="p-1.5 rounded-lg t3 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                aria-label={t("household.remove_member")}
              >
                {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        )}
      </div>

      {canManageRole && !isOwner && (
        <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-3 py-2">
          <p className="text-[11px] font-semibold t2">
            {member.member_role === "admin"
              ? t("household.role_admin_hint")
              : t("household.role_member_hint")}
          </p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[hsl(var(--bg-input))] rounded-xl p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] t3 font-medium uppercase tracking-wide">{t("household.income")}</span>
          </div>
          <p className="text-xs font-bold text-emerald-400 tabular-nums">{format(member.monthly_income)}</p>
        </div>
        <div className="bg-[hsl(var(--bg-input))] rounded-xl p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ArrowDownRight className="w-3 h-3 text-rose-400" />
            <span className="text-[9px] t3 font-medium uppercase tracking-wide">{t("household.expenses")}</span>
          </div>
          <p className="text-xs font-bold text-rose-400 tabular-nums">{format(member.monthly_expenses)}</p>
        </div>
        <div className="bg-[hsl(var(--bg-input))] rounded-xl p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] t3 font-medium uppercase tracking-wide">{t("household.savings")}</span>
          </div>
          <p className="text-xs font-bold text-cyan-400 tabular-nums">{savingsRate}%</p>
        </div>
      </div>

      {/* Net balance + tx count */}
      <div className="flex items-center justify-between pt-1 border-t border-[hsl(var(--border-2))]">
        <span className="text-xs t3">{t("household.net_balance")}</span>
        <span className={`text-sm font-bold tabular-nums ${member.net_balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {member.net_balance >= 0 ? "+" : ""}{format(member.net_balance)}
        </span>
      </div>
      <div className="flex items-center justify-between -mt-1">
        <span className="text-xs t3">{t("household.transactions")}</span>
        <span className="text-xs t2 tabular-nums">{member.transaction_count}</span>
      </div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function HouseholdPage() {
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

  const [createName, setCreateName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<HouseholdRole, "owner">>("member");
  const [showInvite, setShowInvite] = useState(false);
  const [acceptToken, setAcceptToken] = useState("");
  const [showAccept, setShowAccept] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const household = householdData?.household ?? null;
  const myRole    = householdData?.role ?? "member";
  const isOwner   = myRole === "owner";
  const canInvite  = myRole === "owner" || myRole === "admin";

  // Try to determine current user id from summary (my entry)
  // We identify "me" by checking who matches no other member's email pattern
  // In practice the API includes all members; we use joined_at as a proxy heuristic.
  // Better: expose user_id from the /api/household GET, done via householdData.
  const myUserId = (householdData as { user_id?: string } | null)?.user_id;

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
    setShowCreate(false);
    setCreateName("");
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    await invite.mutateAsync({ email, role: isOwner ? inviteRole : "member" });
    setInviteEmail("");
    setInviteRole("member");
    setShowInvite(false);
  }

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    const token = acceptToken.trim();
    if (!token) return;
    await acceptInvitation.mutateAsync(token);
    setAcceptToken("");
    setShowAccept(false);
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId);
    try {
      await removeMember.mutateAsync(userId);
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRoleChange(userId: string, role: Exclude<HouseholdRole, "owner">) {
    setUpdatingRoleId(userId);
    try {
      await updateRole.mutateAsync({ target_user_id: userId, role });
    } finally {
      setUpdatingRoleId(null);
    }
  }

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
      <div className="mx-auto max-w-xl space-y-4 pb-28">
        <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/5 p-5">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10">
              <Home className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] t3">
                {t("household.title")}
              </p>
              <h1 className="mt-1 text-xl font-bold t1">{t("household.guest_title")}</h1>
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

  // ── No household yet ─────────────────────────────────────────
  if (!household) {
    return (
      <div className="space-y-4 max-w-xl mx-auto pb-28">
        {/* Header */}
        <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/5 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10">
              <Home className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold t1">{t("household.title")}</h1>
              <p className="text-xs t3 mt-0.5 leading-relaxed">{t("household.subtitle")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex min-h-11 items-center justify-center gap-1.5 text-sm"
            >
              <Plus className="w-4 h-4" />{t("household.create")}
            </button>
            <button
              onClick={() => setShowAccept(true)}
              className="btn-ghost flex min-h-11 items-center justify-center gap-1.5 text-sm"
            >
              <Mail className="w-4 h-4" />{t("household.enter_token")}
            </button>
          </div>
        </div>

        {/* Pending received invitations */}
        {(pending?.received ?? []).length > 0 && (
          <div className="card p-4 space-y-3">
            <p className="text-sm font-bold t1">{t("household.pending_received")}</p>
            {pending!.received.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 p-3 bg-[hsl(var(--bg-input))] rounded-xl">
                <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium t1 truncate">
                    {(inv.household as { name?: string } | undefined)?.name ?? t("household.unknown")}
                  </p>
                  <p className="text-[10px] t3">
                    {t("household.expires")} {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }} transition={tapTransition}
                  onClick={() => acceptInvitation.mutate(inv.token)}
                  disabled={acceptInvitation.isPending}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  {acceptInvitation.isPending
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : t("household.accept")}
                </motion.button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        <div className="card py-12 px-5 flex flex-col items-center gap-4 text-center">
          <div className="p-4 rounded-2xl bg-cyan-400/10">
            <Users className="w-10 h-10 text-cyan-400 opacity-60" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold t1">{t("household.empty")}</p>
            <p className="text-xs t3 mt-1 max-w-xs">{t("household.empty_sub")}</p>
          </div>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.form
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={spring}
              onSubmit={handleCreate}
              className="card p-4 space-y-3"
            >
              <p className="text-sm font-bold t1">{t("household.create")}</p>
              <input
                autoFocus type="text" maxLength={60}
                value={createName} onChange={(e) => setCreateName(e.target.value)}
                placeholder={t("household.name_placeholder")}
                className="field text-sm"
              />
              <div className="flex gap-2">
                <motion.button
                  type="submit" whileTap={{ scale: 0.97 }} transition={tapTransition}
                  disabled={!createName.trim() || createHousehold.isPending}
                  className="btn-primary flex-1 text-sm py-2.5"
                >
                  {createHousehold.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    : <><Check className="w-4 h-4" />{t("common.save")}</>}
                </motion.button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost px-4 text-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Accept by token form */}
        <AnimatePresence>
          {showAccept && (
            <motion.form
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={spring}
              onSubmit={handleAccept}
              className="card p-4 space-y-3"
            >
              <p className="text-sm font-bold t1">{t("household.enter_token")}</p>
              <input
                autoFocus type="text"
                value={acceptToken} onChange={(e) => setAcceptToken(e.target.value)}
                placeholder={t("household.token_placeholder")}
                className="field text-sm font-mono"
              />
              <div className="flex gap-2">
                <motion.button
                  type="submit" whileTap={{ scale: 0.97 }} transition={tapTransition}
                  disabled={!acceptToken.trim() || acceptInvitation.isPending}
                  className="btn-primary flex-1 text-sm py-2.5"
                >
                  {acceptInvitation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    : <><Check className="w-4 h-4" />{t("household.accept")}</>}
                </motion.button>
                <button type="button" onClick={() => setShowAccept(false)} className="btn-ghost px-4 text-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {acceptInvitation.isError && (
                <p className="text-xs text-rose-400">{t("household.error_accept")}</p>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Has household ─────────────────────────────────────────────
  const totalIncome   = summary.reduce((s, m) => s + m.monthly_income,   0);
  const totalExpenses = summary.reduce((s, m) => s + m.monthly_expenses, 0);
  const totalBalance  = summary.reduce((s, m) => s + m.net_balance,      0);
  const savingsRate   = totalIncome > 0
    ? Math.max(0, Math.round(((totalIncome - totalExpenses) / totalIncome) * 100))
    : 0;

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-28">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[24px] border border-cyan-400/20 bg-cyan-400/5 p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10">
              <Home className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] t3">{t("household.title")}</p>
              <h1 className="mt-1 truncate text-xl font-bold t1">{household.name}</h1>
              <p className="text-xs t3 mt-0.5">
                {summary.length} {t("household.members_count")}
              </p>
            </div>
          </div>
          {canInvite && (
            <motion.button
              whileTap={{ scale: 0.95 }} transition={tapTransition}
              onClick={() => setShowInvite(true)}
              className="btn-primary flex min-h-10 shrink-0 items-center gap-1.5 px-3 text-sm"
            >
              <UserPlus className="w-4 h-4" />{t("household.invite")}
            </motion.button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t("household.income"),   value: format(totalIncome),   color: "text-emerald-400", Icon: ArrowUpRight },
            { label: t("household.expenses"), value: format(totalExpenses), color: "text-rose-400",    Icon: ArrowDownRight },
            { label: t("household.net_balance"), value: format(totalBalance), color: totalBalance >= 0 ? "text-emerald-400" : "text-rose-400", Icon: TrendingUp },
            { label: t("household.savings"),  value: `${savingsRate}%`,     color: "text-cyan-400",   Icon: TrendingUp },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="bg-[hsl(var(--bg-input))] rounded-xl p-3 text-center">
              <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
              <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
              <p className="text-[10px] t3 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invite form */}
      <AnimatePresence>
        {showInvite && (
          <motion.form
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={spring}
            onSubmit={handleInvite}
            className="card p-4 space-y-3"
          >
            <p className="text-sm font-bold t1">{t("household.invite_member")}</p>
            <input
              autoFocus type="email"
              value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t("household.invite_placeholder")}
              className="field text-sm"
            />
            {isOwner ? (
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))] p-3">
                <p className="mb-2 text-[11px] font-bold uppercase t3">{t("household.permissions")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["member", "admin"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setInviteRole(role)}
                      className={`rounded-xl border px-3 py-2 text-start transition-all ${
                        inviteRole === role
                          ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] t2"
                      }`}
                    >
                      <span className="block text-xs font-bold">
                        {role === "admin" ? t("household.role_admin") : t("household.role_member")}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug t3">
                        {role === "admin" ? t("household.role_admin_hint") : t("household.role_member_hint")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-sky-400/15 bg-sky-400/5 px-3 py-2">
                <p className="text-xs font-semibold t2">{t("household.admin_invite_member_only")}</p>
              </div>
            )}
            <div className="flex gap-2">
              <motion.button
                type="submit" whileTap={{ scale: 0.97 }} transition={tapTransition}
                disabled={!inviteEmail.trim() || invite.isPending}
                className="btn-primary flex-1 text-sm py-2.5"
              >
                {invite.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  : <><UserPlus className="w-4 h-4" />{t("household.send_invite")}</>}
              </motion.button>
              <button type="button" onClick={() => setShowInvite(false)} className="btn-ghost px-4 text-sm">
                <X className="w-4 h-4" />
              </button>
            </div>
            {invite.isError && (
              <p className="text-xs text-rose-400">{t("household.error_invite")}</p>
            )}
          </motion.form>
        )}
      </AnimatePresence>

      {/* Pending sent invitations */}
      {(pending?.sent ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border-2))]">
            <p className="text-sm font-bold t1">{t("household.pending_invitations")}</p>
          </div>
          {pending!.sent.map((inv) => (
            <div key={inv.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border-2))] last:border-0">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium t1 truncate">{inv.email}</p>
                <p className="text-[10px] t3">
                  {t("household.expires")} {new Date(inv.expires_at).toLocaleDateString()}
                </p>
                <div className="mt-1">
                  <RoleBadge role={inv.role} />
                </div>
              </div>
              <button
                onClick={() => handleCopyToken(inv.token)}
                className="p-1.5 rounded-lg t3 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"
                title={t("household.copy_token")}
              >
                {copiedToken === inv.token ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => cancelInvitation.mutate(inv.id)}
                className="p-1.5 rounded-lg t3 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Member cards */}
      {summaryLoading ? (
        <div className="py-10 flex items-center justify-center gap-2 t3">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs t3 font-semibold uppercase tracking-wide">{t("household.members")}</p>
          <AnimatePresence>
            {summary.map((member) => (
              <MemberCard
                key={member.member_user_id}
                member={member}
                isMe={member.member_user_id === myUserId}
                isOwner={member.member_role === "owner"}
                canRemove={isOwner && member.member_user_id !== myUserId}
                canManageRole={isOwner && member.member_user_id !== myUserId && member.member_role !== "owner"}
                onRemove={handleRemove}
                onRoleChange={handleRoleChange}
                removing={removingId === member.member_user_id}
                updatingRole={updatingRoleId === member.member_user_id}
                format={format}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Danger zone */}
      <div className="card p-4 border border-rose-400/20">
        <p className="text-xs t3 font-semibold uppercase tracking-wide mb-3">{t("household.danger_zone")}</p>
        {isOwner ? (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <p className="text-sm t2 flex-1">{t("household.delete_confirm")}</p>
              <button
                onClick={() => deleteHousehold.mutate()}
                disabled={deleteHousehold.isPending}
                className="btn-primary bg-rose-500 hover:bg-rose-600 text-sm px-3 py-1.5 flex items-center gap-1.5"
              >
                {deleteHousehold.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <><Trash2 className="w-3.5 h-3.5" />{t("household.delete")}</>}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-ghost px-3 py-1.5 text-sm">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm text-rose-400 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />{t("household.delete_household")}
            </button>
          )
        ) : (
          <button
            onClick={() => leave.mutate()}
            disabled={leave.isPending}
            className="flex items-center gap-2 text-sm text-rose-400 hover:text-rose-300 transition-colors"
          >
            {leave.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <LogOut className="w-4 h-4" />}
            {t("household.leave")}
          </button>
        )}
      </div>
    </div>
  );
}
