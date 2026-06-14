"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Plus, Pencil, Trash2, X, ChevronRight,
  UserRound, CalendarDays, FileText, Home,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/useToast";
import ToastList from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  useFamilyMembers, useCreateFamilyMember, useUpdateFamilyMember, useDeleteFamilyMember,
} from "@/lib/query/hooks";
import { useGuest } from "@/contexts/GuestContext";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";
import type { FamilyMember, FamilyMemberFormData, FamilyRelationship } from "@/types";

// ── Constants ──────────────────────────────────────────────────

const RELATIONSHIPS: { value: FamilyRelationship | string; labelKey: string }[] = [
  { value: "spouse",      labelKey: "family.rel_spouse"      },
  { value: "parent",      labelKey: "family.rel_parent"      },
  { value: "child",       labelKey: "family.rel_child"       },
  { value: "sibling",     labelKey: "family.rel_sibling"     },
  { value: "grandparent", labelKey: "family.rel_grandparent" },
  { value: "grandchild",  labelKey: "family.rel_grandchild"  },
  { value: "uncle_aunt",  labelKey: "family.rel_uncle_aunt"  },
  { value: "cousin",      labelKey: "family.rel_cousin"      },
  { value: "other",       labelKey: "family.rel_other"       },
];

const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  "#06b6d4": { bg: "bg-cyan-500/20",    text: "text-cyan-300"    },
  "#10b981": { bg: "bg-emerald-500/20", text: "text-emerald-300" },
  "#f59e0b": { bg: "bg-amber-500/20",   text: "text-amber-300"   },
  "#8b5cf6": { bg: "bg-violet-500/20",  text: "text-violet-300"  },
  "#f43f5e": { bg: "bg-rose-500/20",    text: "text-rose-300"    },
  "#3b82f6": { bg: "bg-blue-500/20",    text: "text-blue-300"    },
};

function memberAvatar(member: FamilyMember) {
  const initials = member.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
  const colorCfg = member.avatar_color ? (AVATAR_COLORS[member.avatar_color] ?? AVATAR_COLORS["#06b6d4"]) : AVATAR_COLORS["#06b6d4"];
  return { initials: initials || "?", ...colorCfg };
}

function ageFromBirthDate(birth: string): string {
  const today = new Date();
  const bd    = new Date(birth);
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return String(age);
}

function nextBirthday(birth: string): string | null {
  const today = new Date();
  const bd    = new Date(birth);
  const next  = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  const diff  = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today!";
  if (diff <= 7)  return `In ${diff} day${diff > 1 ? "s" : ""}`;
  if (diff <= 30) return `In ${diff} days`;
  return null;
}

// ── Form ───────────────────────────────────────────────────────

function MemberForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: FamilyMember;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { t }     = useTranslation();
  const createMut = useCreateFamilyMember();
  const updateMut = useUpdateFamilyMember();

  const [form, setForm] = useState<FamilyMemberFormData>({
    name:         initial?.name         ?? "",
    relationship: initial?.relationship ?? "other",
    birth_date:   initial?.birth_date   ?? "",
    notes:        initial?.notes        ?? "",
  });
  const [error, setError] = useState("");
  const isEditing = !!initial;
  const busy = createMut.isPending || updateMut.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("family.name_required")); return; }
    setError("");
    try {
      if (isEditing) {
        await updateMut.mutateAsync({ id: initial!.id, ...form });
        onSaved(t("family.updated"));
      } else {
        await createMut.mutateAsync(form);
        onSaved(t("family.created"));
      }
      onClose();
    } catch {
      setError(t("common.error_generic"));
    }
  }

  const field = "field w-full";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="w-full rounded-t-2xl modern-surface max-h-[90dvh] flex flex-col"
      >
        {/* Handle */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-[hsl(var(--border-2))]" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 shrink-0">
          <h2 className="text-base font-semibold t1">
            {isEditing ? t("family.edit_member") : t("family.add_member")}
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--bg-3))] t3 hover:t1 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-2 flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium t3">{t("family.name")}</label>
              <input
                className={field}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t("family.name_placeholder")}
                autoFocus
              />
            </div>
            {/* Relationship */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium t3">{t("family.relationship")}</label>
              <select
                className={field}
                value={form.relationship}
                onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}
              >
                {RELATIONSHIPS.map(r => (
                  <option key={r.value} value={r.value}>{t(r.labelKey)}</option>
                ))}
              </select>
            </div>
            {/* Birth date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium t3">{t("family.birth_date")} ({t("common.optional")})</label>
              <input
                type="date"
                className={field}
                value={form.birth_date ?? ""}
                onChange={e => setForm(f => ({ ...f, birth_date: e.target.value || null }))}
              />
            </div>
            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium t3">{t("common.notes")} ({t("common.optional")})</label>
              <textarea
                className={cn(field, "resize-none")}
                rows={3}
                value={form.notes ?? ""}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                placeholder={t("family.notes_placeholder")}
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
          {/* Action bar */}
          <div className="shrink-0 px-5 pt-3 pb-5 border-t border-[hsl(var(--border))] flex gap-3">
            <button type="button" onClick={onClose} disabled={busy}
              className="btn-ghost flex-1 py-3 rounded-xl text-sm font-semibold border border-[hsl(var(--border))]">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={busy}
              className="btn-primary flex-[2] py-3 rounded-xl text-sm font-semibold">
              {busy ? "…" : isEditing ? t("common.save") : t("family.add_member")}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Member card ────────────────────────────────────────────────

