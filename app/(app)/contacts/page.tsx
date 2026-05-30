"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, User, Building2, Building, Package,
  Search, Plus, Phone, Mail, FileText,
  ChevronRight, Trash2, Pencil, X, AlertCircle,
  ArrowUpRight, ArrowDownLeft,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/useToast";
import ToastList from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ContactDetailModal from "@/components/contacts/ContactDetailModal";
import {
  useContacts, useCreateContact, useUpdateContact, useDeleteContact,
  useDebts,
} from "@/lib/query/hooks";
import { ROUTES } from "@/lib/routes";
import Link from "next/link";
import type { ContactType, FinancialContact, ContactFormData } from "@/types";

// ── Type helpers ──────────────────────────────────────────────

const TYPE_ICON: Record<ContactType, React.ElementType> = {
  person:  User,
  company: Building2,
  bank:    Building,
  other:   Package,
};

const TYPE_COLORS: Record<ContactType, { icon: string; bg: string }> = {
  person:  { icon: "text-blue-400",   bg: "bg-blue-400/15"   },
  company: { icon: "text-purple-400", bg: "bg-purple-400/15" },
  bank:    { icon: "text-emerald-400",bg: "bg-emerald-400/15"},
  other:   { icon: "text-gray-400",   bg: "bg-gray-400/15"   },
};

type ContactFilter = ContactType | "all";

interface ContactWithStats extends FinancialContact {
  totalReceivable: number;
  totalPayable:    number;
  netBalance:      number;
  activeDebts:     number;
  overdueDebts:    number;
}

// ── ContactFormModal ─────────────────────────────────────────

const CONTACT_TYPES: ContactType[] = ["person", "company", "bank", "other"];

function ContactFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: FinancialContact;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { t } = useTranslation();
  const createMut = useCreateContact();
  const updateMut = useUpdateContact();

  const [form, setForm] = useState<ContactFormData>({
    name:  initial?.name  ?? "",
    type:  initial?.type  ?? "person",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    notes: initial?.notes ?? "",
  });
  const [error, setError] = useState("");

  const isEditing = !!initial;
  const busy = createMut.isPending || updateMut.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError("");
    try {
      const payload: ContactFormData = {
        name:  form.name.trim(),
        type:  form.type,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        notes: form.notes?.trim() || null,
      };
      if (isEditing) {
        await updateMut.mutateAsync({ id: initial.id, data: payload });
        onSaved(t("contacts.updated"));
      } else {
        await createMut.mutateAsync(payload);
        onSaved(t("contacts.created"));
      }
      onClose();
    } catch {
      setError(t("contacts.save_error"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="w-full max-w-md bg-[hsl(var(--bg-card))] border border-[hsl(var(--border))] rounded-2xl p-6 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base t1">
            {isEditing ? t("contacts.edit") : t("contacts.add")}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 t3 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium t2">{t("contacts.name")}</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("contacts.name_placeholder")}
              required
              className="w-full px-3 py-2.5 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] text-sm t1 placeholder:t3 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium t2">{t("common.type")}</label>
            <div className="grid grid-cols-4 gap-2">
              {CONTACT_TYPES.map((ct) => {
                const Icon  = TYPE_ICON[ct];
                const clr   = TYPE_COLORS[ct];
                const active = form.type === ct;
                return (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: ct }))}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                      active
                        ? `${clr.bg} ${clr.icon} border-current/30`
                        : "bg-[hsl(var(--bg-input))] border-[hsl(var(--border))] t3 hover:t2"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t(`contacts.type_${ct}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium t2">{t("contacts.phone")}</label>
              <input
                value={form.phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder={t("contacts.phone_placeholder")}
                type="tel"
                className="w-full px-3 py-2.5 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] text-sm t1 placeholder:t3 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium t2">{t("contacts.email")}</label>
              <input
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder={t("contacts.email_placeholder")}
                type="email"
                className="w-full px-3 py-2.5 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] text-sm t1 placeholder:t3 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium t2">{t("contacts.notes")}</label>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t("contacts.notes_placeholder")}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] text-sm t1 placeholder:t3 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[hsl(var(--border))] text-sm font-medium t2 hover:t1 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy || !form.name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {busy ? "…" : t("common.save")}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── ContactCard ───────────────────────────────────────────────

function ContactCard({
  contact,
  onOpen,
  onEdit,
  onDelete,
}: {
  contact:  ContactWithStats;
  onOpen:   () => void;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const { t }    = useTranslation();
  const { format } = useCurrency();
  const Icon     = TYPE_ICON[contact.type];
  const clr      = TYPE_COLORS[contact.type];

  const isPositive = contact.netBalance > 0;
  const isNegative = contact.netBalance < 0;
  const isSettled  = contact.netBalance === 0 && contact.activeDebts === 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 flex items-center gap-3 group relative hover:border-white/20 transition-colors cursor-pointer"
      onClick={onOpen}
    >
      {/* Avatar */}
      <div className={`w-11 h-11 rounded-2xl ${clr.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${clr.icon}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm t1 truncate">{contact.name}</span>
          {contact.overdueDebts > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 font-bold shrink-0">
              {contact.overdueDebts} {t("contacts.overdue_debts")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs t3 capitalize">{t(`contacts.type_${contact.type}`)}</span>
          {contact.activeDebts > 0 && (
            <>
              <span className="text-xs t3">·</span>
              <span className="text-xs t3">{contact.activeDebts} {t("contacts.active_debts")}</span>
            </>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="text-right shrink-0 mr-1">
        {isSettled && contact.activeDebts === 0 ? (
          <span className="text-xs t3">{t("contacts.settled")}</span>
        ) : isPositive ? (
          <div className="flex items-center gap-0.5 text-emerald-400">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span className="font-bold text-sm">{format(contact.netBalance)}</span>
          </div>
        ) : isNegative ? (
          <div className="flex items-center gap-0.5 text-red-400">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span className="font-bold text-sm">{format(Math.abs(contact.netBalance))}</span>
          </div>
        ) : (
          <span className="text-xs t3">{t("contacts.settled")}</span>
        )}
        {!isSettled && (
          <div className={`text-[10px] mt-0.5 ${isPositive ? "text-emerald-400/70" : "text-red-400/70"}`}>
            {isPositive ? t("contacts.owe_you") : t("contacts.you_owe")}
          </div>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 t3 shrink-0" />

      {/* Action buttons (hover) */}
      <div
        className="absolute top-2 end-2 hidden group-hover:flex items-center gap-1 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg bg-[hsl(var(--bg-input))] t3 hover:t1 hover:bg-white/10 transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg bg-[hsl(var(--bg-input))] t3 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function ContactsPage() {
  const { t }    = useTranslation();
  const { format } = useCurrency();
  const { toasts, addToast, dismiss } = useToast();

  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState<ContactFilter>("all");
  const [detailId,   setDetailId]   = useState<string | null>(null);
  const [editContact, setEditContact] = useState<FinancialContact | undefined>();
  const [showForm,   setShowForm]   = useState(false);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);

  const { data: contacts = [],  isLoading: loadC } = useContacts();
  const { data: debtsData }                         = useDebts();
  const debts = debtsData?.debts ?? [];
  const deleteMut = useDeleteContact();

  // Per-contact debt stats from the shared debts query
  const statsMap = useMemo(() => {
    const map: Record<string, { recv: number; pay: number; active: number; overdue: number }> = {};
    for (const d of debts) {
      if (!d.contact_id) continue;
      map[d.contact_id] ??= { recv: 0, pay: 0, active: 0, overdue: 0 };
      if (d.status === "paid") continue;
      const rem = Math.max(0, d.total_amount - d.paid_amount);
      if (d.debt_type === "receivable") map[d.contact_id].recv   += rem;
      else                              map[d.contact_id].pay    += rem;
      map[d.contact_id].active++;
      if (d.status === "overdue") map[d.contact_id].overdue++;
    }
    return map;
  }, [debts]);

  const enriched: ContactWithStats[] = useMemo(() =>
    contacts.map((c) => {
      const s = statsMap[c.id] ?? { recv: 0, pay: 0, active: 0, overdue: 0 };
      return {
        ...c,
        totalReceivable: s.recv,
        totalPayable:    s.pay,
        netBalance:      s.recv - s.pay,
        activeDebts:     s.active,
        overdueDebts:    s.overdue,
      };
    }),
    [contacts, statsMap],
  );

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter !== "all") list = list.filter((c) => c.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      // Overdue first, then highest absolute balance, then alpha
      if (a.overdueDebts !== b.overdueDebts) return b.overdueDebts - a.overdueDebts;
      if (Math.abs(b.netBalance) !== Math.abs(a.netBalance))
        return Math.abs(b.netBalance) - Math.abs(a.netBalance);
      return a.name.localeCompare(b.name);
    });
  }, [enriched, filter, search]);

  // Summary totals
  const totalReceivable = enriched.reduce((s, c) => s + c.totalReceivable, 0);
  const totalPayable    = enriched.reduce((s, c) => s + c.totalPayable,    0);
  const owingCount      = enriched.filter((c) => c.netBalance > 0).length;
  const owedCount       = enriched.filter((c) => c.netBalance < 0).length;

  async function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await deleteMut.mutateAsync(id);
      addToast(t("contacts.deleted"), "success");
    } catch {
      addToast(t("contacts.delete_error"), "error");
    }
  }

  const FILTERS: { key: ContactFilter; label: string }[] = [
    { key: "all",     label: t("contacts.type_all")     },
    { key: "person",  label: t("contacts.type_person")  },
    { key: "company", label: t("contacts.type_company") },
    { key: "bank",    label: t("contacts.type_bank")    },
    { key: "other",   label: t("contacts.type_other")   },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold t1">{t("contacts.title")}</h1>
          <p className="text-sm t3 mt-0.5">{t("contacts.subtitle")}</p>
        </div>
        <button
          onClick={() => { setEditContact(undefined); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t("contacts.add")}
        </button>
      </div>

      {/* Summary cards */}
      {enriched.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              <span className="text-xs t3">{t("contacts.summary_receivable")}</span>
            </div>
            <div className="text-xl font-bold text-emerald-400">{format(totalReceivable)}</div>
            <div className="text-xs text-emerald-400/60 mt-0.5">
              {owingCount} {t("contacts.owe_you")}
            </div>
          </div>
          <div className="card p-4 border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-red-400" />
              <span className="text-xs t3">{t("contacts.summary_payable")}</span>
            </div>
            <div className="text-xl font-bold text-red-400">{format(totalPayable)}</div>
            <div className="text-xs text-red-400/60 mt-0.5">
              {owedCount} {t("contacts.you_owe")}
            </div>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 t3 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("contacts.search_placeholder")}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] text-sm t1 placeholder:t3 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-blue-600 text-white"
                  : "bg-[hsl(var(--bg-input))] t3 hover:t1 border border-[hsl(var(--border))]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loadC && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card p-4 animate-pulse flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded w-1/3" />
                <div className="h-3 bg-white/10 rounded w-1/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadC && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card py-16 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 mx-auto mb-4 flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <p className="text-sm font-semibold t1 mb-1">
            {search || filter !== "all" ? "No matches found" : t("contacts.no_contacts")}
          </p>
          {!search && filter === "all" && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              {t("contacts.add")}
            </button>
          )}
        </motion.div>
      )}

      {/* Contact list */}
      {!loadC && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              onOpen={() => setDetailId(c.id)}
              onEdit={() => { setEditContact(c); setShowForm(true); }}
              onDelete={() => setDeleteId(c.id)}
            />
          ))}
        </div>
      )}

      {/* Link to debts page */}
      {enriched.length > 0 && (
        <div className="flex justify-center pt-2">
          <Link
            href={ROUTES.debts}
            className="text-xs t3 hover:t1 flex items-center gap-1 transition-colors"
          >
            {t("contacts.view_debts")}
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <ContactFormModal
            key="form"
            initial={editContact}
            onClose={() => { setShowForm(false); setEditContact(undefined); }}
            onSaved={(msg) => addToast(msg, "success")}
          />
        )}
      </AnimatePresence>

      {detailId && (
        <ContactDetailModal
          contactId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}

      {deleteId && (
        <ConfirmModal
          title={t("contacts.delete")}
          message={t("contacts.delete_confirm")}
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      <ToastList toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