function MemberCard({
  member, onEdit, onDelete,
}: {
  member: FamilyMember;
  onEdit: (m: FamilyMember) => void;
  onDelete: (m: FamilyMember) => void;
}) {
  const { t }  = useTranslation();
  const avatar = memberAvatar(member);
  const bday   = member.birth_date ? nextBirthday(member.birth_date) : null;
  const age    = member.birth_date ? ageFromBirthDate(member.birth_date) : null;

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-[hsl(var(--border-2))] last:border-0">
      {/* Avatar */}
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold text-sm", avatar.bg, avatar.text)}>
        {avatar.initials}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold t1 truncate">{member.name}</p>
          {bday && (
            <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full shrink-0">
              🎂 {bday}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs t3 capitalize">{member.relationship.replace(/_/g, " ")}</p>
          {age && <span className="text-xs t3">· {age} {t("common.years")}</span>}
        </div>
        {member.notes && (
          <p className="text-xs t3 mt-0.5 truncate">{member.notes}</p>
        )}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(member)}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--bg-3))] t3 hover:t1 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(member)}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function FamilyPage() {
  const { t }   = useTranslation();
  const { isGuest } = useGuest();
  const { toasts, addToast, dismiss } = useToast();
  const { data: members = [], isLoading } = useFamilyMembers(!isGuest);
  const deleteMut = useDeleteFamilyMember();

  const [showForm, setShowForm]   = useState(false);
  const [editing,  setEditing]    = useState<FamilyMember | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<FamilyMember | undefined>();
  const [deleting, setDeleting]   = useState(false);

  function openAdd()  { setEditing(undefined); setShowForm(true); }
  function openEdit(m: FamilyMember) { setEditing(m); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(undefined); }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      addToast(t("family.deleted"), "success");
    } catch {
      addToast(t("common.error_generic"), "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(undefined);
    }
  }

  // Upcoming birthdays (next 30 days)
  const upcomingBirthdays = members.filter(m => {
    if (!m.birth_date) return false;
    const nb = nextBirthday(m.birth_date);
    return nb !== null;
  });

  return (
    <div className="space-y-5">
      <ToastList toasts={toasts} dismiss={dismiss} />

      {/* Header */}
      <div className="flex min-w-0 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-400/10">
            <Heart className="h-4 w-4 text-rose-400" />
          </div>
          <div>
            <h1 className="text-xl font-black t1">{t("family.title")}</h1>
            <p className="mt-0.5 text-xs font-medium t3">{t("family.subtitle")}</p>
          </div>
        </div>
        {!isGuest && (
          <button
            onClick={openAdd}
            className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("family.add_member")}
          </button>
        )}
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">

        {/* Upcoming birthdays banner */}
        {upcomingBirthdays.length > 0 && (
          <motion.div variants={staggerItem}
            className="card p-4 border-amber-400/20 bg-amber-400/5">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-amber-400" />
              <p className="text-sm font-semibold text-amber-400">{t("family.upcoming_birthdays")}</p>
            </div>
            <div className="flex flex-col gap-1">
              {upcomingBirthdays.map(m => {
                const avatar = memberAvatar(m);
                return (
                  <div key={m.id} className="flex items-center gap-2">
                    <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold", avatar.bg, avatar.text)}>
                      {avatar.initials}
                    </div>
                    <p className="text-sm t1">{m.name}</p>
                    <span className="text-xs text-amber-400 ms-auto">{nextBirthday(m.birth_date!)}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Members list */}
        <motion.div variants={staggerItem}>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em]">
              {t("family.members")} {members.length > 0 && `(${members.length})`}
            </p>
          </div>

          {isLoading ? (
            <LoadingState rows={3} />
          ) : members.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title={t("family.empty_title")}
              body={t("family.empty_body")}
              iconColor="text-rose-400"
              iconBg="bg-rose-400/10"
              action={!isGuest ? { label: t("family.add_member"), onClick: openAdd } : undefined}
            />
          ) : (
            <div className="card overflow-hidden">
              {members.map(m => (
                <MemberCard
                  key={m.id}
                  member={m}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Links to shared features */}
        {members.length > 0 && (
          <motion.div variants={staggerItem}>
            <p className="text-[10px] font-bold t3 uppercase tracking-[0.15em] mb-2 px-1">{t("family.shared_features")}</p>
            <div className="card overflow-hidden">
              {([
                { href: "/household", icon: Home,        label: t("nav.household"),  desc: t("more.desc_household") },
                { href: "/goals",     icon: UserRound,   label: t("nav.goals"),      desc: t("family.shared_goals_desc") },
                { href: "/debts",     icon: FileText,    label: t("nav.debts"),      desc: t("family.shared_debts_desc") },
              ]).map(({ href, icon: Icon, label, desc }) => (
                <a key={href} href={href}
                  className="flex items-center gap-4 px-4 py-3.5 border-b border-[hsl(var(--border-2))] last:border-0 hover:bg-[hsl(var(--bg-input))] transition-colors">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--bg-3))]">
                    <Icon className="h-4 w-4 t3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold t1">{label}</p>
                    <p className="text-xs t3 mt-0.5">{desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 t3 shrink-0" />
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Form sheet */}
      <AnimatePresence>
        {showForm && (
          <MemberForm
            key={editing?.id ?? "new"}
            initial={editing}
            onClose={closeForm}
            onSaved={msg => { addToast(msg, "success"); closeForm(); }}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmModal
          title={t("family.delete_title")}
          message={t("family.delete_confirm", { name: deleteTarget.name })}
          confirmLabel={t("common.delete")}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(undefined)}
          loading={deleting}
        />
      )}
    </div>
  );
}
